// The Software Factory pages. Owned by stream B (dashboard):
// llm-dlc/loops/software-factory-dashboard.md. The browser side is
// blog/assets/software-factory/ (app.js, style.css), also stream B's.
//
// Interface, frozen in Phase 0 (docs/software-factory.md):
//
//   renderPages({ snapshot, unavailable, fixture, posts, site, helpers, paths })
//     -> [{ path, title, description, body }]
//     snapshot is { pointer, manifest, overview } or null, with unavailable
//     saying why; fixture is true when the data is a test fixture, which the
//     pages must say plainly. posts is editorial.selectPosts() output. helpers
//     has escapeHtml, formatDate and postImage. paths has route, staticData and
//     remoteData. path is relative to /software-factory/: 'index.html',
//     'analysis/index.html', 'methodology/index.html'. body is the HTML inside
//     <main>; index.mjs wraps it in the site layout with the section's class,
//     styles and scripts. The static HTML carries meaningful numbers and the
//     post links without any script.
//
// The formatting, the chart and the period measures are browser modules in
// blog/assets/software-factory/, imported here too, so the static page and the
// client draw the same thing.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chartSvg, chartTable } from '../assets/software-factory/chart.js';
import { formatCoverage, formatDay, formatValue, UNIT_WORDS } from '../assets/software-factory/format.js';
import { torontoDay, trend } from '../assets/software-factory/measures-local.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const METRIC_CONFIG = JSON.parse(fs.readFileSync(path.join(HERE, 'config', 'metrics.json'), 'utf8'));
const METRIC = Object.fromEntries(METRIC_CONFIG.metrics.map((m) => [m.id, m]));

const TITLE = 'Software Factory';
const DESCRIPTION =
  'What the software factory in in-the-loop produces, how its activity and efficiency change, and what running it teaches.';
const REPO = 'https://github.com/pilifs/in-the-loop';

const FILTER_WORDS = { period: 'date range', model: 'model', effort: 'effort' };
const DIMENSION_WORDS = {
  model: 'by model',
  effort: 'by effort',
  area: 'by area',
  exampleSystem: 'by system',
  exampleTechnique: 'by technique',
  exampleOrigin: 'by origin',
  verdict: 'by verdict',
};
const BREAKDOWN_BASE = {
  usage_usd: 'Estimated usage',
  usage_share_by_model: 'Estimated usage',
  model_calls: 'Model calls',
  changes_recorded: 'Recorded changes',
  examples_catalog: 'Examples',
  verification_completed: 'Verification jobs',
};
const DETAILS = [
  { name: 'changes', label: 'Recent changes', note: 'jj change ids, summaries, sessions and areas' },
  { name: 'sessions', label: 'Sessions', note: 'session ids, models, calls and estimated usage' },
  { name: 'verification', label: 'Verification results', note: 'job ids, process outcome, signals and durations' },
  { name: 'examples', label: 'Examples', note: 'the catalog: origin, verdict, vacuity and freshness' },
];

/** Which filters a metric takes, as a sentence for the panel. */
export function filterScope(metricId) {
  const filters = METRIC[metricId]?.filters ?? [];
  if (!filters.length) return 'A snapshot total: no filter applies.';
  const missing = ['period', 'model', 'effort'].filter((f) => !filters.includes(f));
  if (!missing.length) return 'Follows the date range, model and effort filters.';
  return `Follows the ${filters.map((f) => FILTER_WORDS[f]).join(' and ')} only; the ${missing
    .map((f) => FILTER_WORDS[f])
    .join(' and ')} filter${missing.length > 1 ? 's do' : ' does'} not apply.`;
}

const scopeLabel = (scope) => (scope === 'snapshot' ? 'Snapshot total' : 'All time');
const shortSha = (sha) => String(sha).slice(0, 7);

/** The last calendar day with data in the snapshot: its own date, never the reader's clock. */
export function dataAsOf(snapshot) {
  const days = snapshot.overview.days;
  return days.length ? days[days.length - 1] : null;
}

function banner(fixture, e) {
  return fixture
    ? `<p class="sf-banner" role="note"><strong>Test fixture.</strong> ${e(
        'These numbers come from a small test fixture made from a subset of in-the-loop, not from the published data.'
      )}</p>`
    : '';
}

function intro({ snapshot, fixture, e, formatDate }) {
  let freshness = '';
  if (snapshot) {
    const { pointer, manifest } = snapshot;
    const asOf = dataAsOf(snapshot);
    const checked = pointer.lastSourceCheck?.at ? torontoDay(pointer.lastSourceCheck.at) : null;
    freshness =
      `<p class="sf-freshness">` +
      (asOf ? `Published data as of <time datetime="${asOf}">${e(formatDate(asOf))}</time>` : 'Published data, with no dated activity') +
      ` · in-the-loop <a href="${REPO}/tree/${e(manifest.source.sha)}"><code>${e(shortSha(manifest.source.sha))}</code></a>` +
      (checked ? ` · source checked <time datetime="${checked}">${e(formatDate(checked))}</time>` : '') +
      `</p>`;
  }
  return `      <header class="sf-intro">
        <h1>${TITLE}</h1>
        <p class="sf-lede">${e(
          'What the software factory in in-the-loop produces, how its activity and efficiency change, and what running it teaches. Agents build and verify software there; these are the numbers they leave behind.'
        )}</p>
        ${banner(fixture, e)}
        <div class="sf-controls">
          <p class="sf-range-static" data-sf-static>Showing all time, all models and efforts.</p>
          <form class="sf-filters" data-sf-filters hidden aria-label="Filters"></form>
          ${freshness}
        </div>
      </header>`;
}

function metricCard(measure, e) {
  const m = METRIC[measure.id];
  return `          <article class="sf-metric" id="metric-${e(measure.id)}" data-metric="${e(measure.id)}">
            <h3 class="sf-metric-label">${e(m.label)}</h3>
            <p class="sf-metric-value" data-value>${e(formatValue(measure.value, measure.unit))}</p>
            <p class="sf-metric-scope" data-scope>${e(scopeLabel(measure.scope))} · ${e(UNIT_WORDS[measure.unit])}</p>
            <p class="sf-coverage" data-coverage>Coverage: ${e(formatCoverage(measure.coverage))}</p>
            <details class="sf-definition">
              <summary>Definition</summary>
              <p>${e(m.definition)}</p>
              <p>Coverage counts: ${e(m.coverage)}</p>
              <p>${e(m.notes)}</p>
              <p class="sf-filter-scope">${e(filterScope(measure.id))}</p>
            </details>
          </article>`;
}

function summary(snapshot, e) {
  const cards = METRIC_CONFIG.summary
    .map((id) => snapshot.overview.measures.find((m) => m.id === id))
    .filter(Boolean)
    .map((m) => metricCard(m, e))
    .join('\n');
  return `      <section class="sf-summary" aria-labelledby="sf-summary-title">
        <h2 id="sf-summary-title" class="sf-visually-hidden">Summary</h2>
        <div class="sf-metrics">
${cards}
        </div>
      </section>`;
}

function trendSection(snapshot, e) {
  const id = METRIC_CONFIG.chart[0];
  const m = METRIC[id];
  const points = trend(snapshot.overview, snapshot.manifest, id);
  const options = METRIC_CONFIG.chart
    .map(
      (c) =>
        `<label><input type="radio" name="measure" value="${e(c)}"${c === id ? ' checked' : ''}> ${e(METRIC[c].label)}</label>`
    )
    .join('');
  return `      <section class="sf-panel sf-trend" id="trend" aria-labelledby="sf-trend-heading">
        <div class="sf-panel-head">
          <h2 id="sf-trend-heading">Trend</h2>
          <fieldset class="sf-measure" data-sf-measure hidden><legend class="sf-visually-hidden">Measure</legend>${options}</fieldset>
        </div>
        <p class="sf-caption" data-sf-caption>${e(m.label)} per day, in ${e(UNIT_WORDS[m.unit])}. Days are calendar days in Toronto; a day the data doesn't cover shows no column.</p>
        <div class="sf-chart-wrap" data-sf-chart>${chartSvg(points, { label: m.label, unit: m.unit })}</div>
        <details class="sf-data-table">
          <summary>Data table</summary>
          <div data-sf-table>${chartTable(points, { label: m.label, unit: m.unit })}</div>
        </details>
      </section>`;
}

function insightTarget(insight) {
  if (insight.evidence.breakdown) return `#breakdown-${insight.evidence.breakdown}`;
  if (insight.evidence.collection !== 'overview') return `#explore-${insight.evidence.collection}`;
  return `#metric-${insight.metricId}`;
}

function observations(snapshot, e) {
  const items = snapshot.overview.insights
    .slice(0, 3)
    .map(
      (i) =>
        `<li><p>${e(i.text)}</p><p class="sf-coverage">Coverage: ${e(formatCoverage(i.coverage))} · <a href="${e(
          insightTarget(i)
        )}">See the data</a></p></li>`
    )
    .join('\n          ');
  return `      <section class="sf-panel sf-observations" aria-labelledby="sf-observations-title">
        <h2 id="sf-observations-title">Observations</h2>
        <p class="sf-caption">Calculated from the data. They describe; they don't explain or rank.</p>
        <ul class="sf-insights">
          ${items}
        </ul>
      </section>`;
}

/** A post as the section lists it: title, description, byline, date and a small cover. */
export function postCard(post, { e, formatDate, featured = false }) {
  const cover = post.cover
    ? `<img class="sf-cover" src="${e(post.cover.url)}" width="${post.cover.width}" height="${post.cover.height}" alt="" loading="lazy">`
    : '';
  const byline = post.author ? `<span class="sf-byline">By ${e(post.author)}</span> · ` : '';
  return `<article class="sf-post${featured ? ' sf-post-featured' : ''}">${cover}<div>
              <h3><a href="${e(post.url)}">${e(post.title)}</a></h3>
              <p class="sf-post-meta">${byline}<time datetime="${e(post.date)}">${e(formatDate(post.date))}</time></p>
              <p>${e(post.description)}</p>
            </div></article>`;
}

function analysis(posts, { e, formatDate, route }) {
  const featured = posts?.featured ?? null;
  const rest = (posts?.items ?? []).filter((p) => p !== featured && p.slug !== featured?.slug).slice(0, 4);
  const body =
    featured || rest.length
      ? `${featured ? postCard(featured, { e, formatDate, featured: true }) : ''}${
          rest.length ? `<div class="sf-post-list">${rest.map((p) => postCard(p, { e, formatDate })).join('')}</div>` : ''
        }
          <p><a href="${e(route)}analysis/">All analysis</a></p>`
      : `<p class="sf-empty">No analysis published yet. Filip's notes on what the numbers mean will appear here, beside the data they use.</p>`;
  return `      <section class="sf-panel sf-analysis" id="analysis" aria-labelledby="sf-analysis-title">
        <h2 id="sf-analysis-title">Analysis &amp; notes by Filip</h2>
        ${body}
      </section>`;
}

function breakdownTable(b, e) {
  const valueUnit = b.metricId === 'usage_share_by_model' ? 'usd' : METRIC[b.metricId].unit;
  const title = `${BREAKDOWN_BASE[b.metricId] ?? METRIC[b.metricId].label} ${DIMENSION_WORDS[b.dimension] ?? ''}`.trim();
  const rows = b.rows
    .map((r) => {
      const share = r.share === null || r.share === undefined ? null : r.share;
      const bar = share === null ? '' : `<span class="sf-share" aria-hidden="true"><span style="width:${(share * 100).toFixed(1)}%"></span></span>`;
      return `<tr><th scope="row">${e(r.label)}</th><td>${e(formatValue(r.value, valueUnit))}</td><td>${
        share === null ? '<span class="sf-muted">No data</span>' : e(formatValue(share, 'ratio'))
      }${bar}</td></tr>`;
    })
    .join('');
  const note = b.dimension === 'area' ? ' Changes no area rule places are Unassigned.' : '';
  return `          <section class="sf-breakdown" id="breakdown-${e(b.id)}" aria-labelledby="breakdown-${e(b.id)}-title">
            <h3 id="breakdown-${e(b.id)}-title">${e(title)}</h3>
            <p class="sf-caption"><span class="sf-tag">${e(scopeLabel(b.scope))}</span> ${e(filterScope(b.metricId))}${e(note)}</p>
            <table class="sf-table"><thead><tr><th scope="col">${e(DIMENSION_WORDS[b.dimension]?.replace(/^by /, '') ?? b.dimension)}</th><th scope="col">${e(
              UNIT_WORDS[valueUnit][0].toUpperCase() + UNIT_WORDS[valueUnit].slice(1)
            )}</th><th scope="col">Share</th></tr></thead><tbody>${rows}</tbody></table>
            <p class="sf-coverage">Coverage: ${e(formatCoverage(b.coverage))}</p>
          </section>`;
}

const counts = (obj) =>
  Object.entries(obj)
    .map(([k, n]) => `${n} ${k}`)
    .join(', ');

function output(snapshot, e) {
  const { stocks, breakdowns } = snapshot.overview;
  const sha = snapshot.manifest.source.sha;
  const ex = stocks.examples;
  return `      <section class="sf-panel sf-output" id="output" aria-labelledby="sf-output-title">
        <h2 id="sf-output-title">Output and breakdowns</h2>
        <div class="sf-stocks">
          <article class="sf-stock" id="metric-changes_recorded">
            <h3>${e(METRIC.changes_recorded.label)}</h3>
            <p class="sf-metric-value">${e(formatValue(stocks.changes.total, 'changes'))}</p>
            <p class="sf-metric-scope"><span class="sf-tag">Snapshot total</span> at <code>${e(shortSha(sha))}</code>, not activity over a period</p>
            <p class="sf-coverage">${e(`${stocks.changes.housekeeping} of them trace-publication housekeeping, counted apart`)}</p>
          </article>
          <article class="sf-stock" id="metric-examples_catalog">
            <h3>${e(METRIC.examples_catalog.label)}</h3>
            <p class="sf-metric-value">${e(formatValue(ex.total, 'examples'))}</p>
            <p class="sf-metric-scope"><span class="sf-tag">Snapshot total</span> at <code>${e(shortSha(sha))}</code>, not examples per period</p>
            <p class="sf-coverage">${e(`Origin: ${counts(ex.origin)}. Verdict: ${counts(ex.verdict)}. Vacuous: ${ex.vacuous}. Freshness: ${counts(ex.freshness)}.`)}</p>
          </article>
        </div>
        <div class="sf-breakdowns">
${breakdowns.map((b) => breakdownTable(b, e)).join('\n')}
        </div>
      </section>`;
}

function explore(snapshot, { e, paths }) {
  const { pointer, manifest } = snapshot;
  const base = `${paths.staticData}${pointer.manifest.replace(/manifest\.json$/, '')}`;
  const items = DETAILS.map((d) => {
    const c = manifest.collections.find((x) => x.name === d.name);
    if (!c) return '';
    return `          <details class="sf-detail" id="explore-${d.name}" data-sf-detail="${d.name}" data-path="${e(c.path)}">
            <summary>${e(d.label)} <span class="sf-muted">(${e(c.records.toLocaleString('en-US'))})</span></summary>
            <div data-sf-detail-body><p class="sf-caption">${e(d.note)}. Loaded when opened; also as <a href="${e(base + c.path)}">JSON</a>.</p></div>
          </details>`;
  }).join('\n');
  return `      <section class="sf-panel sf-explore" id="explore" aria-labelledby="sf-explore-title">
        <h2 id="sf-explore-title">Deeper exploration</h2>
        <p class="sf-caption">Raw ids and records, from in-the-loop at <a href="${REPO}/tree/${e(manifest.source.sha)}"><code>${e(
          manifest.source.sha
        )}</code></a>. Snapshot <code>${e(manifest.snapshotId)}</code>.</p>
${items}
      </section>`;
}

function unavailableNotice(unavailable, e) {
  return `      <section class="sf-panel sf-unavailable" role="status" aria-labelledby="sf-unavailable-title">
        <h2 id="sf-unavailable-title">Data unavailable</h2>
        <p>${e(unavailable || 'No Software Factory data is available.')}</p>
        <p>No numbers are shown rather than numbers that aren't measured. The analysis below doesn't depend on this data.</p>
      </section>`;
}

function overviewPage({ snapshot, unavailable, fixture, posts, helpers, paths }) {
  const e = helpers.escapeHtml;
  const formatDate = helpers.formatDate ?? formatDay;
  const attrs = snapshot
    ? ` data-snapshot="${e(snapshot.manifest.snapshotId)}" data-static-data="${e(paths.staticData)}" data-remote-data="${e(paths.remoteData)}"`
    : ` data-static-data="${e(paths.staticData)}" data-remote-data="${e(paths.remoteData)}"`;
  const parts = snapshot
    ? [summary(snapshot, e), trendSection(snapshot, e), observations(snapshot, e), analysis(posts, { e, formatDate, route: paths.route }), output(snapshot, e), explore(snapshot, { e, paths })]
    : [unavailableNotice(unavailable, e), analysis(posts, { e, formatDate, route: paths.route })];
  const footer = `      <p class="sf-foot"><a href="${e(paths.route)}methodology/">Methodology</a>: how each number is defined and measured, its coverage, and its limits.</p>`;
  return {
    path: 'index.html',
    title: TITLE,
    description: DESCRIPTION,
    body: `    <div class="sf-shell" data-sf-page="overview"${attrs}>
${intro({ snapshot, fixture, e, formatDate })}
${parts.join('\n')}
${footer}
    </div>`,
  };
}

export function renderPages(input) {
  return [overviewPage(input)];
}
