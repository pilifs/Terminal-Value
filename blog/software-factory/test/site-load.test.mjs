// What a first visit to the Software Factory overview loads, on a drafts build
// of a temporary copy of the site: the client module runs only on the
// overview, every module it imports is preloaded with it, and the first load
// stays within its budget (details load only when a reader opens one, so they
// are not counted). The plan's budget was about 150 KB gzip; on 2026-11-15 the
// author raised it to 300 KB, to be tuned later: data and page structure come
// before performance for now.
// Coordinator-owned. Run: npm run test:software-factory

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import zlib from 'node:zlib';
import { moduleGraph } from '../index.mjs';
import { buildCopy, read, skip } from './site-build.mjs';

const BUDGET = 300 * 1024;
const head = (html) => html.slice(0, html.indexOf('</head>'));
const scriptsOf = (html) => [...head(html).matchAll(/<script type="module" src="([^"]+)"/g)].map((m) => m[1]);
const preloadsOf = (html) => [...head(html).matchAll(/<link rel="modulepreload" href="([^"]+)"/g)].map((m) => m[1]);

test('moduleGraph follows static imports once each, in the order first met', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-graph-'));
  try {
    const files = {
      'app.js': "import {\n  a,\n  b,\n} from './a.js';\nimport './lib/c.js';\nconst later = () => import('./lazy.js');\n// import x from './comment.js'\n",
      'a.js': "import { c } from './lib/c.js';\nexport const a = 1, b = 2;\n",
      'lib/c.js': "import { a } from '../a.js';\nimport { d } from \"./d.js\";\nexport const c = 3;\n",
      'lib/d.js': 'export const d = 4;\n',
      'lazy.js': 'export {};\n',
    };
    for (const [name, text] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
      fs.writeFileSync(path.join(dir, name), text);
    }
    assert.deepEqual(moduleGraph(dir), ['a.js', 'lib/c.js', 'lib/d.js']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the pages that show numbers preload every module of the client, and only they run it', { skip }, () => {
  const dist = buildCopy({ published: false, drafts: true });
  const section = path.join(dist, 'software-factory');
  const overview = read(path.join(section, 'index.html'));
  assert.deepEqual(scriptsOf(overview), ['/software-factory/app.js']);
  const preloads = preloadsOf(overview);
  for (const href of preloads) assert.ok(fs.existsSync(path.join(dist, href)), href);
  // Every browser module the build ships is reached from app.js, so none is
  // left to a round trip after app.js arrives.
  const modules = fs.readdirSync(section).filter((f) => f.endsWith('.js') && f !== 'app.js');
  assert.deepEqual([...preloads].sort(), modules.map((f) => `/software-factory/${f}`).sort());
  for (const page of ['loops', 'tools', 'code', 'usage']) {
    const html = read(path.join(section, page, 'index.html'));
    assert.deepEqual(scriptsOf(html), ['/software-factory/app.js'], page);
    assert.deepEqual(preloadsOf(html), preloads, page);
  }
  for (const page of ['analysis', 'methodology']) {
    const html = read(path.join(section, page, 'index.html'));
    assert.deepEqual(scriptsOf(html), [], page);
    assert.deepEqual(preloadsOf(html), [], page);
  }

  // The first load: the page, its stylesheets and scripts, the pointer, the
  // manifest and the overview data.
  const pointer = JSON.parse(read(path.join(section, 'static-data', 'latest.json')));
  const snapshotDir = path.posix.dirname(pointer.manifest);
  const files = [
    'software-factory/index.html',
    ...[...head(overview).matchAll(/<link rel="stylesheet" href="\/([^"]+)"/g)].map((m) => m[1]),
    ...[...head(overview).matchAll(/<script [^>]*src="\/([^"]+)"/g)].map((m) => m[1]),
    ...preloads.map((href) => href.slice(1)),
    'software-factory/static-data/latest.json',
    `software-factory/static-data/${pointer.manifest}`,
    `software-factory/static-data/${snapshotDir}/overview.json`,
  ];
  assert.ok(files.includes('style.css') && files.includes('zoom.js'), files.join(' '));
  const gzip = files.reduce((sum, f) => sum + zlib.gzipSync(fs.readFileSync(path.join(dist, f))).length, 0);
  assert.ok(gzip < BUDGET, `first load ${gzip} bytes gzip, over ${BUDGET}`);
});

test('with no data to load, the overview carries no client module', { skip }, () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-nodata-'));
  try {
    const dist = buildCopy({ published: false, drafts: true, dataDir: empty });
    const overview = read(path.join(dist, 'software-factory', 'index.html'));
    assert.match(overview, /No Software Factory data has been published yet/);
    assert.deepEqual(scriptsOf(overview), []);
    assert.deepEqual(preloadsOf(overview), []);
  } finally {
    fs.rmSync(empty, { recursive: true, force: true });
  }
});
