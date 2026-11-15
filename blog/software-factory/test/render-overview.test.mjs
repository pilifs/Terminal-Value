// The overview page's static HTML, rendered from the example snapshot and in
// each state. Run: npm run test:software-factory

import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { escapeHtml, formatDay } from '../../assets/software-factory/format.js';
import { loadSnapshot } from '../index.mjs';
import { filterScope, renderPages } from '../render.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXAMPLE = path.join(HERE, 'fixtures', 'snapshot-example');
const { snapshot } = loadSnapshot(EXAMPLE);

const helpers = { escapeHtml, formatDate: formatDay, postImage: () => undefined };
const paths = { route: '/software-factory/', staticData: '/software-factory/static-data/', remoteData: '/software-factory/data/' };
const site = { url: 'https://example.invalid', author: 'Filip Stankovic' };
const noPosts = { featured: null, items: [], related: [] };

const post = (slug, extra = {}) => ({
  slug,
  url: `/posts/${slug}/`,
  title: `Title of ${slug}`,
  description: `About ${slug}.`,
  author: 'Filip Stankovic',
  date: '2026-11-10',
  cover: { url: `/posts/${slug}/cover.png`, width: 1200, height: 630 },
  collection: 'software-factory',
  featured: false,
  evidence: null,
  ...extra,
});

function overview(input = {}) {
  const pages = renderPages({ snapshot, unavailable: null, fixture: false, posts: noPosts, site, helpers, paths, ...input });
  const page = pages.find((p) => p.path === 'index.html');
  assert.ok(page, 'an overview page');
  return page.body;
}

test('the static overview carries the all-time numbers without script', () => {
  const html = overview();
  for (const text of ['$101.07', '>590<', '97.7%', '>12<', 'Coverage: 4 of 5 sessions with a metrics file'])
    assert.ok(html.includes(text), `missing ${text}`);
  assert.match(html, /<svg class="sf-chart sf-chart-wide"[^>]*role="img"/);
  assert.match(html, /<table class="sf-table">/);
});

test('freshness comes from the snapshot dates and nothing is called live', () => {
  const html = overview();
  assert.match(html, /Published data as of <time datetime="2026-11-08">Nov 8, 2026<\/time>/);
  assert.match(html, /source checked <time datetime="2026-11-13">/); // 2026-11-14T00:00Z is still the 13th in Toronto
  assert.doesNotMatch(html.replace(/<[^>]+>/g, ' '), /\blive\b/i);
});

test('the sections come in the order of the plan', () => {
  const html = overview();
  const at = (marker) => {
    const i = html.indexOf(marker);
    assert.ok(i >= 0, `missing ${marker}`);
    return i;
  };
  const order = ['class="sf-intro"', 'id="loops"', 'id="tools"', 'id="code"', 'id="analysis"', 'id="usage"', 'class="sf-summary"', 'id="trend"', 'class="sf-panel sf-observations"', 'id="output"', 'id="explore"'].map(at);
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
});

test('stocks are labelled snapshot totals, apart from all-time period values', () => {
  const html = overview();
  const output = html.slice(html.indexOf('id="output"'));
  const summary = html.slice(html.indexOf('class="sf-summary"'), html.indexOf('id="trend"'));
  assert.match(output, /Snapshot total<\/span> at <code>7384f8c<\/code>, not activity over a period/);
  assert.match(output, /6 of them trace-publication housekeeping, counted apart/);
  assert.doesNotMatch(summary, /Snapshot total/);
  assert.equal((summary.match(/All time ·/g) ?? []).length, 4);
});

test('each panel says which filters apply to it', () => {
  assert.equal(filterScope('usage_usd'), 'Follows the date range, model and effort filters.');
  assert.equal(filterScope('verification_completed'), 'Follows the date range only; the model and effort filters do not apply.');
  assert.equal(filterScope('usage_share_by_model'), 'Follows the date range and effort only; the model filter does not apply.');
  assert.equal(filterScope('changes_recorded'), 'A snapshot total: no filter applies.');
  assert.ok(overview().includes('Follows the date range only; the model and effort filters do not apply.'));
});

test('each observation links to its breakdown or records', () => {
  const html = overview();
  assert.match(html, /accounts for 69\.9% of estimated usage[\s\S]*?href="#breakdown-usage-by-model"/);
  assert.match(html, /href="#metric-cache_reuse"/);
  // Each card's definition leads to its full entry on the methodology page.
  for (const id of ['usage_usd', 'model_calls', 'cache_reuse', 'verification_completed'])
    assert.ok(html.includes(`<a href="/software-factory/methodology/#def-${id}">Methodology</a>`), id);
  assert.match(html, /href="#explore-verification"/);
  for (const target of ['id="breakdown-usage-by-model"', 'id="metric-cache_reuse"', 'id="explore-verification"']) assert.ok(html.includes(target));
});

test('days the data does not cover are no data, never a zero column', () => {
  const html = overview();
  // Usage covers Oct 30 to Nov 2; the overview's days run to Nov 8. Both shapes of the chart (wide, compact) agree.
  for (const shape of ['wide', 'compact']) {
    const svg = html.match(new RegExp(`<svg class="sf-chart sf-chart-${shape}"[\\s\\S]*?</svg>`))?.[0] ?? '';
    assert.equal((svg.match(/class="sf-day sf-day-none"/g) ?? []).length, 6, shape);
    assert.equal((svg.match(/class="sf-bar"/g) ?? []).length, 4, shape);
  }
  assert.match(html, /Nov 5, 2026<\/time><\/th><td><span class="sf-muted">No data<\/span>/);
});

test('deeper exploration links its records lazily, with raw ids and source', () => {
  const html = overview();
  assert.match(html, /data-sf-detail="changes" data-path="details\/changes\.json"/);
  assert.ok(html.includes(`href="/software-factory/static-data/snapshots/${snapshot.manifest.snapshotId}/details/verification.json"`));
  assert.ok(html.includes('7384f8c23eef441817ddb714c6ef5571cdc138bd'));
  assert.ok(html.includes(`<code>${snapshot.manifest.snapshotId}</code>`));
});

test('fixture data says so plainly; real data has no banner', () => {
  assert.match(overview({ fixture: true }), /class="sf-banner" role="note"><strong>Test fixture\.<\/strong>/);
  assert.doesNotMatch(overview(), /sf-banner/);
});

test('with no snapshot: an honest message, the layout kept, posts still listed', () => {
  const html = overview({ snapshot: null, unavailable: 'No Software Factory data has been published yet.', posts: { featured: null, items: [post('a-note')], related: [] } });
  assert.match(html, /class="sf-panel sf-unavailable" role="status"/);
  assert.ok(html.includes('No Software Factory data has been published yet.'));
  assert.ok(html.includes('class="sf-intro"'));
  assert.match(html, /<a href="\/posts\/a-note\/">Title of a-note<\/a>/);
  assert.doesNotMatch(html, /sf-metric-value|Published data as of|sf-controls|Showing all time|\$/);
});

test('no published posts: the empty state keeps the analysis section', () => {
  const html = overview();
  assert.match(html, /Analysis &amp; notes by Filip<\/h2>\s*<p class="sf-empty">No analysis published yet\./);
});

test('published posts: a featured post and a short list, with bylines and canonical links', () => {
  const featured = post('featured-one', { featured: true, date: '2026-11-01' });
  const items = [post('newest', { date: '2026-11-12' }), featured, post('older', { date: '2026-10-20', author: null, cover: null })];
  const html = overview({ posts: { featured, items, related: [] } });
  const section = html.slice(html.indexOf('id="analysis"'), html.indexOf('id="output"'));
  assert.match(section, /class="sf-post sf-post-featured"><img class="sf-cover" src="\/posts\/featured-one\/cover\.png"[^>]*alt=""/);
  assert.equal((section.match(/featured-one\//g) ?? []).length, 2, 'the featured post once: cover and link');
  assert.match(section, /<span class="sf-byline">By Filip Stankovic<\/span> · <time datetime="2026-11-12">Nov 12, 2026<\/time>/);
  assert.match(section, /<a href="\/posts\/older\/">Title of older<\/a><\/h3>\s*<p class="sf-post-meta"><time/, 'no byline without an author');
  assert.match(section, /href="\/software-factory\/analysis\/">All analysis/);
  assert.doesNotMatch(section, /sf-empty/);
});

test('everything from data is escaped', () => {
  const evil = '<script>alert(1)</script>';
  const hostile = structuredClone(snapshot);
  hostile.overview.insights[0].text = evil;
  hostile.overview.breakdowns[0].rows[0].label = evil;
  hostile.overview.stocks.examples.origin = { [evil]: 1 };
  const html = overview({
    snapshot: hostile,
    posts: { featured: null, items: [post('x', { title: evil, description: evil, author: evil })], related: [] },
  });
  assert.doesNotMatch(html, /<script>/);
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.doesNotMatch(overview({ snapshot: null, unavailable: evil }), /<script>/);
});

test('ids and paths from data are escaped inside attributes too', () => {
  const quote = 'x" onmouseover="alert(1)';
  const hostile = structuredClone(snapshot);
  hostile.overview.breakdowns[0].id = quote;
  hostile.overview.insights[0].evidence = { collection: 'overview', breakdown: quote };
  hostile.overview.insights[1].evidence = { collection: quote, breakdown: null };
  hostile.manifest.collections.find((c) => c.name === 'changes').path = quote;
  hostile.manifest.source.sha = quote;
  hostile.manifest.snapshotId = quote;
  const html = overview({ snapshot: hostile });
  assert.doesNotMatch(html, /" onmouseover=/);
  assert.ok(html.includes('x&quot; onmouseover=&quot;alert(1)'));
});
