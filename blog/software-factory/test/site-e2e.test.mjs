// Milestone 1's end-to-end checks, on whole builds of temporary copies of the
// site: no draft reaches any production surface, the drafts build is noindex
// throughout, the section's four states render (empty analysis, populated on a
// published copy that is never committed, unavailable data, the fixture), and
// the existing posts and the project demo are what they were.
// Coordinator-owned. Run: npm run test:software-factory

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { formatValue } from '../../assets/software-factory/format.js';
import { buildCopy, handWritten, PROJECT_DIST, read, REPO, skip, texts } from './site-build.mjs';

const DRAFT = 'fable-5-1-vs-5-2';
const DRAFT_DIR = path.join(REPO, 'blog', 'posts', DRAFT);
const DRAFT_TITLE = read(path.join(DRAFT_DIR, 'index.md')).match(/^title: (.+)$/m)[1];
const EXAMPLE = path.join(REPO, 'blog', 'software-factory', 'test', 'fixtures', 'snapshot-example');
const NOINDEX = '<meta name="robots" content="noindex">';
const NAV = '<nav class="sections" aria-label="Sections"><a href="/software-factory/">Software Factory</a></nav>';
const NOTE = 'sf-e2e-note';
// The published post the populated copy marks related: software-factory.
const BACKGROUND = 'terminal-value-pipeline';

const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const files = (dir) => fs.readdirSync(dir, { recursive: true }).filter((f) => fs.statSync(path.join(dir, f)).isFile()).sort();
const page = (dist, route) => read(path.join(dist, route, 'index.html'));

// Each build once, shared by the tests that read it.
const builds = new Map();
const build = (name, options) => {
  if (!builds.has(name)) builds.set(name, buildCopy(options));
  return builds.get(name);
};
const production = () => build('production', { published: false });
const drafts = () => build('drafts', { published: false, drafts: true });

/** A published copy with one Software Factory post and one related post (never committed). */
const populated = () =>
  build('populated', {
    published: true,
    edit(root) {
      const posts = path.join(root, 'blog', 'posts');
      const dir = path.join(posts, NOTE);
      fs.mkdirSync(dir);
      fs.copyFileSync(path.join(posts, BACKGROUND, 'cover.png'), path.join(dir, 'cover.png'));
      fs.writeFileSync(
        path.join(dir, 'index.md'),
        '---\ntitle: An end-to-end note\ndate: 2026-11-15\ndescription: A post made by the end-to-end test.\n' +
          'image: cover.png\ncollection: software-factory\nauthor: Filip Stankovic\nfeatured: true\n---\n\nBody.\n'
      );
      const background = path.join(posts, BACKGROUND, 'index.md');
      fs.writeFileSync(background, read(background).replace(/^image: cover\.png$/m, '$&\nrelated: software-factory'));
    },
  });

/** Nothing of the draft, by name, title or content, anywhere in dist. */
function assertNoDraft(dist) {
  // The draft's own files: its placeholder cover is the templates' cover, which
  // a published post uses too, so a file a published post has doesn't count.
  const posts = path.join(REPO, 'blog', 'posts');
  const shared = new Set(
    fs.readdirSync(posts).filter((slug) => slug !== DRAFT).flatMap((slug) => files(path.join(posts, slug)).map((f) => sha(path.join(posts, slug, f))))
  );
  const draftHashes = new Set(files(DRAFT_DIR).map((f) => sha(path.join(DRAFT_DIR, f))).filter((h) => !shared.has(h)));
  assert.ok(draftHashes.size >= 2, "the draft's text and evidence at least");
  for (const f of files(dist)) {
    assert.ok(!f.includes(DRAFT), `${f} is named for the draft`);
    assert.ok(!draftHashes.has(sha(path.join(dist, f))), `${f} is a file of the draft`);
  }
  for (const [f, text] of texts(dist)) {
    assert.ok(!text.includes(DRAFT) && !text.includes(DRAFT_TITLE), `${f} names the draft`);
  }
}

test('no draft title, file or evidence reaches a production build, published or not', { skip }, () => {
  // The markers are real: the drafts build has the draft.
  assert.ok(page(drafts(), `posts/${DRAFT}`).includes(DRAFT_TITLE));
  assert.ok(fs.existsSync(path.join(drafts(), 'posts', DRAFT, 'evidence.json')));

  for (const dist of [production(), populated()]) {
    assertNoDraft(dist);
    for (const surface of ['index.html', 'feed.xml', 'sitemap.xml', 'llms.txt']) assert.ok(fs.existsSync(path.join(dist, surface)), surface);
    const folders = fs.readdirSync(path.join(dist, 'posts')).sort();
    const published = fs
      .readdirSync(path.join(REPO, 'blog', 'posts'))
      .filter((slug) => !/^draft: true$/m.test(read(path.join(REPO, 'blog', 'posts', slug, 'index.md'))));
    assert.deepEqual(folders.filter((f) => f !== NOTE), published.sort(), 'post folders are the published posts');
  }
  // Even the drafts build's section never lists the draft.
  for (const route of ['software-factory', 'software-factory/analysis', 'software-factory/methodology']) {
    assert.ok(!page(drafts(), route).includes(DRAFT), route);
  }
});

test('the drafts build is noindex throughout; production is not', { skip }, () => {
  const dist = drafts();
  const pages = files(dist).filter((f) => f.endsWith('.html'));
  // Hand-written pages keep their own head; the header below covers them.
  for (const f of pages.filter((f) => !f.startsWith('projects') && !handWritten(f))) assert.ok(read(path.join(dist, f)).includes(NOINDEX), f);
  // Every response, the data files and the project demo included, by header.
  assert.match(read(path.join(dist, '_headers')), /^\/\*\n {2}X-Robots-Tag: noindex\n/);
  assert.equal(read(path.join(dist, 'robots.txt')), 'User-agent: *\nDisallow: /\n');
  assert.ok(pages.some((f) => f.startsWith('software-factory/')), 'the section is in the drafts build');

  for (const prod of [production(), populated()]) {
    assert.doesNotMatch(read(path.join(prod, '_headers')), /X-Robots-Tag/);
    assert.match(read(path.join(prod, 'robots.txt')), /^User-agent: \*\nAllow: \/\n/);
    for (const [f, text] of texts(prod)) assert.ok(!text.includes(NOINDEX), f);
  }
});

test('empty analysis: real data, no post listed, the draft never', { skip }, () => {
  const dist = drafts();
  const overview = page(dist, 'software-factory');
  assert.match(overview, /Analysis &amp; notes by Filip<\/h2>\s*<p class="sf-empty">No analysis published yet\./);
  assert.match(page(dist, 'software-factory/analysis'), /<p class="sf-empty">No analysis published yet\./);
  // The committed snapshot's own numbers, whatever revision it was made from.
  const data = path.join(REPO, 'blog', 'software-factory', 'data');
  const committed = JSON.parse(read(path.join(data, path.dirname(JSON.parse(read(path.join(data, 'latest.json'))).manifest), 'overview.json')));
  const measure = (id) => committed.measures.find((m) => m.id === id).value;
  const said = [formatValue(measure('usage_usd'), 'usd'), formatValue(measure('model_calls'), 'calls'), `${formatValue(committed.loops.totals.toolCalls, 'calls')} tool calls`];
  assert.match(said.join(' '), /^\$[\d,]+\.\d\d [\d,]+ [\d,]+ tool calls$/);
  for (const text of said) assert.ok(overview.includes(text), `real numbers in the static HTML: ${text}`);
  for (const route of ['software-factory', 'software-factory/methodology']) {
    assert.doesNotMatch(page(dist, route), /sf-banner|sf-unavailable/, route);
  }
});

test('populated: a published copy lists its post, featured, and the related background apart', { skip }, () => {
  const dist = populated();
  const overview = page(dist, 'software-factory');
  const analysis = overview.slice(overview.indexOf('id="analysis"'), overview.indexOf('id="output"'));
  assert.match(analysis, new RegExp(`class="sf-post sf-post-featured"><img class="sf-cover" src="/posts/${NOTE}/cover\\.png"`));
  assert.match(analysis, new RegExp(`<a href="/posts/${NOTE}/">An end-to-end note</a>`));
  assert.match(analysis, /<span class="sf-byline">By Filip Stankovic<\/span>/);
  assert.doesNotMatch(analysis, /sf-empty/);

  const list = page(dist, 'software-factory/analysis');
  assert.match(list, new RegExp(`<h2><a href="/posts/${NOTE}/">An end-to-end note</a></h2>\\s*<p class="sf-post-meta"><strong class="sf-featured">Featured</strong> · <span class="sf-byline">By Filip Stankovic</span>`));
  const related = list.slice(list.indexOf('class="sf-panel sf-related"'));
  assert.match(related, /Related background/);
  assert.ok(related.includes(`/posts/${BACKGROUND}/`) && !related.includes(`/posts/${NOTE}/`));

  // The posts themselves stay canonical under /posts/, with byline and links.
  const note = page(dist, `posts/${NOTE}`);
  assert.match(note, /· By Filip Stankovic/);
  assert.match(note, /<a href="\/software-factory\/">Latest Software Factory data<\/a>/);
  assert.match(page(dist, `posts/${BACKGROUND}`), /<a href="\/software-factory\/analysis\/">More analysis in the Software Factory<\/a>/);
  assert.ok(!fs.existsSync(path.join(dist, 'software-factory', 'posts')), 'no copy of a post under the section');
  assert.match(read(path.join(dist, 'feed.xml')), new RegExp(`/posts/${NOTE}/`));
});

test('unavailable data: said plainly on the overview and methodology, with no client and no data copied', { skip }, () => {
  const bad = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-bad-'));
  try {
    fs.cpSync(path.join(REPO, 'blog', 'software-factory', 'data'), bad, { recursive: true });
    const pointer = JSON.parse(read(path.join(bad, 'latest.json')));
    const overviewFile = path.join(bad, path.dirname(pointer.manifest), 'overview.json');
    fs.appendFileSync(overviewFile, ' '); // its sha256 no longer matches the manifest
    const dist = buildCopy({ published: false, drafts: true, dataDir: bad });
    for (const route of ['software-factory', 'software-factory/methodology']) {
      const html = page(dist, route);
      assert.match(html, /<h2 id="sf-unavailable-title">Data unavailable<\/h2>\s*<p>The published data failed validation: /, route);
      assert.doesNotMatch(html, /\$1,936\.42|<script type="module"/, route);
      // Not the fixture banner either: the data dir was overridden, but no numbers are shown to label.
      assert.doesNotMatch(html, /sf-banner/, route);
    }
    assert.ok(!fs.existsSync(path.join(dist, 'software-factory', 'static-data')));
  } finally {
    fs.rmSync(bad, { recursive: true, force: true });
  }
});

test('fixture data: the banner on the data pages, never on real data', { skip }, () => {
  const dist = build('fixture', { published: false, drafts: true, dataDir: EXAMPLE });
  const banner = /<p class="sf-banner" role="note"><strong>Test fixture\.<\/strong>/;
  for (const route of ['software-factory', 'software-factory/methodology']) assert.match(page(dist, route), banner, route);
  assert.doesNotMatch(page(dist, 'software-factory/analysis'), banner, 'the analysis page shows no data');
  const pointer = JSON.parse(read(path.join(dist, 'software-factory', 'static-data', 'latest.json')));
  assert.deepEqual(pointer, JSON.parse(read(path.join(EXAMPLE, 'latest.json'))));
  for (const route of ['software-factory', 'software-factory/methodology']) assert.doesNotMatch(page(drafts(), route), banner, route);
});

test('existing posts and the project demo are unchanged by the section', { skip }, () => {
  const prod = production();
  for (const slug of fs.readdirSync(path.join(prod, 'posts'))) {
    for (const f of files(path.join(prod, 'posts', slug))) {
      const a = read(path.join(prod, 'posts', slug, f));
      for (const other of [drafts(), populated()]) {
        let b = read(path.join(other, 'posts', slug, f));
        if (f === 'index.html') {
          // The drafts build's noindex, the header link and a related post's
          // link back to the analysis are the only differences.
          b = b.replace(NOINDEX, '').replace(NAV, '');
          if (other === populated() && slug === BACKGROUND) b = b.replace('\n      <p class="source"><a href="/software-factory/analysis/">More analysis in the Software Factory</a></p>', '');
        } else if (other === populated() && slug === BACKGROUND && f === 'index.md') {
          b = b.replace('\nrelated: software-factory', '');
        }
        assert.equal(b, a, `${slug}/${f}`);
      }
    }
  }
  // The demo: its own build, plus the comparison page kept in blog/assets/.
  const extra = path.join(REPO, 'blog', 'assets', 'projects', 'terminal-value-pipeline');
  const expected = new Map([...files(extra).map((f) => [f, path.join(extra, f)]), ...files(PROJECT_DIST).map((f) => [f, path.join(PROJECT_DIST, f)])]);
  for (const dist of [prod, drafts(), populated()]) {
    const demo = path.join(dist, 'projects', 'terminal-value-pipeline');
    assert.deepEqual(files(demo), [...expected.keys()].sort());
    for (const [f, source] of expected) assert.equal(sha(path.join(demo, f)), sha(source), f);
  }
  // Hand-written pages, such as /prove-java-change/, and the files beside them: copied as they are.
  const assets = path.join(REPO, 'blog', 'assets');
  const pageDirs = files(assets).filter((f) => handWritten(f) && !f.startsWith('projects')).map(path.dirname);
  assert.ok(pageDirs.length >= 1, 'a hand-written page');
  for (const dir of pageDirs) {
    for (const f of files(path.join(assets, dir))) {
      for (const dist of [prod, drafts(), populated()]) assert.equal(sha(path.join(dist, dir, f)), sha(path.join(assets, dir, f)), `${dir}/${f}`);
    }
  }
});
