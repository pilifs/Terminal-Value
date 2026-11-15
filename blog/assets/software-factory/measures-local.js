// The dashboard's own helpers beside stream A's period measures. computeMeasures
// and series are A's (blog/software-factory/measures.mjs, served as
// /software-factory/measures.js); this module keeps what A's has no part in:
//
//   METRICS          the metric table by id, with each metric's dataset
//   periodRange      the date-range control's choices as a range (addDays helps)
//   torontoDay       an instant's America/Toronto calendar day
//   datasetDays      the local days a manifest dataset measured
//   trend            series points with days outside those bounds as null
//   usageBreakdown   a usage breakdown recomputed for a range and filters
//
// from and to are local dates, half-open [from, to); null is unbounded. models
// and efforts are lists of raw ids, or null for all. No imports, no Node APIs,
// so the build imports it as it is and the browser loads it unbundled.

// From config/metrics.json (version 1); a test checks they agree.
export const METRICS = {
  usage_usd: { unit: 'usd', filters: ['period', 'model', 'effort'], dataset: 'usage' },
  model_calls: { unit: 'calls', filters: ['period', 'model', 'effort'], dataset: 'usage' },
  cache_reuse: { unit: 'ratio', filters: ['period', 'model', 'effort'], dataset: 'usage' },
  verification_completed: { unit: 'jobs', filters: ['period'], dataset: 'verification' },
  verification_duration_median: { unit: 'seconds', filters: ['period'], dataset: 'verification' },
  changes_recorded: { unit: 'changes', filters: [], dataset: 'changes' },
  examples_catalog: { unit: 'examples', filters: [], dataset: 'catalog' },
  usage_share_by_model: { unit: 'ratio', filters: ['period', 'effort'], dataset: 'usage' },
};

const col = (table, name) => table.columns.indexOf(name);

/** Days of the overview inside [from, to), as indexes into overview.days. */
function dayIndexes(overview, from, to) {
  const keep = new Set();
  overview.days.forEach((day, i) => {
    if ((from === null || from === undefined || day >= from) && (to === null || to === undefined || day < to)) keep.add(i);
  });
  return keep;
}

function usageRows(overview, metricId, { from = null, to = null, models = null, efforts = null } = {}) {
  const { filters } = METRICS[metricId];
  const t = overview.usage;
  const [cDay, cModel, cEffort] = [col(t, 'day'), col(t, 'model'), col(t, 'effort')];
  const days = dayIndexes(overview, from, to);
  const modelSet = filters.includes('model') && models ? new Set(models) : null;
  const effortSet = filters.includes('effort') && efforts ? new Set(efforts) : null;
  return t.rows.filter(
    (r) =>
      days.has(r[cDay]) &&
      (!modelSet || modelSet.has(overview.models[r[cModel]]?.id)) &&
      (!effortSet || effortSet.has(overview.efforts[r[cEffort]]))
  );
}

const sum = (rows, i) => rows.reduce((total, r) => total + (r[i] ?? 0), 0);

/** 'YYYY-MM-DD' plus n days. */
export function addDays(day, n) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const TORONTO = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' });

/** The America/Toronto calendar day of an instant, as 'YYYY-MM-DD'. */
export function torontoDay(instant) {
  return TORONTO.format(new Date(instant));
}

const TORONTO_CLOCK = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Toronto', hour: 'numeric', minute: '2-digit', hourCycle: 'h23' });

/** The America/Toronto wall clock of an instant: { hour: 0..23, minute }. */
export function torontoClock(instant) {
  const parts = Object.fromEntries(TORONTO_CLOCK.formatToParts(new Date(instant)).map((p) => [p.type, p.value]));
  return { hour: Number(parts.hour) % 24, minute: Number(parts.minute) };
}

/** That wall clock as words: '2:15 pm', '6 am', 'noon', 'midnight'. */
export function clockWords({ hour, minute }) {
  if (minute === 0 && hour === 0) return 'midnight';
  if (minute === 0 && hour === 12) return 'noon';
  return `${hour % 12 || 12}${minute ? `:${String(minute).padStart(2, '0')}` : ''} ${hour < 12 ? 'am' : 'pm'}`;
}

/**
 * The date-range control's choice as a half-open range of local days, ending
 * with the snapshot's last day (not the reader's clock: the data is as of the
 * snapshot). 'all' is unbounded.
 */
export function periodRange(overview, period) {
  const n = { '7d': 7, '30d': 30 }[period];
  if (!n || !overview.days.length) return { from: null, to: null };
  const last = overview.days[overview.days.length - 1];
  return { from: addDays(last, 1 - n), to: addDays(last, 1) };
}

/** The local days [first, last] a manifest dataset measured, or null if it has no bounds. */
export function datasetDays(manifest, datasetId) {
  const d = manifest?.datasets?.find((x) => x.id === datasetId);
  if (!d || !d.from || !d.to) return null;
  return { first: torontoDay(d.from), last: torontoDay(new Date(Date.parse(d.to) - 1)) };
}

/**
 * The trend chart's points: series(overview, metricId, opts) from measures.js,
 * with days the metric's dataset didn't measure as null. A day outside the
 * measured bounds is unknown, not zero.
 */
export function trend(points, manifest, metricId) {
  const bounds = datasetDays(manifest, METRICS[metricId].dataset);
  return points.map((p) => (bounds && (p.day < bounds.first || p.day > bounds.last) ? { day: p.day, value: null } : p));
}

const DIMENSION_COLUMN = { model: 'model', effort: 'effort' };

/**
 * A usage breakdown (by model or by effort) recomputed for a range and filters,
 * in the shape of overview.breakdowns rows: [{ key, label, value, share }],
 * in the snapshot's order of models or efforts, leaving out a key with no calls
 * in the cohort. The metric's filters decide which options apply: usage share
 * by model doesn't take the model filter. The dashboard's own: stream A's
 * module has no breakdowns.
 */
export function usageBreakdown(overview, breakdown, opts = {}) {
  const column = DIMENSION_COLUMN[breakdown.dimension];
  if (!column) throw new Error(`measures-local: no usage breakdown by ${breakdown.dimension}`);
  const t = overview.usage;
  const rows = usageRows(overview, breakdown.metricId, opts);
  const [cKey, cCalls, cPriced, cUsd] = [col(t, column), col(t, 'calls'), col(t, 'pricedCalls'), col(t, 'usd')];
  const keys = column === 'model' ? overview.models.map((m) => m.id) : overview.efforts;
  const keyOf = (r) => (column === 'model' ? overview.models[r[cKey]]?.id : overview.efforts[r[cKey]]);
  const groups = new Map(keys.map((k) => [k, { calls: 0, usd: 0 }]));
  for (const r of rows) {
    const g = groups.get(keyOf(r));
    if (!g) continue;
    g.calls += r[cCalls] ?? 0;
    g.usd += r[cUsd] ?? 0;
  }
  const total = rows.reduce((s, r) => s + (r[cUsd] ?? 0), 0);
  const calls = sum(rows, cCalls);
  const priced = sum(rows, cPriced);
  return {
    rows: keys
      .filter((k) => groups.get(k).calls > 0)
      .map((k) => ({
        key: k,
        label: column === 'model' ? overview.models.find((m) => m.id === k).label : k,
        value: groups.get(k).usd,
        share: total > 0 ? groups.get(k).usd / total : null,
      })),
    coverage: { included: priced, total: calls, missing: calls - priced },
  };
}
