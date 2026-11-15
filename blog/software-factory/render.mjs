// The Software Factory pages. Owned by stream B (dashboard):
// llm-dlc/loops/software-factory-dashboard.md. The browser side is
// blog/assets/software-factory/ (app.js, style.css), also stream B's.
//
// Interface, frozen in Phase 0 (docs/software-factory.md):
//
//   renderPages({ snapshot, unavailable, fixture, preview, posts, site, helpers, paths })
//     -> [{ path, title, description, body }]
//     snapshot is { pointer, manifest, overview } or null, with unavailable
//     saying why; fixture is true when the data is a test fixture, which the
//     pages must say plainly. preview (optional) is true for a drafts build:
//     the running-loops panel then shows its shape with example rows, labelled
//     as an example. posts is editorial.selectPosts() output. helpers
//     has escapeHtml, formatDate and postImage. paths has route, staticData and
//     remoteData. path is relative to /software-factory/: 'index.html',
//     'analysis/index.html', 'methodology/index.html', and with a snapshot
//     'loops/', 'examples/', 'tools/', 'code/' and 'usage/index.html'. body is the HTML
//     inside <main>; index.mjs wraps it in the site layout with the section's
//     class, styles and scripts. A page that shows the snapshot's numbers has
//     app: true (optional, added with the second layout): index.mjs gives it
//     the client script. The static HTML carries meaningful numbers and the
//     post links without any script.
//
// The overview is short on purpose: the headline, four findings with one figure
// each, and where to go next. Everything under a finding is on its own page.
//
// The formatting, the chart and the period measures are browser modules in
// blog/assets/software-factory/, imported here too, so the static page and the
// client draw the same thing.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chartSvg, chartTable } from '../assets/software-factory/chart.js';
import { codeHtml, examplesHtml, findingsHtml, heroHtml, loopsHtml, runningHtml, toolsHtml } from '../assets/software-factory/factory.js';
import { formatCoverage, formatDay, formatValue, UNIT_WORDS } from '../assets/software-factory/format.js';
import { datasetDays, METRICS, torontoDay, trend } from '../assets/software-factory/measures-local.js';
import { series } from './measures.mjs';
import {
  breakdownRows,
  breakdownTag,
  breakdownUnit,
  chartCaption,
  dataAsOf,
  exploreSourceHtml,
  freshnessHtml,
  insightItems,
  metricScope,
  REPO,
  shortSha,
  stockTexts,
} from '../assets/software-factory/view.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const METRIC_CONFIG = JSON.parse(fs.readFileSync(path.join(HERE, 'config', 'metrics.json'), 'utf8'));
const METRIC = Object.fromEntries(METRIC_CONFIG.metrics.map((m) => [m.id, m]));
const AREAS = JSON.parse(fs.readFileSync(path.join(HERE, 'config', 'areas.json'), 'utf8'));
const LOOPS = JSON.parse(fs.readFileSync(path.join(HERE, 'config', 'loops.json'), 'utf8'));
const CODE = JSON.parse(fs.readFileSync(path.join(HERE, 'config', 'code.json'), 'utf8'));
const REQUESTS = JSON.parse(fs.readFileSync(path.join(HERE, 'config', 'requests.json'), 'utf8'));
// Example rows for the running-loops panel: a preview build only, and labelled there.
const RUNNING_PREVIEW = JSON.parse(fs.readFileSync(path.join(HERE, 'preview', 'running-loops.json'), 'utf8'));

// The section's name and one-line description, shared with the site's entry
// (site.mjs).
export const TITLE = 'Software Factory';
export const DESCRIPTION =
  'What the software factory in in-the-loop produces, how its activity and efficiency change, and what running it teaches.';

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
  { name: 'loops', label: 'Loop runs', note: 'each run of a feature loop: its cycles, commits, tool calls and how it ended' },
  { name: 'changes', label: 'Recent changes', note: 'jj change ids, summaries, areas, and each change\'s commit, lines of code and tokens where known' },
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

export { dataAsOf };

function banner(fixture, e) {
  return fixture
    ? `<p class="sf-banner" role="note"><strong>Test fixture.</strong> ${e(
        'These numbers come from a small test fixture made from a subset of in-the-loop, not from the published data.'
      )}</p>`
    : '';
}

const LEDE =
  'What the software factory in in-the-loop produces, how its activity and efficiency change, and what running it teaches. Agents build and verify software there; these are the numbers they leave behind.';

// The section's pages, as its navigation lists them. The five in the middle
// show a snapshot's numbers and exist only when there is one.
const NAV = [
  ['', 'Overview'],
  ['loops/', 'Feature loops', true],
  ['examples/', 'Examples', true],
  ['tools/', 'Model performance', true],
  ['code/', 'Code', true],
  ['usage/', 'Usage', true],
  ['analysis/', 'Analysis'],
  ['methodology/', 'Methodology'],
];

/** The section's navigation, at the top of each of its pages. */
function sectionNav(paths, e, here, hasData) {
  return `      <nav class="sf-nav" aria-label="${TITLE}">${NAV.filter(([, , data]) => hasData || !data)
    .map(([sub, label]) => `<a href="${e(paths.route)}${sub}"${sub === here ? ' aria-current="page"' : ''}>${label}</a>`)
    .join('')}</nav>`;
}

/** What a page of numbers says about them before showing any: a fixture, how fresh, and newer data waiting. */
function dataNotes({ snapshot, fixture, e, formatDate }) {
  return `${banner(fixture, e)}
        <p class="sf-freshness" data-sf-freshness>${freshnessHtml(snapshot, formatDate)}</p>
        <div class="sf-notice" data-sf-notice></div>`;
}

function intro({ snapshot, fixture, e, formatDate }) {
  const hero = snapshot
    ? heroHtml(snapshot, { title: TITLE, lede: LEDE })
    : `<div class="sf-hero sf-hero-plain"><div class="sf-hero-text"><h1>${TITLE}</h1><p class="sf-lede">${e(LEDE)}</p></div></div>`;
  return `      <header class="sf-intro">
        <div data-sf-section="hero" data-title="${e(TITLE)}" data-lede="${e(LEDE)}">
      ${hero}
        </div>
        ${snapshot ? dataNotes({ snapshot, fixture, e, formatDate }) : banner(fixture, e)}
      </header>`;
}

/** One of the leading sections: its content is redrawn whole when a newer snapshot is shown. */
function feature(name, id, html, after = '') {
  return `      <section class="sf-panel sf-feature sf-${name}" id="${id}" aria-labelledby="sf-${name}-title">
        <div data-sf-section="${name}">
        ${html}
        </div>${after ? `\n        ${after}` : ''}
      </section>`;
}

/** The head of the usage page, with the filters that apply to what is under it. */
function usageHead() {
  return `      <header class="sf-usage-head" id="usage">
        <p class="sf-eyebrow">Usage and verification</p>
        <h1 id="sf-usage-title">What the factory used</h1>
        <p class="sf-lede">Model usage, verification jobs, recorded changes and the example catalog, with every record under them.</p>
        <div class="sf-controls">
          <p class="sf-range-static" data-sf-static>Showing all time, all models and efforts.</p>
          <form class="sf-filters" data-sf-filters hidden aria-label="Filters"></form>
        </div>
      </header>`;
}

function metricCard(measure, e, route) {
  const m = METRIC[measure.id];
  return `          <article class="sf-metric" id="metric-${e(measure.id)}" data-metric="${e(measure.id)}">
            <h3 class="sf-metric-label">${e(m.label)}</h3>
            <p class="sf-metric-value" data-value>${e(formatValue(measure.value, measure.unit))}</p>
            <p class="sf-metric-scope" data-scope>${e(metricScope(measure))}</p>
            <p class="sf-coverage" data-coverage>Coverage: ${e(formatCoverage(measure.coverage))}</p>
            <details class="sf-definition">
              <summary>Definition</summary>
              <p>${e(m.definition)}</p>
              <p>Coverage counts: ${e(m.coverage)}</p>
              <p>${e(m.notes)}</p>
              <p class="sf-filter-scope">${e(filterScope(measure.id))}</p>
              <p><a href="${e(route)}methodology/#def-${e(measure.id)}">Methodology</a></p>
            </details>
          </article>`;
}

function summary(snapshot, e, route) {
  const cards = METRIC_CONFIG.summary
    .map((id) => snapshot.overview.measures.find((m) => m.id === id))
    .filter(Boolean)
    .map((m) => metricCard(m, e, route))
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
  const points = trend(series(snapshot.overview, id), snapshot.manifest, id);
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
        <p class="sf-caption" data-sf-caption>${e(chartCaption(id))}</p>
        <div class="sf-chart-wrap" data-sf-chart>${chartSvg(points, { label: m.label, unit: m.unit })}</div>
        <details class="sf-data-table">
          <summary>Data table</summary>
          <div data-sf-table>${chartTable(points, { label: m.label, unit: m.unit })}</div>
        </details>
      </section>`;
}

function observations(snapshot) {
  const items = insightItems(snapshot.overview.insights);
  return `      <section class="sf-panel sf-observations" aria-labelledby="sf-observations-title">
        <h2 id="sf-observations-title">Observations</h2>
        <p class="sf-caption">Calculated from all the data in the snapshot; the filters don't change them. They describe; they don't explain or rank.</p>
        <ul class="sf-insights" data-sf-insights>
          ${items}
        </ul>
      </section>`;
}

/** A post as the section lists it: title, description, byline, date and a small cover. */
export function postCard(post, { e, formatDate, featured = false, level = 3 }) {
  const cover = post.cover
    ? `<img class="sf-cover" src="${e(post.cover.url)}" width="${post.cover.width}" height="${post.cover.height}" alt="" loading="lazy">`
    : '';
  const byline = post.author ? `<span class="sf-byline">By ${e(post.author)}</span> · ` : '';
  // Said in words, not only by the larger card.
  const mark = featured ? '<strong class="sf-featured">Featured</strong> · ' : '';
  return `<article class="sf-post${featured ? ' sf-post-featured' : ''}">${cover}<div>
              <h${level}><a href="${e(post.url)}">${e(post.title)}</a></h${level}>
              <p class="sf-post-meta">${mark}${byline}<time datetime="${e(post.date)}">${e(formatDate(post.date))}</time></p>
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
  const valueUnit = breakdownUnit(b);
  const title = `${BREAKDOWN_BASE[b.metricId] ?? METRIC[b.metricId].label} ${DIMENSION_WORDS[b.dimension] ?? ''}`.trim();
  const rows = breakdownRows(b.rows, valueUnit);
  const note = b.dimension === 'area' ? ' Changes no area rule places are Unassigned.' : '';
  return `          <section class="sf-breakdown" id="breakdown-${e(b.id)}" data-breakdown="${e(b.id)}" aria-labelledby="breakdown-${e(b.id)}-title">
            <h3 id="breakdown-${e(b.id)}-title">${e(title)}</h3>
            <p class="sf-caption"><span class="sf-tag" data-tag>${e(breakdownTag(b))}</span> ${e(filterScope(b.metricId))}${e(note)}</p>
            <table class="sf-table"><thead><tr><th scope="col">${e(DIMENSION_WORDS[b.dimension]?.replace(/^by /, '') ?? b.dimension)}</th><th scope="col">${e(
              UNIT_WORDS[valueUnit][0].toUpperCase() + UNIT_WORDS[valueUnit].slice(1)
            )}</th><th scope="col">Share</th></tr></thead><tbody data-rows>${rows}</tbody></table>
            <p class="sf-coverage" data-coverage>Coverage: ${e(formatCoverage(b.coverage))}</p>
          </section>`;
}

function output(snapshot, e) {
  const { stocks, breakdowns } = snapshot.overview;
  const sha = snapshot.manifest.source.sha;
  const text = stockTexts(stocks);
  const at = `<span class="sf-tag">Snapshot total</span> at <code>${e(shortSha(sha))}</code>`;
  return `      <section class="sf-panel sf-output" id="output" aria-labelledby="sf-output-title">
        <h2 id="sf-output-title">Output and breakdowns</h2>
        <div class="sf-stocks">
          <article class="sf-stock" id="metric-changes_recorded" data-stock="changes">
            <h3>${e(METRIC.changes_recorded.label)}</h3>
            <p class="sf-metric-value" data-value>${e(text.changes.value)}</p>
            <p class="sf-metric-scope">${at}, not activity over a period; no filter applies</p>
            <p class="sf-coverage" data-coverage>${e(text.changes.note)}</p>
          </article>
          <article class="sf-stock" id="metric-examples_catalog" data-stock="examples">
            <h3>${e(METRIC.examples_catalog.label)}</h3>
            <p class="sf-metric-value" data-value>${e(text.examples.value)}</p>
            <p class="sf-metric-scope">${at}, not examples per period; no filter applies</p>
            <p class="sf-coverage" data-coverage>${e(text.examples.note)}</p>
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
            <summary>${e(d.label)} <span class="sf-muted">(<span data-count>${e(c.records.toLocaleString('en-US'))}</span>)</span></summary>
            <p class="sf-caption">${e(d.note)}. Loaded when opened; also as <a data-json href="${e(base + c.path)}">JSON</a>.</p>
            <div data-sf-detail-body></div>
          </details>`;
  }).join('\n');
  return `      <section class="sf-panel sf-explore" id="explore" aria-labelledby="sf-explore-title">
        <h2 id="sf-explore-title">Deeper exploration</h2>
        <p class="sf-caption" data-sf-source>${exploreSourceHtml(manifest)}</p>
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

/** Where the overview sends a reader next: the author's analysis, how it is measured. */
function more(snapshot, posts, { e, route }) {
  const hasPosts = Boolean(posts?.featured || posts?.items?.length);
  // What the work took is the last finding above, with its own link to the usage page.
  const cards = [
    // With posts the analysis has its own panel above; without, a small honest note here.
    hasPosts
      ? ''
      : `<article class="sf-more-card" id="analysis">
          <h2 id="sf-analysis-title">Analysis &amp; notes by Filip</h2>
          <p class="sf-empty">No analysis published yet. Filip's notes on what the numbers mean will appear here, beside the data they use.</p>
        </article>`,
    `<article class="sf-more-card">
          <h2><a href="${e(route)}methodology/">How it is measured</a></h2>
          <p>Every number has a definition, a coverage count and the source revision it was counted at. What can’t be measured yet is listed, never estimated.</p>
          <p class="sf-finding-more"><a href="${e(route)}methodology/">Definitions, coverage and limits</a></p>
        </article>`,
  ].filter(Boolean);
  return `      <section class="sf-more" aria-label="More">
        ${cards.join('\n        ')}
      </section>`;
}

const shellAttrs = (snapshot, paths, e) =>
  `${
    snapshot
      ? ` data-snapshot="${e(snapshot.manifest.snapshotId)}" data-generator="${e(snapshot.manifest.generator.name)}" data-generator-version="${e(snapshot.manifest.generator.version)}"`
      : ''
  } data-static-data="${e(paths.staticData)}" data-remote-data="${e(paths.remoteData)}"`;

function overviewPage({ snapshot, examples = null, unavailable, fixture, posts, helpers, paths }) {
  const e = helpers.escapeHtml;
  const formatDate = helpers.formatDate ?? formatDay;
  const hasPosts = Boolean(posts?.featured || posts?.items?.length);
  const parts = snapshot
    ? [
        `      <div class="sf-findings" data-sf-section="findings">
        ${findingsHtml(snapshot, { examples })}
      </div>`,
        hasPosts ? analysis(posts, { e, formatDate, route: paths.route }) : '',
        more(snapshot, posts, { e, route: paths.route }),
      ].filter(Boolean)
    : [unavailableNotice(unavailable, e), analysis(posts, { e, formatDate, route: paths.route })];
  return {
    path: 'index.html',
    title: TITLE,
    description: DESCRIPTION,
    app: Boolean(snapshot),
    body: `    <div class="sf-shell" data-sf-page="overview"${shellAttrs(snapshot, paths, e)}>
${sectionNav(paths, e, '', Boolean(snapshot))}
${intro({ snapshot, fixture, e, formatDate })}
${parts.join('\n')}
    </div>`,
  };
}

/** A page of the snapshot's numbers under the overview: the navigation, what the data is, then its parts. */
function dataPage(name, { title, description, parts }, { snapshot, fixture, helpers, paths }) {
  const e = helpers.escapeHtml;
  const formatDate = helpers.formatDate ?? formatDay;
  return {
    path: `${name}/index.html`,
    title: `${title} · ${TITLE}`,
    description,
    app: true,
    body: `    <div class="sf-shell" data-sf-page="${name}"${shellAttrs(snapshot, paths, e)}>
${sectionNav(paths, e, `${name}/`, true)}
      <div class="sf-page-notes">
        ${dataNotes({ snapshot, fixture, e, formatDate })}
      </div>
${parts.join('\n')}
    </div>`,
  };
}

/** loops/, examples/, tools/, code/ and usage/: everything under the overview's findings. */
function dataPages(input) {
  const { snapshot, preview = false, helpers, paths } = input;
  const e = helpers.escapeHtml;
  return [
    dataPage(
      'loops',
      {
        title: 'Feature loops',
        description: 'Every campaign and run of the feature loops in in-the-loop: who set off the work, how the loop changed, and each cycle’s commit.',
        parts: [feature('loops', 'loops', loopsHtml(snapshot), runningHtml(preview ? RUNNING_PREVIEW : null))],
      },
      input
    ),
    dataPage(
      'examples',
      {
        title: 'Example catalog',
        description: 'Every example in the in-the-loop catalog: code changes run through its formal verifier, by verdict, kind of change, system and kind of defect.',
        parts: [feature('examples', 'examples', examplesHtml(snapshot, input.examples ?? null))],
      },
      input
    ),
    dataPage(
      'tools',
      {
        title: 'Model performance',
        description: 'How often the agents’ tool calls succeeded in in-the-loop, when they failed, what followed a failure, and what failures go with.',
        parts: [feature('tools', 'tools', toolsHtml(snapshot))],
      },
      input
    ),
    dataPage(
      'code',
      {
        title: 'Code',
        description: 'The code the software factory committed to in-the-loop, counted from git: how much still stands, and what a line took.',
        parts: [feature('code', 'code', codeHtml(snapshot))],
      },
      input
    ),
    dataPage(
      'usage',
      {
        title: 'Usage',
        description: 'Estimated model usage, verification jobs, recorded changes and the example catalog of in-the-loop, with the records under each.',
        parts: [usageHead(), summary(snapshot, e, paths.route), trendSection(snapshot, e), observations(snapshot), output(snapshot, e), explore(snapshot, { e, paths })],
      },
      input
    ),
  ];
}

function pageHead({ title, lede, fixture, e }) {
  return `      <header class="sf-intro sf-page-intro">
        <h1>${title}</h1>
        <p class="sf-lede">${e(lede)}</p>
        ${banner(fixture, e)}
      </header>`;
}

/** analysis/index.html: the author's Software Factory posts, newest first, and related background apart. */
function analysisPage({ snapshot, posts, helpers, paths }) {
  const e = helpers.escapeHtml;
  const formatDate = helpers.formatDate ?? formatDay;
  const featured = posts?.featured ?? null;
  const items = posts?.items ?? [];
  const related = posts?.related ?? [];
  const list = items.length
    ? `<div class="sf-post-list sf-post-archive">${items
        .map((p) => postCard(p, { e, formatDate, featured: p === featured || p.slug === featured?.slug, level: 2 }))
        .join('\n          ')}</div>`
    : `<p class="sf-empty">No analysis published yet. Filip's notes on what the numbers mean will appear here, each linking the data it uses. The <a href="${e(
        paths.route
      )}">overview</a> has the latest published data.</p>`;
  const background = related.length
    ? `
      <section class="sf-panel sf-related" aria-labelledby="sf-related-title">
        <h2 id="sf-related-title">Related background</h2>
        <p class="sf-caption">Other posts about the software factory, linked for background. They are not Filip's analysis.</p>
        <div class="sf-post-list">${related.map((p) => postCard(p, { e, formatDate })).join('')}</div>
      </section>`
    : '';
  return {
    path: 'analysis/index.html',
    title: `Analysis & notes by Filip · ${TITLE}`,
    description: "Filip Stankovic's analysis of the software factory in in-the-loop: what its numbers mean and what running it teaches.",
    body: `    <div class="sf-shell" data-sf-page="analysis">
${sectionNav(paths, e, 'analysis/', Boolean(snapshot))}
${pageHead({ title: 'Analysis &amp; notes by Filip', lede: 'What the Software Factory numbers mean and what running the factory teaches, written by Filip. Each post links the data it uses.', fixture: false, e })}
      <section class="sf-panel sf-analysis" id="analysis" aria-label="Posts">
          ${list}
      </section>${background}
    </div>`,
  };
}

const DATASET_LABELS = {
  usage: 'Model usage',
  verification: 'Verification results',
  changes: 'Recorded changes',
  catalog: 'Example catalog',
  loops: 'Feature loop runs',
  tools: 'Tool calls',
  code: 'Code in git',
};
const FIGURES = METRIC_CONFIG.figures ?? [];
const OUTCOME_WORDS = { 'new-snapshot': 'found new data', unchanged: 'found nothing new', failed: 'failed' };

function provenance(snapshot, { e, formatDate }) {
  const { pointer, manifest } = snapshot;
  const asOf = dataAsOf(snapshot);
  const day = (instant) => {
    const d = torontoDay(instant);
    return `<time datetime="${e(instant)}">${e(formatDate(d))}</time>`;
  };
  const check = pointer.lastSourceCheck;
  const rows = [
    ['Source', `<a href="${REPO}/tree/${e(manifest.source.sha)}">${e(manifest.source.repository)}</a> at <code>${e(manifest.source.sha)}</code>`],
    ['Snapshot', `<code>${e(manifest.snapshotId)}</code>, ${e(manifest.source.inputs.length.toLocaleString('en-US'))} source files, each recorded with its SHA-256`],
    ['Data as of', asOf ? `<time datetime="${e(asOf)}">${e(formatDate(asOf))}</time>, the last day with activity in the data` : 'No dated activity'],
    ['Published', day(pointer.publishedAt)],
    [
      'Source last checked',
      `${day(check.at)}: ${e(OUTCOME_WORDS[check.outcome] ?? check.outcome)}${check.error ? ` (${e(check.error)})` : ''}. A check that finds nothing new doesn't make the data newer.`,
    ],
    ['Generator', `<code>${e(manifest.generator.name)}</code>, version ${e(manifest.generator.version)}`],
    ['Metric definitions', `Version ${e(manifest.metricDefinitions.version)}, SHA-256 <code>${e(manifest.metricDefinitions.sha256.slice(0, 12))}</code>`],
    ['Prices', `List prices as of <time datetime="${e(manifest.pricingAsOf)}">${e(formatDate(manifest.pricingAsOf))}</time>`],
    ['Timezone', `${e(manifest.timezone)}: ${e(METRIC_CONFIG.periods.interval)}`],
  ];
  return `      <section class="sf-panel sf-provenance" id="provenance" aria-labelledby="sf-provenance-title">
        <h2 id="sf-provenance-title">Source and freshness</h2>
        <dl class="sf-facts">
${rows.map(([k, v]) => `          <div><dt>${k}</dt><dd>${v}</dd></div>`).join('\n')}
        </dl>
      </section>`;
}

function datasetCoverage(snapshot, { e, formatDate }) {
  const { manifest } = snapshot;
  const sha = shortSha(manifest.source.sha);
  const rows = manifest.datasets
    .map((d) => {
      const days = datasetDays(manifest, d.id);
      const window =
        d.kind === 'stock'
          ? `Snapshot total at <code>${e(sha)}</code>`
          : days
            ? `<time datetime="${e(days.first)}">${e(formatDate(days.first))}</time> to <time datetime="${e(days.last)}">${e(formatDate(days.last))}</time>`
            : '<span class="sf-muted">No data</span>';
      const used = [...METRIC_CONFIG.metrics.filter((m) => METRICS[m.id]?.dataset === d.id), ...FIGURES.filter((f) => f.section === d.id)].map((m) => e(m.label));
      return `<tr><th scope="row">${e(DATASET_LABELS[d.id] ?? d.id)}</th><td data-label="Kind">${d.kind === 'stock' ? 'Snapshot total' : 'Period'}</td><td data-label="Measured">${window}</td><td data-label="Coverage">${e(
        formatCoverage(d.coverage)
      )}</td><td data-label="Metrics">${used.join(', ')}</td></tr>`;
    })
    .join('\n            ');
  return `      <section class="sf-panel sf-coverage-panel" id="coverage" aria-labelledby="sf-coverage-title">
        <h2 id="sf-coverage-title">Coverage by dataset</h2>
        <p class="sf-caption">What each dataset measured. Days outside a period dataset's window are unknown, not zero, and show no value.</p>
        <div class="sf-table-wrap" tabindex="0" role="region" aria-labelledby="sf-coverage-title">
          <table class="sf-table sf-stack">
            <thead><tr><th scope="col">Dataset</th><th scope="col">Kind</th><th scope="col">Measured (Toronto days)</th><th scope="col">Coverage</th><th scope="col">Metrics</th></tr></thead>
            <tbody>
            ${rows}
            </tbody>
          </table>
        </div>
      </section>`;
}

// A ratio's words name what it is a share of: cache reuse is a share of input
// tokens, the model share a share of estimated usage.
const unitWords = (m) => (m.id === 'usage_share_by_model' ? 'share of estimated usage' : UNIT_WORDS[m.unit] ?? m.unit);

// The separate figures' notes say where each would be shown. No snapshot carries
// them yet, so the page says that instead of pointing at itself.
const separateNote = (note) => note.replace(/\s*(?:Shown on the methodology page only|Methodology page only)\.$/, '');

function definitions(e) {
  const items = METRIC_CONFIG.metrics
    .map(
      (m) => `          <article class="sf-method" id="def-${e(m.id)}">
            <h3>${e(m.label)} <code class="sf-muted">${e(m.id)}</code></h3>
            <dl class="sf-facts">
              <div><dt>Unit</dt><dd>${e(unitWords(m))}</dd></div>
              <div><dt>Kind</dt><dd>${m.kind === 'stock' ? 'Snapshot total at the source revision' : 'Activity over a period'}</dd></div>
              <div><dt>Filters</dt><dd>${e(filterScope(m.id))}</dd></div>
              <div><dt>Definition</dt><dd>${e(m.definition)}</dd></div>
              <div><dt>Coverage counts</dt><dd>${e(m.coverage)}</dd></div>
              <div><dt>Notes</dt><dd>${e(m.notes)}</dd></div>
            </dl>
          </article>`
    )
    .join('\n');
  const separate = METRIC_CONFIG.separate.map((s) => `<li><strong>${e(s.label)}.</strong> ${e(separateNote(s.note))}</li>`).join('');
  return `      <section class="sf-panel sf-definitions" id="definitions" aria-labelledby="sf-definitions-title">
        <h2 id="sf-definitions-title">Metric definitions</h2>
        <p class="sf-caption">Version ${e(METRIC_CONFIG.version)} of the definitions. ${e(METRIC_CONFIG.note.split('. ').slice(-1)[0])}</p>
${items}
        <h3>Figures kept separate</h3>
        <p>These are other figures, never added to estimated model usage: they are not parts of one bill. Only this page would show them, and no published snapshot includes them yet.</p>
        <ul class="sf-list">${separate}</ul>
      </section>`;
}

const FIGURE_SECTIONS = { loops: 'Feature loops', tools: 'Tools', code: 'Code' };

/** The figures of the feature loops, tools and code: defined like the metrics, with the patterns they rest on. */
function figureDefinitions(e) {
  const items = FIGURES.map(
    (f) => `          <article class="sf-method" id="def-${e(f.id)}">
            <h3>${e(f.label)} <code class="sf-muted">${e(f.id)}</code></h3>
            <dl class="sf-facts">
              <div><dt>Section</dt><dd>${e(FIGURE_SECTIONS[f.section] ?? f.section)}</dd></div>
              <div><dt>Filters</dt><dd>All time: no filter applies.</dd></div>
              <div><dt>Definition</dt><dd>${e(f.definition)}</dd></div>
              <div><dt>Coverage counts</dt><dd>${e(f.coverage)}</dd></div>
              <div><dt>Notes</dt><dd>${e(f.notes)}</dd></div>
            </dl>
          </article>`
  ).join('\n');
  const patterns = (list) => list.map((x) => `<code>${e(x)}</code>`).join(' ');
  return `      <section class="sf-panel sf-definitions" id="figures" aria-labelledby="sf-figures-title">
        <h2 id="sf-figures-title">Feature loops, tools and code</h2>
        <p class="sf-caption">How the feature loops, model performance and code pages are counted. They cover all the recorded data; the date range, model and effort filters don't apply to them.</p>
${items}
        <h3>How a run is read</h3>
        <dl class="sf-facts">
          <div><dt>Window</dt><dd>${e(LOOPS.window)}</dd></div>
          <div><dt>Campaign</dt><dd>${e(LOOPS.campaign)}</dd></div>
          <div><dt>Sent by the loop</dt><dd>A prompt whose text starts like one of ${patterns(LOOPS.senders.harness)}</dd></div>
          <div><dt>Sent by an agent</dt><dd>${patterns(LOOPS.senders.agent)}</dd></div>
          <div><dt>Interruption</dt><dd>${patterns(LOOPS.senders.interrupt)}, counted with the prompts a person typed</dd></div>
          <div><dt>Typed by a person</dt><dd>Any other prompt the trace records as typed input. The text is read only for this, and is never published.</dd></div>
          <div><dt>How a run ended</dt><dd>${e(LOOPS.outcomes.note)}</dd></div>
        </dl>
        <h3>What counts as code</h3>
        <p>${e(CODE.note)}</p>
        <div class="sf-table-wrap" tabindex="0" role="region" aria-label="What counts as code">
          <table class="sf-table sf-stack">
            <thead><tr><th scope="col">Class</th><th scope="col">File extensions</th></tr></thead>
            <tbody>${CODE.languages.map((l) => `<tr><th scope="row">${e(l.label)}</th><td data-label="File extensions">${patterns(l.extensions.map((x) => `.${x}`))}</td></tr>`).join('')}<tr><th scope="row">${e(
              CODE.docs.label
            )}</th><td data-label="File extensions">${patterns(CODE.docs.extensions.map((x) => `.${x}`))}</td></tr><tr><th scope="row">${e(CODE.data.label)}</th><td data-label="File extensions">Everything else</td></tr></tbody>
          </table>
        </div>
      </section>`;
}

/** What the pages can't measure yet, and what is asked of the source to measure it. */
function requests(e) {
  return `      <section class="sf-panel sf-requests" id="requests" aria-labelledby="sf-requests-title">
        <h2 id="sf-requests-title">Not measured yet</h2>
        <p class="sf-caption">What these pages can't say from the source's published files, and what would let them. Until then each is left out, never estimated.</p>
        <div class="sf-table-wrap" tabindex="0" role="region" aria-labelledby="sf-requests-title">
          <table class="sf-table sf-stack">
            <thead><tr><th scope="col">Question</th><th scope="col">Today</th><th scope="col">Asked of the source</th></tr></thead>
            <tbody>${REQUESTS.requests.map((r) => `<tr><th scope="row">${e(r.title)}</th><td data-label="Today">${e(r.today)}</td><td data-label="Asked of the source">${e(r.ask)}</td></tr>`).join('')}</tbody>
          </table>
        </div>
      </section>`;
}

function areasSection(e) {
  const row = (a) =>
    `<tr><th scope="row">${e(a.label)}</th><td data-label="What it covers">${e(a.description ?? '')}</td><td data-label="Paths">${(a.paths ?? []).map((x) => `<code>${e(x)}</code>`).join(' ') || '<span class="sf-muted">None</span>'}</td><td data-label="Campaigns">${
      (a.campaigns ?? []).map((x) => `<code>${e(x)}</code>`).join(' ') || '<span class="sf-muted">None</span>'
    }</td></tr>`;
  return `      <section class="sf-panel sf-areas" id="areas" aria-labelledby="sf-areas-title">
        <h2 id="sf-areas-title">Areas of work</h2>
        <p><span class="sf-tag">Mapping ${e(AREAS.status)}</span> version ${e(AREAS.version)}. ${e(AREAS.note)}</p>
        <p>${e(AREAS.rule)}</p>
        <div class="sf-table-wrap" tabindex="0" role="region" aria-labelledby="sf-areas-title">
          <table class="sf-table sf-areas-table sf-stack">
            <thead><tr><th scope="col">Area</th><th scope="col">What it covers</th><th scope="col">Paths</th><th scope="col">Campaigns</th></tr></thead>
            <tbody>${AREAS.areas.map(row).join('')}${row({ ...AREAS.unassigned, description: 'Anything no rule places. Always shown.' })}</tbody>
          </table>
        </div>
      </section>`;
}

function limits(e) {
  const { periods } = METRIC_CONFIG;
  return `      <section class="sf-panel sf-limits" id="limits" aria-labelledby="sf-limits-title">
        <h2 id="sf-limits-title">Comparison limits</h2>
        <ul class="sf-list">
          <li>${e(periods.note)}</li>
          <li>Periods are the last 7 or 30 calendar days of the data, ending on its last day, not on today: the numbers are as of the snapshot.</li>
          <li>The model and effort filters apply to usage only. Verification jobs aren't linked well enough to sessions to filter by model, and stocks are totals at the source revision.</li>
          <li>Estimated usage is priced from token counts at one date's list prices. It is not a bill, and models with different task mixes aren't comparable by it.</li>
          <li>Recorded changes leave out a change the source lists without a summary yet, a working copy before its first commit message, until it has one. The calls made while working on it count in usage like any others.</li>
        </ul>
      </section>`;
}

/** methodology/index.html: definitions, coverage, provenance, freshness and limits. */
function methodologyPage({ snapshot, unavailable, fixture, helpers, paths }) {
  const e = helpers.escapeHtml;
  const formatDate = helpers.formatDate ?? formatDay;
  const data = snapshot
    ? [provenance(snapshot, { e, formatDate }), datasetCoverage(snapshot, { e, formatDate })]
    : [
        `      <section class="sf-panel sf-unavailable" role="status" aria-labelledby="sf-unavailable-title">
        <h2 id="sf-unavailable-title">Data unavailable</h2>
        <p>${e(unavailable || 'No Software Factory data is available.')}</p>
        <p>The source, freshness and coverage of the data appear here when a snapshot is published. The definitions below don't depend on it.</p>
      </section>`,
      ];
  return {
    path: 'methodology/index.html',
    title: `Methodology · ${TITLE}`,
    description: 'How each Software Factory number is defined and measured: definitions, coverage, source, freshness and comparison limits.',
    body: `    <div class="sf-shell" data-sf-page="methodology">
${sectionNav(paths, e, 'methodology/', Boolean(snapshot))}
${pageHead({ title: 'Methodology', lede: "How each number on the Software Factory pages is defined and measured, what it covers, where it comes from, and what it can't be compared with.", fixture, e })}
      <nav class="sf-toc" aria-label="On this page"><a href="#${snapshot ? 'provenance' : 'definitions'}">${snapshot ? 'Source and freshness' : 'Definitions'}</a>${
        snapshot ? ' · <a href="#coverage">Coverage</a> · <a href="#definitions">Definitions</a>' : ''
      } · <a href="#figures">Loops, tools and code</a> · <a href="#areas">Areas</a> · <a href="#limits">Limits</a> · <a href="#requests">Not measured yet</a></nav>
${data.join('\n')}
${definitions(e)}
${figureDefinitions(e)}
${areasSection(e)}
${limits(e)}
${requests(e)}
    </div>`,
  };
}

export function renderPages(input) {
  return [overviewPage(input), ...(input.snapshot ? dataPages(input) : []), analysisPage(input), methodologyPage(input)];
}
