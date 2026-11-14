// Pieces of the overview drawn the same way by the build (render.mjs, the
// default view) and the browser (app.js, after a filter or the snapshot
// changes). Strings in, strings out: no DOM, no Node APIs.

import { escapeHtml as e, formatCoverage, formatDay, formatValue, UNIT_WORDS } from './format.js';
import { METRICS, torontoDay } from './measures-local.js';
import { DEFAULT_STATE, filterText, modelLabel, PERIOD_LABELS, periodText } from './state.js';

/** From config/metrics.json; a test checks they agree. */
export const METRIC_LABELS = {
  usage_usd: 'Estimated model usage',
  model_calls: 'Model calls',
  cache_reuse: 'Input cache reuse',
  verification_completed: 'Completed verification jobs',
  verification_duration_median: 'Median verification duration',
  changes_recorded: 'Recorded changes',
  examples_catalog: 'Examples in the catalog',
  usage_share_by_model: 'Share of usage by model',
};

export const REPO = 'https://github.com/pilifs/in-the-loop';
export const shortSha = (sha) => String(sha).slice(0, 7);

/** The filters a metric follows, out of those the state sets: { applied: [...words], ignored: [...names] }. */
function filtersFor(metricId, state, overview) {
  const takes = METRICS[metricId]?.filters ?? [];
  const applied = [];
  const ignored = [];
  if (state.model) (takes.includes('model') ? applied.push(modelLabel(overview, state.model)) : ignored.push('model'));
  if (state.effort) (takes.includes('effort') ? applied.push(`${state.effort} effort`) : ignored.push('effort'));
  return { applied, ignored };
}

const ignoredText = (ignored) =>
  ignored.length ? `the ${ignored.join(' and ')} filter${ignored.length > 1 ? 's don’t' : ' doesn’t'} apply` : '';

/** The line under a summary metric's value: 'All time · US dollars', or with the view's filters. */
export function metricScope(measure, state = DEFAULT_STATE, overview = null) {
  const unit = UNIT_WORDS[measure.unit];
  if (measure.scope === 'snapshot' || !(METRICS[measure.id]?.filters ?? []).length) return `Snapshot total · ${unit}`;
  const period = METRICS[measure.id].filters.includes('period') ? PERIOD_LABELS[state.period] : PERIOD_LABELS.all;
  const { applied, ignored } = overview ? filtersFor(measure.id, state, overview) : { applied: [], ignored: [] };
  return [period, ...applied, unit, ignoredText(ignored)].filter(Boolean).join(' · ');
}

/** The trend chart's caption for a measure in a view. */
export function chartCaption(metricId, state = DEFAULT_STATE, overview = null) {
  const { applied, ignored } = overview ? filtersFor(metricId, state, overview) : { applied: [], ignored: [] };
  const period = state.period !== 'all' && overview ? `, ${periodText(state, overview).replace(/^Last/, 'last')}` : '';
  const only = applied.length ? `, ${applied.join(', ')} only` : '';
  const not = ignored.length ? ` The ${ignored.join(' and ')} filter${ignored.length > 1 ? 's don’t' : ' doesn’t'} apply to this measure.` : '';
  return `${METRIC_LABELS[metricId]} per day${period}${only}, in ${UNIT_WORDS[METRICS[metricId].unit]}. Days are calendar days in Toronto; a day the data doesn't cover shows no column.${not}`;
}

/** The tag before a breakdown's caption: its scope, or the period and filters it follows. */
export function breakdownTag(breakdown, state = DEFAULT_STATE, overview = null) {
  if (breakdown.scope === 'snapshot') return 'Snapshot total';
  const takes = METRICS[breakdown.metricId]?.filters ?? [];
  const period = takes.includes('period') ? PERIOD_LABELS[state.period] : PERIOD_LABELS.all;
  const { applied } = overview ? filtersFor(breakdown.metricId, state, overview) : { applied: [] };
  return [period, ...applied].join(' · ');
}

/** The value unit of a breakdown's rows (a share breakdown lists dollars). */
export const breakdownUnit = (b) => (b.metricId === 'usage_share_by_model' ? 'usd' : METRICS[b.metricId].unit);

/** A breakdown's table rows, with a share bar hidden from assistive tech (the share is in the text). */
export function breakdownRows(rows, unit) {
  if (!rows.length) return `<tr><td colspan="3" class="sf-muted">No data for this view</td></tr>`;
  return rows
    .map((r) => {
      const share = r.share === null || r.share === undefined ? null : r.share;
      const bar = share === null ? '' : `<span class="sf-share" aria-hidden="true"><span style="width:${(share * 100).toFixed(1)}%"></span></span>`;
      return `<tr><th scope="row">${e(r.label)}</th><td>${e(formatValue(r.value, unit))}</td><td>${
        share === null ? '<span class="sf-muted">No data</span>' : e(formatValue(share, 'ratio'))
      }${bar}</td></tr>`;
    })
    .join('');
}

function insightTarget(insight) {
  if (insight.evidence.breakdown) return `#breakdown-${insight.evidence.breakdown}`;
  if (insight.evidence.collection !== 'overview') return `#explore-${insight.evidence.collection}`;
  return `#metric-${insight.metricId}`;
}

/** The observations as list items, each linking its data. */
export function insightItems(insights) {
  return insights
    .slice(0, 3)
    .map(
      (i) =>
        `<li><p>${e(i.text)}</p><p class="sf-coverage">Coverage: ${e(formatCoverage(i.coverage))} · <a href="${e(insightTarget(i))}">See the data</a></p></li>`
    )
    .join('\n          ');
}

/** The last calendar day with data in the snapshot: its own date, never the reader's clock. */
export function dataAsOf(snapshot) {
  const days = snapshot.overview.days;
  return days.length ? days[days.length - 1] : null;
}

/** The quiet freshness line: 'Published data as of …', the source revision and its last check. */
export function freshnessHtml(snapshot, formatDate = formatDay) {
  const { pointer, manifest } = snapshot;
  const asOf = dataAsOf(snapshot);
  const checked = pointer.lastSourceCheck?.at ? torontoDay(pointer.lastSourceCheck.at) : null;
  return (
    (asOf ? `Published data as of <time datetime="${e(asOf)}">${e(formatDate(asOf))}</time>` : 'Published data, with no dated activity') +
    ` · in-the-loop <a href="${REPO}/tree/${e(manifest.source.sha)}"><code>${e(shortSha(manifest.source.sha))}</code></a>` +
    (checked ? ` · source checked <time datetime="${e(checked)}">${e(formatDate(checked))}</time>` : '')
  );
}

/** The two stock tiles' changing text. */
export function stockTexts(stocks) {
  const counts = (obj) =>
    Object.entries(obj)
      .map(([k, n]) => `${n} ${k}`)
      .join(', ');
  const ex = stocks.examples;
  return {
    changes: { value: formatValue(stocks.changes.total, 'changes'), note: `${stocks.changes.housekeeping} of them trace-publication housekeeping, counted apart` },
    examples: {
      value: formatValue(ex.total, 'examples'),
      note: `Origin: ${counts(ex.origin)}. Verdict: ${counts(ex.verdict)}. Vacuous: ${ex.vacuous}. Freshness: ${counts(ex.freshness)}.`,
    },
  };
}

/** The deeper exploration's caption: the source revision and the snapshot. */
export function exploreSourceHtml(manifest) {
  return `Raw ids and records, from in-the-loop at <a href="${REPO}/tree/${e(manifest.source.sha)}"><code>${e(manifest.source.sha)}</code></a>. Snapshot <code>${e(
    manifest.snapshotId
  )}</code>. The filters don't apply here.`;
}

/** The announcement for a newer snapshot: what it adds, by count. */
export function announcement(added, asOf) {
  const WORDS = { changes: 'recorded change', sessions: 'session', verification: 'verification result', examples: 'example' };
  const parts = added.map(({ name, added: n }) => `${n} more ${WORDS[name] ?? name}${n === 1 ? '' : 's'}`);
  const when = asOf ? ` (as of ${formatDay(asOf)})` : '';
  return parts.length ? `New data published${when}: ${parts.join(', ')}.` : `New data published${when}.`;
}
