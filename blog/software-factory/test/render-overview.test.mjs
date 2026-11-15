// The static HTML of the overview and of the pages under it (feature loops,
// model performance, code, usage), rendered from the example snapshot and in
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
const { snapshot, examples } = loadSnapshot(EXAMPLE);
// The committed snapshot has the loops, tools and code the example lacks: used for structure, never for a number.
const { snapshot: committed } = loadSnapshot();
const DATA_PAGES = ['loops/index.html', 'examples/index.html', 'tools/index.html', 'code/index.html', 'usage/index.html'];

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

const render = (input = {}) => renderPages({ snapshot, unavailable: null, fixture: false, posts: noPosts, site, helpers, paths, ...input });

function body(file, input = {}) {
  const page = render(input).find((p) => p.path === file);
  assert.ok(page, `a page at ${file}`);
  return page.body;
}
const overview = (input) => body('index.html', input);
const usage = (input) => body('usage/index.html', input);
const everyBody = (input) => render(input).map((p) => p.body).join('\n');

const at = (html, marker) => {
  const i = html.indexOf(marker);
  assert.ok(i >= 0, `missing ${marker}`);
  return i;
};
const inOrder = (html, markers) => {
  const order = markers.map((m) => at(html, m));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
};

test('the static pages carry the all-time numbers without script', () => {
  const html = usage();
  for (const text of ['$101.07', '>590<', '97.7%', '>12<', 'Coverage: 4 of 5 sessions with a metrics file'])
    assert.ok(html.includes(text), `missing ${text}`);
  assert.match(html, /<svg class="sf-chart sf-chart-wide"[^>]*role="img"/);
  assert.match(html, /<table class="sf-table">/);
  // The overview names what the usage page opens with.
  assert.match(overview(), /<dd data-sf-value="usage_usd">\$101\.07<\/dd>/);
  assert.match(overview(), /<dd data-sf-value="model_calls">590<\/dd>/);
});

test('freshness comes from the snapshot dates and nothing is called live', () => {
  for (const file of ['index.html', ...DATA_PAGES]) {
    const html = body(file);
    assert.match(html, /Published data as of <time datetime="2026-11-08">Nov 8, 2026<\/time>/, file);
    assert.match(html, /source checked <time datetime="2026-11-13">/, file); // 2026-11-14T00:00Z is still the 13th in Toronto
    assert.doesNotMatch(html.replace(/<[^>]+>/g, ' '), /\blive\b/i, file);
  }
});

test('the overview is short: the headline, four findings, and where to go next', () => {
  const html = body('index.html', { snapshot: committed });
  inOrder(html, ['class="sf-nav"', 'class="sf-intro"', 'data-sf-freshness', 'id="finding-loops"', 'id="finding-output"', 'id="finding-tools"', 'id="finding-code"', 'class="sf-more"']);
  assert.equal((html.match(/<article class="sf-panel sf-finding[ "]/g) ?? []).length, 4);
  const figures = [/<div class="sf-floor"/g, /<div class="sf-catalog"/g, /<svg class="sf-chart sf-chart-wide"/g].map((re) => (html.match(re) ?? []).length);
  assert.deepEqual(figures, [1, 1, 2], 'one figure to a finding');
  // Everything under a finding is on its own page, not folded away on this one.
  assert.doesNotMatch(html, /<table|<details|<form|sf-breakdown|sf-campaign|data-sf-detail|sf-live/);
  for (const sub of ['loops', 'tools', 'code', 'usage', 'methodology']) assert.ok(html.includes(`<a href="/software-factory/${sub}/">`), sub);
  assert.equal((html.match(/<h1/g) ?? []).length, 1);
});

test('each page under the overview leads with its own statement, and the usage page keeps the plan’s order', () => {
  const pages = render({ snapshot: committed });
  const of = (file) => pages.find((p) => p.path === file).body;
  for (const [file, id] of [['loops/index.html', 'sf-loops-title'], ['examples/index.html', 'sf-examples-title'], ['tools/index.html', 'sf-tools-title'], ['code/index.html', 'sf-code-title'], ['usage/index.html', 'sf-usage-title']]) {
    const html = of(file);
    assert.equal((html.match(/<h1/g) ?? []).length, 1, file);
    assert.match(html, new RegExp(`<h1 id="${id}">`), file);
    inOrder(html, ['class="sf-nav"', 'data-sf-freshness', `id="${id}"`]);
  }
  assert.match(of('loops/index.html'), /id="sf-live-title">Loops running now <span class="sf-tag">Not connected yet<\/span>/);
  inOrder(of('usage/index.html'), ['id="usage"', 'data-sf-filters', 'class="sf-summary"', 'id="trend"', 'class="sf-panel sf-observations"', 'id="output"', 'id="explore"']);
});

test('the navigation lists every page and marks the one it is on', () => {
  const pages = render({ snapshot: committed });
  assert.deepEqual(
    pages.map((p) => p.path),
    ['index.html', ...DATA_PAGES, 'analysis/index.html', 'methodology/index.html']
  );
  const hrefs = pages.map((p) => `/software-factory/${p.path.replace(/index\.html$/, '')}`);
  for (const [i, p] of pages.entries()) {
    const nav = p.body.match(/<nav class="sf-nav"[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? '';
    assert.deepEqual([...nav.matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]), hrefs, p.path);
    assert.deepEqual([...nav.matchAll(/<a href="([^"]+)" aria-current="page"/g)].map((m) => m[1]), [hrefs[i]], p.path);
  }
  // The pages that show numbers get the client script; the others don't.
  assert.deepEqual(pages.filter((p) => p.app).map((p) => p.path), ['index.html', ...DATA_PAGES]);
});

test('every link between the section’s pages lands on a page and an id that exist', () => {
  for (const snap of [snapshot, committed]) {
    const pages = render({ snapshot: snap, preview: true });
    const bodies = new Map(pages.map((p) => [`/software-factory/${p.path.replace(/index\.html$/, '')}`, p.body]));
    for (const [url, html] of bodies) {
      for (const [, href] of html.matchAll(/<a\b[^>]*\shref="([^"]*)"/g)) {
        if (/^https:/.test(href)) continue;
        const [target, id] = href.startsWith('#') ? [url, href.slice(1)] : href.split('#');
        assert.ok(target.startsWith('/'), `${url}: a relative link, ${href}`);
        if (target.startsWith('/software-factory/static-data/')) continue;
        assert.ok(bodies.has(target), `${url}: no page at ${href}`);
        if (id) assert.ok(bodies.get(target).includes(`id="${id}"`), `${url}: no id for ${href}`);
      }
    }
  }
});

test('stocks are labelled snapshot totals, apart from all-time period values', () => {
  const html = usage();
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
  assert.ok(usage().includes('Follows the date range only; the model and effort filters do not apply.'));
});

test('each observation links to its breakdown or records', () => {
  const html = usage();
  assert.match(html, /accounts for 69\.9% of estimated usage[\s\S]*?href="#breakdown-usage-by-model"/);
  assert.match(html, /href="#metric-cache_reuse"/);
  // Each card's definition leads to its full entry on the methodology page.
  for (const id of ['usage_usd', 'model_calls', 'cache_reuse', 'verification_completed'])
    assert.ok(html.includes(`<a href="/software-factory/methodology/#def-${id}">Methodology</a>`), id);
  assert.match(html, /href="#explore-verification"/);
  for (const target of ['id="breakdown-usage-by-model"', 'id="metric-cache_reuse"', 'id="explore-verification"']) assert.ok(html.includes(target));
});

test('days the data does not cover are no data, never a zero column', () => {
  const html = usage();
  // Usage covers Oct 30 to Nov 2; the overview's days run to Nov 8. Both shapes of the chart (wide, compact) agree.
  for (const shape of ['wide', 'compact']) {
    const svg = html.match(new RegExp(`<svg class="sf-chart sf-chart-${shape}"[\\s\\S]*?</svg>`))?.[0] ?? '';
    assert.equal((svg.match(/class="sf-day sf-day-none"/g) ?? []).length, 6, shape);
    assert.equal((svg.match(/class="sf-bar"/g) ?? []).length, 4, shape);
  }
  assert.match(html, /Nov 5, 2026<\/time><\/th><td><span class="sf-muted">No data<\/span>/);
});

test('deeper exploration links its records lazily, with raw ids and source', () => {
  const html = usage();
  assert.match(html, /data-sf-detail="changes" data-path="details\/changes\.json"/);
  assert.ok(html.includes(`href="/software-factory/static-data/snapshots/${snapshot.manifest.snapshotId}/details/verification.json"`));
  assert.ok(html.includes('7384f8c23eef441817ddb714c6ef5571cdc138bd'));
  assert.ok(html.includes(`<code>${snapshot.manifest.snapshotId}</code>`));
});

test('fixture data says so plainly on every page of numbers; real data has no banner', () => {
  for (const file of ['index.html', ...DATA_PAGES]) {
    assert.match(body(file, { fixture: true }), /class="sf-banner" role="note"><strong>Test fixture\.<\/strong>/, file);
    assert.doesNotMatch(body(file), /sf-banner/, file);
  }
});

test('with no snapshot: an honest message, the layout kept, posts still listed', () => {
  const input = { snapshot: null, unavailable: 'No Software Factory data has been published yet.', posts: { featured: null, items: [post('a-note')], related: [] } };
  const html = overview(input);
  // No page of numbers without numbers, and no link to one.
  assert.deepEqual(render(input).map((p) => p.path), ['index.html', 'analysis/index.html', 'methodology/index.html']);
  assert.doesNotMatch(everyBody(input), /software-factory\/(loops|tools|code|usage)\//);
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
  const section = html.slice(html.indexOf('id="analysis"'), html.indexOf('class="sf-more"'));
  assert.ok(html.indexOf('id="finding-code"') < html.indexOf('id="analysis"') || !html.includes('id="finding-code"'), 'after the findings');
  assert.doesNotMatch(html.slice(html.indexOf('class="sf-more"')), /sf-empty|Analysis &amp; notes/, 'no empty note beside real posts');
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
  const html = everyBody({
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
  const html = everyBody({ snapshot: hostile });
  assert.doesNotMatch(html, /" onmouseover=/);
  assert.ok(html.includes('x&quot; onmouseover=&quot;alert(1)'));
});

test('the overview names its catalog from the examples collection, and counts it without', () => {
  const stock = snapshot.overview.stocks.examples;
  // As in the catalog, one library change is entered but not run yet.
  const first = examples.find((x) => x.origin === 'real-world').id;
  const records = examples.map((x) => (x.id === first ? { ...x, verdictLabel: 'not run: a catalog entry, no proof verdict' } : x));
  const libraries = records.filter((x) => x.origin === 'real-world');
  const cells = (html) => html.match(/<span class="sf-cell [^>]*>/g) ?? [];
  // With the records: a square for each example in the catalog's order, named for the pointer, the library changes ringed.
  const named = overview({ examples: records });
  assert.match(named, /<h2 id="finding-output-title"><a href="\/software-factory\/examples\/">2 violations found and 3 changes verified, in a catalog of 11 examples<\/a><\/h2>/);
  assert.equal(cells(named).length, stock.total);
  assert.deepEqual(
    cells(named).map((c) => c.match(/sf-verdict-(\w+)/)[1]),
    examples.map((x) => x.verdict ?? 'none')
  );
  assert.equal(cells(named).filter((c) => c.includes('sf-cell-ring')).length, libraries.length);
  assert.ok(cells(named).every((c) => /data-tip="\d+ · /.test(c) && !c.includes('title=')), 'said once, for the pointer');
  assert.match(named, /data-tip="072 · Quorum: A vote rule[^"]*✓ Verified, vacuously[^"]*\(vacuous\)"/);
  assert.match(named, /A verified label is not a claim of a current, non-vacuous proof: 2 proofs are recorded as vacuous\./);
  assert.match(named, /href="\/software-factory\/methodology\/#def-examples_catalog"/);
  // Only a library change whose label records a result is listed by name.
  const listed = (named.match(/<div class="sf-catalog-list">[\s\S]*?<\/div>/) ?? [''])[0];
  const withResult = libraries.filter((x) => /[✓✗⚠]/.test(x.verdictLabel ?? ''));
  assert.equal(withResult.length, libraries.length - 1);
  assert.equal((listed.match(/<li>/g) ?? []).length, withResult.length);
  for (const x of withResult) assert.ok(listed.includes(`<strong>${escapeHtml(x.system)}</strong> ${escapeHtml(x.title)}`), x.id);
  assert.match(named, new RegExp(`<dt>are changes to published libraries; ${withResult.length} ha(s|ve) a result so far</dt><dd>${libraries.length}</dd>`));
  // Without them: the same count of squares, by verdict, none named, ringed or listed.
  const counted = overview();
  assert.equal(cells(counted).length, stock.total);
  assert.deepEqual(
    Object.fromEntries(['violation', 'verified', 'unverifiable', 'none'].map((k) => [k, cells(counted).filter((c) => c.includes(`sf-verdict-${k}`)).length])),
    { violation: stock.verdict.violation, verified: stock.verdict.verified, unverifiable: stock.verdict.unverifiable, none: stock.verdict.none }
  );
  assert.doesNotMatch(counted, /sf-cell-ring|sf-catalog-list|a result so far/);
  assert.match(counted, /Each square is an example, by verdict\./);
  // Records that are not this snapshot's catalog name nothing.
  assert.doesNotMatch(overview({ examples: examples.slice(1) }), /sf-cell-ring|sf-catalog-list/);
  // The committed snapshot's own records fit it.
  const { snapshot: s, examples: own } = loadSnapshot();
  assert.equal(own.length, s.overview.stocks.examples.total);
  assert.equal(cells(body('index.html', { snapshot: s, examples: own })).length, own.length);
});
