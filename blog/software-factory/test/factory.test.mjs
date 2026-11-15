// The feature loops, the tools and the code: how their records are read
// (records.mjs), counted (factory.mjs through metrics.mjs's aggregate) and
// drawn (assets/software-factory/factory.js). Run: npm run test:software-factory

import assert from 'node:assert/strict';
import test from 'node:test';
import { detailTable } from '../../assets/software-factory/details.js';
import { campaignRunsHtml, changePlotHtml, codeHtml, catalogFacets, exampleRecordHtml, examplesHtml, findingsHtml, usageDays, usageFacts, usageHtml, heroHtml, loopsHtml, matchWords, runRecordHtml, runningHtml, span, stretches, stumbles, toolChartHtml, toolDays, toolsHtml, verdictOf, verdictsOf, accountClock } from '../../assets/software-factory/factory.js';
import { floorHtml } from '../../assets/software-factory/figures.js';
import { formatValue } from '../../assets/software-factory/format.js';
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
  assert.deepEqual([...findingsHtml(snap).matchAll(/<article class="sf-panel sf-finding[^>]* id="([\w-]+)"/g)].map((m) => m[1]), ['finding-usage'], 'and the overview claims only what the snapshot has: its usage');
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
  assert.equal((findings.match(/<article class="sf-panel sf-finding[ "]/g) ?? []).length, 4);
  // One run and one commit are no pace to claim: the loops finding counts them instead.
  assert.match(findings, /<h2 id="finding-loops-title"><a href="\/software-factory\/loops\/">One campaign, 1 run, 1 cycle, no prompt from a person<\/a><\/h2>/);
  assert.match(findings, /<dt>of all tool calls were set off by a loop’s own prompt<\/dt><dd>50%<\/dd>/);
  assert.match(findings, /<dt>the longest run nobody typed into<\/dt><dd>2 h<\/dd>/);
  assert.match(findings, /<a href="\/software-factory\/tools\/">16\.7% of 6 tool calls succeeded<\/a>/);
  assert.match(findings, /Of the 4 that failed, 1 was a command that ran and exited non-zero/);
  assert.match(findings, /<a href="\/software-factory\/code\/">100 lines of code, about 10 output tokens each<\/a>/);
  // The loops finding carries every run on one clock; the other two a chart.
  assert.equal((findings.match(/<div class="sf-floor"/g) ?? []).length, 1);
  assert.match(findings, /<li style="left:0%;width:[\d.]+%"><a href="\/software-factory\/loops\/#loop-demo"><code>demo<\/code><\/a><\/li>/);
  assert.match(findings, /data-tip="demo-heap, from Nov 6, 11 pm: 1 cycle and 1 commit in 2 h\. Done\."/);
  assert.equal((findings.match(/<svg class="sf-chart sf-chart-wide"/g) ?? []).length + (findings.match(/<div class="sf-rates"/g) ?? []).length, 3, 'one chart each');
  assert.equal((findings.match(/<ul class="sf-legend[ "]/g) ?? []).length, 4, 'each figure has its legend');
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
      { at: H, label: '6 pm', kind: 'hour' }, // 2.5% after the start: would run into its label on any page
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
  // A label that would run off the right edge ends at its mark. On a narrower page it would run into the start before it, so it is marked to be hidden there.
  assert.match(html, /<span class="sf-floor-tick sf-floor-tick-day sf-floor-tick-end sf-floor-tick-wide sf-floor-tick-roomy" style="left:97\.5%">Nov 15<\/span>/);
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
  assert.match(html, /Every run that left a record, Nov 6 to Nov 8, 2026, on one clock\./);
  assert.match(html, /The clock skips the 30 hours when no loop ran\./);
  // A person's prompt in the stretch is never passed over.
  const typed = findingsHtml({ ...snap, overview: { ...snap.overview, loops: { ...loops, runs: runs.map((r, i) => (i ? r : { ...r, person: 1 })) } } });
  assert.doesNotMatch(typed, /Nobody typed/);
});

test('a run on the floor can be linked to and picked, and its record is the run’s own', () => {
  const out = run();
  const snap = snapshotOf(out);
  const [record] = out.details.loops.records;
  // The floor names each run, on the overview and on the loops page; the place for its record waits for the script.
  for (const html of [findingsHtml(snap), loopsHtml(snap)]) {
    assert.match(html, new RegExp(`<span class="sf-run" id="run-${record.id}" data-run="${record.id}" style=`));
    assert.match(html, /<div class="sf-inspect" data-sf-inspect="run" hidden>/);
    assert.match(html, /<p class="sf-inspect-at" data-sf-inspect-at role="status">Pick a run on the clock to read its record, cycle by cycle\.<\/p>/);
    assert.match(html, /<button type="button" data-sf-step="-1" hidden>Earlier run<\/button><button type="button" data-sf-step="1">Show the first run<\/button><button type="button" data-sf-step="0" hidden>Close<\/button>/);
  }
  const html = runRecordHtml(record, { models: snap.overview.models });
  assert.match(html, /<code>feature loop: demo-heap<\/code>/);
  assert.match(html, /started Nov 6, 2026, 11 pm · Opus 5\.5 \(<code>claude-opus-5-5<\/code>\), high effort/, 'a model by its name, with the raw id beside it');
  assert.match(html, /<span class="sf-ledger-time">\+0:30<\/span><span class="sf-ledger-cycle">cycle 1<\/span><span class="sf-ledger-text">First &lt;script&gt;x&lt;\/script&gt;/, 'a summary is data: escaped');
  assert.match(html, /<strong>1 cycle<\/strong> · 1 commit · 6 tool calls · <strong>2 h<\/strong> · \$[\d.]+ estimated usage/);
  assert.match(html, /0 prompts from a person, start to end · Done/);
  assert.match(html, /<a href="https:\/\/github\.com\/pilifs\/in-the-loop\/blob\/[^"]+">Run record<\/a>/);
  // An id with no documented name is shown as it is; only https links are followed; nothing is invented for what is missing.
  const bare = runRecordHtml({ ...record, model: 'claude-x', recordUrl: 'javascript:alert(1)', summaryUrl: null, cycles: [], usd: null, codeAdded: null, prompts: null, outcome: 'blocked' }, { models: snap.overview.models });
  assert.match(bare, /· <code>claude-x<\/code>, high effort/);
  assert.doesNotMatch(bare, /javascript:|<a /);
  assert.match(bare, /No cycle committed\./);
  assert.match(bare, /<strong>0 cycles<\/strong> · 1 commit · 6 tool calls · <strong>2 h<\/strong><br>Blocked on a person/);
  assert.match(runRecordHtml({ ...record, cycles: [{ ...record.cycles[0], decision: 'stop' }] }), /<span class="sf-ledger-stop">decided to stop<\/span>/);
});

// --- The catalog: what the factory made --------------------------------------

const catalogExample = (id, o = {}) => ({
  id, title: `Title ${id}`, origin: 'constructed', system: 'Quorum', verdict: 'violation', verdictLabel: '✗ Violation: counterexample found', vacuous: false,
  freshness: 'current', tags: { domain: ['consensus'], defect: ['stale-messages'], technique: [] },
  path: `examples/${id}-slug`, summary: 'Every unit test passes. The prover finds `vote(a, b)` & more.', sourceUrl: null, testsPassed: true, severity: 'critical', changeKind: 'refactor', ...o,
});

test('the output finding claims what the catalog says of its own violations, and falls back to counts', () => {
  const snap = snapshotOf(run());
  const records = [
    catalogExample('001'),
    catalogExample('002', { testsPassed: false, severity: 'low' }),
    catalogExample('003', { verdict: 'verified', verdictLabel: '✓ Verified', severity: 'none' }),
    catalogExample('004', { origin: 'real-world', system: 'A <b>Library</b>', verdict: null, verdictLabel: '✗ the bug found; ✓ confined', testsPassed: null, sourceUrl: 'https://example.invalid/pull/4' }),
    catalogExample('005', { origin: 'real-world', verdict: null, verdictLabel: 'not run: a catalog entry', testsPassed: null, path: null }),
  ];
  const stocks = { ...snap.overview.stocks, examples: { total: 5, origin: { constructed: 3, 'real-world': 2 }, verdict: { violation: 2, verified: 1, several: 1, none: 1 }, vacuous: 0, freshness: { current: 5 } } };
  const catalog = { coverage: { included: 3, total: 5, missing: 2 }, tests: { violation: { passed: 1, failed: 1 }, verified: { passed: 1 } }, severity: { violation: { critical: 1, low: 1 }, verified: { none: 1 }, several: { critical: 1 }, none: { critical: 1 } } };
  const sha = snap.manifest.source.sha;
  const output = (overview, examples = records) => {
    const html = findingsHtml({ ...snap, overview: { ...snap.overview, ...overview } }, { examples });
    return html.slice(html.indexOf('id="finding-output"'), html.indexOf('id="finding-tools"'));
  };
  const html = output({ stocks, catalog });
  // The claim is the project's own page's sentence, and the verdicts are in its words.
  assert.match(html, />1 of 2 refuted example changes had passed their unit tests<\/a><\/h2>/);
  assert.match(html, /formal verifier: 2 changes refuted and 1 established, in a catalog of 5 examples\. 4 have a verdict so far; the other one is prepared or catalogued, and not proved yet\. Most were constructed for the catalog, with the systems and the tests they change\. An established label is not a claim of a current, non-vacuous proof\./);
  assert.match(html, /<dt>refuted changes the catalog rates high or critical if they shipped unnoticed<\/dt><dd>1 of 2<\/dd>/);
  assert.match(html, /<ul class="sf-legend"><li><span class="sf-swatch sf-verdict-violation" aria-hidden="true"><\/span>Refuted: 2<\/li><li><span class="sf-swatch sf-verdict-verified" aria-hidden="true"><\/span>Established: 1<\/li><li><span class="sf-swatch sf-verdict-several" aria-hidden="true"><\/span>More than one verdict: 1<\/li><li><span class="sf-swatch sf-verdict-none" aria-hidden="true"><\/span>Not proved yet: 1<\/li>/);
  assert.doesNotMatch(html, /Violation found|Unverifiable|verified label/);
  assert.match(html, /<dt>are changes to published libraries; 1 has a result so far<\/dt><dd>2<\/dd>/);
  // A square can be linked to and picked; a listed library change links its example at the snapshot's revision.
  assert.match(html, /<span class="sf-cell sf-verdict-violation" id="example-001" data-example="001" data-tip="001 · Quorum: Title 001\. Refuted: ✗ Violation: counterexample found"/);
  // An example the catalog gives no single verdict is read from its label's marks: split between them, or not proved yet.
  assert.match(html, /<span class="sf-cell sf-verdict-several sf-parts-violation-verified sf-cell-ring" id="example-004" data-example="004" data-tip="004 · A &lt;b&gt;Library&lt;\/b&gt;: Title 004\. Refuted and established: ✗ the bug found; ✓ confined"/);
  assert.match(html, /<span class="sf-cell sf-verdict-none sf-cell-ring" id="example-005" data-example="005" data-tip="005 · Quorum: Title 005\. Not proved yet: not run: a catalog entry"/);
  assert.match(html, /<div class="sf-inspect" data-sf-inspect="example" hidden>/);
  assert.match(html, /<button type="button" data-sf-step="1">Show the first example<\/button>/);
  assert.ok(html.includes(`<li><strong>A &lt;b&gt;Library&lt;/b&gt;</strong> <a href="https://github.com/pilifs/in-the-loop/tree/${sha}/examples/004-slug">Title 004</a> <span class="sf-catalog-verdict">✗ the bug found; ✓ confined</span></li>`));
  assert.equal((html.match(/<li><strong>/g) ?? []).length, 1, 'the one that was not run is not listed');
  // No answers counted (an older snapshot), or none that passed: the claim counts verdicts and says no more.
  for (const older of [output({ stocks }), output({ stocks, catalog: { ...catalog, tests: { violation: { failed: 2 } } } })]) {
    assert.match(older, />2 changes refuted and 1 established, in a catalog of 5 examples<\/a><\/h2>/);
    assert.doesNotMatch(older, /had passed their unit tests/);
  }
  assert.doesNotMatch(output({ stocks }), /rates high or critical|Most were constructed/);
  // Without the records nothing can be picked.
  assert.doesNotMatch(output({ stocks, catalog }, null), /data-sf-inspect="example"|data-example/);
});

test('an example’s record is the catalog’s own words, escaped, with links only where there is somewhere to go', () => {
  const sha = 'a'.repeat(40);
  const html = exampleRecordHtml(catalogExample('013', { title: 'A "longest log" <rule>', vacuous: true }), { sha });
  assert.match(html, /<p class="sf-example-kicker"><code>013<\/code> Quorum · Constructed for the catalog<\/p>/);
  assert.match(html, /<h3>A &quot;longest log&quot; &lt;rule&gt;<\/h3>/);
  assert.match(html, /<span class="sf-swatch sf-verdict-violation" aria-hidden="true"><\/span><span><strong>Refuted<\/strong> <span class="sf-example-label">✗ Violation: counterexample found<\/span> <span class="sf-tag">Vacuous<\/span><\/span><\/p>/);
  assert.match(html, /<p class="sf-example-summary">Every unit test passes\. The prover finds <code>vote\(a, b\)<\/code> &amp; more\.<\/p>/, 'the catalog’s backticks are code');
  assert.match(html, /<dt>Existing tests on the same patch<\/dt><dd>Passed<\/dd>/);
  assert.match(html, /<dt>Severity if it shipped unnoticed<\/dt><dd>Critical<\/dd>/);
  assert.match(html, /<dt>Kind of change<\/dt><dd>Refactor<\/dd>/);
  assert.match(html, /<span class="sf-tag">stale-messages<\/span> <span class="sf-tag">consensus<\/span>/);
  assert.ok(html.includes(`<a href="https://github.com/pilifs/in-the-loop/tree/${sha}/examples/013-slug">The example, with its evidence</a>`));
  assert.doesNotMatch(html, /The change it verifies/);
  const library = exampleRecordHtml(catalogExample('105', { origin: 'real-world', verdict: null, verdictLabel: '✗ the <bug> found; ✓ confined; ⚠ one left', testsPassed: false, sourceUrl: 'https://example.invalid/pull/1', changeKind: 'bug-fix' }), { sha });
  assert.match(library, /· A change to a published library<\/p>/);
  assert.match(library, /<span class="sf-swatch sf-verdict-several sf-parts-violation-verified-unverifiable" aria-hidden="true"><\/span><span><strong>Refuted, established and left open<\/strong> <span class="sf-example-label">✗ the &lt;bug&gt; found; ✓ confined; ⚠ one left<\/span><\/span>/);
  // One kind of mark is that verdict; no mark is an example not proved yet; a label that only names the verdict is not repeated.
  assert.match(exampleRecordHtml(catalogExample('108', { verdict: null, verdictLabel: '⚠ unverifiable: solver budget' }), { sha }), /sf-swatch sf-verdict-unverifiable" aria-hidden="true"><\/span><span><strong>Left open<\/strong> <span class="sf-example-label">⚠ unverifiable: solver budget<\/span>/);
  assert.match(exampleRecordHtml(catalogExample('288', { verdict: null, verdictLabel: 'not run: a catalog entry' }), { sha }), /sf-swatch sf-verdict-none" aria-hidden="true"><\/span><span><strong>Not proved yet<\/strong> <span class="sf-example-label">not run: a catalog entry<\/span>/);
  assert.match(exampleRecordHtml(catalogExample('003', { verdict: 'verified', verdictLabel: '✓ Verified' }), { sha }), /<strong>Established<\/strong><\/span><\/p>/);
  assert.match(library, /<dd>Failed<\/dd>/);
  assert.match(library, /<dd>Bug fix<\/dd>/);
  assert.match(library, /<a href="https:\/\/example\.invalid\/pull\/1">The change it verifies<\/a>/);
  // A record from before these were carried, and a link that isn't https: nothing is made up, nothing is followed.
  const bare = exampleRecordHtml({ id: '1', title: 'T', origin: 'constructed', system: null, verdict: 'verified', verdictLabel: null, vacuous: null, freshness: null, tags: { domain: [], defect: [], technique: [] }, sourceUrl: 'javascript:alert(1)' }, { sha });
  assert.match(bare, /<strong>Established<\/strong><\/span><\/p>/);
  assert.doesNotMatch(bare, /<dl|<a |sf-example-summary|sf-example-tags|javascript:/);
});

// --- The catalog's own page ---------------------------------------------------

const pageExamples = () => [
  catalogExample('001'),
  catalogExample('002', { testsPassed: false, severity: 'low', changeKind: 'bug-fix', system: 'Box <Office>', tags: { domain: [], defect: ['rounding', 'stale-messages'], technique: [] } }),
  catalogExample('003', { verdict: 'verified', verdictLabel: '✓ Verified', severity: 'none', changeKind: 'feature', tags: { domain: [], defect: [], technique: [] } }),
  catalogExample('004', { origin: 'real-world', system: 'A Library', verdict: null, verdictLabel: '✗ the bug found; ✓ confined', testsPassed: null, severity: 'high', changeKind: 'bug-fix' }),
  catalogExample('005', { origin: 'real-world', system: 'B Library', verdict: null, verdictLabel: 'not run: a catalog entry', testsPassed: null, severity: null, changeKind: null, tags: { domain: [], defect: [], technique: [] } }),
];
const pageSnapshot = (overview = {}) => {
  const snap = snapshotOf(run());
  const stocks = { ...snap.overview.stocks, examples: { total: 5, origin: { constructed: 3, 'real-world': 2 }, verdict: { violation: 2, verified: 1, several: 1, none: 1 }, vacuous: 0, freshness: { current: 5 } } };
  const catalog = { coverage: { included: 3, total: 5, missing: 2, note: 'examples whose entry says whether the existing tests passed' }, tests: { violation: { passed: 1, failed: 1 }, verified: { passed: 1 } }, severity: { violation: { critical: 1, low: 1 }, verified: { none: 1 }, several: { high: 1 } } };
  return { ...snap, overview: { ...snap.overview, stocks, catalog, ...overview } };
};

test('the catalog is cut by verdict, tests, severity, kind, system and defect, each value with a token and its counts', () => {
  const facets = catalogFacets(pageExamples());
  assert.deepEqual(facets.map((f) => f.key), ['verdict', 'tests', 'severity', 'kind', 'system', 'defect']);
  const of = (key) => facets.find((f) => f.key === key).values.map((v) => [v.token, v.label, v.n, v.violation, v.passed, v.said]);
  // In the legend's order, in the project's own page's words; a library change with two kinds of mark in its label has more than one verdict.
  assert.deepEqual(of('verdict'), [
    ['verdict:violation', 'Refuted', 2, 2, 1, 2],
    ['verdict:verified', 'Established', 1, 0, 0, 0],
    ['verdict:several', 'More than one verdict', 1, 0, 0, 0],
    ['verdict:none', 'Not proved yet', 1, 0, 0, 0],
  ]);
  assert.deepEqual([verdictsOf(pageExamples()[3]), verdictOf(pageExamples()[3]), verdictsOf(pageExamples()[4]), verdictOf(pageExamples()[4])], [['violation', 'verified'], 'several', [], 'none']);
  // One kind of mark, however often, is that verdict; a verdict the catalog gives is taken as given.
  assert.equal(verdictOf({ verdict: null, verdictLabel: '✗ one; ✗ two' }), 'violation');
  assert.equal(verdictOf({ verdict: 'verified', verdictLabel: '✗ odd' }), 'verified');
  // Only the examples that say: the two library changes are in neither.
  assert.deepEqual(of('tests'), [['tests:passed', 'Passed', 2, 1, 1, 1], ['tests:failed', 'Failed', 1, 1, 0, 1]]);
  // Worst first, whatever the counts; kinds and systems by count, then by name.
  assert.deepEqual(of('severity').map((v) => v.slice(0, 3)), [['severity:0', 'Critical', 1], ['severity:1', 'High', 1], ['severity:2', 'Low', 1], ['severity:3', 'None', 1]]);
  assert.deepEqual(of('kind').map((v) => v.slice(0, 4)), [['kind:0', 'Bug fix', 2, 1], ['kind:1', 'Feature', 1, 0], ['kind:2', 'Refactor', 1, 1]]);
  assert.deepEqual(facets.find((f) => f.key === 'system').values.map((v) => [v.value, v.n, v.group]), [['Quorum', 2, 'constructed'], ['A Library', 1, 'library'], ['B Library', 1, 'library'], ['Box <Office>', 1, 'constructed']]);
  // An example counts under each of its tags.
  assert.deepEqual(of('defect').map((v) => v.slice(0, 3)), [['defect:0', 'stale-messages', 3], ['defect:1', 'rounding', 1]]);
  // A catalog from before a field was carried has no cut by it.
  assert.deepEqual(catalogFacets(pageExamples().map(({ severity, changeKind, testsPassed, ...x }) => x)).map((f) => f.key), ['verdict', 'system', 'defect']);
});

test('what the lit squares say: how many, their verdicts, and what the tests did on the violations', () => {
  const v = (...more) => ['verdict:violation', ...more];
  assert.equal(matchWords([v(), ['verdict:verified']], 2), 'Showing all 2 examples.');
  assert.equal(matchWords([], 183), 'None of the 183 examples matches.');
  assert.equal(
    matchWords([v('tests:passed', 'severe'), v('tests:passed'), v('tests:failed', 'severe'), ['verdict:verified', 'tests:passed'], ['verdict:unverifiable'], ['verdict:several'], ['verdict:none', 'severe']], 183),
    '7 of 183 examples: 3 refuted, 1 established, 1 left open, 1 with more than one verdict, 1 not proved yet. The existing tests passed on 2 of the 3 refuted changes; 2 are rated high or critical.'
  );
  assert.equal(matchWords([v('tests:failed', 'severe'), v('tests:failed')], 9), '2 of 9 examples: 2 refuted. The existing tests failed on all 2 refuted changes; 1 is rated high or critical.');
  assert.equal(matchWords([v('tests:passed'), v('tests:passed'), v()], 9), '3 of 9 examples: 3 refuted. The existing tests passed on all 2 refuted changes that say.');
  assert.equal(matchWords([v('tests:passed')], 9), '1 of 9 examples: 1 refuted. The existing tests passed on the one refuted change.');
  // Nothing about tests where nothing is refuted, or none that says.
  assert.equal(matchWords([['verdict:verified', 'tests:failed']], 9), '1 of 9 examples: 1 established.');
  assert.equal(matchWords([v('severe')], 9), '1 of 9 examples: 1 refuted.');
});

test('the catalog’s page: the claim, a grid that can be narrowed and picked, and the catalog cut four ways', () => {
  const snap = pageSnapshot();
  const html = examplesHtml(snap, pageExamples());
  assert.match(html, /<h1 id="sf-examples-title">1 of 2 refuted example changes had passed their unit tests<\/h1>/);
  assert.match(html, /2 changes refuted and 1 established, in a catalog of 5 examples\. 4 have a verdict so far; the other one is prepared or catalogued, and not proved yet\. Most were constructed for the catalog, with the systems and the tests they change, so this describes the catalog and not how often tests miss a defect elsewhere\. An established label is not a claim of a current, non-vacuous proof\./);
  assert.match(html, /<dt>Examples<\/dt><dd><span class="sf-figure-value">5<\/span><span class="sf-figure-note">4 with a verdict so far, 3 constructed for the catalog<\/span>/);
  assert.match(html, /<dt>Refuted<\/dt><dd><span class="sf-figure-value">2<\/span>/);
  assert.match(html, /<dt>Established<\/dt><dd><span class="sf-figure-value">1<\/span>/);
  assert.match(html, /<dt>Unit tests passed on a refuted change<\/dt><dd><span class="sf-figure-value">1 of 2<\/span>/);
  assert.doesNotMatch(html, /Violations? found|No violations|a violation|violations[ .,;<]|Unverifiable<|[Vv]erified label|Several verdicts/, 'the page’s older words for a verdict are gone; a label of the catalog’s is quoted as written');
  assert.match(html, /<dt>Changes to published libraries<\/dt><dd><span class="sf-figure-value">2<\/span><span class="sf-figure-note">1 with a result so far<\/span>/);
  assert.match(html, /Coverage: 3 of 5 examples whose entry says whether the existing tests passed · /);
  // The lists that narrow the grid wait for the script; each value says how many it has.
  assert.match(html, /<form class="sf-filters sf-facets" data-sf-facets hidden aria-label="Narrow the examples">/);
  assert.deepEqual([...html.matchAll(/<select name="(\w+)" data-sf-facet><option value="">(\w+)<\/option>/g)].map((m) => [m[1], m[2]]), [['verdict', 'Any'], ['tests', 'Either'], ['severity', 'Any'], ['kind', 'Any'], ['system', 'Any'], ['defect', 'Any']]);
  assert.match(html, /<option value="kind:0">Bug fix \(2\)<\/option>/);
  assert.match(html, /<optgroup label="Constructed for the catalog"><option value="system:0">Quorum \(2\)<\/option><option value="system:3">Box &lt;Office&gt; \(1\)<\/option><\/optgroup><optgroup label="Published libraries"><option value="origin:library">All of them \(2\)<\/option><option value="system:1">A Library \(1\)<\/option>/);
  assert.match(html, /<p class="sf-facet-status" data-sf-facet-status role="status" hidden>Showing all 5 examples\.<\/p>/);
  // A square carries its tokens: one for each value it has, and whether it is a library change and severe.
  const cell = (id) => html.match(new RegExp(`<span class="sf-cell [^>]*id="example-${id}"[^>]*>`))[0];
  assert.match(cell('001'), /data-f="verdict:violation tests:passed severity:0 kind:2 system:0 defect:0 severe"/);
  assert.match(cell('002'), /data-f="verdict:violation tests:failed severity:2 kind:0 system:3 defect:1 defect:0"/);
  assert.match(cell('004'), /class="sf-cell sf-verdict-several sf-parts-violation-verified sf-cell-ring"[^>]*data-f="verdict:several severity:1 kind:0 system:1 defect:0 origin:library severe"/);
  assert.match(cell('005'), /data-f="verdict:none system:2 origin:library"/);
  // Places to start, each a set of tokens, and only those that have something.
  assert.match(html, /<span class="sf-starts" data-sf-starts hidden>Start with <a href="#every-example" data-sf-show="verdict:violation tests:failed">the 1 refuted change the existing tests also caught<\/a>, <a href="#every-example" data-sf-show="verdict:violation severity:0">the 1 refuted change rated critical<\/a>, or <a href="#every-example" data-sf-show="origin:library">the 2 changes to published libraries<\/a>\.<\/span>/);
  assert.match(html, /<div class="sf-inspect" data-sf-inspect="example" hidden>/);
  // Every title, for a reader who can't use the picture: a link picks the example.
  assert.equal((html.match(/<li data-for="/g) ?? []).length, 5);
  assert.match(html, /<li data-for="002"><span class="sf-swatch sf-verdict-violation" aria-hidden="true"><\/span><a href="#example-002"><code>002<\/code> Title 002<\/a> <span class="sf-muted">Box &lt;Office&gt;<\/span><\/li>/);
  // The tables: a row's name narrows the grid, its bar is its examples by verdict.
  const table = (id) => html.slice(html.indexOf(`id="${id}"`), html.indexOf('</section>', html.indexOf(`id="${id}"`)));
  assert.match(table('examples-by-kind'), /The largest group is bug fix: 1 of its 2 examples is refuted, and the existing tests passed on 0 of them\./);
  assert.match(
    table('examples-by-kind'),
    /<tr><th scope="row"><a href="#every-example" data-sf-show="kind:0">Bug fix<\/a><\/th><td>2<span class="sf-split-box" aria-hidden="true"><span class="sf-split" style="width:100\.0%"><span class="sf-verdict-violation" style="flex:1"><\/span><span class="sf-verdict-several" style="flex:1"><\/span><\/span><\/span><\/td><td>1<\/td><td>0 of 1<\/td><\/tr>/
  );
  assert.match(table('examples-by-kind'), /data-sf-show="kind:1">Feature<\/a><\/th><td>1<span[\s\S]*?<\/td><td>0<\/td><td><span class="sf-muted">None refuted<\/span><\/td>/);
  // The libraries are one row, by where they come from.
  assert.match(table('examples-by-system'), /Two systems were written for the catalog\. The 2 published libraries are open-source code the catalog did not write\.<\/p>/);
  assert.deepEqual([...table('examples-by-system').matchAll(/data-sf-show="([^"]+)">([^<]+)</g)].map((m) => [m[1], m[2]]), [['system:0', 'Quorum'], ['system:3', 'Box &lt;Office&gt;'], ['origin:library', 'Published libraries']]);
  assert.match(table('examples-by-system'), /Published libraries<\/a><\/th><td>2<span[\s\S]*?<\/td><td>0<\/td>/);
  assert.match(table('examples-by-defect'), /An example can have several, and 2 have none\./);
  assert.match(table('examples-by-severity'), /data-sf-show="severity:0">Critical</);
  assert.match(html, /<h2>What this can't say<\/h2>\s*<p>Whether the existing tests passed, and how severe a change would be, are the catalog’s own statements[^<]*One of the 2 changes to published libraries is entered in the catalog and not run yet\./);
  assert.match(html, /<a href="\/software-factory\/usage\/#explore-examples">Examples, under Usage<\/a>/);
});

test('the catalog’s page without its records, or without a catalog: what the overview counts, and no more', () => {
  const snap = pageSnapshot();
  for (const records of [null, pageExamples().slice(1)]) {
    const html = examplesHtml(snap, records);
    assert.match(html, /<h1 id="sf-examples-title">1 of 2 refuted example changes had passed their unit tests/);
    assert.equal((html.match(/<span class="sf-cell /g) ?? []).length, 5, 'a square for each example the overview counts');
    assert.match(html, /The catalog’s records aren’t at hand, so none is named and nothing is cut further\./);
    assert.doesNotMatch(html, /data-sf-facets|data-example|data-sf-inspect|sf-breakdown|data-sf-show/);
  }
  // A snapshot from before the answers were counted leads with the verdicts and makes no claim about tests.
  const older = examplesHtml(pageSnapshot({ catalog: undefined }), pageExamples().map(({ severity, changeKind, testsPassed, ...x }) => x));
  assert.match(older, /<h1 id="sf-examples-title">2 changes refuted and 1 established, in a catalog of 5 examples<\/h1>/);
  assert.match(older, /Coverage: 4 of 5 examples with a verdict · /);
  assert.doesNotMatch(older, /existing tests|unit tests|examples-by-kind|examples-by-severity|rated critical/);
  assert.match(older, /id="examples-by-system"/);
  const none = pageSnapshot();
  none.overview.stocks = { ...none.overview.stocks, examples: { total: 0, origin: {}, verdict: {}, vacuous: 0, freshness: {} } };
  assert.match(examplesHtml(none, []), /<p class="sf-eyebrow">Example catalog<\/p><div class="sf-empty" role="status"><p>This snapshot has no example catalog/);
});

// --- The model performance finding ------------------------------------------------

test('rates by bucket are columns on one scale, each with its value and its parts', async () => {
  const { ratesHtml } = await import('../../assets/software-factory/figures.js');
  const html = ratesHtml(
    [
      { title: 'By <time>', bars: [{ label: '<1 h', value: '2.0%', rate: 0.02, parts: [3, 0, 1], tip: 'Under 1 hour: "4" of 200' }, { label: '1 h+', value: '1.0%', rate: 0.01, parts: [0, 2, 0] }] },
      { title: 'By size', bars: [{ label: '<50', value: '4.0%', rate: 0.04, parts: [1, 1, 2] }] },
    ],
    { series: [{ key: 'exit', label: 'Exit' }, { key: 'rejected', label: 'Refused' }, { key: 'other', label: 'Other' }], label: 'Share that "failed"' }
  );
  assert.match(html, /^<div class="sf-rates" role="img" aria-label="Share that &quot;failed&quot;">/);
  assert.deepEqual([...html.matchAll(/<div class="sf-rates-group" style="flex:(\d)"><p class="sf-rates-title">([^<]+)</g)].map((m) => [m[1], m[2]]), [['2', 'By &lt;time&gt;'], ['1', 'By size']]);
  // One scale across the groups: the tallest column is the whole height, the others in proportion.
  assert.deepEqual([...html.matchAll(/class="sf-rate-bar" style="height:([\d.]+)%"/g)].map((m) => m[1]), ['50', '25', '100']);
  // A part with nothing in it draws nothing; the rest are in the series' order, by count.
  assert.match(html, /<div class="sf-rate" data-tip="Under 1 hour: &quot;4&quot; of 200"><div class="sf-rate-column"><span class="sf-rate-value">2\.0%<\/span><span class="sf-rate-bar" style="height:50%"><span class="sf-series-exit" style="flex:3"><\/span><span class="sf-series-other" style="flex:1"><\/span><\/span><\/div><span class="sf-rate-label">&lt;1 h<\/span><\/div>/);
  assert.match(html, /<div class="sf-rate"><div class="sf-rate-column"><span class="sf-rate-value">1\.0%<\/span><span class="sf-rate-bar" style="height:25%"><span class="sf-series-rejected" style="flex:2"><\/span><\/span>/);
});

test('the model performance finding claims a short streak only against many calls, and says where failures happened', () => {
  const snap = snapshotOf(run());
  const row = (from, to, calls, errors) => ({ from, to, calls, errors, exit: errors, rejected: 0, denied: 0, other: 0 });
  const tools = {
    ...snap.overview.tools,
    totals: { calls: 5000, errors: 60, exit: 40, rejected: 15, denied: 0, other: 5, ok: 4940, noResult: 0 },
    recovery: { failures: 60, nextOk: 55, nextFailed: 5, noNext: 0, streaks: [[1, 50], [2, 2], [3, 2]] },
    byRunHour: [row(0, 1, 2000, 30), row(1, 2, 1000, 12), row(2, 4, 0, 0), row(4, null, 500, 3)],
    byContext: [row(0, 50000, 1000, 20), row(50000, 100000, 3000, 30), row(100000, null, 1000, 10)],
  };
  const loops = { ...snap.overview.loops, runs: [{ ...snap.overview.loops.runs[0], seconds: 5 * 3600 }, { ...snap.overview.loops.runs[0], id: 'short', seconds: 3600 }] };
  const finding = (over) => {
    const html = findingsHtml({ ...snap, overview: { ...snap.overview, tools: { ...tools, ...over.tools }, loops: over.loops ?? loops } });
    return html.slice(html.indexOf('id="finding-tools"'), html.indexOf('id="finding-code"'));
  };
  const html = finding({});
  assert.match(html, /<a href="\/software-factory\/tools\/">5,000 tool calls, never more than 3 failures in a row<\/a>/);
  assert.match(html, /Of the 60 that failed, 40 were commands that ran and exited non-zero[^<]*55 of the 60 were followed by a call that succeeded\./);
  assert.match(html, /<dt>of tool calls succeeded<\/dt><dd>98\.8%<\/dd>/);
  assert.match(html, /<dt>streaks of failures were a single call<\/dt><dd>50 of 54<\/dd>/);
  // A bucket with no calls has no column; the two cuts share one figure.
  assert.deepEqual([...html.matchAll(/<span class="sf-rate-label">([^<]+)</g)].map((m) => m[1]), ['&lt;1 h', '1–2 h', '4 h+', '&lt;50', '50–100', '100+']);
  assert.match(html, /aria-label="Share of tool calls that failed\. By time into a loop run: under 1 h, 1\.5%; 1–2 h, 1\.2%; 4 h\+, 0\.6%\. By context size, in thousands of tokens: under 50, 2\.0%; 50–100, 1\.0%; 100\+, 1\.0%\. The model performance page has these as tables\."/);
  assert.match(html, /data-tip="4 hours and over into a run: 3 of 500 tool calls failed \(0\.6%\)"/);
  assert.match(html, /data-tip="50K to 100K tokens of context: 30 of 3,000 tool calls failed \(1\.0%\)"/);
  assert.match(html, /Late in a run or deep in a context it was no higher than at the start: 0\.6% from 4 hours into a run against 1\.5% in the first hour, and 1\.0% at 100K tokens of context and over against 2\.0% under 50K\. This says where failures happened and is not an experiment: the calls 4 hours in come from 1 run\./);
  // Where the share did rise, the caption only gives the two ends.
  const rose = finding({ tools: { byContext: [row(0, 50000, 1000, 10), row(50000, null, 1000, 30)] } });
  assert.match(rose, /by how\. At the ends: 0\.6% from 4 hours into a run against 1\.5% in the first hour, and 3\.0% at 50K tokens of context and over against 1\.0% under 50K\./);
  assert.doesNotMatch(rose, /no higher/);
  // A long streak, or a streak in a handful of calls, is no claim: the finding leads with the share that succeeded.
  for (const over of [{ tools: { recovery: { ...tools.recovery, streaks: [[1, 40], [6, 1]] } } }, { tools: { totals: { ...tools.totals, calls: 2999 } } }, { tools: { recovery: null } }])
    assert.match(finding(over), /<a href="\/software-factory\/tools\/">\d+\.\d% of [\d,]+ tool calls succeeded<\/a>/);
  // A snapshot from before the cuts were counted keeps the chart of days.
  const older = finding({ tools: { byRunHour: undefined, byContext: [row(0, null, 5000, 60)] } });
  assert.match(older, /<svg class="sf-chart sf-chart-wide"/);
  assert.match(older, /Share of each day’s tool calls that failed, by how\./);
  assert.doesNotMatch(older, /sf-rates/);
});

// --- What it took: the usage finding -------------------------------------------

test('usage per day is cut by model: the largest get a hue each, in order, and the rest are drawn together', () => {
  const overview = {
    days: ['2026-11-01', '2026-11-02', '2026-11-03'],
    models: [{ id: 'm-a', label: 'A' }, { id: 'm-b', label: 'B' }, { id: 'm-c', label: 'C' }, { id: 'm-d', label: 'D' }, { id: 'm-e', label: 'E' }],
    usage: {
      columns: ['day', 'model', 'effort', 'calls', 'pricedCalls', 'usd'],
      // Model B has the most in all, then D, A, and C and E the least; E has calls that cost nothing on day 2.
      rows: [[0, 0, 0, 1, 1, 3], [0, 1, 0, 1, 1, 10], [0, 1, 1, 1, 1, 5], [2, 3, 0, 1, 1, 8], [2, 2, 0, 1, 1, 1], [2, 4, 0, 1, 1, 0.5], [1, 4, 0, 2, 2, 0]],
    },
  };
  const { series, points } = usageDays(overview);
  assert.deepEqual(series.map((s) => [s.key, s.label, s.id, s.usd]), [['model-0', 'B', 'm-b', 15], ['model-1', 'D', 'm-d', 8], ['model-2', 'A', 'm-a', 3], ['model-rest', 'Two other models', null, 1.5]]);
  assert.deepEqual(points.map((p) => p.up), [[15, 0, 3, 0], null, [0, 8, 0, 1.5]], 'both efforts of a model on a day are one part; a day with nothing priced has no column');
  assert.equal(points[0].tip, 'Nov 1, 2026: $18.00 of estimated usage (B $15.00, A $3.00)');
  assert.equal(points[1].tip, 'Nov 2, 2026: no model usage');
  // One model left over is named, not called "other".
  const four = usageDays({ ...overview, usage: { ...overview.usage, rows: overview.usage.rows.filter((r) => r[1] !== 4) } });
  assert.deepEqual(four.series.at(-1), { key: 'model-rest', label: 'C', id: 'm-c', usd: 1 });
  assert.equal(four.points[2].tip, 'Nov 3, 2026: $9.00 of estimated usage (D $8.00, C $1.00)');
});

test('the usage finding says what every session took, as an estimate, and names its models with their ids', () => {
  const snap = snapshotOf(run());
  const html = findingsHtml(snap);
  const usage = html.slice(html.indexOf('id="finding-usage"'));
  assert.match(usage, /<a href="\/software-factory\/usage\/">Every session on record, for an estimated \$\d+\.\d\d of model usage<\/a>/);
  assert.match(usage, /That is \d+ model calls, Nov \d+ to Nov \d+, 2026, priced from the [\d,]+ input tokens they read and the output they wrote, at list prices\. It is an estimate, not a bill, and it counts no person’s time and no machine that ran a proof\. <a href="\/software-factory\/methodology\/#def-usage_usd">Definition<\/a>/);
  assert.match(usage, /<dt>of input tokens were read from cache<\/dt><dd>\d+\.\d%<\/dd>/);
  assert.match(usage, /<dt>of it was [^<]+ \(claude-[a-z0-9-]+\)<\/dt><dd>\d+\.\d%<\/dd>/);
  assert.match(usage, /<dt>of it was inside feature loop runs<\/dt><dd>\$\d+\.\d\d<\/dd>/);
  assert.match(usage, /<li><span class="sf-swatch sf-series-model-0" aria-hidden="true"><\/span>[^<]+ <code>claude-[a-z0-9-]+<\/code><\/li>/);
  assert.match(usage, /<svg class="sf-chart sf-chart-wide"[^>]*role="img"/);
  assert.match(usage, /<text class="sf-tick"[^>]*>\$\d/, 'the axis is in dollars');
  assert.match(usage, /Where usage went says nothing about which model is better: the models did different work\./);
  // Without loop runs the third number is the calls; with nothing priced there is no finding.
  const { loops, ...rest } = snap.overview;
  assert.match(findingsHtml({ ...snap, overview: rest }), /<dt>model calls<\/dt><dd>\d+<\/dd>/);
  const free = { ...snap, overview: { ...snap.overview, measures: snap.overview.measures.map((m) => (m.id === 'usage_usd' ? { ...m, value: 0 } : m)) } };
  assert.doesNotMatch(findingsHtml(free), /finding-usage/);
});

// --- The usage page's head: what was read against what was written ---------------

const usageOverview = (o = {}) => ({
  pricingAsOf: '2026-10-31',
  days: ['2026-11-01', '2026-11-02'],
  models: [{ id: 'm-a', label: 'A' }, { id: 'm-b', label: 'B <b>' }],
  efforts: ['high'],
  usage: {
    columns: ['day', 'model', 'effort', 'calls', 'pricedCalls', 'usd', 'inputTokens', 'cacheReadTokens', 'cacheWriteTokens', 'outputTokens', 'thinkingTokens', 'uncachedUsd'],
    // Model A on two days, model B on one: B has the larger usage.
    rows: [[0, 0, 0, 3, 3, 2, 10, 900, 90, 20, 5, 12], [1, 0, 0, 1, 1, 1, 0, 400, 100, 5, 0, 3], [1, 1, 0, 1, 1, 6, 0, 480, 20, 25, 10, 25]],
  },
  reported: { coverage: { included: 2, total: 3, missing: 1, note: 'sessions that had stopped' }, usd: 12, callsUsd: 8, unattributedUsd: 4.5 },
  ...o,
});
const withoutColumns = (overview, ...names) => {
  const keep = overview.usage.columns.map((c, i) => (names.includes(c) ? -1 : i)).filter((i) => i !== -1);
  return { ...overview, usage: { columns: keep.map((i) => overview.usage.columns[i]), rows: overview.usage.rows.map((r) => keep.map((i) => r[i])) } };
};

test('usage facts add up what was read and written, by model, and keep the other figures apart', () => {
  const u = usageFacts(usageOverview());
  assert.deepEqual(
    [u.calls, u.priced, u.usd, u.fresh, u.cacheRead, u.cacheWrite, u.read, u.written, u.thinking, u.uncached],
    [5, 5, 9, 10, 1780, 210, 2000, 50, 15, 40]
  );
  assert.deepEqual(u.byModel.map((m) => [m.label, m.id, m.usd, m.read, m.written, m.uncached]), [['B <b>', 'm-b', 6, 500, 25, 25], ['A', 'm-a', 3, 1500, 25, 15]], 'largest usage first');
  assert.equal(u.reported.usd, 12);
  assert.equal(u.usd, 9, 'neither figure is added to the estimate');
  // A row with no value for a figure leaves the whole figure unknown: part of a sum is not the sum.
  const holed = usageOverview();
  holed.usage.rows[1][11] = null;
  holed.usage.rows[2][10] = null;
  const h = usageFacts(holed);
  assert.deepEqual([h.uncached, h.thinking, h.byModel[0].uncached, h.byModel[1].uncached, h.byModel[0].thinking, h.byModel[1].thinking], [null, null, 25, null, null, 5]);
  // A row with nothing priced has no price either way, and takes nothing from the sum.
  const unpriced = usageOverview();
  unpriced.usage.rows.push([1, 1, 0, 2, 0, 0, 0, 0, 0, 0, 0, null]);
  assert.equal(usageFacts(unpriced).uncached, 40);
  // A snapshot from before the columns, and one with no calls.
  const older = usageFacts(withoutColumns(usageOverview({ reported: undefined }), 'thinkingTokens', 'uncachedUsd'));
  assert.deepEqual([older.uncached, older.thinking, older.reported, older.read], [null, null, null, 2000]);
  assert.equal(usageFacts(usageOverview({ usage: { columns: usageOverview().usage.columns, rows: [] } })), null);
});

test('the usage page leads with what was read to write what was written, each on one scale', () => {
  const html = usageHtml({ overview: usageOverview() });
  assert.match(html, /<h1 id="sf-usage-title">2,000 tokens read to write 50<\/h1>/);
  assert.ok(
    html.includes(
      'Every model call reads its whole context again, so 5 calls took in 40 tokens for each one written. 89.0% of what was read came from cache. At list prices as of Oct 31, 2026 that is an estimated $9.00; the same calls with nothing cached would be priced at $40.00. It is an estimate, not a bill. <a href="/software-factory/methodology/#def-usage_usd">Definition</a>'
    )
  );
  const tiles = [...html.matchAll(/<div class="sf-figure"><dt>([^<]+)<\/dt><dd><span class="sf-figure-value">([^<]+)<\/span><span class="sf-figure-note">([^<]+)<\/span>/g)].map((m) => m.slice(1));
  assert.deepEqual(tiles, [
    ['Read per call', '400', 'input tokens, on average'],
    ['Written per call', '10', 'output tokens; 30.0% of all output is counted as thinking'],
    ['Read from cache', '89.0%', '1,780 tokens'],
    ['Never cached', '10', 'input tokens neither read from cache nor written to it'],
  ]);
  assert.match(html, /Coverage: 5 of 5 model calls priced/);

  // Two groups, each on its own scale: a bar's width is its share of the group's largest.
  const groups = [...html.matchAll(/<div class="sf-scale"><p class="sf-scale-title">([^<]+)<\/p>([\s\S]*?)<\/div>(?=<div class="sf-scale">|<\/div>)/g)].map((m) => [
    m[1],
    [...m[2].matchAll(/<span>([^<]+)<\/span> <strong>([^<]+)<\/strong><\/p><span class="sf-scale-track"><span class="sf-scale-bar" style="width:([\d.]+)%">(.*?)<\/span><\/span>/g)].map((r) => [
      r[1],
      r[2],
      Number(r[3]),
      [...r[4].matchAll(/class="sf-series-([a-z-]+)" style="flex:(\d+)"/g)].map((p) => [p[1], Number(p[2])]),
    ]),
  ]);
  assert.deepEqual(groups, [
    [
      'Tokens',
      [
        ['Read', '2,000 tokens', 100, [['cache-read', 1780], ['cache-write', 210], ['fresh', 10]]],
        ['Written', '50 tokens', 2.5, [['written', 50]]],
      ],
    ],
    [
      'List price as of Oct 31, 2026',
      [
        ['With nothing cached: a hypothetical', '$40.00', 100, [['hypothetical', 40]]],
        ['As recorded: estimated usage', '$9.00', 22.5, [['estimate', 9]]],
        ['Claude Code’s own count, 2 of 3 sessions', '$12.00', 30, [['client', 12]]],
      ],
    ],
  ]);
  assert.match(html, /<div class="sf-scales" role="img" aria-label="2,000 tokens read against 50 written, and list price: With nothing cached: a hypothetical \$40\.00; As recorded: estimated usage \$9\.00; Claude Code’s own count, 2 of 3 sessions \$12\.00\."/);
  assert.match(html, /data-tip="Read: 2,000 input tokens\. 1,780 from cache, 210 written to cache, 10 neither"/);
  assert.match(html, /10 input tokens were never cached: too few to draw\./);
  // The legend names the parts of the tokens' bars; the price bars are named on their rows.
  assert.match(html, /<li><span class="sf-swatch sf-series-cache-read" aria-hidden="true"><\/span>Read from cache<\/li>/);

  // The client's own count, said as the higher figure only when it is.
  assert.match(html, /<h2>The estimate runs low<\/h2>\s*<p>Claude Code writes its own count when a session stops\. For the 2 of 3 sessions that have one it is \$12\.00; the calls in those sessions’ logs come to \$8\.00\. The source says why: its logs leave out compactions and side calls\. Only the estimate can be split/);
  const under = usageHtml({ overview: usageOverview({ reported: { coverage: { included: 3, total: 3, missing: 0 }, usd: 7, callsUsd: 9, unattributedUsd: null } }) });
  assert.match(under, /<h2>The client’s own count<\/h2>\s*<p>Claude Code writes its own count when a session stops\. For the 3 of 3 sessions that have one it is \$7\.00; the calls in those sessions’ logs come to \$9\.00\. Only the estimate/);
  assert.doesNotMatch(under, /runs low|The source says why/);

  // By model, largest usage first, names and ids escaped.
  const rows = [...html.matchAll(/<tr><th scope="row">(.*?)<\/th>(.*?)<\/tr>/g)].map((m) => [m[1], [...m[2].matchAll(/<td>(.*?)<\/td>/g)].map((c) => c[1])]);
  assert.deepEqual(rows, [
    ['B &lt;b&gt; <code class="sf-muted">m-b</code>', ['1', '500', '25', '20', '96.0%', '$6.00', '$25.00']],
    ['A <code class="sf-muted">m-a</code>', ['4', '1,500', '25', '60', '86.7%', '$3.00', '$15.00']],
  ]);
});

test('the usage page shows no figure the snapshot doesn’t have', () => {
  // Before generator 6: the tokens, and the estimate alone, with no group of prices to compare.
  const older = usageHtml({ overview: withoutColumns(usageOverview({ reported: undefined }), 'thinkingTokens', 'uncachedUsd') });
  assert.match(older, /<h1 id="sf-usage-title">2,000 tokens read to write 50<\/h1>/);
  assert.match(older, /that is an estimated \$9\.00\. It is an estimate, not a bill\./);
  assert.doesNotMatch(older, /nothing cached|hypothetical|Claude Code|sf-note|List price|thinking/);
  assert.equal(older.match(/class="sf-scale"/g).length, 1);
  assert.match(older, /<span class="sf-figure-note">output tokens, on average<\/span>/);
  // The client's count without the hypothetical is still a second bar beside the estimate.
  const counted = usageHtml({ overview: withoutColumns(usageOverview(), 'uncachedUsd') });
  assert.equal(counted.match(/class="sf-scale"/g).length, 2);
  assert.doesNotMatch(counted, /nothing cached|hypothetical/);
  // Large numbers are said in words, and no calls at all is said plainly.
  const big = usageOverview();
  big.usage.rows = [[0, 0, 0, 100, 100, 50, 1000, 3_500_000_000, 79_000_000, 23_300_000, 9_000_000, 400]];
  assert.match(usageHtml({ overview: big }), /<h1 id="sf-usage-title">3\.58 billion tokens read to write 23\.3 million<\/h1>/);
  const none = usageHtml({ overview: usageOverview({ usage: { columns: usageOverview().usage.columns, rows: [] } }) });
  assert.match(none, /This snapshot has no model calls/);
  assert.doesNotMatch(none, /<h1/);
});

test('the usage finding says the estimate runs low where the client counted more, and what the cache did to the price', () => {
  const snap = snapshotOf(run());
  const { usage, measures } = snap.overview;
  const [iUsd, iUncached] = [usage.columns.indexOf('usd'), usage.columns.indexOf('uncachedUsd')];
  const estimate = measures.find((m) => m.id === 'usage_usd').value;
  const overview = {
    ...snap.overview,
    usage: { ...usage, rows: usage.rows.map((r) => r.map((v, i) => (i === iUncached ? r[iUsd] * 8 : v))) },
    reported: { coverage: { included: 3, total: 4, missing: 1 }, usd: estimate + 10, callsUsd: estimate - 1, unattributedUsd: null },
  };
  const of = (o) => {
    const html = findingsHtml({ ...snap, overview: o });
    return html.slice(html.indexOf('id="finding-usage"'));
  };
  const finding = of(overview);
  assert.ok(finding.includes(`It is an estimate, not a bill, and it runs low: Claude Code’s own count is ${formatValue(estimate + 10, 'usd')} for 3 of the 4 sessions. Neither counts a person’s time or a machine that ran a proof. <a href=`));
  assert.ok(finding.includes(`<dt>of input tokens were read from cache; without it the same calls come to ${formatValue(estimate * 8, 'usd')}</dt>`));
  assert.match(finding, /What was read against what was written, and usage by day, model and effort/);
  // A client count that is not higher is not said to be, and a hypothetical that is not higher is not shown as a saving.
  const even = of({ ...overview, reported: { ...overview.reported, usd: estimate - 2 }, usage: { ...usage, rows: usage.rows.map((r) => r.map((v, i) => (i === iUncached ? r[iUsd] : v))) } });
  assert.match(even, /It is an estimate, not a bill, and it counts no person’s time and no machine that ran a proof\./);
  assert.match(even, /<dt>of input tokens were read from cache<\/dt>/);
});

test('a label shortly before a stretch that starts near the right edge gives way to that stretch’s own', () => {
  // 100 hours, a cut, then 4 hours: the last stretch's label would run off the right edge, so it ends at its mark.
  const html = floorHtml({
    panels: [{ from: 0, to: 100 * H, pause: '' }, { from: 200 * H, to: 204 * H, pause: 'No loop ran for 4 days' }],
    rows: 1,
    runs: [{ from: 0, to: H, row: 0, ticks: [], tip: 'one', flag: false }],
    names: [],
    nights: [],
    ticks: [
      { at: 0, label: 'Nov 6', kind: 'start' },
      { at: 50 * H, label: 'Nov 8', kind: 'day' },
      { at: 80 * H, label: 'noon', kind: 'hour' }, // well before the last start: kept on a wide page
      { at: 96 * H, label: 'Nov 15', kind: 'day' }, // shortly before it: would sit under its label
      { at: 200 * H, label: 'Nov 15', kind: 'start' },
    ],
  });
  const labels = [...html.matchAll(/<span class="sf-floor-tick sf-floor-tick-(\w+)( sf-floor-tick-end)?[^"]*" style="left:[\d.]+%">([^<]+)<\/span>/g)].map((m) => [m[1], Boolean(m[2]), m[3]]);
  assert.deepEqual(labels, [['start', false, 'Nov 6'], ['day', false, 'Nov 8'], ['hour', false, 'noon'], ['start', true, 'Nov 15']]);
});

test('the clock’s labels are placed for a wide page, a narrow one and a phone: starts first, and none runs into another', () => {
  // Eight stretches of uneven length, as a clock of every loop has: several start within a label's width of the one before.
  const starts = [0, 20, 60, 70, 74, 80, 130, 146];
  const ends = [18, 58, 68, 72, 78, 128, 144, 150];
  const html = floorHtml({
    panels: starts.map((from, i) => ({ from: from * H, to: ends[i] * H, pause: i ? 'No loop ran' : '' })),
    rows: 1,
    runs: [{ from: 0, to: H, row: 0, ticks: [], tip: 'one', flag: false, quiet: true }],
    names: [
      { at: 0, until: 18 * H, label: 'roomy', href: '/x' },
      { at: 70 * H, until: 72 * H, label: 'squeezed', href: '/x' },
    ],
    nights: [],
    ticks: [...starts.map((from, i) => ({ at: from * H, label: `S${i}`, kind: 'start' })), { at: 30 * H, label: 'D1', kind: 'day' }, { at: 100 * H, label: 'D2', kind: 'day' }, { at: 106 * H, label: 'h', kind: 'hour' }],
  });
  const ticks = [...html.matchAll(/<span class="sf-floor-tick ([^"]*)" style="left:([\d.]+)%">([^<]+)<\/span>/g)].map((m) => ({ label: m[3], at: Number(m[2]), classes: m[1].split(' ') }));
  const shown = (hidden) => ticks.filter((t) => !hidden.some((c) => t.classes.includes(c))).map((t) => t.label);
  // 136 hours share 82.5% of the width, with seven cuts of 2.5%. A label takes 5.5% on a wide page.
  // S4 starts 3.7% after S3 and S7's label, ending at its mark, would run into S6's: both are left out.
  // The hour is 3.6% after a day, inside its label.
  assert.deepEqual(ticks.map((t) => t.label), ['S0', 'S1', 'S2', 'S3', 'S5', 'S6', 'D1', 'D2']);
  // Narrow, 11% a label: S3 is 7.4% after S2, and D1 is 6.1% after S1.
  assert.deepEqual(shown(['sf-floor-tick-wide', 'sf-floor-tick-hour']), ['S0', 'S1', 'S2', 'S5', 'S6', 'D2']);
  // A phone, 17% a label, days hidden: the first start and the last one left are placed first, then what fits between.
  assert.deepEqual(shown(['sf-floor-tick-wide', 'sf-floor-tick-roomy', 'sf-floor-tick-hour', 'sf-floor-tick-day']), ['S0', 'S2', 'S6']);
  // A label that only runs off the edge on a phone is flipped there, not on a wider page.
  assert.deepEqual(ticks.find((t) => t.label === 'S6').classes.filter((c) => c.includes('end')), ['sf-floor-tick-end-phone']);
  // A name with too little room to say anything is left to the bar's own words; a quiet run is marked.
  assert.match(html, /<code>roomy<\/code>/);
  assert.doesNotMatch(html, /squeezed/);
  assert.match(html, /<span class="sf-run sf-run-quiet" style=/);
});

test('a model the snapshot has no display name for is named by its id, once', () => {
  const overview = usageOverview({ models: [{ id: 'm-a', label: 'A' }, { id: 'claude-new-9', label: 'claude-new-9' }] });
  const html = usageHtml({ overview });
  assert.match(html, /<th scope="row"><code class="sf-muted">claude-new-9<\/code><\/th>/);
  assert.match(html, /<th scope="row">A <code class="sf-muted">m-a<\/code><\/th>/);
  assert.equal(html.match(/claude-new-9/g).length, 1);
});

// --- The source's own account of its loops ---------------------------------------

const accountOf = (o = {}) => {
  const stat = (x) => ({ runs: 1, cycles: 1, cyclesCommitted: 1, commits: 1, sessions: 1, calls: 5, toolCalls: 10, toolErrors: 0, outputTokens: 100, usd: 10, agentSeconds: 7200, busySeconds: 3600, modelSeconds: 1800, toolSeconds: 1800, compactions: 2, peakContextTokens: 900, jobs: 0, jobsPassed: 0, jobsFailed: 0, models: ['claude-opus-5-5'], first: '2026-11-01T15:00:00.000Z', last: '2026-11-02T15:00:00.000Z', medianCycleUsd: 2, medianCycleBusySeconds: 60, ...x });
  return {
    totals: { loops: 3, ...stat({ runs: 12, cycles: 30, cyclesCommitted: 25, commits: 40, usd: 100, busySeconds: 36000, compactions: 9, jobs: 8, jobsPassed: 6, jobsFailed: 2 }), runsFromRecords: 4, runsFromTranscripts: 3 },
    interjections: 0,
    byHand: { loops: 1, runs: 1, cycles: 3, commits: 3, toolCalls: 50 },
    categories: [
      { category: 'moonshot', loops: 1, ...stat({ cycles: 3, cyclesCommitted: 3, commits: 3, usd: 30 }) },
      { category: 'brief', loops: 1, ...stat({ runs: 6, cycles: 27, cyclesCommitted: 22, commits: 30, usd: 60, jobs: 8, jobsPassed: 6, jobsFailed: 2 }) },
      { category: 'verification', loops: 1, ...stat({ runs: 5, cycles: 0, cyclesCommitted: 0, commits: 7, usd: 10 }) },
    ],
    loops: [
      { loop: 'core <b>', category: 'brief', kind: 'brief stream', streamOf: 'core', ...stat({ runs: 6, cycles: 27, cyclesCommitted: 22, commits: 30, usd: 60, jobs: 8, jobsPassed: 6, jobsFailed: 2, first: '2026-11-05T15:00:00.000Z' }) },
      { loop: 'by-hand', category: 'moonshot', kind: 'moonshot by hand', streamOf: null, ...stat({ cycles: 3, cyclesCommitted: 3, commits: 3, usd: 30, models: ['claude-new-9'] }) },
      { loop: 'verification', category: 'verification', kind: 'verification loop', streamOf: null, ...stat({ runs: 5, cycles: 0, cyclesCommitted: 0, commits: 7, usd: 10, first: '2026-11-03T15:00:00.000Z' }) },
    ],
    ...o,
  };
};

test('with the source’s account, the headline is the commits made inside a loop run, of those recorded', () => {
  const snap = snapshotOf(run());
  const recorded = snap.overview.measures.find((m) => m.id === 'changes_recorded');
  const withAccount = (account, changes = 50) => ({ ...snap, overview: { ...snap.overview, loopAccount: account, measures: snap.overview.measures.map((m) => (m === recorded ? { ...m, value: changes } : m)) } });
  const hero = heroHtml(withAccount(accountOf()), { title: 'Software Factory', lede: 'x' });
  assert.match(hero, /<span class="sf-headline">40 of 50 commits were made inside a loop run<\/span>/);
  assert.match(hero, /That is 3 loops, 12 runs and 30 cycles in <a href="[^"]+">in-the-loop<\/a>, a project that formally verifies Java code, Nov 1 to Nov 2, 2026\./);
  assert.match(hero, /No run has a prompt that is not the loop’s own\. One early loop of 3 cycles was typed by hand, before the script existed\.<\/p>/);
  assert.match(hero, /class="sf-ledger"/, 'the longest run’s own record stays beside it');
  // Prompts typed into a run are said, and no loop by hand means no sentence about one.
  const typed = heroHtml(withAccount(accountOf({ interjections: 2, byHand: { loops: 0, runs: 0, cycles: 0, commits: 0, toolCalls: 0 } })), { title: 'T', lede: 'x' });
  assert.match(typed, /2 prompts in them were typed by a person\.<\/p>/);
  assert.doesNotMatch(typed, /typed by hand|not the loop’s own/);
  // Fewer changes recorded than the account's commits: no "of", which would be a share over 1.
  assert.match(heroHtml(withAccount(accountOf(), 30), { title: 'T', lede: 'x' }), /<span class="sf-headline">40 commits made inside a loop run<\/span>/);
  // Without an account the headline is the run records' own, as before.
  assert.match(heroHtml(snap, { title: 'T', lede: 'x' }), /tool calls and 1 commit without a prompt from a person/);

  // The finding keeps its claim and gives the account's totals and cost per commit.
  const finding = findingsHtml(withAccount(accountOf()));
  const loops = finding.slice(finding.indexOf('id="finding-loops"'), finding.indexOf('id="finding-output"'));
  assert.match(loops, /<dt>estimated usage for each commit made in a loop run<\/dt><dd>\$2\.50<\/dd>/);
  assert.match(loops, /All 3 loops, and each campaign run by run/);
});

// The account's runs, as overview.loopAccount.runs has them: a moonshot typed by hand before any record, two streams
// of one brief at work together (one left the fixture's run record), and a session of the verification loop beside them.
const accountRun = (id, loop, started, ended, o = {}) => ({ id, loop, campaign: loop, category: 'brief', kind: 'brief', source: 'transcript', started, ended, outcome: 'ended', cycles: 1, commits: 1, toolCalls: 10, usd: 1, interjections: 0, ticks: [], ...o });
const accountRuns = () => [
  accountRun('2026-11-01-150000-by-hand', 'by-hand', '2026-11-01T15:00:00.000Z', '2026-11-01T18:00:00.000Z', { category: 'moonshot', kind: 'moonshot by hand', outcome: 'unrecorded', cycles: 3, commits: 3, ticks: [3600, 7200, 10800] }),
  accountRun('2026-11-07-040000-demo-heap', 'demo-heap', '2026-11-07T04:00:00.000Z', '2026-11-07T06:00:00.000Z', { campaign: 'demo', kind: 'brief stream', source: 'record', cycles: 12, commits: 12, ticks: [1800] }),
  accountRun('2026-11-07-050000-demo-values', 'demo-values', '2026-11-07T05:00:00.000Z', '2026-11-07T08:00:00.000Z', { campaign: 'demo', kind: 'brief stream', cycles: 12, commits: 12 }),
  accountRun('2026-11-07-053000-verification', 'verification', '2026-11-07T05:30:00.000Z', '2026-11-07T06:30:00.000Z', { category: 'verification', kind: 'verification loop', source: 'session', cycles: 0, commits: 5 }),
];

test('with the account’s runs the clock has every run of every loop, and the pace is the loops’ that write code', () => {
  const snap = snapshotOf(run());
  const withRuns = { ...snap, overview: { ...snap.overview, loopAccount: accountOf({ runs: accountRuns() }) } };
  const clock = accountClock(withRuns.overview);
  // Only a run with a run record can be opened, and it has the record's outcome; the verification loop is quiet and first.
  assert.deepEqual(clock.runs.map((r) => [r.id, r.loop, r.outcome, r.quiet, r.seconds]), [
    [null, 'by-hand', 'unrecorded', false, 10800],
    ['2026-11-07-040000-demo-heap', 'demo-heap', 'done', false, 7200],
    [null, 'demo-values', 'ended', false, 10800],
    [null, 'verification', 'ended', true, 3600],
  ]);
  assert.deepEqual(clock.campaigns, [
    { id: 'verification', streams: 0, card: false, quiet: true },
    { id: 'by-hand', streams: 0, card: false, quiet: false },
    { id: 'demo', streams: 2, card: true, quiet: false },
  ]);
  assert.equal(clock.unrecorded, 3);
  assert.equal(accountClock(snap.overview), null);
  assert.equal(accountClock({ ...snap.overview, loopAccount: accountOf() }), null, 'an account from before its runs were carried');

  const all = findingsHtml(withRuns);
  const html = all.slice(all.indexOf('id="finding-loops"'), all.indexOf('id="finding-output"'));
  // 24 commits in the four hours two streams ran: the verification loop's five are said apart.
  assert.match(html, />A commit every 10 minutes for 4 hours<\/a><\/h2>/);
  assert.match(html, /Toronto time: 24 commits from 2 loops, with a loop running for 4 of the 4 hours and up to two at once\. The verification loop committed proof results 5 more times in those hours\. Nobody typed a prompt into any of them\. In all: 3 loops, 12 runs and 30 cycles\./);
  assert.match(html, /Every run of every loop, Nov 1 to Nov 7, 2026, on one clock\./);
  assert.match(html, /3 runs in the account left no record of their own to open: the verification sessions, and the runs from before the script wrote one\./);
  assert.match(html, /<li><span class="sf-swatch sf-swatch-quiet" aria-hidden="true"><\/span>A session of the verification loop: it runs the queued proofs and commits the results<\/li>/);
  // Four bars: one can be picked, one is quiet and in the first row, which no other loop is drawn in.
  const bars = [...html.matchAll(/<span class="(sf-run[^"]*)"( id="run-[^"]+" data-run="([^"]+)")? style="[^"]*--sf-row:(\d+)" title="([^"]*)"/g)].map((m) => [m[1], m[3] ?? null, Number(m[4]), m[5]]);
  assert.deepEqual(bars.map((b) => b.slice(0, 3)), [
    ['sf-run', null, 1],
    ['sf-run', '2026-11-07-040000-demo-heap', 1],
    ['sf-run', null, 2],
    ['sf-run sf-run-quiet', null, 0],
  ]);
  assert.match(bars[0][3], /^by-hand, from Nov 1, 10 am: 3 cycles and 3 commits in 3 h\. No end recorded\.$/);
  assert.match(bars[3][3], /^A session of the verification loop, from Nov 7, 12:30 am: 5 commits of results in 1 h\.$/);
  // A campaign with run records links to its card; any other loop to the list of every loop. The quiet row has no name.
  assert.deepEqual([...html.matchAll(/<a href="([^"]+)"><code>([^<]+)<\/code><\/a><\/li>/g)].map((m) => [m[2], m[1]]), [['by-hand', '/software-factory/loops/#every-loop'], ['demo', '/software-factory/loops/#loop-demo']]);

  // The loops page draws it under the account, whole, and the runs that left a record follow without a clock of their own.
  const page = loopsHtml(withRuns);
  inOrderOf(page, ['id="every-loop"', 'id="clock"', 'Every run on one clock', 'Every run of every loop, Nov 1 to Nov 7, 2026', 'The runs that left a record', 'Campaign by campaign']);
  assert.doesNotMatch(page, /Those runs on one clock/);
  assert.match(page, /The prompts and the campaigns below are read from those records/);
  assert.equal((page.match(/class="sf-floor"/g) ?? []).length, 1);
});

test('the loops page leads with the source’s account: by kind, then every loop, then the runs that left a record', () => {
  const snap = snapshotOf(run());
  const page = loopsHtml({ ...snap, overview: { ...snap.overview, loopAccount: accountOf(), models: [...snap.overview.models, { id: 'claude-new-9', label: 'claude-new-9' }] } });
  assert.match(page, /<h1 id="sf-loops-title">3 loops, 12 runs, 30 cycles, no prompt typed into a run<\/h1>/);
  const tiles = [...page.matchAll(/<div class="sf-figure"><dt>([^<]+)<\/dt><dd><span class="sf-figure-value">([^<]+)<\/span>(?:<span class="sf-figure-note">([^<]*)<\/span>)?/g)].map((m) => m.slice(1, 4));
  assert.deepEqual(tiles.slice(0, 6), [
    ['Runs', '12', 'of 3 loops'],
    ['Cycles', '30', '25 ended in a commit'],
    ['Commits', '40', 'made inside a loop run'],
    ['Verification jobs', '8', '6 passed, 2 failed'],
    ['Active time', '10.0 h', 'a model or a tool at work; 9 compactions'],
    ['Estimated usage', '$100.00', '$4.00 per committed cycle'],
  ]);
  const cells = (row) => [...row.matchAll(/<td>(.*?)<\/td>/g)].map((c) => c[1].replace(/<[^>]+>/g, ''));
  const kinds = page.slice(page.indexOf('id="loops-by-kind"'), page.indexOf('<details class="sf-detail sf-loop-list">'));
  const rows = [...kinds.matchAll(/<tr><th scope="row">(.*?)<\/th>(.*?)<\/tr>/g)].map((m) => [m[1].replace(/<[^>]+>/g, ''), cells(m[2])]);
  assert.deepEqual(rows, [
    ['Moonshots 1 loop: one open-ended instruction, given again every cycle', ['1', '3', '3', 'None', '1.0 h', '$30.00', '$10.00']],
    ['Briefs 1 loop: a written file of work the loop goes through', ['6', '27', '30', '8 (6 passed)', '1.0 h', '$60.00', '$2.73']],
    ['Verification loop 1 loop: a fresh session that runs the queued proofs', ['5', '0', '7', 'None', '1.0 h', '$10.00', 'No cycles']],
    ['All 3 loops', ['12', '30', '40', '8 (6 passed)', '10.0 h', '$100.00', '$4.00']],
  ]);
  // Every loop, oldest first, with its kind, the day it first ran and its model; names escaped, an unnamed model by its id.
  const list = page.slice(page.indexOf('<details class="sf-detail sf-loop-list">'), page.indexOf('The runs that left a record'));
  assert.match(list, /<summary>All 3 loops, oldest first<\/summary>/);
  assert.deepEqual(
    [...list.matchAll(/<tr><th scope="row"><code>(.*?)<\/code> <span class="sf-muted">(.*?)<\/span>/g)].map((m) => [m[1], m[2]]),
    [['by-hand', 'Moonshot, typed by hand, Nov 1, claude-new-9'], ['verification', 'Verification loop, Nov 3, Opus 5.5'], ['core &lt;b&gt;', 'Brief, one of its streams, Nov 5, Opus 5.5']]
  );
  assert.match(page, /Coverage: 12 runs: 4 from run records, 3 from the prompts of sessions that left no record, 5 verification sessions/);
  // Then what the run records give, said to be those runs only.
  inOrderOf(page, ['id="every-loop"', 'The runs that left a record', 'Those runs on one clock', 'Campaign by campaign']);
  assert.match(page, /1 run of 1 loop left one, in 1 campaign/);
  assert.doesNotMatch(page, /Every run on one clock/);
  // Without an account the page is the run records' own, as before.
  const before = loopsHtml(snap);
  assert.match(before, /Every run on one clock/);
  assert.doesNotMatch(before, /id="every-loop"|The runs that left a record/);
});

// --- What a verdict rests on -------------------------------------------------------

const proof = (o = {}) => ({ tests: null, counterexample: null, trace: null, seconds: null, checker: null, ...o });

test('an example’s record shows what its verdict rests on: the tests’ task, the counterexample or the trace, and what it took', () => {
  const sha = 'a'.repeat(40);
  const rows = (html) => [...html.matchAll(/<div><dt>(\w+)<\/dt><dd>([\s\S]*?)<\/dd><\/div>/g)].filter((m) => !/^[A-Z]/.test(m[1])).map((m) => [m[1], m[2]]);
  // An input: the task that passed, then the input, what was expected and what came back, all escaped.
  const input = exampleRecordHtml(
    catalogExample('013', { evidence: proof({ tests: { task: 'java -ea <Tests>', failed: [] }, counterexample: { input: 'grant(a=0, b="x")', expected: 'false', actual: '<true>', count: 1 }, seconds: 2.94, checker: 'JBMC 6.11.0' }) }),
    { sha }
  );
  assert.match(input, /<div class="sf-ledger sf-proof">\s*<div class="sf-ledger-bar">(<span aria-hidden="true"><\/span>){3}<code>example 013: result\.json<\/code><\/div>/);
  assert.deepEqual(rows(input), [
    ['tests', '<strong class="sf-proof-passed">passed</strong> java -ea &lt;Tests&gt;'],
    ['input', 'grant(a=0, b=&quot;x&quot;)'],
    ['expected', 'false'],
    ['got', '&lt;true&gt;'],
    ['verifier', 'JBMC 6.11.0 · 2.9 s'],
  ]);
  assert.doesNotMatch(input, /counterexamples the result records/);
  inOrderOf(input, ['sf-example-summary', 'sf-proof', 'sf-example-facts']);
  // Tests that failed are named; more counterexamples than the one shown are counted; a missing side is left out.
  const failed = exampleRecordHtml(
    catalogExample('001', { testsPassed: false, evidence: proof({ tests: { task: ':domain:test', failed: ['A.one', 'A.<two>'] }, counterexample: { input: 'decide(X)', expected: null, actual: 'Unchanged', count: 33 } }) }),
    { sha }
  );
  assert.deepEqual(rows(failed), [['tests', '<strong class="sf-proof-failed">failed</strong> :domain:test<span class="sf-proof-note">A.one<br>A.&lt;two&gt;</span>'], ['input', 'decide(X)'], ['got', 'Unchanged']]);
  assert.match(failed, /<p class="sf-ledger-total">The first of 33 counterexamples the result records\.<\/p>/);
  // A trace: what it breaks, its actions in order, and how far the checker looked.
  const trace = exampleRecordHtml(catalogExample('062', { evidence: proof({ tests: { task: 't', failed: [] }, trace: { invariant: 'Election<Safety>', steps: 3, actions: ['Init', 'Time<out>', 'Canvass'], states: 1401 }, seconds: 118.8 }) }), { sha });
  assert.deepEqual(rows(trace).slice(1), [
    ['breaks', 'Election&lt;Safety&gt;'],
    ['trace', 'Init <span aria-hidden="true">→</span> Time&lt;out&gt; <span aria-hidden="true">→</span> Canvass'],
    ['explored', '3 steps in the trace, 1,401 states explored'],
    ['verifier', '119 s'],
  ]);
  const bare = exampleRecordHtml(catalogExample('063', { evidence: proof({ trace: { invariant: null, steps: 1, actions: [], states: null } }) }), { sha });
  assert.deepEqual(rows(bare), [['trace', '1 step'], ['explored', '1 step in the trace']]);
  // A verified change has its tests and its time; a record with no evidence, or none of this in it, has no panel.
  const verified = exampleRecordHtml(catalogExample('003', { verdict: 'verified', evidence: proof({ tests: { task: 't', failed: [] }, seconds: 0 }) }), { sha });
  assert.deepEqual(rows(verified), [['tests', '<strong class="sf-proof-passed">passed</strong> t'], ['verifier', '0 s']]);
  for (const none of [catalogExample('004'), catalogExample('005', { evidence: null }), catalogExample('006', { evidence: proof() })]) assert.doesNotMatch(exampleRecordHtml(none, { sha }), /sf-proof/);
  // The catalog's answer is what is shown; the result's failures stand in only when the catalog has none.
  const unsaid = exampleRecordHtml(catalogExample('007', { testsPassed: null, evidence: proof({ tests: { task: 't', failed: ['A.one'] } }) }), { sha });
  assert.match(unsaid, /<strong class="sf-proof-failed">failed<\/strong> t/);
});

function inOrderOf(html, parts) {
  let at = -1;
  for (const part of parts) {
    const next = html.indexOf(part, at + 1);
    assert.ok(next > at, `${part} after the one before it`);
    at = next;
  }
}

test('the finding and the catalog’s page say what the violations come with, when the snapshot counts it', () => {
  const records = pageExamples().map((x) =>
    x.id === '001' ? { ...x, evidence: proof({ counterexample: { input: 'f()', expected: '1', actual: '2', count: 1 } }) } : x.id === '002' ? { ...x, evidence: proof({ trace: { invariant: 'Safe', steps: 2, actions: ['Init', 'Next'], states: 5 } }) } : x
  );
  const counted = (counterexamples) => pageSnapshot({ catalog: { ...pageSnapshot().overview.catalog, counterexamples, attempts: { timed: 1, medianSeconds: 2 } } });
  const all = counted({ violations: 2, input: 1, trace: 1 });
  const finding = findingsHtml(all, { examples: records });
  assert.match(finding, /<dt>refuted changes come with a counterexample: 1 an input, 1 a trace<\/dt><dd>2 of 2<\/dd>/);
  assert.doesNotMatch(finding, /verification jobs passed/);
  assert.match(finding, /Pick a square to read what the example changed and the counterexample the verifier found\./);
  const page = examplesHtml(all, records);
  assert.match(page, /<dt>Refuted<\/dt><dd><span class="sf-figure-value">2<\/span><span class="sf-figure-note">each with a counterexample: 1 an input, 1 a trace<\/span>/);
  // The grid can be narrowed by what the counterexample is, and a square carries it.
  assert.match(page, /<label>Counterexample <select name="shown" data-sf-facet><option value="">Any<\/option><option value="shown:0">An input \(1\)<\/option><option value="shown:1">A trace \(1\)<\/option><\/select><\/label>/);
  assert.match(page, /id="example-001"[^>]*data-f="[^"]*shown:0[^"]*"/);
  assert.match(page, /id="example-002"[^>]*data-f="[^"]*shown:1[^"]*"/);
  assert.doesNotMatch(page.match(/<span class="sf-cell [^>]*id="example-003"[^>]*>/)[0], /shown:/);
  // Not every violation has one: the count, not "each".
  assert.match(examplesHtml(counted({ violations: 2, input: 1, trace: 0 }), records), /<span class="sf-figure-note">1 with a counterexample: 1 an input, 0 a trace<\/span>/);
  // None counted, or a snapshot from before they were: the finding keeps its third number and neither says a word of it.
  for (const snap of [counted({ violations: 2, input: 0, trace: 0 }), pageSnapshot()]) {
    const html = `${findingsHtml(snap, { examples: pageExamples() })}${examplesHtml(snap, pageExamples())}`;
    assert.doesNotMatch(html, /with a counterexample|come with a counterexample|name="shown"/);
    assert.match(html, /Pick a square to read what the example changed and what the verifier found\./);
  }
});
