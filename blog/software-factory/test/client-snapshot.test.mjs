// Loading a snapshot in the browser (blog/assets/software-factory/snapshot.js):
// the remote snapshot or the bundled one whole, refusing one that fails its
// checks, conditional polling, and the details loaded on demand. A fake fetch
// serves the example snapshot. Run: npm run test:software-factory

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { computeMeasures } from '../measures.mjs';
import {
  checkManifest,
  checkOverview,
  checkPointer,
  firstSnapshot,
  loadCollection,
  loadSnapshot,
  newRecords,
  SnapshotError,
} from '../../assets/software-factory/snapshot.js';
import { fitState, parseState, queryOptions } from '../../assets/software-factory/state.js';
import { announcement } from '../../assets/software-factory/view.js';
import { validate } from '../validate.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(HERE, 'fixtures', 'snapshot-example');
const REMOTE = '/software-factory/data/';
const BUNDLED = '/software-factory/static-data/';

/** Every file of the example snapshot, by path relative to its root. */
function exampleFiles() {
  const files = {};
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else files[path.relative(DIR, full).split(path.sep).join('/')] = fs.readFileSync(full);
    }
  };
  walk(DIR);
  return files;
}
const EXAMPLE = exampleFiles();
const POINTER = JSON.parse(EXAMPLE['latest.json']);
const BASE = POINTER.manifest.replace(/manifest\.json$/, '');

/**
 * A fetch over { url: { status, body, etag } } routes; an unknown URL is a 404.
 * It records each request and answers 304 when If-None-Match matches.
 */
function fakeFetch(routes) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url, headers: init.headers ?? {} });
    if (init.signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    const r = routes[url];
    if (r instanceof Error) throw r;
    const route = r ?? { status: 404, body: 'Not found' };
    if (route.etag && init.headers?.['If-None-Match'] === route.etag) return new Response(null, { status: 304, headers: { ETag: route.etag } });
    const headers = route.etag ? { ETag: route.etag } : {};
    return new Response(route.status === 304 ? null : route.body, { status: route.status ?? 200, headers });
  };
  return { fetch, calls };
}

/** Routes serving a snapshot's files under a base. */
const serve = (base, files, etag = '"p1"') =>
  Object.fromEntries(Object.entries(files).map(([rel, body]) => [`${base}${rel}`, { status: 200, body, ...(rel === 'latest.json' ? { etag } : {}) }]));

/** The example with one file's bytes replaced (manifest unchanged). */
function tampered(rel, change) {
  return { ...EXAMPLE, [rel]: Buffer.from(change(EXAMPLE[rel].toString('utf8'))) };
}

const expectWhole = (snapshot) => {
  const id = snapshot.pointer.snapshotId;
  assert.equal(snapshot.manifest.snapshotId, id);
  assert.equal(snapshot.overview.snapshotId, id);
};

test('the remote snapshot is used when it is whole', async () => {
  const { fetch } = fakeFetch({ ...serve(REMOTE, EXAMPLE), ...serve(BUNDLED, EXAMPLE) });
  const r = await firstSnapshot({ remote: REMOTE, bundled: BUNDLED, fetch });
  assert.equal(r.source, 'remote');
  assert.equal(r.snapshot.base, REMOTE);
  assert.equal(r.etag, '"p1"');
  assert.equal(r.remoteError, null);
  expectWhole(r.snapshot);
});

test('a missing remote route falls back to the bundled snapshot, whole', async () => {
  for (const remoteRoutes of [{}, { [`${REMOTE}latest.json`]: { status: 200, body: '<!doctype html><title>Home</title>' } }]) {
    const { fetch } = fakeFetch({ ...remoteRoutes, ...serve(BUNDLED, EXAMPLE) });
    const r = await firstSnapshot({ remote: REMOTE, bundled: BUNDLED, fetch });
    assert.equal(r.source, 'bundled');
    assert.equal(r.snapshot.base, BUNDLED);
    assert.equal(r.remoteError.missing, true);
    expectWhole(r.snapshot);
  }
});

test('a remote error or network failure falls back, marked as transient', async () => {
  for (const failure of [{ status: 503, body: 'busy' }, new TypeError('Failed to fetch')]) {
    const { fetch } = fakeFetch({ [`${REMOTE}latest.json`]: failure, ...serve(BUNDLED, EXAMPLE) });
    const r = await firstSnapshot({ remote: REMOTE, bundled: BUNDLED, fetch });
    assert.equal(r.source, 'bundled');
    assert.equal(r.remoteError.missing, false);
  }
});

test('a remote snapshot that fails its checks is refused, and nothing of it is used', async () => {
  const other = 'sf1-0000000000000000';
  const cases = {
    'a changed overview byte (same length)': tampered(`${BASE}overview.json`, (s) => s.replace('"Fable 5.1"', '"Fable 9.1"')),
    'an overview of another snapshot': tampered(`${BASE}overview.json`, (s) => s.replace(POINTER.snapshotId, other)),
    'a pointer to a manifest that is not there': tampered('latest.json', (s) => s.replaceAll(POINTER.snapshotId, other)),
    'a pointer of the wrong schema': tampered('latest.json', (s) => s.replace('software-factory-pointer/v1', 'software-factory-pointer/v2')),
    'a manifest of another snapshot': tampered(`${BASE}manifest.json`, (s) => s.replace(`"snapshotId":"${POINTER.snapshotId}"`, `"snapshotId":"${other}"`)),
    'an overview that is not JSON': tampered(`${BASE}overview.json`, () => '{'),
  };
  const bundledOverview = JSON.parse(EXAMPLE[`${BASE}overview.json`]);
  for (const [name, files] of Object.entries(cases)) {
    const { fetch } = fakeFetch({ ...serve(REMOTE, files), ...serve(BUNDLED, EXAMPLE) });
    const r = await firstSnapshot({ remote: REMOTE, bundled: BUNDLED, fetch });
    assert.equal(r.source, 'bundled', name);
    assert.ok(r.remoteError instanceof SnapshotError, name);
    assert.equal(r.snapshot.base, BUNDLED, name);
    assert.deepEqual(r.snapshot.overview, bundledOverview, name);
    expectWhole(r.snapshot);
  }
});

test('with neither snapshot loadable, it fails rather than show a part', async () => {
  const { fetch } = fakeFetch({ ...serve(BUNDLED, tampered(`${BASE}overview.json`, (s) => s.replace('"high"', '"HIGH"'))) });
  await assert.rejects(firstSnapshot({ remote: REMOTE, bundled: BUNDLED, fetch }), SnapshotError);
});

test('first visit with filters set: the link’s filters apply to the bundled fallback', async () => {
  const { fetch } = fakeFetch({ [`${REMOTE}latest.json`]: { status: 502, body: '' }, ...serve(BUNDLED, EXAMPLE) });
  const search = '?period=7d&model=claude-opus-5-5&effort=high&measure=model_calls';
  const parsed = parseState(search); // before any data, as app.js does
  const r = await firstSnapshot({ remote: REMOTE, bundled: BUNDLED, fetch });
  assert.equal(r.source, 'bundled');
  const state = fitState(parsed, r.snapshot.overview);
  assert.deepEqual(state, { period: '7d', model: 'claude-opus-5-5', effort: 'high', measure: 'model_calls' });
  const opts = queryOptions(state, r.snapshot.overview);
  assert.deepEqual(opts, { from: '2026-11-02', to: '2026-11-09', models: ['claude-opus-5-5'], efforts: ['high'] });
  const filtered = Object.fromEntries(computeMeasures(r.snapshot.overview, opts).map((m) => [m.id, m]));
  const all = Object.fromEntries(computeMeasures(r.snapshot.overview).map((m) => [m.id, m]));
  assert.equal(filtered.model_calls.filtered, true);
  assert.ok(filtered.model_calls.value < all.model_calls.value, 'the filter narrows calls');
  assert.equal(filtered.verification_completed.value, 12, 'the date range only: all 12 jobs are in Nov 2–8');
});

test('an aborted first load stops instead of falling back', async () => {
  const { fetch } = fakeFetch({ ...serve(BUNDLED, EXAMPLE) });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(firstSnapshot({ remote: REMOTE, bundled: BUNDLED, fetch, signal: controller.signal }), { name: 'AbortError' });
});

test('the client checks refuse what validate.mjs refuses', () => {
  const pointer = POINTER;
  const manifest = JSON.parse(EXAMPLE[`${BASE}manifest.json`]);
  const overview = JSON.parse(EXAMPLE[`${BASE}overview.json`]);
  assert.deepEqual(checkPointer(pointer), []);
  assert.deepEqual(checkManifest(manifest, pointer), []);
  assert.deepEqual(checkOverview(overview, manifest), []);
  const without = (obj, key) => Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key));
  const cases = [
    ['pointer', { ...pointer, schema: 'x' }, (v) => checkPointer(v)],
    ['pointer', { ...pointer, snapshotId: 'sf1-XYZ' }, (v) => checkPointer(v)],
    ['pointer', without(pointer, 'lastSourceCheck'), (v) => checkPointer(v)],
    ['manifest', { ...manifest, timezone: 'UTC' }, (v) => checkManifest(v, pointer)],
    ['manifest', without(manifest, 'collections'), (v) => checkManifest(v, pointer)],
    ['manifest', { ...manifest, source: { ...manifest.source, sha: 'main' } }, (v) => checkManifest(v, pointer)],
    ['overview', without(overview, 'usage'), (v) => checkOverview(v, manifest)],
    ['overview', { ...overview, days: 'all' }, (v) => checkOverview(v, manifest)],
    ['overview', { ...overview, models: [{ id: 'x' }] }, (v) => checkOverview(v, manifest)],
    ['overview', { ...overview, schema: 'software-factory-overview/v0' }, (v) => checkOverview(v, manifest)],
    ['overview', { ...overview, insights: null }, (v) => checkOverview(v, manifest)],
  ];
  for (const [name, value, client] of cases) {
    assert.notDeepEqual(validate(name, value), [], `validate.mjs accepts ${name}`);
    assert.notDeepEqual(client(value), [], `the client accepts a ${name} validate.mjs refuses: ${JSON.stringify(validate(name, value)[0])}`);
  }
  // Where the build would never look: a collection path out of the snapshot.
  const escape = { ...manifest, collections: manifest.collections.map((c) => (c.name === 'sessions' ? { ...c, path: '../../latest.json' } : c)) };
  assert.notDeepEqual(checkManifest(escape, pointer), []);
});

test('polling is conditional, and an unchanged snapshot fetches nothing else', async () => {
  const { fetch, calls } = fakeFetch({ ...serve(REMOTE, EXAMPLE, '"e1"') });
  const first = await loadSnapshot(REMOTE, { fetch });
  assert.equal(first.status, 'new');
  assert.equal(calls.length, 3, 'pointer, manifest, overview');

  calls.length = 0;
  const again = await loadSnapshot(REMOTE, { fetch, etag: first.etag, current: first.snapshot });
  assert.deepEqual(again, { status: 'unchanged', etag: '"e1"' });
  assert.deepEqual(calls.map((c) => [c.url, c.headers['If-None-Match']]), [[`${REMOTE}latest.json`, '"e1"']]);

  // A new source check with the same snapshot: a 200 for the pointer only.
  calls.length = 0;
  const same = await loadSnapshot(REMOTE, { fetch, etag: '"old"', current: first.snapshot });
  assert.equal(same.status, 'same');
  assert.equal(calls.length, 1);
});

test('details load from the snapshot’s own base, checked', async () => {
  const { fetch, calls } = fakeFetch({ ...serve(REMOTE, EXAMPLE), ...serve(BUNDLED, EXAMPLE) });
  const { snapshot } = await loadSnapshot(REMOTE, { fetch });
  calls.length = 0;
  const changes = await loadCollection(snapshot, 'changes', { fetch });
  assert.equal(changes.records.length, 64);
  assert.deepEqual(calls.map((c) => c.url), [`${REMOTE}${BASE}details/changes.json`]);

  const bad = fakeFetch({ ...serve(REMOTE, tampered(`${BASE}details/changes.json`, (s) => s.replace('"area":"unassigned"', '"area":"unassignex"'))) });
  await assert.rejects(loadCollection(snapshot, 'changes', { fetch: bad.fetch }), /SHA-256 differs/);
  const missing = fakeFetch({});
  await assert.rejects(loadCollection(snapshot, 'sessions', { fetch: missing.fetch }), (err) => err.missing === true);
  await assert.rejects(loadCollection(snapshot, 'runtime', { fetch }), /not in this snapshot/);
});

test('a newer snapshot is announced with what it adds', () => {
  const manifest = JSON.parse(EXAMPLE[`${BASE}manifest.json`]);
  const grown = {
    ...manifest,
    collections: manifest.collections.map((c) => (c.name === 'changes' ? { ...c, records: 70 } : c.name === 'verification' ? { ...c, records: 13 } : c)),
  };
  const added = newRecords(manifest, grown);
  assert.deepEqual(added, [{ name: 'changes', added: 6 }, { name: 'verification', added: 1 }]);
  assert.equal(announcement(added, '2026-11-09'), 'New data published (as of Nov 9, 2026): 6 more recorded changes, 1 more verification result.');
  assert.equal(announcement([], null), 'New data published.');
});
