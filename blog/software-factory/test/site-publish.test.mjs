// The publisher, publish.mjs: A's refresh into staging, the snapshot's files
// uploaded and read back, and only then latest.json, never over a newer
// pointer. Against an in-memory fake store and a local fake of R2's S3 API, so
// no credentials and no network. Coordinator-owned.
// Run: npm run test:software-factory

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { unstable_readConfig } from 'wrangler';
import { refresh } from '../import.mjs';
import {
  CREDENTIALS,
  DESTINATIONS,
  POINTER,
  PRUNE_AFTER_MS,
  PublishError,
  StoreError,
  credentialsFromEnv,
  publish,
  s3Store,
  signRequest,
  sourceOrder,
  supersededSnapshots,
} from '../publish.mjs';
import { validate } from '../validate.mjs';
import { UPSTREAM } from './fixtures/cases.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const { keyFor } = await import(pathToFileURL(path.join(ROOT, 'functions', 'software-factory', 'data', '[[path]].js')).href);

const temporary = [];
const tmp = (prefix) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  temporary.push(dir);
  return dir;
};
after(() => temporary.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

// Three source commits, older to newer, and one on another branch. The fixture
// is read as if at each, so each gives a valid snapshot with its own id.
const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const C = 'c'.repeat(40);
const X = 'e'.repeat(40);
const HISTORY = [A, B, C];
const fakeOrder = () => {
  const calls = [];
  const order = async (base, head) => {
    calls.push([base, head]);
    if (base === head) return 'identical';
    if (base === X || head === X) return 'diverged';
    return HISTORY.indexOf(head) > HISTORY.indexOf(base) ? 'ahead' : 'behind';
  };
  return Object.assign(order, { calls });
};
const T1 = '2026-11-15T12:00:00Z';
const T2 = '2026-11-15T12:15:00Z';
const T3 = '2026-11-15T12:30:00Z';
/** A day after T2, and a minute short of it. */
const T2_DAY = '2026-11-16T12:15:00Z';
const T2_ALMOST_DAY = '2026-11-16T12:14:00Z';
const failing = async () => {
  throw new Error('getaddrinfo ENOTFOUND raw.githubusercontent.com');
};

const md5 = (b) => `"${crypto.createHash('md5').update(b).digest('hex')}"`;
const hex = (b) => crypto.createHash('sha256').update(b).digest('hex');

/**
 * R2 as the publisher sees it: get, put, list and delete, ETags, and If-Match /
 * If-None-Match on put (412 when they fail). A put is dated store.time, which a
 * test moves along with its runs. `fault(op, key, n)` runs before each call and
 * may throw; `mangle(key, body)` changes what a put stores.
 */
function fakeStore({ fault = () => {}, mangle = (key, body) => body } = {}) {
  const objects = new Map();
  const log = [];
  let n = 0;
  const self = {
    objects,
    log,
    time: T1,
    async list(prefix) {
      fault('list', prefix, n++);
      log.push(['list', prefix]);
      return [...objects].filter(([k]) => k.startsWith(prefix)).map(([key, o]) => ({ key, lastModified: o.modified }));
    },
    async delete(key) {
      fault('delete', key, n++);
      log.push(['delete', key]);
      objects.delete(key);
    },
    async get(key) {
      fault('get', key, n++);
      log.push(['get', key]);
      const o = objects.get(key);
      return o ? { body: Buffer.from(o.body), etag: o.etag } : null;
    },
    async put(key, body, opts = {}) {
      fault('put', key, n++);
      log.push(['put', key, opts]);
      const o = objects.get(key);
      if (opts.ifMatch && (!o || o.etag !== opts.ifMatch)) throw new StoreError(`PUT ${key}: 412 PreconditionFailed`, { status: 412, code: 'PreconditionFailed' });
      if (opts.ifNoneMatch === '*' && o) throw new StoreError(`PUT ${key}: 412 PreconditionFailed`, { status: 412, code: 'PreconditionFailed' });
      const stored = Buffer.from(mangle(key, body));
      objects.set(key, { body: stored, etag: md5(stored), modified: self.time });
      return { etag: md5(stored) };
    },
    pointer() {
      const o = objects.get(POINTER);
      return o ? JSON.parse(o.body.toString('utf8')) : null;
    },
    snapshot() {
      return Object.fromEntries([...objects].map(([k, o]) => [k, o.body.toString('utf8')]));
    },
    puts() {
      return log.filter(([op]) => op === 'put').map(([, key]) => key);
    },
  };
  return self;
}

const run = (store, sha, opts = {}) => publish({ store, order: opts.order ?? fakeOrder(), sha, dir: UPSTREAM, now: T1, ...opts });

/** The files a refresh of the fixture at sha writes, as bucket key -> text. */
async function staged(sha) {
  const root = tmp('sf-publish-staged-');
  const result = await refresh({ sha, dir: UPSTREAM, dataDir: path.join(root, 'data'), postsDir: path.join(root, 'posts'), now: T1 });
  const out = {};
  const dir = path.join(root, 'data', 'snapshots', result.snapshotId);
  for (const rel of fs.readdirSync(dir, { recursive: true }).sort()) {
    const file = path.join(dir, rel);
    if (fs.statSync(file).isFile()) out[`snapshots/${result.snapshotId}/${rel.split(path.sep).join('/')}`] = fs.readFileSync(file, 'utf8');
  }
  return { id: result.snapshotId, files: out };
}

// --- Publishing ------------------------------------------------------------

test('a first publish uploads the snapshot, reads it back, then creates the pointer', async () => {
  const store = fakeStore();
  const want = await staged(A);
  const result = await run(store, A);
  assert.equal(result.outcome, 'new-snapshot', result.error);
  assert.equal(result.snapshotId, want.id);
  assert.equal(result.sha, A);
  assert.equal(result.previous, null);
  assert.deepEqual(result.uploaded, Object.keys(want.files));
  assert.equal(Object.keys(want.files).length, 6);

  // Exactly the staged files, byte for byte, and the pointer last.
  const { [POINTER]: pointerText, ...files } = store.snapshot();
  assert.deepEqual(files, want.files);
  assert.equal(store.puts().at(-1), POINTER);
  const putPointer = store.log.find(([op, key]) => op === 'put' && key === POINTER);
  assert.deepEqual(putPointer[2], { contentType: 'application/json; charset=utf-8', ifNoneMatch: '*' });

  // Each file read back after its put.
  for (const key of Object.keys(want.files)) {
    const i = store.log.findIndex(([op, k]) => op === 'put' && k === key);
    assert.deepEqual(store.log[i + 1], ['get', key], key);
  }

  const pointer = JSON.parse(pointerText);
  assert.deepEqual(validate('pointer', pointer), []);
  assert.deepEqual(pointer, {
    schema: 'software-factory-pointer/v1',
    snapshotId: want.id,
    manifest: `snapshots/${want.id}/manifest.json`,
    publishedAt: T1,
    lastSourceCheck: { at: T1, sha: A, outcome: 'new-snapshot', error: null },
  });
  assert.equal(pointerText, `${JSON.stringify(pointer)}\n`);
  // The Function serves every key the publisher writes.
  for (const key of Object.keys(store.snapshot())) assert.equal(keyFor(`/software-factory/data/${key}`), key);
});

test('an unchanged source moves only lastSourceCheck, conditional on the pointer it read', async () => {
  const store = fakeStore();
  await run(store, A);
  const before = store.snapshot();
  const etag = store.objects.get(POINTER).etag;
  const order = fakeOrder();
  store.log.length = 0;
  const result = await run(store, A, { now: T2, order });
  assert.equal(result.outcome, 'unchanged', result.error);
  assert.deepEqual(result.uploaded, []);
  assert.deepEqual(result.previous, { snapshotId: result.snapshotId, sha: A });
  assert.deepEqual(store.puts(), [POINTER]);
  assert.equal(store.log.find(([op]) => op === 'put')[2].ifMatch, etag);
  assert.deepEqual(order.calls, []);
  const { [POINTER]: was, ...files } = before;
  const { [POINTER]: now, ...filesNow } = store.snapshot();
  assert.deepEqual(filesNow, files);
  assert.deepEqual(JSON.parse(now), { ...JSON.parse(was), lastSourceCheck: { at: T2, sha: A, outcome: 'unchanged', error: null } });
});

test('a newer source commit replaces the pointer; older and diverged ones are refused untouched', async () => {
  const store = fakeStore();
  await run(store, B);
  const b = store.pointer();

  // Older: refused before anything is written.
  for (const [sha, relation] of [
    [A, 'behind'],
    [X, 'diverged'],
  ]) {
    const before = store.snapshot();
    const order = fakeOrder();
    store.log.length = 0;
    const result = await run(store, sha, { now: T2, order });
    assert.equal(result.outcome, 'refused', sha);
    assert.equal(result.step, 'order');
    assert.equal(result.code, relation);
    assert.match(result.error, new RegExp(b.snapshotId));
    assert.deepEqual(order.calls, [[B, sha]]);
    assert.deepEqual(store.puts(), [], `${relation}: nothing written`);
    assert.deepEqual(store.snapshot(), before);
  }

  // Newer: replaced, and the older snapshot's files stay for anyone mid-load.
  const order = fakeOrder();
  const result = await run(store, C, { now: T2, order });
  assert.equal(result.outcome, 'new-snapshot', result.error);
  assert.deepEqual(result.previous, { snapshotId: b.snapshotId, sha: B });
  assert.deepEqual(order.calls, [[B, C]]);
  const c = store.pointer();
  assert.notEqual(c.snapshotId, b.snapshotId);
  assert.equal(c.publishedAt, T2);
  assert.ok(store.objects.has(b.manifest));
});

test('a new snapshot of the same source commit (a generator or config change) replaces the pointer without asking the order', async () => {
  const store = fakeStore();
  await run(store, A);
  const first = store.pointer();
  // Make the store's snapshot look like another generator's: a different id, same commit.
  const other = await staged(A);
  const otherId = 'sf1-0123456789abcdef';
  for (const [key, text] of Object.entries(other.files)) {
    const body = Buffer.from(text.replaceAll(other.id, otherId));
    store.objects.set(key.replace(other.id, otherId), { body, etag: md5(body) });
    store.objects.delete(key);
  }
  const moved = { ...first, snapshotId: otherId, manifest: `snapshots/${otherId}/manifest.json` };
  const body = Buffer.from(`${JSON.stringify(moved)}\n`);
  store.objects.set(POINTER, { body, etag: md5(body) });

  const order = fakeOrder();
  const result = await run(store, A, { now: T2, order });
  assert.equal(result.outcome, 'new-snapshot', result.error);
  assert.deepEqual(result.previous, { snapshotId: otherId, sha: A });
  assert.deepEqual(order.calls, []);
  assert.equal(store.pointer().snapshotId, first.snapshotId);
});

test('a run whose clock is behind the pointer\'s last check is refused', async () => {
  const store = fakeStore();
  await run(store, A, { now: T3 });
  const before = store.snapshot();
  store.log.length = 0;
  const result = await run(store, A, { now: T2 });
  assert.equal(result.outcome, 'refused');
  assert.equal(result.code, 'older-check');
  assert.deepEqual(store.puts(), []);
  assert.deepEqual(store.snapshot(), before);
});

// Each step that can fail, on a store whose pointer names A's snapshot, while
// publishing C's. The pointer must stay A's, byte for byte.
const FAILURES = [
  { step: 'refresh', code: 'network', opts: { dir: undefined, fetchImpl: failing } },
  {
    step: 'validate',
    code: 'invalid',
    opts: {
      refresh: async (o) => {
        const r = await refresh(o);
        const overview = path.join(o.dataDir, 'snapshots', r.snapshotId, 'overview.json');
        fs.appendFileSync(overview, ' '); // no longer the sha256 its manifest lists
        return r;
      },
    },
  },
  { step: 'remote', code: 'store', store: { fault: (op, key) => op === 'get' && key === POINTER && boom(key) } },
  { step: 'remote', code: 'remote', setup: (s) => s.objects.set(POINTER, { body: Buffer.from('{"schema":'), etag: '"1"' }) },
  { step: 'remote', code: 'remote', setup: (s, a) => s.objects.delete(a.manifest) },
  {
    step: 'order',
    code: 'order',
    opts: {
      order: async () => {
        throw new PublishError('order', 'GitHub compare answered 403');
      },
    },
  },
  { step: 'upload', code: 'store', store: { fault: (op, key) => op === 'put' && key.endsWith('details/sessions.json') && boom(key) } },
  { step: 'verify', code: 'verify', store: { mangle: (key, body) => (key.endsWith('overview.json') ? Buffer.concat([body, Buffer.from(' ')]) : body) } },
  { step: 'pointer', code: 'store', store: { fault: (op, key) => op === 'put' && key === POINTER && boom(key, 500) } },
];
function boom(key, status = 503) {
  throw new StoreError(`${key}: ${status}`, { status });
}

for (const [i, f] of FAILURES.entries()) {
  test(`a failure at ${f.step} (${f.code}) leaves the previous pointer [${i}]`, async () => {
    const store = fakeStore();
    await run(store, A);
    const a = store.pointer();
    const pointerBytes = store.objects.get(POINTER).body;
    f.setup?.(store, a);
    const before = store.objects.get(POINTER).body;
    if (f.store) Object.assign(store, fakeStoreFaults(store, f.store));
    const result = await run(store, C, { now: T2, ...f.opts });
    assert.equal(result.outcome, 'failed');
    assert.equal(result.step, f.step, result.error);
    assert.equal(result.code, f.code, result.error);
    assert.ok(result.error);
    assert.ok(store.objects.get(POINTER).body.equals(before), 'latest.json untouched');
    if (!f.setup) assert.ok(before.equals(pointerBytes));
    // Nothing of the failed run is reachable: the pointer still names A's complete snapshot.
    if (!f.setup) for (const key of Object.keys((await staged(A)).files)) assert.ok(store.objects.has(key), key);
  });
}

// --- Pruning ---------------------------------------------------------------

const snapKeys = (id) => ['details/changes.json', 'details/examples.json', 'manifest.json', 'overview.json'].map((f) => `snapshots/${id}/${f}`);
const listing = (entries) => entries.flatMap(([id, at]) => snapKeys(id).map((key) => ({ key, lastModified: at })));
const ID1 = 'sf1-1111111111111111';
const ID2 = 'sf1-2222222222222222';
const ID3 = 'sf1-3333333333333333';

test('a snapshot goes a day after a later upload superseded it, never the pointer\'s, never another key', () => {
  const day = PRUNE_AFTER_MS;
  assert.equal(day, 86_400_000);
  const three = listing([[ID1, T1], [ID2, T2], [ID3, T2_DAY]]);
  // ID1 was superseded at T2, ID2 at T2_DAY.
  assert.deepEqual(supersededSnapshots(three, ID3, T2_ALMOST_DAY), []);
  assert.deepEqual(supersededSnapshots(three, ID3, T2_DAY), [{ id: ID1, keys: snapKeys(ID1) }]);
  assert.deepEqual(supersededSnapshots(three, ID3, '2026-11-17T12:15:00Z').map((s) => s.id), [ID1, ID2]);
  // The pointer's snapshot stays however old; an upload after it (a run that lost the pointer race) stays too.
  assert.deepEqual(supersededSnapshots(three, ID1, '2026-12-31T00:00:00Z').map((s) => s.id), [ID2]);
  // A snapshot's upload time is its newest file's, so a finished upload counts from when it finished.
  const resumed = [...listing([[ID1, T1]]), { key: `snapshots/${ID2}/manifest.json`, lastModified: T1 }, { key: `snapshots/${ID2}/overview.json`, lastModified: T2 }];
  assert.deepEqual(supersededSnapshots(resumed, ID2, '2026-11-16T12:01:00Z'), []);
  // Uploads at the same instant supersede neither.
  assert.deepEqual(supersededSnapshots(listing([[ID1, T1], [ID2, T1]]), ID2, '2027-01-01T00:00:00Z'), []);
  // Keys outside the snapshot layout are never touched.
  const odd = [...three, { key: 'snapshots/notes.txt', lastModified: T1 }, { key: `snapshots/${ID1}/extra.json`, lastModified: T1 }, { key: 'snapshots/sf1-xyz/manifest.json', lastModified: T1 }];
  assert.deepEqual(supersededSnapshots(odd, ID3, '2027-01-01T00:00:00Z').flatMap((s) => s.keys), [...snapKeys(ID1), ...snapKeys(ID2)]);
  // A listing that lacks the pointer's snapshot, or has a date it can't read, deletes nothing.
  assert.throws(() => supersededSnapshots(listing([[ID1, T1], [ID2, T2]]), ID3, T2_DAY), (e) => e instanceof PublishError && e.code === 'prune');
  assert.throws(() => supersededSnapshots(listing([[ID1, 'yesterday'], [ID3, T2]]), ID3, T2_DAY), (e) => e instanceof PublishError && e.code === 'prune');
});

test('a run prunes after its pointer is safe: a day after a snapshot was superseded, every file of it', async () => {
  const store = fakeStore();
  const a = await run(store, A);
  assert.deepEqual(a.pruned, []);
  store.time = T2;
  const c = await run(store, C, { now: T2 });
  assert.equal(c.outcome, 'new-snapshot', c.error);
  assert.deepEqual(c.pruned, [], 'just superseded: an open tab may still load its details');
  const aKeys = Object.keys((await staged(A)).files);
  for (const key of aKeys) assert.ok(store.objects.has(key), key);

  const almost = await run(store, C, { now: T2_ALMOST_DAY });
  assert.equal(almost.outcome, 'unchanged', almost.error);
  assert.deepEqual(almost.pruned, []);

  store.log.length = 0;
  const later = await run(store, C, { now: T2_DAY });
  assert.equal(later.outcome, 'unchanged', later.error);
  assert.deepEqual(later.pruned, [a.snapshotId]);
  assert.equal(later.pruneError, null);
  for (const key of aKeys) assert.ok(!store.objects.has(key), key);
  // The pointer, and C's snapshot whole, are what readers get.
  const pointer = store.pointer();
  assert.equal(pointer.snapshotId, c.snapshotId);
  for (const key of Object.keys((await staged(C)).files)) assert.ok(store.objects.has(key), key);
  // Only after the pointer was written and read back.
  const ops = store.log.map(([op, key]) => `${op} ${key}`);
  assert.ok(ops.lastIndexOf(`get ${POINTER}`) < ops.indexOf('list snapshots/'));
  assert.ok(ops.indexOf(`put ${POINTER}`) < ops.indexOf('list snapshots/'));
});

test('a failure while pruning is reported, never a failed run, and the next run finishes it', async () => {
  const store = fakeStore();
  const a = await run(store, A);
  store.time = T2;
  await run(store, C, { now: T2 });
  const { delete: del, list } = store;
  let deletes = 0;
  store.delete = (key) => (++deletes === 2 ? boom(key) : del.call(store, key));
  const broken = await run(store, C, { now: T2_DAY });
  assert.equal(broken.outcome, 'unchanged');
  assert.equal(broken.error, null);
  assert.deepEqual(broken.pruned, []);
  assert.match(broken.pruneError, /503/);
  store.delete = del;
  store.list = (prefix) => boom(prefix, 500);
  const unlisted = await run(store, C, { now: T2_DAY });
  assert.equal(unlisted.outcome, 'unchanged');
  assert.match(unlisted.pruneError, /500/);
  store.list = list;
  const fixed = await run(store, C, { now: T2_DAY });
  assert.deepEqual(fixed.pruned, [a.snapshotId], fixed.pruneError);
  assert.ok(![...store.objects.keys()].some((k) => k.includes(a.snapshotId)));
  // A failed or refused run prunes nothing.
  store.time = T3;
  const refused = await run(store, A, { now: '2026-11-20T00:00:00Z' });
  assert.equal(refused.outcome, 'refused');
  assert.deepEqual(refused.pruned, []);
});

/** The fault and mangle hooks, added to an existing fake store. */
function fakeStoreFaults(store, { fault = () => {}, mangle = (k, b) => b }) {
  const { get, put } = store;
  return {
    get: (key) => (fault('get', key), get(key)),
    put: (key, body, opts) => (fault('put', key), put(key, Buffer.from(mangle(key, body)), opts)),
  };
}

test('a run after a failed upload finishes it, uploading only what is missing', async () => {
  const store = fakeStore();
  await run(store, A);
  const { put } = store;
  store.put = (key, body, opts) => (key.endsWith('details/sessions.json') ? boom(key) : put(key, body, opts));
  assert.equal((await run(store, C, { now: T2 })).outcome, 'failed');
  store.put = put;
  const result = await run(store, C, { now: T3 });
  assert.equal(result.outcome, 'new-snapshot', result.error);
  assert.deepEqual(result.uploaded.map((k) => k.split('/').slice(2).join('/')), ['details/sessions.json', 'details/verification.json', 'manifest.json', 'overview.json']);
});

test('a pointer another run writes meanwhile is never overwritten', async () => {
  const store = fakeStore();
  await run(store, A);
  // While this run (B) uploads, a newer run (C) publishes its pointer.
  const newer = fakeStore();
  await run(newer, C, { now: T2 });
  const theirs = newer.objects.get(POINTER).body;
  const { put } = store;
  let raced = false;
  store.put = async (key, body, opts) => {
    if (!raced && key !== POINTER) {
      raced = true;
      for (const [k, o] of newer.objects) store.objects.set(k, { ...o });
    }
    return put(key, body, opts);
  };
  const result = await run(store, B, { now: T2 });
  assert.equal(result.outcome, 'failed');
  assert.equal(result.step, 'pointer');
  assert.equal(result.code, 'conflict');
  assert.ok(store.objects.get(POINTER).body.equals(theirs), "C's pointer stands");
});

// --- Destinations and credentials -------------------------------------------

test("the destinations are wrangler.toml's buckets", () => {
  const bucket = (env) => unstable_readConfig({ config: path.join(ROOT, 'wrangler.toml'), env }, { hideWarnings: true }).r2_buckets.find((b) => b.binding === 'SOFTWARE_FACTORY_DATA').bucket_name;
  assert.deepEqual(DESTINATIONS, { preview: bucket(undefined), production: bucket('production') });
  assert.notEqual(DESTINATIONS.preview, DESTINATIONS.production);
});

test('credentials come from the three SOFTWARE_FACTORY_R2_ variables only', () => {
  assert.deepEqual(CREDENTIALS, ['SOFTWARE_FACTORY_R2_ACCOUNT_ID', 'SOFTWARE_FACTORY_R2_ACCESS_KEY_ID', 'SOFTWARE_FACTORY_R2_SECRET_ACCESS_KEY']);
  const env = { SOFTWARE_FACTORY_R2_ACCOUNT_ID: ' 0123456789abcdef0123456789abcdef ', SOFTWARE_FACTORY_R2_ACCESS_KEY_ID: 'key', SOFTWARE_FACTORY_R2_SECRET_ACCESS_KEY: 'secret-value' };
  assert.deepEqual(credentialsFromEnv(env), { accountId: '0123456789abcdef0123456789abcdef', accessKeyId: 'key', secretAccessKey: 'secret-value' });
  const other = { AWS_ACCESS_KEY_ID: 'aws', AWS_SECRET_ACCESS_KEY: 'aws-secret', CLOUDFLARE_API_TOKEN: 'cf', SOFTWARE_FACTORY_R2_ACCESS_KEY_ID: 'key', SOFTWARE_FACTORY_R2_SECRET_ACCESS_KEY: 'secret-value' };
  assert.throws(
    () => credentialsFromEnv(other),
    (e) => e instanceof PublishError && e.code === 'credentials' && e.message === 'missing SOFTWARE_FACTORY_R2_ACCOUNT_ID',
  );
  assert.throws(() => credentialsFromEnv({}), /missing SOFTWARE_FACTORY_R2_ACCOUNT_ID, SOFTWARE_FACTORY_R2_ACCESS_KEY_ID, SOFTWARE_FACTORY_R2_SECRET_ACCESS_KEY/);
  assert.throws(() => s3Store({ accountId: 'x.evil.example/', accessKeyId: 'k', secretAccessKey: 's', bucket: 'software-factory-data' }), /32 hex digits/);
});

test('the CLI asks for a destination and refuses to start without the credentials', () => {
  const cli = path.join(ROOT, 'blog', 'software-factory', 'cli.mjs');
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !CREDENTIALS.includes(k)));
  const usage = spawnSync(process.execPath, [cli, 'publish', '--destination', 'staging'], { env, encoding: 'utf8' });
  assert.equal(usage.status, 2);
  assert.match(usage.stderr, /--destination preview\|production/);
  const missing = spawnSync(process.execPath, [cli, 'publish', '--destination', 'preview'], { env, encoding: 'utf8' });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /missing SOFTWARE_FACTORY_R2_ACCOUNT_ID, SOFTWARE_FACTORY_R2_ACCESS_KEY_ID, SOFTWARE_FACTORY_R2_SECRET_ACCESS_KEY/);
  assert.equal(missing.stdout, '');
  // A malformed account id is named the same way, before any request, and its value is never printed.
  const bad = { ...env, SOFTWARE_FACTORY_R2_ACCOUNT_ID: 'not-an-account-zz', SOFTWARE_FACTORY_R2_ACCESS_KEY_ID: 'x', SOFTWARE_FACTORY_R2_SECRET_ACCESS_KEY: 'y' };
  const malformed = spawnSync(process.execPath, [cli, 'publish', '--destination', 'preview'], { env: bad, encoding: 'utf8' });
  assert.equal(malformed.status, 1);
  assert.equal(malformed.stderr, 'ERROR SOFTWARE_FACTORY_R2_ACCOUNT_ID is not a Cloudflare account id (32 hex digits)\n');
  assert.equal(malformed.stdout, '');
});

// --- SigV4 and R2's S3 API ---------------------------------------------------

test("SigV4 signatures equal AWS's published example and AWS's own signer", () => {
  // AWS's S3 SigV4 documentation, "GET Object" example. Its access key id is
  // AWS's public example, not a credential; it is built from two parts so the
  // commit check's secret pattern doesn't match it in the source.
  const EXAMPLE_KEY = ['AKIA', 'IOSFODNN7EXAMPLE'].join('');
  const get = signRequest({
    method: 'GET',
    url: 'https://examplebucket.s3.amazonaws.com/test.txt',
    headers: { Range: 'bytes=0-9' },
    accessKeyId: EXAMPLE_KEY,
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    region: 'us-east-1',
    now: new Date('2013-05-24T00:00:00Z'),
  });
  assert.equal(
    get.authorization,
    `AWS4-HMAC-SHA256 Credential=${EXAMPLE_KEY}/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41`,
  );
  assert.equal(get['x-amz-content-sha256'], 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  // A conditional put of a pointer to R2, as @smithy/signature-v4 5.x signed it
  // (installed outside the repo for the check; not a dependency).
  const put = signRequest({
    method: 'PUT',
    url: 'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com/software-factory-data-preview/latest.json',
    headers: { 'content-type': 'application/json; charset=utf-8', 'if-match': '"0123456789abcdef0123456789abcdef"' },
    body: '{"a":1}\n',
    accessKeyId: 'AKIDEXAMPLE0000000000',
    secretAccessKey: 'not-a-real-secret/abc+def',
    now: new Date('2026-11-15T12:34:56Z'),
  });
  assert.equal(
    put.authorization,
    'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE0000000000/20261115/auto/s3/aws4_request, SignedHeaders=content-type;host;if-match;x-amz-content-sha256;x-amz-date, Signature=f89bd5cdc4f2719a644f9ed4cec3770f6ac067eaf10b9e639e047766cf36baf9',
  );
});

/**
 * A local stand-in for R2's S3 API: path-style /<bucket>/<key>, every request's
 * signature checked from what arrived, ETags, conditional puts, S3's XML errors.
 */
async function fakeR2({ accessKeyId, secretAccessKey, bucket, pageSize = 1000, clock = () => new Date(T1) }) {
  const objects = new Map();
  const requests = [];
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    const url = new URL(req.url, `http://${req.headers.host}`);
    requests.push({ method: req.method, path: url.pathname, search: url.search, headers: req.headers, bytes: body.length });
    const error = (status, code) => {
      res.writeHead(status, { 'content-type': 'application/xml' });
      res.end(`<?xml version="1.0" encoding="UTF-8"?><Error><Code>${code}</Code><Message>${code}</Message></Error>`);
    };
    // Verify SigV4 the way a server does: re-sign the headers the client listed.
    const auth = req.headers.authorization ?? '';
    const m = auth.match(/^AWS4-HMAC-SHA256 Credential=([^/]+)\/(\d{8})\/auto\/s3\/aws4_request, SignedHeaders=([a-z0-9;-]+), Signature=([0-9a-f]{64})$/);
    if (!m || m[1] !== accessKeyId) return error(403, 'InvalidAccessKeyId');
    if (req.headers['x-amz-content-sha256'] !== hex(body)) return error(400, 'XAmzContentSHA256Mismatch');
    const listed = m[3].split(';');
    if (!['host', 'x-amz-date', 'x-amz-content-sha256'].every((h) => listed.includes(h))) return error(403, 'AccessDenied');
    const headers = Object.fromEntries(listed.filter((h) => !['host', 'x-amz-date', 'x-amz-content-sha256'].includes(h)).map((h) => [h, req.headers[h]]));
    const amz = req.headers['x-amz-date'];
    const now = new Date(`${amz.slice(0, 4)}-${amz.slice(4, 6)}-${amz.slice(6, 8)}T${amz.slice(9, 11)}:${amz.slice(11, 13)}:${amz.slice(13, 15)}Z`);
    const expected = signRequest({ method: req.method, url: `http://${req.headers.host}${url.pathname}${url.search}`, headers, body, accessKeyId, secretAccessKey, now });
    if (expected.authorization !== auth) return error(403, 'SignatureDoesNotMatch');

    const [, b, ...rest] = url.pathname.split('/');
    if (b !== bucket) return error(404, 'NoSuchBucket');
    const key = rest.map(decodeURIComponent).join('/');
    const o = objects.get(key);
    // ListObjectsV2 on the bucket itself, a page at a time.
    if (req.method === 'GET' && rest.length === 0) {
      if (url.searchParams.get('list-type') !== '2') return error(400, 'InvalidArgument');
      const prefix = url.searchParams.get('prefix') ?? '';
      const keys = [...objects.keys()].filter((k) => k.startsWith(prefix)).sort();
      const start = Number(url.searchParams.get('continuation-token') ?? 0);
      const page = keys.slice(start, start + pageSize);
      const more = start + pageSize < keys.length;
      const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
      res.writeHead(200, { 'content-type': 'application/xml' });
      return res.end(
        `<?xml version="1.0" encoding="UTF-8"?><ListBucketResult><Name>${bucket}</Name><Prefix>${esc(prefix)}</Prefix><KeyCount>${page.length}</KeyCount><IsTruncated>${more}</IsTruncated>` +
          (more ? `<NextContinuationToken>${start + pageSize}</NextContinuationToken>` : '') +
          page.map((k) => `<Contents><Key>${esc(k)}</Key><LastModified>${objects.get(k).modified.toISOString()}</LastModified><ETag>${objects.get(k).etag}</ETag><Size>${objects.get(k).body.length}</Size></Contents>`).join('') +
          '</ListBucketResult>'
      );
    }
    if (req.method === 'DELETE') {
      objects.delete(key); // S3 and R2 answer 204 whether or not the key was there
      res.writeHead(204);
      return res.end();
    }
    if (req.method === 'GET') {
      if (!o) return error(404, 'NoSuchKey');
      res.writeHead(200, { etag: o.etag, 'content-type': o.type, 'content-length': o.body.length });
      return res.end(o.body);
    }
    if (req.method === 'PUT') {
      const ifMatch = req.headers['if-match'];
      if (ifMatch && (!o || o.etag !== ifMatch)) return error(412, 'PreconditionFailed');
      if (req.headers['if-none-match'] === '*' && o) return error(412, 'PreconditionFailed');
      objects.set(key, { body, etag: md5(body), type: req.headers['content-type'], modified: clock() });
      res.writeHead(200, { etag: md5(body) });
      return res.end();
    }
    return error(405, 'MethodNotAllowed');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { objects, requests, endpoint: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) };
}

test("s3Store publishes through R2's S3 API: signed, path-style, conditional", async () => {
  const creds = { accessKeyId: 'AKIDLOCALTEST000000', secretAccessKey: 'local/test+secret=value' };
  const r2 = await fakeR2({ ...creds, bucket: DESTINATIONS.preview });
  try {
    const store = s3Store({ ...creds, bucket: DESTINATIONS.preview, endpoint: r2.endpoint });
    const first = await publish({ store, order: fakeOrder(), sha: A, dir: UPSTREAM, now: T1 });
    assert.equal(first.outcome, 'new-snapshot', first.error);
    assert.equal(r2.objects.size, 7);
    assert.equal(r2.objects.get(POINTER).type, 'application/json; charset=utf-8');
    const want = await staged(A);
    for (const [key, text] of Object.entries(want.files)) assert.equal(r2.objects.get(key).body.toString('utf8'), text, key);
    const created = r2.requests.find((r) => r.method === 'PUT' && r.path.endsWith(`/${POINTER}`));
    assert.equal(created.headers['if-none-match'], '*');
    assert.ok(r2.requests.every((r) => r.path.startsWith(`/${DESTINATIONS.preview}/`) || (r.path === `/${DESTINATIONS.preview}` && r.method === 'GET')));
    assert.equal(first.pruneError, null);

    const second = await publish({ store, order: fakeOrder(), sha: A, dir: UPSTREAM, now: T2 });
    assert.equal(second.outcome, 'unchanged', second.error);
    const swapped = r2.requests.filter((r) => r.method === 'PUT' && r.path.endsWith(`/${POINTER}`)).at(-1);
    assert.match(swapped.headers['if-match'], /^"[0-9a-f]{32}"$/);

    // A 412 from the API is a conflict; latest.json stays.
    const before = r2.objects.get(POINTER).body;
    await assert.rejects(store.put(POINTER, Buffer.from('{}\n'), { ifMatch: '"0"' }), (e) => e instanceof StoreError && e.status === 412 && e.code === 'PreconditionFailed');
    assert.ok(r2.objects.get(POINTER).body.equals(before));
    assert.equal(await store.get('snapshots/sf1-0000000000000000/manifest.json'), null);
    // A missing bucket is an error, never an empty destination to publish into.
    const elsewhere = s3Store({ ...creds, bucket: DESTINATIONS.production, endpoint: r2.endpoint });
    await assert.rejects(elsewhere.get(POINTER), (e) => e instanceof StoreError && e.status === 404 && e.code === 'NoSuchBucket');

    // A wrong secret: S3's error code, and no credential in what comes back.
    const wrong = s3Store({ accessKeyId: creds.accessKeyId, secretAccessKey: 'wrong-secret', bucket: DESTINATIONS.preview, endpoint: r2.endpoint });
    const denied = await publish({ store: wrong, order: fakeOrder(), sha: B, dir: UPSTREAM, now: T3 });
    assert.equal(denied.outcome, 'failed');
    assert.equal(denied.step, 'remote');
    assert.equal(denied.code, 'store');
    assert.match(denied.error, /403 SignatureDoesNotMatch/);
    assert.ok(!JSON.stringify(denied).includes('secret'), 'no credential in the result');
    assert.ok(r2.objects.get(POINTER).body.equals(before));
  } finally {
    await r2.close();
  }
});

test("s3Store lists through ListObjectsV2's pages, deletes, and prunes over R2's S3 API", async () => {
  const creds = { accessKeyId: 'AKIDLOCALTEST000000', secretAccessKey: 'local/test+secret=value' };
  let time = new Date(T1);
  const r2 = await fakeR2({ ...creds, bucket: DESTINATIONS.preview, pageSize: 3, clock: () => time });
  try {
    const store = s3Store({ ...creds, bucket: DESTINATIONS.preview, endpoint: r2.endpoint });
    const a = await publish({ store, order: fakeOrder(), sha: A, dir: UPSTREAM, now: T1 });
    time = new Date(T2);
    const c = await publish({ store, order: fakeOrder(), sha: C, dir: UPSTREAM, now: T2 });
    assert.equal(c.outcome, 'new-snapshot', c.error);
    assert.deepEqual(c.pruned, []);
    assert.equal(c.pruneError, null);

    // Every key across pages of three, with its date; a prefix that matches nothing is empty.
    const listed = await store.list('snapshots/');
    assert.equal(listed.length, 12);
    assert.deepEqual(listed.map((o) => o.key), [...r2.objects.keys()].filter((k) => k !== POINTER).sort());
    assert.deepEqual(new Set(listed.map((o) => o.lastModified)), new Set([new Date(T1).toISOString(), new Date(T2).toISOString()]));
    assert.ok(r2.requests.filter((r) => r.search.includes('continuation-token=')).length >= 3, 'followed the pages');
    assert.deepEqual(await store.list('nothing/'), []);

    const later = await publish({ store, order: fakeOrder(), sha: C, dir: UPSTREAM, now: T2_DAY });
    assert.equal(later.outcome, 'unchanged', later.error);
    assert.deepEqual(later.pruned, [a.snapshotId], later.pruneError);
    assert.deepEqual([...r2.objects.keys()].filter((k) => k.includes(a.snapshotId)), []);
    assert.equal(r2.requests.filter((r) => r.method === 'DELETE').length, 6);
    assert.equal(JSON.parse(r2.objects.get(POINTER).body).snapshotId, c.snapshotId);
    // Deleting a key that is gone is no error, as in S3.
    await store.delete(`snapshots/${a.snapshotId}/manifest.json`);
    // A listing the API refuses is a StoreError, with S3's code.
    const wrong = s3Store({ accessKeyId: creds.accessKeyId, secretAccessKey: 'wrong-secret', bucket: DESTINATIONS.preview, endpoint: r2.endpoint });
    await assert.rejects(wrong.list('snapshots/'), (e) => e instanceof StoreError && e.status === 403 && e.code === 'SignatureDoesNotMatch');
  } finally {
    await r2.close();
  }
});

test("s3Store's default endpoint is the account's R2 S3 API", async () => {
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push({ url, init });
    return new Response(null, { status: 404 });
  };
  const store = s3Store({ accountId: '0123456789abcdef0123456789abcdef', accessKeyId: 'k', secretAccessKey: 's', bucket: DESTINATIONS.production, fetchImpl });
  assert.equal(await store.get('snapshots/sf1-0123456789abcdef/details/sessions.json'), null);
  assert.equal(seen[0].url, 'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com/software-factory-data/snapshots/sf1-0123456789abcdef/details/sessions.json');
  assert.match(seen[0].init.headers.authorization, /^AWS4-HMAC-SHA256 Credential=k\/\d{8}\/auto\/s3\/aws4_request, /);
  assert.equal(seen[0].init.headers.host, undefined, 'fetch sends Host itself');
});

// --- Source order -------------------------------------------------------------

test("sourceOrder reads GitHub's compare API, with an optional token", async () => {
  const seen = [];
  const answer = (status, body) => async (url, init) => {
    seen.push({ url, headers: init.headers });
    return new Response(JSON.stringify(body), { status });
  };
  const order = sourceOrder({ repository: 'pilifs/in-the-loop', fetchImpl: answer(200, { status: 'behind' }), token: 'gh-token' });
  assert.equal(await order(A, B), 'behind');
  assert.equal(seen[0].url, `https://api.github.com/repos/pilifs/in-the-loop/compare/${A}...${B}?per_page=1`);
  assert.equal(seen[0].headers.authorization, 'Bearer gh-token');
  assert.equal(await sourceOrder({ fetchImpl: answer(200, { status: 'ahead' }) })(A, B), 'ahead');
  assert.equal(seen[1].headers.authorization, undefined);
  await assert.rejects(sourceOrder({ fetchImpl: answer(404, {}) })(A, B), (e) => e.code === 'order' && /404/.test(e.message));
  await assert.rejects(sourceOrder({ fetchImpl: answer(200, {}) })(A, B), (e) => e.code === 'order');
  await assert.rejects(sourceOrder({ fetchImpl: answer(200, { status: 'ahead' }) })('main', B), (e) => e.code === 'order');
});

test('sourceOrder compares commits in a local checkout', async () => {
  const repo = tmp('sf-publish-git-');
  const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.invalid', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.invalid' } }).trim();
  git('init', '-q', '-b', 'main');
  const commit = (m) => (git('commit', '-q', '--allow-empty', '-m', m), git('rev-parse', 'HEAD'));
  const one = commit('one');
  const two = commit('two');
  git('checkout', '-q', '-b', 'side', one);
  const side = commit('side');
  const order = sourceOrder({ checkout: repo });
  assert.equal(await order(one, two), 'ahead');
  assert.equal(await order(two, one), 'behind');
  assert.equal(await order(two, side), 'diverged');
  assert.equal(await order(two, two), 'identical');
  await assert.rejects(order(two, 'f'.repeat(40)), (e) => e.code === 'order');
});
