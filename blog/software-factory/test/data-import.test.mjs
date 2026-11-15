// Stream A, phase A1: reading and normalizing in-the-loop's metadata.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { SourceError, exampleEvidence, normalizeSources, parseSignals, readSources } from '../import.mjs';
import { CASES, UPSTREAM, materialize } from './fixtures/cases.mjs';

const SHA = JSON.parse(fs.readFileSync(path.join(UPSTREAM, 'SOURCE.json'), 'utf8')).rev;
const read = (dir, opts = {}) => readSources({ dir, sha: SHA, ...opts });
const load = async (dir, opts) => normalizeSources(await read(dir, opts));
const json = (dir, rel) => JSON.parse(fs.readFileSync(path.join(dir, rel), 'utf8'));
const write = (dir, rel, value) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), typeof value === 'string' ? value : JSON.stringify(value));
};
const failing = async () => {
  throw new Error('getaddrinfo ENOTFOUND raw.githubusercontent.com');
};

async function failure(promise) {
  try {
    await promise;
  } catch (e) {
    return e;
  }
  assert.fail('expected a SourceError');
}

for (const kase of CASES) {
  test(`case ${kase.id}: ${kase.expect.outcome}${kase.expect.code ? ` (${kase.expect.code})` : ''}`, async () => {
    const { dir } = materialize(kase.id);
    const run = () => (kase.network === 'fail' ? load(undefined, { dir: undefined, fetchImpl: failing }) : load(dir));
    if (kase.expect.outcome === 'failed') {
      const e = await failure(run());
      assert.ok(e instanceof SourceError, `${e}`);
      assert.equal(e.code, kase.expect.code, e.message);
      if (kase.expect.path) assert.equal(e.path, kase.expect.path);
    } else {
      const normalized = await run();
      if (kase.repeat) assert.deepEqual(await run(), normalized, 'the same revision normalizes the same');
      assert.ok(normalized.calls.length > 0);
    }
  });
}

test('a missing session metrics file leaves its calls out and is never zero-filled', async () => {
  const { dir } = materialize('missing-session-metrics');
  const n = await load(dir);
  const missing = n.sessions.filter((s) => !s.hasMetrics).map((s) => s.id);
  assert.deepEqual(missing.sort(), ['3048539b-c311-5e68-b776-b0f94623d4ac', '8194b9db-b315-48b6-b0eb-b6280f96252b']);
  assert.equal(n.sessions.length, 5);
  assert.ok(!n.calls.some((c) => missing.includes(c.session)));
  assert.equal(n.calls.length, 590 - 108);
});

test('a missing job record gives null expected and submitting session', async () => {
  const { dir } = materialize('missing-job-record');
  const id = '20261108-195703-application-core-phase-5-step-3-lib-test';
  const job = (await load(dir)).verification.find((v) => v.id === id);
  assert.deepEqual([job.expected, job.submittingSession, job.hasJob], [null, null, false]);
  const full = (await load(UPSTREAM)).verification.find((v) => v.id === id);
  assert.equal(full.hasJob, true);
  assert.equal(typeof full.expected, 'string');
});

test('the fixture normalizes completely: calls, subagents once, sessions, changes, jobs, examples', async () => {
  const n = await load(UPSTREAM);
  assert.equal(n.source.sha, SHA);
  assert.equal(n.calls.length, 590);
  let agents = 0;
  for (const s of n.sessions.filter((x) => x.hasMetrics))
    agents += json(UPSTREAM, `llm-dlc/traces/${s.id}/metrics.json`).calls.filter((c) => c.agent != null).length;
  assert.ok(agents > 0, 'the fixture has subagent calls');
  assert.equal(n.calls.filter((c) => c.subagent).length, agents);
  assert.equal(Math.round(n.calls.reduce((t, c) => t + c.usd, 0) * 1e6) / 1e6, 101.072856);
  assert.equal(n.sessions.length, 5);
  assert.equal(n.changes.length, new Set(json(UPSTREAM, 'llm-dlc/traces/metrics.json').commits.map((c) => c.change_id)).size);
  assert.equal(n.verification.length, 12);
  assert.equal(n.verification.filter((v) => v.submittingSession).length, 6);
  assert.equal(n.examples.length, 11);
  assert.equal(n.pricingAsOf, '2026-10-31');
  // Every input read is recorded with its hash and schema, in path order.
  assert.equal(n.source.inputs.length, 21);
  assert.deepEqual(n.source.inputs.map((i) => i.path), n.source.inputs.map((i) => i.path).sort());
  assert.equal(n.source.inputs.find((i) => i.path === 'examples/tags.json').schema, '');
});

test('raw model ids are kept, and a call names its effort or null', async () => {
  const n = await load(UPSTREAM);
  const models = [...new Set(n.calls.map((c) => c.model))].sort();
  assert.ok(models.every((m) => m.startsWith('claude-')), models.join());
  assert.equal(models.length, 4);
});

test('no prose field reaches a normalized record', async () => {
  const { dir } = materialize('stale-source');
  const MARK = 'PROSE-MARKER';
  const rollup = json(dir, 'llm-dlc/traces/metrics.json');
  rollup.by_tool = [{ tool: MARK, errors: [MARK] }];
  rollup.sessions[0].first_prompt = MARK;
  write(dir, 'llm-dlc/traces/metrics.json', rollup);
  const index = json(dir, 'llm-dlc/index.json');
  index.sessions[1].first_prompt = MARK;
  write(dir, 'llm-dlc/index.json', index);
  const sid = index.sessions[1].session_id;
  const metrics = json(dir, `llm-dlc/traces/${sid}/metrics.json`);
  // Prompts and tool calls are read for who sent them and how they ended: never their text.
  metrics.prompts = [{ ts: metrics.calls[0].start, end: metrics.calls[0].end, kind: 'human', text: MARK, first_prompt: MARK }];
  metrics.tools = [{ start: metrics.calls[0].start, name: 'Bash', status: 'error', error_kind: 'exit_code', call: 0, family: 'sed', label: MARK, error: MARK }];
  Object.assign(metrics.calls[0], { prompt_text: MARK, tool_labels: [MARK], error: MARK });
  write(dir, `llm-dlc/traces/${sid}/metrics.json`, metrics);
  const results = json(dir, 'verification/results/index.json');
  results.results[0].summary += ` ${MARK}`; // free text before the signals stays out
  results.results[0].estimate = { notes: MARK };
  results.results[0].attention = [{ text: MARK }];
  write(dir, 'verification/results/index.json', results);
  const jobFile = fs.readdirSync(path.join(dir, 'verification/jobs'))[0];
  const job = json(dir, `verification/jobs/${jobFile}`);
  Object.assign(job, { description: MARK, steps: [{ run: MARK }], outputs: [MARK], requires: [MARK] });
  write(dir, `verification/jobs/${jobFile}`, job);
  // An example's working notes stay out. Its summary, the catalog's own paragraph about it, is selected (below).
  const examples = json(dir, 'examples/index.json');
  Object.assign(examples.examples[0], { notes: [MARK], approaches: [MARK], symbol: MARK, target: { family: MARK } });
  write(dir, 'examples/index.json', examples);

  const n = await load(dir);
  assert.ok(!JSON.stringify(n).includes(MARK), 'a prose value was copied');
  assert.ok(n.verification.every((v) => !('summary' in v)));
});

test('signals come from the end of a result summary', () => {
  assert.deepEqual(parseSignals('passed: 5 passed step(s) in 5m57s, peak 1.9 GiB (estimated 25m00s, 3.0 GiB); signals: cargo:tests×1'), [{ name: 'cargo:tests', count: 1 }]);
  assert.deepEqual(parseSignals('failed: 2 step(s); signals: example:as-expected×3, jvmcontract:fails'), [
    { name: 'example:as-expected', count: 3 },
    { name: 'jvmcontract:fails', count: 1 },
  ]);
  assert.deepEqual(parseSignals('passed: 1 step(s) in 3s'), []);
  assert.deepEqual(parseSignals(null), []);
});

test("a session's campaign is its latest run's brief; a change without one in its summary takes its session's", async () => {
  const { dir } = materialize('stale-source');
  const index = json(dir, 'llm-dlc/index.json');
  const sid = index.sessions[1].session_id;
  write(dir, `llm-dlc/traces/${sid}/runs/2026-11-01-010000-foundations.md`, '# Feature loop: foundations\n');
  write(dir, `llm-dlc/traces/${sid}/runs/2026-11-02-010000-foundations-heap.md`, '# Feature loop: foundations-heap\n');
  write(dir, `llm-dlc/traces/${sid}/runs/notes.md`, 'not a run record');
  const raw = await read(dir);
  assert.equal(raw.runs.length, 2);
  const n = normalizeSources(raw);
  assert.equal(n.sessions.find((s) => s.id === sid).campaign, 'foundations-heap');
  const own = n.changes.filter((c) => c.sessions.length === 1 && c.sessions[0] === sid);
  assert.ok(own.length > 0);
  for (const c of own) assert.equal(c.campaign, /^[a-z]+-[a-z-]+[ :]/.test(c.summary) ? c.summary.split(/[ :]/)[0] : 'foundations-heap');
});

test('a change listed twice is kept once, with the sessions of both', async () => {
  const { dir } = materialize('stale-source');
  const rollup = json(dir, 'llm-dlc/traces/metrics.json');
  const first = rollup.commits[0];
  rollup.commits.push({ ...first, sessions: ['2e359813-25c2-4259-888b-42d3a5f0eee6'] });
  write(dir, 'llm-dlc/traces/metrics.json', rollup);
  const n = await load(dir);
  assert.equal(n.changes.length, new Set(rollup.commits.map((c) => c.change_id)).size);
  const c = n.changes.find((x) => x.changeId === first.change_id);
  assert.deepEqual(c.sessions, [...new Set([...first.sessions, '2e359813-25c2-4259-888b-42d3a5f0eee6'])]);
});

test("a change without a summary yet is left out of the changes, and its sessions' calls still count", async () => {
  // in-the-loop at e26b4eb0: the rollup's commits[681] was a working copy before
  // its first commit message, `"summary": null` (its sync.py's commit_summary).
  const { dir } = materialize('stale-source');
  const before = await load(dir);
  const rollup = json(dir, 'llm-dlc/traces/metrics.json');
  const [described, open] = [rollup.commits[0], rollup.commits[1]];
  const fresh = 'z'.repeat(32);
  const S = '2e359813-25c2-4259-888b-42d3a5f0eee6';
  open.summary = null;
  rollup.commits.push({ ...described, summary: null, sessions: [S] }); // the same id, also described
  rollup.commits.push({ ...open, change_id: fresh, sessions: [S] }); // never described
  write(dir, 'llm-dlc/traces/metrics.json', rollup);
  const n = await load(dir);
  const ids = n.changes.map((c) => c.changeId);
  assert.ok(!ids.includes(open.change_id) && !ids.includes(fresh));
  assert.equal(n.changes.length, before.changes.length - 1);
  assert.ok(n.changes.every((c) => typeof c.summary === 'string'));
  const kept = n.changes.find((c) => c.changeId === described.change_id);
  assert.equal(kept.summary, described.summary);
  assert.deepEqual(kept.sessions, [...new Set([...described.sessions, S])]);
  // Nothing else moves: calls, sessions, totals and verification are the same.
  for (const key of ['calls', 'sessions', 'rollup', 'verification', 'examples']) assert.deepEqual(n[key], before[key], key);

  // A summary that is neither text nor null is still refused.
  for (const summary of [undefined, 42, ['x']]) {
    const r = json(dir, 'llm-dlc/traces/metrics.json');
    r.commits[2].summary = summary;
    write(dir, 'llm-dlc/traces/metrics.json', r);
    const e = await failure(load(dir));
    assert.equal(e.code, 'schema');
    assert.match(e.message, /commits\[2\] lacks a change_id or summary/);
  }
});

test('a session file that disagrees with its rollup entry fails to reconcile', async () => {
  const { dir } = materialize('stale-source');
  const rel = 'llm-dlc/traces/2e359813-25c2-4259-888b-42d3a5f0eee6/metrics.json';
  const metrics = json(dir, rel);
  metrics.calls.pop();
  write(dir, rel, metrics);
  const e = await failure(load(dir));
  assert.equal(e.code, 'reconcile');
  assert.equal(e.path, rel);
});

test('ids that would leave their folder are refused', async () => {
  const { dir } = materialize('stale-source');
  const index = json(dir, 'llm-dlc/index.json');
  index.sessions[0].session_id = '../../examples/index';
  write(dir, 'llm-dlc/index.json', index);
  const e = await failure(load(dir));
  assert.equal(e.code, 'schema');
  assert.equal(e.path, 'llm-dlc/index.json');
});

test('a malformed call is a schema error naming its file', async () => {
  const { dir } = materialize('stale-source');
  const rel = 'llm-dlc/traces/2e359813-25c2-4259-888b-42d3a5f0eee6/metrics.json';
  const metrics = json(dir, rel);
  metrics.calls[3].cache_read_tokens = '12';
  write(dir, rel, metrics);
  const e = await failure(load(dir));
  assert.equal(e.code, 'schema');
  assert.equal(e.path, rel);
});

test('an abbreviated sha is refused; a plain directory needs an explicit sha', async () => {
  assert.equal((await failure(readSources({ dir: UPSTREAM, sha: '7384f8c2' }))).code, 'missing');
  assert.equal((await failure(readSources({ dir: UPSTREAM }))).code, 'missing');
});

// GitHub, served from the fixture: the ref is resolved once and every file read at its sha.
function fakeGitHub(root, { sha = SHA, status = {} } = {}) {
  const requests = [];
  const respond = (code, body) => ({
    status: code,
    ok: code >= 200 && code < 300,
    arrayBuffer: async () => new TextEncoder().encode(typeof body === 'string' ? body : JSON.stringify(body)).buffer,
  });
  const fetchImpl = async (url) => {
    requests.push(url);
    for (const [part, code] of Object.entries(status)) if (url.includes(part)) return respond(code, '');
    let m;
    if ((m = url.match(/^https:\/\/api\.github\.com\/repos\/pilifs\/in-the-loop\/commits\/(.+)$/))) return respond(200, sha);
    if ((m = url.match(/^https:\/\/raw\.githubusercontent\.com\/pilifs\/in-the-loop\/([0-9a-f]{40})\/(.+)$/))) {
      assert.equal(m[1], sha, 'read at the resolved sha');
      const file = path.join(root, m[2]);
      return fs.existsSync(file) ? respond(200, fs.readFileSync(file, 'utf8')) : respond(404, '');
    }
    if (url.includes('/contents/llm-dlc?ref=')) return respond(200, [{ path: 'llm-dlc/traces', type: 'dir', sha: 'tree-traces' }]);
    if (url.includes('/git/trees/tree-traces?recursive=1')) {
      const base = path.join(root, 'llm-dlc/traces');
      const tree = fs
        .readdirSync(base, { recursive: true, withFileTypes: true })
        .filter((e) => e.isFile())
        .map((e) => ({ type: 'blob', path: path.relative(base, path.join(e.parentPath, e.name)) }));
      return respond(200, { truncated: false, tree });
    }
    return respond(404, '');
  };
  return { fetchImpl, requests };
}

test('reading from GitHub resolves the ref once and gives the same files as a directory', async () => {
  const { dir } = materialize('stale-source');
  const sid = json(dir, 'llm-dlc/index.json').sessions[1].session_id;
  write(dir, `llm-dlc/traces/${sid}/runs/2026-11-01-010000-foundations.md`, '#\n');
  const gh = fakeGitHub(dir);
  const remote = await readSources({ ref: 'main', fetchImpl: gh.fetchImpl });
  const local = await read(dir);
  assert.equal(remote.source.sha, SHA);
  assert.equal(remote.source.ref, 'main');
  assert.equal(gh.requests.filter((u) => u.includes('/commits/')).length, 1);
  assert.deepEqual([...remote.files.keys()].sort(), [...local.files.keys()].sort());
  for (const [k, v] of local.files) assert.ok(v.equals(remote.files.get(k)), k);
  assert.deepEqual(remote.runs, local.runs);
  assert.deepEqual(normalizeSources(remote), normalizeSources(local));
});

test('a GitHub server error is a network failure, a 404 on a required file is missing', async () => {
  const e = await failure(readSources({ sha: SHA, fetchImpl: fakeGitHub(UPSTREAM, { status: { 'results/index.json': 502 } }).fetchImpl }));
  assert.equal(e.code, 'network');
  const raw = await readSources({ sha: SHA, fetchImpl: fakeGitHub(UPSTREAM, { status: { 'examples/index.json': 404 } }).fetchImpl });
  const m = await failure(Promise.resolve().then(() => normalizeSources(raw)));
  assert.deepEqual([m.code, m.path], ['missing', 'examples/index.json']);
});

test('an example keeps the catalog’s own answers: where it is, what it says, and whether the tests passed', async () => {
  const { dir } = materialize('stale-source');
  const index = json(dir, 'examples/index.json');
  const [a, b, c] = index.examples;
  Object.assign(a, { path: 'examples/105-pow', summary: 'What was found.', source: 'https://example.invalid/pull/1', existingTestsPassed: true, severity: 'high', changeKind: 'bug-fix' });
  // A path that leaves the examples folder, a link that isn't https and an answer that isn't yes or no are not kept.
  Object.assign(b, { path: '../secrets', summary: 7, source: 'javascript:alert(1)', existingTestsPassed: 'yes', severity: null });
  for (const key of ['path', 'summary', 'source', 'existingTestsPassed', 'severity', 'changeKind']) delete c[key];
  write(dir, 'examples/index.json', index);
  const n = await load(dir);
  const pick = (x) => [x.path, x.summary, x.sourceUrl, x.testsPassed, x.severity, x.changeKind];
  assert.deepEqual(pick(n.examples[0]), ['examples/105-pow', 'What was found.', 'https://example.invalid/pull/1', true, 'high', 'bug-fix']);
  assert.deepEqual(pick(n.examples[1]), [null, null, null, null, null, b.changeKind ?? null]);
  assert.deepEqual(pick(n.examples[2]), [null, null, null, null, null, null]);
  // The fixture's own entries carry them as the catalog has them.
  const whole = await load(UPSTREAM);
  const first = json(UPSTREAM, 'examples/index.json').examples[0];
  assert.deepEqual([whole.examples[0].path, whole.examples[0].sourceUrl, whole.examples[0].severity], [first.path, first.source, first.severity]);
  assert.ok(whole.examples.some((x) => x.testsPassed === true) && whole.examples.some((x) => x.testsPassed === false) && whole.examples.some((x) => x.testsPassed === null));
});

test('an example’s result file gives what its verdict rests on, in either layout, and nothing else of it', () => {
  // The first layout: everything at the top.
  const first = exampleEvidence({
    verdict: 'violation',
    existingTests: { task: ':domain:test', passed: false, failures: ['A.one', 2, 'A.two', 'A.three', 'A.four', 'A.five', 'A.six'] },
    counterexamples: [{ input: 'decide(DECLINED)', contract: 'Transition[next=REFUND]', actual: 'Unchanged' }, { input: 'decide(OTHER)', contract: 'x', actual: 'y' }, 'not one'],
    before: { code: 'SECRET code' },
    trace: null,
    statesExplored: null,
  });
  assert.deepEqual(first, {
    tests: { task: ':domain:test', failed: ['A.one', 'A.two', 'A.three', 'A.four', 'A.five'] },
    counterexample: { input: 'decide(DECLINED)', expected: 'Transition[next=REFUND]', actual: 'Unchanged', count: 2 },
    trace: null,
    seconds: null,
    checker: null,
  });
  // Format 2: under evidence, with the attempt beside it. A value that isn't text is written as JSON.
  const second = exampleEvidence({
    format: 2,
    attempt: { seconds: 2.9, engine: 'jbmc', pipeline: { workdir: '/home/someone/work' } },
    conclusion: { label: '✗ Violation' },
    evidence: {
      existingTests: { task: 'java -ea Tests', passed: true, failures: [] },
      counterexamples: [{ input: 'grant(a=0)', expected: false, actual: true, witness: { inputs: [] } }],
      search: { checker: 'JBMC 6.11.0', seconds: 0.4 },
      trace: [{ step: 1, action: 'Initial predicate', changes: { x: 'SECRET state' } }, { step: 2, action: 'Hold' }, 'junk', { step: 3 }],
      invariant: 'NoMoneyStranded',
      statesExplored: 423,
    },
  });
  assert.deepEqual(second, {
    tests: { task: 'java -ea Tests', failed: [] },
    counterexample: { input: 'grant(a=0)', expected: 'false', actual: 'true', count: 1 },
    trace: { invariant: 'NoMoneyStranded', steps: 3, actions: ['Initial predicate', 'Hold'], states: 423 },
    seconds: 2.9,
    checker: 'JBMC 6.11.0',
  });
  assert.doesNotMatch(JSON.stringify([first, second]), /SECRET|\/home\//, 'no code, no state, no path on the machine');
  // Long text is cut at 320 characters, with an ellipsis; a long trace keeps its length and its first 24 actions.
  const long = exampleEvidence({ counterexamples: [{ input: 'x'.repeat(400), contract: 'y'.repeat(320), actual: null }], trace: Array.from({ length: 30 }, (_, i) => ({ action: `A${i}` })), statesExplored: -1, invariant: 7 });
  assert.equal(long.counterexample.input, `${'x'.repeat(319)}…`);
  assert.deepEqual([long.counterexample.expected.length, long.counterexample.actual], [320, null]);
  assert.deepEqual([long.trace.steps, long.trace.actions.length, long.trace.actions.at(-1), long.trace.states, long.trace.invariant], [30, 24, 'A23', null, null]);
  // Nothing of this in it, or no result at all: null, never an empty record.
  for (const nothing of [null, undefined, 'text', [], {}, { format: 2, evidence: { counterexamples: [], trace: [] }, attempt: { seconds: 'fast' } }, { existingTests: { passed: true } }])
    assert.equal(exampleEvidence(nothing), null);
  assert.deepEqual(exampleEvidence({ format: 2, attempt: { seconds: 0 } }), { tests: null, counterexample: null, trace: null, seconds: 0, checker: null });
});

test('each example’s result file is read from its folder, listed as an input, and not required', async () => {
  const { dir } = materialize('stale-source');
  const index = json(dir, 'examples/index.json');
  const [a, b, c] = index.examples;
  Object.assign(a, { path: 'examples/001-first' });
  Object.assign(b, { path: 'examples/002-second' });
  Object.assign(c, { path: '../outside' });
  write(dir, 'examples/index.json', index);
  write(dir, 'examples/001-first/result.json', { existingTests: { task: ':t:test', passed: true, failures: [] }, counterexamples: [{ input: 'f(1)', contract: '2', actual: '3' }] });
  // A file beside it that the catalog doesn't point at is never read.
  write(dir, 'examples/099-stray/result.json', { counterexamples: [{ input: 'stray', contract: '', actual: '' }] });
  const n = await load(dir);
  assert.deepEqual(n.examples[0].evidence, { tests: { task: ':t:test', failed: [] }, counterexample: { input: 'f(1)', expected: '2', actual: '3', count: 1 }, trace: null, seconds: null, checker: null });
  assert.equal(n.examples[1].evidence, null, 'no result file in its folder');
  assert.equal(n.examples[2].evidence, null, 'no folder to look in');
  // The manifest records the result files together: one input, hashed over a line for each file read.
  const listed = n.source.inputs.filter((i) => i.path.endsWith('/result.json'));
  const bytes = fs.readFileSync(path.join(dir, 'examples/001-first/result.json'));
  const line = `examples/001-first/result.json ${crypto.createHash('sha256').update(bytes).digest('hex')}\n`;
  assert.deepEqual(listed, [{ path: 'examples/*/result.json', sha256: crypto.createHash('sha256').update(line).digest('hex'), bytes: bytes.length, schema: '' }]);
  assert.deepEqual(n.source.inputs.map((i) => i.path), n.source.inputs.map((i) => i.path).sort());
  assert.doesNotMatch(JSON.stringify(n.examples), /stray/);
  // A result that isn't JSON can't be trusted: the import stops, naming it.
  fs.mkdirSync(path.join(dir, 'examples/002-second'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'examples/002-second/result.json'), '{ not json');
  await assert.rejects(load(dir), (err) => err instanceof SourceError && err.code === 'malformed' && err.path === 'examples/002-second/result.json');
});

test('a call keeps its thinking tokens and its price with nothing cached, beside its usd', async () => {
  const { dir } = materialize('stale-source');
  const rel = 'llm-dlc/traces/2e359813-25c2-4259-888b-42d3a5f0eee6/metrics.json';
  const metrics = json(dir, rel);
  const n = await load(dir);
  const own = n.calls.filter((c) => c.session === '2e359813-25c2-4259-888b-42d3a5f0eee6');
  assert.equal(own.length, metrics.calls.length);
  for (const [i, c] of metrics.calls.entries()) {
    assert.equal(own[i].thinkingTokens, c.thinking_tokens);
    assert.equal(own[i].uncachedUsd, c.uncached_usd);
  }
  // A call that writes the cache is priced above the same call with nothing cached; over a session it is the other way.
  assert.ok(own.some((c) => c.uncachedUsd < c.usd) && own.reduce((t, c) => t + c.uncachedUsd, 0) > own.reduce((t, c) => t + c.usd, 0));

  // A call the source gives neither is kept, with nulls: never 0, which would read as a value.
  delete metrics.calls[0].thinking_tokens;
  delete metrics.calls[0].uncached_usd;
  write(dir, rel, metrics);
  const without = (await load(dir)).calls.filter((c) => c.session === '2e359813-25c2-4259-888b-42d3a5f0eee6')[0];
  assert.equal(without.thinkingTokens, null);
  assert.equal(without.uncachedUsd, null);

  // One that is not a price is a schema error naming its file.
  metrics.calls[1].uncached_usd = -1;
  write(dir, rel, metrics);
  const e = await failure(load(dir));
  assert.equal(e.code, 'schema');
  assert.equal(e.path, rel);
});

test('what the client counted itself is summed over the sessions that have it, beside their calls', async () => {
  const { dir } = materialize('stale-source');
  const rollup = json(dir, 'llm-dlc/traces/metrics.json');
  const counted = rollup.sessions.filter((s) => s.reported_usd != null);
  assert.ok(counted.length && counted.length < rollup.sessions.length, 'the fixture has sessions with a count and without');
  const n = await load(dir);
  assert.equal(n.reported.sessions, counted.length);
  assert.equal(n.reported.ofSessions, rollup.sessions.length);
  assert.ok(Math.abs(n.reported.usd - counted.reduce((t, s) => t + s.reported_usd, 0)) < 1e-9);
  assert.ok(Math.abs(n.reported.callsUsd - counted.reduce((t, s) => t + s.usd, 0)) < 1e-9);
  // The fixture's rollup has no unattributed total: unknown, not zero.
  assert.equal(n.reported.unattributedUsd, null);

  // A rollup total that disagrees with its sessions fails to reconcile.
  rollup.totals.reported_usd = n.reported.usd + 1;
  write(dir, 'llm-dlc/traces/metrics.json', rollup);
  const e = await failure(load(dir));
  assert.equal(e.code, 'reconcile');

  // With the totals in agreement, the unattributed part is the source's own sum.
  rollup.totals.reported_usd = n.reported.usd;
  rollup.totals.unattributed_usd = 1.5;
  write(dir, 'llm-dlc/traces/metrics.json', rollup);
  assert.equal((await load(dir)).reported.unattributedUsd, 1.5);

  // No session with a count: no figure at all.
  for (const s of rollup.sessions) s.reported_usd = null;
  delete rollup.totals.reported_usd;
  write(dir, 'llm-dlc/traces/metrics.json', rollup);
  assert.equal((await load(dir)).reported, null);
});
