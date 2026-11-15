// Stream A, phase A2: aggregate() in metrics.mjs. The golden test against
// test/fixtures/snapshot-example, then one small hand-checkable input per
// aggregation rule of the plan (docs/briefs/software-factory.md, section 4).

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { PLACEHOLDER, canonicalJson, configSha256, metricDefinitions, serialize, sha256, snapshotId } from '../identity.mjs';
import { loadConfig, normalizeSources, readSources } from '../import.mjs';
import { GENERATOR, aggregate, areaOf, collectionFiles, dayStart, localDay } from '../metrics.mjs';
import { validate } from '../validate.mjs';
import { UPSTREAM } from './fixtures/cases.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXAMPLE = path.join(HERE, 'fixtures', 'snapshot-example');
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const config = loadConfig();
const SHA = readJson(path.join(UPSTREAM, 'SOURCE.json')).rev;

/** Asserts every published value of an aggregate is schema-valid. */
function valid(out) {
  assert.deepEqual(validate('manifest', out.manifest), []);
  assert.deepEqual(validate('overview', out.overview), []);
  for (const [name, value] of Object.entries(out.details)) assert.deepEqual(validate(name, value), [], name);
  return out;
}
const run = (normalized, opts = {}) => valid(aggregate(normalized, { config, ...opts }));
const measure = (out, id) => out.overview.measures.find((m) => m.id === id);
const breakdown = (out, id) => out.overview.breakdowns.find((b) => b.id === id);
const insight = (out, id) => out.overview.insights.find((i) => i.id === id);
// Usage rows as objects, with axis indexes resolved to their values.
const usageRows = (out) =>
  out.overview.usage.rows.map((r) => {
    const o = Object.fromEntries(out.overview.usage.columns.map((c, i) => [c, r[i]]));
    return { ...o, day: out.overview.days[o.day], model: out.overview.models[o.model].id, effort: out.overview.efforts[o.effort] };
  });

// Small normalized inputs, shaped as normalizeSources returns them.
const S1 = '11111111-1111-4111-8111-111111111111';
const S2 = '22222222-2222-4222-8222-222222222222';
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
const session = (id, o = {}) => ({ id, title: null, status: 'ended', started: null, ended: null, models: [], hasMetrics: true, inRollup: true, campaign: null, ...o });
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
const change = (n, o = {}) => ({ changeId: `${'k'.repeat(31)}${'klmnopqrstuvwxyz'[n]}`, summary: `Change ${n}`, sessions: [S1], housekeeping: false, campaign: null, ...o });
const example = (id, o = {}) => ({
  id,
  title: id,
  origin: 'constructed',
  system: null,
  verdict: 'verified',
  verdictLabel: null,
  vacuous: false,
  freshness: 'current',
  tags: { domain: [], defect: [], technique: [] },
  ...o,
});
const norm = (o = {}) => ({
  source: { repository: 'pilifs/in-the-loop', sha: 'a'.repeat(40), inputs: [] },
  pricingAsOf: '2026-10-31',
  rollup: { calls: 0, usd: 0, sessions: 1 },
  calls: [],
  sessions: [session(S1)],
  changes: [],
  verification: [],
  examples: [],
  tags: { domain: [], defect: [], technique: [] },
  ...o,
});

async function fixture() {
  const normalized = normalizeSources(await readSources({ dir: UPSTREAM, sha: SHA }), config);
  return { normalized, out: run(normalized) };
}

test('golden: the fixture gives the example snapshot’s tables, measures and stocks', async () => {
  const { out } = await fixture();
  const pointer = readJson(path.join(EXAMPLE, 'latest.json'));
  const base = path.join(EXAMPLE, path.dirname(pointer.manifest));
  const example = readJson(path.join(base, 'overview.json'));
  for (const key of ['days', 'models', 'efforts', 'usage', 'verification', 'measures', 'stocks', 'reported'])
    assert.deepStrictEqual(out.overview[key], example[key], key);
  assert.deepStrictEqual(out.manifest.datasets, readJson(path.join(base, 'manifest.json')).datasets);
  // The same insights, from the same templates.
  assert.deepStrictEqual(
    out.overview.insights.map((i) => i.text),
    example.insights.map((i) => i.text)
  );
});

test('the snapshot id and collection hashes follow identity.mjs', async () => {
  const { normalized, out } = await fixture();
  const { manifest, overview, details } = out;
  const files = collectionFiles(out);
  assert.deepEqual(
    manifest.collections,
    files.map(({ text, ...f }) => f)
  );
  for (const f of files) assert.equal(f.sha256, sha256(f.text));
  const withPlaceholder = files.map((f) => ({ ...JSON.parse(f.text), snapshotId: PLACEHOLDER }));
  const defs = metricDefinitions();
  assert.equal(
    manifest.snapshotId,
    snapshotId({ sha: SHA, generator: GENERATOR, configSha256: configSha256(), metricDefinitionsSha256: defs.sha256, collections: withPlaceholder })
  );
  for (const v of [overview, ...Object.values(details)]) assert.equal(v.snapshotId, manifest.snapshotId);
  assert.deepEqual(manifest.metricDefinitions, defs);
  assert.deepEqual(manifest.source.inputs, normalized.source.inputs);
  // Deterministic: the same input gives the same bytes; another config gives another id over the same content.
  assert.equal(canonicalJson(run(normalized)), canonicalJson(out));
  const other = run(normalized, { configSha256: 'f'.repeat(64) });
  assert.notEqual(other.manifest.snapshotId, manifest.snapshotId);
  assert.equal(serialize({ ...other.overview, snapshotId: null }), serialize({ ...overview, snapshotId: null }));
});

test('subagent calls count once, and the totals equal the rollup’s', async () => {
  const { normalized, out } = await fixture();
  assert.ok(normalized.calls.some((c) => c.subagent), 'the fixture has subagent calls');
  const rows = usageRows(out);
  assert.equal(measure(out, 'model_calls').value, normalized.calls.length);
  assert.equal(rows.reduce((t, r) => t + r.calls, 0), normalized.calls.length);
  // The rollup counts each recorded call once; the fixture's rollup covers the four sessions with files.
  assert.equal(measure(out, 'model_calls').value, normalized.rollup.calls);
  assert.equal(measure(out, 'usage_usd').value, Math.round(normalized.rollup.usd * 1e6) / 1e6);

  // By hand: two calls of the main agent and one subagent call are three calls, priced once each.
  const small = run(norm({ calls: [call('2026-11-05T15:00:00Z'), call('2026-11-05T15:01:00Z'), call('2026-11-05T15:02:00Z', { subagent: true, usd: 0.25 })] }));
  assert.equal(measure(small, 'model_calls').value, 3);
  assert.equal(measure(small, 'usage_usd').value, 1.25);
  assert.equal(small.details.sessions.records[0].calls, 3);
});

test('a mixed-model session’s usage is split by model, never given to one', () => {
  const out = run(
    norm({
      calls: [
        call('2026-11-05T15:00:00Z', { usd: 1 }),
        call('2026-11-05T16:00:00Z', { model: 'claude-sonnet-5-5', effort: 'medium', usd: 0.25 }),
        call('2026-11-05T17:00:00Z', { model: 'claude-sonnet-5-5', effort: 'medium', usd: 0.75 }),
      ],
    })
  );
  assert.deepEqual(
    usageRows(out).map((r) => [r.day, r.model, r.effort, r.calls, r.usd]),
    [
      ['2026-11-05', 'claude-opus-5-5', 'high', 1, 1],
      ['2026-11-05', 'claude-sonnet-5-5', 'medium', 2, 1],
    ]
  );
  assert.deepEqual(
    breakdown(out, 'usage-by-model').rows.map((r) => [r.key, r.label, r.value, r.share]),
    [
      ['claude-opus-5-5', 'Opus 5.5', 1, 0.5],
      ['claude-sonnet-5-5', 'Sonnet 5.5', 1, 0.5],
    ]
  );
  const s = out.details.sessions.records[0];
  assert.deepEqual(s.models, ['claude-opus-5-5', 'claude-sonnet-5-5']);
  assert.equal(s.usd, 2);
  // Raw ids stay ids; labels come from config/models.json, and an unknown id shows as itself.
  const raw = run(norm({ calls: [call('2026-11-05T15:00:00Z', { model: 'claude-next-1' })] }));
  assert.deepEqual(raw.overview.models, [{ id: 'claude-next-1', label: 'claude-next-1' }]);
});

test('a zero denominator is unavailable, never 0', () => {
  const zero = { inputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, usd: null };
  const out = run(norm({ calls: [call('2026-11-05T15:00:00Z', zero)], sessions: [session(S1)] }));
  const cache = measure(out, 'cache_reuse');
  assert.deepEqual([cache.value, cache.numerator, cache.denominator], [null, 0, 0]);
  assert.equal(out.details.sessions.records[0].cacheReuse, null);
  // No priced call: usage is unavailable, its shares too, and no insight is made of it.
  assert.equal(measure(out, 'usage_usd').value, null);
  assert.deepEqual(measure(out, 'usage_usd').coverage, { included: 0, total: 1, missing: 1 });
  assert.deepEqual(
    breakdown(out, 'usage-by-model').rows.map((r) => [r.value, r.share]),
    [[null, null]]
  );
  assert.equal(out.details.sessions.records[0].usd, null);
  // No jobs: no completed count, no median; no insight either.
  assert.equal(measure(out, 'verification_completed').value, null);
  assert.equal(measure(out, 'verification_duration_median').value, null);
  assert.deepEqual(out.overview.insights, []);

  // Weighted, never an average of ratios: (90 + 0) / (100 + 900) = 0.09, not (0.9 + 0) / 2.
  const weighted = run(
    norm({
      calls: [
        call('2026-11-05T15:00:00Z', { inputTokens: 5, cacheReadTokens: 90, cacheWriteTokens: 5 }),
        call('2026-11-05T15:01:00Z', { inputTokens: 900, cacheReadTokens: 0, cacheWriteTokens: 0 }),
      ],
    })
  );
  assert.deepEqual([measure(weighted, 'cache_reuse').numerator, measure(weighted, 'cache_reuse').denominator], [90, 1000]);
  assert.equal(measure(weighted, 'cache_reuse').value, 0.09);
  assert.equal(insight(weighted, 'weighted-cache-reuse').text, '9.0% of input tokens were read from cache (all time).');
});

test('partial coverage is counted, never filled in', () => {
  const out = run(
    norm({
      sessions: [session(S1), session(S2, { hasMetrics: false, models: ['claude-opus-5-5'] })],
      calls: [call('2026-11-05T15:00:00Z', { usd: 2 }), call('2026-11-05T15:01:00Z', { usd: null })],
      verification: [
        job('a', '2026-11-05T15:00:00.000Z', { wallSeconds: 30 }),
        job('b', '2026-11-05T16:00:00.000Z', { wallSeconds: 0 }),
        job('c', '2026-11-05T17:00:00.000Z', { wallSeconds: 10 }),
        job('d', null),
      ],
      examples: [example('x'), example('y', { verdict: null, freshness: null, vacuous: null })],
    })
  );
  assert.deepEqual(measure(out, 'usage_usd'), { id: 'usage_usd', value: 2, unit: 'usd', scope: 'all-time', coverage: { included: 1, total: 2, missing: 1 } });
  assert.deepEqual(measure(out, 'model_calls').coverage, { included: 1, total: 2, missing: 1, note: 'sessions with a metrics file' });
  assert.equal(measure(out, 'model_calls').value, 2);
  // A session without a metrics file has unknown calls and usage, not zero.
  const s2 = out.details.sessions.records.find((s) => s.id === S2);
  assert.deepEqual([s2.calls, s2.usd, s2.hasMetrics, s2.models], [null, null, false, ['claude-opus-5-5']]);
  // The job without finishedAt is in no table and no detail, only in coverage; 0 seconds is not an observation.
  assert.deepEqual(measure(out, 'verification_completed').coverage, { included: 3, total: 4, missing: 1 });
  assert.deepEqual(out.overview.verification.rows, [
    [0, 0, 30],
    [0, 0, null],
    [0, 0, 10],
  ]);
  assert.deepEqual(
    out.details.verification.records.map((r) => [r.id, r.wallSeconds]),
    [
      ['a', 30],
      ['b', null],
      ['c', 10],
    ]
  );
  const med = measure(out, 'verification_duration_median');
  assert.deepEqual([med.value, med.coverage], [20, { included: 2, total: 3, missing: 1 }]);
  assert.equal(insight(out, 'median-verification').text, 'The median verification job took 20 seconds (2 jobs, all time).');
  assert.deepEqual(measure(out, 'examples_catalog').coverage, { included: 1, total: 2, missing: 1, note: 'examples with a verdict' });
  assert.deepEqual(out.overview.stocks.examples, { total: 2, origin: { constructed: 2 }, verdict: { verified: 1, none: 1 }, vacuous: 0, freshness: { current: 1, absent: 1 } });
});

const evidence = (o = {}) => ({ tests: null, counterexample: null, trace: null, seconds: null, checker: null, ...o });

test('the catalog’s answers are counted by verdict, and an example with none is in neither count', () => {
  const out = run(
    norm({
      examples: [
        example('a', { verdict: 'violation', testsPassed: true, severity: 'critical', path: 'examples/a', summary: 'Found.', sourceUrl: 'https://example.invalid/1', changeKind: 'refactor', evidence: evidence({ counterexample: { input: 'f(0)', expected: '1', actual: '2', count: 3 }, seconds: 9 }) }),
        // A trace and an input: counted once, as an input. A trace alone: as a trace. A violation with neither is in neither.
        example('b', { verdict: 'violation', testsPassed: true, severity: 'high', evidence: evidence({ counterexample: { input: 'g()', expected: null, actual: null, count: 1 }, trace: { invariant: 'Safe', steps: 2, actions: ['Init', 'Next'], states: 7 }, seconds: 2 }) }),
        example('c', { verdict: 'violation', testsPassed: false, severity: 'high', evidence: evidence({ trace: { invariant: null, steps: 1, actions: [], states: null } }) }),
        example('d', { verdict: 'verified', testsPassed: true, severity: 'none', evidence: evidence({ seconds: 4, counterexample: { input: 'not a violation', expected: null, actual: null, count: 1 } }) }),
        example('e', { verdict: null, testsPassed: null, severity: 'low' }),
        example('f', { verdict: 'verified' }),
      ],
    })
  );
  assert.deepEqual(out.overview.catalog, {
    coverage: { included: 4, total: 6, missing: 2, note: 'examples whose entry says whether the existing tests passed' },
    tests: { violation: { passed: 2, failed: 1 }, verified: { passed: 1 } },
    severity: { violation: { critical: 1, high: 2 }, verified: { none: 1 }, none: { low: 1 } },
    counterexamples: { violations: 3, input: 2, trace: 1 },
    // The middle of 2, 4 and 9 seconds, whatever the verdict.
    attempts: { timed: 3, medianSeconds: 4 },
  });
  const [a, , , , , f] = out.details.examples.records;
  assert.deepEqual(a.evidence, { tests: null, counterexample: { input: 'f(0)', expected: '1', actual: '2', count: 3 }, trace: null, seconds: 9, checker: null });
  assert.equal(f.evidence, null);
  assert.deepEqual([a.path, a.summary, a.sourceUrl, a.testsPassed, a.severity, a.changeKind], ['examples/a', 'Found.', 'https://example.invalid/1', true, 'critical', 'refactor']);
  assert.deepEqual([f.path, f.summary, f.sourceUrl, f.testsPassed, f.severity, f.changeKind], [null, null, null, null, null, null]);
  // No examples: an empty count, never a missing one, and still valid.
  assert.deepEqual(run(norm()).overview.catalog, {
    coverage: { included: 0, total: 0, missing: 0, note: 'examples whose entry says whether the existing tests passed' },
    tests: {},
    severity: {},
    counterexamples: { violations: 0, input: 0, trace: 0 },
    attempts: { timed: 0, medianSeconds: null },
  });
  // With two timed attempts the middle is the lower one: a value that was measured, not an average.
  const two = run(norm({ examples: [example('a', { evidence: evidence({ seconds: 1.5 }) }), example('b', { evidence: evidence({ seconds: 30 }) })] }));
  assert.deepEqual(two.overview.catalog.attempts, { timed: 2, medianSeconds: 1.5 });
});

test('days are half-open Toronto days from UTC instants, with no gaps', () => {
  const out = run(
    norm({
      calls: [
        call('2026-10-27T15:00:00.000Z'),
        call('2026-10-30T03:59:59.999Z'), // 23:59:59.999 EDT on the 29th
        call('2026-10-30T04:00:00.000Z'), // midnight EDT: the 30th
      ],
      verification: [job('a', '2026-10-31T03:59:59.000Z')], // the 30th, Toronto
    })
  );
  assert.deepEqual(out.overview.days, ['2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30']);
  assert.deepEqual(
    usageRows(out).map((r) => [r.day, r.calls]),
    [
      ['2026-10-27', 1],
      ['2026-10-29', 1],
      ['2026-10-30', 1],
    ]
  );
  assert.deepEqual(out.overview.verification.rows, [[3, 0, 10]]);
  const [usage, verification] = out.manifest.datasets;
  assert.deepEqual([usage.from, usage.to], ['2026-10-27T04:00:00.000Z', '2026-10-31T04:00:00.000Z']);
  assert.deepEqual([verification.from, verification.to], ['2026-10-30T04:00:00.000Z', '2026-10-31T04:00:00.000Z']);
});

test('the DST day is 25 hours long, and spring’s is 23', () => {
  const out = run(
    norm({
      calls: [
        call('2026-11-01T04:00:00Z'), // 00:00 EDT, Nov 1
        call('2026-11-01T05:30:00Z'), // 01:30 EDT
        call('2026-11-01T06:30:00Z'), // 01:30 EST, after the clocks went back
        call('2026-11-02T04:59:59Z'), // 23:59:59 EST, still Nov 1
        call('2026-11-02T05:00:00Z'), // midnight EST: Nov 2
      ],
    })
  );
  assert.deepEqual(out.overview.days, ['2026-11-01', '2026-11-02']);
  assert.deepEqual(
    usageRows(out).map((r) => [r.day, r.calls]),
    [
      ['2026-11-01', 4],
      ['2026-11-02', 1],
    ]
  );
  assert.equal(dayStart('2026-11-01'), '2026-11-01T04:00:00.000Z');
  assert.equal(dayStart('2026-11-02'), '2026-11-02T05:00:00.000Z');
  assert.equal(Date.parse(dayStart('2026-11-02')) - Date.parse(dayStart('2026-11-01')), 25 * 3600e3);
  assert.equal(Date.parse(dayStart('2027-03-15')) - Date.parse(dayStart('2027-03-14')), 23 * 3600e3);
  assert.equal(localDay('2027-03-14T06:59:59Z'), '2027-03-14');
  assert.deepEqual(out.manifest.datasets[0].to, '2026-11-03T05:00:00.000Z');
});

test('changes are counted once, housekeeping apart, and placed by the area rule', () => {
  const out = run(
    norm({
      changes: [
        change(0, { summary: 'Record session traces', housekeeping: true }),
        change(1, { summary: 'engine-priorities step 2: x', campaign: 'engine-priorities' }),
        change(2, { summary: 'Tidy', campaign: 'example-targets-3' }),
        change(3, { summary: 'Something', sessions: [] }),
      ],
    })
  );
  assert.deepEqual(out.overview.stocks.changes, { total: 4, housekeeping: 1 });
  assert.deepEqual(measure(out, 'changes_recorded'), { id: 'changes_recorded', value: 4, unit: 'changes', scope: 'snapshot', coverage: { included: 3, total: 4 } });
  assert.deepEqual(
    out.details.changes.records.map((c) => [c.housekeeping, c.area]),
    [
      [true, 'agent-process'],
      [false, 'verification-engine'],
      [false, 'example-catalog'],
      [false, 'unassigned'],
    ]
  );
  // Unassigned is always shown, beside every area that has a change.
  const areas = breakdown(out, 'changes-by-area');
  assert.deepEqual(
    areas.rows.map((r) => [r.key, r.value]),
    [
      ['verification-engine', 1],
      ['example-catalog', 1],
      ['agent-process', 1],
      ['unassigned', 1],
    ]
  );
  assert.deepEqual(areas.coverage, { included: 3, total: 4, note: 'area mapping accepted' });
  assert.equal(out.details.sessions.records[0].changes, 3);

  // The rule itself: the longest matching campaign, then paths that all fall in one area.
  const areasConfig = {
    unassigned: { id: 'unassigned' },
    areas: [
      { id: 'a', paths: ['lib/'], campaigns: ['clean'] },
      { id: 'b', paths: ['examples/'], campaigns: ['clean-examples'] },
    ],
  };
  assert.equal(areaOf({ campaign: 'clean-examples-2' }, areasConfig), 'b');
  assert.equal(areaOf({ campaign: 'clean-lib' }, areasConfig), 'a');
  assert.equal(areaOf({ campaign: 'cleanup' }, areasConfig), 'unassigned');
  assert.equal(areaOf({ paths: ['examples/x', 'examples/y'] }, areasConfig), 'b');
  assert.equal(areaOf({ paths: ['examples/x', 'lib/y'] }, areasConfig), 'unassigned');
  assert.equal(areaOf({ campaign: 'clean', housekeeping: true }, areasConfig), 'agent-process');
});

test('a job’s process outcome stays apart from its signals and expectation', () => {
  const out = run(
    norm({
      verification: [
        job('found', '2026-11-05T15:00:00Z', { process: 'passed', signals: [{ name: 'jvmcontract:fails', count: 2 }], expected: 'violation' }),
        job('broke', '2026-11-05T16:00:00Z', { process: 'failed', attention: 3, paths: ['lib/x'] }),
      ],
    })
  );
  assert.deepEqual(out.overview.verification.rows, [
    [0, 0, 10],
    [0, 1, 10],
  ]);
  const [found, broke] = out.details.verification.records;
  assert.deepEqual([found.process, found.signals, found.expected], ['passed', [{ name: 'jvmcontract:fails', count: 2 }], 'violation']);
  assert.deepEqual([broke.process, broke.signals, broke.attention, broke.area], ['failed', [], 3, 'verification-engine']);
  assert.equal(measure(out, 'verification_completed').value, 2);
});

test('stocks are counts at the revision, never period values', async () => {
  const { out } = await fixture();
  for (const id of ['changes_recorded', 'examples_catalog']) assert.equal(measure(out, id).scope, 'snapshot');
  for (const m of out.overview.measures.filter((m) => !['changes_recorded', 'examples_catalog'].includes(m.id))) assert.equal(m.scope, 'all-time');
  const kinds = Object.fromEntries(out.manifest.datasets.map((d) => [d.id, [d.kind, d.from, d.to]]));
  assert.deepEqual(kinds.changes, ['stock', null, null]);
  assert.deepEqual(kinds.catalog, ['stock', null, null]);
  for (const b of out.overview.breakdowns.filter((b) => b.dimension.startsWith('example') || b.dimension === 'area' || b.dimension === 'verdict'))
    assert.equal(b.scope, 'snapshot', b.id);
});

test('insights fill config/metrics.json’s templates, and every one carries coverage and evidence', async () => {
  const { out } = await fixture();
  const metrics = readJson(path.join(HERE, '..', 'config', 'metrics.json'));
  for (const i of out.overview.insights) {
    const t = metrics.insights.find((x) => x.id === i.id);
    assert.ok(t, i.id);
    assert.equal(i.metricId, t.metricId);
    const pattern = new RegExp(`^${t.template.replace(/[.()]/g, '\\$&').replace(/\{[a-z]+\}/g, '.+')}$`);
    assert.match(i.text, pattern);
    assert.ok(i.coverage && i.evidence.collection);
  }
  // A template edited in the config is the one used.
  const custom = { ...metrics, insights: [{ id: 'weighted-cache-reuse', metricId: 'cache_reuse', template: 'Cache: {share}, {scope}.' }] };
  const small = run(norm({ calls: [call('2026-11-05T15:00:00Z')] }), { config: { ...config, metrics: custom } });
  assert.deepEqual(
    small.overview.insights.map((i) => i.text),
    ['Cache: 80.0%, all time.']
  );
});

test('no activity gives empty axes and unbounded datasets, still valid', () => {
  const out = run(norm({ sessions: [session(S1, { hasMetrics: false })] }));
  assert.deepEqual([out.overview.days, out.overview.models, out.overview.efforts, out.overview.usage.rows], [[], [], [], []]);
  assert.deepEqual(
    out.manifest.datasets.slice(0, 2).map((d) => [d.from, d.to]),
    [
      [null, null],
      [null, null],
    ]
  );
  assert.equal(measure(out, 'model_calls').value, null);
  // Effort may be absent from a call: it is its own axis value, null, never folded into another.
  const noEffort = run(norm({ calls: [call('2026-11-05T15:00:00Z', { effort: null }), call('2026-11-05T15:00:00Z')] }));
  assert.deepEqual(noEffort.overview.efforts, ['high', null]);
  assert.deepEqual(
    breakdown(noEffort, 'usage-by-effort').rows.map((r) => [r.key, r.label, r.value]),
    [
      ['high', 'high', 0.5],
      ['none', 'No effort recorded', 0.5],
    ]
  );
});

test('thinking tokens and the price with nothing cached are summed by row, and a row missing one says so', () => {
  const out = run(
    norm({
      calls: [
        call('2026-11-05T15:00:00Z', { thinkingTokens: 2, uncachedUsd: 4 }),
        call('2026-11-05T16:00:00Z', { thinkingTokens: 3, uncachedUsd: 1.5 }),
        // Another row: one of its calls has neither, so the row has neither.
        call('2026-11-06T15:00:00Z', { thinkingTokens: 1, uncachedUsd: 2 }),
        call('2026-11-06T16:00:00Z', { thinkingTokens: null, uncachedUsd: null }),
        // An unpriced call has no price either way, and takes nothing from its row's.
        call('2026-11-07T15:00:00Z', { thinkingTokens: 4, uncachedUsd: 3 }),
        call('2026-11-07T16:00:00Z', { usd: null, thinkingTokens: 0, uncachedUsd: null }),
      ],
    })
  );
  assert.deepEqual(out.overview.usage.columns.slice(-2), ['thinkingTokens', 'uncachedUsd']);
  const rows = usageRows(out);
  assert.deepEqual(
    rows.map((r) => [r.day, r.thinkingTokens, r.uncachedUsd, r.usd]),
    [
      ['2026-11-05', 5, 5.5, 1],
      ['2026-11-06', null, null, 1],
      ['2026-11-07', 4, 3, 0.5],
    ]
  );
  // The estimate is untouched by either: they are other figures.
  assert.equal(measure(out, 'usage_usd').value, 2.5);
});

test('what the client counted itself is carried beside the estimate, with the sessions it covers', () => {
  assert.equal(run(norm({ calls: [call('2026-11-05T15:00:00Z')] })).overview.reported, null);
  const out = run(norm({ calls: [call('2026-11-05T15:00:00Z')], reported: { sessions: 2, ofSessions: 3, usd: 12.3456789, callsUsd: 10, unattributedUsd: null } }));
  assert.deepEqual(out.overview.reported, {
    coverage: { included: 2, total: 3, missing: 1, note: 'sessions that had stopped, so the client had written its own count' },
    usd: 12.345679,
    callsUsd: 10,
    unattributedUsd: null,
  });
  assert.equal(measure(out, 'usage_usd').value, 0.5);
});

test('the source’s account of its loops is carried whole, with typed prompts and the loop run by hand apart', () => {
  assert.equal(run(norm({ calls: [call('2026-11-05T15:00:00Z')] })).overview.loopAccount, null);
  const stat = (o) => ({ runs: 1, cycles: 1, cyclesCommitted: 1, commits: 1, calls: 5, toolCalls: 10, toolErrors: 0, outputTokens: 100, usd: 1.23456789, agentSeconds: 60, busySeconds: 50, modelSeconds: 30, toolSeconds: 25, compactions: 0, peakContextTokens: 900, jobs: 0, jobsPassed: 0, jobsFailed: 0, ...o });
  const group = (o) => stat({ sessions: 1, models: ['claude-opus-5-5'], first: '2026-11-01T10:00:00.000Z', last: '2026-11-01T12:00:00.000Z', medianCycleUsd: 0.1234567, medianCycleBusySeconds: 25, ...o });
  const account = {
    pricingAsOf: '2026-11-15',
    totals: { loops: 2, ...group({ runs: 3, cycles: 5, commits: 6, toolCalls: 60 }), runsFromRecords: 1, runsFromTranscripts: 2 },
    categories: [{ category: 'moonshot', loops: 1, ...group({ cycles: 3, commits: 3 }) }, { category: 'brief', loops: 1, ...group({ runs: 2, cycles: 2, commits: 3 }) }],
    loops: [
      { loop: 'by-hand', category: 'moonshot', kind: 'moonshot by hand', streamOf: null, ...group({ cycles: 3, commits: 3 }) },
      { loop: 'core-values', category: 'brief', kind: 'brief stream', streamOf: 'core', ...group({ runs: 2, cycles: 2, commits: 3 }) },
    ],
    runs: [
      { run: 'a', loop: 'by-hand', kind: 'moonshot by hand', category: 'moonshot', source: 'transcript', started: '2026-11-01T10:00:00.000Z', ended: null, outcome: 'unrecorded', interjections: 0, ...stat({ cycles: 3, commits: 3, toolCalls: 7 }) },
      { run: 'b', loop: 'core-values', kind: 'brief stream', category: 'brief', source: 'record', started: '2026-11-02T10:00:00.000Z', ended: null, outcome: 'ended', interjections: 2, ...stat({ commits: 2 }) },
      { run: 'c', loop: 'core-values', kind: 'brief stream', category: 'brief', source: 'record', started: '2026-11-03T10:00:00.000Z', ended: null, outcome: 'ended', interjections: 1, ...stat({}) },
    ],
  };
  const a = run(norm({ calls: [call('2026-11-05T15:00:00Z')], loopAccount: account })).overview.loopAccount;
  assert.deepEqual([a.totals.loops, a.totals.runs, a.totals.cycles, a.totals.commits, a.totals.usd, a.totals.medianCycleUsd], [2, 3, 5, 6, 1.234568, 0.123457]);
  assert.equal(a.interjections, 3);
  assert.deepEqual(a.byHand, { loops: 1, runs: 1, cycles: 3, commits: 3, toolCalls: 7 });
  assert.deepEqual(a.categories.map((c) => c.category), ['moonshot', 'brief']);
  assert.deepEqual(a.loops.map((l) => [l.loop, l.kind, l.streamOf]), [['by-hand', 'moonshot by hand', null], ['core-values', 'brief stream', 'core']]);
  // The runs themselves are not in the overview: it carries the sums.
  assert.equal('runs' in a && Array.isArray(a.runs), false);
});
