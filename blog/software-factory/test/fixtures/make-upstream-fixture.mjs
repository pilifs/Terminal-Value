// Writes test/fixtures/upstream/: a small, real subset of in-the-loop's
// published metadata at one pinned revision, in the upstream layout and
// formats, for the Software Factory importer's tests.
//
//   node blog/software-factory/test/fixtures/make-upstream-fixture.mjs \
//     --checkout ../in-the-loop [--rev SHA]
//
// Every value comes from that revision, with three kinds of change, each
// listed in upstream/SOURCE.json:
//   - selection: a few sessions, verification results, job records and
//     examples, chosen to cover the cases the importer must handle (mixed
//     models, subagents, the DST change, failed jobs, attention entries,
//     real-world and vacuous examples, missing values);
//   - trimming: prose the overview never reads (prompt text, tool labels and
//     errors, job descriptions and steps, example notes) is left out, and
//     one long session keeps only its calls around the 2026-11-01 DST change;
//   - recomputation: totals that summarize the selection (the rollup's totals,
//     by_model, by_effort, by_day, and the trimmed session's rows) are
//     recomputed from the calls kept, so the fixture is internally consistent.
//     Fields that cannot be recomputed from the selection are left out.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'upstream');
const DEFAULT_REV = '7384f8c23eef441817ddb714c6ef5571cdc138bd';

// Sessions, chosen at DEFAULT_REV: fable + haiku with subagents; fable + opus
// in one session; opus + sonnet + haiku with subagents; and the long fable
// session, trimmed to the DST window.
const SESSIONS = [
  '2e359813-25c2-4259-888b-42d3a5f0eee6',
  '8194b9db-b315-48b6-b0eb-b6280f96252b',
  'a308f9d3-8d8a-42ca-b074-d388818c2418',
  '360e8b8b-8e0c-4b2a-bd69-25b32f2a54eb',
];
const TRIMMED = {
  '360e8b8b-8e0c-4b2a-bd69-25b32f2a54eb': ['2026-11-01T03:00:00Z', '2026-11-01T09:00:00Z'],
};
// A session in the index whose metrics file is left out, so a missing join is covered.
const INDEX_ONLY = ['3048539b-c311-5e68-b776-b0f94623d4ac'];

const USAGE = [
  'api_calls', 'tool_calls', 'input_tokens', 'output_tokens', 'thinking_tokens',
  'cache_read_tokens', 'cache_write_tokens', 'cache_write_5m_tokens',
  'cache_write_1h_tokens', 'usd', 'uncached_usd', 'unpriced_calls',
];
const CALL_FIELDS = [
  'seq', 'agent', 'start', 'end', 'window', 'prompt', 'commit', 'model', 'effort',
  'stop_reason', 'context_tokens', 'input_tokens', 'output_tokens', 'thinking_tokens',
  'cache_read_tokens', 'cache_write_tokens', 'cache_write_5m_tokens',
  'cache_write_1h_tokens', 'thinking_ms', 'tool_calls', 'usd', 'uncached_usd',
];
const COMMIT_FIELDS = ['index', 'change_id', 'summary', 'ts', ...USAGE, 'prompts', 'agent_ms', 'tool_errors'];
const RESULT_FIELDS = [
  'id', 'title', 'status', 'summary', 'attention', 'capabilities', 'links', 'sourceCommit',
  'finishedAt', 'wallSeconds', 'peakMemoryBytes', 'estimate', 'host', 'result',
];
const JOB_FIELDS = ['$schema', 'schema', 'id', 'title', 'kind', 'capabilities', 'links', 'submitted', 'expected', 'supersedes'];
const EXAMPLE_FIELDS = [
  'id', 'path', 'title', 'origin', 'system', 'symbol', 'approach', 'approaches', 'tags',
  'categories', 'severity', 'changeKind', 'verdict', 'verdictLabel', 'vacuous', 'snapshot',
  'existingTestsPassed', 'source', 'target',
];

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const checkout = opt('--checkout');
const rev = opt('--rev', DEFAULT_REV);
if (!checkout) {
  console.error('usage: make-upstream-fixture.mjs --checkout PATH_TO_IN_THE_LOOP [--rev SHA]');
  process.exit(2);
}

const show = (p) => JSON.parse(execFileSync('git', ['-C', checkout, 'show', `${rev}:${p}`], { maxBuffer: 1 << 28 }).toString());
const pick = (o, fields) => Object.fromEntries(fields.filter((f) => f in o).map((f) => [f, o[f]]));
const round6 = (n) => Math.round(n * 1e6) / 1e6;
const sum = (rows, keys) => {
  const t = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const r of rows) for (const k of keys) if (typeof r[k] === 'number') t[k] += r[k];
  for (const k of keys) if (k.endsWith('usd')) t[k] = round6(t[k]);
  return t;
};
const callUsage = (calls) => ({ ...sum(calls, USAGE.filter((k) => k !== 'api_calls' && k !== 'unpriced_calls')), api_calls: calls.length, unpriced_calls: calls.filter((c) => c.usd == null).length });
const groupBy = (rows, key) => {
  const m = new Map();
  for (const r of rows) {
    const k = key(r);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
};
const write = (rel, value) => {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 1) + '\n');
};

fs.rmSync(OUT, { recursive: true, force: true });
const notes = [];

// Per-session metrics: the calls and commits, no prompts, tools or cache events.
const allCalls = [];
const sessionRows = new Map();
const keptChanges = new Set();
for (const sid of SESSIONS) {
  const doc = show(`llm-dlc/traces/${sid}/metrics.json`);
  let calls = doc.calls.map((c) => pick(c, CALL_FIELDS));
  let commits = doc.commits.map((c) => pick(c, COMMIT_FIELDS));
  if (TRIMMED[sid]) {
    const [from, to] = TRIMMED[sid].map((t) => Date.parse(t));
    const inside = (ts) => ts && Date.parse(ts) >= from && Date.parse(ts) < to;
    calls = calls.filter((c) => inside(c.start));
    commits = commits.filter((c) => inside(c.ts));
    notes.push(`${sid}: trimmed to calls and commits in [${TRIMMED[sid].join(', ')}); its totals, by_model and by_effort are recomputed, and time, after_last_commit and reported are left out`);
  }
  for (const c of commits) keptChanges.add(c.change_id);
  const byModel = [...groupBy(calls, (c) => c.model)].map(([model, rows]) => ({ model, ...callUsage(rows) }));
  const byEffort = [...groupBy(calls, (c) => c.effort)].map(([effort, rows]) => ({ effort, ...callUsage(rows) }));
  const totals = TRIMMED[sid]
    ? { commits: commits.length, ...callUsage(calls) }
    : { ...pick(doc.totals, ['prompts', 'commands', 'commits', 'compactions', 'subagents', 'tool_errors', 'peak_context_tokens']), ...callUsage(calls) };
  const out = {
    schema: doc.schema,
    session_id: sid,
    pricing_as_of: doc.pricing_as_of,
    totals,
    ...(TRIMMED[sid] ? {} : { time: doc.time, reported: doc.reported }),
    by_model: byModel,
    by_effort: byEffort,
    commits,
    calls,
  };
  write(`llm-dlc/traces/${sid}/metrics.json`, out);
  allCalls.push(...calls);
  sessionRows.set(sid, { totals, time: out.time, reported: out.reported });
}
notes.push('per-session metrics.json: source, windows, compactions, pauses, prompts (prompt text), tools (labels and errors) and cache_events are left out; calls keep their numeric fields, model and effort');

// The rollup, recomputed over the selection.
const rollup = show('llm-dlc/traces/metrics.json');
const day = (ts) => ts.slice(0, 10);
const rollupOut = {
  schema: rollup.schema,
  pricing_as_of: rollup.pricing_as_of,
  totals: { sessions: SESSIONS.length, commits: keptChanges.size, ...callUsage(allCalls) },
  by_model: [...groupBy(allCalls, (c) => c.model)].map(([model, rows]) => ({ model, ...callUsage(rows) })),
  by_effort: [...groupBy(allCalls, (c) => c.effort)].map(([effort, rows]) => ({ effort, ...callUsage(rows) })),
  by_day: [...groupBy(allCalls, (c) => day(c.start))].sort().map(([date, rows]) => ({ date, ...callUsage(rows) })),
  sessions: rollup.sessions
    .filter((s) => SESSIONS.includes(s.session_id))
    .map((s) => {
      const kept = sessionRows.get(s.session_id);
      const base = pick(s, ['session_id', 'title', 'started', 'ended']);
      return TRIMMED[s.session_id]
        ? { ...base, ...kept.totals, reported_usd: null }
        : { ...base, ...pick(s, ['prompts', 'commands', 'commits', 'compactions', 'subagents', 'tool_errors', 'peak_context_tokens']), ...kept.totals, ...pick(s, ['elapsed_ms', 'agent_ms', 'model_ms', 'tool_ms', 'busy_ms', 'compaction_ms', 'paused_ms', 'reported_usd']) };
    }),
  commits: rollup.commits
    .filter((c) => keptChanges.has(c.change_id))
    .map((c) => ({ ...pick(c, ['change_id', 'summary']), sessions: c.sessions.filter((s) => SESSIONS.includes(s)) })),
};
write('llm-dlc/traces/metrics.json', rollupOut);
notes.push('traces/metrics.json: totals, by_model, by_effort and by_day are recomputed from the calls kept (by_day by UTC date of each call start, as upstream); sessions and commits are the selected ones, commits with change_id, summary and sessions only; by_tool, by_bash_family, by_cache_cause, time, totals.reported_usd and totals.unattributed_usd are left out');

// The session index: the selection, and one session with no metrics file.
const index = show('llm-dlc/index.json');
write('llm-dlc/index.json', {
  schema: index.schema,
  sessions: index.sessions
    .filter((s) => SESSIONS.includes(s.session_id) || INDEX_ONLY.includes(s.session_id))
    .map((s) => ({ ...s, commits: s.commits.filter((c) => keptChanges.has(c.change_id)) })),
});
notes.push(`llm-dlc/index.json: the selected sessions, plus ${INDEX_ONLY.join(', ')}, which has no metrics.json here (a missing join); commit lists cut to the changes kept`);

// Verification: results that cover each process status, attention entries and
// semantic signals, and the job record of each.
const results = show('verification/results/index.json');
const want = [
  (r) => r.status === 'passed' && /signals: example:as-expected/.test(r.summary) && !r.attention.length,
  (r) => r.status === 'passed' && /signals: .*cargo:tests/.test(r.summary),
  (r) => r.status === 'passed' && r.attention.length > 0,
  (r) => r.status === 'passed' && /example:differ; example:unexpected/.test(r.summary),
  (r) => r.status === 'passed' && /jvmcontract:fails/.test(r.summary),
  (r) => r.status === 'failed' && r.attention.length > 0,
  (r) => r.status === 'failed' && !/signals/.test(r.summary),
  (r) => r.status === 'failed' && /signals/.test(r.summary),
];
const chosen = [];
for (const test of want)
  for (const r of results.results)
    if (test(r) && !chosen.includes(r)) {
      chosen.push(r);
      if (chosen.filter(test).length >= 2) break;
    }
// An estimate's notes are prose about the job; its numbers stay.
const result = (r) => {
  const out = pick(r, RESULT_FIELDS);
  if (out.estimate) out.estimate = pick(out.estimate, ['cpus', 'memoryBytes', 'durationSeconds']);
  return out;
};
write('verification/results/index.json', { schema: results.schema, results: chosen.map(result) });
let withSession = 0;
for (const r of chosen) {
  let job;
  try {
    job = show(`verification/jobs/${r.id}.json`);
  } catch {
    continue;
  }
  if (job.submitted?.session) withSession++;
  write(`verification/jobs/${r.id}.json`, pick(job, JOB_FIELDS));
}
notes.push(`verification: ${chosen.length} results covering passed and failed jobs, attention entries and semantic signals (estimates without their notes), and their job records (${withSession} with a submitting session) without description, requires, resources, steps or outputs`);

// The example catalog: a spread of origins, verdicts, freshness and vacuity.
const examples = show('examples/index.json');
const exWant = [
  (x) => x.origin === 'real-world',
  (x) => x.vacuous === true,
  (x) => x.verdict === null,
  (x) => x.verdict === 'unverifiable',
  (x) => x.snapshot === 'current' && x.verdict === 'verified',
  (x) => x.snapshot === 'unknown' && x.verdict === 'violation',
  (x) => x.snapshot == null,
];
const exChosen = [];
for (const test of exWant)
  for (const x of examples.examples)
    if (test(x) && !exChosen.includes(x)) {
      exChosen.push(x);
      if (exChosen.filter(test).length >= 2) break;
    }
write('examples/index.json', { schema: examples.schema, examples: exChosen.map((x) => pick(x, EXAMPLE_FIELDS)) });
write('examples/tags.json', show('examples/tags.json'));
notes.push(`examples/index.json: ${exChosen.length} examples covering real-world origin, vacuous proofs, absent and unverifiable verdicts, and current, unknown and absent freshness, without summary or notes; examples/tags.json whole`);

write('SOURCE.json', {
  repository: 'pilifs/in-the-loop',
  rev,
  generator: 'blog/software-factory/test/fixtures/make-upstream-fixture.mjs',
  changes: notes,
});
console.log(`wrote ${path.relative(process.cwd(), OUT)} from ${rev}`);
for (const n of notes) console.log(`  ${n}`);
