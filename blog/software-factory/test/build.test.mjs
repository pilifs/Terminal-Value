// The build seams Phase 0 adds: drafts filtered before rendering, and the
// Software Factory section's gating and output. Run: npm run test:software-factory

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadPosts } from '../../posts.mjs';
import { buildSection, loadSnapshot } from '../index.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXAMPLE = path.join(HERE, 'fixtures', 'snapshot-example');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sf-build-'));

function postsDir() {
  const dir = tmp();
  const post = (slug, front) => {
    fs.mkdirSync(path.join(dir, slug));
    fs.writeFileSync(path.join(dir, slug, 'index.md'), `---\n${front}\n---\n\n![missing](nowhere.png)\n`);
  };
  post('published', 'title: P\ndate: 2026-11-01\ndescription: d');
  post('draft', 'title: D\ndate: 2026-11-02\ndescription: d\ndraft: true');
  return dir;
}

test('a production build never renders a draft', () => {
  const rendered = [];
  const render = (dir) => (rendered.push(path.basename(dir)), '<p></p>');
  const posts = loadPosts(postsDir(), { includeDrafts: false, render });
  assert.deepEqual(posts.map((p) => p.slug), ['published']);
  assert.deepEqual(rendered, ['published']);
});

test('a drafts build renders drafts too, newest first', () => {
  const posts = loadPosts(postsDir(), { includeDrafts: true, render: () => '' });
  assert.deepEqual(posts.map((p) => p.slug), ['draft', 'published']);
});

const helpers = { escapeHtml: (s) => String(s), formatDate: (s) => s, postImage: () => undefined };
const site = { url: 'https://example.invalid' };
const layout = (page) => `<!doctype html>${page.pageClass}|${page.canonical}|${page.body}`;

test('an unpublished section leaves a production build untouched', () => {
  const out = tmp();
  fs.mkdirSync(path.join(out, 'software-factory'));
  fs.writeFileSync(path.join(out, 'software-factory', 'style.css'), ''); // as copied from blog/assets
  const result = buildSection({ outDir: out, posts: [], includeDrafts: false, site, layout, helpers, published: false });
  assert.deepEqual(result, { sitemap: [], llms: [], headers: '' });
  assert.ok(!fs.existsSync(path.join(out, 'software-factory')));
});

test('a drafts build gets the section, kept out of the sitemap while unpublished', () => {
  const out = tmp();
  const result = buildSection({ outDir: out, posts: [], includeDrafts: true, site, layout, helpers, published: false });
  const html = fs.readFileSync(path.join(out, 'software-factory', 'index.html'), 'utf8');
  assert.match(html, /^<!doctype html>software-factory\|\/software-factory\/\|/);
  assert.ok(fs.existsSync(path.join(out, 'software-factory', 'measures.js')));
  assert.deepEqual(result.sitemap, []);
  assert.match(result.headers, /static-data\/snapshots\/\*\n {2}Cache-Control: public, max-age=31536000, immutable/);
});

test('a published section is listed in the sitemap and llms.txt', () => {
  const result = buildSection({ outDir: tmp(), posts: [], includeDrafts: false, site, layout, helpers, published: true });
  assert.deepEqual(result.sitemap, [
    '/software-factory/',
    '/software-factory/loops/',
    '/software-factory/examples/',
    '/software-factory/tools/',
    '/software-factory/code/',
    '/software-factory/usage/',
    '/software-factory/analysis/',
    '/software-factory/methodology/',
  ]);
  assert.match(result.llms[0], /^- \[Software Factory\]\(https:\/\/example\.invalid\/software-factory\/\)/);
});

test('a drafts build can show the example snapshot, copied whole as static data', () => {
  const out = tmp();
  process.env.SOFTWARE_FACTORY_DATA_DIR = EXAMPLE;
  try {
    buildSection({ outDir: out, posts: [], includeDrafts: true, site, layout, helpers, published: false });
  } finally {
    delete process.env.SOFTWARE_FACTORY_DATA_DIR;
  }
  assert.ok(fs.existsSync(path.join(out, 'software-factory', 'static-data', 'latest.json')));
});

test('missing or invalid data is reported, never replaced', () => {
  assert.match(loadSnapshot(tmp()).unavailable, /No Software Factory data/);
  const bad = tmp();
  fs.cpSync(EXAMPLE, bad, { recursive: true });
  fs.writeFileSync(path.join(bad, 'latest.json'), '{}');
  const { snapshot, unavailable } = loadSnapshot(bad);
  assert.equal(snapshot, null);
  assert.match(unavailable, /failed validation/);
  assert.equal(loadSnapshot(EXAMPLE).snapshot.overview.schema, 'software-factory-overview/v1');
});
