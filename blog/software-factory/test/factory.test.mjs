// The feature loops, the tools and the code: how their records are read
// (records.mjs), counted (factory.mjs through metrics.mjs's aggregate) and
// drawn (assets/software-factory/factory.js). Run: npm run test:software-factory

import assert from 'node:assert/strict';
import test from 'node:test';
import { detailTable } from '../../assets/software-factory/details.js';
import { campaignRunsHtml, changePlotHtml, codeHtml, findingsHtml, heroHtml, loopsHtml, runningHtml, span, stretches, stumbles, toolChartHtml, toolDays, toolsHtml } from '../../assets/software-factory/factory.js';
import { floorHtml } from '../../assets/software-factory/figures.js';
import { scatterSvg, shareTicks } from '../../assets/software-factory/figures.js';
import { loadConfig } from '../import.mjs';
import { aggregate } from '../metrics.mjs';
import { campaignOf, classOf, parseBlame, parseGitLog, parseRunRecord, parseScriptLog, parseTree, senderOf } from '../records.mjs';
import { validate } from '../validate.mjs';

const config = loadConfig();
const S1 = '11111111-1111-4111-8111-111111111111';
const S2 = '22222222-2222-4222-8222-222222222222';
const C1 = 'k'.repeat(31) + 'l';
const C2 = 'k'.repeat(31) + 'm';
const C3 = 'k'.repeat(31) + 'n';

// --- Reading -----------------------------------------------------------------

const RECORD = `# Feature loop: demo-heap

Started 2026-11-07 04:01:19 UTC, no limit on cycles, session ${S1}, claude-opus-5-5 at high effort, after change rvxkytqyxunz.

> Work on the brief. Stopped 2026-01-01 00:00:00: this is the instruction, quoted, and no end.

## Commits

Session ${S1} was forked from session ${S2}.

- cycle 1, 2026-11-07 04:15:59, \`kkkkkkkkkkkl\`: First step <b>done</b>
  - decided to continue: The loop should go on. Prose that is never read.
- cycle 2, 2026-11-07 05:00:00, \`kkkkkkkkkkkm\`: Second step
  - decided to stop: Finished.

## Summary

- cycle 9, 2026-11-07 09:00:00, \`kkkkkkkkkkkn\`: a line of the summary that looks like a cycle

Ended 2026-11-07 05:02:00 after 2 cycle(s): the session decided the work was done.
`;

test('a run record gives its header, its cycles with their decisions, and how it ended', () => {
  const r = parseRunRecord(RECORD, config.loops);
  assert.deepEqual(
    { started: r.started, limit: r.limit, session: r.session, model: r.model, effort: r.effort, ended: r.ended, outcome: r.outcome },
    { started: '2026-11-07T04:01:19Z', limit: null, session: S1, model: 'claude-opus-5-5', effort: 'high', ended: '2026-11-07T05:02:00Z', outcome: 'done' }
  );
  assert.deepEqual(r.cycles, [
    { n: 1, at: '2026-11-07T04:15:59Z', change: 'kkkkkkkkkkkl', summary: 'First step <b>done</b>', decision: 'continue' },
    { n: 2, at: '2026-11-07T05:00:00Z', change: 'kkkkkkkkkkkm', summary: 'Second step', decision: 'stop' },
  ]);
  assert.ok(!JSON.stringify(r).includes('Prose that is never read'), 'the decision’s prose stays out');
});

test('a run record: every way a run ends, a cycle limit, no end, and no header', () => {
  const ending = (line) => parseRunRecord(RECORD.replace(/^Ended .*$/m, line), config.loops);
  const cases = {
    'Ended 2026-11-07 05:02:00 after 2 cycle(s): the session decided to stop; the brief says done.': 'done',
    'Ended 2026-11-07 05:02:00 after 2 cycle(s): the session decided to stop; the brief says waiting on jobs ID 20261114-1.': 'waiting',
    'Ended 2026-11-07 05:02:00 after 2 cycle(s): the session decided to stop; the brief says blocked: needs the user.': 'blocked',
    'Stopped 2026-11-07 05:02:00 after 2 cycle(s): the session decided to stop, but the brief’s status still says working; session x needs attention.': 'attention',
    'Stopped 2026-11-07 05:02:00: cycle 2 made no commit; session x needs attention.': 'attention',
    'Ended 2026-11-07 05:02:00 after 2 cycle(s).': 'ended',
  };
  for (const [line, outcome] of Object.entries(cases)) assert.equal(ending(line).outcome, outcome, line);
  const open = ending('');
  assert.equal(open.outcome, 'open');
  assert.equal(open.ended, null, 'the quoted instruction’s "Stopped" is not an end: it does not start a line');
  assert.equal(parseRunRecord(RECORD.replace('no limit on cycles', 'at most 5 cycles'), config.loops).limit, 5);
  assert.equal(parseRunRecord('# Notes\n\nNot a record.\n', config.loops), null);
});

test('who sent a prompt: the loop, another agent, an interruption, or a person', () => {
  const sender = (text) => senderOf(text, config.loops);
  assert.equal(sender('Work on the brief in `llm-dlc/loops/x.md`. Read it in full now'), 'harness');
  assert.equal(sender('Cycle 12 of the feature loop is committed. Before the next cycle starts'), 'harness');
  assert.equal(sender('The feature loop is ending after 3 cycles'), 'harness');
  assert.equal(sender('<agent-message from="a1"> [Subagent hand-back'), 'agent');
  assert.equal(sender('<cross-session-message from="uds:/run/x">'), 'agent');
  assert.equal(sender('[Request interrupted by user]'), 'interrupt');
  // The fixed prompts the script sent before it worked from briefs.
  assert.equal(sender('Add more advanced examples showcasing verification of TLA specs'), 'harness');
  assert.equal(sender('Enhance relational verification capabilities to be more efficient and accurate'), 'harness');
  assert.equal(sender('Add more advanced tests'), 'person');
  assert.equal(sender('Continue'), 'person');
  assert.equal(sender('Please work on the brief in x'), 'person', 'only the start of the text counts');
  assert.equal(sender(null), 'person');
});

test('a loop’s campaign is the shortest brief it equals or extends', () => {
  const briefs = ['foundations', 'foundations-heap', 'foundations-review-draft', 'stub-reachability', 'found'];
  assert.equal(campaignOf('foundations-heap', briefs), 'foundations');
  assert.equal(campaignOf('foundations', briefs), 'foundations');
  assert.equal(campaignOf('stub-reachability', briefs), 'stub-reachability');
  assert.equal(campaignOf('foundations-review-draft', briefs), 'foundations');
  assert.equal(campaignOf('unknown-loop', briefs), 'unknown-loop');
});

const LOG = `commit ${'a'.repeat(40)}
tree ${'b'.repeat(40)}
parent ${'c'.repeat(40)}
author A <a@example.invalid> 1794744859 +0000
committer A <a@example.invalid> 1794744887 +0000
change-id ${C1}

    Add the checker

    commit 0000 is not a commit: the message is indented
    12	3	lib/src/not-a-stat.rs

10	2	lib/src/a.rs
5	0	llm-dlc/tools/sync.py
7	7	README.md
100	0	verification/results/x.json
-	-	cover.png
4	1	lib/{old => new}/b.rs
3	0	tools/old.sh => tools/new.txt
commit ${'d'.repeat(40)}
tree ${'b'.repeat(40)}
author A <a@example.invalid> 1794744000 -0500
committer A <a@example.invalid> 1794744000 -0500

    A commit made without jj: no change id
`;

test('git’s log gives each commit’s lines by class: renames by their new path, binaries nothing', () => {
  const [first, second] = parseGitLog(LOG, config.code);
  assert.equal(first.sha, 'a'.repeat(40));
  assert.equal(first.changeId, C1);
  assert.equal(first.committedAt, new Date(1794744887000).toISOString());
  assert.deepEqual(first.lines, { rust: [14, 3], python: [5, 0], docs: [7, 7], data: [103, 0] });
  assert.deepEqual({ changeId: second.changeId, lines: second.lines }, { changeId: null, lines: {} });
  assert.equal(classOf('a/b/Makefile', config.code), 'data');
  assert.equal(classOf('.github/x.YML', config.code), 'data');
  assert.equal(classOf('lib/Foo.JAVA', config.code), 'java');
  assert.deepEqual(parseTree('12\t0\tlib/a.rs\n3\t0\tdocs/x.md\n-\t-\tx.png\n', config.code), { rust: 12, docs: 3 });
});

test('git blame gives each commit the lines it still holds; the script log lists commits oldest first', () => {
  const a = 'a'.repeat(40);
  const b = 'b'.repeat(40);
  const blame = `${a} 1 1 3\nauthor A\nsummary ${b} 9 9 9 is a subject, not an entry\nfilename lib/a.rs\n${b} 4 4 2\nfilename lib/a.rs\n\n${a} 7 1 5\nfilename lib/b.rs\n`;
  assert.deepEqual(parseBlame(blame), { [a]: 8, [b]: 2 });
  assert.deepEqual(parseBlame(''), {});
  assert.deepEqual(parseScriptLog(`${b}\t1794744887\tSecond <b>change</b>\n${a}\t1794744000\tFirst\nnot a line\n`), [
    { sha: a, at: '2026-11-15T12:00:00Z', subject: 'First' },
    { sha: b, at: '2026-11-15T12:14:47Z', subject: 'Second <b>change</b>' },
  ]);
});

// --- Counting ----------------------------------------------------------------

const call = (start, o = {}) => ({ session: S1, subagent: false, start, model: 'claude-opus-5-5', effort: 'high', inputTokens: 10, cacheReadTokens: 80, cacheWriteTokens: 10, outputTokens: 500, usd: 0.5, ...o });
const prompt = (start, sender, o = {}) => ({ session: S1, start, end: start, sender, command: null, calls: 2, toolCalls: 3, toolErrors: 0, outputTokens: 100, usd: 1, agentMs: 60000, ...o });
const tool = (start, o = {}) => ({ session: S1, start, name: 'Bash', family: 'sed', status: 'ok', errorKind: null, model: 'claude-opus-5-5', contextTokens: 20000, ...o });
const session = (id, o = {}) => ({ id, title: null, status: 'ended', started: null, ended: null, models: [], hasMetrics: true, hasPrompts: true, hasTools: true, inRollup: true, campaign: null, ...o });
const record = (id, loop, o = {}) => ({
  id,
  loop,
  campaign: 'demo',
  session: S1,
  started: '2026-11-07T04:00:00Z',
  ended: '2026-11-07T06:00:00Z',
  outcome: 'done',
  model: 'claude-opus-5-5',
  effort: 'high',
  limit: null,
  cycles: [{ n: 1, at: '2026-11-07T04:30:00Z', change: C1.slice(0, 12), summary: 'First <script>x</script>', decision: 'stop' }],
  ...o,
});

function normalized(o = {}) {
  return {
    source: { repository: 'pilifs/in-the-loop', sha: 'a'.repeat(40), inputs: [] },
    pricingAsOf: '2026-10-31',
    rollup: { calls: 0, usd: 0, sessions: 1 },
    calls: [call('2026-11-07T04:10:00Z'), call('2026-11-07T12:00:00Z', { model: 'claude-sonnet-5-5' })],
    sessions: [session(S1)],
    changes: [
      { changeId: C1, summary: 'First', sessions: [S1], housekeeping: false, campaign: null, took: { calls: 4, outputTokens: 900, usd: 1.5 } },
      { changeId: C2, summary: 'Record session traces', sessions: [S1], housekeeping: true, campaign: null, took: null },
    ],
    verification: [],
    examples: [],
    tags: { domain: [], defect: [], technique: [] },
    prompts: [
      prompt('2026-11-07T03:00:00Z', 'person'), // before the run
      prompt('2026-11-07T04:00:01Z', 'harness'),
      prompt('2026-11-07T04:20:00Z', 'command', { command: '/compact', calls: 0, toolCalls: 0 }),
      prompt('2026-11-07T04:40:00Z', 'agent'),
      prompt('2026-11-07T07:00:00Z', 'person'), // after it
    ],
    tools: [
      tool('2026-11-07T03:00:00Z', { status: 'error', errorKind: 'denied' }),
      tool('2026-11-07T04:10:00Z'),
      tool('2026-11-07T04:11:00Z', { status: 'error', errorKind: 'exit_code' }),
      tool('2026-11-07T04:12:00Z', { name: 'Monitor', family: null, status: 'error', errorKind: 'tool_use_error', contextTokens: 120000 }),
      tool('2026-11-07T12:00:00Z', { model: 'claude-sonnet-5-5', status: 'error', errorKind: null }),
      tool('2026-11-07T12:01:00Z', { model: 'claude-sonnet-5-5', status: 'no_result' }),
    ],
    sessionCommits: [
      { session: S1, at: '2026-11-07T04:30:00Z', changeId: C1 },
      { session: S1, at: '2026-11-07T04:31:00Z', changeId: C2 }, // housekeeping: not the loop's work
      { session: S1, at: '2026-11-07T08:00:00Z', changeId: C3 }, // after the run
    ],
    runs: [record('2026-11-07-040000-demo-heap', 'demo-heap')],
    unreadRuns: 0,
    code: {
      commits: [
        { sha: 'a'.repeat(40), changeId: C1, committedAt: '2026-11-07T04:30:00.000Z', lines: { rust: [90, 10], docs: [40, 0], data: [1000, 0] } },
        { sha: 'b'.repeat(40), changeId: null, committedAt: '2026-11-08T15:00:00.000Z', lines: { python: [10, 5] } },
      ],
      tree: { rust: 80, python: 5, docs: 40, data: 1000 },
    },
    ...o,
  };
}
function run(o) {
  const out = aggregate(normalized(o), { config });
  assert.deepEqual(validate('overview', out.overview), []);
  assert.deepEqual(validate('manifest', out.manifest), []);
  for (const [name, value] of Object.entries(out.details)) assert.deepEqual(validate(name, value), [], name);
  return out;
}
const snapshotOf = (out) => ({ pointer: { lastSourceCheck: null }, manifest: out.manifest, overview: out.overview });

test('a run counts what its session did between its start and its end, and nothing outside', () => {
  const { overview, details } = run();
  const t = overview.loops.totals;
  assert.deepEqual(t.prompts, { harness: 1, person: 0, agent: 1, interrupt: 0, compactions: 1 }, 'the prompts typed before and after the run are not the run’s');
  assert.deepEqual([t.runs, t.cycles, t.calls, t.toolCalls, t.usd, t.agentSeconds], [1, 1, 4, 6, 3, 180]);
  assert.equal(t.commits, 1, 'the housekeeping commit and the one after the run are left out');
  assert.equal(t.codeAdded, 90);
  assert.equal(overview.loops.runs[0].seconds, 7200);
  assert.deepEqual(overview.loops.runs[0].ticks, [1800]);
  assert.deepEqual(overview.loops.longest.ledger, [{ n: 1, at: '2026-11-07T04:30:00Z', summary: 'First <script>x</script>' }]);
  // The run, 04:00Z to 06:00Z, is still the evening of 6 November in Toronto; 12:00Z is the 7th.
  assert.deepEqual(overview.days, ['2026-11-06', '2026-11-07']);
  assert.deepEqual(overview.loops.daily.rows, [[0, 3, 1], [1, 0, 2]], 'three tool calls inside the run, three outside it');
  const [r] = details.loops.records;
  assert.equal(r.recordUrl, `https://github.com/pilifs/in-the-loop/blob/${'a'.repeat(40)}/llm-dlc/traces/${S1}/runs/2026-11-07-040000-demo-heap.md`);
  assert.equal(overview.loops.campaigns[0].id, 'demo');
});

test('a prompt typed during a run, and an interruption, are counted against it', () => {
  const base = normalized();
  const { overview } = run({ prompts: [...base.prompts, prompt('2026-11-07T05:00:00Z', 'person'), prompt('2026-11-07T05:10:00Z', 'interrupt')] });
  assert.deepEqual([overview.loops.totals.prompts.person, overview.loops.totals.prompts.interrupt], [1, 1]);
  assert.equal(overview.loops.runs[0].person, 2);
  assert.equal(overview.loops.longest, null, 'a run someone typed into is not an unattended one');
  const html = heroHtml(snapshotOf({ manifest: { source: { sha: 'a'.repeat(40) } }, overview }), { title: 'Software Factory', lede: 'x' });
  assert.match(html, /with 2 prompts from a person/);
  assert.doesNotMatch(html, /without a prompt|Nobody typed/);
});

test('runs side by side: the peak, each campaign’s streams, and a run with no end recorded', () => {
  const second = session(S2);
  const base = normalized();
  const { overview } = run({
    sessions: [base.sessions[0], second],
    runs: [
      record('2026-11-07-040000-demo-heap', 'demo-heap'),
      record('2026-11-07-050000-demo-values', 'demo-values', { session: S2, started: '2026-11-07T05:00:00Z', ended: null, outcome: 'open' }),
      record('2026-11-07-070000-demo', 'demo', { started: '2026-11-07T07:00:00Z', ended: '2026-11-07T07:30:00Z', outcome: 'blocked' }),
    ],
    prompts: [...base.prompts, prompt('2026-11-07T05:00:10Z', 'harness', { session: S2, end: '2026-11-07T05:40:00Z' })],
  });
  const [campaign] = overview.loops.campaigns;
  assert.deepEqual([campaign.runs, campaign.streams, campaign.peakParallel, campaign.outcome], [3, 2, 2, 'blocked']);
  assert.deepEqual([overview.loops.runs.map((r) => r.commits), campaign.commits, campaign.codeAdded], [[1, 1, 1], 1, 90], 'a change committed in three runs is one commit, and its lines are counted once');
  const open = overview.loops.runs.find((r) => r.loop === 'demo-values');
  assert.equal(open.ended, '2026-11-07T05:40:00Z', 'it lasts until its last prompt from the loop ends');
  assert.deepEqual(overview.loops.outcomes, { done: 1, open: 1, blocked: 1 });
});

test('a run whose session has no prompts table is counted as a run, with no activity invented', () => {
  const { overview } = run({ sessions: [session(S1, { hasPrompts: false })], prompts: [] });
  assert.deepEqual(overview.loops.coverage, { included: 0, total: 1, missing: 1, note: 'runs whose session has a prompts table' });
  assert.deepEqual([overview.loops.runs[0].toolCalls, overview.loops.runs[0].person], [null, null]);
  assert.equal(overview.loops.totals.toolCalls, 0);
});

test('tool calls: how each ended, by day and model, by tool, by context and inside a run or not', () => {
  const { overview } = run();
  const t = overview.tools;
  assert.deepEqual(t.totals, { calls: 6, errors: 4, exit: 1, rejected: 1, denied: 1, other: 1, ok: 1, noResult: 1 });
  assert.deepEqual(t.daily.rows, [
    [0, 0, 4, 3, 1, 1, 1, 0],
    [1, 1, 2, 1, 0, 0, 0, 1],
  ]);
  assert.deepEqual(t.byMode.runs, { calls: 3, errors: 2, exit: 1, rejected: 1, denied: 0, other: 0 });
  assert.deepEqual(
    t.byContext.map((b) => [b.from, b.to, b.calls, b.errors]),
    [
      [0, 50000, 5, 3],
      [100000, 150000, 1, 1],
    ]
  );
  assert.deepEqual(t.byTool.map((x) => [x.name, x.calls, x.rejected]), [['Bash', 5, 0], ['Monitor', 1, 1]]);
  assert.deepEqual(t.dayTop, [
    { day: 0, source: 'sed (Bash)', errors: 2 },
    { day: 1, source: 'sed (Bash)', errors: 1 },
  ]);
  // One model's days: its own calls only, and a day it made none has no value.
  const sonnet = toolDays(overview, 1);
  assert.equal(sonnet[0].up, null);
  assert.deepEqual([sonnet[1].calls, sonnet[1].errors, sonnet[1].up], [2, 1, [0, 0, 0, 0.5]]);
});

test('code: lines by language from git, what is still in the tree, and tokens per line', () => {
  const { overview, details } = run();
  const c = overview.code;
  assert.deepEqual(c.totals, { added: 100, removed: 15, inTree: 85 });
  assert.deepEqual(c.languages.map((l) => [l.id, l.added, l.removed, l.inTree]), [['rust', 90, 10, 80], ['python', 10, 5, 5]]);
  assert.deepEqual([c.docs.added, c.data.added], [40, 1000], 'docs and data are counted apart, never as code');
  assert.equal(c.retained, 0.85);
  assert.equal(c.tokensPerLine, 10, '1,000 output tokens over 100 lines of code');
  assert.deepEqual(c.coverage, { included: 1, total: 2, missing: 1, note: 'commits whose change id the traces record' });
  assert.deepEqual(c.days, ['2026-11-06', '2026-11-07', '2026-11-08']);
  assert.deepEqual(c.daily.rows, [[0, 90, 10, 1, null], [2, 10, 5, 1, null]], 'no blame was read: surviving is null, not zero');
  const change = details.changes.records.find((r) => r.changeId === C1);
  assert.deepEqual(
    { commit: change.commit, codeAdded: change.codeAdded, codeRemoved: change.codeRemoved, calls: change.calls, outputTokens: change.outputTokens, usd: change.usd },
    { commit: 'a'.repeat(40), codeAdded: 90, codeRemoved: 10, calls: 4, outputTokens: 900, usd: 1.5 }
  );
  assert.ok(!('commit' in details.changes.records.find((r) => r.changeId === C2)), 'a change git doesn’t have keeps no commit');
});

test('who set off the work: each tool call goes to the sender of the prompt before it', () => {
  const { overview } = run();
  // 03:00Z is a person's; 04:10 to 04:12 follow the loop's prompt; 12:00Z follows the person's at 07:00Z.
  assert.deepEqual(overview.loops.drive.rows, [[0, 3, 1, 0, 1], [1, 0, 2, 0, 1]]);
  const base = normalized();
  const later = run({
    prompts: [...base.prompts, prompt('2026-11-07T04:10:30Z', 'notification'), prompt('2026-11-07T04:11:30Z', 'command', { command: '/compact' }), prompt('2026-11-07T04:11:45Z', 'notification')],
  }).overview;
  assert.deepEqual(later.loops.drive.rows[0], [0, 2, 1, 1, 1], 'a notification keeps the loop as the driver; a slash command is other, and so is what follows it');
  assert.equal(overview.loops.scripts, null, 'no script history was read');
  const html = loopsHtml(snapshotOf(run()));
  assert.match(html, /Who set off the work/);
  assert.match(html, /behind 50% of all 6 tool calls/);
  assert.match(html, /Tool calls for each prompt a person typed/);
  assert.doesNotMatch(html, /sf-flag|How the loop itself changed/);
});

test('the loop’s own history: its scripts’ commits, flagged on their days and listed, escaped', () => {
  const base = normalized();
  const scripts = [
    { sha: 'e'.repeat(40), at: '2026-11-07T03:30:00Z', subject: 'Add <b>the loop</b>' },
    { sha: 'f'.repeat(40), at: '2026-11-07T13:00:00Z', subject: 'Run streams' },
  ];
  const out = run({ code: { ...base.code, scripts } });
  assert.deepEqual(out.overview.loops.scripts, { paths: config.loops.scripts.paths, commits: scripts });
  const html = loopsHtml(snapshotOf(out));
  assert.equal(html.match(/class="sf-flag"/g).length, 4, 'two flagged days, each drawn wide and compact');
  assert.match(html, /How the loop itself changed: 2 commits to its scripts, Nov 6 to Nov 7/);
  assert.match(html, new RegExp(`<a href="https://github.com/pilifs/in-the-loop/commit/${'e'.repeat(40)}">Add &lt;b&gt;the loop&lt;/b&gt;</a>`));
  assert.doesNotMatch(html, /<b>the loop/);
});

test('after a failure: the next call, streaks, and failures by time into a run and by loops at once', () => {
  const { overview } = run();
  const t = overview.tools;
  // 03:00 failed, then 04:10 succeeded; 04:11, 04:12 and 12:00 failed in a row; 12:01 has no result.
  assert.deepEqual(t.recovery, { failures: 4, nextOk: 1, nextFailed: 2, noNext: 1, streaks: [[1, 1], [3, 1]] });
  assert.deepEqual(t.byRunHour, [{ from: 0, to: 1, calls: 3, errors: 2, exit: 1, rejected: 1, denied: 0, other: 0 }], 'only the calls inside the run');
  assert.deepEqual(t.byParallel, [{ runs: 1, calls: 3, errors: 2, exit: 1, rejected: 1, denied: 0, other: 0 }]);
  const html = toolsHtml(snapshotOf(run()));
  assert.match(html, /After a failure/);
  assert.match(html, /1 of 4 failed calls/);
  assert.match(html, /In a row: 1 call once, 3 calls once/);
  assert.doesNotMatch(html, /tools-by-run-hour|tools-by-parallel/, 'one row is no comparison: the tables wait for two');
});

test('rework: git blame splits a day’s code into what stands and what was rewritten', () => {
  const base = normalized();
  const out = run({ code: { ...base.code, blame: { ['a'.repeat(40)]: 70, ['b'.repeat(40)]: 12 } } });
  assert.deepEqual(out.overview.code.daily.rows, [[0, 90, 10, 1, 70], [2, 10, 5, 1, 10]], 'a commit is never credited with more than it added');
  assert.equal(out.details.changes.records.find((r) => r.changeId === C1).codeSurviving, 70);
  const html = codeHtml(snapshotOf(out));
  assert.match(html, /How much of each day’s code still stands/);
  assert.match(html, /Nov 6 was reworked most: 77\.8% of its 90 lines stand/);
  assert.match(html, /sf-series-kept/);
  assert.match(html, /<td>70<\/td><td>77\.8%<\/td>/);
  const plain = codeHtml(snapshotOf(run()));
  assert.match(plain, /Code committed per day/);
  assert.doesNotMatch(plain, /still stands|sf-series-kept/);
});

test('what a change took: the spread of tokens per line, the loop that made it, and the plot', () => {
  const base = normalized();
  // Ids that share no prefix with the run's cycle, which names its change by twelve characters.
  const D1 = 'z'.repeat(32);
  const D2 = 'y'.repeat(32);
  const out = run({
    changes: [...base.changes, { changeId: D1, summary: 'Docs only', sessions: [S1], housekeeping: false, campaign: null, took: { calls: 1, outputTokens: 300, usd: 0.25 } }, { changeId: D2, summary: 'Free <i>code</i>', sessions: [S1], housekeeping: false, campaign: null, took: { calls: 0, outputTokens: 0, usd: 0 } }],
    code: {
      ...base.code,
      commits: [
        ...base.code.commits,
        { sha: 'c'.repeat(40), changeId: D1, committedAt: '2026-11-07T08:00:00.000Z', lines: { docs: [20, 0] } },
        { sha: 'd'.repeat(40), changeId: D2, committedAt: '2026-11-07T09:00:00.000Z', lines: { rust: [5, 0] } },
      ],
    },
  });
  const pc = out.overview.code.perChange;
  assert.deepEqual(pc.coverage, { included: 3, total: 3, missing: 0, note: 'committed changes the rollup gives a cost for' });
  assert.deepEqual(pc.code, { changes: 2, added: 95, outputTokens: 900, usd: 1.5 });
  assert.deepEqual(pc.noCode, { changes: 1, added: 0, outputTokens: 300, usd: 0.25 });
  assert.deepEqual([pc.untaken, pc.median, pc.p10, pc.p90], [1, 10, 10, 10], 'the change with no tokens is left out of the spread');
  assert.deepEqual(pc.buckets.map((b) => b.changes), [1, 0, 0, 0, 0, 0]);
  const records = out.details.changes.records;
  assert.equal(records.find((r) => r.changeId === C1).loop, 'demo-heap', 'committed inside the run');
  assert.ok(!('loop' in records.find((r) => r.changeId === D1)), 'committed after it');
  const html = codeHtml(snapshotOf(out));
  assert.match(html, /What a change took/);
  assert.match(html, /10 per line/);
  assert.match(html, /data-sf-change-plot data-median="10"/);
  const plot = changePlotHtml(records, { median: pc.median });
  assert.equal(plot.match(/class="sf-dot /g).length, 2, 'one change with code and tokens, drawn wide and compact');
  assert.match(plot, new RegExp(`<a href="https://github.com/pilifs/in-the-loop/commit/${'a'.repeat(40)}">`));
  assert.match(plot, /sf-series-by-loop/);
  assert.match(changePlotHtml([{ changeId: D2, summary: '<i>x</i>', codeAdded: 5, outputTokens: 50 }]), /&lt;i&gt;x&lt;\/i&gt;/);
  assert.match(changePlotHtml([]), /No change in this snapshot/);
  assert.equal(run().overview.code.perChange.median, 10);
  assert.equal(run({ changes: base.changes.map((c) => ({ ...c, took: null })) }).overview.code.perChange, null, 'no cost recorded: no spread, not zeros');
});

test('the scatter: log axes from the decade below to just above the data, and a guide', () => {
  const svg = scatterSvg(
    [
      { x: 3, y: 500, key: 'by-loop', tip: 'a', href: null },
      { x: 2000, y: 90000, key: 'by-person', tip: 'b', href: 'https://example.invalid/x' },
    ],
    { id: 't', title: 'T', xLabel: 'X', yLabel: 'Y', guide: { slope: 100, label: '100 per line' } }
  );
  assert.equal(svg.match(/<svg /g).length, 2);
  assert.match(svg, />1K<\/text>/);
  assert.match(svg, /class="sf-guide"/);
  assert.match(svg, /<a href="https:\/\/example\.invalid\/x"><circle/);
  assert.doesNotMatch(svg, /NaN|Infinity/);
});

test('nothing measured is null, never zero: no run record, no tools table, no checkout', () => {
  const { overview, manifest, details } = run({ runs: [], tools: [], code: null, sessions: [session(S1, { hasTools: false })] });
  assert.deepEqual([overview.loops, overview.tools, overview.code], [null, null, null]);
  assert.deepEqual(details.loops.records, []);
  assert.deepEqual(manifest.datasets.map((d) => d.id), ['usage', 'verification', 'changes', 'catalog']);
  const snap = snapshotOf({ manifest, overview });
  for (const html of [loopsHtml(snap), toolsHtml(snap), codeHtml(snap)]) {
    assert.match(html, /class="sf-empty" role="status"/);
    assert.doesNotMatch(html, /sf-figure-value/);
  }
  assert.match(heroHtml(snap, { title: 'Software Factory', lede: 'The lede.' }), /<h1>Software Factory<\/h1><p class="sf-lede">The lede\.<\/p>/);
});

test('a snapshot made before these were read has no such fields, and each section says so', () => {
  const { overview, manifest } = run();
  const { loops, tools, code, ...old } = overview;
  assert.deepEqual(validate('overview', old), []);
  const snap = snapshotOf({ manifest, overview: old });
  for (const html of [loopsHtml(snap), toolsHtml(snap), codeHtml(snap)]) assert.match(html, /class="sf-empty"/);
  assert.equal(findingsHtml(snap), '', 'and the overview has no finding to claim');
});

// --- Drawing -----------------------------------------------------------------

test('the leading sections carry their numbers in static HTML, each with coverage and a definition', () => {
  const out = run();
  const snap = snapshotOf(out);
  const hero = heroHtml(snap, { title: 'Software Factory', lede: 'x' });
  assert.match(hero, /<h1><span class="sf-eyebrow">Software Factory<\/span> <span class="sf-headline">6 tool calls and 1 commit without a prompt from a person<\/span><\/h1>/);
  assert.doesNotMatch(hero, /sf-strip|sf-button/, 'the headline and the run record, nothing else');
  const loops = loopsHtml(snap);
  assert.match(loops, /<h1 id="sf-loops-title">/, 'each section leads its own page');
  assert.match(loops, /Coverage: 1 of 1 runs whose session has a prompts table/);
  assert.match(loops, /href="\/software-factory\/methodology\/#def-loop_person_prompts"/);
  assert.match(loops, /<svg class="sf-chart sf-chart-wide"[^>]*role="img"/);
  assert.match(loops, /<details class="sf-data-table">/);
  assert.match(loops, /data-sf-campaign="demo"/);
  const tools = toolsHtml(snap);
  assert.match(tools, /16\.7% of 6 tool calls succeeded/);
  assert.match(tools, /<code class="sf-muted">claude-sonnet-5-5<\/code>/, 'raw model ids beside the names');
  const code = codeHtml(snap);
  assert.match(code, /100 lines of code, about 10 output tokens each/);
  assert.match(code, /85\.0%/);
  // Described, never explained or ranked; and nothing is called live.
  // The overview's findings: a claim from the data, three numbers, one chart and a link, per section.
  const findings = findingsHtml(snap);
  assert.equal((findings.match(/<article class="sf-panel sf-finding[ "]/g) ?? []).length, 3);
  // One run and one commit are no pace to claim: the loops finding counts them instead.
  assert.match(findings, /<h2 id="finding-loops-title"><a href="\/software-factory\/loops\/">One campaign, 1 run, 1 cycle, no prompt from a person<\/a><\/h2>/);
  assert.match(findings, /<dt>of all tool calls were set off by a loop’s own prompt<\/dt><dd>50%<\/dd>/);
  assert.match(findings, /<dt>the longest run nobody typed into<\/dt><dd>2 h<\/dd>/);
  assert.match(findings, /<a href="\/software-factory\/tools\/">16\.7% of 6 tool calls succeeded<\/a>/);
  assert.match(findings, /Of the 4 that failed, 1 was a command that ran and exited non-zero/);
  assert.match(findings, /<a href="\/software-factory\/code\/">100 lines of code, about 10 output tokens each<\/a>/);
  // The loops finding carries every run on one clock; the other two a chart of days.
  assert.equal((findings.match(/<div class="sf-floor"/g) ?? []).length, 1);
  assert.match(findings, /<li style="left:0%;width:[\d.]+%"><a href="\/software-factory\/loops\/#loop-demo"><code>demo<\/code><\/a><\/li>/);
  assert.match(findings, /data-tip="demo-heap, from Nov 6, 11 pm: 1 cycle and 1 commit in 2 h\. Done\."/);
  assert.equal((findings.match(/<svg class="sf-chart sf-chart-wide"/g) ?? []).length, 2, 'one chart each');
  assert.equal((findings.match(/<ul class="sf-legend[ "]/g) ?? []).length, 3, 'each figure has its legend');
  assert.doesNotMatch(findings, /The table below/, 'the tables are on the pages the findings open');
  assert.match(loops, /<h2>Every run on one clock<\/h2>/, 'and the loops page has the same figure');
  const text = [hero, findings, loops, tools, code, runningHtml()].join(' ').replace(/<[^>]+>/g, ' ');
  assert.doesNotMatch(text, /\blive\b|\bbetter than\b|\bbecause\b/i);
  assert.match(runningHtml(), /Not connected yet/);
  assert.doesNotMatch(runningHtml(), /sf-example/);
  assert.match(runningHtml({ note: 'Made up.', loops: [{ loop: 'x', state: 'active', cycle: '1', lastCommit: 'a', lastOutput: 'b', spend: '$1' }] }), /<strong>Example data\.<\/strong> Made up\./);
});

test('what comes from data is escaped, and only https links are followed', () => {
  const out = run();
  const snap = snapshotOf(out);
  for (const html of [heroHtml(snap, { title: 'T', lede: 'L' }), loopsHtml(snap)]) assert.doesNotMatch(html, /<script>/);
  assert.match(heroHtml(snap, { title: 'T', lede: 'L' }), /First &lt;script&gt;x&lt;\/script&gt;/);
  const records = out.details.loops.records.map((r) => ({ ...r, recordUrl: 'javascript:alert(1)', loop: '<img>' }));
  const runs = campaignRunsHtml(records, 'demo');
  assert.doesNotMatch(runs, /javascript:|<img>|<script>/);
  assert.match(runs, /&lt;script&gt;/);
  assert.match(campaignRunsHtml(out.details.loops.records, 'demo'), /href="https:\/\/github\.com\/pilifs\/in-the-loop\/blob\//);
  assert.match(campaignRunsHtml([], 'demo'), /No runs recorded/);
  const table = detailTable('loops', records);
  assert.doesNotMatch(table, /javascript:|<img>/);
});

test('the failed-calls chart: one model’s days, clean share ticks, and durations in words', () => {
  const { overview } = run();
  assert.match(toolChartHtml(overview, 1), /Share of tool calls that failed per day, Sonnet 5\.5/);
  assert.match(toolChartHtml(overview), /sed \(Bash\) \(2\)/, 'the table names the day’s largest source of failures');
  assert.deepEqual(shareTicks(0.063), [0, 0.02, 0.04, 0.06, 0.08]);
  assert.deepEqual(shareTicks(0.3), [0, 0.1, 0.2, 0.3, 0.4]);
  assert.deepEqual(shareTicks(0.009), [0, 0.002, 0.004, 0.006, 0.008, 0.01]);
  assert.deepEqual([span(50), span(2700), span(29997), span(7200), span(null)], ['50 s', '45 min', '8 h 20 min', '2 h', 'No data']);
  assert.deepEqual(stumbles({ byTool: [{ name: 'Monitor', calls: 107, errors: 26 }, { name: 'Bash', calls: 9, errors: 9 }, { name: 'Read', calls: 1000, errors: 4 }], byFamily: [{ family: 'sleep', calls: 117, errors: 42 }] }).map((s) => s.label), ['sleep', 'Monitor']);
});

// --- The floor: every run on one clock ---------------------------------------

const H = 3600e3;
const at = (hours) => new Date(Date.parse('2026-11-07T04:00:00Z') + hours * H).toISOString().replace('.000', '');
const floorRun = (loop, campaign, from, to, o = {}) => ({
  id: `${loop}-${from}`, loop, campaign, started: at(from), ended: to === null ? null : at(to), seconds: to === null ? null : (to - from) * 3600,
  outcome: 'done', cycles: 2, commits: 3, toolCalls: 10, usd: 1, person: 0, ticks: [600, 1200], ...o,
});

test('runs group into stretches: a pause of more than six hours starts a new one', () => {
  const loops = {
    runs: [
      floorRun('a-x', 'a', 0, 2),
      floorRun('a-y', 'a', 1, 3),
      floorRun('a', 'a', 5, 6), // two hours after the last end: the same stretch
      floorRun('b', 'b', 12.5, 13, { person: 2 }), // six and a half hours after: a new one
      floorRun('b', 'b', 14, null, { outcome: 'open' }), // no end recorded: not on the clock
    ],
  };
  const list = stretches(loops);
  assert.equal(list.length, 2);
  const [first, second] = list;
  assert.equal(first.runs.length, 3);
  assert.equal((first.to - first.from) / H, 6);
  assert.equal(first.busy / H, 4, 'a loop was running from 0 to 3 and from 5 to 6: overlap counts once');
  assert.deepEqual([first.commits, first.campaigns, first.typed], [9, 1, 0]);
  assert.deepEqual([second.runs.length, second.commits, second.typed, second.busy / H], [1, 3, 2, 0.5]);
  assert.deepEqual(stretches({ runs: [] }), []);
});

test('the floor draws each stretch to one scale, with the pause between them cut out', () => {
  const html = floorHtml({
    panels: [{ from: 0, to: 30 * H, pause: '' }, { from: 100 * H, to: 109 * H, pause: 'No loop ran for 2 days 22 hours' }],
    rows: 2,
    runs: [
      { from: 0, to: 15 * H, row: 0, ticks: [5 * H, 30 * H], tip: 'one <b>', flag: false },
      { from: 100 * H, to: 100.01 * H, row: 1, ticks: [100.005 * H], tip: 'two', flag: true },
    ],
    names: [{ at: 0, until: 30 * H, label: 'first', href: '/software-factory/loops/#loop-first' }],
    nights: [{ from: 8 * H, to: 16 * H }],
    ticks: [
      { at: 0, label: 'Nov 6', kind: 'start' },
      { at: H, label: '6 pm', kind: 'hour' }, // 2.5% after the start: would run into its label
      { at: 10 * H, label: 'Nov 7', kind: 'day' },
      { at: 100 * H, label: 'Nov 14', kind: 'start' },
      { at: 108 * H, label: 'Nov 15', kind: 'day' },
    ],
  });
  // 39 hours share 97.5% of the width: 2.5% an hour, and 2.5% for the cut.
  assert.match(html, /<div class="sf-floor" style="--sf-rows:2">/);
  assert.match(html, /<span class="sf-run" style="left:0%;width:37\.5%;--sf-row:0" title="one &lt;b&gt;" data-tip="one &lt;b&gt;"><i style="left:33\.33%"><\/i><\/span>/, 'a notch only inside its run');
  assert.match(html, /<span class="sf-run sf-run-flag" style="left:77\.5%;width:0\.0\d%;--sf-row:1"[^>]*><\/span>/, 'a sliver has a marker and no notch');
  assert.match(html, /<span class="sf-floor-break" style="left:75%;width:2\.5%" title="No loop ran for 2 days 22 hours"/);
  assert.match(html, /<span class="sf-floor-night" style="left:20%;width:20%"><\/span>/);
  assert.match(html, /<li style="left:0%;width:74\.4%"><a href="\/software-factory\/loops\/#loop-first"><code>first<\/code><\/a><\/li>/);
  assert.match(html, /<span class="sf-floor-tick sf-floor-tick-start" style="left:0%">Nov 6<\/span>/);
  assert.doesNotMatch(html, /6 pm/);
  assert.match(html, /<span class="sf-floor-tick sf-floor-tick-day" style="left:25%">Nov 7<\/span>/);
  assert.match(html, /<span class="sf-floor-tick sf-floor-tick-start" style="left:77\.5%">Nov 14<\/span>/);
  assert.match(html, /<span class="sf-floor-tick sf-floor-tick-day sf-floor-tick-end" style="left:97\.5%">Nov 15<\/span>/, 'a label at the right edge ends at its mark');
  assert.match(html, /<div class="sf-floor-plot" aria-hidden="true">/, 'the plot is a picture; the names are links');
});

test('the loops finding claims a pace only from the data, and says who it asked', () => {
  const out = run();
  const snap = snapshotOf(out);
  const base = snap.overview.loops;
  const campaign = (id, streams) => ({ ...base.campaigns[0], id, streams });
  // Two campaigns, one after the other: three loops at once in the first, then one that ends blocked.
  const runs = [
    floorRun('demo-x', 'demo', 0, 4, { commits: 9 }),
    floorRun('demo-y', 'demo', 0, 3, { commits: 6 }),
    floorRun('demo', 'demo', 4, 5, { commits: 2 }),
    floorRun('later', 'later', 6, 10, { commits: 7, outcome: 'blocked' }),
    floorRun('later', 'later', 40, 41, { commits: 1 }),
  ];
  const loops = { ...base, runs, campaigns: [campaign('demo', 2), campaign('later', 0)], peakParallel: { runs: 2, at: at(0) } };
  const html = findingsHtml({ ...snap, overview: { ...snap.overview, loops } });
  // 24 commits in the ten hours of the first stretch: one every 25 minutes.
  assert.match(html, /<article class="sf-panel sf-finding sf-finding-wide" id="finding-loops"/);
  assert.match(html, />A commit every 25 minutes for 10 hours<\/a><\/h2>/);
  assert.match(html, /That is the average from Nov 6, 11 pm to Nov 7, 9 am, Toronto time: 24 commits from two campaigns, with a loop running for 9 of the 10 hours and up to two at once\. Nobody typed a prompt into any of them\./);
  // The merging loop takes the last row of its campaign; the next campaign starts again from the top.
  const row = (loop) => Number(html.match(new RegExp(`--sf-row:(\\d)" title="${loop}, `))[1]);
  assert.deepEqual([row('demo-x'), row('demo-y'), row('demo'), row('later')], [0, 1, 2, 0]);
  assert.match(html, /style="--sf-rows:3"/);
  assert.equal((html.match(/class="sf-run sf-run-flag"/g) ?? []).length, 1);
  assert.match(html, /Ended blocked on a person, or flagged for one/);
  assert.match(html, /title="later, from Nov 7, 5 am: 2 cycles and 7 commits in 4 h\. Blocked on a person\."/);
  // 10 pm to 6 am is shaded: the first stretch starts at 11 pm, inside a night.
  assert.match(html, /<span class="sf-floor-night" style="left:0%;width:[\d.]+%">/);
  assert.match(html, /title="No loop ran for 30 hours"/);
  assert.match(html, /Every loop run, Nov 6 to Nov 8, 2026, on one clock\./);
  assert.match(html, /The clock skips the 30 hours when no loop ran\./);
  // A person's prompt in the stretch is never passed over.
  const typed = findingsHtml({ ...snap, overview: { ...snap.overview, loops: { ...loops, runs: runs.map((r, i) => (i ? r : { ...r, person: 1 })) } } });
  assert.doesNotMatch(typed, /Nobody typed/);
});
