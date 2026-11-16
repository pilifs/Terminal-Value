// The frozen contract (Phase 0): schema.json and its validator, the config,
// and the fixtures every stream builds on. Run: npm run test:software-factory

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { PLACEHOLDER, canonicalJson, configSha256, metricDefinitions, snapshotId } from '../identity.mjs';
import { validate, validateSnapshotDir } from '../validate.mjs';
import { CASES, UPSTREAM, materialize } from './fixtures/cases.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const FIX = path.join(HERE, 'fixtures');
const EXAMPLE = path.join(FIX, 'snapshot-example');
const json = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const schema = json(path.join(ROOT, 'schema.json'));
const metrics = json(path.join(ROOT, 'config', 'metrics.json'));
const areas = json(path.join(ROOT, 'config', 'areas.json'));
const models = json(path.join(ROOT, 'config', 'models.json'));
const pointer = json(path.join(EXAMPLE, 'latest.json'));
const snapDir = path.join(EXAMPLE, path.dirname(pointer.manifest));
const overview = json(path.join(snapDir, 'overview.json'));

test('every $ref in schema.json resolves', () => {
  const refs = [];
  const walk = (o) => {
    if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) k === '$ref' ? refs.push(v) : walk(v);
  };
  walk(schema);
  assert.ok(refs.length > 10);
  for (const r of refs) assert.ok(schema.$defs[r.replace('#/$defs/', '')], `unresolved ${r}`);
});

test('the validator reports missing, unexpected and wrong values', () => {
  const ok = json(path.join(FIX, 'runtime-observation.json'));
  assert.deepEqual(validate('runtime', ok), []);
  const { runId, ...missing } = ok;
  void runId;
  assert.match(validate('runtime', missing).join(), /missing runId/);
  assert.match(validate('runtime', { ...ok, extra: 1 }).join(), /unexpected field extra/);
  assert.match(validate('runtime', { ...ok, schema: 'software-factory-runtime/v2' }).join(), /expected "software-factory-runtime\/v1"/);
  assert.match(validate('runtime', { ...ok, observedAt: 'yesterday' }).join(), /does not match/);
  assert.match(validate('runtime', { ...ok, counters: { jobs: -1 } }).join(), /below 0/);
  assert.match(validate('runtime', { ...ok, states: [{ ...ok.states[0], state: 'busy' }] }).join(), /not one of/);
  assert.throws(() => validate('nonsense', {}), /no record named/);
});

test('metric definitions match the schema and name only known metrics', () => {
  const ids = metrics.metrics.map((m) => m.id);
  assert.deepEqual([...ids].sort(), [...schema.$defs.metricId.enum].sort());
  for (const id of [...metrics.summary, ...metrics.chart, ...metrics.insights.map((i) => i.metricId)]) assert.ok(ids.includes(id), id);
  for (const m of metrics.metrics) {
    for (const f of m.filters) assert.ok(['period', 'model', 'effort'].includes(f), `${m.id}: ${f}`);
    if (m.kind === 'stock') assert.deepEqual(m.filters, [], `${m.id} is a stock: no filters`);
  }
  assert.equal(metrics.periods.timezone, 'America/Toronto');
});

test('the area mapping has unique areas, campaigns and an Unassigned bucket', () => {
  const ids = areas.areas.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(areas.unassigned.id, 'unassigned');
  assert.ok(!ids.includes('unassigned'));
  const campaigns = areas.areas.flatMap((a) => a.campaigns);
  assert.equal(new Set(campaigns).size, campaigns.length);
});

test('only claude-fable-5-2 is shown as Fable 5.2, and the config says by whose decision', () => {
  for (const [raw, alias] of Object.entries(models.aliases)) if (/5\.2/.test(alias)) assert.equal(raw, 'claude-fable-5-2');
  assert.equal(models.aliases['claude-fable-5-2'], 'Fable 5.2');
  assert.match(models.note, /by the author's decision of 2026-11-16/);
});

test('the upstream fixture is pinned and internally consistent', () => {
  const source = json(path.join(UPSTREAM, 'SOURCE.json'));
  assert.match(source.rev, /^[0-9a-f]{40}$/);
  const rollup = json(path.join(UPSTREAM, 'llm-dlc/traces/metrics.json'));
  let calls = 0;
  let usd = 0;
  for (const s of rollup.sessions) {
    const doc = json(path.join(UPSTREAM, `llm-dlc/traces/${s.session_id}/metrics.json`));
    calls += doc.calls.length;
    usd += doc.calls.reduce((t, c) => t + (c.usd ?? 0), 0);
    assert.equal(doc.calls.length, s.api_calls, s.session_id);
  }
  assert.equal(calls, rollup.totals.api_calls);
  assert.ok(Math.abs(usd - rollup.totals.usd) < 1e-6);
});

test('the example snapshot is whole and valid', () => {
  assert.deepEqual(validateSnapshotDir(EXAMPLE), []);
});

test('a tampered snapshot fails validation', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-tamper-'));
  fs.cpSync(EXAMPLE, tmp, { recursive: true });
  const file = path.join(tmp, path.dirname(pointer.manifest), 'details', 'examples.json');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('"constructed"', '"Constructed"'));
  assert.match(validateSnapshotDir(tmp).join('\n'), /sha256 differs[\s\S]*not one of/);
  fs.rmSync(path.join(tmp, 'latest.json'));
  assert.deepEqual(validateSnapshotDir(tmp), ['latest.json: missing']);
});

test('the example snapshot id follows identity.mjs', () => {
  const manifest = json(path.join(EXAMPLE, pointer.manifest));
  const collections = manifest.collections.map((c) => ({ ...json(path.join(snapDir, c.path)), snapshotId: PLACEHOLDER }));
  const id = snapshotId({
    sha: manifest.source.sha,
    generator: manifest.generator,
    configSha256: configSha256(),
    metricDefinitionsSha256: metricDefinitions().sha256,
    collections,
  });
  assert.equal(id, manifest.snapshotId, 'regenerate the example after changing the config or the metric definitions');
  assert.equal(canonicalJson({ b: [2, { d: 1, c: 0 }], a: null }), '{"a":null,"b":[2,{"c":0,"d":1}]}');
});

test('usage is rebucketed into Toronto days across the DST change', () => {
  // 360e8b8b's calls from 03:00Z to 04:00Z on 2026-11-01 are still 31 October in Toronto (EDT, UTC-4);
  // the local day 1 November runs 25 hours, to 05:00Z on 2 November (EST, UTC-5).
  const doc = json(path.join(UPSTREAM, 'llm-dlc/traces/360e8b8b-8e0c-4b2a-bd69-25b32f2a54eb/metrics.json'));
  const early = doc.calls.filter((c) => c.start < '2026-11-01T04:00:00Z').length;
  const late = doc.calls.length - early;
  const fable = overview.models.findIndex((m) => m.id === 'claude-fable-5-1');
  const cell = (day) => overview.usage.rows.find((r) => overview.days[r[0]] === day && r[1] === fable)?.[3] ?? 0;
  assert.ok(early > 0 && late > 0);
  assert.ok(cell('2026-10-31') >= early);
  assert.equal(overview.usage.rows.reduce((t, r) => t + r[3], 0), json(path.join(UPSTREAM, 'llm-dlc/traces/metrics.json')).totals.api_calls);
});

test('stocks are not period measures', () => {
  for (const m of overview.measures)
    assert.equal(m.scope, metrics.metrics.find((d) => d.id === m.id).kind === 'stock' ? 'snapshot' : 'all-time', m.id);
});

test('every failure case applies to the fixture', () => {
  for (const c of CASES) {
    if (c.repeat || c.network) continue;
    const { dir } = materialize(c.id);
    for (const rel of c.remove ?? []) assert.ok(!fs.existsSync(path.join(dir, rel)));
    fs.rmSync(dir, { recursive: true });
  }
});

test('the runtime and evidence examples are valid records', () => {
  assert.deepEqual(validate('runtime', json(path.join(FIX, 'runtime-observation.expired.json'))), []);
  assert.deepEqual(validate('evidence', json(path.join(FIX, 'evidence.incomplete.json'))), []);
});
