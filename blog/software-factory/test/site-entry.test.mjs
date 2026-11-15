// The Software Factory's entry in the header and on the home page (site.mjs),
// checked on whole builds of a temporary copy of the site: unpublished, the
// production build has nothing of it; published (in the copy only, never
// committed), every page's header and the home page link the section.
// Coordinator-owned. Run: npm run test:software-factory

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { headerNav, homeEntry, STYLES } from '../site.mjs';
import { buildCopy, read, REPO, skip, texts } from './site-build.mjs';

const DRAFT = 'fable-5-1-vs-5-2';

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
