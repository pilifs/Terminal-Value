// Period measures from an overview, for a chosen range and filters: the same
// code runs in the build and, copied to /software-factory/measures.js, in the
// browser. Owned by stream A (data): llm-dlc/loops/software-factory-data.md.
// Plain ES module, no imports, no Node APIs.
//
// Interface, frozen in Phase 0 (docs/software-factory.md):
//
//   computeMeasures(overview, { from, to, models, efforts })
//     -> [{ id, value, unit, numerator, denominator, coverage, filtered }]
//     from and to are local dates (half-open [from, to)); null means
//     unbounded. models and efforts are lists of raw ids, or null for all.
//     A filter a metric doesn't support (config/metrics.json filters) is not
//     applied to it, and its record says so with filtered: false.
//
//   series(overview, metricId, { from, to, models, efforts })
//     -> [{ day, value }] for the trend chart, one per day in range.
//
// The rules, beyond the interface:
//
//   - Records come in the order of the overview's measures, one per metric
//     with a single value (usage_share_by_model is a breakdown, not here).
//     Unfiltered and unbounded, every value, numerator, denominator and
//     coverage equals the overview's all-time measure.
//   - filtered is true when every filter asked for was applied to the value
//     (so also when none was asked for), false when one was not. Asking for a
//     filter means a non-null from, to, models or efforts. Stocks support no
//     filter: any of them gives filtered: false and the value at the revision.
//   - A period metric's dataset spans the days from its table's first row to
//     its last (usage, verification). A range that shares no day with that
//     span gives null: nothing was observed there, which is not zero. Inside
//     the span a count is a count, 0 included; usd is null only when calls
//     exist and none of them is priced; cache reuse is null for a zero
//     denominator; a median of no valid durations is null.
//   - model_calls carries the overview's coverage (sessions with a metrics
//     file): the overview has no per-session rows to narrow it by.
//     verification_completed counts the results without a finishedAt as
//     missing from every period, since none of them can be placed in one.
//   - series gives every calendar day in [from, to); an unbounded side stops
//     at the overview's first or last day. It throws for a stock or an
//     unknown metric.

// Kept equal to config/metrics.json by test/data-measures.test.mjs: this
// module can't import it.
export const METRICS = [
  { id: 'usage_usd', unit: 'usd', kind: 'period', filters: ['period', 'model', 'effort'], dataset: 'usage' },
  { id: 'model_calls', unit: 'calls', kind: 'period', filters: ['period', 'model', 'effort'], dataset: 'usage' },
  { id: 'cache_reuse', unit: 'ratio', kind: 'period', filters: ['period', 'model', 'effort'], dataset: 'usage' },
  { id: 'verification_completed', unit: 'jobs', kind: 'period', filters: ['period'], dataset: 'verification' },
  { id: 'verification_duration_median', unit: 'seconds', kind: 'period', filters: ['period'], dataset: 'verification' },
  { id: 'changes_recorded', unit: 'changes', kind: 'stock', filters: [], dataset: null },
  { id: 'examples_catalog', unit: 'examples', kind: 'stock', filters: [], dataset: null },
];

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const round6 = (n) => Math.round(n * 1e6) / 1e6;

function nextDay(day) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function options(overview, { from = null, to = null, models = null, efforts = null } = {}) {
  if (!overview || !Array.isArray(overview.days) || !overview.usage || !overview.verification)
    throw new TypeError('measures: an overview with days, usage and verification is required');
  for (const [name, d] of [['from', from], ['to', to]])
    if (d !== null && (typeof d !== 'string' || !DATE.test(d))) throw new TypeError(`measures: ${name} must be YYYY-MM-DD or null`);
  for (const [name, list] of [['models', models], ['efforts', efforts]])
    if (list !== null && !Array.isArray(list)) throw new TypeError(`measures: ${name} must be a list of raw ids or null`);
  return { from, to, models, efforts };
}

// Column positions by name, so the order of columns is read, not assumed.
function columns(table) {
  return Object.fromEntries(table.columns.map((c, i) => [c, i]));
}

// The half-open day-index range [lo, hi) of the overview's days in [from, to).
function dayWindow(days, from, to) {
  let lo = 0;
  let hi = days.length;
  while (lo < hi && from !== null && days[lo] < from) lo++;
  while (hi > lo && to !== null && days[hi - 1] >= to) hi--;
  return [lo, hi];
}

// [first, last] day index with a row in the table, or null for an empty table.
function span(table, dayCol) {
  if (!table.rows.length) return null;
  let first = Infinity;
  let last = -Infinity;
  for (const r of table.rows) {
    first = Math.min(first, r[dayCol]);
    last = Math.max(last, r[dayCol]);
  }
  return [first, last];
}

function median(sorted) {
  if (!sorted.length) return null;
  const mid = sorted.length / 2;
  return sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Sets of axis indexes the model and effort filters keep, or null for all.
function axisFilter(axis, wanted) {
  if (wanted === null) return null;
  const set = new Set(wanted);
  const keep = new Set();
  axis.forEach((v, i) => set.has(v) && keep.add(i));
  return keep;
}

function usageTotals(overview, rows) {
  const u = columns(overview.usage);
  const t = { calls: 0, priced: 0, usd: 0, input: 0, read: 0, write: 0 };
  for (const r of rows) {
    t.calls += r[u.calls];
    t.priced += r[u.pricedCalls];
    t.usd += r[u.usd];
    t.input += r[u.inputTokens];
    t.read += r[u.cacheReadTokens];
    t.write += r[u.cacheWriteTokens];
  }
  return t;
}

function verificationTotals(overview, rows) {
  const v = columns(overview.verification);
  const seconds = rows.map((r) => r[v.wallSeconds]).filter((s) => s !== null).sort((a, b) => a - b);
  return { completed: rows.length, seconds };
}

function allTime(overview, id) {
  return overview.measures.find((m) => m.id === id) ?? null;
}

function record(metric, value, coverage, filtered, numerator = null, denominator = null) {
  return { id: metric.id, value, unit: metric.unit, numerator, denominator, coverage, filtered };
}

// The value of one period metric over the rows in a window, or null outside its span.
function periodValue(overview, metric, rows, inSpan) {
  if (metric.dataset === 'usage') {
    const t = usageTotals(overview, rows);
    if (metric.id === 'usage_usd') {
      const coverage = { included: t.priced, total: t.calls, missing: t.calls - t.priced };
      const value = !inSpan || (t.calls && !t.priced) ? null : round6(t.usd);
      return { value, coverage };
    }
    if (metric.id === 'model_calls') return { value: inSpan ? t.calls : null, coverage: allTime(overview, metric.id)?.coverage ?? null };
    const den = t.input + t.read + t.write;
    return {
      value: inSpan && den ? t.read / den : null,
      numerator: inSpan ? t.read : null,
      denominator: inSpan ? den : null,
      coverage: { included: t.calls, total: t.calls },
    };
  }
  const t = verificationTotals(overview, rows);
  if (metric.id === 'verification_completed') {
    const unplaced = allTime(overview, metric.id)?.coverage?.missing ?? 0;
    return { value: inSpan ? t.completed : null, coverage: { included: t.completed, total: t.completed + unplaced, missing: unplaced } };
  }
  return {
    value: inSpan ? median(t.seconds) : null,
    coverage: { included: t.seconds.length, total: t.completed, missing: t.completed - t.seconds.length },
  };
}

// Rows of the metric's table that the applied filters keep, and whether every
// asked-for filter was applied.
function select(overview, metric, { from, to, models, efforts }, window) {
  const supports = (f) => metric.filters.includes(f);
  const asked = { period: from !== null || to !== null, model: models !== null, effort: efforts !== null };
  const filtered = Object.entries(asked).every(([f, on]) => !on || supports(f));
  const table = overview[metric.dataset];
  const c = columns(table);
  const [lo, hi] = supports('period') ? window : [0, overview.days.length];
  const keepModel = supports('model') && c.model !== undefined ? axisFilter(overview.models.map((m) => m.id), models) : null;
  const keepEffort = supports('effort') && c.effort !== undefined ? axisFilter(overview.efforts, efforts) : null;
  const rows = table.rows.filter(
    (r) => r[c.day] >= lo && r[c.day] < hi && (!keepModel || keepModel.has(r[c.model])) && (!keepEffort || keepEffort.has(r[c.effort])),
  );
  const s = span(table, c.day);
  const inSpan = s !== null && Math.max(lo, s[0]) <= Math.min(hi - 1, s[1]);
  return { rows, inSpan, filtered };
}

function metricFor(id) {
  const metric = METRICS.find((m) => m.id === id);
  if (!metric) throw new Error(`measures: unknown metric ${id}`);
  return metric;
}

export function computeMeasures(overview, opts = {}) {
  const o = options(overview, opts);
  const window = dayWindow(overview.days, o.from, o.to);
  const ids = overview.measures.map((m) => m.id).filter((id) => METRICS.some((m) => m.id === id));
  return ids.map((id) => {
    const metric = metricFor(id);
    if (metric.kind === 'stock') {
      const m = allTime(overview, id);
      const asked = o.from !== null || o.to !== null || o.models !== null || o.efforts !== null;
      return record(metric, m.value, m.coverage, !asked, m.numerator ?? null, m.denominator ?? null);
    }
    const { rows, inSpan, filtered } = select(overview, metric, o, window);
    const v = periodValue(overview, metric, rows, inSpan);
    return record(metric, v.value, v.coverage, filtered, v.numerator ?? null, v.denominator ?? null);
  });
}

export function series(overview, metricId, opts = {}) {
  const o = options(overview, opts);
  const metric = metricFor(metricId);
  if (metric.kind === 'stock') throw new Error(`measures: ${metricId} is a stock, with no value per day`);
  const { days } = overview;
  const start = o.from ?? days[0];
  const end = o.to ?? (days.length ? nextDay(days.at(-1)) : undefined);
  if (start === undefined || end === undefined) return [];
  const out = [];
  for (let day = start; day < end; day = nextDay(day)) {
    const window = dayWindow(days, day, nextDay(day));
    const { rows, inSpan } = select(overview, metric, { ...o, from: day, to: nextDay(day) }, window);
    out.push({ day, value: periodValue(overview, metric, rows, inSpan).value });
  }
  return out;
}
