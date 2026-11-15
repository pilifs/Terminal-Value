// Aggregating normalized records into a snapshot. Owned by stream A (data):
// llm-dlc/loops/software-factory-data.md.
//
// Interface, frozen in Phase 0 (docs/software-factory.md):
//
//   GENERATOR = { name: 'blog/software-factory/metrics.mjs', version: '1' }
//     Bump version whenever the same input would give different output.
//
//   aggregate(normalized, { config, configSha256, metricDefinitions })
//     -> { manifest, overview, details: { sessions, changes, verification, examples } }
//     Every value schema-valid (validate.mjs), with its snapshot id made as
//     identity.mjs describes. Implements config/metrics.json: weighted ratios,
//     unavailable (null) for a zero denominator, days rebucketed in the
//     timezone from UTC timestamps, changes deduplicated by change id, process
//     outcome kept apart from semantic signals, stocks kept apart from period
//     activity, and coverage carried with every value. For the fixture in
//     test/fixtures/upstream it reproduces the usage and verification tables,
//     measures and stocks of test/fixtures/snapshot-example.
//
// Details of this implementation:
//   - config is loadConfig()'s { source, areas, models }, plus `metrics` (the
//     parsed config/metrics.json, read from CONFIG_DIR when absent);
//     configSha256 and metricDefinitions default to identity.mjs's values.
//   - A value with nothing to be computed over is null, never 0: usage with no
//     priced call, calls with no metrics file, no completed verification
//     job (that dataset has no span), a ratio with a zero denominator, a
//     median of no durations. An insight whose value is null is
//     left out.
//   - Detail records hold only completed verification jobs (schema.json needs
//     their finishedAt); the jobs without one are counted in coverage.
//   - Also exported for tests and refresh: localDay, dayStart, nextDay,
//     areaOf, collectionFiles.
//   - Version 2 adds the feature loops, the tools and the code (factory.mjs):
//     overview.loops, overview.tools and overview.code, each null when nothing
//     was measured for it, the loops collection (one record per run, with its
//     cycles), and on a change its commit, code lines and what it took, where
//     known. Records read without prompts, tools, run records or a git
//     checkout give the same usage and verification values as version 1.

import fs from 'node:fs';
import path from 'node:path';
import {
  CONFIG_DIR,
  PLACEHOLDER,
  configSha256 as hashConfig,
  metricDefinitions as hashMetrics,
  serialize,
  sha256,
  snapshotId,
} from './identity.mjs';
import { aggregateFactory } from './factory.mjs';

export const GENERATOR = { name: 'blog/software-factory/metrics.mjs', version: '2' };

const STATUSES = ['passed', 'failed'];
const ORDER = ['overview', 'sessions', 'changes', 'verification', 'examples', 'loops'];
const SCOPE_TEXT = { 'all-time': 'all time', snapshot: 'at this revision' };
const USAGE_COLUMNS = ['day', 'model', 'effort', 'calls', 'pricedCalls', 'usd', 'inputTokens', 'cacheReadTokens', 'cacheWriteTokens', 'outputTokens'];

const round6 = (n) => Math.round(n * 1e6) / 1e6;
const share = (v, t) => (t ? v / t : null);
const countBy = (rows, key) => rows.reduce((m, r) => ((m[key(r)] = (m[key(r)] ?? 0) + 1), m), {});
// Nulls last, strings in code-point order: the same input always gives the same axis.
const byValue = (a, b) => (a === b ? 0 : a === null ? 1 : b === null ? -1 : a < b ? -1 : 1);

const formats = new Map();
/** The calendar day (YYYY-MM-DD) of a UTC instant in the timezone. */
export function localDay(instant, timeZone = 'America/Toronto') {
  if (!formats.has(timeZone))
    formats.set(timeZone, new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }));
  return formats.get(timeZone).format(new Date(instant));
}

/** The calendar day after a YYYY-MM-DD day. */
export function nextDay(day) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** The UTC instant at which a calendar day starts in the timezone (its local midnight, or the first instant after a skipped one). */
export function dayStart(day, timeZone = 'America/Toronto') {
  // Offsets run from UTC-12 to UTC+14, so local midnight of `day` lies within 15 hours of day T00:00Z.
  let lo = Date.parse(`${day}T00:00:00Z`) - 15 * 3600e3;
  let hi = Date.parse(`${day}T00:00:00Z`) + 13 * 3600e3;
  // Smallest whole minute t in [lo, hi] whose local day is >= day: local days only move forward.
  while (hi - lo > 60e3) {
    const mid = lo + Math.floor((hi - lo) / 120e3) * 60e3;
    if (localDay(mid, timeZone) >= day) hi = mid;
    else lo = mid;
  }
  return new Date(hi).toISOString();
}

/** Every day from first to last, both included. */
function dayRange(first, last) {
  const days = [];
  for (let d = first; d <= last; d = nextDay(d)) days.push(d);
  return days;
}

/** The area of a record by config/areas.json's rule. */
export function areaOf({ campaign = null, paths = [], housekeeping = false }, areas) {
  if (housekeeping) return 'agent-process';
  let best = null;
  if (campaign)
    for (const a of areas.areas)
      for (const c of a.campaigns)
        if ((campaign === c || campaign.startsWith(`${c}-`)) && (!best || c.length > best.length)) best = { id: a.id, length: c.length };
  if (best) return best.id;
  if (paths.length)
    for (const a of areas.areas) if (paths.every((p) => a.paths.some((ap) => p.startsWith(ap)))) return a.id;
  return areas.unassigned.id;
}

function median(sorted) {
  if (!sorted.length) return null;
  const mid = sorted.length / 2;
  return sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function duration(seconds) {
  if (seconds < 90) return `${Math.round(seconds)} seconds`;
  if (seconds < 5400) return `${Math.round(seconds / 60)} minutes`;
  return `${(seconds / 3600).toFixed(1)} hours`;
}

const pct = (r) => `${(r * 100).toFixed(1)}%`;

/** Fills an insight template from config/metrics.json. */
function fill(template, values) {
  return template.replace(/\{([a-z]+)\}/g, (m, k) => {
    if (!(k in values)) throw new Error(`metrics.mjs: insight template needs {${k}}`);
    return values[k];
  });
}

/** Each collection as the file refresh writes: { name, path, text, sha256, bytes, records }. */
export function collectionFiles({ overview, details }) {
  return ORDER.map((name) => {
    const value = name === 'overview' ? overview : details[name];
    const text = serialize(value);
    return {
      name,
      path: name === 'overview' ? 'overview.json' : `details/${name}.json`,
      text,
      sha256: sha256(text),
      bytes: Buffer.byteLength(text),
      records: name === 'overview' ? 1 : value.records.length,
    };
  });
}

export function aggregate(normalized, { config, configSha256 = hashConfig(), metricDefinitions = hashMetrics() } = {}) {
  if (!config) throw new Error('metrics.mjs aggregate: config is required (import.mjs loadConfig())');
  const { source, areas, models } = config;
  const metricsConfig = config.metrics ?? JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'metrics.json'), 'utf8'));
  const tz = source.timezone;
  const day = (instant) => localDay(instant, tz);
  const label = (id) => models.aliases[id] ?? id;
  const { calls, sessions, changes: changeList, verification: results, examples } = normalized;

  // Axes. Days run from the first to the last day with a call or a completed job, with no gaps.
  const completed = results.filter((r) => r.finishedAt).sort((a, b) => a.finishedAt.localeCompare(b.finishedAt));
  const callDays = calls.map((c) => day(c.start)).sort();
  const jobDays = completed.map((r) => day(r.finishedAt));
  const active = [...callDays, ...jobDays].sort();
  const days = active.length ? dayRange(active[0], active.at(-1)) : [];
  const dayIndex = new Map(days.map((d, i) => [d, i]));
  const modelIds = [...new Set(calls.map((c) => c.model))].sort(byValue);
  const efforts = [...new Set(calls.map((c) => c.effort))].sort(byValue);
  const modelIndex = new Map(modelIds.map((m, i) => [m, i]));
  const effortIndex = new Map(efforts.map((e, i) => [e, i]));

  // Usage: one row per (day, model, effort) that occurs.
  const cells = new Map();
  for (const c of calls) {
    const key = [dayIndex.get(day(c.start)), modelIndex.get(c.model), effortIndex.get(c.effort)];
    const k = key.join(',');
    const cell = cells.get(k) ?? { key, calls: 0, priced: 0, usd: 0, input: 0, read: 0, write: 0, output: 0 };
    cell.calls++;
    if (c.usd !== null) {
      cell.priced++;
      cell.usd += c.usd;
    }
    cell.input += c.inputTokens;
    cell.read += c.cacheReadTokens;
    cell.write += c.cacheWriteTokens;
    cell.output += c.outputTokens;
    cells.set(k, cell);
  }
  const usage = {
    columns: USAGE_COLUMNS,
    rows: [...cells.values()]
      .map((c) => [...c.key, c.calls, c.priced, round6(c.usd), c.input, c.read, c.write, c.output])
      .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]),
  };

  // Verification: one row per completed job, its process outcome only.
  const validSeconds = (s) => (typeof s === 'number' && Number.isFinite(s) && s > 0 ? s : null);
  const verification = {
    columns: ['day', 'status', 'wallSeconds'],
    rows: completed.map((r) => [dayIndex.get(day(r.finishedAt)), STATUSES.indexOf(r.process), validSeconds(r.wallSeconds)]),
  };

  // Measures, all time and at the revision.
  const priced = calls.filter((c) => c.usd !== null);
  const usd = priced.length ? round6(priced.reduce((t, c) => t + c.usd, 0)) : null;
  const sum = (k) => calls.reduce((t, c) => t + c[k], 0);
  const cacheNum = sum('cacheReadTokens');
  const cacheDen = sum('inputTokens') + cacheNum + sum('cacheWriteTokens');
  const withMetrics = sessions.filter((s) => s.hasMetrics).length;
  const durations = completed.map((r) => validSeconds(r.wallSeconds)).filter((s) => s !== null).sort((a, b) => a - b);
  const medianSeconds = median(durations);
  const exampleVerdicts = examples.filter((x) => x.verdict !== null).length;
  const coverage = {
    usage: { included: priced.length, total: calls.length, missing: calls.length - priced.length },
    calls: { included: withMetrics, total: sessions.length, missing: sessions.length - withMetrics, note: 'sessions with a metrics file' },
    cache: { included: calls.length, total: calls.length },
    completed: { included: completed.length, total: results.length, missing: results.length - completed.length },
    durations: { included: durations.length, total: completed.length, missing: completed.length - durations.length },
    changes: { included: changeList.filter((c) => c.sessions.length).length, total: changeList.length },
    catalog: { included: exampleVerdicts, total: examples.length, missing: examples.length - exampleVerdicts, note: 'examples with a verdict' },
  };
  const measures = [
    { id: 'usage_usd', value: usd, unit: 'usd', scope: 'all-time', coverage: coverage.usage },
    { id: 'model_calls', value: calls.length ? calls.length : null, unit: 'calls', scope: 'all-time', coverage: coverage.calls },
    { id: 'cache_reuse', value: cacheDen ? cacheNum / cacheDen : null, unit: 'ratio', scope: 'all-time', numerator: cacheNum, denominator: cacheDen, coverage: coverage.cache },
    { id: 'verification_completed', value: completed.length ? completed.length : null, unit: 'jobs', scope: 'all-time', coverage: coverage.completed },
    { id: 'verification_duration_median', value: medianSeconds, unit: 'seconds', scope: 'all-time', coverage: coverage.durations },
    { id: 'changes_recorded', value: changeList.length, unit: 'changes', scope: 'snapshot', coverage: coverage.changes },
    { id: 'examples_catalog', value: examples.length, unit: 'examples', scope: 'snapshot', coverage: coverage.catalog },
  ];
  const measure = Object.fromEntries(measures.map((m) => [m.id, m]));

  // Stocks: counts at the revision, never activity over a period.
  const stocks = {
    changes: { total: changeList.length, housekeeping: changeList.filter((c) => c.housekeeping).length },
    examples: {
      total: examples.length,
      origin: countBy(examples, (x) => x.origin),
      verdict: countBy(examples, (x) => x.verdict ?? 'none'),
      vacuous: examples.filter((x) => x.vacuous === true).length,
      freshness: countBy(examples, (x) => x.freshness ?? 'absent'),
    },
  };

  // Areas.
  const area = (record) => areaOf(record, areas);
  const areaLabel = (id) => (areas.areas.find((a) => a.id === id) ?? areas.unassigned).label;
  const baseChanges = changeList.map((c) => ({
    changeId: c.changeId,
    summary: c.summary,
    sessions: c.sessions,
    housekeeping: c.housekeeping,
    area: area({ campaign: c.campaign, housekeeping: c.housekeeping }),
  }));

  // The feature loops, the tools and the code (factory.mjs).
  const factory = aggregateFactory(
    { prompts: [], tools: [], sessionCommits: [], runs: [], code: null, ...normalized },
    { config: { ...config, loops: config.loops, code: config.code }, days, day, modelIds, label, area, areaLabel, changeRecords: baseChanges }
  );
  const tookOf = new Map(changeList.map((c) => [c.changeId, c.took ?? null]));
  const changeRecords = baseChanges.map((c) => {
    const fact = factory.changeFacts.get(c.changeId);
    const took = tookOf.get(c.changeId);
    return {
      ...c,
      ...(fact ? { commit: fact.commit, committedAt: fact.committedAt, codeAdded: fact.codeAdded, codeRemoved: fact.codeRemoved } : {}),
      ...(took ? { calls: took.calls, outputTokens: took.outputTokens, usd: round6(took.usd) } : {}),
    };
  });

  // Breakdowns.
  const usdBy = (key, value) => priced.filter((c) => c[key] === value).reduce((t, c) => t + c.usd, 0);
  const usageRows = (key, axis, name) =>
    axis.map((v) => {
      const value = usdBy(key, v);
      return { key: v ?? 'none', label: name(v), value: priced.length ? round6(value) : null, share: usd ? value / usd : null };
    });
  const areaCounts = countBy(changeRecords, (c) => c.area);
  const catalogRows = (counts, name) =>
    Object.entries(counts)
      .sort(([a, x], [b, y]) => y - x || byValue(a, b))
      .map(([k, v]) => ({ key: k, label: name(k), value: v, share: share(v, examples.length) }));
  const breakdowns = [
    { id: 'usage-by-model', metricId: 'usage_share_by_model', dimension: 'model', scope: 'all-time', rows: usageRows('model', modelIds, label), coverage: { included: priced.length, total: calls.length } },
    { id: 'usage-by-effort', metricId: 'usage_usd', dimension: 'effort', scope: 'all-time', rows: usageRows('effort', efforts, (e) => e ?? 'No effort recorded'), coverage: { included: priced.length, total: calls.length } },
    {
      id: 'changes-by-area',
      metricId: 'changes_recorded',
      dimension: 'area',
      scope: 'snapshot',
      rows: [...areas.areas.map((a) => a.id), areas.unassigned.id]
        .filter((id) => areaCounts[id] || id === areas.unassigned.id)
        .map((id) => ({ key: id, label: areaLabel(id), value: areaCounts[id] ?? 0, share: share(areaCounts[id] ?? 0, changeRecords.length) })),
      coverage: { included: changeRecords.length - (areaCounts[areas.unassigned.id] ?? 0), total: changeRecords.length, note: `area mapping ${areas.status}` },
    },
    { id: 'examples-by-system', metricId: 'examples_catalog', dimension: 'exampleSystem', scope: 'snapshot', rows: catalogRows(countBy(examples, (x) => x.system ?? 'none'), (k) => (k === 'none' ? 'No system' : k)), coverage: { included: examples.filter((x) => x.system).length, total: examples.length } },
    { id: 'examples-by-origin', metricId: 'examples_catalog', dimension: 'exampleOrigin', scope: 'snapshot', rows: catalogRows(stocks.examples.origin, (k) => k), coverage: { included: examples.length, total: examples.length } },
    { id: 'examples-by-verdict', metricId: 'examples_catalog', dimension: 'verdict', scope: 'snapshot', rows: catalogRows(stocks.examples.verdict, (k) => (k === 'none' ? 'No verdict' : k)), coverage: coverage.catalog },
  ];

  // Insights: config/metrics.json's templates over the values above. Descriptive only.
  const templates = Object.fromEntries(metricsConfig.insights.map((t) => [t.id, t]));
  const insights = [];
  const insight = (id, value, scope, cov, evidence, values) => {
    const t = templates[id];
    if (!t || value === null) return;
    insights.push({ id, metricId: t.metricId, text: fill(t.template, { ...values, scope: SCOPE_TEXT[scope] }), value, scope, coverage: cov, evidence });
  };
  const modelRows = breakdowns[0].rows.filter((r) => r.share !== null);
  // The largest share; on a tie, the first model id in order. Says where usage went, not which model is better.
  const top = modelRows.reduce((a, b) => (b.share > a.share ? b : a), modelRows[0] ?? null);
  if (top) insight('top-model-share', top.share, 'all-time', breakdowns[0].coverage, { collection: 'overview', breakdown: 'usage-by-model' }, { label: top.label, share: pct(top.share) });
  const cache = measure.cache_reuse;
  if (cache.value !== null) insight('weighted-cache-reuse', cache.value, 'all-time', cache.coverage, { collection: 'overview', breakdown: null }, { share: pct(cache.value) });
  if (medianSeconds !== null)
    insight('median-verification', medianSeconds, 'all-time', coverage.durations, { collection: 'verification', breakdown: null }, { duration: duration(medianSeconds), n: String(durations.length) });

  // Details.
  const callsBySession = Map.groupBy(calls, (c) => c.session);
  const changesBySession = new Map();
  for (const c of changeRecords) for (const s of c.sessions) changesBySession.set(s, (changesBySession.get(s) ?? 0) + 1);
  const sessionRecords = sessions.map((s) => {
    const own = callsBySession.get(s.id) ?? [];
    const ownPriced = own.filter((c) => c.usd !== null);
    const num = own.reduce((t, c) => t + c.cacheReadTokens, 0);
    const den = own.reduce((t, c) => t + c.inputTokens + c.cacheReadTokens + c.cacheWriteTokens, 0);
    return {
      id: s.id,
      title: s.title,
      status: s.status,
      started: s.started,
      ended: s.ended,
      models: s.hasMetrics ? [...new Set(own.map((c) => c.model))].sort() : [...s.models].sort(),
      calls: s.hasMetrics ? own.length : null,
      usd: ownPriced.length ? round6(ownPriced.reduce((t, c) => t + c.usd, 0)) : null,
      cacheReuse: den ? num / den : null,
      changes: changesBySession.get(s.id) ?? 0,
      hasMetrics: s.hasMetrics,
      summaryUrl: source.summaryUrl.replace('{sha}', normalized.source.sha).replace('{session}', s.id),
    };
  });
  const verificationRecords = completed.map((r) => ({
    id: r.id,
    title: r.title,
    process: r.process,
    signals: r.signals,
    expected: r.expected,
    attention: r.attention,
    finishedAt: r.finishedAt,
    wallSeconds: validSeconds(r.wallSeconds),
    peakMemoryBytes: r.peakMemoryBytes,
    capabilities: r.capabilities,
    sourceCommit: r.sourceCommit,
    submittingSession: r.submittingSession,
    area: area({ campaign: r.campaign, paths: r.paths }),
  }));
  const exampleRecords = examples.map((x) => ({
    id: x.id,
    title: x.title,
    origin: x.origin,
    system: x.system,
    verdict: x.verdict,
    verdictLabel: x.verdictLabel,
    vacuous: x.vacuous,
    freshness: x.freshness,
    tags: x.tags,
  }));

  // Collections, the snapshot id over them (identity.mjs), then the manifest.
  const build = (id) => ({
    overview: {
      schema: 'software-factory-overview/v1',
      snapshotId: id,
      timezone: tz,
      pricingAsOf: normalized.pricingAsOf,
      days,
      models: modelIds.map((m) => ({ id: m, label: label(m) })),
      efforts,
      usage,
      verification,
      measures,
      stocks,
      breakdowns,
      insights,
      loops: factory.loops,
      tools: factory.tools,
      code: factory.code,
    },
    sessions: { schema: 'software-factory-sessions/v1', snapshotId: id, records: sessionRecords },
    changes: { schema: 'software-factory-changes/v1', snapshotId: id, records: changeRecords },
    verification: { schema: 'software-factory-verification/v1', snapshotId: id, records: verificationRecords },
    examples: { schema: 'software-factory-examples/v1', snapshotId: id, records: exampleRecords },
    loops: { schema: 'software-factory-loops/v1', snapshotId: id, records: factory.runRecords },
  });
  const placeholder = build(PLACEHOLDER);
  const id = snapshotId({
    sha: normalized.source.sha,
    generator: GENERATOR,
    configSha256,
    metricDefinitionsSha256: metricDefinitions.sha256,
    collections: ORDER.map((n) => placeholder[n]),
  });
  const { overview, ...details } = build(id);
  const bounds = (sortedDays) =>
    sortedDays.length ? { from: dayStart(sortedDays[0], tz), to: dayStart(nextDay(sortedDays.at(-1)), tz) } : { from: null, to: null };
  const runDays = (factory.loops?.runs ?? []).flatMap((r) => [r.started, r.ended].filter(Boolean)).map(day).sort();
  const runBounds = bounds(runDays);
  const manifest = {
    schema: 'software-factory-snapshot/v1',
    snapshotId: id,
    source: { repository: normalized.source.repository, sha: normalized.source.sha, inputs: normalized.source.inputs },
    generator: GENERATOR,
    configSha256,
    metricDefinitions: { version: metricDefinitions.version, sha256: metricDefinitions.sha256 },
    pricingAsOf: normalized.pricingAsOf,
    timezone: tz,
    collections: collectionFiles({ overview, details }).map(({ text, ...file }) => file),
    datasets: [
      { id: 'usage', kind: 'period', ...bounds(callDays), coverage: coverage.calls },
      { id: 'verification', kind: 'period', ...bounds(jobDays), coverage: coverage.completed },
      { id: 'changes', kind: 'stock', from: null, to: null, coverage: coverage.changes },
      { id: 'catalog', kind: 'stock', from: null, to: null, coverage: coverage.catalog },
      ...(factory.loops ? [{ id: 'loops', kind: 'period', ...runBounds, coverage: factory.loops.coverage }] : []),
      ...(factory.tools ? [{ id: 'tools', kind: 'period', ...bounds(callDays), coverage: factory.tools.coverage }] : []),
      ...(factory.code ? [{ id: 'code', kind: 'period', ...bounds(factory.code.days), coverage: factory.code.coverage }] : []),
    ],
  };
  return { manifest, overview, details };
}
