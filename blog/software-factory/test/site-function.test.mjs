// The Pages Function that serves the published data from R2
// (functions/software-factory/data/[[path]].js), against a fake bucket binding
// with R2's interface: get, head, httpEtag, size, body. It checks the path
// limits, the methods, caching and ETags, the failures, the unpublished gate,
// and the browser module loading through it. No credentials, no network.
// Coordinator-owned. Run: npm run test:software-factory

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { firstSnapshot, loadCollection, loadSnapshot } from '../../assets/software-factory/snapshot.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const FUNCTION = path.join(ROOT, 'functions', 'software-factory', 'data', '[[path]].js');
const { serve, onRequest, keyFor, etagMatches, POINTER_CACHE, SNAPSHOT_CACHE } = await import(pathToFileURL(FUNCTION).href);
const SECTION = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'config', 'section.json'), 'utf8'));

const DATA = path.join(HERE, '..', 'data');
const ORIGIN = 'https://terminalvalue.test';
const REMOTE = '/software-factory/data/';
const BUNDLED = '/software-factory/static-data/';
const PREVIEW = { SOFTWARE_FACTORY_ENVIRONMENT: 'preview' };

/** Every file under dir, by its path relative to dir. */
function filesOf(dir) {
  const files = {};
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else files[path.relative(dir, full).split(path.sep).join('/')] = new Uint8Array(fs.readFileSync(full));
    }
  };
  walk(dir);
  return files;
}
const COMMITTED = filesOf(DATA);
const POINTER = JSON.parse(new TextDecoder().decode(COMMITTED['latest.json']));
const SNAP = POINTER.manifest.replace(/manifest\.json$/, '');

/**
 * A bucket with R2's binding interface. Like R2 for a single-part upload, the
 * ETag is the MD5 of the content, quoted. It records every call, and can be
 * made to throw.
 */
function fakeBucket(objects = {}, { fail = false } = {}) {
  const calls = [];
  const cancelled = [];
  const meta = (key, bytes) => ({
    key,
    size: bytes.byteLength,
    etag: crypto.createHash('md5').update(bytes).digest('hex'),
    get httpEtag() {
      return `"${this.etag}"`;
    },
  });
  return {
    calls,
    cancelled,
    objects,
    async head(key) {
      calls.push(['head', key]);
      if (fail) throw new Error('R2 is down');
      return key in objects ? meta(key, objects[key]) : null;
    },
    async get(key) {
      calls.push(['get', key]);
      if (fail) throw new Error('R2 is down');
      if (!(key in objects)) return null;
      const body = new Response(objects[key]).body;
      const cancel = body.cancel.bind(body);
      body.cancel = (reason) => {
        cancelled.push(key);
        return cancel(reason);
      };
      return { ...meta(key, objects[key]), httpEtag: meta(key, objects[key]).httpEtag, body };
    },
  };
}

const request = (pathname, { method = 'GET', headers = {} } = {}) => new Request(`${ORIGIN}${pathname}`, { method, headers });
const bytesOf = async (res) => new Uint8Array(await res.arrayBuffer());

test('only the pointer and the files of the published layout have a key', () => {
  const id = POINTER.snapshotId;
  const allowed = {
    '/software-factory/data/latest.json': 'latest.json',
    [`/software-factory/data/snapshots/${id}/manifest.json`]: `snapshots/${id}/manifest.json`,
    [`/software-factory/data/snapshots/${id}/overview.json`]: `snapshots/${id}/overview.json`,
  };
  for (const name of ['sessions', 'changes', 'verification', 'examples'])
    allowed[`/software-factory/data/snapshots/${id}/details/${name}.json`] = `snapshots/${id}/details/${name}.json`;
  for (const [pathname, key] of Object.entries(allowed)) assert.equal(keyFor(pathname), key, pathname);

  for (const pathname of [
    '/software-factory/data/',
    '/software-factory/data',
    '/software-factory/latest.json',
    '/software-factory/static-data/latest.json',
    '/software-factory/data/latest.json/',
    '/software-factory/data/LATEST.json',
    '/software-factory/data//latest.json',
    '/software-factory/data/latest.json.bak',
    '/software-factory/data/latest',
    '/software-factory/data/snapshots/',
    `/software-factory/data/snapshots/${id}/`,
    `/software-factory/data/snapshots/${id}/manifest.json/x`,
    `/software-factory/data/snapshots/${id}/details/`,
    `/software-factory/data/snapshots/${id}/details/runs.json`,
    `/software-factory/data/snapshots/${id}/details/sessions.jsonl`,
    `/software-factory/data/snapshots/${id}/sessions.json`,
    `/software-factory/data/snapshots/${id}/details/../manifest.json`,
    `/software-factory/data/snapshots/${id}%2Fmanifest.json`,
    `/software-factory/data/snapshots/${id.toUpperCase()}/manifest.json`,
    '/software-factory/data/snapshots/sf1-95bf08f3ebdea3f/manifest.json',
    '/software-factory/data/snapshots/sf2-95bf08f3ebdea3fa/manifest.json',
    '/software-factory/data/snapshots/latest.json',
    '/software-factory/data/traces/session.jsonl',
    '/software-factory/data/%6Catest.json',
  ])
    assert.equal(keyFor(pathname), null, pathname);
});

test('If-None-Match is compared the weak way, as RFC 9110 asks', () => {
  assert.ok(etagMatches('"abc"', '"abc"'));
  assert.ok(etagMatches('W/"abc"', '"abc"'), 'the edge may weaken an ETag when it compresses');
  assert.ok(etagMatches('"x", W/"abc" ,"y"', '"abc"'));
  assert.ok(etagMatches('*', '"abc"'));
  assert.ok(!etagMatches('"abd"', '"abc"'));
  assert.ok(!etagMatches('abc', '"abc"'));
  assert.ok(!etagMatches(null, '"abc"'));
  assert.ok(!etagMatches('', '"abc"'));
});

test('latest.json: the bucket’s bytes, no-cache and a strong ETag', async () => {
  const bucket = fakeBucket(COMMITTED);
  const res = await serve(request('/software-factory/data/latest.json'), { ...PREVIEW, SOFTWARE_FACTORY_DATA: bucket });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Cache-Control'), POINTER_CACHE);
  assert.equal(POINTER_CACHE, 'no-cache');
  assert.equal(res.headers.get('Content-Type'), 'application/json; charset=utf-8');
  assert.equal(res.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(res.headers.get('X-Robots-Tag'), 'noindex');
  const etag = res.headers.get('ETag');
  assert.match(etag, /^"[0-9a-f]{32}"$/, 'strong: quoted, no W/');
  assert.equal(etag, `"${crypto.createHash('md5').update(COMMITTED['latest.json']).digest('hex')}"`);
  assert.deepEqual(await bytesOf(res), COMMITTED['latest.json']);
  assert.deepEqual(bucket.calls, [['get', 'latest.json']]);
});

test('latest.json: 304 with no body when If-None-Match matches, 200 once it changes', async () => {
  const bucket = fakeBucket({ ...COMMITTED });
  const env = { ...PREVIEW, SOFTWARE_FACTORY_DATA: bucket };
  const first = await serve(request('/software-factory/data/latest.json'), env);
  const etag = first.headers.get('ETag');
  await first.arrayBuffer();

  for (const header of [etag, `W/${etag}`, `"other", ${etag}`, '*']) {
    const res = await serve(request('/software-factory/data/latest.json', { headers: { 'If-None-Match': header } }), env);
    assert.equal(res.status, 304, header);
    assert.equal(res.body, null);
    assert.equal(res.headers.get('ETag'), etag);
    assert.equal(res.headers.get('Cache-Control'), 'no-cache');
  }
  assert.equal(bucket.cancelled.length, 4, 'the unread body of each 304 is cancelled');

  // A publish replaces the pointer: the old ETag no longer matches.
  const next = { ...POINTER, lastSourceCheck: { ...POINTER.lastSourceCheck, at: '2026-11-15T00:00:00Z' } };
  bucket.objects['latest.json'] = new TextEncoder().encode(`${JSON.stringify(next)}\n`);
  const res = await serve(request('/software-factory/data/latest.json', { headers: { 'If-None-Match': etag } }), env);
  assert.equal(res.status, 200);
  assert.notEqual(res.headers.get('ETag'), etag);
  assert.deepEqual(JSON.parse(await res.text()), next);
});

test('snapshot files: the bucket’s bytes, cached a year as immutable', async () => {
  const bucket = fakeBucket(COMMITTED);
  const env = { ...PREVIEW, SOFTWARE_FACTORY_DATA: bucket };
  const keys = Object.keys(COMMITTED).filter((k) => k.startsWith('snapshots/'));
  assert.equal(keys.length, 6, 'manifest, overview and four details');
  for (const key of keys) {
    const res = await serve(request(`${REMOTE}${key}`), env);
    assert.equal(res.status, 200, key);
    assert.equal(res.headers.get('Cache-Control'), SNAPSHOT_CACHE);
    assert.equal(SNAPSHOT_CACHE, 'public, max-age=31536000, immutable');
    assert.equal(res.headers.get('Content-Type'), 'application/json; charset=utf-8');
    assert.match(res.headers.get('ETag'), /^"[0-9a-f]{32}"$/);
    assert.deepEqual(await bytesOf(res), COMMITTED[key], key);
    const again = await serve(request(`${REMOTE}${key}`, { headers: { 'If-None-Match': res.headers.get('ETag') } }), env);
    assert.equal(again.status, 304, key);
    assert.equal(again.headers.get('Cache-Control'), SNAPSHOT_CACHE);
  }
});

test('HEAD: the headers and length, no body, and the bucket’s head, not get', async () => {
  const bucket = fakeBucket(COMMITTED);
  const env = { ...PREVIEW, SOFTWARE_FACTORY_DATA: bucket };
  const key = `${SNAP}overview.json`;
  for (const [k, cache] of [['latest.json', 'no-cache'], [key, SNAPSHOT_CACHE]]) {
    const res = await serve(request(`${REMOTE}${k}`, { method: 'HEAD' }), env);
    assert.equal(res.status, 200);
    assert.equal(res.body, null);
    assert.equal(res.headers.get('Cache-Control'), cache);
    assert.equal(res.headers.get('Content-Length'), String(COMMITTED[k].byteLength));
    assert.match(res.headers.get('ETag'), /^"[0-9a-f]{32}"$/);
  }
  const etag = `"${crypto.createHash('md5').update(COMMITTED['latest.json']).digest('hex')}"`;
  const cond = await serve(request(`${REMOTE}latest.json`, { method: 'HEAD', headers: { 'If-None-Match': etag } }), env);
  assert.equal(cond.status, 304);
  assert.deepEqual(bucket.calls.map(([m]) => m), ['head', 'head', 'head']);
});

test('not a gateway: any other path is 404 without touching the bucket, whatever it holds', async () => {
  const bucket = fakeBucket({
    ...COMMITTED,
    'secret.txt': new TextEncoder().encode('not for the public'),
    'traces/session.jsonl': new TextEncoder().encode('{}\n'),
    [`${SNAP}details/runs.json`]: new TextEncoder().encode('{}\n'),
    [`${SNAP}raw/input.json`]: new TextEncoder().encode('{}\n'),
  });
  const env = { ...PREVIEW, SOFTWARE_FACTORY_DATA: bucket };
  for (const pathname of [
    '/software-factory/data/secret.txt',
    '/software-factory/data/traces/session.jsonl',
    `/software-factory/data/${SNAP}details/runs.json`,
    `/software-factory/data/${SNAP}raw/input.json`,
    '/software-factory/data/',
    '/software-factory/data/latest.json/',
    `/software-factory/data/${SNAP.replace(/\/$/, '%2F')}manifest.json`,
  ]) {
    const res = await serve(request(pathname), env);
    assert.equal(res.status, 404, pathname);
    assert.equal(res.headers.get('Cache-Control'), 'no-store');
    assert.match(res.headers.get('Content-Type'), /^text\/plain/);
  }
  // The URL parser resolves dot segments first: what's left is outside the
  // route or not a published file.
  for (const pathname of ['/software-factory/data/../data/secret.txt', `/software-factory/data/${SNAP}details/%2e%2e/%2e%2e/../secret.txt`]) {
    const res = await serve(request(pathname), env);
    assert.equal(res.status, 404, pathname);
  }
  assert.deepEqual(bucket.calls, []);
});

test('methods other than GET and HEAD: 405 with Allow, without touching the bucket', async () => {
  const bucket = fakeBucket(COMMITTED);
  const env = { ...PREVIEW, SOFTWARE_FACTORY_DATA: bucket };
  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']) {
    const init = { method, ...(['POST', 'PUT', 'PATCH'].includes(method) ? { body: '{}' } : {}) };
    const res = await serve(new Request(`${ORIGIN}/software-factory/data/latest.json`, init), env);
    assert.equal(res.status, 405, method);
    assert.equal(res.headers.get('Allow'), 'GET, HEAD');
  }
  assert.deepEqual(bucket.calls, []);
});

test('a missing object is 404, a missing binding or a failing bucket 503, never cached', async () => {
  const empty = await serve(request('/software-factory/data/latest.json'), { ...PREVIEW, SOFTWARE_FACTORY_DATA: fakeBucket({}) });
  assert.equal(empty.status, 404);
  const missingFile = await serve(request(`/software-factory/data/snapshots/sf1-0123456789abcdef/manifest.json`), { ...PREVIEW, SOFTWARE_FACTORY_DATA: fakeBucket(COMMITTED) });
  assert.equal(missingFile.status, 404);
  assert.equal(missingFile.headers.get('Cache-Control'), 'no-store', 'a file published later must not stay 404 in a cache');
  for (const env of [PREVIEW, { ...PREVIEW, SOFTWARE_FACTORY_DATA: {} }, { ...PREVIEW, SOFTWARE_FACTORY_DATA: fakeBucket(COMMITTED, { fail: true }) }]) {
    for (const method of ['GET', 'HEAD']) {
      const res = await serve(request('/software-factory/data/latest.json', { method }), env);
      assert.equal(res.status, 503);
      assert.equal(res.headers.get('Cache-Control'), 'no-store');
    }
  }
});

test('unpublished, only a preview deployment serves; production answers 404 as if there were no section', async () => {
  for (const env of [{}, { SOFTWARE_FACTORY_ENVIRONMENT: 'production' }, { SOFTWARE_FACTORY_ENVIRONMENT: 'Preview' }]) {
    const bucket = fakeBucket(COMMITTED);
    const res = await serve(request('/software-factory/data/latest.json'), { ...env, SOFTWARE_FACTORY_DATA: bucket }, { published: false });
    assert.equal(res.status, 404, JSON.stringify(env));
    assert.deepEqual(bucket.calls, []);
  }
  const preview = await serve(request('/software-factory/data/latest.json'), { ...PREVIEW, SOFTWARE_FACTORY_DATA: fakeBucket(COMMITTED) }, { published: false });
  assert.equal(preview.status, 200);
  const published = await serve(request('/software-factory/data/latest.json'), { SOFTWARE_FACTORY_ENVIRONMENT: 'production', SOFTWARE_FACTORY_DATA: fakeBucket(COMMITTED) }, { published: true });
  assert.equal(published.status, 200);

  // The entry point reads config/section.json, which says published: false.
  assert.equal(SECTION.published, false);
  const ctx = (env) => ({ request: request('/software-factory/data/latest.json'), env: { ...env, SOFTWARE_FACTORY_DATA: fakeBucket(COMMITTED) } });
  assert.equal((await onRequest(ctx({ SOFTWARE_FACTORY_ENVIRONMENT: 'production' }))).status, 404);
  assert.equal((await onRequest(ctx(PREVIEW))).status, 200);
});

/**
 * The browser's view: /software-factory/data/ goes through the Function and
 * its bucket, /software-factory/static-data/ is the bundled copy.
 */
function siteFetch(bucket, bundled = COMMITTED) {
  const env = { ...PREVIEW, SOFTWARE_FACTORY_DATA: bucket };
  return async (url, init = {}) => {
    if (url.startsWith(REMOTE)) return serve(new Request(`${ORIGIN}${url}`, { headers: init.headers ?? {} }), env);
    if (url.startsWith(BUNDLED)) {
      const bytes = bundled[url.slice(BUNDLED.length)];
      return bytes ? new Response(bytes, { headers: { 'Content-Type': 'application/json' } }) : new Response('Not found', { status: 404 });
    }
    return new Response('Not found', { status: 404 });
  };
}

test('the browser module loads the remote snapshot through the Function, and polls with its ETag', async () => {
  const bucket = fakeBucket({ ...COMMITTED });
  const fetch = siteFetch(bucket);
  const first = await firstSnapshot({ remote: REMOTE, bundled: BUNDLED, fetch });
  assert.equal(first.source, 'remote');
  assert.equal(first.remoteError, null);
  assert.equal(first.snapshot.pointer.snapshotId, POINTER.snapshotId);
  assert.match(first.etag, /^"[0-9a-f]{32}"$/);
  // The checks against the manifest passed on the bytes the Function served.
  const sessions = await loadCollection(first.snapshot, 'sessions', { fetch });
  assert.equal(sessions.snapshotId, POINTER.snapshotId);

  const poll = await loadSnapshot(REMOTE, { fetch, etag: first.etag, current: first.snapshot });
  assert.equal(poll.status, 'unchanged');
});

test('the browser module falls back to the bundled snapshot, whole, when the Function has nothing or fails', async () => {
  for (const bucket of [fakeBucket({}), fakeBucket(COMMITTED, { fail: true }), fakeBucket({ 'latest.json': COMMITTED['latest.json'] })]) {
    const first = await firstSnapshot({ remote: REMOTE, bundled: BUNDLED, fetch: siteFetch(bucket) });
    assert.equal(first.source, 'bundled');
    assert.ok(first.remoteError);
    assert.equal(first.snapshot.base, BUNDLED);
    assert.equal(first.snapshot.pointer.snapshotId, POINTER.snapshotId);
  }
  // No binding at all.
  const env = PREVIEW;
  const fetch = async (url, init = {}) =>
    url.startsWith(REMOTE) ? serve(new Request(`${ORIGIN}${url}`, { headers: init.headers ?? {} }), env) : siteFetch(fakeBucket({}))(url, init);
  const first = await firstSnapshot({ remote: REMOTE, bundled: BUNDLED, fetch });
  assert.equal(first.source, 'bundled');
  assert.match(first.remoteError.message, /HTTP 503/);
});
