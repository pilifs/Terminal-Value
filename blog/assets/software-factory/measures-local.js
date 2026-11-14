// Period measures computed from overview.json, for the dashboard until stream A's
// measures.mjs (copied to /software-factory/measures.js) lands at the merge. It
// keeps that module's interface, so switching is a change of import:
//
//   computeMeasures(overview, { from, to, models, efforts })
//     -> [{ id, value, unit, numerator, denominator, coverage, filtered }]
//   series(overview, metricId, { from, to, models, efforts }) -> [{ day, value }]
//
// from and to are local dates, half-open [from, to); null is unbounded. models
// and efforts are lists of raw ids, or null for all. A filter a metric doesn't
// support is not applied, and the record says filtered: false.
//
// Also here, because they are the dashboard's own: periodRange (the date-range
// control's choices as a range), torontoDay, and trend (a series with days
// outside the dataset's measured bounds as null). No imports, no Node APIs.

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

const PERIOD_MEASURES = ['usage_usd', 'model_calls', 'cache_reuse', 'verification_completed', 'verification_duration_median'];

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

function verificationRows(overview, { from = null, to = null } = {}) {
  const days = dayIndexes(overview, from, to);
  const cDay = col(overview.verification, 'day');
  return overview.verification.rows.filter((r) => days.has(r[cDay]));
}

const sum = (rows, i) => rows.reduce((total, r) => total + (r[i] ?? 0), 0);

function median(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function measureOf(overview, metricId, rowsFor) {
  const t = overview.usage;
  const v = overview.verification;
  switch (metricId) {
    case 'usage_usd': {
      const rows = rowsFor('usage');
      const calls = sum(rows, col(t, 'calls'));
      const priced = sum(rows, col(t, 'pricedCalls'));
      return {
        value: sum(rows, col(t, 'usd')),
        numerator: null,
        denominator: null,
        coverage: { included: priced, total: calls, missing: calls - priced },
      };
    }
    case 'model_calls': {
      const rows = rowsFor('usage');
      const allTime = overview.measures.find((m) => m.id === 'model_calls');
      // Session coverage doesn't depend on the filter: a session with no metrics
      // file has unknown calls on every day and model.
      return { value: sum(rows, col(t, 'calls')), numerator: null, denominator: null, coverage: allTime?.coverage ?? null };
    }
    case 'cache_reuse': {
      const rows = rowsFor('usage');
      const read = sum(rows, col(t, 'cacheReadTokens'));
      const denominator = sum(rows, col(t, 'inputTokens')) + read + sum(rows, col(t, 'cacheWriteTokens'));
      const calls = sum(rows, col(t, 'calls'));
      return {
        value: denominator > 0 ? read / denominator : null,
        numerator: read,
        denominator,
        coverage: { included: calls, total: calls },
      };
    }
    case 'verification_completed': {
      const rows = rowsFor('verification');
      return { value: rows.length, numerator: null, denominator: null, coverage: { included: rows.length, total: rows.length, missing: 0 } };
    }
    case 'verification_duration_median': {
      const rows = rowsFor('verification');
      const wall = col(v, 'wallSeconds');
      const valid = rows.map((r) => r[wall]).filter((s) => typeof s === 'number' && Number.isFinite(s) && s > 0);
      return {
        value: median(valid),
        numerator: null,
        denominator: null,
        coverage: { included: valid.length, total: rows.length, missing: rows.length - valid.length },
      };
    }
    default:
      throw new Error(`measures-local: no period measure ${metricId}`);
  }
}

function rowsGetter(overview, metricId, opts) {
  return (kind) => (kind === 'usage' ? usageRows(overview, metricId, opts) : verificationRows(overview, opts));
}

function isFiltered(metricId, { from = null, to = null, models = null, efforts = null } = {}) {
  const { filters } = METRICS[metricId];
  return (
    (filters.includes('period') && (from !== null || to !== null)) ||
    (filters.includes('model') && models !== null) ||
    (filters.includes('effort') && efforts !== null)
  );
}

export function computeMeasures(overview, opts = {}) {
  // A range with none of the snapshot's days in it measured nothing: null, not 0.
  const empty = dayIndexes(overview, opts.from ?? null, opts.to ?? null).size === 0;
  return PERIOD_MEASURES.map((id) => ({
    id,
    unit: METRICS[id].unit,
    ...(empty
      ? { value: null, numerator: null, denominator: null, coverage: { included: 0, total: 0 } }
      : measureOf(overview, id, rowsGetter(overview, id, opts))),
    filtered: isFiltered(id, opts),
  }));
}

export function series(overview, metricId, opts = {}) {
  const { from = null, to = null } = opts;
  const days = METRICS[metricId].filters.includes('period') ? overview.days.filter((d) => (from === null || d >= from) && (to === null || d < to)) : overview.days;
  return days.map((day) => {
    const next = addDays(day, 1);
    const one = { ...opts, from: day, to: next };
    return { day, value: measureOf(overview, metricId, rowsGetter(overview, metricId, one)).value };
  });
}

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
 * series() for the trend chart, with days the metric's dataset didn't measure
 * as null: a day outside the measured bounds is unknown, not zero.
 */
export function trend(overview, manifest, metricId, opts = {}) {
  const bounds = datasetDays(manifest, METRICS[metricId].dataset);
  return series(overview, metricId, opts).map((p) =>
    bounds && (p.day < bounds.first || p.day > bounds.last) ? { day: p.day, value: null } : p
  );
}
