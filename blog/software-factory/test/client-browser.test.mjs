// The usage page in headless Chromium, on a first visit with filters set,
// while /software-factory/data/ fails in each way it can; then the overview
// and the other pages of numbers, which run the same client without filters. A drafts build of a
// temporary copy is served the way Pages serves it: static files, and the
// remote route through the real Pages Function
// (functions/software-factory/data/[[path]].js) on a fake bucket. The page must
// show one whole snapshot, the remote one or else the bundled one, with the
// link's filters applied, and load its detail records from the same place.
//
// Playwright is not a dependency of the site (llm-dlc/tools/screenshot.sh pins
// it and runs it with npx), so this file skips unless it can load it:
//   npm i --prefix /tmp/pw playwright@1.64.1 && llm-dlc/tools/screenshot.sh --setup
//   NODE_PATH=/tmp/pw/node_modules node --test blog/software-factory/test/client-browser.test.mjs
// No credentials, no network beyond localhost. Coordinator-owned.

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { formatValue } from '../../assets/software-factory/format.js';
import { fitState, parseState, queryOptions } from '../../assets/software-factory/state.js';
import { computeMeasures } from '../measures.mjs';
import { buildCopy, REPO, skip as buildSkip } from './site-build.mjs';

const FUNCTION = path.join(REPO, 'functions', 'software-factory', 'data', '[[path]].js');
const { serve } = await import(pathToFileURL(FUNCTION).href);

let playwright = null;
try {
  playwright = createRequire(import.meta.url)('playwright');
} catch {
  // Skipped below.
}
const skip = buildSkip || (playwright ? false : 'needs Playwright: NODE_PATH=<dir>/node_modules with playwright@1.64.1');

const REMOTE = '/software-factory/data/';
const BUNDLED = '/software-factory/static-data/';
const SEARCH = '?period=7d&model=claude-opus-5-5&measure=model_calls';
const PREVIEW = { SOFTWARE_FACTORY_ENVIRONMENT: 'preview' };

/** Every file under dir, by its path relative to dir. */
function filesOf(dir) {
  const files = {};
  for (const f of fs.readdirSync(dir, { recursive: true })) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isFile()) files[f.split(path.sep).join('/')] = new Uint8Array(fs.readFileSync(full));
  }
  return files;
}
const COMMITTED = filesOf(path.join(REPO, 'blog', 'software-factory', 'data'));
const EXAMPLE = filesOf(path.join(REPO, 'blog', 'software-factory', 'test', 'fixtures', 'snapshot-example'));
const json = (files, key) => JSON.parse(new TextDecoder().decode(files[key]));
const pointerOf = (files) => json(files, 'latest.json');
const snapDir = (files) => pointerOf(files).manifest.replace(/manifest\.json$/, '');
const overviewOf = (files) => json(files, `${snapDir(files)}overview.json`);
const ID = pointerOf(COMMITTED).snapshotId;
const EXAMPLE_ID = pointerOf(EXAMPLE).snapshotId;
assert.notEqual(ID, EXAMPLE_ID);

/** The four cards as the page must show them for SEARCH on this snapshot. */
function expectedCards(files) {
  const overview = overviewOf(files);
  const opts = queryOptions(fitState(parseState(SEARCH), overview), overview);
  return Object.fromEntries(
    computeMeasures(overview, opts)
      .filter((m) => ['usage_usd', 'model_calls', 'cache_reuse', 'verification_completed'].includes(m.id))
      .map((m) => [m.id, formatValue(m.value, m.unit)])
  );
}

/** R2's binding interface (get, head, httpEtag as quoted MD5), as site-function's tests use it. */
function fakeBucket(objects, { fail = false } = {}) {
  const meta = (key, bytes) => ({ key, size: bytes.byteLength, httpEtag: `"${crypto.createHash('md5').update(bytes).digest('hex')}"` });
  return {
    async head(key) {
      if (fail) throw new Error('R2 is down');
      return key in objects ? meta(key, objects[key]) : null;
    },
    async get(key) {
      if (fail) throw new Error('R2 is down');
      return key in objects ? { ...meta(key, objects[key]), body: new Response(objects[key]).body } : null;
    },
  };
}
const tamper = (files, key, edit) => ({ ...files, [key]: new TextEncoder().encode(edit(new TextDecoder().decode(files[key]))) });

/** What /software-factory/data/ does in each case: the Function, or a failure in front of it. */
const REMOTES = {
  'the Function, with the committed snapshot': { env: { ...PREVIEW, SOFTWARE_FACTORY_DATA: fakeBucket(COMMITTED) } },
  'the Function, with a different snapshot': { env: { ...PREVIEW, SOFTWARE_FACTORY_DATA: fakeBucket(EXAMPLE) } },
  'no Function: the static 404 page': { static404: true },
  'no binding (503)': { env: PREVIEW },
  'a failing bucket (503)': { env: { ...PREVIEW, SOFTWARE_FACTORY_DATA: fakeBucket(COMMITTED, { fail: true }) } },
  'an empty bucket (404)': { env: { ...PREVIEW, SOFTWARE_FACTORY_DATA: fakeBucket({}) } },
  'the gate: production while unpublished (404)': { env: { SOFTWARE_FACTORY_ENVIRONMENT: 'production', SOFTWARE_FACTORY_DATA: fakeBucket(COMMITTED) } },
  'a pointer with no snapshot': { env: { ...PREVIEW, SOFTWARE_FACTORY_DATA: fakeBucket({ 'latest.json': EXAMPLE['latest.json'] }) } },
  'a pointer that is not JSON': { env: { ...PREVIEW, SOFTWARE_FACTORY_DATA: fakeBucket({ ...EXAMPLE, 'latest.json': new TextEncoder().encode('{"schema":') }) } },
  'a pointer of another schema': {
    env: { ...PREVIEW, SOFTWARE_FACTORY_DATA: fakeBucket(tamper(EXAMPLE, 'latest.json', (s) => s.replace('pointer/v1', 'pointer/v2'))) },
  },
  'a manifest of another snapshot': {
    env: { ...PREVIEW, SOFTWARE_FACTORY_DATA: fakeBucket(tamper(EXAMPLE, `${snapDir(EXAMPLE)}manifest.json`, (s) => s.replace(`"snapshotId":"${EXAMPLE_ID}"`, `"snapshotId":"${ID}"`))) },
  },
  'an overview whose bytes differ from its manifest': {
    env: { ...PREVIEW, SOFTWARE_FACTORY_DATA: fakeBucket(tamper(EXAMPLE, `${snapDir(EXAMPLE)}overview.json`, (s) => s.replace('"high"', '"HIGH"'))) },
  },
  'an overview missing': {
    env: { ...PREVIEW, SOFTWARE_FACTORY_DATA: fakeBucket(Object.fromEntries(Object.entries(EXAMPLE).filter(([k]) => !k.endsWith('/overview.json')))) },
  },
  // The publisher hasn't caught up with the site: its snapshot lacks what the page draws.
  'a snapshot from an older version of the page’s generator': {
    env: {
      ...PREVIEW,
      SOFTWARE_FACTORY_DATA: fakeBucket(
        tamper(EXAMPLE, `${snapDir(EXAMPLE)}manifest.json`, (s) => {
          const manifest = JSON.parse(s);
          const mine = json(COMMITTED, `${snapDir(COMMITTED)}manifest.json`).generator;
          assert.ok(Number(mine.version) > 1, 'the committed snapshot’s generator has an older version');
          return JSON.stringify({ ...manifest, generator: { name: mine.name, version: String(Number(mine.version) - 1) } });
        })
      ),
    },
  },
  'an HTTP 500 in front of the Function': { status: 500 },
  'a dropped connection': { drop: true },
};

/** The drafts build served the way Pages serves it; the remote route as `remote` says. */
function startServer(dist) {
  const state = { remote: REMOTES['no binding (503)'] };
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const remote = state.remote;
    if (url.pathname.startsWith(REMOTE) && !remote.static404) {
      if (remote.drop) return req.socket.destroy();
      if (remote.hang) return; // never answers: the client's timeout
      if (remote.status) return res.writeHead(remote.status, { 'content-type': 'text/plain' }).end('error\n');
      const request = new Request(`http://localhost${req.url}`, { method: req.method, headers: req.headers });
      const response = await serve(request, remote.env);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      return res.end(Buffer.from(await response.arrayBuffer()));
    }
    let file = path.join(dist, decodeURIComponent(url.pathname));
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    const found = file.startsWith(dist) && fs.existsSync(file);
    const target = found ? file : path.join(dist, '404.html');
    res.writeHead(found ? 200 : 404, { 'content-type': types[path.extname(target)] ?? 'application/octet-stream' });
    res.end(fs.readFileSync(target));
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve({ server, state, origin: `http://127.0.0.1:${server.address().port}` }))
  );
}

/** Retries fn until it returns a truthy value, on Node's clock (the page's may be faked). */
async function until(fn, what, ms = 15_000) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

/** What the page shows once the client has drawn the view. */
const readPage = (page) =>
  page.evaluate(() => {
    const shell = document.querySelector('[data-sf-page]');
    const cards = Object.fromEntries([...document.querySelectorAll('[data-metric]')].map((c) => [c.dataset.metric, c.querySelector('[data-value]').textContent]));
    const value = (name) => document.querySelector(`[data-sf-filters] select[name="${name}"]`)?.value;
    return {
      snapshot: shell.dataset.snapshot,
      search: location.search,
      cards,
      controls: { period: value('period'), model: value('model'), effort: value('effort'), measure: document.querySelector('input[name="measure"]:checked')?.value },
      status: document.querySelector('[data-sf-static]')?.textContent ?? '',
      announcement: document.querySelector('.sf-update [data-text]')?.textContent ?? '',
      refreshShown: document.querySelector('[data-sf-refresh]')?.hidden === false,
    };
  });
const ready = (page) => page.evaluate(() => document.querySelector('[data-sf-filters]')?.hidden === false);

test('the pages of numbers in headless Chromium: first visit with filters, against each kind of remote failure', { skip, timeout: 240_000 }, async (t) => {
  const dist = buildCopy({ published: false, drafts: true });
  const { server, state, origin } = await startServer(dist);
  let browser;
  try {
    browser = await playwright.chromium.launch();
  } catch (err) {
    server.close();
    t.skip(`Chromium could not start (llm-dlc/tools/screenshot.sh --setup): ${err.message.split('\n')[0]}`);
    return;
  }
  const committed = expectedCards(COMMITTED);
  const example = expectedCards(EXAMPLE);
  assert.notDeepEqual(committed, example, 'the two snapshots tell apart');

  /** Opens SEARCH with the remote as given, and returns what the page shows and asked for. */
  async function visit(remote, { clock = false } = {}) {
    state.remote = remote;
    const context = await browser.newContext();
    const page = await context.newPage();
    if (clock) await page.clock.install();
    const errors = [];
    const requests = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => msg.type() === 'error' && !/Failed to load resource/.test(msg.text()) && errors.push(msg.text()));
    page.on('request', (req) => requests.push(new URL(req.url()).pathname));
    await page.goto(`${origin}/software-factory/usage/${SEARCH}`);
    await until(() => ready(page), 'the filters');
    return { context, page, errors, requests };
  }

  /** Opens a page that has no filters, and waits until the client has settled on a snapshot. */
  async function open(pathname, remote) {
    state.remote = remote;
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    const requests = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => msg.type() === 'error' && !/Failed to load resource/.test(msg.text()) && errors.push(msg.text()));
    page.on('request', (req) => requests.push(new URL(req.url()).pathname));
    await page.goto(`${origin}${pathname}`);
    // The tooltip is the last thing the client adds before it draws.
    await until(() => page.evaluate(() => Boolean(document.querySelector('.sf-tip')) && !document.querySelector('[data-tip] > title')), `the client on ${pathname}`);
    return { context, page, errors, requests };
  }

  /** Opens the sessions records and returns the base they came from. */
  async function sessionsBase(page, requests) {
    await page.click('#explore-sessions summary');
    await until(() => page.evaluate(() => document.querySelector('[data-sf-detail="sessions"]').dataset.loaded === 'yes'), 'the sessions records');
    const loaded = requests.filter((p) => p.endsWith('/details/sessions.json'));
    assert.equal(loaded.length, 1, 'one request for the records');
    return loaded[0].slice(0, loaded[0].indexOf('snapshots/'));
  }

  const controls = { period: '7d', model: 'claude-opus-5-5', effort: '', measure: 'model_calls' };
  try {
    for (const [name, remote] of Object.entries(REMOTES)) {
      await t.test(name, async () => {
        const { context, page, errors, requests } = await visit(remote);
        try {
          const shown = await readPage(page);
          const fromRemote = name.startsWith('the Function, with');
          const files = name === 'the Function, with a different snapshot' ? EXAMPLE : COMMITTED;
          assert.equal(shown.snapshot, pointerOf(files).snapshotId);
          assert.deepEqual(shown.cards, files === EXAMPLE ? example : committed, 'the link’s filters on one whole snapshot');
          assert.equal(shown.search, SEARCH, 'the link keeps its filters');
          assert.deepEqual(shown.controls, controls);
          assert.match(shown.status, /^Showing the last 7 days \(.+\), Opus 5\.5, all efforts\./);
          assert.deepEqual(errors, []);
          // The overview came from one base only, and the records from the same.
          const overviews = requests.filter((p) => p.endsWith('/overview.json'));
          const base = fromRemote ? REMOTE : BUNDLED;
          assert.equal(overviews.at(-1), `${base}${snapDir(files)}overview.json`);
          if (fromRemote) assert.deepEqual(requests.filter((p) => p.startsWith(BUNDLED)), [], 'the bundled copy is not touched');
          assert.equal(await sessionsBase(page, requests), base);
        } finally {
          await context.close();
        }
      });
    }

    await t.test('the overview and the pages under it: the bundled snapshot as built, nothing added to the address', async () => {
      for (const [pathname, name] of [['/software-factory/', 'overview'], ['/software-factory/loops/', 'loops'], ['/software-factory/tools/', 'tools'], ['/software-factory/code/', 'code']]) {
        const { context, page, errors } = await open(pathname, REMOTES['no binding (503)']);
        try {
          const shown = await page.evaluate(() => ({
            page: document.querySelector('[data-sf-page]').dataset.sfPage,
            snapshot: document.querySelector('[data-sf-page]').dataset.snapshot,
            url: location.pathname + location.search + location.hash,
            findings: document.querySelectorAll('.sf-finding').length,
            h1: document.querySelectorAll('h1').length,
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          }));
          assert.deepEqual(shown, { page: name, snapshot: ID, url: pathname, findings: name === 'overview' ? 3 : 0, h1: 1, overflow: 0 }, pathname);
          // Every run on one clock, on the overview and on the loops page: a run under the pointer says what it was.
          if (name === 'overview' || name === 'loops') {
            const run = page.locator('.sf-floor .sf-run').first();
            await run.scrollIntoViewIfNeeded();
            await run.hover();
            const floor = await page.evaluate(() => ({
              runs: document.querySelectorAll('.sf-floor .sf-run').length,
              names: document.querySelectorAll('.sf-floor-names a[href^="/software-factory/loops/#loop-"]').length,
              tip: document.querySelector('.sf-tip').hidden ? null : document.querySelector('.sf-tip').textContent,
              said: document.querySelector('.sf-floor .sf-run').dataset.tip,
            }));
            assert.ok(floor.runs > 1 && floor.names > 1, `${pathname}: ${JSON.stringify(floor)}`);
            assert.equal(floor.tip, floor.said, pathname);
            assert.match(floor.tip, /, from \w+ \d+, [\d:]+ [ap]m: \d+ cycles? and \d+ commits? in /);
          }
          assert.deepEqual(errors, [], pathname);
        } finally {
          await context.close();
        }
      }
    });

    await t.test('the overview on a different remote snapshot: every number on it is that snapshot’s', async () => {
      const { context, page, errors } = await open('/software-factory/', REMOTES['the Function, with a different snapshot']);
      try {
        const all = Object.fromEntries(overviewOf(EXAMPLE).measures.map((m) => [m.id, formatValue(m.value, m.unit)]));
        const shown = await page.evaluate(() => ({
          snapshot: document.querySelector('[data-sf-page]').dataset.snapshot,
          values: Object.fromEntries([...document.querySelectorAll('[data-sf-value]')].map((el) => [el.dataset.sfValue, el.textContent])),
          // The example has no loops, tools or code: no finding is claimed from the bundled data.
          findings: document.querySelectorAll('.sf-finding').length,
          headline: document.querySelector('.sf-headline')?.textContent ?? null,
        }));
        assert.deepEqual(shown, { snapshot: EXAMPLE_ID, values: { usage_usd: all.usage_usd, model_calls: all.model_calls }, findings: 0, headline: null });
        assert.deepEqual(errors, []);
      } finally {
        await context.close();
      }
    });

    await t.test('records load where a reader opens them: a campaign’s runs, every change as a dot, and a link from another page', async () => {
      const remote = REMOTES['no binding (503)'];
      let visit = await open('/software-factory/loops/', remote);
      try {
        await visit.page.click('[data-sf-campaign] > summary');
        await until(() => visit.page.evaluate(() => document.querySelectorAll('[data-sf-campaign][open] .sf-run-detail').length > 0), 'a campaign’s runs');
        assert.equal(visit.requests.filter((p) => p.endsWith('/details/loops.json')).length, 1);
        assert.deepEqual(visit.errors, []);
      } finally {
        await visit.context.close();
      }
      visit = await open('/software-factory/code/', remote);
      try {
        await visit.page.click('[data-sf-change-plot] > summary');
        await until(() => visit.page.evaluate(() => document.querySelectorAll('[data-sf-change-plot] .sf-chart-wide .sf-dot').length > 100), 'the dots');
        // The page's own link to the records opens them on the usage page.
        const href = await visit.page.evaluate(() => document.querySelector('a[href$="usage/#explore-changes"]').getAttribute('href'));
        assert.equal(href, '/software-factory/usage/#explore-changes');
        assert.deepEqual(visit.errors, []);
      } finally {
        await visit.context.close();
      }
      visit = await open('/software-factory/usage/#explore-changes', remote);
      try {
        await until(() => visit.page.evaluate(() => document.querySelector('[data-sf-detail="changes"]').dataset.loaded === 'yes'), 'the changes, opened by the link');
        assert.equal(await visit.page.evaluate(() => location.hash), '#explore-changes');
        assert.deepEqual(visit.errors, []);
      } finally {
        await visit.context.close();
      }
    });

    await t.test('a remote that never answers: the bundled snapshot after the timeout', async () => {
      const { context, page, errors } = await visit({ hang: true });
      try {
        const shown = await readPage(page);
        assert.equal(shown.snapshot, ID);
        assert.deepEqual(shown.cards, committed);
        assert.deepEqual(errors, []);
      } finally {
        await context.close();
      }
    });

    await t.test('after a fallback, polling keeps the view through an error and announces new remote data', async () => {
      const { context, page, errors, requests } = await visit(REMOTES['no binding (503)'], { clock: true });
      try {
        assert.equal((await readPage(page)).snapshot, ID);
        const polls = () => requests.filter((p) => p === `${REMOTE}latest.json`).length;
        const before = polls();
        // A poll that fails changes nothing on screen.
        state.remote = REMOTES['an HTTP 500 in front of the Function'];
        await page.clock.runFor(46_000);
        await until(() => polls() > before, 'a poll of the remote pointer');
        await page.clock.runFor(1_000);
        let shown = await readPage(page);
        assert.deepEqual(shown.cards, committed);
        assert.equal(shown.refreshShown, false);
        // The remote comes back with other data: announced, shown only when asked.
        state.remote = REMOTES['the Function, with a different snapshot'];
        await page.clock.runFor(46_000);
        await until(async () => (await readPage(page)).refreshShown, 'the announcement');
        shown = await readPage(page);
        assert.match(shown.announcement, /^New data published/);
        assert.deepEqual(shown.cards, committed, 'nothing moves before the reader asks');
        await page.click('[data-sf-refresh]');
        shown = await readPage(page);
        assert.equal(shown.snapshot, EXAMPLE_ID);
        assert.deepEqual(shown.cards, example, 'the new snapshot under the same filters');
        assert.equal(shown.search, SEARCH);
        assert.deepEqual(shown.controls, controls);
        assert.equal(await sessionsBase(page, requests), REMOTE);
        assert.deepEqual(errors, []);
      } finally {
        await context.close();
      }
    });

    await t.test('an empty bucket: polling stays on the remote and announces the first publish', async () => {
      const { context, page, errors, requests } = await visit(REMOTES['an empty bucket (404)'], { clock: true });
      try {
        assert.equal((await readPage(page)).snapshot, ID);
        const polls = () => requests.filter((p) => p === `${REMOTE}latest.json`).length;
        const before = polls();
        state.remote = REMOTES['the Function, with a different snapshot'];
        await page.clock.runFor(46_000);
        await until(() => polls() > before, 'a poll of the remote pointer');
        await until(async () => (await readPage(page)).refreshShown, 'the announcement');
        await page.click('[data-sf-refresh]');
        const shown = await readPage(page);
        assert.equal(shown.snapshot, EXAMPLE_ID);
        assert.deepEqual(shown.cards, example);
        assert.deepEqual(errors, []);
      } finally {
        await context.close();
      }
    });

    await t.test('without a Function route, polling goes to the bundled pointer', async () => {
      const { context, page, requests } = await visit(REMOTES['no Function: the static 404 page'], { clock: true });
      try {
        const remoteBefore = requests.filter((p) => p.startsWith(REMOTE)).length;
        const bundledPolls = () => requests.filter((p) => p === `${BUNDLED}latest.json`).length;
        const before = bundledPolls();
        await page.clock.runFor(46_000);
        await until(() => bundledPolls() > before, 'a poll of the bundled pointer');
        assert.equal(requests.filter((p) => p.startsWith(REMOTE)).length, remoteBefore);
      } finally {
        await context.close();
      }
    });
  } finally {
    await browser.close();
    server.close();
  }
});
