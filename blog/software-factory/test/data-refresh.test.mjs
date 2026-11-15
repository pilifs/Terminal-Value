// Stream A, phase A4: refresh, from the fixture's cases into a data directory.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { namedSnapshots, refresh } from '../import.mjs';
import { validateSnapshotDir } from '../validate.mjs';
import { CASES, UPSTREAM, materialize } from './fixtures/cases.mjs';

const SHA = JSON.parse(fs.readFileSync(path.join(UPSTREAM, 'SOURCE.json'), 'utf8')).rev;
const EXAMPLE = path.join(import.meta.dirname, 'fixtures', 'snapshot-example');
const EXAMPLE_ID = JSON.parse(fs.readFileSync(path.join(EXAMPLE, 'latest.json'), 'utf8')).snapshotId;
const T1 = '2026-11-14T12:00:00Z';
const T2 = '2026-11-15T08:30:00Z';
const failing = async () => {
  throw new Error('getaddrinfo ENOTFOUND raw.githubusercontent.com');
};

const temporary = [];
const tmp = (prefix) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  temporary.push(dir);
  return dir;
};
after(() => temporary.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

/** A site root with data/ holding the published example, and posts/ empty. */
function site({ data = true } = {}) {
  const root = tmp('sf-refresh-');
  const dataDir = path.join(root, 'data');
  const postsDir = path.join(root, 'posts');
  fs.mkdirSync(postsDir);
  if (data) fs.cpSync(EXAMPLE, dataDir, { recursive: true });
  return { root, dataDir, postsDir };
}

/** Every file under dir as relative path -> bytes. */
function files(dir) {
  const out = {};
  if (!fs.existsSync(dir)) return out;
  for (const rel of fs.readdirSync(dir, { recursive: true }).sort()) {
    const file = path.join(dir, rel);
    if (fs.statSync(file).isFile()) out[rel.split(path.sep).join('/')] = fs.readFileSync(file);
  }
  return out;
}

const pointer = (dataDir) => JSON.parse(fs.readFileSync(path.join(dataDir, 'latest.json'), 'utf8'));
const run = (s, opts) => refresh({ sha: SHA, dataDir: s.dataDir, postsDir: s.postsDir, now: T1, ...opts });
const noStaging = (s) => assert.deepEqual(fs.readdirSync(s.root).filter((n) => n.startsWith('.')), [], 'staging removed');

for (const kase of CASES) {
  test(`refresh case ${kase.id}: ${kase.expect.outcome}${kase.expect.code ? ` (${kase.expect.code})` : ''}`, async () => {
    const { dir } = materialize(kase.id);
    const s = site();
    const before = files(s.dataDir);
    const opts = kase.network === 'fail' ? { fetchImpl: failing } : { dir };
    const result = await run(s, opts);
    noStaging(s);

    if (kase.expect.outcome === 'failed') {
      assert.equal(result.outcome, 'failed');
      assert.equal(result.code, kase.expect.code, result.error);
      if (kase.expect.path) assert.equal(result.path, kase.expect.path);
      assert.equal(result.snapshotId, EXAMPLE_ID, 'the current snapshot stays current');
      assert.deepEqual(files(s.dataDir), before, 'data/ byte for byte as it was');
      return;
    }

    assert.equal(result.outcome, 'new-snapshot', result.error);
    assert.deepEqual(validateSnapshotDir(s.dataDir), []);
    const first = pointer(s.dataDir);
    assert.equal(first.snapshotId, result.snapshotId);
    assert.deepEqual(first.lastSourceCheck, { at: T1, sha: SHA, outcome: 'new-snapshot', error: null });
    assert.equal(first.publishedAt, T1);
    assert.deepEqual(result.pruned, [EXAMPLE_ID], 'no post names the example, so it goes');
    assert.deepEqual(fs.readdirSync(path.join(s.dataDir, 'snapshots')), [result.snapshotId]);
    if (!kase.repeat) return;

    // The same revision again, a day later: nothing new, only the check moves.
    const snapshotFiles = files(path.join(s.dataDir, 'snapshots'));
    const again = await run(s, { ...opts, now: T2 });
    noStaging(s);
    assert.deepEqual(again, { outcome: 'unchanged', snapshotId: result.snapshotId, sha: SHA, pruned: [], error: null });
    assert.deepEqual(files(path.join(s.dataDir, 'snapshots')), snapshotFiles, 'the same snapshot files');
    assert.deepEqual(pointer(s.dataDir), { ...first, lastSourceCheck: { at: T2, sha: SHA, outcome: 'unchanged', error: null } });
    assert.deepEqual(validateSnapshotDir(s.dataDir), []);
  });
}

test('two refreshes of the same input give identical files', async () => {
  const a = site({ data: false });
  const b = site({ data: false });
  const ra = await run(a, { dir: UPSTREAM });
  const rb = await run(b, { dir: UPSTREAM });
  assert.equal(ra.outcome, 'new-snapshot', ra.error);
  assert.deepEqual(rb, ra);
  assert.deepEqual(files(b.dataDir), files(a.dataDir));
  assert.deepEqual(Object.keys(files(a.dataDir)), [
    'latest.json',
    `snapshots/${ra.snapshotId}/details/changes.json`,
    `snapshots/${ra.snapshotId}/details/examples.json`,
    `snapshots/${ra.snapshotId}/details/inputs.json`,
    `snapshots/${ra.snapshotId}/details/loops.json`,
    `snapshots/${ra.snapshotId}/details/sessions.json`,
    `snapshots/${ra.snapshotId}/details/verification.json`,
    `snapshots/${ra.snapshotId}/manifest.json`,
    `snapshots/${ra.snapshotId}/overview.json`,
  ]);
  for (const [rel, bytes] of Object.entries(files(a.dataDir))) assert.ok(bytes.toString().endsWith('}\n') && !bytes.includes('\n  '), `${rel} compact`);
});

test('a snapshot a post names is never deleted', async () => {
  const s = site();
  const other = 'sf1-00000000000000aa';
  const kept = 'sf1-00000000000000bb';
  for (const id of [other, kept]) fs.cpSync(path.join(EXAMPLE, 'snapshots', EXAMPLE_ID), path.join(s.dataDir, 'snapshots', id), { recursive: true });
  fs.mkdirSync(path.join(s.dataDir, 'snapshots', 'notes'));
  const post = (slug, text) => {
    fs.mkdirSync(path.join(s.postsDir, slug));
    fs.writeFileSync(path.join(s.postsDir, slug, 'evidence.json'), text);
  };
  post('published-analysis', JSON.stringify({ schema: 'software-factory-evidence/v1', status: 'complete', snapshotId: EXAMPLE_ID }));
  post('broken-draft', `{"snapshotId": "${kept}", `);
  post('no-snapshot-yet', fs.readFileSync(path.join(EXAMPLE, '..', 'evidence.incomplete.json')));
  assert.deepEqual([...namedSnapshots(s.postsDir)].sort(), [EXAMPLE_ID, kept].sort());

  const result = await run(s, { dir: UPSTREAM });
  assert.equal(result.outcome, 'new-snapshot', result.error);
  assert.deepEqual(result.pruned, [other]);
  assert.deepEqual(fs.readdirSync(path.join(s.dataDir, 'snapshots')).sort(), [EXAMPLE_ID, 'notes', kept, result.snapshotId].sort());
  assert.deepEqual(validateSnapshotDir(s.dataDir), []);
  assert.deepEqual(namedSnapshots(path.join(s.root, 'none')), new Set());
});

test('an existing snapshot the pointer does not name becomes current again', async () => {
  const s = site({ data: false });
  const first = await run(s, { dir: UPSTREAM });
  fs.cpSync(path.join(EXAMPLE, 'snapshots', EXAMPLE_ID), path.join(s.dataDir, 'snapshots', EXAMPLE_ID), { recursive: true });
  fs.copyFileSync(path.join(EXAMPLE, 'latest.json'), path.join(s.dataDir, 'latest.json'));
  const result = await run(s, { dir: UPSTREAM, now: T2 });
  assert.deepEqual(result, { outcome: 'new-snapshot', snapshotId: first.snapshotId, sha: SHA, pruned: [EXAMPLE_ID], error: null });
  assert.equal(pointer(s.dataDir).publishedAt, T2, 'the pointer changed snapshot');
});

test('a snapshot id already taken by other files is a conflict, and changes nothing', async () => {
  const s = site({ data: false });
  const first = await run(s, { dir: UPSTREAM });
  const overview = path.join(s.dataDir, 'snapshots', first.snapshotId, 'overview.json');
  fs.appendFileSync(overview, ' ');
  const before = files(s.dataDir);
  const result = await run(s, { dir: UPSTREAM, now: T2 });
  assert.deepEqual([result.outcome, result.code, result.snapshotId], ['failed', 'conflict', first.snapshotId]);
  assert.deepEqual(files(s.dataDir), before);
  noStaging(s);
});

test('any other failure leaves data/ as it was', async () => {
  // A broken config makes aggregate throw; invalid output is refused; a missing data/ stays missing.
  const s = site();
  const before = files(s.dataDir);
  const { loadConfig } = await import('../import.mjs');
  const config = loadConfig();
  const bad = { ...config, source: { ...config.source, timezone: 'Not/AZone' } };
  const result = await run(s, { dir: UPSTREAM, config: bad });
  assert.equal(result.outcome, 'failed');
  assert.equal(result.snapshotId, EXAMPLE_ID);
  assert.deepEqual(files(s.dataDir), before);
  noStaging(s);

  // Output that fails validateSnapshotDir: a model label that is not a string.
  const labels = { ...config, models: { ...config.models, aliases: Object.fromEntries(Object.keys(config.models.aliases).map((k) => [k, 42])) } };
  const invalid = await run(s, { dir: UPSTREAM, config: labels });
  assert.deepEqual([invalid.outcome, invalid.code], ['failed', 'invalid']);
  assert.match(invalid.error, /models\[0\]\.label: expected string/);
  assert.deepEqual(files(s.dataDir), before);
  noStaging(s);

  const empty = site({ data: false });
  const missing = await run(empty, { dir: undefined, fetchImpl: failing });
  assert.deepEqual([missing.outcome, missing.code, missing.snapshotId], ['failed', 'network', null]);
  assert.equal(fs.existsSync(empty.dataDir), false);
  noStaging(empty);
});

test('a refresh into an invalid data/ replaces its pointer with a valid one', async () => {
  const s = site();
  fs.writeFileSync(path.join(s.dataDir, 'latest.json'), '{"schema": "software-factory-pointer/v1"');
  const result = await run(s, { dir: UPSTREAM });
  assert.equal(result.outcome, 'new-snapshot', result.error);
  assert.deepEqual(validateSnapshotDir(s.dataDir), []);
});

test('from a local checkout: its commit gives a snapshot, an unknown sha fails as missing', async () => {
  // A throwaway repository in the temp directory holding the fixture, made with plumbing.
  const repo = tmp('sf-checkout-');
  fs.cpSync(UPSTREAM, repo, { recursive: true });
  const git = (...args) => execFileSync('git', ['-C', repo, ...args], { env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com' } }).toString().trim();
  git('init', '-q');
  git('add', '-A');
  const commit = git('commit-tree', git('write-tree'), '-m', 'fixture');

  const s = site();
  const ok = await run(s, { sha: commit, checkout: repo });
  assert.deepEqual([ok.outcome, ok.sha], ['new-snapshot', commit], ok.error);
  assert.deepEqual(validateSnapshotDir(s.dataDir), []);
  const before = files(s.dataDir);
  const unknown = await run(s, { sha: 'f'.repeat(40), checkout: repo, now: T2 });
  assert.deepEqual([unknown.outcome, unknown.code, unknown.snapshotId], ['failed', 'missing', ok.snapshotId]);
  assert.deepEqual(files(s.dataDir), before);
});
