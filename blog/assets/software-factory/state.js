// The overview's view state: date range, model, effort and the chart's measure,
// kept in the URL so back and forward work and a link opens the same view.
// Plain functions, no DOM: app.js reads location.search, the tests a string.
//
//   parseState(search)            -> state, before any data is loaded
//   fitState(state, overview)     -> state with a model or effort the snapshot lacks dropped
//   serializeState(state)         -> '?period=7d&model=…' ('' for the default view)
//   queryOptions(state, overview) -> { from, to, models, efforts } for computeMeasures
//   describeState(state, overview) -> the sentence above the summary

import { formatDay } from './format.js';
import { addDays, periodRange } from './measures-local.js';

/** From config/metrics.json periods.choices and chart; a test checks they agree. */
export const PERIODS = ['all', '7d', '30d'];
export const MEASURES = ['usage_usd', 'model_calls', 'cache_reuse', 'verification_completed'];
export const PERIOD_LABELS = { all: 'All time', '7d': 'Last 7 days', '30d': 'Last 30 days' };
export const DEFAULT_STATE = Object.freeze({ period: 'all', model: null, effort: null, measure: MEASURES[0] });

const KEYS = ['period', 'model', 'effort', 'measure'];

/**
 * The state a query string asks for. An unknown period or measure falls back to
 * the default; model and effort are kept as written until fitState() sees the
 * snapshot, so a link keeps its filters whichever snapshot loads.
 */
export function parseState(search) {
  const q = new URLSearchParams(search);
  const text = (key) => {
    const v = q.get(key);
    return v && v.trim() ? v.trim() : null;
  };
  const period = text('period');
  const measure = text('measure');
  return {
    period: PERIODS.includes(period) ? period : DEFAULT_STATE.period,
    model: text('model'),
    effort: text('effort'),
    measure: MEASURES.includes(measure) ? measure : DEFAULT_STATE.measure,
  };
}

/** The query string for a state, in a fixed order and leaving out defaults. */
export function serializeState(state) {
  const q = new URLSearchParams();
  for (const key of KEYS) {
    const v = state[key];
    if (v !== null && v !== undefined && v !== DEFAULT_STATE[key]) q.set(key, v);
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

/** The state with a model or effort the snapshot doesn't have dropped (to all). */
export function fitState(state, overview) {
  return {
    ...state,
    model: state.model && overview.models.some((m) => m.id === state.model) ? state.model : null,
    effort: state.effort && overview.efforts.includes(state.effort) ? state.effort : null,
  };
}

export const sameState = (a, b) => KEYS.every((k) => (a[k] ?? null) === (b[k] ?? null));

/** The options computeMeasures, series and trend take. */
export function queryOptions(state, overview) {
  return {
    ...periodRange(overview, state.period),
    models: state.model ? [state.model] : null,
    efforts: state.effort ? [state.effort] : null,
  };
}

export const modelLabel = (overview, id) => overview.models.find((m) => m.id === id)?.label ?? id;

/** 'Nov 2–8, 2026' or 'Oct 30 – Nov 8, 2026' for the days of a half-open range. */
export function rangeText(from, to) {
  const last = addDays(to, -1);
  const [fy, fm] = from.split('-');
  const [ly, lm] = last.split('-');
  if (from === last) return formatDay(from);
  if (fy === ly && fm === lm) return `${formatDay(from, { year: false })}–${Number(last.slice(8))}, ${ly}`;
  if (fy === ly) return `${formatDay(from, { year: false })} – ${formatDay(last)}`;
  return `${formatDay(from)} – ${formatDay(last)}`;
}

/** The period as a short label, with its days when bounded: 'Last 7 days (Nov 2–8, 2026)'. */
export function periodText(state, overview) {
  if (state.period === 'all') return PERIOD_LABELS.all;
  const { from, to } = periodRange(overview, state.period);
  return from ? `${PERIOD_LABELS[state.period]} (${rangeText(from, to)})` : PERIOD_LABELS[state.period];
}

/** The filters in words: 'Opus 5.5, high effort', or '' when none is set. */
export function filterText(state, overview) {
  return [state.model && modelLabel(overview, state.model), state.effort && `${state.effort} effort`]
    .filter(Boolean)
    .join(', ');
}

/** The sentence that says what the page shows. */
export function describeState(state, overview) {
  const period = state.period === 'all' ? 'all time' : periodText(state, overview).replace(/^Last/, 'the last');
  const who = state.model || state.effort
    ? `${state.model ? modelLabel(overview, state.model) : 'all models'}, ${state.effort ? `${state.effort} effort` : 'all efforts'}`
    : 'all models and efforts';
  const scope = state.model || state.effort ? ' Model and effort apply to the usage panels only; each panel says what it follows.' : '';
  return `Showing ${period}, ${who}.${scope}`;
}
