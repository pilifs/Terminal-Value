// The analysis and methodology pages' static HTML, rendered from the example
// snapshot and in each state. Run: npm run test:software-factory

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { escapeHtml, formatDay } from '../../assets/software-factory/format.js';
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

test('three pages, each with a title and description', () => {
  const pages = renderPages({ snapshot, unavailable: null, fixture: false, posts: noPosts, site, helpers, paths });
  assert.deepEqual(
    pages.map((p) => p.path),
    ['index.html', 'analysis/index.html', 'methodology/index.html']
  );
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

test('methodology: every metric definition, note and filter scope from config', () => {
  const { body } = page('methodology/index.html');
  for (const m of metrics.metrics) {
    assert.ok(body.includes(`id="def-${m.id}"`), m.id);
    for (const text of [m.label, m.definition, m.notes, m.coverage]) assert.ok(body.includes(escapeHtml(text)), `${m.id}: ${text}`);
  }
  // The separate figures: their notes, without pointing at this page for figures no snapshot carries.
  for (const s of metrics.separate) assert.ok(body.includes(`<strong>${escapeHtml(s.label)}.</strong>`), s.id);
  assert.ok(body.includes(`${escapeHtml("Claude Code's own figure, where the session recorded one.")}</li>`), 'reported_usd note');
  assert.doesNotMatch(body, /[Mm]ethodology page only/);
  assert.match(body, /no published snapshot includes them yet/);
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
  assert.ok(body.includes(`Metric definitions</dt><dd>Version 2, SHA-256 <code>${snapshot.manifest.metricDefinitions.sha256.slice(0, 12)}</code>`));
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
  assert.match(table, /Example catalog<\/th><td data-label="Kind">Snapshot total<\/td><td data-label="Measured">Snapshot total at <code>7384f8c<\/code><\/td><td data-label="Coverage">7 of 11 examples with a verdict<\/td>/);
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
