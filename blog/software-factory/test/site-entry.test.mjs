// The Software Factory's entry in the header and on the home page (site.mjs),
// checked on whole builds of a temporary copy of the site: unpublished, the
// production build has nothing of it; published (in the copy only, never
// committed), every page's header and the home page link the section.
// Coordinator-owned. Run: npm run test:software-factory

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { headerNav, homeEntry, STYLES } from '../site.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const PROJECT_DIST = path.join(REPO, 'projects', 'terminal-value-pipeline', 'dist');
const DRAFT = 'fable-5-1-vs-5-2';
const read = (file) => fs.readFileSync(file, 'utf8');

/** Builds a copy of blog/ with section.json's published set, and returns its dist/. */
const copies = [];
test.after(() => copies.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

function buildCopy({ published, drafts = false }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-site-'));
  copies.push(root);
  fs.cpSync(path.join(REPO, 'blog'), path.join(root, 'blog'), { recursive: true });
  fs.symlinkSync(path.join(REPO, 'node_modules'), path.join(root, 'node_modules'));
  fs.cpSync(PROJECT_DIST, path.join(root, 'projects', 'terminal-value-pipeline', 'dist'), { recursive: true });
  const config = path.join(root, 'blog', 'software-factory', 'config', 'section.json');
  fs.writeFileSync(config, `${JSON.stringify({ ...JSON.parse(read(config)), published }, null, 2)}\n`);
  const env = { ...process.env };
  delete env.SOFTWARE_FACTORY_DATA_DIR;
  execFileSync(process.execPath, ['blog/build.mjs', ...(drafts ? ['--drafts'] : [])], { cwd: root, env, stdio: 'pipe' });
  return path.join(root, 'dist');
}

/** Every text file in dir, as [relative path, contents]. */
function texts(dir) {
  return fs
    .readdirSync(dir, { recursive: true })
    .filter((f) => /\.(html|xml|txt|md|css|js)$/.test(f) || path.basename(f) === '_headers')
    .map((f) => [f, read(path.join(dir, f))]);
}

const canBuild = fs.existsSync(path.join(PROJECT_DIST, 'index.html'));
const skip = canBuild ? false : 'needs `npm run build:projects` first';

test('the header link names the section and marks its own pages', () => {
  assert.equal(
    headerNav('/posts/reading-the-trace/'),
    '<nav class="sections" aria-label="Sections"><a href="/software-factory/">Software Factory</a></nav>'
  );
  assert.match(headerNav('/software-factory/methodology/'), /<a href="\/software-factory\/" aria-current="true">Software Factory<\/a>/);
  assert.match(homeEntry(), /<a href="\/software-factory\/">Software Factory<\/a>\s*<p>What the software factory in in-the-loop produces/);
  for (const html of [headerNav('/'), homeEntry(), STYLES]) assert.doesNotMatch(html, /(?<!Software )Factory/);
});

test('unpublished, the production build has nothing of the entry', { skip }, () => {
  const dist = buildCopy({ published: false });
  assert.equal(read(path.join(dist, 'style.css')), read(path.join(REPO, 'blog', 'assets', 'style.css')));
  for (const [file, text] of texts(dist)) {
    if (file.startsWith('projects')) continue;
    assert.doesNotMatch(text, /software-factory|Software Factory|section-entry/, file);
  }
});

test('published, every page header and the home page link the section', { skip }, () => {
  const dist = buildCopy({ published: true });
  const home = read(path.join(dist, 'index.html'));
  assert.match(home, /<p class="tagline">[^<]*<\/p>\s*<aside class="section-entry" aria-label="Software Factory">/);
  assert.doesNotMatch(home, /<header class="site">/, 'the home page keeps no header');
  const pages = texts(dist).filter(([f]) => f.endsWith('.html') && f !== 'index.html' && !f.startsWith('projects'));
  assert.ok(pages.length >= 5, pages.map(([f]) => f).join(' '));
  for (const [file, html] of pages) {
    const inSection = file.startsWith('software-factory');
    assert.match(
      html,
      new RegExp(`<header class="site"><a href="/">Terminal Value</a><nav class="sections" aria-label="Sections"><a href="/software-factory/"${inSection ? ' aria-current="true"' : ''}>Software Factory</a></nav></header>`),
      file
    );
    assert.doesNotMatch(html, /noindex/, file);
  }
  assert.equal(read(path.join(dist, 'style.css')), read(path.join(REPO, 'blog', 'assets', 'style.css')) + STYLES);
  assert.match(read(path.join(dist, 'sitemap.xml')), /\/software-factory\/<\/loc>/);
  assert.ok(!fs.existsSync(path.join(dist, 'posts', DRAFT)), 'the draft stays out');
  for (const [file, text] of texts(dist)) assert.doesNotMatch(text, /Fable 5\.1 vs\. 5\.2|fable-5-1-vs-5-2/, file);
});

test('the drafts build previews the entry, noindex', { skip }, () => {
  const dist = buildCopy({ published: false, drafts: true });
  assert.match(read(path.join(dist, 'index.html')), /class="section-entry"/);
  const post = read(path.join(dist, 'posts', 'reading-the-trace', 'index.html'));
  assert.match(post, /<nav class="sections" aria-label="Sections"><a href="\/software-factory\/">Software Factory<\/a><\/nav>/);
  assert.match(post, /<meta name="robots" content="noindex">/);
});
