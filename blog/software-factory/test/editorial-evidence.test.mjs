// Article evidence: validateEvidence on posts in temporary folders (stream C,
// phase C2). Run: npm run test:software-factory

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { validateEvidence } from '../editorial.mjs';
import { sha256 } from '../validate.mjs';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const INCOMPLETE = fs.readFileSync(path.join(FIXTURES, 'evidence.incomplete.json'), 'utf8');
const DATA = '{"session":"s-1","outcome":"merged"}\n';

/** A complete record for the files given, every value made up for the test only. */
const complete = (files) => ({
  schema: 'software-factory-evidence/v1',
  status: 'complete',
  source: { repository: 'example/software-factory', sha: 'a'.repeat(40) },
  snapshotId: 'sf1-0123456789abcdef',
  metricDefinitionsVersion: '1',
  pricingAsOf: '2026-11-01',
  interval: { from: '2026-10-01T00:00:00Z', to: '2026-11-01T00:00:00Z', timezone: 'UTC' },
  cohort: { description: 'Test cohort', records: ['s-1'] },
  models: [{ raw: 'claude-fable-5-1', alias: 'Fable 5.1' }],
  exclusions: [],
  coverage: 'All sessions in the interval',
  configuration: { effort: 'high' },
  files: Object.entries(files).map(([p, bytes]) => ({ path: p, sha256: sha256(bytes) })),
});

/** A post folder with the files given (objects are written as JSON), and the post build.mjs would read. */
function postIn(t, files, meta) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-evidence-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), typeof content === 'string' ? content : JSON.stringify(content));
  }
  return {
    slug: 'analysis',
    dir,
    html: '',
    meta: { title: 'Analysis', date: '2026-11-01', description: 'An analysis', collection: 'software-factory', ...meta },
  };
}

const evidence = { evidence: 'evidence.json' };
const draft = { ...evidence, draft: true };

test('a published post with complete evidence and matching files passes', (t) => {
  const post = postIn(t, { 'evidence.json': complete({ 'sessions.jsonl': DATA }), 'sessions.jsonl': DATA }, evidence);
  assert.deepEqual(validateEvidence(post), []);
});

test('listed files may sit in a subfolder of the post', (t) => {
  const files = { 'data/sessions.jsonl': DATA };
  const post = postIn(t, { 'evidence.json': complete(files), ...files }, evidence);
  assert.deepEqual(validateEvidence(post), []);
});

test('a post without an evidence field has nothing to check', (t) => {
  assert.deepEqual(validateEvidence(postIn(t, {}, {})), []);
  assert.deepEqual(validateEvidence(postIn(t, {}, { draft: true })), []);
});

test('a draft may have incomplete evidence', (t) => {
  assert.deepEqual(validateEvidence(postIn(t, { 'evidence.json': INCOMPLETE }, draft)), []);
});

test('a draft may name evidence that is not there yet', (t) => {
  assert.deepEqual(validateEvidence(postIn(t, {}, draft)), []);
});

test('a published post with incomplete evidence is an error, naming each null', (t) => {
  const problems = validateEvidence(postIn(t, { 'evidence.json': INCOMPLETE }, evidence));
  assert.ok(problems.some((p) => p.includes('is incomplete; a published post needs complete evidence')), problems.join('\n'));
  for (const key of ['source', 'snapshotId', 'pricingAsOf', 'interval', 'cohort', 'coverage', 'configuration']) {
    assert.ok(problems.some((p) => p.endsWith(`${key} is null`)), `${key} reported`);
  }
  assert.ok(problems.some((p) => p.endsWith('no files')));
});

test('status complete with a null field is an error, in a draft too', (t) => {
  const record = { ...complete({ 'sessions.jsonl': DATA }), coverage: null };
  for (const meta of [evidence, draft]) {
    const post = postIn(t, { 'evidence.json': record, 'sessions.jsonl': DATA }, meta);
    assert.deepEqual(validateEvidence(post), ['analysis: evidence: evidence.json: coverage is null']);
  }
});

test('a published post whose evidence file is missing is an error', (t) => {
  assert.deepEqual(validateEvidence(postIn(t, {}, evidence)), ['analysis: evidence: evidence.json is missing']);
});

test('a listed file that is missing is an error, in a draft too', (t) => {
  const record = complete({ 'sessions.jsonl': DATA });
  for (const meta of [evidence, draft]) {
    const post = postIn(t, { 'evidence.json': record }, meta);
    assert.deepEqual(validateEvidence(post), ['analysis: evidence: sessions.jsonl is missing']);
  }
});

test('a checksum mismatch is an error, and nothing is rewritten', (t) => {
  const post = postIn(t, { 'evidence.json': complete({ 'sessions.jsonl': DATA }), 'sessions.jsonl': DATA + 'changed\n' }, evidence);
  const before = fs.readFileSync(path.join(post.dir, 'evidence.json'), 'utf8');
  assert.deepEqual(validateEvidence(post), ['analysis: evidence: sessions.jsonl: sha256 differs from evidence.json']);
  assert.equal(fs.readFileSync(path.join(post.dir, 'evidence.json'), 'utf8'), before);
});

test('malformed evidence is an error, published or draft', (t) => {
  for (const meta of [evidence, draft]) {
    const notJson = validateEvidence(postIn(t, { 'evidence.json': '{ "schema": ' }, meta));
    assert.equal(notJson.length, 1);
    assert.match(notJson[0], /^analysis: evidence: evidence\.json is not JSON/);

    const wrongShape = validateEvidence(
      postIn(t, { 'evidence.json': { ...JSON.parse(INCOMPLETE), status: 'final', extra: 1 } }, meta)
    );
    assert.ok(wrongShape.some((p) => p.includes('"final" is not one of')), wrongShape.join('\n'));
    assert.ok(wrongShape.some((p) => p.includes('unexpected field extra')), wrongShape.join('\n'));
  }
});

test('a malformed reference is an error, published or draft', (t) => {
  for (const value of ['', '../other/evidence.json', 'data/evidence.json', '.evidence.json', 'evidence.csv', true]) {
    for (const meta of [{ evidence: value }, { evidence: value, draft: true }]) {
      const problems = validateEvidence(postIn(t, {}, meta));
      assert.equal(problems.length, 1, `${JSON.stringify(value)}: ${problems}`);
      assert.match(problems[0], /is not a JSON file name in the post's folder$/);
    }
  }
});

test('listed paths must stay inside the post folder and not list the evidence itself', (t) => {
  const record = complete({ 'sessions.jsonl': DATA });
  record.files.push(
    { path: '../index.md', sha256: sha256('') },
    { path: '/etc/hosts', sha256: sha256('') },
    { path: 'evidence.json', sha256: sha256('') }
  );
  const problems = validateEvidence(postIn(t, { 'evidence.json': record, 'sessions.jsonl': DATA }, evidence));
  assert.deepEqual(problems, [
    'analysis: evidence: evidence.json: "../index.md" is not a path inside the post\'s folder',
    'analysis: evidence: evidence.json: "/etc/hosts" is not a path inside the post\'s folder',
    'analysis: evidence: evidence.json lists itself',
  ]);
});

test('the shared incomplete fixture is a valid draft manifest, never complete', () => {
  const record = JSON.parse(INCOMPLETE);
  assert.equal(record.status, 'incomplete');
  assert.deepEqual(record.files, []);
});
