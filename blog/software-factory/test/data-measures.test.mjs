// Stream A, phase A3: computeMeasures and series in measures.mjs. Unfiltered,
// they give aggregate()'s all-time measures; filters apply only where
// config/metrics.json allows them; a range with nothing observed is null.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadConfig, normalizeSources, readSources } from '../import.mjs';
import { METRICS, computeMeasures, series } from '../measures.mjs';
import { aggregate } from '../metrics.mjs';
import { UPSTREAM } from './fixtures/cases.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXAMPLE = path.join(HERE, 'fixtures', 'snapshot-example');
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
// The example's id follows the config, so it is read, not written here.
const EXAMPLE_ID = readJson(path.join(EXAMPLE, 'latest.json')).snapshotId;
const config = loadConfig();

const byId = (records) => Object.fromEntries(records.map((r) => [r.id, r]));
const values = (records) => Object.fromEntries(records.map((r) => [r.id, r.value]));

/** Asserts computeMeasures, unfiltered, restates every all-time measure of the overview. */
function assertMatchesOverview(overview) {
  const got = byId(computeMeasures(overview, {}));
  assert.deepEqual(Object.keys(got), overview.measures.map((m) => m.id));
  for (const m of overview.measures) {
    const g = got[m.id];
    assert.equal(g.value, m.value, m.id);
    assert.equal(g.unit, m.unit, m.id);
    assert.deepEqual(g.coverage, m.coverage, m.id);
    assert.equal(g.numerator, m.numerator ?? null, m.id);
    assert.equal(g.denominator, m.denominator ?? null, m.id);
    assert.equal(g.filtered, true, m.id);
  }
}

// A small overview, made by aggregate() from hand-checkable records.
// Days 2026-11-02 to 2026-11-04 (Toronto); 11-03 has a job but no call.
const S1 = '11111111-1111-4111-8111-111111111111';
const call = (start, o = {}) => ({
  session: S1,
  subagent: false,
  start,
  model: 'claude-opus-5-5',
  effort: 'high',
  inputTokens: 10,
  cacheReadTokens: 80,
  cacheWriteTokens: 10,
  outputTokens: 5,
  usd: 0.5,
  ...o,
});
const job = (id, finishedAt, o = {}) => ({
  id,
  title: `job ${id}`,
  process: 'passed',
  signals: [],
  expected: null,
  attention: 0,
  finishedAt,
  wallSeconds: 10,
  peakMemoryBytes: null,
  capabilities: [],
  sourceCommit: null,
  submittingSession: null,
  hasJob: true,
  paths: [],
  campaign: null,
  ...o,
});
const norm = (o = {}) => ({
  source: { repository: 'pilifs/in-the-loop', sha: 'a'.repeat(40), inputs: [] },
  pricingAsOf: '2026-10-31',
  rollup: { calls: 0, usd: 0, sessions: 1 },
  calls: [],
  sessions: [{ id: S1, title: null, status: 'ended', started: null, ended: null, models: [], hasMetrics: true, inRollup: true, campaign: null }],
  changes: [],
  verification: [],
  examples: [],
  tags: { domain: [], defect: [], technique: [] },
  ...o,
});
const hand = () =>
  aggregate(
    norm({
      calls: [
        call('2026-11-02T15:00:00Z'),
        call('2026-11-02T16:00:00Z'),
        call('2026-11-02T17:00:00Z', { model: 'claude-sonnet-5-5', effort: 'medium', inputTokens: 50, cacheReadTokens: 50, cacheWriteTokens: 0, usd: 0.25 }),
        call('2026-11-04T15:00:00Z', { effort: 'medium', usd: null }),
      ],
      verification: [
        job('j1', '2026-11-03T15:00:00Z'),
        job('j2', '2026-11-04T15:00:00Z', { process: 'failed', wallSeconds: 30 }),
        job('j3', '2026-11-04T16:00:00Z', { wallSeconds: null }),
        job('j4', null),
      ],
    }),
    { config },
  ).overview;

test('the metric table equals config/metrics.json, in the overview’s order', () => {
  const metrics = readJson(path.join(HERE, '..', 'config', 'metrics.json')).metrics;
  // usage_share_by_model is a value per model (a breakdown), not one value.
  const single = metrics.filter((m) => m.id !== 'usage_share_by_model');
  assert.deepEqual(
    METRICS.map(({ id, unit, kind, filters }) => ({ id, unit, kind, filters })),
    single.map(({ id, unit, kind, filters }) => ({ id, unit, kind, filters })),
  );
  const example = readJson(path.join(EXAMPLE, 'snapshots', EXAMPLE_ID, 'overview.json'));
  assert.deepEqual(METRICS.map((m) => m.id), example.measures.map((m) => m.id));
});

test('a plain browser module: no imports, no Node APIs', async () => {
  const text = fs.readFileSync(path.join(HERE, '..', 'measures.mjs'), 'utf8');
  const code = text.replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(code, /\bimport\b|\brequire\s*\(|\bprocess\.|\bBuffer\b|node:|__dirname|globalThis\.\w+\s*=/);
  // It loads from its text alone, as the browser loads /software-factory/measures.js.
  const mod = await import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`);
  assert.deepEqual(Object.keys(mod).sort(), ['METRICS', 'computeMeasures', 'series']);
});

test('unfiltered, the values are the overview’s all-time measures', async () => {
  // The example snapshot, as published.
  assertMatchesOverview(readJson(path.join(EXAMPLE, 'snapshots', EXAMPLE_ID, 'overview.json')));
  // aggregate() on the fixture, and on the hand input.
  const sha = readJson(path.join(UPSTREAM, 'SOURCE.json')).rev;
  const normalized = normalizeSources(await readSources({ dir: UPSTREAM, sha }), config);
  assertMatchesOverview(aggregate(normalized, { config }).overview);
  assertMatchesOverview(hand());
  // A range covering every day is the same as no range, but it asks for the period filter.
  const o = hand();
  assert.deepEqual(values(computeMeasures(o, { from: '2026-11-02', to: '2026-11-05' })), values(computeMeasures(o, {})));
});

test('model, effort and period filters, by hand', () => {
  const o = hand();
  const all = byId(computeMeasures(o, {}));
  assert.deepEqual(
    [all.usage_usd.value, all.model_calls.value, all.cache_reuse.numerator, all.cache_reuse.denominator],
    [1.25, 4, 290, 400],
  );

  const opus = byId(computeMeasures(o, { models: ['claude-opus-5-5'] }));
  assert.equal(opus.usage_usd.value, 1);
  assert.deepEqual(opus.usage_usd.coverage, { included: 2, total: 3, missing: 1 });
  assert.equal(opus.model_calls.value, 3);
  assert.deepEqual([opus.cache_reuse.value, opus.cache_reuse.numerator, opus.cache_reuse.denominator], [0.8, 240, 300]);

  const medium = byId(computeMeasures(o, { efforts: ['medium'] }));
  assert.deepEqual([medium.usage_usd.value, medium.model_calls.value, medium.cache_reuse.value], [0.25, 2, 0.65]);

  // Both: the filters intersect.
  const both = byId(computeMeasures(o, { models: ['claude-opus-5-5'], efforts: ['medium'] }));
  assert.deepEqual([both.usage_usd.value, both.model_calls.value], [null, 1]); // one call, unpriced

  // Half-open: [11-04, …) holds the last day only.
  const last = byId(computeMeasures(o, { from: '2026-11-04', to: null }));
  assert.equal(last.model_calls.value, 1);
  assert.equal(last.usage_usd.value, null); // calls, none priced
  assert.equal(last.verification_completed.value, 2);
  assert.deepEqual(last.verification_completed.coverage, { included: 2, total: 3, missing: 1 }); // j4 has no finishedAt
  assert.equal(last.verification_duration_median.value, 30);
  assert.deepEqual(last.verification_duration_median.coverage, { included: 1, total: 2, missing: 1 });
  const first = byId(computeMeasures(o, { from: null, to: '2026-11-03' }));
  assert.deepEqual([first.model_calls.value, first.usage_usd.value, first.verification_completed.value], [3, 1.25, null]);
});

test('a filter a metric doesn’t support is not applied, and says so', () => {
  const o = hand();
  const all = byId(computeMeasures(o, {}));
  const opus = byId(computeMeasures(o, { models: ['claude-opus-5-5'] }));
  // Verification takes the period only: the model filter leaves it as it was.
  for (const id of ['verification_completed', 'verification_duration_median']) {
    assert.equal(opus[id].filtered, false, id);
    assert.equal(opus[id].value, all[id].value, id);
  }
  for (const id of ['usage_usd', 'model_calls', 'cache_reuse']) assert.equal(opus[id].filtered, true, id);
  // Verification with a period and a model: the period is applied, the model isn't.
  const period = byId(computeMeasures(o, { from: '2026-11-04', to: null, efforts: ['high'] }));
  assert.deepEqual([period.verification_completed.value, period.verification_completed.filtered], [2, false]);
  // Stocks take no filter: the value at the revision, filtered: false.
  const ranged = byId(computeMeasures(o, { from: '2026-11-04', to: '2026-11-05' }));
  for (const id of ['changes_recorded', 'examples_catalog']) {
    assert.equal(ranged[id].filtered, false, id);
    assert.equal(ranged[id].value, all[id].value, id);
    assert.equal(all[id].filtered, true, id);
  }
  // usage_share_by_model's filters (period, effort) are a breakdown's: not a record here.
  assert.equal(ranged.usage_share_by_model, undefined);
});

test('an empty range gives null, not 0; a quiet day inside the data is a real 0', () => {
  const o = hand();
  for (const range of [
    { from: '2026-10-01', to: '2026-11-02' }, // before the data
    { from: '2026-11-05', to: null }, // after it
    { from: '2026-11-04', to: '2026-11-04' }, // no day at all
    { from: '2026-11-04', to: '2026-11-02' }, // reversed
  ]) {
    const r = byId(computeMeasures(o, range));
    for (const m of METRICS.filter((x) => x.kind === 'period')) assert.equal(r[m.id].value, null, `${m.id} ${JSON.stringify(range)}`);
  }
  // 11-03: inside both datasets' spans, a job and no call.
  const quiet = byId(computeMeasures(o, { from: '2026-11-03', to: '2026-11-04' }));
  assert.deepEqual([quiet.model_calls.value, quiet.usage_usd.value], [0, 0]);
  assert.deepEqual([quiet.cache_reuse.value, quiet.cache_reuse.numerator, quiet.cache_reuse.denominator], [null, 0, 0]);
  assert.deepEqual([quiet.verification_completed.value, quiet.verification_duration_median.value], [1, 10]);
  // A model with no calls at all, inside the span: 0 calls, $0.
  const none = byId(computeMeasures(o, { models: ['claude-haiku-5-5'] }));
  assert.deepEqual([none.model_calls.value, none.usage_usd.value, none.cache_reuse.value], [0, 0, null]);
});

test('series: one value per day in range, null outside the data', () => {
  const o = hand();
  assert.deepEqual(series(o, 'usage_usd', {}), [
    { day: '2026-11-02', value: 1.25 },
    { day: '2026-11-03', value: 0 },
    { day: '2026-11-04', value: null },
  ]);
  assert.deepEqual(
    series(o, 'model_calls', { from: '2026-11-01', to: '2026-11-06', models: ['claude-opus-5-5'] }).map((p) => p.value),
    [null, 2, 0, 1, null],
  );
  // The verification dataset starts on 11-03.
  assert.deepEqual(series(o, 'verification_completed', {}).map((p) => p.value), [null, 1, 2]);
  assert.deepEqual(series(o, 'verification_duration_median', { from: '2026-11-03' }).map((p) => p.value), [10, 30]);
  assert.deepEqual(series(o, 'cache_reuse', { to: '2026-11-03' }), [{ day: '2026-11-02', value: 0.7 }]); // (80 + 80 + 50) / 300
  assert.deepEqual(series(o, 'cache_reuse', {}).map((p) => p.value), [0.7, null, 0.8]);
  // Across the autumn DST change, days are calendar days: 11-01 is one point.
  assert.deepEqual(series(o, 'model_calls', { from: '2026-10-31', to: '2026-11-03' }).map((p) => p.day), ['2026-10-31', '2026-11-01', '2026-11-02']);
  assert.deepEqual(series(o, 'model_calls', { from: '2026-11-04', to: '2026-11-04' }), []);
  assert.throws(() => series(o, 'changes_recorded', {}), /stock/);
  assert.throws(() => series(o, 'usage_share_by_model', {}), /unknown metric/);
});

test('series sums back to the measure on the fixture', async () => {
  const sha = readJson(path.join(UPSTREAM, 'SOURCE.json')).rev;
  const o = aggregate(normalizeSources(await readSources({ dir: UPSTREAM, sha }), config), { config }).overview;
  const total = byId(computeMeasures(o, {}));
  const calls = series(o, 'model_calls', {});
  assert.equal(calls.length, o.days.length);
  assert.equal(calls.reduce((t, p) => t + (p.value ?? 0), 0), total.model_calls.value);
  const usd = series(o, 'usage_usd', {}).reduce((t, p) => t + (p.value ?? 0), 0);
  assert.equal(Math.round(usd * 1e6) / 1e6, total.usage_usd.value);
  const jobs = series(o, 'verification_completed', {}).reduce((t, p) => t + (p.value ?? 0), 0);
  assert.equal(jobs, total.verification_completed.value);
});

test('results with none completed: no span, so null in aggregate and in measures', () => {
  const o = aggregate(norm({ calls: [call('2026-11-02T15:00:00Z')], verification: [job('j1', null)] }), { config }).overview;
  const m = byId(o.measures);
  assert.equal(m.verification_completed.value, null);
  assert.deepEqual(m.verification_completed.coverage, { included: 0, total: 1, missing: 1 });
  assertMatchesOverview(o);
});

test('bad options are refused', () => {
  const o = hand();
  assert.throws(() => computeMeasures(o, { from: '2026-11-4' }), /from must be/);
  assert.throws(() => computeMeasures(o, { to: new Date() }), /to must be/);
  assert.throws(() => computeMeasures(o, { models: 'claude-opus-5-5' }), /models must be/);
  assert.throws(() => computeMeasures({}, {}), /overview/);
});
