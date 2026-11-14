// Writes test/fixtures/snapshot-example/: a whole, schema-valid snapshot made
// from test/fixtures/upstream by a deliberately plain reference computation.
//
//   node blog/software-factory/test/fixtures/make-snapshot-example.mjs
//
// Two uses:
//   - stream B renders against it (tests, and drafts previews with
//     SOFTWARE_FACTORY_DATA_DIR=blog/software-factory/test/fixtures/snapshot-example,
//     where the pages say they show a fixture);
//   - stream A's aggregate() must reproduce, for the same input, its usage and
//     verification tables, its measures and its stocks (a golden test).
//     Breakdowns, insights and details are a starting point A may refine within
//     schema.json. Snapshot ids differ, since the generator differs.
//
// It is test data: it never goes in blog/software-factory/data/.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLACEHOLDER, configSha256, metricDefinitions, serialize, sha256, snapshotId } from '../../identity.mjs';
import { validate, validateSnapshotDir } from '../../validate.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const UP = path.join(HERE, 'upstream');
const OUT = path.join(HERE, 'snapshot-example');
const CONFIG = path.join(HERE, '..', '..', 'config');
const cfg = (f) => JSON.parse(fs.readFileSync(path.join(CONFIG, f), 'utf8'));
const source = cfg('source.json');
const areas = cfg('areas.json');
const models = cfg('models.json');
const TZ = source.timezone;
const GENERATOR = { name: 'blog/software-factory/test/fixtures/make-snapshot-example.mjs', version: '1' };

const inputs = [];
const read = (rel) => {
  const bytes = fs.readFileSync(path.join(UP, rel));
  const json = JSON.parse(bytes);
  inputs.push({ path: rel, sha256: sha256(bytes), bytes: bytes.length, schema: json.schema ?? '' });
  return json;
};
const upstreamSource = JSON.parse(fs.readFileSync(path.join(UP, 'SOURCE.json'), 'utf8'));
const rollup = read('llm-dlc/traces/metrics.json');
const index = read('llm-dlc/index.json');
const results = read('verification/results/index.json').results;
const examples = read('examples/index.json').examples;
read('examples/tags.json');

// Local calendar day of a UTC instant, in the timezone.
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const localDay = (instant) => dayFmt.format(new Date(instant));
const round6 = (n) => Math.round(n * 1e6) / 1e6;
const label = (id) => models.aliases[id] ?? id;

// Calls, from each session's metrics file where there is one.
const calls = [];
const sessionsWithMetrics = new Set();
for (const s of index.sessions) {
  const rel = `llm-dlc/traces/${s.session_id}/metrics.json`;
  if (!fs.existsSync(path.join(UP, rel))) continue;
  sessionsWithMetrics.add(s.session_id);
  for (const c of read(rel).calls) calls.push({ ...c, session: s.session_id });
}

// Days: every local day from the first to the last with any activity.
const activity = [...calls.map((c) => localDay(c.start)), ...results.map((r) => localDay(r.finishedAt))].sort();
const days = [];
for (let d = new Date(`${activity[0]}T12:00:00Z`); ; d.setUTCDate(d.getUTCDate() + 1)) {
  const iso = d.toISOString().slice(0, 10);
  days.push(iso);
  if (iso === activity.at(-1)) break;
}
const modelIds = [...new Set(calls.map((c) => c.model))].sort();
const efforts = [...new Set(calls.map((c) => c.effort))].sort();

// Usage: calls by (day, model, effort).
const cells = new Map();
for (const c of calls) {
  const key = [days.indexOf(localDay(c.start)), modelIds.indexOf(c.model), efforts.indexOf(c.effort)].join(',');
  const cell = cells.get(key) ?? { calls: 0, priced: 0, usd: 0, input: 0, read: 0, write: 0, output: 0 };
  cell.calls++;
  if (typeof c.usd === 'number') {
    cell.priced++;
    cell.usd += c.usd;
  }
  cell.input += c.input_tokens;
  cell.read += c.cache_read_tokens;
  cell.write += c.cache_write_tokens;
  cell.output += c.output_tokens;
  cells.set(key, cell);
}
const usage = {
  columns: ['day', 'model', 'effort', 'calls', 'pricedCalls', 'usd', 'inputTokens', 'cacheReadTokens', 'cacheWriteTokens', 'outputTokens'],
  rows: [...cells]
    .map(([key, c]) => [...key.split(',').map(Number), c.calls, c.priced, round6(c.usd), c.input, c.read, c.write, c.output])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]),
};

// Verification: one row per completed job.
const STATUSES = ['passed', 'failed'];
const validSeconds = (s) => (typeof s === 'number' && Number.isFinite(s) && s > 0 ? s : null);
const completed = results.filter((r) => r.finishedAt).sort((a, b) => a.finishedAt.localeCompare(b.finishedAt));
const verification = {
  columns: ['day', 'status', 'wallSeconds'],
  rows: completed.map((r) => [days.indexOf(localDay(r.finishedAt)), STATUSES.indexOf(r.status), validSeconds(r.wallSeconds)]),
};

// Measures, all time.
const total = (k) => calls.reduce((s, c) => s + (c[k] ?? 0), 0);
const priced = calls.filter((c) => typeof c.usd === 'number');
const usd = round6(priced.reduce((s, c) => s + c.usd, 0));
const cacheNum = total('cache_read_tokens');
const cacheDen = total('input_tokens') + total('cache_read_tokens') + total('cache_write_tokens');
const durations = completed.map((r) => validSeconds(r.wallSeconds)).filter((s) => s !== null).sort((a, b) => a - b);
const median = durations.length
  ? durations.length % 2
    ? durations[(durations.length - 1) / 2]
    : (durations[durations.length / 2 - 1] + durations[durations.length / 2]) / 2
  : null;
const housekeepingSummaries = new Set(source.housekeeping.summaries);
const changeIds = new Map();
for (const c of rollup.commits) if (!changeIds.has(c.change_id)) changeIds.set(c.change_id, c);
const changes = [...changeIds.values()];
const measures = [
  { id: 'usage_usd', value: usd, unit: 'usd', scope: 'all-time', coverage: { included: priced.length, total: calls.length, missing: calls.length - priced.length } },
  { id: 'model_calls', value: calls.length, unit: 'calls', scope: 'all-time', coverage: { included: sessionsWithMetrics.size, total: index.sessions.length, missing: index.sessions.length - sessionsWithMetrics.size, note: 'sessions with a metrics file' } },
  { id: 'cache_reuse', value: cacheDen ? cacheNum / cacheDen : null, unit: 'ratio', scope: 'all-time', numerator: cacheNum, denominator: cacheDen, coverage: { included: calls.length, total: calls.length } },
  { id: 'verification_completed', value: completed.length, unit: 'jobs', scope: 'all-time', coverage: { included: completed.length, total: results.length, missing: results.length - completed.length } },
  { id: 'verification_duration_median', value: median, unit: 'seconds', scope: 'all-time', coverage: { included: durations.length, total: completed.length, missing: completed.length - durations.length } },
  { id: 'changes_recorded', value: changes.length, unit: 'changes', scope: 'snapshot', coverage: { included: changes.filter((c) => c.sessions.length).length, total: changes.length } },
  { id: 'examples_catalog', value: examples.length, unit: 'examples', scope: 'snapshot', coverage: { included: examples.filter((x) => x.verdict != null).length, total: examples.length, missing: examples.filter((x) => x.verdict == null).length, note: 'examples with a verdict' } },
];

// Stocks.
const countBy = (rows, key) => rows.reduce((m, r) => ((m[key(r)] = (m[key(r)] ?? 0) + 1), m), {});
const stocks = {
  changes: { total: changes.length, housekeeping: changes.filter((c) => housekeepingSummaries.has(c.summary)).length },
  examples: {
    total: examples.length,
    origin: countBy(examples, (x) => x.origin),
    verdict: countBy(examples, (x) => x.verdict ?? 'none'),
    vacuous: examples.filter((x) => x.vacuous === true).length,
    freshness: countBy(examples, (x) => x.snapshot ?? 'absent'),
  },
};

// Areas (config/areas.json rule).
const campaignOf = (text) => text?.match(/^([a-z][a-z0-9]*(?:-[a-z0-9]+)+)[ :]/)?.[1] ?? null;
function areaOf({ campaign, paths = [], housekeeping = false }) {
  if (housekeeping) return 'agent-process';
  let best = null;
  for (const a of areas.areas)
    for (const c of a.campaigns)
      if (campaign && (campaign === c || campaign.startsWith(`${c}-`)) && (!best || c.length > best.len)) best = { id: a.id, len: c.length };
  if (best) return best.id;
  if (paths.length)
    for (const a of areas.areas) if (paths.every((p) => a.paths.some((ap) => p.startsWith(ap)))) return a.id;
  return areas.unassigned.id;
}
const areaLabel = (id) => (areas.areas.find((a) => a.id === id) ?? areas.unassigned).label;

// Breakdowns.
const byModel = modelIds.map((m) => priced.filter((c) => c.model === m).reduce((s, c) => s + c.usd, 0));
const byEffort = efforts.map((e) => priced.filter((c) => c.effort === e).reduce((s, c) => s + c.usd, 0));
const changeRecords = changes.map((c) => {
  const housekeeping = housekeepingSummaries.has(c.summary);
  return { changeId: c.change_id, summary: c.summary, sessions: c.sessions, housekeeping, area: areaOf({ campaign: campaignOf(c.summary), housekeeping }) };
});
const areaCounts = countBy(changeRecords, (c) => c.area);
const share = (v, t) => (t ? v / t : null);
const breakdowns = [
  { id: 'usage-by-model', metricId: 'usage_share_by_model', dimension: 'model', scope: 'all-time', rows: modelIds.map((m, i) => ({ key: m, label: label(m), value: round6(byModel[i]), share: share(byModel[i], usd) })), coverage: { included: priced.length, total: calls.length } },
  { id: 'usage-by-effort', metricId: 'usage_usd', dimension: 'effort', scope: 'all-time', rows: efforts.map((e, i) => ({ key: e, label: e, value: round6(byEffort[i]), share: share(byEffort[i], usd) })), coverage: { included: priced.length, total: calls.length } },
  { id: 'changes-by-area', metricId: 'changes_recorded', dimension: 'area', scope: 'snapshot', rows: [...areas.areas.map((a) => a.id), areas.unassigned.id].filter((id) => areaCounts[id]).map((id) => ({ key: id, label: areaLabel(id), value: areaCounts[id], share: share(areaCounts[id], changes.length) })), coverage: { included: changes.length - (areaCounts.unassigned ?? 0), total: changes.length, note: `area mapping ${areas.status}` } },
  { id: 'examples-by-system', metricId: 'examples_catalog', dimension: 'exampleSystem', scope: 'snapshot', rows: Object.entries(countBy(examples, (x) => x.system ?? 'none')).map(([k, v]) => ({ key: k, label: k === 'none' ? 'No system' : k, value: v, share: share(v, examples.length) })), coverage: { included: examples.filter((x) => x.system).length, total: examples.length } },
  { id: 'examples-by-origin', metricId: 'examples_catalog', dimension: 'exampleOrigin', scope: 'snapshot', rows: Object.entries(stocks.examples.origin).map(([k, v]) => ({ key: k, label: k, value: v, share: share(v, examples.length) })), coverage: { included: examples.length, total: examples.length } },
];

// Insights: descriptive, from the values above.
const top = breakdowns[0].rows.reduce((a, b) => (b.value > a.value ? b : a));
const pct = (r) => `${(r * 100).toFixed(1)}%`;
const insights = [
  { id: 'top-model-share', metricId: 'usage_share_by_model', text: `${top.label} accounts for ${pct(top.share)} of estimated usage (all time).`, value: top.share, scope: 'all-time', coverage: breakdowns[0].coverage, evidence: { collection: 'overview', breakdown: 'usage-by-model' } },
  { id: 'weighted-cache-reuse', metricId: 'cache_reuse', text: `${pct(measures[2].value)} of input tokens were read from cache (all time).`, value: measures[2].value, scope: 'all-time', coverage: measures[2].coverage, evidence: { collection: 'overview', breakdown: null } },
  { id: 'median-verification', metricId: 'verification_duration_median', text: `The median verification job took ${Math.round(median)} seconds (${durations.length} jobs, all time).`, value: median, scope: 'all-time', coverage: measures[4].coverage, evidence: { collection: 'verification', breakdown: null } },
];

// Details.
const rollupSessions = new Map(rollup.sessions.map((s) => [s.session_id, s]));
const sessionRecords = index.sessions.map((s) => {
  const own = calls.filter((c) => c.session === s.session_id);
  const num = own.reduce((t, c) => t + c.cache_read_tokens, 0);
  const den = own.reduce((t, c) => t + c.input_tokens + c.cache_read_tokens + c.cache_write_tokens, 0);
  const has = sessionsWithMetrics.has(s.session_id);
  return {
    id: s.session_id,
    title: s.title,
    status: s.status,
    started: s.started,
    ended: s.ended,
    models: [...new Set(own.map((c) => c.model))].sort(),
    calls: has ? own.length : null,
    usd: has ? round6(own.reduce((t, c) => t + (c.usd ?? 0), 0)) : null,
    cacheReuse: den ? num / den : null,
    changes: changeRecords.filter((c) => c.sessions.includes(s.session_id)).length,
    hasMetrics: has,
    summaryUrl: source.summaryUrl.replace('{sha}', upstreamSource.rev).replace('{session}', s.session_id),
  };
});
void rollupSessions;
const jobOf = (id) => {
  const file = path.join(UP, 'verification', 'jobs', `${id}.json`);
  return fs.existsSync(file) ? read(`verification/jobs/${id}.json`) : null;
};
const signalsOf = (summary) =>
  (summary.match(/signals: (.*)$/)?.[1] ?? '')
    .split(/;\s*|,\s*/)
    .filter(Boolean)
    .map((s) => {
      const m = s.match(/^(.*?)(?:×(\d+))?$/);
      return { name: m[1].trim(), count: Number(m[2] ?? 1) };
    });
const verificationRecords = completed.map((r) => {
  const job = jobOf(r.id);
  return {
    id: r.id,
    title: r.title,
    process: r.status,
    signals: signalsOf(r.summary),
    expected: job?.expected ?? null,
    attention: r.attention.length,
    finishedAt: r.finishedAt,
    wallSeconds: validSeconds(r.wallSeconds),
    peakMemoryBytes: r.peakMemoryBytes ?? null,
    capabilities: r.capabilities,
    sourceCommit: r.sourceCommit ?? null,
    submittingSession: job?.submitted?.session ?? null,
    area: areaOf({ campaign: campaignOf(r.title), paths: r.links?.paths ?? [] }),
  };
});
const exampleRecords = examples.map((x) => ({
  id: x.id,
  title: x.title,
  origin: x.origin,
  system: x.system ?? null,
  verdict: x.verdict ?? null,
  verdictLabel: x.verdictLabel ?? null,
  vacuous: typeof x.vacuous === 'boolean' ? x.vacuous : null,
  freshness: x.snapshot ?? null,
  tags: { domain: x.tags?.domain ?? [], defect: x.tags?.defect ?? [], technique: x.tags?.technique ?? [] },
}));

// Collections with the placeholder id, then the real id (identity.mjs).
const build = (id) => ({
  overview: { schema: 'software-factory-overview/v1', snapshotId: id, timezone: TZ, pricingAsOf: rollup.pricing_as_of ?? null, days, models: modelIds.map((m) => ({ id: m, label: label(m) })), efforts, usage, verification, measures, stocks, breakdowns, insights },
  sessions: { schema: 'software-factory-sessions/v1', snapshotId: id, records: sessionRecords },
  changes: { schema: 'software-factory-changes/v1', snapshotId: id, records: changeRecords },
  verification: { schema: 'software-factory-verification/v1', snapshotId: id, records: verificationRecords },
  examples: { schema: 'software-factory-examples/v1', snapshotId: id, records: exampleRecords },
});
const ORDER = ['overview', 'sessions', 'changes', 'verification', 'examples'];
const defs = metricDefinitions(CONFIG);
const config = configSha256(CONFIG);
const id = snapshotId({ sha: upstreamSource.rev, generator: GENERATOR, configSha256: config, metricDefinitionsSha256: defs.sha256, collections: ORDER.map((n) => build(PLACEHOLDER)[n]) });
const collections = build(id);
const dayStart = (d) => {
  // The UTC instant of local midnight at the start of day d, in the timezone.
  for (let h = -14; h <= 14; h++) {
    const t = new Date(Date.parse(`${d}T00:00:00Z`) - h * 3600e3);
    if (localDay(t) === d && localDay(new Date(t - 1)) !== d) return t.toISOString();
  }
  throw new Error(`no midnight for ${d}`);
};
const after = (d) => {
  const n = new Date(`${d}T12:00:00Z`);
  n.setUTCDate(n.getUTCDate() + 1);
  return n.toISOString().slice(0, 10);
};

fs.rmSync(OUT, { recursive: true, force: true });
const dir = path.join(OUT, 'snapshots', id);
const files = ORDER.map((name) => {
  const rel = name === 'overview' ? 'overview.json' : `details/${name}.json`;
  const text = serialize(collections[name]);
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
  return { name, path: rel, sha256: sha256(text), bytes: Buffer.byteLength(text), records: name === 'overview' ? 1 : collections[name].records.length };
});
const manifest = {
  schema: 'software-factory-snapshot/v1',
  snapshotId: id,
  source: { repository: upstreamSource.repository, sha: upstreamSource.rev, inputs: [...new Map(inputs.map((i) => [i.path, i])).values()] },
  generator: GENERATOR,
  configSha256: config,
  metricDefinitions: defs,
  pricingAsOf: rollup.pricing_as_of ?? null,
  timezone: TZ,
  collections: files,
  datasets: [
    { id: 'usage', kind: 'period', from: dayStart(localDay(calls.map((c) => c.start).sort()[0])), to: dayStart(after(localDay(calls.map((c) => c.start).sort().at(-1)))), coverage: measures[1].coverage },
    { id: 'verification', kind: 'period', from: dayStart(localDay(completed[0].finishedAt)), to: dayStart(after(localDay(completed.at(-1).finishedAt))), coverage: measures[3].coverage },
    { id: 'changes', kind: 'stock', from: null, to: null, coverage: measures[5].coverage },
    { id: 'catalog', kind: 'stock', from: null, to: null, coverage: measures[6].coverage },
  ],
};
fs.writeFileSync(path.join(dir, 'manifest.json'), serialize(manifest));
fs.writeFileSync(
  path.join(OUT, 'latest.json'),
  serialize({ schema: 'software-factory-pointer/v1', snapshotId: id, manifest: `snapshots/${id}/manifest.json`, publishedAt: '2026-11-14T00:00:00Z', lastSourceCheck: { at: '2026-11-14T00:00:00Z', sha: upstreamSource.rev, outcome: 'new-snapshot', error: null } })
);

const problems = [...validate('manifest', manifest), ...validateSnapshotDir(OUT)];
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`wrote ${path.relative(process.cwd(), OUT)}: snapshot ${id}, ${files.map((f) => `${f.name} ${f.bytes} B`).join(', ')}`);
