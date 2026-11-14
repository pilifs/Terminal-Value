// Formatting for the Software Factory pages: plain functions shared by the
// build (render.mjs) and the browser (app.js), so both print a number the same
// way. No imports, no DOM, no Node APIs.

export function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'YYYY-MM-DD' as 'Nov 8, 2026', or 'Nov 8' with { year: false }. */
export function formatDay(day, { year = true } = {}) {
  const [y, m, d] = String(day).split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}${year ? `, ${y}` : ''}`;
}

const integer = (n) => Math.round(n).toLocaleString('en-US');

/** Whole seconds under two minutes, then minutes, then hours. */
export function formatDuration(seconds) {
  if (seconds < 120) return `${integer(seconds)} s`;
  if (seconds < 7200) return `${(seconds / 60).toFixed(1)} min`;
  return `${(seconds / 3600).toFixed(1)} h`;
}

/**
 * A value in its unit, for display. null (no value: a zero denominator, nothing
 * measured) is 'No data', never 0.
 */
export function formatValue(value, unit) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'No data';
  switch (unit) {
    case 'usd':
      return value !== 0 && Math.abs(value) < 0.01
        ? '< $0.01'
        : `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'ratio':
      return `${(value * 100).toFixed(1)}%`;
    case 'seconds':
      return formatDuration(value);
    default:
      return integer(value);
  }
}

/** A tick label for a chart axis: compact, one style per axis. */
export function formatTick(value, unit) {
  if (unit === 'ratio') return `${Math.round(value * 100)}%`;
  const prefix = unit === 'usd' ? '$' : '';
  if (Math.abs(value) >= 10000) return `${prefix}${Math.round(value / 1000).toLocaleString('en-US')}K`;
  if (unit === 'usd' && value !== 0 && Math.abs(value) < 10) return `${prefix}${value.toFixed(value < 1 ? 2 : 1)}`;
  return `${prefix}${integer(value)}`;
}

/** 'n of m', with what was counted when the record says. */
export function formatCoverage(coverage) {
  if (!coverage) return 'Coverage unknown';
  const base = `${integer(coverage.included)} of ${integer(coverage.total)}`;
  return coverage.note ? `${base} ${coverage.note}` : base;
}

/** The unit as words, for captions and accessible names. */
export const UNIT_WORDS = {
  usd: 'US dollars',
  calls: 'calls',
  ratio: 'share of input tokens',
  jobs: 'jobs',
  seconds: 'seconds',
  changes: 'changes',
  examples: 'examples',
};
