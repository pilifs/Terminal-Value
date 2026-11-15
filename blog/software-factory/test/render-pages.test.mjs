// The analysis and methodology pages' static HTML, rendered from the example
// snapshot and in each state. Run: npm run test:software-factory

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { escapeHtml, formatDay, formatValue } from '../../assets/software-factory/format.js';
import { loadSnapshot } from '../index.mjs';
import { renderPages } from '../render.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { snapshot } = loadSnapshot(path.join(HERE, 'fixtures', 'snapshot-example'));
const metrics = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'config', 'metrics.json'), 'utf8'));
const areas = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'config', 'areas.json'), 'utf8'));

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

function page(file, input = {}) {
  const pages = renderPages({ snapshot, unavailable: null, fixture: false, posts: noPosts, site, helpers, paths, ...input });
  const found = pages.find((p) => p.path === file);
  assert.ok(found, `a page at ${file}`);
  return found;
}

test('eight pages, each with a title and description', () => {
  const pages = renderPages({ snapshot, unavailable: null, fixture: false, posts: noPosts, site, helpers, paths });
  assert.deepEqual(
    pages.map((p) => p.path),
    ['index.html', 'loops/index.html', 'examples/index.html', 'tools/index.html', 'code/index.html', 'usage/index.html', 'analysis/index.html', 'methodology/index.html']
  );
  assert.equal(new Set(pages.map((p) => p.title)).size, pages.length, 'each its own title');
  assert.equal(new Set(pages.map((p) => p.description)).size, pages.length, 'each its own description');
  for (const p of pages) {
    assert.ok(p.title.includes('Software Factory'), p.path);
    assert.ok(p.description.length > 20, p.path);
    assert.doesNotMatch(p.body.replace(/<[^>]+>/g, ' '), /\blive\b/i, p.path);
    assert.doesNotMatch(p.body.replace(/<[^>]+>/g, ' ').replace(/Software Factory/g, ''), /\bFactory\b/, `${p.path}: "Factory" alone`);
  }
});

test('analysis: every post newest first, featured marked, bylines only with an author', () => {
  const featured = post('featured-one', { featured: true, date: '2026-11-01' });
  const items = [post('newest', { date: '2026-11-12' }), featured, post('older', { date: '2026-10-20', author: null, cover: null })];
  const { body } = page('analysis/index.html', { posts: { featured, items, related: [] } });
  const at = (s) => body.indexOf(s);
  assert.ok(at('/posts/newest/') < at('/posts/featured-one/') && at('/posts/featured-one/') < at('/posts/older/'), 'the order selectPosts gave');
  assert.match(body, /class="sf-post sf-post-featured"><img class="sf-cover" src="\/posts\/featured-one\/cover\.png"/);
  assert.match(body, /Title of featured-one<\/a><\/h2>\s*<p class="sf-post-meta"><strong class="sf-featured">Featured<\/strong> · /, 'featured in words');
  assert.equal((body.match(/>Featured</g) ?? []).length, 1);
  assert.match(body, /<h2><a href="\/posts\/newest\/">Title of newest<\/a><\/h2>\s*<p class="sf-post-meta"><span class="sf-byline">By Filip Stankovic<\/span> · <time datetime="2026-11-12">Nov 12, 2026<\/time>/);
  assert.match(body, /<h2><a href="\/posts\/older\/">Title of older<\/a><\/h2>\s*<p class="sf-post-meta"><time/);
  assert.ok(body.includes('About older.'));
  assert.doesNotMatch(body, /sf-empty|sf-related/);
});

test('analysis: related background is apart and not called the author’s analysis', () => {
  const { body } = page('analysis/index.html', { posts: { featured: null, items: [post('mine')], related: [post('agent-written', { author: null, collection: null })] } });
  const related = body.slice(body.indexOf('class="sf-panel sf-related"'));
  assert.match(related, /<h2 id="sf-related-title">Related background<\/h2>/);
  assert.match(related, /They are not Filip's analysis\./);
  assert.ok(related.includes('/posts/agent-written/'));
  assert.ok(!related.includes('/posts/mine/'));
});

test('analysis: no posts is an honest empty state, with or without data', () => {
  for (const input of [{}, { snapshot: null, unavailable: 'No data yet.' }]) {
    const { body } = page('analysis/index.html', input);
    assert.match(body, /<p class="sf-empty">No analysis published yet\./);
    assert.match(body, /<a href="\/software-factory\/">overview<\/a>/);
  }
});

test('a page’s description starts with the result it leads with, in plain text', () => {
  const committed = loadSnapshot(path.join(HERE, '..', 'data')).snapshot;
  const pages = renderPages({ snapshot: committed, unavailable: null, fixture: false, posts: noPosts, site, helpers, paths });
  const of = (file) => pages.find((p) => p.path === file);
  // The overview: its headline, then what is under it.
  const headline = of('index.html').body.match(/<span class="sf-headline">([^<]+)<\/span>/)[1];
  assert.match(headline, /^[\d,]+ of [\d,]+ commits were made inside a loop run$/);
  assert.equal(of('index.html').description, `${headline}. What the feature loops did in in-the-loop, a project that formally verifies Java code, with every run, example, tool call and line of code under the numbers.`);
  // Each page under it: its own statement, then what the page holds.
  for (const name of ['loops', 'examples', 'tools', 'code', 'usage']) {
    const p = of(`${name}/index.html`);
    const claim = p.body.match(new RegExp(`<h1 id="sf-${name}-title">([^<]+)</h1>`))[1];
    assert.ok(p.description.startsWith(`${claim}. `) && p.description.length > claim.length + 40, name);
    assert.doesNotMatch(p.description, /[<>]|&(?:amp|lt|gt|quot|#39);/, `${name}: text, to be escaped once by the page template`);
  }
  for (const p of pages) assert.equal('after' in p, false, p.path);
  // A page with no statement keeps its own description: the analysis, the methodology, and an overview with no headline.
  assert.match(of('analysis/index.html').description, /analysis of the software factory in in-the-loop/);
  assert.match(of('methodology/index.html').description, /^How each Software Factory number is defined and measured/);
  const bare = renderPages({ snapshot, unavailable: null, fixture: true, posts: noPosts, site, helpers, paths }).find((p) => p.path === 'index.html');
  assert.doesNotMatch(bare.body, /sf-headline/);
  assert.match(bare.description, /^What the software factory in in-the-loop produces/);
  const none = renderPages({ snapshot: null, unavailable: 'No data.', fixture: false, posts: noPosts, site, helpers, paths }).find((p) => p.path === 'index.html');
  assert.match(none.description, /^What the software factory in in-the-loop produces/);
  // A statement with a character the page escapes is unescaped, once.
  const edited = { ...committed, overview: { ...committed.overview, models: committed.overview.models.map((m) => ({ ...m, label: `${m.label} & <co>` })) } };
  for (const p of renderPages({ snapshot: edited, unavailable: null, fixture: false, posts: noPosts, site, helpers, paths })) assert.doesNotMatch(p.description, /&amp;|&lt;/, p.path);
});

test('the source files read are counted on the methodology page, and listed where the snapshot has the list', () => {
  // The example snapshot is of the older shape: its manifest lists its inputs, and it has no collection of them.
  assert.ok(Array.isArray(snapshot.manifest.source.inputs));
  const older = page('methodology/index.html').body;
  assert.ok(older.includes(`${snapshot.manifest.source.inputs.length} source files read, each recorded with its SHA-256</`));
  assert.doesNotMatch(page('usage/index.html').body, /id="explore-inputs"/);
  // The committed snapshot counts them in its manifest and lists them in a file of its own, out of the first load.
  const { snapshot: committed } = loadSnapshot();
  const { source, collections, snapshotId } = committed.manifest;
  const listed = collections.find((c) => c.name === 'inputs');
  assert.deepEqual(Object.keys(source), ['repository', 'sha', 'inputCount']);
  assert.equal(listed.records, source.inputCount);
  assert.ok(source.inputCount > 500);
  const body = page('methodology/index.html', { snapshot: committed }).body;
  assert.ok(
    body.includes(
      `${source.inputCount.toLocaleString('en-US')} source files read, each recorded with its SHA-256: <a href="/software-factory/static-data/snapshots/${snapshotId}/details/inputs.json">the list</a>, also under <a href="/software-factory/usage/#explore-inputs">Deeper exploration</a>`
    )
  );
  const usage = page('usage/index.html', { snapshot: committed }).body;
  assert.match(usage, new RegExp(`<details class="sf-detail" id="explore-inputs" data-sf-detail="inputs" data-path="details/inputs.json">\\s*<summary>Source files read <span class="sf-muted">\\(<span data-count>${source.inputCount.toLocaleString('en-US')}</span>\\)</span></summary>`));
});

test('methodology: every metric definition, note and filter scope from config', () => {
  const { body } = page('methodology/index.html');
  for (const m of metrics.metrics) {
    assert.ok(body.includes(`id="def-${m.id}"`), m.id);
    for (const text of [m.label, m.definition, m.notes, m.coverage]) assert.ok(body.includes(escapeHtml(text)), `${m.id}: ${text}`);
  }
  // The separate figures: their notes, and their values where the snapshot has them, each beside the estimate.
  for (const s of metrics.separate) assert.ok(body.includes(`<li id="def-${s.id}"><strong>${escapeHtml(s.label)}.</strong> ${escapeHtml(s.note)}`), s.id);
  assert.doesNotMatch(body, /[Mm]ethodology page only|no published snapshot includes them yet/);
  const { reported } = snapshot.overview;
  assert.ok(
    body.includes(`At this revision: ${formatValue(reported.usd, 'usd')} over the 3 of 4 sessions that have one; the calls in those sessions’ logs come to ${formatValue(reported.callsUsd, 'usd')} of estimated usage.`),
    'reported_usd value'
  );
  // The fixture's rollup has no unattributed total, so that figure has no value; the hypothetical is the usage table's sum.
  assert.match(body, /id="def-unattributed_usd">(?:(?!<\/li>)[\s\S])*session by session\.<\/li>/);
  const u = snapshot.overview.usage;
  const uncached = u.rows.reduce((t, r) => t + r[u.columns.indexOf('uncachedUsd')], 0);
  assert.ok(body.includes(`At this revision: ${formatValue(uncached, 'usd')}, for the same calls that come to ${formatValue(snapshot.overview.measures[0].value, 'usd')} of estimated usage.`), 'uncached_usd value');
  // A ratio says what it is a share of.
  assert.match(body, /id="def-cache_reuse"[\s\S]*?<dt>Unit<\/dt><dd>share of input tokens<\/dd>/);
  assert.match(body, /id="def-usage_share_by_model"[\s\S]*?<dt>Unit<\/dt><dd>share of estimated usage<\/dd>/);
  assert.match(body, /id="def-changes_recorded"[\s\S]*?Snapshot total at the source revision[\s\S]*?A snapshot total: no filter applies\./);
  assert.match(body, /id="def-verification_completed"[\s\S]*?Follows the date range only; the model and effort filters do not apply\./);
});

test('methodology: source, versions, prices, timezone and freshness from the snapshot', () => {
  const { body } = page('methodology/index.html');
  assert.match(body, /href="https:\/\/github\.com\/pilifs\/in-the-loop\/tree\/7384f8c23eef441817ddb714c6ef5571cdc138bd">pilifs\/in-the-loop<\/a>/);
  assert.ok(body.includes(`<code>${snapshot.manifest.snapshotId}</code>`));
  assert.match(body, /<code>blog\/software-factory\/test\/fixtures\/make-snapshot-example\.mjs<\/code>, version 1/);
  assert.ok(body.includes(`Metric definitions</dt><dd>Version ${snapshot.manifest.metricDefinitions.version}, SHA-256 <code>${snapshot.manifest.metricDefinitions.sha256.slice(0, 12)}</code>`));
  assert.match(body, /List prices as of <time datetime="2026-10-31">Oct 31, 2026<\/time>/);
  assert.match(body, /America\/Toronto: half-open \[start, end\)/);
  assert.match(body, /Data as of<\/dt><dd><time datetime="2026-11-08">Nov 8, 2026<\/time>/);
  assert.match(body, /Source last checked<\/dt><dd><time datetime="2026-11-14T00:00:00Z">Nov 13, 2026<\/time>: found new data/);
});

test('methodology: coverage per dataset, periods by Toronto day and stocks as totals', () => {
  const { body } = page('methodology/index.html');
  const table = body.slice(body.indexOf('id="coverage"'), body.indexOf('id="definitions"'));
  assert.match(table, /Model usage<\/th><td data-label="Kind">Period<\/td><td data-label="Measured"><time datetime="2026-10-30">Oct 30, 2026<\/time> to <time datetime="2026-11-02">Nov 2, 2026<\/time><\/td><td data-label="Coverage">4 of 5 sessions with a metrics file<\/td>/);
  assert.match(table, /Verification results<\/th><td data-label="Kind">Period<\/td><td data-label="Measured"><time datetime="2026-11-07">/);
  assert.match(table, /Example catalog<\/th><td data-label="Kind">Snapshot total<\/td><td data-label="Measured">Snapshot total at <code>7384f8c<\/code><\/td><td data-label="Coverage">11 of 11 examples with a verdict<\/td>/);
});

test('methodology: the area mapping with its status, and comparison limits', () => {
  const { body } = page('methodology/index.html');
  assert.match(body, new RegExp(`<span class="sf-tag">Mapping ${areas.status}</span>`));
  for (const a of areas.areas) assert.ok(body.includes(`<th scope="row">${escapeHtml(a.label)}</th>`), a.id);
  assert.ok(body.includes('<th scope="row">Unassigned</th>'));
  assert.ok(body.includes(escapeHtml(metrics.periods.note)));
  // import.mjs leaves a change with no summary yet out of the count; the page says so.
  assert.match(body, /Recorded changes leave out a change the source lists without a summary yet/);
});

test('methodology without a snapshot: says so, keeps the definitions', () => {
  const { body } = page('methodology/index.html', { snapshot: null, unavailable: 'No Software Factory data has been published yet.' });
  assert.match(body, /class="sf-panel sf-unavailable" role="status"/);
  assert.ok(body.includes('No Software Factory data has been published yet.'));
  assert.ok(body.includes('id="def-usage_usd"'));
  assert.doesNotMatch(body, /id="provenance"|id="coverage"|href="#coverage"/);
});

test('methodology: fixture banner only for fixture data', () => {
  assert.match(page('methodology/index.html', { fixture: true }).body, /class="sf-banner" role="note"><strong>Test fixture\.<\/strong>/);
  assert.doesNotMatch(page('methodology/index.html').body, /sf-banner/);
});

test('both pages escape what comes from data', () => {
  const evil = '<script>alert(1)</script>';
  const hostile = structuredClone(snapshot);
  hostile.pointer.lastSourceCheck = { ...hostile.pointer.lastSourceCheck, outcome: 'failed', error: evil };
  const m = page('methodology/index.html', { snapshot: hostile }).body;
  assert.doesNotMatch(m, /<script>/);
  assert.ok(m.includes('failed (&lt;script&gt;'));
  const a = page('analysis/index.html', { posts: { featured: null, items: [post('x', { title: evil, description: evil, author: evil })], related: [post('y', { title: evil })] } }).body;
  assert.doesNotMatch(a, /<script>/);
  assert.doesNotMatch(page('methodology/index.html', { snapshot: null, unavailable: evil }).body, /<script>/);
});
