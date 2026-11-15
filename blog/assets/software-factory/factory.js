// The section's leading pieces as HTML strings from a snapshot: the overview's
// headline and its four findings, and the feature loops, tools and code pages
// they open. Drawn the same way by the build (render.mjs) and the browser
// (app.js, when a newer snapshot or a filter changes them). No DOM, no Node APIs.
//
// Each takes the snapshot ({ pointer, manifest, overview }) and returns the
// inside of its section. A snapshot made before these were measured has no
// overview.loops, .tools or .code: each section then says so, and shows no number.

import { catalogHtml, columnsSvg, floorHtml, lanesHtml, legendHtml, ratesHtml, scaleHtml, scatterSvg } from './figures.js';
import { escapeHtml as e, formatCoverage, formatDay, formatValue, VERDICTS } from './format.js';
import { clockWords, torontoClock, torontoDay } from './measures-local.js';

const REPO = 'https://github.com/pilifs/in-the-loop';
// Where the section is served: its pages link each other from here.
const ROUTE = '/software-factory/';
const count = (n) => Math.round(n).toLocaleString('en-US');
const plural = (n, one, many = `${one}s`) => `${count(n)} ${n === 1 ? one : many}`;
const pct = (r, digits = 1) => (r === null || r === undefined || !Number.isFinite(r) ? 'No data' : `${(r * 100).toFixed(digits)}%`);
const rate = (part, whole) => (whole ? part / whole : null);
const hours = (seconds) => `${(seconds / 3600).toFixed(1)} h`;
// A link from data is followed only when it is an https one.
const link = (url, text) => (typeof url === 'string' && /^https:\/\//.test(url) ? ` · <a href="${e(url)}">${e(text)}</a>` : '');
const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
const word = (n) => WORDS[n] ?? count(n);

/** '8 h 20 min', '45 min', '50 s'. */
export function span(seconds) {
  if (seconds === null || seconds === undefined) return 'No data';
  if (seconds < 90) return `${Math.round(seconds)} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return minutes % 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes / 60} h`;
}

/** Hours and minutes into a run: '+8:18'. */
const into = (seconds) => `+${Math.floor(seconds / 3600)}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}`;
const dayOf = (instant) => formatDay(torontoDay(instant), { year: false });
const dayYear = (instant) => formatDay(torontoDay(instant));
const range = (from, to) => (to && torontoDay(to) !== torontoDay(from) ? `${dayOf(from)} to ${dayYear(to)}` : dayYear(from));

export const OUTCOMES = {
  done: 'Done',
  waiting: 'Waiting on verification jobs',
  blocked: 'Blocked on a person',
  attention: 'Stopped for attention',
  ended: 'Ended',
  open: 'No end recorded',
  // The source's own words for a run it read from a session, not a run record.
  unrecorded: 'No end recorded',
  stopped: 'Stopped',
  interrupted: 'Interrupted',
};
export const KINDS = [
  { key: 'exit', label: 'Command exited non-zero' },
  { key: 'rejected', label: 'Refused by the harness' },
  { key: 'denied', label: 'Permission denied' },
  { key: 'other', label: 'Other error' },
];

const unavailable = (title, why) =>
  `<p class="sf-eyebrow">${e(title)}</p><div class="sf-empty" role="status"><p>${e(why)}</p><p>No numbers are shown rather than numbers that weren't measured.</p></div>`;

// A model by its display name with its raw id beside it. A model the snapshot
// has no display name for is labelled by its id, which is then said once.
const modelName = (m, attrs = '') => (m.id && m.label === m.id ? `<code${attrs}>${e(m.id)}</code>` : `${e(m.label)}${m.id ? ` <code${attrs}>${e(m.id)}</code>` : ''}`);

const tile = (label, value, note) =>
  `<div class="sf-figure"><dt>${e(label)}</dt><dd><span class="sf-figure-value">${e(value)}</span>${note ? `<span class="sf-figure-note">${note}</span>` : ''}</dd></div>`;

// --- The source's own account of its loops ---------------------------------------

// The kinds of loop the source tells apart, in its own words for each.
const LOOP_KINDS = {
  moonshot: { label: 'Moonshots', one: 'Moonshot', what: 'one open-ended instruction, given again every cycle' },
  brief: { label: 'Briefs', one: 'Brief', what: 'a written file of work the loop goes through' },
  verification: { label: 'Verification loop', one: 'Verification loop', what: 'a fresh session that runs the queued proofs' },
};
const KIND_WORDS = {
  moonshot: 'Moonshot',
  'templated moonshot': 'Moonshot over a list',
  'moonshot by hand': 'Moonshot, typed by hand',
  brief: 'Brief',
  'brief stream': 'Brief, one of its streams',
  'verification loop': 'Verification loop',
};

/**
 * What the source's account says in a sentence each: how many commits were
 * made inside a loop run, of how many recorded, and whether anyone typed into
 * a run. Null when the snapshot has no account.
 */
export function loopAccountFacts(overview) {
  const a = overview.loopAccount ?? null;
  if (!a || !a.totals.runs) return null;
  const t = a.totals;
  const recorded = overview.measures?.find((m) => m.id === 'changes_recorded')?.value ?? null;
  const counts = `${plural(t.loops, 'loop')}, ${plural(t.runs, 'run')} and ${plural(t.cycles, 'cycle')}`;
  // Nobody typed into a run when no prompt in one is other than the loop's own.
  // The loop a person ran by hand is told apart: its instructions were typed.
  const hand = a.byHand.runs ? `${a.byHand.loops === 1 ? 'One early loop' : `${word(a.byHand.loops)} early loops`} of ${plural(a.byHand.cycles, 'cycle')} was typed by hand, before the script existed.` : '';
  const typed = a.interjections ? `${plural(a.interjections, 'prompt')} in them ${a.interjections === 1 ? 'was' : 'were'} typed by a person.` : 'No run has a prompt that is not the loop’s own.';
  return {
    account: a,
    totals: t,
    recorded: recorded !== null && recorded >= t.commits ? recorded : null,
    counts,
    typed,
    hand,
    first: t.first,
    last: t.last,
  };
}

const accountRow = (name, r) =>
  `<tr><th scope="row">${name}</th><td>${count(r.runs)}</td><td>${count(r.cycles)}</td><td>${count(r.commits)}</td><td>${r.jobs ? `${count(r.jobs)} <span class="sf-muted">(${count(r.jobsPassed)} passed)</span>` : '<span class="sf-muted">None</span>'}</td><td>${e(
    hours(r.busySeconds)
  )}</td><td>${e(formatValue(r.usd, 'usd'))}</td><td>${r.cyclesCommitted ? e(formatValue(r.usd / r.cyclesCommitted, 'usd')) : '<span class="sf-muted">No cycles</span>'}</td></tr>`;

/** The account as tables: by kind of loop, then every loop, oldest first. */
function loopAccountTables(overview) {
  const f = loopAccountFacts(overview);
  if (!f) return '';
  const { account: a, totals: t } = f;
  const head = (first) =>
    `<thead><tr><th scope="col">${first}</th><th scope="col">Runs</th><th scope="col">Cycles</th><th scope="col">Commits</th><th scope="col">Verification jobs</th><th scope="col">Active</th><th scope="col">Estimated usage</th><th scope="col">Per committed cycle</th></tr></thead>`;
  const kinds = a.categories
    .map((c) => {
      const k = LOOP_KINDS[c.category];
      return accountRow(`${e(k?.label ?? c.category)} <span class="sf-muted">${plural(c.loops, 'loop')}${k ? `: ${e(k.what)}` : ''}</span>`, c);
    })
    .join('');
  const names = new Map(overview.models.map((m) => [m.id, m]));
  const each = [...a.loops]
    .sort((x, y) => (x.first ?? '').localeCompare(y.first ?? '') || x.loop.localeCompare(y.loop))
    .map((l) =>
      accountRow(
        `<code>${e(l.loop)}</code> <span class="sf-muted">${e(KIND_WORDS[l.kind] ?? l.kind)}${l.first ? `, ${e(dayOf(l.first))}` : ''}${l.models.length ? `, ${l.models.map((id) => e(names.get(id)?.label ?? id)).join(' and ')}` : ''}</span>`,
        l
      )
    )
    .join('');
  const sources = [
    t.runsFromRecords !== null ? `${count(t.runsFromRecords)} from run records` : null,
    t.runsFromTranscripts ? `${count(t.runsFromTranscripts)} from the prompts of sessions that left no record` : null,
    t.runsFromRecords !== null && t.runs - t.runsFromRecords - (t.runsFromTranscripts ?? 0) > 0 ? `${count(t.runs - t.runsFromRecords - (t.runsFromTranscripts ?? 0))} verification sessions` : null,
  ].filter(Boolean);
  return `<div class="sf-subhead" id="every-loop"><h2>By kind of loop</h2></div>
        <p class="sf-caption">The project’s own count of its loops at this revision. Active is the time a model call or a tool call was under way. A verification job is a proof a cycle queued; a job that failed is a result, not a failed cycle. <a href="${ROUTE}methodology/#def-loop_account">Definition</a></p>
        <div class="sf-breakdowns sf-tool-tables sf-loop-tables">
          <section class="sf-breakdown" id="loops-by-kind" aria-labelledby="loops-by-kind-title">
            <h3 class="sf-visually-hidden" id="loops-by-kind-title">By kind of loop</h3>
            <table class="sf-table">${head('Kind')}<tbody>${kinds}</tbody><tfoot>${accountRow(`All <span class="sf-muted">${plural(t.loops, 'loop')}</span>`, t)}</tfoot></table>
          </section>
        </div>
        <details class="sf-detail sf-loop-list">
          <summary>All ${plural(t.loops, 'loop')}, oldest first</summary>
          <div><table class="sf-table sf-numbers">${head('Loop')}<tbody>${each}</tbody></table></div>
        </details>
        ${sources.length ? `<p class="sf-coverage">Coverage: ${plural(t.runs, 'run')}: ${e(sources.join(', '))}</p>` : ''}`;
}

// --- Headline ---------------------------------------------------------------

/** The overview's opening: what the loops did, beside the longest run's own record. */
export function heroHtml(snapshot, { title, lede }) {
  const { loops } = snapshot.overview;
  if (!loops || !loops.totals.runs)
    return `<div class="sf-hero sf-hero-plain"><div class="sf-hero-text"><h1>${e(title)}</h1><p class="sf-lede">${e(lede)}</p></div></div>`;
  const t = loops.totals;
  const typed = t.prompts.person + t.prompts.interrupt;
  const headline = `${count(t.toolCalls)} tool calls and ${plural(t.commits, 'commit')} ${
    typed ? `with ${plural(typed, 'prompt')} from a person` : 'without a prompt from a person'
  }`;
  const first = loops.runs[0].started;
  const last = loops.runs.map((r) => r.ended).filter(Boolean).sort().at(-1) ?? first;
  // With the source's own account: every loop it ran, not only the runs that left a record.
  const f = loopAccountFacts(snapshot.overview);
  if (f)
    return `<div class="sf-hero">
        <div class="sf-hero-text">
          <h1><span class="sf-eyebrow">${e(title)}</span> <span class="sf-headline">${
            f.recorded ? `${count(f.totals.commits)} of ${count(f.recorded)} commits were made inside a loop run` : `${plural(f.totals.commits, 'commit')} made inside a loop run`
          }</span></h1>
          <p class="sf-lede">That is ${e(f.counts)} in <a href="${REPO}">in-the-loop</a>, a project that formally verifies Java code, ${e(
            range(f.first ?? first, f.last ?? last)
          )}. A loop gives an agent an instruction and lets it work: do the next piece, verify it, commit it, decide whether to go on. ${e(f.typed)}${f.hand ? ` ${e(f.hand)}` : ''}</p>
        </div>
        ${ledgerHtml(snapshot)}
      </div>`;
  return `<div class="sf-hero">
        <div class="sf-hero-text">
          <h1><span class="sf-eyebrow">${e(title)}</span> <span class="sf-headline">${e(headline)}</span></h1>
          <p class="sf-lede">That is what the feature loops did in <a href="${REPO}">in-the-loop</a>, a project that formally verifies Java code, in ${plural(t.runs, 'recorded run')}, ${e(
            range(first, last)
          )}. Each loop gives an agent a written brief and lets it work: do the next piece, verify it, commit it, decide whether to go on.</p>
        </div>
        ${ledgerHtml(snapshot)}
      </div>`;
}

/** The longest unattended run, as its record lists it: a dark panel, cycle by cycle. */
function ledgerHtml(snapshot) {
  const { loops, models } = snapshot.overview;
  const run = loops.longest;
  if (!run) return '';
  const model = models.find((m) => m.id === run.model)?.label ?? run.model;
  const started = Date.parse(run.started);
  const line = (c) =>
    `<li><span class="sf-ledger-time">${into((Date.parse(c.at) - started) / 1000)}</span><span class="sf-ledger-cycle">cycle ${c.n}</span><span class="sf-ledger-text">${e(c.summary)}</span></li>`;
  const head = run.ledger.slice(0, 5);
  const tail = run.ledger.length > 7 ? run.ledger.slice(-2) : run.ledger.slice(5);
  const skipped = run.ledger.length - head.length - tail.length;
  const record = `${REPO}/blob/${snapshot.manifest.source.sha}/llm-dlc/traces/${run.session}/runs/${run.run}.md`;
  return `<figure class="sf-ledger">
          <div class="sf-ledger-bar"><span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span><code>feature loop: ${e(run.loop)}</code></div>
          <div class="sf-ledger-body">
            <p class="sf-ledger-meta">started ${e(dayYear(run.started))} · ${e(model)} (<code>${e(run.model)}</code>), ${e(run.effort)} effort</p>
            <ol>
              ${head.map(line).join('\n              ')}${skipped > 0 ? `\n              <li class="sf-ledger-more"><span class="sf-ledger-time">⋮</span><span class="sf-ledger-cycle"></span><span class="sf-ledger-text">${plural(skipped, 'more cycle')}</span></li>` : ''}
              ${tail.map(line).join('\n              ')}
            </ol>
            <p class="sf-ledger-total"><strong>${plural(run.cycles, 'cycle')}</strong> · ${plural(run.commits, 'commit')} · ${count(run.toolCalls)} tool calls · <strong>${e(span(run.seconds))}</strong><br>0 prompts from a person, start to end</p>
          </div>
          <figcaption>The longest run nobody typed into, from <a href="${e(record)}">its own record</a>: each line is a cycle that ended in a commit.${
            floorFigure(loops)?.ids.has(run.run) ? ` <a href="#run-${e(run.run)}">Find it among the other runs</a>.` : ''
          }</figcaption>
        </figure>`;
}

// --- Feature loops ------------------------------------------------------------

const laneLabel = (loop, campaign, streams) => (loop === campaign.id ? (streams ? 'merge' : 'loop') : loop.slice(campaign.id.length + 1));

function campaignCard(campaign, runs, { e: esc = e } = {}) {
  const own = runs.filter((r) => r.campaign === campaign.id && r.ended);
  const from = Date.parse(campaign.first);
  const to = campaign.last ? Date.parse(campaign.last) : from;
  const lanes = [...Map.groupBy(own, (r) => r.loop)].map(([loop, list]) => ({
    label: laneLabel(loop, campaign, campaign.streams),
    runs: list.map((r) => ({
      from: Date.parse(r.started),
      to: Date.parse(r.ended),
      ticks: r.ticks.map((t) => Date.parse(r.started) + t * 1000),
      tip: `${r.loop}: ${plural(r.cycles, 'cycle')}, ${span(r.seconds)}${r.toolCalls === null ? '' : `, ${count(r.toolCalls)} tool calls`}. ${OUTCOMES[r.outcome]}.`,
    })),
  }));
  // The merge loop last, as it runs.
  lanes.sort((a, b) => (a.label === 'merge') - (b.label === 'merge'));
  const typed = campaign.prompts.person + campaign.prompts.interrupt;
  const shape = campaign.streams
    ? `${plural(campaign.streams, 'stream')} on separate branches, then one loop to merge them · up to ${count(campaign.peakParallel)} at once`
    : 'one loop';
  const facts = [
    ['Runs', count(campaign.runs)],
    ['Cycles', count(campaign.cycles)],
    ['Commits', count(campaign.commits)],
    ['Tool calls', count(campaign.toolCalls)],
    ['Agent time', hours(campaign.agentSeconds)],
    ['Estimated usage', formatValue(campaign.usd, 'usd')],
    campaign.codeAdded === null ? null : ['Lines of code', `+${count(campaign.codeAdded)}`],
    ['Prompts from a person', count(typed)],
  ].filter(Boolean);
  return `<article class="sf-campaign" id="loop-${esc(campaign.id)}">
            <header>
              <h3><code>${esc(campaign.id)}</code></h3>
              <p class="sf-campaign-meta"><span class="sf-outcome sf-outcome-${esc(campaign.outcome)}">${esc(OUTCOMES[campaign.outcome] ?? campaign.outcome)}</span>${
                campaign.area === 'unassigned' ? '' : ` <span class="sf-tag">${esc(campaign.areaLabel)}</span>`
              }</p>
            </header>
            <p class="sf-caption">${esc(range(campaign.first, campaign.last))} · ${shape}</p>
            ${lanesHtml(lanes, { from, to, startLabel: `started ${dayOf(campaign.first)}`, endLabel: `${span((to - from) / 1000)} later` })}
            <dl class="sf-kv">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
            <details class="sf-campaign-runs" data-sf-campaign="${esc(campaign.id)}">
              <summary>Every run and cycle</summary>
              <div data-sf-campaign-body><p class="sf-caption">Loaded when opened, from this snapshot's loop runs.</p></div>
            </details>
          </article>`;
}

/** The table that compares campaigns in the order they ran: how the loops changed. */
function campaignTable(campaigns) {
  const most = Math.max(1, ...campaigns.map((c) => c.toolCalls));
  const rows = campaigns
    .map((c) => {
      const perCommit = c.commits ? c.toolCalls / c.commits : null;
      const usdPerCommit = c.commits ? c.usd / c.commits : null;
      const bar = `<span class="sf-share" aria-hidden="true"><span style="width:${((c.toolCalls / most) * 100).toFixed(1)}%"></span></span>`;
      return `<tr><th scope="row"><a href="#loop-${e(c.id)}"><code>${e(c.id)}</code></a></th><td data-label="Started">${e(dayOf(c.first))}</td><td data-label="Side by side">${count(
        c.peakParallel
      )}</td><td data-label="Runs">${count(c.runs)}</td><td data-label="Cycles">${count(c.cycles)}</td><td data-label="Commits">${count(c.commits)}</td><td data-label="Tool calls">${count(
        c.toolCalls
      )}${bar}</td><td data-label="Tool calls per commit">${perCommit === null ? 'No data' : count(perCommit)}</td><td data-label="Usage per commit">${e(formatValue(usdPerCommit, 'usd'))}</td><td data-label="Tool calls that failed">${e(
        pct(rate(c.toolErrors, c.toolCalls))
      )}</td><td data-label="Prompts from a person">${count(c.prompts.person + c.prompts.interrupt)}</td></tr>`;
    })
    .join('\n              ');
  return `<div class="sf-table-wrap" tabindex="0" role="region" aria-label="Campaign by campaign">
            <table class="sf-table sf-stack sf-numbers">
              <thead><tr><th scope="col">Campaign</th><th scope="col">Started</th><th scope="col"><abbr title="The most loops under way at once">At once</abbr></th><th scope="col">Runs</th><th scope="col">Cycles</th><th scope="col">Commits</th><th scope="col">Tool calls</th><th scope="col"><abbr title="Tool calls per commit">Per commit</abbr></th><th scope="col"><abbr title="Estimated usage per commit">Usage per commit</abbr></th><th scope="col"><abbr title="Share of tool calls that failed">Failed</abbr></th><th scope="col"><abbr title="Prompts typed by a person during a run">From a person</abbr></th></tr></thead>
              <tbody>
              ${rows}
              </tbody>
            </table>
          </div>`;
}

const DRIVERS = [
  { key: 'by-loop', label: 'The loop’s own prompt' },
  { key: 'by-person', label: 'A prompt a person typed' },
  { key: 'by-other', label: 'A slash command or another agent' },
];

/**
 * Where a picked record is shown, under the figure it was picked on: what is
 * picked, the buttons that step to the one before and after, and the record.
 * Hidden until the page's script is there to fill it. `noun` is what a mark is:
 * a run, an example.
 */
function inspectHtml(noun, hint) {
  return `<div class="sf-inspect" data-sf-inspect="${e(noun)}" hidden>
            <div class="sf-inspect-bar">
              <p class="sf-inspect-at" data-sf-inspect-at role="status">${e(hint)}</p>
              <p class="sf-inspect-steps"><button type="button" data-sf-step="-1" hidden>Earlier ${e(noun)}</button><button type="button" data-sf-step="1">Show the first ${e(noun)}</button><button type="button" data-sf-step="0" hidden>Close</button></p>
            </div>
            <div data-sf-inspect-body></div>
          </div>`;
}

const HOUR = 3600e3;
const PAUSE = 6 * HOUR; // with no loop running for longer than this, the floor's clock is cut
const FLOOR_HOURS = 120; // the newest stretches the floor shows add up to about this much
const CLOCK_HOURS = 160; // the same for the overview's clock of every loop, which starts with the first
const NIGHT = { from: 22, to: 6 }; // shaded on the floor, on Toronto's clock
const asked = (r) => r.outcome === 'blocked' || r.outcome === 'attention';
const lull = (ms) => {
  const h = Math.round(ms / HOUR);
  return h < 48 ? plural(h, 'hour') : `${plural(Math.floor(h / 24), 'day')}${h % 24 ? ` ${plural(h % 24, 'hour')}` : ''}`;
};
const moment = (ms) => `${dayOf(ms)}, ${clockWords(torontoClock(ms))}`;

/**
 * The finished runs as stretches of work: a new stretch starts when no loop
 * has run for PAUSE. Each has its runs, their commits, and how long at least
 * one loop was running.
 */
export function stretches(loops) {
  const runs = loops.runs
    .filter((r) => r.ended)
    .map((r) => ({ ...r, from: Date.parse(r.started), to: Date.parse(r.ended) }))
    .sort((a, b) => a.from - b.from);
  const out = [];
  for (const r of runs) {
    const s = out.at(-1);
    if (s && r.from - s.to <= PAUSE) {
      s.busy += Math.max(0, r.to - Math.max(r.from, s.to));
      s.to = Math.max(s.to, r.to);
      s.runs.push(r);
    } else out.push({ from: r.from, to: r.to, busy: r.to - r.from, runs: [r] });
  }
  return out.map((s) => ({
    ...s,
    commits: s.runs.reduce((t, r) => t + r.commits, 0),
    campaigns: new Set(s.runs.map((r) => r.campaign)).size,
    loops: new Set(s.runs.map((r) => r.loop)).size,
    typed: s.runs.reduce((t, r) => t + (r.person ?? 0), 0),
  }));
}

// The most runs under way at one moment.
const mostAtOnce = (runs) => runs.reduce((most, r) => Math.max(most, runs.filter((q) => q.from <= r.from && r.from < q.to).length), 0);

const VERIFICATION = 'verification';
const BY_HAND = 'moonshot by hand'; // the source's kind for the loop a person ran, typing each instruction
/**
 * The source's account of its runs as the floor draws them: every run of
 * every loop. A run that left a run record has that record's outcome. A run
 * the loops collection has a record for can be picked: since generator 11
 * that is every run, the ones without a run record from the source's index
 * of its loops. The
 * verification loop's sessions take the first row, drawn quieter: they run
 * the queued proofs and commit the results, and have no cycles. Null for a
 * snapshot whose account has no runs.
 */
export function accountClock(overview) {
  const account = overview.loopAccount;
  if (!account?.runs?.length) return null;
  const recorded = new Map((overview.loops?.runs ?? []).map((r) => [r.id, r]));
  const cards = new Set((overview.loops?.campaigns ?? []).map((c) => c.id));
  const runs = account.runs.map((r) => {
    const record = recorded.get(r.id);
    return {
      // A run can be picked when the loops collection has a record for it.
      id: record || r.hasRecord ? r.id : null,
      loop: r.loop,
      campaign: r.campaign,
      started: r.started,
      ended: r.ended,
      seconds: r.ended ? Math.round((Date.parse(r.ended) - Date.parse(r.started)) / 1000) : null,
      outcome: record?.outcome ?? r.outcome,
      cycles: r.cycles,
      commits: r.commits,
      ticks: r.ticks,
      person: r.interjections,
      quiet: r.category === VERIFICATION,
    };
  });
  const ids = [...new Set(runs.map((r) => r.campaign))];
  const quietFirst = (id) => (runs.some((r) => r.campaign === id && !r.quiet) ? 1 : 0);
  const campaigns = ids
    .map((id) => ({ id, streams: new Set(runs.filter((r) => r.campaign === id && r.loop !== id).map((r) => r.loop)).size, card: cards.has(id), quiet: !quietFirst(id) }))
    .sort((a, b) => quietFirst(a.id) - quietFirst(b.id));
  return { runs, campaigns, unrecorded: account.runs.filter((r) => !recorded.has(r.id)).length, closed: runs.filter((r) => !r.id).length };
}

/**
 * Every run on one clock. A campaign takes a block of rows: a row for each of
 * its loops, the one that merges the others last. Campaigns under way at the
 * same time get blocks under each other.
 */
function floorFigure(loops, { cap = FLOOR_HOURS } = {}) {
  const all = stretches(loops);
  if (!all.length) return null;
  // The newest stretches, as many as fit; the newest always does.
  const shown = [];
  for (const s of all.toReversed()) {
    if (shown.length && shown.reduce((t, q) => t + q.to - q.from, 0) + s.to - s.from > cap * HOUR) break;
    shown.unshift(s);
  }
  const panels = shown.map((s, i) => ({ from: s.from, to: s.to, pause: i ? `No loop ran for ${lull(s.from - shown[i - 1].to)}` : '' }));
  const panelOf = (ms) => panels.findLast((p) => ms >= p.from) ?? panels[0];
  const runs = shown.flatMap((s) => s.runs);

  const rowOf = new Map();
  const blocks = [];
  for (const c of loops.campaigns) {
    const own = runs.filter((r) => r.campaign === c.id);
    if (!own.length) continue;
    const merges = (loop) => Boolean(c.streams) && loop === c.id;
    const mine = [...new Set(own.map((r) => r.loop))].sort((a, b) => merges(a) - merges(b));
    // A quiet loop keeps its row for the whole clock, so no other loop is drawn in it.
    const from = c.quiet ? -Infinity : Math.min(...own.map((r) => r.from));
    const to = c.quiet ? Infinity : Math.max(...own.map((r) => r.to));
    let base = 0;
    while (blocks.some((b) => b.from < to && from < b.to && base < b.base + b.rows && b.base < base + mine.length)) base++;
    blocks.push({ id: c.id, from, to, base, rows: mine.length, quiet: Boolean(c.quiet), card: c.card !== false });
    mine.forEach((loop, i) => rowOf.set(loop, base + i));
  }
  blocks.sort((a, b) => a.from - b.from);
  // A quiet row is named by the legend, not above the plot.
  const named = blocks.filter((b) => !b.quiet);
  const quiet = runs.filter((r) => r.quiet).length;

  const nights = [];
  const ticks = [];
  for (const p of panels) {
    ticks.push({ at: p.from, label: dayOf(p.from), kind: 'start' });
    for (let t = Math.floor(p.from / HOUR) * HOUR; t < p.to; t += HOUR) {
      const { hour } = torontoClock(t);
      if (hour >= NIGHT.from || hour < NIGHT.to) {
        const last = nights.at(-1);
        if (last && last.to === t && t > p.from) last.to = Math.min(t + HOUR, p.to);
        else nights.push({ from: Math.max(t, p.from), to: Math.min(t + HOUR, p.to) });
      }
      if (t > p.from && hour % 6 === 0) ticks.push({ at: t, label: hour ? clockWords({ hour, minute: 0 }) : dayOf(t), kind: hour ? 'hour' : 'day' });
    }
  }
  const flagged = runs.filter(asked).length;
  const html = floorHtml({
    panels,
    rows: Math.max(...blocks.map((b) => b.base + b.rows)),
    nights,
    ticks,
    runs: runs.map((r) => ({
      id: r.id,
      from: r.from,
      to: r.to,
      row: rowOf.get(r.loop),
      ticks: (r.ticks ?? []).map((t) => r.from + t * 1000),
      flag: asked(r),
      quiet: Boolean(r.quiet),
      tip: r.quiet
        ? `A session of the ${r.loop} loop, from ${moment(r.from)}: ${plural(r.commits, 'commit')} of results in ${span(r.seconds)}.`
        : `${r.loop}, from ${moment(r.from)}: ${plural(r.cycles, 'cycle')} and ${plural(r.commits, 'commit')} in ${span(r.seconds)}. ${OUTCOMES[r.outcome] ?? r.outcome}.`,
    })),
    names: named.map((b, i) => {
      const next = named.slice(i + 1).find((n) => n.from > b.from && panelOf(n.from) === panelOf(b.from));
      // A campaign with run records has a card on the loops page; any other loop is in the list of every loop.
      return { at: b.from, until: next ? next.from : panelOf(b.from).to, label: b.id, href: `${ROUTE}loops/#${b.card ? `loop-${b.id}` : 'every-loop'}` };
    }),
  });
  const legend = `<ul class="sf-legend sf-floor-legend">
              <li><span class="sf-swatch sf-swatch-run" aria-hidden="true"></span>A run, with a notch for each cycle’s commit</li>${
                quiet ? `\n              <li><span class="sf-swatch sf-swatch-quiet" aria-hidden="true"></span>A session of the verification loop: it runs the queued proofs and commits the results</li>` : ''
              }${
                flagged ? `\n              <li><span class="sf-swatch sf-swatch-asked" aria-hidden="true"></span>Ended blocked on a person, or flagged for one</li>` : ''
              }
              <li><span class="sf-swatch sf-swatch-night" aria-hidden="true"></span>${e(clockWords({ hour: NIGHT.from, minute: 0 }))} to ${e(clockWords({ hour: NIGHT.to, minute: 0 }))} in Toronto</li>
            </ul>`;
  const cut = panels.length > 1 ? ` The clock skips ${panels.length === 2 ? `the ${lull(panels[1].from - panels[0].to)}` : 'each pause of more than six hours'} when no loop ran.` : '';
  const partial = shown.length < all.length ? ` Runs before ${e(dayYear(shown[0].from))} are on the feature loops page.` : '';
  const inspect = inspectHtml('run', 'Pick a run on the clock to read its record, cycle by cycle.');
  // With the account every run is here; without it, the runs that left a record.
  const every = loops.unrecorded === undefined ? 'Every run that left a record' : 'Every run of every loop';
  const which = `${quiet ? 'the verification sessions, and ' : ''}the runs from before the script wrote one`;
  const closed = loops.closed
    ? ` ${plural(loops.closed, 'run')} in the account left no record of ${loops.closed === 1 ? 'its' : 'their'} own to open: ${which}.`
    : loops.unrecorded
      ? ` ${plural(loops.unrecorded, 'run')} left no run record: ${which}. ${loops.unrecorded === 1 ? 'It opens' : 'They open'} with what the source’s index of its loops has.`
      : '';
  return {
    html,
    legend,
    inspect,
    ids: new Set(runs.map((r) => r.id).filter(Boolean)),
    stretches: all,
    runs: runs.length,
    caption: `${shown.length < all.length ? `${plural(runs.length, 'loop run')}` : every}, ${e(range(shown[0].from, shown.at(-1).to))}, on one clock. Rows are loops working at the same time on separate branches; the last row of a campaign is the loop that merges the others.${cut}${partial}${closed}`,
  };
}

/** The loop's own scripts, commit by commit: how the loop itself changed. */
function scriptsHtml(scripts, days) {
  if (!scripts?.commits.length) return '';
  const first = scripts.commits[0];
  const last = scripts.commits.at(-1);
  const items = [...Map.groupBy(scripts.commits, (c) => torontoDay(c.at))]
    .map(
      ([day, list]) =>
        `<li><time datetime="${e(day)}">${e(formatDay(day, { year: false }))}</time><ul>${list
          .map((c) => `<li><a href="${REPO}/commit/${e(c.sha)}">${e(c.subject)}</a></li>`)
          .join('')}</ul></li>`
    )
    .join('');
  return `<details class="sf-data-table sf-history"><summary>How the loop itself changed: ${plural(scripts.commits.length, 'commit')} to its scripts, ${e(dayOf(first.at))} to ${e(
    dayOf(last.at)
  )}</summary><p class="sf-caption">Every commit to ${scripts.paths.map((f) => `<code>${e(f.slice(f.lastIndexOf('/') + 1))}</code>`).join(', ')}, oldest first, by its own summary line.</p><ol class="sf-history-list">${items}</ol></details>`;
}

/** Each day's tool calls by who set them off, with the prompts typed that day and the loop's script commits. */
function driveDays(overview) {
  const { loops, days } = overview;
  const byDay = new Map(loops.drive.rows.map((r) => [r[0], r]));
  const changed = new Map();
  for (const c of loops.scripts?.commits ?? []) changed.set(torontoDay(c.at), (changed.get(torontoDay(c.at)) ?? 0) + 1);
  return days.map((day, i) => {
    const r = byDay.get(i);
    const flag = changed.get(day) ?? 0;
    const note = flag ? `; the loop’s scripts changed in ${plural(flag, 'commit')}` : '';
    if (!r || !(r[1] + r[2] + r[3])) return { day, flag, total: 0, up: null, tip: `${formatDay(day)}: no tool calls${note}` };
    const total = r[1] + r[2] + r[3];
    return {
      day,
      flag,
      total,
      typed: r[4],
      up: [r[1], r[2], r[3]],
      per: r[4] ? total / r[4] : null,
      tip: `${formatDay(day)}: ${count(total)} tool calls, ${count(r[1])} set off by the loop’s own prompt (${pct(rate(r[1], total), 0)}), ${count(r[2])} by a person’s${note}`,
    };
  });
}

const shortDay = (p) => formatDay(p.day, { year: false });

/** What the days of driveDays add up to: the loop's share, its first day, and the reach of a typed prompt. */
function driveFacts(rows) {
  const measured = rows.filter((p) => p.up !== null);
  const sum = (k) => measured.reduce((t, p) => t + p.up[k], 0);
  const ratios = measured.filter((p) => p.per !== null);
  return {
    measured,
    byLoop: sum(0),
    all: sum(0) + sum(1) + sum(2),
    firstLoop: measured.find((p) => p.up[0] > 0) ?? null,
    ratios,
    first: ratios[0] ?? null,
    peak: ratios.reduce((a, b) => (a === null || b.per > a.per ? b : a), null),
  };
}

/** Who set off each day's tool calls, and how many tool calls each typed prompt was matched by. */
function driveFigure(overview) {
  const { loops, days } = overview;
  if (!loops.drive) return '';
  const rows = driveDays(overview);
  const { measured, byLoop, all, firstLoop, ratios, first, peak } = driveFacts(rows);
  const short = shortDay;
  const leverage = rows.map((p) =>
    p.up === null || p.per === null
      ? { day: p.day, up: null, tip: p.up === null ? `${formatDay(p.day)}: no tool calls` : `${formatDay(p.day)}: ${count(p.total)} tool calls, no prompt typed by a person` }
      : { day: p.day, up: [p.per], tip: `${formatDay(p.day)}: ${count(p.total)} tool calls and ${plural(p.typed, 'prompt')} typed by a person, ${count(p.per)} for each` }
  );
  const table = rows
    .map((p) =>
      p.up === null
        ? `<tr><th scope="row"><time datetime="${p.day}">${e(formatDay(p.day))}</time></th><td colspan="6"><span class="sf-muted">No tool calls</span></td><td>${p.flag ? count(p.flag) : ''}</td></tr>`
        : `<tr><th scope="row"><time datetime="${p.day}">${e(formatDay(p.day))}</time></th><td>${count(p.up[0])}</td><td>${count(p.up[1])}</td><td>${count(p.up[2])}</td><td>${e(
            pct(rate(p.up[0], p.total), 0)
          )}</td><td>${count(p.typed)}</td><td>${p.per === null ? '<span class="sf-muted">None typed</span>' : count(p.per)}</td><td>${p.flag ? count(p.flag) : ''}</td></tr>`
    )
    .join('');
  const flagged = rows.some((p) => p.flag);
  return `<div class="sf-subhead"><h2>Who set off the work</h2>${legendHtml(DRIVERS, { flag: flagged ? 'The loop’s scripts changed' : null })}</div>
          <p class="sf-caption">Tool calls per day (Toronto days), by who sent the prompt that set them off. The loop’s own prompts are behind ${e(pct(rate(byLoop, all), 0))} of all ${count(all)} tool calls${
            firstLoop ? `, from none before ${e(short(firstLoop))}` : ''
          }. This needs no run record, so it reaches back before the first one. <a href="${ROUTE}methodology/#def-loop_drive">Definition</a></p>
          <div class="sf-chart-wrap">${columnsSvg(rows, {
            id: 'sf-chart-drive',
            title: 'Tool calls per day, by who set them off',
            series: { up: DRIVERS },
            desc: `${measured.length} of ${days.length} days with tool calls.`,
          })}</div>
          ${
            first && peak
              ? `<div class="sf-subhead sf-subhead-follow"><h2>Tool calls for each prompt a person typed</h2></div>
          <p class="sf-caption">A day’s tool calls, in every session, divided by the prompts a person typed that day: ${count(first.per)} on ${e(short(first))}, ${count(peak.per)} on ${e(short(peak))}. A person’s prompt often starts a loop, so this is reach, not absence.</p>
          <div class="sf-chart-wrap">${columnsSvg(leverage, {
            id: 'sf-chart-reach',
            title: 'Tool calls for each prompt a person typed, per day',
            series: { up: [{ key: 'reach', label: 'Tool calls for each prompt a person typed' }] },
            desc: `${ratios.length} of ${days.length} days with a prompt typed by a person.`,
            slim: true,
          })}</div>`
              : ''
          }
          <details class="sf-data-table"><summary>Data table</summary><table class="sf-table"><thead><tr><th scope="col">Day (Toronto)</th><th scope="col">Set off by the loop</th><th scope="col">By a person</th><th scope="col">By a command or agent</th><th scope="col">Loop’s share</th><th scope="col">Prompts typed</th><th scope="col">Tool calls for each</th><th scope="col">Script commits</th></tr></thead><tbody>${table}</tbody></table></details>
          ${scriptsHtml(loops.scripts, days)}`;
}

/** What the live panel will show, with example data: only ever in a preview build, and labelled. */
function livePreview(preview) {
  const rows = preview.loops
    .map(
      (l) =>
        `<tr><th scope="row"><code>${e(l.loop)}</code></th><td data-label="State"><span class="sf-outcome sf-outcome-${l.state === 'active' ? 'done' : 'waiting'}">${e(l.state)}</span></td><td data-label="Cycle">${e(
          l.cycle
        )}</td><td data-label="Last commit">${e(l.lastCommit)}</td><td data-label="Last output">${e(l.lastOutput)}</td><td data-label="Spend so far">${e(l.spend)}</td></tr>`
    )
    .join('');
  return `<div class="sf-live-preview">
              <p class="sf-example" role="note"><strong>Example data.</strong> ${e(preview.note)}</p>
              <div class="sf-table-wrap" tabindex="0" role="region" aria-label="Example of the live loops panel">
                <table class="sf-table sf-stack"><thead><tr><th scope="col">Loop</th><th scope="col">State</th><th scope="col">Cycle</th><th scope="col">Last commit</th><th scope="col">Last output</th><th scope="col">Spend so far</th></tr></thead><tbody>${rows}</tbody></table>
              </div>
            </div>`;
}

/**
 * Where running loops will be listed, once a reporter on the factory machine
 * exists. It says so plainly. `preview` is example data showing the panel's
 * shape, given only to a preview build, and labelled as an example.
 */
export function runningHtml(preview = null) {
  return `<aside class="sf-live" aria-labelledby="sf-live-title">
          <h2 id="sf-live-title">Loops running now <span class="sf-tag">Not connected yet</span></h2>
          <p>Everything above comes from runs that have finished and been published. Following a loop while it runs needs a small reporter on the machine the loops run on, which doesn't exist yet. When it does, each active loop will be listed here with its cycle, its last commit and the time since its last output, and a loop that goes quiet will be marked stale, never shown as running.</p>
          ${preview ? livePreview(preview) : ''}
        </aside>`;
}

/** The floor on the feature loops page, under its own heading. */
function floorSection(loops, { cap = FLOOR_HOURS, partial = false } = {}) {
  const floor = floorFigure(loops, { cap });
  if (!floor) return '';
  return `<div class="sf-subhead" id="clock"><h2>${partial ? 'Those runs on one clock' : 'Every run on one clock'}</h2></div>
        <figure class="sf-floor-figure">
          ${floor.legend}
          ${floor.html}
          <figcaption class="sf-caption">${floor.caption} Each campaign is drawn on its own clock <a href="#sf-campaigns">below</a>.</figcaption>
        </figure>
        ${floor.inspect}`;
}

/** The feature loops section. */
export function loopsHtml(snapshot) {
  const { loops } = snapshot.overview;
  if (!loops || !loops.totals.runs)
    return unavailable('Feature loops', 'This snapshot has no feature loop run records: the source had none at its revision, or the snapshot was made before they were read.');
  const t = loops.totals;
  const typed = t.prompts.person + t.prompts.interrupt;
  const campaigns = loops.campaigns;
  const title = `${word(campaigns.length)} ${campaigns.length === 1 ? 'campaign' : 'campaigns'}, ${plural(t.runs, 'run')}, ${plural(t.cycles, 'cycle')}${typed ? '' : ', no prompt from a person'}`;
  const stopped = (loops.outcomes.attention ?? 0) + (loops.outcomes.blocked ?? 0);
  const figures = [
    tile('Runs', count(t.runs), `${plural(t.loops, 'loop')} in ${plural(campaigns.length, 'campaign')}`),
    tile('Cycles', count(t.cycles), `${plural(t.commits, 'commit')}`),
    tile('Model calls', count(t.calls), `${count(t.toolCalls)} tool calls`),
    tile('Prompts from a person', count(typed), `${plural(t.prompts.agent, 'message')} from other agents`),
    tile('Agent time', hours(t.agentSeconds), `${hours(t.runSeconds)} on the clock, runs added up`),
    tile('Estimated usage', formatValue(t.usd, 'usd'), t.commits ? `${e(formatValue(t.usd / t.commits, 'usd'))} per commit` : ''),
  ].join('');
  const f = loopAccountFacts(snapshot.overview);
  if (f) {
    const a = f.totals;
    const clock = accountClock(snapshot.overview);
    const tiles = [
      tile('Runs', count(a.runs), `of ${plural(a.loops, 'loop')}`),
      tile('Cycles', count(a.cycles), `${count(a.cyclesCommitted)} ended in a commit`),
      tile('Commits', count(a.commits), f.recorded ? `of ${count(f.recorded)} recorded changes` : 'made inside a loop run'),
      tile('Verification jobs', count(a.jobs), a.jobs ? `${count(a.jobsPassed)} passed, ${count(a.jobsFailed)} failed` : 'queued by a cycle'),
      tile('Active time', hours(a.busySeconds), `a model or a tool at work; ${count(a.compactions)} compactions`),
      tile('Estimated usage', formatValue(a.usd, 'usd'), a.cyclesCommitted ? `${e(formatValue(a.usd / a.cyclesCommitted, 'usd'))} per committed cycle` : ''),
    ].join('');
    return `<p class="sf-eyebrow">Feature loops</p>
        <h1 id="sf-loops-title">${e(`${plural(a.loops, 'loop')}, ${plural(a.runs, 'run')}, ${plural(a.cycles, 'cycle')}${f.account.interjections ? '' : ', no prompt typed into a run'}`)}</h1>
        <p class="sf-section-lede">A loop starts an agent session and gives it the same instruction again after every commit: do the next piece of work, verify it, commit it, decide whether to go on. ${
          f.recorded ? `${count(a.commits)} of the ${count(f.recorded)} recorded changes were committed inside a loop run. ` : ''
        }${e(f.typed)}${f.hand ? ` ${e(f.hand)}` : ''}</p>
        <dl class="sf-figures">${tiles}</dl>
        ${loopAccountTables(snapshot.overview)}
        ${clock ? floorSection(clock, { cap: Infinity }) : ''}
        <div class="sf-subhead"><h2>The runs that left a record</h2></div>
        <p class="sf-caption">Since Nov 6 the loop’s script writes a record of each run, cycle by cycle. ${plural(t.runs, 'run')} of ${plural(t.loops, 'loop')} left one, in ${plural(campaigns.length, 'campaign')}: a campaign runs several loops side by side on separate branches, then one more to merge them. The ${clock ? '' : 'clock, the '}prompts and the campaigns below are read from those records${
          stopped ? `; ${word(stopped).toLowerCase()} of the ${count(t.runs)} runs ended blocked on a person or flagged for one’s attention` : ''
        }.</p>
        <dl class="sf-figures">${figures}</dl>
        <p class="sf-coverage">Coverage: ${e(formatCoverage(loops.coverage))} · All time; no filter applies · <a href="${ROUTE}methodology/#def-loop_person_prompts">What counts as a prompt from a person</a></p>
        ${clock ? '' : floorSection(loops, { partial: true })}
        ${driveFigure(snapshot.overview)}
        <div class="sf-subhead"><h2>Campaign by campaign</h2></div>
        <p class="sf-caption">In the order they ran. At once is the most loops under way together. Failed is the share of tool calls that failed, which is not a failed loop: see <a href="${ROUTE}tools/">model performance</a>.</p>
        ${campaignTable(campaigns)}
        <div class="sf-subhead" id="sf-campaigns"><h2>Each campaign</h2></div>
        <p class="sf-caption">Newest first. A bar is one run on the campaign's own clock; a notch is a cycle's commit. Open a campaign for every run and cycle, with links to its record and its session.</p>
        <div class="sf-campaigns">
          ${[...campaigns].reverse().map((c) => campaignCard(c, loops.runs)).join('\n          ')}
        </div>`;
  }
  return `<p class="sf-eyebrow">Feature loops</p>
        <h1 id="sf-loops-title">${e(title)}</h1>
        <p class="sf-section-lede">A feature loop starts one agent session on a written brief. Each cycle it reads the brief again, does the next piece of work, verifies it and commits it, then decides whether to go on. A campaign runs several loops side by side on separate branches, then one more to merge them. ${
          stopped ? `${word(stopped)} of the ${count(t.runs)} runs ended blocked on a person or flagged for one's attention.` : ''
        }</p>
        <dl class="sf-figures">${figures}</dl>
        <p class="sf-coverage">Coverage: ${e(formatCoverage(loops.coverage))} · All time; no filter applies · <a href="${ROUTE}methodology/#def-loop_person_prompts">What counts as a prompt from a person</a></p>
        ${floorSection(loops)}
        ${driveFigure(snapshot.overview)}
        <div class="sf-subhead"><h2>Campaign by campaign</h2></div>
        <p class="sf-caption">In the order they ran. At once is the most loops under way together. Failed is the share of tool calls that failed, which is not a failed loop: see <a href="${ROUTE}tools/">model performance</a>.</p>
        ${campaignTable(campaigns)}
        <div class="sf-subhead" id="sf-campaigns"><h2>Each campaign</h2></div>
        <p class="sf-caption">Newest first. A bar is one run on the campaign's own clock; a notch is a cycle's commit. Open a campaign for every run and cycle, with links to its record and its session.</p>
        <div class="sf-campaigns">
          ${[...campaigns].reverse().map((c) => campaignCard(c, loops.runs)).join('\n          ')}
        </div>`;
}

/** A campaign's runs with their cycles, from the loops collection: drawn when a reader opens it. */
export function campaignRunsHtml(records, campaignId) {
  // The card counts the runs that left a run record, so the list keeps to them.
  const own = records.filter((r) => r.campaign === campaignId && !r.source);
  if (!own.length) return '<p class="sf-muted">No runs recorded for this campaign.</p>';
  return own
    .map((r) => {
      const started = Date.parse(r.started);
      const cycles = r.cycles
        .map(
          (c) =>
            `<li><span class="sf-cycle-time">${into((Date.parse(c.at) - started) / 1000)}</span><span><code>${e(c.change.slice(0, 8))}</code> ${e(c.summary)}${
              c.decision === 'stop' ? ' <span class="sf-tag">decided to stop</span>' : ''
            }</span></li>`
        )
        .join('');
      const typed = r.prompts ? r.prompts.person + r.prompts.interrupt : null;
      const facts = [
        plural(r.cycles.length, 'cycle'),
        plural(r.commits, 'commit'),
        r.toolCalls === null ? null : `${count(r.toolCalls)} tool calls`,
        span(r.seconds),
        r.usd === null ? null : formatValue(r.usd, 'usd'),
        typed === null ? null : `${plural(typed, 'prompt')} from a person`,
      ].filter(Boolean);
      return `<details class="sf-run-detail"><summary><code>${e(r.loop)}</code> <span class="sf-muted">${e(dayOf(r.started))} · ${e(facts.join(' · '))}</span> <span class="sf-outcome sf-outcome-${e(r.outcome)}">${e(
        OUTCOMES[r.outcome] ?? r.outcome
      )}</span></summary>
                <p class="sf-caption"><code>${e(r.model)}</code> at ${e(r.effort)} effort${link(r.recordUrl, 'Run record')}${link(r.summaryUrl, 'Session summary')}</p>
                <ol class="sf-cycles">${cycles || '<li class="sf-muted">No cycle committed.</li>'}</ol>
              </details>`;
    })
    .join('\n');
}

/**
 * One run's record, shown when a reader picks the run on the floor: every
 * cycle by its own summary, what the run took, and how it ended. `r` is a
 * record of the loops collection; models is overview.models, for the names.
 *
 * A run that left no run record has a record read from the source's index of
 * its loops (r.source): its cycles as the index read them from the session,
 * or, for a session of the verification loop, only what the session took.
 */
export function runRecordHtml(r, { models = [] } = {}) {
  const started = Date.parse(r.started);
  const label = models.find((m) => m.id === r.model)?.label;
  const session = r.source === 'session';
  const byHand = r.kind === BY_HAND;
  const typed = r.prompts ? r.prompts.person + r.prompts.interrupt : null;
  const lines = r.cycles
    .map(
      (c) =>
        `<li><span class="sf-ledger-time">${into((Date.parse(c.at) - started) / 1000)}</span><span class="sf-ledger-cycle">cycle ${e(c.n)}</span><span class="sf-ledger-text">${
          c.change === null && !c.summary ? '<span class="sf-ledger-stop">ended without a commit</span>' : e(c.summary)
        }${c.commits > 1 ? ` <span class="sf-ledger-stop">${count(c.commits)} commits</span>` : ''}${c.decision === 'stop' ? ' <span class="sf-ledger-stop">decided to stop</span>' : ''}</span></li>`
    )
    .join('\n              ');
  const none = session ? 'A session of the verification loop has no cycles: it runs the queued proofs and commits the results.' : 'No cycle committed.';
  const took = [
    session ? null : `<strong>${plural(r.cycles.length, 'cycle')}</strong>`,
    session ? `<strong>${plural(r.commits, 'commit')}</strong> of results` : plural(r.commits, 'commit'),
    r.toolCalls === null || r.toolCalls === undefined ? null : `${count(r.toolCalls)} tool calls`,
    r.seconds === null ? null : `<strong>${e(span(r.seconds))}</strong>`,
    r.usd === null || r.usd === undefined ? null : `${e(formatValue(r.usd, 'usd'))} estimated usage`,
    r.codeAdded ? `+${count(r.codeAdded)} lines of code` : null,
  ].filter(Boolean);
  // Who typed: a run record counts a person's prompts; the index counts the prompts that are not the loop's own.
  const who = byHand
    ? 'Each instruction typed by a person, before the script existed'
    : typed !== null
      ? `${plural(typed, 'prompt')} from a person, start to end`
      : r.interjections === 0
        ? '0 prompts from a person, start to end'
        : r.interjections
          ? `${plural(r.interjections, 'prompt')} not the loop’s own`
          : null;
  const ended = [who, e(OUTCOMES[r.outcome] ?? r.outcome)].filter(Boolean);
  const links = `${link(r.recordUrl, 'Run record')}${link(r.summaryUrl, 'Session summary')}`.replace(/^ · /, '');
  const name = session ? `verification loop${r.loop === VERIFICATION ? '' : `: ${e(r.loop)}`}` : `feature loop: ${e(r.loop)}`;
  const note = session
    ? 'This session left no run record. What it took is from the source’s index of its loops.'
    : r.source
      ? 'This run left no run record. Each line is a cycle as the source’s index of its loops read it from the session, by the summary line of its commit.'
      : 'Each line is a cycle, by the summary line of its own commit.';
  return `<div class="sf-ledger sf-ledger-full">
            <div class="sf-ledger-bar"><span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span><code>${name}</code></div>
            <div class="sf-ledger-body">
              <p class="sf-ledger-meta">started ${e(dayYear(r.started))}, ${e(clockWords(torontoClock(started)))} · ${label ? `${e(label)} (<code>${e(r.model)}</code>)` : `<code>${e(r.model)}</code>`}, ${e(r.effort)} effort</p>
              <ol>
              ${lines || `<li class="sf-ledger-more${session ? ' sf-ledger-plain' : ''}">${session ? '' : '<span class="sf-ledger-time"></span><span class="sf-ledger-cycle"></span>'}<span class="sf-ledger-text">${none}</span></li>`}
              </ol>
              <p class="sf-ledger-total">${took.join(' · ')}<br>${ended.join(' · ')}</p>
            </div>
            <p class="sf-ledger-note">${note}${links ? ` ${links}` : ''}</p>
          </div>`;
}

// --- Tools --------------------------------------------------------------------

/** The failed-calls chart's points for one model (an index into overview.models) or all (null). */
export function toolDays(overview, model = null) {
  const { tools, days } = overview;
  const cells = new Map();
  for (const r of tools.daily.rows) {
    if (model !== null && r[1] !== model) continue;
    const c = cells.get(r[0]) ?? cells.set(r[0], [0, 0, 0, 0, 0, 0]).get(r[0]);
    for (let i = 0; i < 6; i++) c[i] += r[i + 2];
  }
  const top = new Map(tools.dayTop.map((d) => [d.day, d]));
  return days.map((day, i) => {
    const c = cells.get(i);
    if (!c || !c[0]) return { day, calls: 0, up: null, tip: `${formatDay(day)}: no tool calls` };
    const [calls, errors, ...kinds] = c;
    const worst = model === null ? top.get(i) : null;
    return {
      day,
      calls,
      errors,
      kinds,
      worst,
      up: kinds.map((k) => k / calls),
      tip: `${formatDay(day)}: ${count(errors)} of ${count(calls)} tool calls failed (${pct(errors / calls)})${worst ? `; most from ${worst.source} (${worst.errors})` : ''}`,
    };
  });
}

/** The failed-calls chart and its table: redrawn by the browser when a model is chosen. */
export function toolChartHtml(overview, model = null) {
  const points = toolDays(overview, model);
  const name = model === null ? 'all models' : overview.models[model].label;
  const rows = points
    .map((p) =>
      p.up === null
        ? `<tr><th scope="row"><time datetime="${p.day}">${e(formatDay(p.day))}</time></th><td colspan="7"><span class="sf-muted">No tool calls</span></td></tr>`
        : `<tr><th scope="row"><time datetime="${p.day}">${e(formatDay(p.day))}</time></th><td>${count(p.calls)}</td><td>${e(pct(1 - p.errors / p.calls))}</td>${p.kinds
            .map((k) => `<td>${count(k)}</td>`)
            .join('')}<td class="sf-left">${p.worst ? `${e(p.worst.source)} (${count(p.worst.errors)})` : ''}</td></tr>`
    )
    .join('');
  const measured = points.filter((p) => p.up !== null);
  return `<div class="sf-chart-wrap">${columnsSvg(points, {
    id: 'sf-chart-tools',
    title: `Share of tool calls that failed per day, ${name}`,
    series: { up: KINDS },
    unit: 'ratio',
    desc: `${measured.length} of ${points.length} days with tool calls.`,
  })}</div>
          <details class="sf-data-table"><summary>Data table</summary><table class="sf-table"><thead><tr><th scope="col">Day (Toronto)</th><th scope="col">Tool calls</th><th scope="col">Succeeded</th>${KINDS.map(
            (k) => `<th scope="col">${e(k.label)}</th>`
          ).join('')}<th scope="col" class="sf-left">Largest source of failures</th></tr></thead><tbody>${rows}</tbody></table></details>`;
}

const bucket = (b) => {
  const k = (n) => `${n / 1000}K`;
  return b.to === null ? `${k(b.from)} tokens and over` : b.from === 0 ? `Under ${k(b.to)} tokens` : `${k(b.from)} to ${k(b.to)}`;
};
const failBar = (r, most) => `<span class="sf-share sf-share-warn" aria-hidden="true"><span style="width:${most ? ((r / most) * 100).toFixed(1) : 0}%"></span></span>`;

function rateTable({ id, title, caption, head, rows }) {
  const most = Math.max(0, ...rows.map((r) => rate(r.errors, r.calls) ?? 0));
  const body = rows
    .map(
      (r) =>
        `<tr><th scope="row">${r.label}</th><td>${count(r.calls)}</td><td>${e(pct(rate(r.errors, r.calls)))}${failBar(rate(r.errors, r.calls) ?? 0, most)}</td><td>${e(pct(rate(r.rejected, r.calls)))}</td></tr>`
    )
    .join('');
  return `<section class="sf-breakdown" id="${id}" aria-labelledby="${id}-title">
            <h3 id="${id}-title">${e(title)}</h3>
            <p class="sf-caption">${caption}</p>
            <table class="sf-table"><thead><tr><th scope="col">${e(head)}</th><th scope="col">Calls</th><th scope="col">Failed</th><th scope="col">Refused</th></tr></thead><tbody>${body}</tbody></table>
          </section>`;
}

/** The tools and commands that failed most often: at least 20 calls and 5 failures, by rate. */
export function stumbles(tools) {
  const sources = [
    ...tools.byTool.filter((t) => t.name !== 'Bash').map((t) => ({ ...t, label: t.name, kind: 'tool' })),
    ...tools.byFamily.map((f) => ({ ...f, label: f.family, kind: 'command' })),
  ];
  return sources
    .filter((s) => s.calls >= 20 && s.errors >= 5)
    .sort((a, b) => b.errors / b.calls - a.errors / a.calls || b.errors - a.errors || (a.label < b.label ? -1 : 1))
    .slice(0, 6);
}

export function toolsHtml(snapshot) {
  const { tools, models } = snapshot.overview;
  if (!tools || !tools.totals.calls)
    return unavailable('Model performance', 'This snapshot has no tool call records: no session in it has a tools table, or the snapshot was made before they were read.');
  const t = tools.totals;
  const kindText = { exit: 'exited non-zero', rejected: 'refused by the harness', denied: 'denied permission', other: 'failed another way' };
  const main = (s) => KINDS.map((k) => k.key).reduce((a, b) => (s[b] > s[a] ? b : a), 'exit');
  const stumbleRows = stumbles(tools)
    .map((s) => {
      const m = main(s);
      return `<tr><th scope="row"><code>${e(s.label)}</code> <span class="sf-muted">${s.kind === 'command' ? 'shell command' : 'tool'}</span></th><td>${count(s.calls)}</td><td>${e(pct(rate(s.errors, s.calls)))}</td><td class="sf-left">${count(
        s[m]
      )} of ${count(s.errors)} ${kindText[m]}</td></tr>`;
    })
    .join('');
  const control =
    models.length > 1
      ? `<fieldset class="sf-measure" data-sf-tool-model hidden><legend class="sf-visually-hidden">Model</legend><label><input type="radio" name="tool-model" value="" checked> All models</label>${tools.byModel
          .map((m) => ({ m, i: models.findIndex((x) => x.id === m.id) }))
          .filter(({ i }) => i !== -1)
          .map(({ m, i }) => `<label><input type="radio" name="tool-model" value="${i}"> ${e(m.label)}</label>`)
          .join('')}</fieldset>`
      : '';
  const modes = tools.byMode;
  return `<p class="sf-eyebrow">Model performance</p>
        <h1 id="sf-tools-title">${e(pct(rate(t.ok, t.calls)))} of ${count(t.calls)} tool calls succeeded</h1>
        <p class="sf-section-lede">Everything an agent does is a tool call: a shell command, a file read, an edit. Of the ${count(t.errors)} that failed, ${count(
          t.exit
        )} ${t.exit === 1 ? 'was a command' : 'were commands'} that ran and exited non-zero, which is often the tool working, as when a test fails. ${count(t.rejected)} ${
          t.rejected === 1 ? 'was a call' : 'were calls'
        } the harness refused, the closest thing here to a model's own slip: ${e(
          pct(rate(t.rejected, t.calls), 2)
        )} of all calls.</p>
        <dl class="sf-figures">${[
          tile('Tool calls', count(t.calls), `${count(t.ok)} succeeded`),
          tile('Exited non-zero', count(t.exit), e(pct(rate(t.exit, t.calls), 2))),
          tile('Refused by the harness', count(t.rejected), e(pct(rate(t.rejected, t.calls), 2))),
          tile('Permission denied', count(t.denied), e(pct(rate(t.denied, t.calls), 2))),
          tile('Other errors', count(t.other), `${count(t.noResult)} with no result recorded`),
          tile('Inside a loop run', pct(rate(modes.runs.calls - modes.runs.errors, modes.runs.calls)), `succeeded; ${e(pct(rate(modes.outside.calls - modes.outside.errors, modes.outside.calls)))} outside one`),
        ].join('')}</dl>
        <p class="sf-coverage">Coverage: ${e(formatCoverage(tools.coverage))} · All time; no filter applies · <a href="${ROUTE}methodology/#def-tool_success">Definition</a></p>
        <div class="sf-subhead"><h2>When they stumbled</h2>${control}</div>
        <div class="sf-subhead sf-subhead-legend">${legendHtml(KINDS)}</div>
        <p class="sf-caption">Share of each day's tool calls that failed, by how. Days are Toronto days; a short mark on the baseline is a day with no tool calls. The data table names each day's largest source of failures.</p>
        <div data-sf-tool-chart>${toolChartHtml(snapshot.overview)}</div>
        ${recoveryHtml(tools)}
        <div class="sf-subhead"><h2>What failures follow, and what they don’t</h2></div>
        <p class="sf-caption">The same failed calls, cut six ways. Each table describes where failures happened; none of them is an experiment.</p>
        <div class="sf-breakdowns sf-tool-tables">
          <section class="sf-breakdown" id="tools-stumbles" aria-labelledby="tools-stumbles-title">
            <h3 id="tools-stumbles-title">Where they stumbled</h3>
            <p class="sf-caption">The tools and shell commands that failed most often, among those with at least 20 calls and 5 failures.</p>
            <table class="sf-table"><thead><tr><th scope="col">Tool or command</th><th scope="col">Calls</th><th scope="col">Failed</th><th scope="col" class="sf-left">Mostly</th></tr></thead><tbody>${
              stumbleRows || '<tr><td colspan="4" class="sf-muted">None with that many calls and failures</td></tr>'
            }</tbody></table>
          </section>
          ${rateTable({
            id: 'tools-by-model',
            title: 'By model',
            caption: 'Raw model ids beside the names. The models did different work, so this is where failures happened, not which model is better.',
            head: 'Model',
            rows: tools.byModel.map((m) => ({ ...m, label: modelName(m, ' class="sf-muted"') })),
          })}
          ${rateTable({
            id: 'tools-by-context',
            title: 'By context size',
            caption: 'The size of the context when the call was made. Short sessions and long ones do different work, so this describes; it does not explain.',
            head: 'Context',
            rows: tools.byContext.map((b) => ({ ...b, label: e(bucket(b)) })),
          })}
          ${rateTable({
            id: 'tools-by-mode',
            title: 'Inside a loop and outside',
            caption: 'Calls made between a recorded run’s start and end, and all the others.',
            head: 'Where',
            rows: [
              { ...modes.runs, label: 'Inside a loop run' },
              { ...modes.outside, label: 'Outside one' },
            ],
          })}
          ${
            tools.byRunHour?.length > 1
              ? rateTable({
                  id: 'tools-by-run-hour',
                  title: 'By time into a run',
                  caption: `Calls made inside a recorded run, by how long it had been going. Under ${plural(tools.byRunHour[0].to, 'hour')} in, ${e(
                    pct(rate(tools.byRunHour[0].errors, tools.byRunHour[0].calls))
                  )} failed; ${plural(tools.byRunHour.at(-1).from, 'hour')} in and later, ${e(pct(rate(tools.byRunHour.at(-1).errors, tools.byRunHour.at(-1).calls)))}.`,
                  head: 'Since the run started',
                  rows: tools.byRunHour.map((b) => ({ ...b, label: e(hourBucket(b)) })),
                })
              : ''
          }
          ${
            tools.byParallel?.length > 1
              ? rateTable({
                  id: 'tools-by-parallel',
                  title: 'By loops running at once',
                  caption: 'Calls made inside a recorded run, by how many recorded runs were under way at that moment.',
                  head: 'Under way',
                  rows: tools.byParallel.map((b) => ({ ...b, label: b.runs === 1 ? 'One loop alone' : `${e(word(b.runs))} at once` })),
                })
              : ''
          }
        </div>`;
}

const hourBucket = (b) => (b.to === null ? `${plural(b.from, 'hour')} and over` : b.from === 0 ? `Under ${plural(b.to, 'hour')}` : `${count(b.from)} to ${plural(b.to, 'hour')}`);

/** What followed a failed call: the next call in its session, and how long failures ran on. */
function recoveryHtml(tools) {
  const r = tools.recovery;
  if (!r || !r.failures) return '';
  const streaks = r.streaks.reduce((t, [, n]) => t + n, 0);
  const alone = r.streaks.find(([length]) => length === 1)?.[1] ?? 0;
  const longest = r.streaks.at(-1)?.[0] ?? 0;
  const list = r.streaks.map(([length, n]) => `${plural(length, 'call')} ${n === 1 ? 'once' : `${count(n)} times`}`).join(', ');
  return `<div class="sf-subhead"><h2>After a failure</h2></div>
        <p class="sf-caption">What the next tool call in the same session did. The trace doesn’t say whether it was a retry. <a href="${ROUTE}methodology/#def-tool_recovery">Definition</a></p>
        <dl class="sf-figures sf-figures-three">${[
          tile('Next call succeeded', pct(rate(r.nextOk, r.failures)), `${count(r.nextOk)} of ${count(r.failures)} failed calls`),
          tile('Failures that stood alone', pct(rate(alone, streaks)), `${count(alone)} of ${plural(streaks, 'streak')} were one call long`),
          tile('Most failures in a row', plural(longest, 'call'), e(`In a row: ${list}`)),
        ].join('')}</dl>`;
}

// --- Code ---------------------------------------------------------------------

const CODE_SERIES = { up: [{ key: 'added', label: 'Lines added' }], down: [{ key: 'removed', label: 'Lines removed' }] };
// Where git blame was read: a day's added lines, by whether they still stand.
const STANDING = { up: [{ key: 'kept', label: 'Still in the tree as written' }, { key: 'gone', label: 'Since rewritten or removed' }] };

const perLineBucket = (b) => (b.to === null ? `${count(b.from)} and over` : b.from === 0 ? `Under ${count(b.to)}` : `${count(b.from)} to ${count(b.to)}`);
const PLOT_SERIES = [
  { key: 'by-loop', label: 'Committed inside a loop run' },
  { key: 'by-person', label: 'Outside one' },
];

/** The spread behind the average: what each change took, and a plot of every change, drawn when opened. */
function perChangeHtml(code) {
  const pc = code.perChange;
  if (!pc || pc.median === null) return '';
  const spent = pc.code.outputTokens + pc.noCode.outputTokens;
  const spread = pc.buckets.reduce((t, b) => t + b.changes, 0);
  const most = Math.max(1, ...pc.buckets.map((b) => b.changes));
  const rows = pc.buckets
    .map(
      (b) =>
        `<tr><th scope="row">${e(perLineBucket(b))}</th><td>${count(b.changes)}<span class="sf-share" aria-hidden="true"><span style="width:${((b.changes / most) * 100).toFixed(1)}%"></span></span></td><td>${count(b.added)}</td><td>${e(
          pct(rate(b.added, pc.code.added))
        )}</td></tr>`
    )
    .join('');
  return `<div class="sf-subhead"><h2>What a change took</h2></div>
        <p class="sf-caption">The average hides a wide spread. Each recorded change has its own commit and its own cost, so the same division can be done change by change. ${
          pc.untaken ? `${plural(pc.untaken, 'change')} that added code had no output tokens given to ${pc.untaken === 1 ? 'it' : 'them'} and ${pc.untaken === 1 ? 'is' : 'are'} left out of the spread. ` : ''
        }<a href="${ROUTE}methodology/#def-tokens_per_change">Definition</a></p>
        <dl class="sf-figures sf-figures-three">${[
          tile('The middle change', `${count(pc.median)} per line`, `one in ten under ${count(pc.p10)}, one in ten over ${count(pc.p90)}`),
          tile('Output tokens that went to code', pct(rate(pc.code.outputTokens, spent)), `${count(pc.code.outputTokens)} of ${count(spent)} given to a change`),
          tile('Changes that added code', `${count(pc.code.changes)} of ${count(pc.code.changes + pc.noCode.changes)}`, `${count(pc.noCode.changes)} touched only docs, briefs or data`),
        ].join('')}</dl>
        <p class="sf-coverage">Coverage: ${e(formatCoverage(pc.coverage))}</p>
        <table class="sf-table sf-spread"><thead><tr><th scope="col">Output tokens per line</th><th scope="col">Changes</th><th scope="col">Lines of code</th><th scope="col">Share of all code</th></tr></thead><tbody>${rows}</tbody></table>
        <details class="sf-data-table sf-change-plot" data-sf-change-plot data-median="${e(pc.median)}">
          <summary>Every change, plotted: ${plural(spread, 'change')} by lines of code and output tokens</summary>
          <div data-sf-change-plot-body><p class="sf-caption">Loaded when opened, from this snapshot's changes.</p></div>
        </details>`;
}

/** Every change that added code and was given output tokens, as a dot: drawn when a reader opens it. */
export function changePlotHtml(records, { median = null } = {}) {
  const own = records.filter((r) => r.codeAdded > 0 && r.outputTokens > 0);
  if (!own.length) return '<p class="sf-muted">No change in this snapshot has both code lines and output tokens.</p>';
  const points = own.map((r) => ({
    x: r.codeAdded,
    y: r.outputTokens,
    key: r.loop ? 'by-loop' : 'by-person',
    href: r.commit ? `${REPO}/commit/${r.commit}` : null,
    tip: `${r.summary} · +${count(r.codeAdded)} lines, ${count(r.outputTokens)} output tokens, ${count(r.outputTokens / r.codeAdded)} per line${r.loop ? ` · ${r.loop}` : ''}`,
  }));
  const inLoop = own.filter((r) => r.loop).length;
  return `<div class="sf-subhead sf-subhead-legend">${legendHtml(PLOT_SERIES)}</div>
          <p class="sf-caption">One dot per change: lines of code added across, output tokens up, both on log scales. ${plural(inLoop, 'dot')} of ${count(own.length)} were committed inside a recorded loop run. ${
            median ? 'Dots above the line took more per line than the middle change. ' : ''
          }A dot opens its commit; <a href="${ROUTE}usage/#explore-changes">Recent changes</a> lists the same records as a table.</p>
          <div class="sf-chart-wrap">${scatterSvg(points, {
            id: 'sf-chart-changes',
            title: 'Output tokens against lines of code added, one dot per change',
            desc: `${own.length} changes. The changes table lists each one.`,
            xLabel: 'Lines of code added',
            yLabel: 'Output tokens',
            guide: median ? { slope: median, label: `${count(median)} per line, the middle change` } : null,
          })}</div>`;
}

/** Lines of code and what they took, campaign by campaign, inside the loops and outside them. */
function codeByLoop(overview) {
  const { loops, code } = overview;
  if (!loops || loops.totals.codeAdded === null || !loops.totals.codeAdded) return '';
  const line = (label, added, tokens, usd, strong = false) =>
    `<tr${strong ? ' class="sf-total"' : ''}><th scope="row">${label}</th><td>${count(added)}</td><td>${added ? count(tokens / added) : 'No data'}</td><td>${added ? e(formatValue((usd / added) * 1000, 'usd')) : 'No data'}</td></tr>`;
  const t = loops.totals;
  const rows = [
    ...loops.campaigns.filter((c) => c.codeAdded).map((c) => line(`<a href="${ROUTE}loops/#loop-${e(c.id)}"><code>${e(c.id)}</code></a>`, c.codeAdded, c.outputTokens, c.usd)),
    line('Inside loop runs', t.codeAdded, t.outputTokens, t.usd, true),
    line('Outside them', code.totals.added - t.codeAdded, code.outputTokens - t.outputTokens, code.usd - t.usd, true),
  ].join('');
  return `<section class="sf-breakdown sf-breakdown-wide" id="code-by-loop" aria-labelledby="code-by-loop-title">
            <h3 id="code-by-loop-title">In a loop and outside</h3>
            <p class="sf-caption"><span class="sf-tag">All time</span> Lines of code in the commits made inside a recorded run, against the output tokens and estimated usage of that run. Outside is everything else: sessions with a person at the keyboard, and the loops that left no record.</p>
            <table class="sf-table"><thead><tr><th scope="col">Where</th><th scope="col">Lines of code added</th><th scope="col">Output tokens per line</th><th scope="col">Usage per 1,000 lines</th></tr></thead><tbody>${rows}</tbody></table>
          </section>`;
}

/** The code chart's points: a day's added lines, split by whether they still stand where git blame was read. */
function codeDays(code) {
  const byDay = new Map(code.daily.rows.map((r) => [r[0], r]));
  // Blamed snapshots split a day's added lines by whether they still stand.
  const blamed = code.daily.rows.length > 0 && code.daily.rows.every((r) => r[4] !== null && r[4] !== undefined);
  const points = code.days.map((day, i) => {
    const r = byDay.get(i);
    if (!r) return { day, up: null, tip: `${formatDay(day)}: no commits` };
    const base = { day, added: r[1], removed: r[2], commits: r[3], kept: blamed ? r[4] : null };
    return blamed
      ? {
          ...base,
          up: [r[4], r[1] - r[4]],
          tip: `${formatDay(day)}: +${count(r[1])} lines of code in ${plural(r[3], 'commit')}; ${count(r[4])} still in the tree as written (${pct(rate(r[4], r[1]))})`,
        }
      : { ...base, up: [r[1]], down: [r[2]], tip: `${formatDay(day)}: +${count(r[1])} and −${count(r[2])} lines of code in ${plural(r[3], 'commit')}` };
  });
  return { points, blamed };
}

/**
 * The lines of code in the repository as /prove-java-change/ counts them:
 * added less removed over the languages the snapshot names, from the first
 * day with a commit to the last. Null for a snapshot without the figure.
 */
export function repositoryFacts(code) {
  const r = code?.repository;
  if (!r || r.lines <= 0 || !code.days.length) return null;
  const names = r.languages.map((id) => code.languages.find((l) => l.id === id)?.label ?? id);
  const said = (list) => (list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list.at(-1)}` : (list[0] ?? ''));
  return {
    lines: r.lines,
    languages: r.languages,
    names: said(names),
    // The languages counted as code and left out of this count.
    others: said(code.languages.filter((l) => !r.languages.includes(l.id)).map((l) => l.label)),
    claim: `From empty to ${count(r.lines)} lines of code in ${plural(code.days.length, 'day')}`,
    range: code.days.length > 1 ? `${formatDay(code.days[0], { year: false })} to ${formatDay(code.days.at(-1))}` : formatDay(code.days[0]),
  };
}

export function codeHtml(snapshot) {
  const { code } = snapshot.overview;
  if (!code)
    return unavailable('Code', 'This snapshot has no code figures. They are counted from the source repository’s git history, which only a snapshot made from a checkout has.');
  const sha = snapshot.manifest.source.sha;
  const { points, blamed } = codeDays(code);
  const dayRows = points
    .map((p) =>
      p.up === null
        ? `<tr><th scope="row"><time datetime="${p.day}">${e(formatDay(p.day))}</time></th><td colspan="${blamed ? 5 : 3}"><span class="sf-muted">No commits</span></td></tr>`
        : `<tr><th scope="row"><time datetime="${p.day}">${e(formatDay(p.day))}</time></th><td>${count(p.commits)}</td><td>${count(p.added)}</td>${
            blamed ? `<td>${count(p.kept)}</td><td>${e(pct(rate(p.kept, p.added)))}</td>` : ''
          }<td>${count(p.removed)}</td></tr>`
    )
    .join('');
  const written = points.filter((p) => p.up !== null && p.added > 0);
  const least = blamed ? written.reduce((a, b) => (a === null || b.kept / b.added < a.kept / a.added ? b : a), null) : null;
  const firstHalf = written.slice(0, Math.ceil(written.length / 2));
  const share = (list) => rate(list.reduce((t, p) => t + p.kept, 0), list.reduce((t, p) => t + p.added, 0));
  const most = Math.max(1, ...code.languages.map((l) => l.added));
  const repo = repositoryFacts(code);
  // With the repository's count, each language also says added less removed, what that count adds up, in place of the share bar.
  const languageRows = code.languages
    .map(
      (l) =>
        `<tr><th scope="row">${e(l.label)}</th><td>${count(l.added)}${
          repo ? '' : `<span class="sf-share" aria-hidden="true"><span style="width:${((l.added / most) * 100).toFixed(1)}%"></span></span>`
        }</td><td>${count(l.removed)}</td>${repo ? `<td>${count(l.added - l.removed)}</td>` : ''}<td>${count(l.inTree)}</td><td>${e(pct(rate(l.inTree, l.added)))}</td></tr>`
    )
    .join('');
  const other = [code.docs, code.data]
    .map((p) => `<tr><th scope="row">${e(p.label)}</th><td>${count(p.added)}</td><td>${count(p.removed)}</td><td>${count(p.inTree)}</td><td>${e(pct(rate(p.inTree, p.added)))}</td></tr>`)
    .join('');
  return `<p class="sf-eyebrow">Code</p>
        <h1 id="sf-code-title">${repo ? e(repo.claim) : `${count(code.totals.added)} lines of code, about ${count(code.tokensPerLine)} output tokens each`}</h1>
        <p class="sf-section-lede">${
          repo
            ? `That is the code in the repository at this revision: lines added less lines removed in ${e(repo.names)} files, ${e(repo.range)}, counted from git and not from what the agents report. In all, ${count(
                code.totals.added
              )} lines of code were added in ${plural(code.languages.length, 'language')} across ${plural(code.commits, 'commit')}, about ${count(code.tokensPerLine)} output tokens for each, and ${e(
                pct(code.retained)
              )} of those lines are still in the tree.`
            : `Counted from git, not from what the agents report: lines added in ${e(
                code.languages
                  .slice(0, 3)
                  .map((l) => l.label)
                  .join(', ')
              )} and ${plural(Math.max(0, code.languages.length - 3), 'other language')} across ${plural(code.commits, 'commit')}. ${e(pct(code.retained))} of those lines are still in the tree.`
        } The token figure is an upper bound: the same tokens also wrote ${count(
          code.docs.added
        )} lines of docs and briefs, every commit message and every command.</p>
        <dl class="sf-figures">${[
          repo ? tile('Lines of code in the repository', count(repo.lines), `added less removed, in ${plural(repo.languages.length, 'language')}`) : '',
          tile('Lines of code added', count(code.totals.added), `${count(code.totals.removed)} removed`),
          tile('Still in the tree', pct(code.retained), `${count(code.totals.inTree)} lines at <code>${e(sha.slice(0, 7))}</code>`),
          tile('Output tokens per line', count(code.tokensPerLine), `${count(code.outputTokens)} output tokens in all`),
          tile('Estimated usage per 1,000 lines', formatValue(code.usdPerLine * 1000, 'usd'), `${e(formatValue(code.usd, 'usd'))} in all`),
        ].join('')}</dl>
        <p class="sf-coverage">Coverage: ${e(formatCoverage(code.coverage))} · All time; no filter applies · <a href="${ROUTE}methodology/#def-code_lines">What counts as code</a></p>
        ${
          blamed
            ? `<div class="sf-subhead"><h2>How much of each day’s code still stands</h2>${legendHtml(STANDING.up)}</div>
        <p class="sf-caption">Lines of code added per day (Toronto), split by whether <code>git blame</code> at <code>${e(sha.slice(0, 7))}</code> still gives them to that day’s commits. ${
          least ? `${e(formatDay(least.day, { year: false }))} was reworked most: ${e(pct(rate(least.kept, least.added)))} of its ${count(least.added)} lines stand. ` : ''
        }Of the code from the first ${plural(firstHalf.length, 'day')} with commits, ${e(pct(share(firstHalf)))} stands. <a href="${ROUTE}methodology/#def-code_surviving">Definition</a></p>`
            : `<div class="sf-subhead"><h2>Code committed per day</h2>${legendHtml([...CODE_SERIES.up, ...CODE_SERIES.down])}</div>
        <p class="sf-caption">Lines of code added, above the line, and removed, below it, by the day of each commit in Toronto. Both use the same scale.</p>`
        }
        <div class="sf-chart-wrap">${columnsSvg(points, {
          id: 'sf-chart-code',
          title: blamed ? 'Lines of code added per day, by whether they still stand' : 'Lines of code added and removed per day',
          series: blamed ? STANDING : CODE_SERIES,
          desc: `${code.daily.rows.length} of ${code.days.length} days with commits.`,
        })}</div>
        <details class="sf-data-table"><summary>Data table</summary><table class="sf-table"><thead><tr><th scope="col">Day (Toronto)</th><th scope="col">Commits</th><th scope="col">Lines added</th>${
          blamed ? '<th scope="col">Still standing</th><th scope="col">Share</th>' : ''
        }<th scope="col">Lines removed that day</th></tr></thead><tbody>${dayRows}</tbody></table></details>
        ${perChangeHtml(code)}
        <div class="sf-subhead"><h2>By language, and by loop</h2></div>
        <div class="sf-breakdowns sf-code-tables">
          <section class="sf-breakdown" id="code-by-language" aria-labelledby="code-by-language-title">
            <h3 id="code-by-language-title">By language</h3>
            <p class="sf-caption"><span class="sf-tag">All time</span> A file's language is its extension. In the tree is the count at <a href="${REPO}/tree/${e(sha)}"><code>${e(sha.slice(0, 7))}</code></a>.${
              repo ? ` Net is added less removed. Over ${e(repo.names)} it is the ${count(repo.lines)} lines of code in the repository${repo.others ? `; ${e(repo.others)} are not in that count` : ''}.` : ''
            }</p>
            <table class="sf-table"><thead><tr><th scope="col">Language</th><th scope="col">Added</th><th scope="col">Removed</th>${repo ? '<th scope="col">Net</th>' : ''}<th scope="col">In the tree</th><th scope="col">Still there</th></tr></thead><tbody>${languageRows}</tbody></table>
          </section>
          <section class="sf-breakdown" id="code-not-code" aria-labelledby="code-not-code-title">
            <h3 id="code-not-code-title">Counted apart, not as code</h3>
            <p class="sf-caption"><span class="sf-tag">All time</span> Prose, and the data the factory generates: results, receipts, logs and its own traces.</p>
            <table class="sf-table"><thead><tr><th scope="col">Kind</th><th scope="col">Added</th><th scope="col">Removed</th><th scope="col">In the tree</th><th scope="col">Still there</th></tr></thead><tbody>${other}</tbody></table>
            <p class="sf-caption">Each recorded change lists its own commit, lines and tokens under <a href="${ROUTE}usage/#explore-changes">Recent changes</a>. GitHub draws its own count of every file, generated data included, as <a href="${REPO}/graphs/code-frequency">code frequency</a>.</p>
          </section>
          ${codeByLoop(snapshot.overview)}
        </div>
        <aside class="sf-note">
          <h2>What this can't say yet</h2>
          <p>${
            blamed
              ? 'How much of a day’s code was later reworked is measured. When, and why, is not: a line replaced an hour later counts the same as one retired on purpose weeks later.'
              : 'Still in the tree is a coarse measure of rework. It can’t tell a line rewritten the next day from one removed on purpose months later.'
          } What review changed isn’t recorded at all, and the source has no pull requests for GitHub to count. The <a href="${ROUTE}methodology/#requests">methodology</a> lists what is asked of the source.</p>
        </aside>`;
}

// --- The overview's findings ----------------------------------------------------

/**
 * One finding: a claim computed from the data, a sentence, three numbers and
 * the chart that carries it, with a link to the page that has everything.
 */
function finding({ id, eyebrow, claim, lede, facts, href, more, legend, chart, caption, wide = false, after = '' }) {
  const head = `<p class="sf-eyebrow">${e(eyebrow)}</p>
            <h2 id="finding-${id}-title"><a href="${href}">${e(claim)}</a></h2>`;
  const numbers = `<dl class="sf-finding-facts">${facts
    .filter(Boolean)
    .map(([value, label]) => `<div><dt>${e(label)}</dt><dd>${e(value)}</dd></div>`)
    .join('')}</dl>
            <p class="sf-finding-more"><a href="${href}">${e(more)}</a></p>`;
  // A wide finding puts its numbers beside its sentence and its figure under both.
  const text = wide
    ? `<header class="sf-finding-head">
            ${head}
          </header>
          <p class="sf-finding-lede">${lede}</p>
          <div class="sf-finding-side">
            ${numbers}
          </div>`
    : `<div class="sf-finding-text">
            ${head}
            <p class="sf-finding-lede">${lede}</p>
            ${numbers}
          </div>`;
  return `<article class="sf-panel sf-finding${wide ? ' sf-finding-wide' : ''}" id="finding-${id}" aria-labelledby="finding-${id}-title">
          ${text}
          <figure class="sf-finding-chart">
            ${legend}
            <div class="sf-chart-wrap">${chart}</div>
            <figcaption class="sf-caption">${caption}</figcaption>
          </figure>${after ? `\n          ${after}` : ''}
        </article>`;
}

function loopsFinding(overview) {
  const { loops } = overview;
  if (!loops || !loops.totals.runs) return '';
  const t = loops.totals;
  const typed = t.prompts.person + t.prompts.interrupt;
  const campaigns = loops.campaigns.length;
  const counts = `${word(campaigns)} ${campaigns === 1 ? 'campaign' : 'campaigns'}, ${plural(t.runs, 'run')}, ${plural(t.cycles, 'cycle')}`;
  // With the source's account the clock has every run of every loop; without it, the runs that left a record.
  const clock = accountClock(overview);
  const floor = floorFigure(clock ?? loops, clock ? { cap: CLOCK_HOURS } : {});
  // The stretch with the most commits carries the claim. With the account it
  // is counted over the loops that write code: the verification loop's
  // commits of results in the same hours are said apart.
  const work = clock ? stretches({ runs: clock.runs.filter((r) => !r.quiet) }) : (floor?.stretches ?? []);
  const best = work.length ? work.reduce((a, b) => (b.commits > a.commits ? b : a)) : null;
  const length = best ? best.to - best.from : 0;
  // A pace is a claim only over enough commits and hours to be one.
  const pace = best && best.commits >= 10 && length >= 2 * HOUR ? Math.round(length / 60e3 / best.commits) : null;
  const peak = Date.parse(loops.peakParallel?.at ?? '');
  const atOnce = !best ? 0 : clock ? mostAtOnce(best.runs) : loops.peakParallel.runs > 1 && peak >= best.from && peak <= best.to ? loops.peakParallel.runs : 0;
  // What the verification loop committed while that stretch ran.
  const results = clock && best ? clock.runs.filter((r) => r.quiet && r.ended && Date.parse(r.started) >= best.from && Date.parse(r.ended) <= best.to).reduce((t, r) => t + r.commits, 0) : 0;
  const from = !best ? '' : clock ? plural(best.loops, 'loop') : best.campaigns === 1 ? 'one campaign' : `${word(best.campaigns).toLowerCase()} campaigns`;
  const drive = loops.drive ? driveFacts(driveDays(overview)) : null;
  const f = loopAccountFacts(overview);
  const facts = [
    drive ? [pct(rate(drive.byLoop, drive.all), 0), 'of all tool calls were set off by a loop’s own prompt'] : [count(t.cycles), `cycles in ${plural(t.runs, 'loop run')}`],
    drive?.first && drive.peak && drive.peak !== drive.first
      ? [count(drive.peak.per), `tool calls per typed prompt on ${shortDay(drive.peak)}, from ${count(drive.first.per)} on ${shortDay(drive.first)}`]
      : loops.longest
        ? [span(loops.longest.seconds), 'the longest run nobody typed into']
        : null,
    f?.totals.commits
      ? [formatValue(f.totals.usd / f.totals.commits, 'usd'), 'estimated usage for each commit made in a loop run']
      : t.commits
        ? [formatValue(t.usd / t.commits, 'usd'), 'estimated usage for each commit']
        : null,
  ];
  return finding({
    id: 'loops',
    eyebrow: 'Feature loops',
    wide: true,
    claim: pace ? `A commit every ${plural(pace, 'minute')} for ${plural(Math.round(length / HOUR), 'hour')}` : `${counts}${typed ? '' : ', no prompt from a person'}`,
    lede: pace
      ? `That is the average from ${e(moment(best.from))} to ${e(moment(best.to))}, Toronto time: ${plural(best.commits, 'commit')} from ${from}, with a loop running for ${count(best.busy / HOUR)} of the ${count(length / HOUR)} hours${
          atOnce > 1 ? ` and up to ${word(atOnce).toLowerCase()} at once` : ''
        }.${results ? ` The verification loop committed proof results ${count(results)} more times in those hours.` : ''}${best.typed ? '' : ' Nobody typed a prompt into any of them.'}${f ? ` In all: ${e(f.counts)}.` : ''}`
      : 'A feature loop gives an agent a written brief and lets it work, cycle after cycle.',
    facts,
    href: `${ROUTE}loops/`,
    more: f ? `All ${plural(f.totals.loops, 'loop')}, and each campaign run by run` : campaigns === 1 ? 'The campaign, run by run' : `All ${word(campaigns).toLowerCase()} campaigns, run by run`,
    legend: floor?.legend ?? '',
    chart: floor?.html ?? '',
    caption: floor?.caption ?? '',
    after: floor?.inspect ?? '',
  });
}

// A cut of the tool calls as bars for the overview: the share that failed in
// each bucket, by how. `short` labels a bar, `long` says it in its tooltip.
const rateBars = (rows, short, long) =>
  rows
    .filter((b) => b.calls)
    .map((b) => ({
      label: short(b),
      value: pct(rate(b.errors, b.calls)),
      rate: b.errors / b.calls,
      parts: KINDS.map((k) => b[k.key] ?? 0),
      tip: `${long(b)}: ${count(b.errors)} of ${count(b.calls)} tool calls failed (${pct(rate(b.errors, b.calls))})`,
    }));
const shortHours = (b) => (b.to === null ? `${b.from} h+` : b.from === 0 ? `<${b.to} h` : `${b.from}–${b.to} h`);
const shortContext = (b) => (b.to === null ? `${b.from / 1000}+` : b.from === 0 ? `<${b.to / 1000}` : `${b.from / 1000}–${b.to / 1000}`);
const contextWords = (b) => {
  const k = (n) => `${n / 1000}K`;
  return b.to === null ? `${k(b.from)} tokens of context and over` : b.from === 0 ? `Under ${k(b.to)} tokens of context` : `${k(b.from)} to ${k(b.to)} tokens of context`;
};
// A streak this short against this many calls is worth a claim; in a handful of calls it is not.
const STREAK_PER_CALLS = 1000;

function toolsFinding(overview) {
  const { tools, loops } = overview;
  if (!tools || !tools.totals.calls) return '';
  const t = tools.totals;
  const r = tools.recovery?.failures ? tools.recovery : null;
  const longest = r?.streaks.at(-1)?.[0] ?? null;
  const streaks = r ? r.streaks.reduce((n, [, times]) => n + times, 0) : 0;
  const alone = r?.streaks.find(([length]) => length === 1)?.[1] ?? 0;
  const byHour = tools.byRunHour?.length > 1 ? tools.byRunHour.filter((b) => b.calls) : [];
  const byContext = tools.byContext?.length > 1 ? tools.byContext.filter((b) => b.calls) : [];
  const groups = [
    byHour.length > 1 ? { title: 'By time into a loop run', bars: rateBars(byHour, shortHours, (b) => `${hourBucket(b)} into a run`) } : null,
    byContext.length > 1 ? { title: 'By context size, in thousands of tokens', bars: rateBars(byContext, shortContext, contextWords) } : null,
  ].filter(Boolean);
  const share = (b) => e(pct(rate(b.errors, b.calls)));
  const ends = (rows) => [rows[0], rows.at(-1)];
  const steady = groups.length > 0 && [byHour, byContext].every((rows) => rows.length < 2 || rate(rows.at(-1).errors, rows.at(-1).calls) <= rate(rows[0].errors, rows[0].calls));
  const said = [
    byHour.length > 1 ? (([first, last]) => `${share(last)} from ${plural(last.from, 'hour')} into a run against ${share(first)} in ${first.to === 1 ? 'the first hour' : `the first ${plural(first.to, 'hour')}`}`)(ends(byHour)) : null,
    byContext.length > 1 ? (([first, last]) => `${share(last)} at ${last.from / 1000}K tokens of context and over against ${share(first)} under ${first.to / 1000}K`)(ends(byContext)) : null,
  ].filter(Boolean);
  // The calls late in a run come from the few runs that lasted that long.
  const late = byHour.length > 1 && loops?.runs ? loops.runs.filter((x) => x.seconds >= byHour.at(-1).from * 3600).length : 0;
  const points = groups.length ? null : toolDays(overview);
  const label = groups.map((g) => `${g.title}: ${g.bars.map((b) => `${b.label.replace('<', 'under ')}, ${b.value}`).join('; ')}`).join('. ');
  return finding({
    id: 'tools',
    eyebrow: 'Model performance',
    claim:
      longest !== null && longest * STREAK_PER_CALLS <= t.calls
        ? `${count(t.calls)} tool calls, never more than ${plural(longest, 'failure')} in a row`
        : `${pct(rate(t.ok, t.calls))} of ${count(t.calls)} tool calls succeeded`,
    lede: `Of the ${count(t.errors)} that failed, ${count(t.exit)} ${t.exit === 1 ? 'was a command' : 'were commands'} that ran and exited non-zero, which is often the tool working, as when a test fails.${
      r ? ` ${count(r.nextOk)} of the ${count(r.failures)} were followed by a call that succeeded.` : ''
    }`,
    facts: [
      [pct(rate(t.ok, t.calls)), 'of tool calls succeeded'],
      [pct(rate(t.rejected, t.calls), 2), 'of calls were refused by the harness'],
      r && streaks ? [`${count(alone)} of ${count(streaks)}`, 'streaks of failures were a single call'] : null,
    ],
    href: `${ROUTE}tools/`,
    more: 'Failures by model, tool and run length',
    legend: legendHtml(KINDS),
    chart: groups.length
      ? ratesHtml(groups, { series: KINDS, label: `Share of tool calls that failed. ${label}. The model performance page has these as tables.` })
      : columnsSvg(points, {
          id: 'sf-chart-tools',
          title: 'Share of tool calls that failed per day, all models',
          series: { up: KINDS },
          unit: 'ratio',
          desc: `${points.filter((p) => p.up !== null).length} of ${points.length} days with tool calls.`,
          table: 'The model performance page lists every day.',
        }),
    caption: groups.length
      ? `Share of tool calls that failed, by how. ${steady ? 'Late in a run or deep in a context it was no higher than at the start' : 'At the ends'}: ${said.join(', and ')}. This says where failures happened and is not an experiment${
          late ? `: the calls ${plural(byHour.at(-1).from, 'hour')} in come from ${plural(late, 'run')}` : ''
        }.`
      : 'Share of each day’s tool calls that failed, by how.',
  });
}

function codeFinding(overview) {
  const { code, loops } = overview;
  if (!code) return '';
  const { points, blamed } = codeDays(code);
  const inLoops = loops?.totals.codeAdded ? loops.totals : null;
  const outside = inLoops ? code.totals.added - inLoops.codeAdded : 0;
  const byLoop =
    inLoops && outside > 0 ? [count(inLoops.outputTokens / inLoops.codeAdded), count((code.outputTokens - inLoops.outputTokens) / outside)] : null;
  // With the repository's count the finding leads with it, as the landing page does; what a line took follows.
  const repo = repositoryFacts(code);
  return finding({
    id: 'code',
    eyebrow: 'Code',
    claim: repo ? repo.claim : `${count(code.totals.added)} lines of code, about ${count(code.tokensPerLine)} output tokens each`,
    lede: repo
      ? `That is the code in the repository at this revision: lines added less lines removed in ${e(repo.names)} files, counted from git and not from what the agents report. In all, ${count(
          code.totals.added
        )} lines of code were added, about ${count(code.tokensPerLine)} output tokens for each${byLoop ? `: ${byLoop[0]} inside a loop run and ${byLoop[1]} outside one` : ''}.`
      : `Counted from git, not from what the agents report.${byLoop ? ` A line took ${byLoop[0]} output tokens inside a loop run and ${byLoop[1]} outside one.` : ''}`,
    facts: [
      [pct(code.retained), 'of the lines added are still in the tree'],
      repo
        ? [count(code.tokensPerLine), `output tokens for each line added${code.perChange?.median ? `; ${count(code.perChange.median)} for the middle change` : ''}`]
        : code.perChange?.median
          ? [count(code.perChange.median), 'output tokens per line for the middle change']
          : [count(code.commits), 'commits counted'],
      [formatValue(code.usdPerLine * 1000, 'usd'), 'estimated usage per 1,000 lines'],
    ],
    href: `${ROUTE}code/`,
    more: 'Rework by day, and what a change took',
    legend: legendHtml(blamed ? STANDING.up : [...CODE_SERIES.up, ...CODE_SERIES.down]),
    chart: columnsSvg(points, {
      id: 'sf-chart-code',
      title: blamed ? 'Lines of code added per day, by whether they still stand' : 'Lines of code added and removed per day',
      series: blamed ? STANDING : CODE_SERIES,
      desc: `${code.daily.rows.length} of ${code.days.length} days with commits.`,
      table: 'The code page lists every day.',
    }),
    caption: blamed
      ? 'Lines of code added per day, split by whether <code>git blame</code> still gives them to that day’s commits.'
      : 'Lines of code added per day, above the line, and removed, below it.',
  });
}

// --- What it took ----------------------------------------------------------------

// The models with the most usage get a hue each, largest first; the rest are drawn together.
const MODEL_HUES = 3;
const tokens = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)} billion` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} million` : count(n));

/**
 * What the model calls read and wrote, all time, from the usage table: token
 * counts by kind, estimated usage, and the figures kept beside it where the
 * snapshot has them: the same calls priced as if nothing were cached, and
 * what Claude Code counted itself. `byModel` has the same counts for each
 * model, largest usage first. Null when the snapshot has no model calls.
 */
export function usageFacts(overview) {
  const { usage, models } = overview;
  if (!usage?.rows?.length) return null;
  const col = (name) => usage.columns.indexOf(name);
  const at = Object.fromEntries(['model', 'calls', 'pricedCalls', 'usd', 'inputTokens', 'cacheReadTokens', 'cacheWriteTokens', 'outputTokens', 'thinkingTokens', 'uncachedUsd'].map((c) => [c, col(c)]));
  // A sum that is null once a row has no value: part of a sum is not the sum.
  const known = (t, v) => (t === null || v == null ? null : t + v);
  const blank = () => ({ calls: 0, priced: 0, usd: 0, fresh: 0, cacheRead: 0, cacheWrite: 0, written: 0, thinking: at.thinkingTokens === -1 ? null : 0, uncached: at.uncachedUsd === -1 ? null : 0 });
  const add = (t, r) => {
    t.calls += r[at.calls];
    t.priced += r[at.pricedCalls];
    t.usd += r[at.usd];
    t.fresh += r[at.inputTokens];
    t.cacheRead += r[at.cacheReadTokens];
    t.cacheWrite += r[at.cacheWriteTokens];
    t.written += r[at.outputTokens];
    t.thinking = known(t.thinking, r[at.thinkingTokens]);
    if (r[at.pricedCalls]) t.uncached = known(t.uncached, r[at.uncachedUsd]);
  };
  const done = (t) => ({ ...t, read: t.fresh + t.cacheRead + t.cacheWrite });
  const all = blank();
  const by = new Map();
  for (const r of usage.rows) {
    add(all, r);
    add(by.get(r[at.model]) ?? by.set(r[at.model], blank()).get(r[at.model]), r);
  }
  if (!all.calls) return null;
  const byModel = [...by]
    .sort((a, b) => b[1].usd - a[1].usd || a[0] - b[0])
    .map(([m, t]) => ({ id: models[m]?.id ?? null, label: models[m]?.label ?? 'A model the snapshot doesn’t name', ...done(t) }));
  return { ...done(all), byModel, reported: overview.reported ?? null, pricingAsOf: overview.pricingAsOf ?? null };
}

/**
 * Estimated usage per day, by model: the series (a model each for the largest,
 * then the others together) and a point for each day of the snapshot.
 */
export function usageDays(overview) {
  const { usage, days, models } = overview;
  const col = (name) => usage.columns.indexOf(name);
  const [iDay, iModel, iUsd] = [col('day'), col('model'), col('usd')];
  const totals = new Map();
  for (const r of usage.rows) totals.set(r[iModel], (totals.get(r[iModel]) ?? 0) + r[iUsd]);
  const ranked = [...totals].filter(([, usd]) => usd > 0).sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([m]) => m);
  const named = ranked.slice(0, MODEL_HUES);
  const rest = ranked.slice(MODEL_HUES);
  const of = (m) => models[m] ?? { id: null, label: 'A model the snapshot doesn’t name' };
  const series = [
    ...named.map((m, i) => ({ key: `model-${i}`, label: of(m).label, id: of(m).id, usd: totals.get(m) })),
    ...(rest.length
      ? [{ key: 'model-rest', label: rest.length === 1 ? of(rest[0]).label : `${word(rest.length)} other models`, id: rest.length === 1 ? of(rest[0]).id : null, usd: rest.reduce((t, m) => t + totals.get(m), 0) }]
      : []),
  ];
  const slot = (m) => (named.includes(m) ? named.indexOf(m) : named.length);
  const cells = new Map();
  for (const r of usage.rows) {
    if (!(r[iUsd] > 0)) continue;
    const c = cells.get(r[iDay]) ?? cells.set(r[iDay], series.map(() => 0)).get(r[iDay]);
    c[slot(r[iModel])] += r[iUsd];
  }
  const points = days.map((day, i) => {
    const c = cells.get(i);
    if (!c) return { day, up: null, tip: `${formatDay(day)}: no model usage` };
    const parts = c.map((usd, k) => (usd > 0 ? `${series[k].label} ${formatValue(usd, 'usd')}` : null)).filter(Boolean);
    return { day, up: c, tip: `${formatDay(day)}: ${formatValue(c.reduce((t, v) => t + v, 0), 'usd')} of estimated usage${parts.length > 1 ? ` (${parts.join(', ')})` : ` (${series[c.findIndex((v) => v > 0)].label})`}` };
  });
  return { series, points };
}

// The kinds of token the figure draws, and the cost figures beside the estimate.
const TOKEN_KINDS = [
  { key: 'cache-read', label: 'Read from cache' },
  { key: 'cache-write', label: 'Read, and written to cache' },
  { key: 'written', label: 'Written: output tokens' },
];

/**
 * The head of the usage page: what the model calls read against what they
 * wrote, what caching did to the price, and what Claude Code counted itself.
 * All time; the page's filters apply to what is under it.
 */
export function usageHtml(snapshot) {
  const { overview } = snapshot;
  const u = usageFacts(overview);
  if (!u) return unavailable('Usage', 'This snapshot has no model calls: no session in it has a metrics file.');
  const usd = (v) => formatValue(v, 'usd');
  const each = u.written ? u.read / u.written : null;
  const asOf = u.pricingAsOf ? ` as of ${formatDay(u.pricingAsOf)}` : '';
  const priced = u.priced > 0;
  const r = u.reported;
  const low = r && r.usd > r.callsUsd;
  const sessions = r ? `${count(r.coverage.included)} of ${count(r.coverage.total)} sessions` : '';
  const definition = `<a href="${ROUTE}methodology/#def-usage_usd">Definition</a>`;

  const tokenRows = [
    {
      label: 'Read',
      value: `${tokens(u.read)} tokens`,
      amount: u.read,
      parts: [
        { key: 'cache-read', amount: u.cacheRead },
        { key: 'cache-write', amount: u.cacheWrite },
        { key: 'fresh', amount: u.fresh },
      ],
      tip: `Read: ${count(u.read)} input tokens. ${count(u.cacheRead)} from cache, ${count(u.cacheWrite)} written to cache, ${count(u.fresh)} neither`,
    },
    { label: 'Written', value: `${tokens(u.written)} tokens`, amount: u.written, key: 'written', tip: `Written: ${count(u.written)} output tokens${u.thinking ? `, ${count(u.thinking)} of them counted as thinking` : ''}` },
  ];
  const priceRows = [
    u.uncached !== null ? { label: 'With nothing cached: a hypothetical', value: usd(u.uncached), amount: u.uncached, key: 'hypothetical', tip: `The same calls priced as if nothing were read from cache: ${usd(u.uncached)}. No call was made that way` } : null,
    { label: 'As recorded: estimated usage', value: usd(u.usd), amount: u.usd, key: 'estimate', tip: `Estimated usage, from the tokens of ${plural(u.priced, 'priced call')}: ${usd(u.usd)}` },
    r ? { label: `Claude Code’s own count, ${sessions}`, value: usd(r.usd), amount: r.usd, key: 'client', tip: `What Claude Code counted itself for ${sessions}: ${usd(r.usd)}. The calls in those sessions’ logs come to ${usd(r.callsUsd)}` } : null,
  ].filter(Boolean);
  const groups = [{ title: 'Tokens', rows: tokenRows, legend: TOKEN_KINDS }, ...(priced && priceRows.length > 1 ? [{ title: `List price${asOf}`, rows: priceRows }] : [])];

  const modelRows = u.byModel
    .map(
      (m) =>
        `<tr><th scope="row">${modelName(m, ' class="sf-muted"')}</th><td>${count(m.calls)}</td><td>${e(tokens(m.read))}</td><td>${e(tokens(m.written))}</td><td>${m.written ? count(m.read / m.written) : '<span class="sf-muted">No data</span>'}</td><td>${e(
          pct(rate(m.cacheRead, m.read))
        )}</td><td>${m.priced ? e(usd(m.usd)) : '<span class="sf-muted">Not priced</span>'}</td>${u.uncached !== null ? `<td>${m.priced && m.uncached !== null ? e(usd(m.uncached)) : '<span class="sf-muted">No data</span>'}</td>` : ''}</tr>`
    )
    .join('');

  return `<p class="sf-eyebrow">Usage</p>
        <h1 id="sf-usage-title">${e(each !== null && each >= 2 ? `${tokens(u.read)} tokens read to write ${tokens(u.written)}` : `${tokens(u.read)} tokens read, ${tokens(u.written)} written`)}</h1>
        <p class="sf-section-lede">Every model call reads its whole context again, so ${plural(u.calls, 'call')} took in ${
          each !== null ? `${count(each)} ${each >= 1.5 ? 'tokens' : 'token'} for each one written` : `${tokens(u.read)} tokens`
        }. ${e(pct(rate(u.cacheRead, u.read)))} of what was read came from cache.${
          priced
            ? ` At list prices${e(asOf)} that is an estimated ${e(usd(u.usd))}${u.uncached !== null ? `; the same calls with nothing cached would be priced at ${e(usd(u.uncached))}` : ''}. It is an estimate, not a bill. ${definition}`
            : ''
        }</p>
        <dl class="sf-figures">${[
          tile('Read per call', count(u.read / u.calls), 'input tokens, on average'),
          tile('Written per call', count(u.written / u.calls), u.thinking !== null && u.written ? `output tokens; ${e(pct(rate(u.thinking, u.written)))} of all output is counted as thinking` : 'output tokens, on average'),
          tile('Read from cache', pct(rate(u.cacheRead, u.read)), `${e(tokens(u.cacheRead))} tokens`),
          tile('Never cached', count(u.fresh), 'input tokens neither read from cache nor written to it'),
        ].join('')}</dl>
        <p class="sf-coverage">Coverage: ${count(u.priced)} of ${count(u.calls)} model calls priced · All time: the filters lower on the page don’t change this part</p>
        <div class="sf-subhead"><h2>Read against written, and the price with and without the cache</h2></div>
        ${scaleHtml(groups, {
          label: `${tokens(u.read)} tokens read against ${tokens(u.written)} written${
            priced && priceRows.length > 1 ? `, and list price: ${priceRows.map((p) => `${p.label} ${p.value}`).join('; ')}` : ''
          }.`,
        })}
        <p class="sf-caption">A group’s bars share one scale. A cache read counts the same context again on every call, so tokens read is not unique text.${
          u.fresh > 0 ? ` ${count(u.fresh)} input ${u.fresh === 1 ? 'token was' : 'tokens were'} never cached: too few to draw.` : ''
        }</p>
        ${
          r
            ? `<aside class="sf-note">
          <h2>${low ? 'The estimate runs low' : 'The client’s own count'}</h2>
          <p>Claude Code writes its own count when a session stops. For the ${sessions} that have one it is ${e(usd(r.usd))}; the calls in those sessions’ logs come to ${e(usd(r.callsUsd))}.${
            low ? ' The source says why: its logs leave out compactions and side calls.' : ''
          } Only the estimate can be split by day, model, change and loop, so these pages use it throughout. <a href="${ROUTE}methodology/#def-reported_usd">How the figures are kept apart</a></p>
        </aside>`
            : ''
        }
        <div class="sf-breakdowns sf-tool-tables">
          <section class="sf-breakdown" id="usage-tokens-by-model" aria-labelledby="usage-tokens-by-model-title">
            <h3 id="usage-tokens-by-model-title">By model</h3>
            <p class="sf-caption">Raw model ids beside the names. The models did different work, so this says where the tokens went, not which model is better.</p>
            <table class="sf-table"><thead><tr><th scope="col">Model</th><th scope="col">Calls</th><th scope="col">Read</th><th scope="col">Written</th><th scope="col">Read per one written</th><th scope="col">From cache</th><th scope="col">Estimated usage</th>${
              u.uncached !== null ? '<th scope="col">With nothing cached</th>' : ''
            }</tr></thead><tbody>${modelRows}</tbody></table>
          </section>
        </div>`;
}

function usageFinding(overview) {
  const { usage, loops, days } = overview;
  const measure = (id) => overview.measures?.find((m) => m.id === id) ?? null;
  const usd = measure('usage_usd');
  if (!usage?.rows?.length || !usd || !(usd.value > 0)) return '';
  const calls = measure('model_calls');
  const cache = measure('cache_reuse');
  const { series, points } = usageDays(overview);
  const top = series[0];
  const spent = points.filter((p) => p.up !== null).length;
  const inLoops = loops?.totals.usd > 0 ? loops.totals.usd : null;
  // The figures kept beside the estimate: what the client counted itself, said
  // where it is the higher of the two, and the same calls with nothing cached.
  const facts = usageFacts(overview);
  const r = facts?.reported ?? null;
  const caution =
    r && r.usd > r.callsUsd
      ? `It is an estimate, not a bill, and it runs low: Claude Code’s own count is ${formatValue(r.usd, 'usd')} for ${count(r.coverage.included)} of the ${count(r.coverage.total)} sessions. Neither counts a person’s time or a machine that ran a proof.`
      : 'It is an estimate, not a bill, and it counts no person’s time and no machine that ran a proof.';
  const uncached = facts?.uncached ?? null;
  const legend = `<ul class="sf-legend">${series
    .map((s) => `<li><span class="sf-swatch sf-series-${s.key}" aria-hidden="true"></span>${modelName(s)}</li>`)
    .join('')}</ul>`;
  return finding({
    id: 'usage',
    eyebrow: 'Usage',
    claim: `Every session on record, for an estimated ${formatValue(usd.value, 'usd')} of model usage`,
    lede: `That is ${calls ? `${plural(calls.value, 'model call')}, ` : ''}${e(formatDay(days[0], { year: false }))} to ${e(formatDay(days.at(-1)))}, priced from ${
      cache?.denominator ? `the ${tokens(cache.denominator)} input tokens they read and the output they wrote` : 'their token counts'
    }, at list prices. ${caution} <a href="${ROUTE}methodology/#def-usage_usd">Definition</a>`,
    facts: [
      cache && cache.value !== null
        ? [pct(cache.value), `of input tokens were read from cache${uncached !== null && uncached > usd.value ? `; without it the same calls come to ${formatValue(uncached, 'usd')}` : ''}`]
        : null,
      top && usd.value ? [pct(top.usd / usd.value), `of it was ${top.label}${top.id ? ` (${top.id})` : ''}`] : null,
      inLoops ? [formatValue(inLoops, 'usd'), 'of it was inside feature loop runs'] : calls ? [count(calls.value), 'model calls'] : null,
    ],
    href: `${ROUTE}usage/`,
    more: 'What was read against what was written, and usage by day, model and effort',
    legend,
    chart: columnsSvg(points, {
      id: 'sf-chart-usage',
      title: 'Estimated model usage per day in US dollars, by model',
      series: { up: series },
      unit: 'usd',
      desc: `${spent} of ${points.length} days with model usage.`,
      table: 'The usage page lists every day.',
    }),
    caption: 'Estimated model usage per day, by model. Where usage went says nothing about which model is better: the models did different work.',
  });
}

// --- Sessions: how long they last ---------------------------------------------

// The source's causes of a cache event, in words: what happened, then what that means.
const CACHE_CAUSES = {
  large_input: ['A large input', 'one input of 20,000 tokens or more, such as a skill or a big tool result'],
  compaction: ['A compaction', 'the session went on from a summary of its context'],
  cache_expired: ['The cache expired', 'the call before was longer ago than the cache keeps an entry'],
  session_start: ['A session started', 'the first call of a session or of a subagent'],
  model_switch: ['The model changed', 'a cache belongs to one model'],
  effort_change: ['The effort level changed', ''],
  unexplained: ['Unexplained', 'the cached context was lost and the log does not say why'],
};
const SESSION_PARTS = [
  { key: 'compacted', label: 'In sessions compacted at least once' },
  { key: 'uncompacted', label: 'In sessions never compacted' },
];

/**
 * What the finding and the usage page both say of how the sessions lasted:
 * the compactions, the sessions that had one set against the rest, the time
 * at work and the largest context. Null for a snapshot without the figure,
 * or one where no session was compacted.
 */
export function enduranceFacts(overview) {
  const en = overview.endurance;
  if (!en?.compactions || !en.compacted.sessions) return null;
  const whole = (k) => en.compacted[k] + en.rest[k];
  const share = (k) => rate(en.compacted[k], whole(k));
  const hoursOf = (k) => `${hours(en.compacted[k])} of ${hours(whole(k))}`;
  const rows = [
    { label: 'Sessions', value: `${count(en.compacted.sessions)} of ${count(en.sessions)}`, share: share('sessions') },
    whole('agentSeconds') ? { label: 'Agent time', value: hoursOf('agentSeconds'), share: share('agentSeconds') } : null,
    whole('toolCalls') ? { label: 'Tool calls', value: `${count(en.compacted.toolCalls)} of ${count(whole('toolCalls'))}`, share: share('toolCalls') } : null,
    whole('usd') ? { label: 'Estimated usage', value: `${formatValue(en.compacted.usd, 'usd')} of ${formatValue(whole('usd'), 'usd')}`, share: share('usd') } : null,
  ].filter(Boolean);
  return {
    en,
    share,
    rows,
    claim: `Sessions compacted their context ${count(en.compactions)} ${en.compactions === 1 ? 'time' : 'times'} and kept working`,
    lede: `When a session’s context grows too large, Claude Code compacts it: what came before is summarised, and the session goes on from the summary. ${count(en.compacted.sessions)} of the ${plural(
      en.sessions,
      'session'
    )} ${en.compacted.sessions === 1 ? 'was' : 'were'} compacted at least once${
      whole('agentSeconds') && whole('usd') ? `, and they hold ${pct(share('agentSeconds'), 0)} of the agent time and ${pct(share('usd'), 0)} of the estimated usage` : ''
    }.`,
  };
}

/** Each quantity as one bar, split between the sessions compacted at least once and the rest. */
function enduranceShares(f) {
  return scaleHtml(
    [
      {
        title: 'Where the work was',
        rows: f.rows.map((r) => ({
          label: r.label,
          value: r.value,
          amount: 1,
          parts: [
            { key: 'compacted', amount: r.share },
            { key: 'uncompacted', amount: 1 - r.share },
          ],
          tip: `${r.label}: ${r.value} in sessions compacted at least once (${pct(r.share, 0)})`,
        })),
        legend: SESSION_PARTS,
      },
    ],
    { label: `The share in sessions compacted at least once: ${f.rows.map((r) => `${r.label.toLowerCase()} ${r.value}`).join('; ')}.` }
  );
}

function enduranceFinding(overview) {
  const f = enduranceFacts(overview);
  if (!f) return '';
  const { en } = f;
  const t = en.time;
  return finding({
    id: 'sessions',
    eyebrow: 'Sessions',
    claim: f.claim,
    lede: `${f.lede} <a href="${ROUTE}methodology/#def-session_endurance">Definition</a>`,
    facts: [
      en.most ? [count(en.most.compactions), `compactions in one session${en.most.agentSeconds ? `, over ${hours(en.most.agentSeconds)} of work` : ''}`] : null,
      t?.agentSeconds ? [hours(t.agentSeconds), `of agent time${t.modelSeconds && t.toolSeconds ? `: a model at work for ${hours(t.modelSeconds)}, a tool for ${hours(t.toolSeconds)}` : ''}`] : null,
      en.peakContext ? [count(en.peakContext.max), 'tokens in one session’s context at its largest'] : null,
    ],
    href: `${ROUTE}usage/#sessions`,
    more: 'Time at work, context, and what made the cache miss',
    legend: '',
    chart: enduranceShares(f),
    caption: 'Each bar is all of one quantity. From the source’s own rollup at this revision.',
  });
}

/**
 * The usage page's part on the sessions: the same claim, the time at work,
 * the largest context, the shares, and what made a call write to the cache
 * anew, by the source's cause.
 */
export function enduranceHtml(snapshot) {
  const f = enduranceFacts(snapshot.overview);
  if (!f) return unavailable('Sessions', 'This snapshot doesn’t say how its sessions lasted: the source’s rollup had no count of compactions at its revision, or none was compacted.');
  const { en } = f;
  const t = en.time;
  const usd = (v) => (v === null ? '<span class="sf-muted">No data</span>' : e(formatValue(v, 'usd')));
  const tiles = [
    t?.agentSeconds ? tile('Agent time', hours(t.agentSeconds), `from a prompt to the end of its turn, over ${plural(en.sessions, 'session')}`) : '',
    t?.modelSeconds ? tile('A model at work', hours(t.modelSeconds), 'at least one model call under way') : '',
    t?.toolSeconds ? tile('A tool at work', hours(t.toolSeconds), 'at least one tool call under way; the two overlap') : '',
    tile('Compactions', count(en.compactions), t?.compactionSeconds ? `${hours(t.compactionSeconds)} spent compacting` : `in ${plural(en.compacted.sessions, 'session')}`),
    en.peakContext ? tile('Largest context', count(en.peakContext.max), `tokens; the median session peaked at ${count(en.peakContext.median)}`) : '',
    en.most ? tile('Most in one session', count(en.most.compactions), `compactions${en.most.agentSeconds ? `, over ${hours(en.most.agentSeconds)} of work` : ''}`) : '',
  ].join('');
  const causes = en.cacheCauses ?? [];
  const sum = (k) => (causes.every((c) => c[k] !== null) ? causes.reduce((n, c) => n + c[k], 0) : null);
  const causeRows = causes
    .map((c) => {
      const [name, means] = CACHE_CAUSES[c.cause] ?? [c.cause, ''];
      return `<tr><th scope="row">${e(name)}${means ? ` <span class="sf-muted">${e(means)}</span>` : ''}</th><td>${count(c.events)}</td><td>${e(tokens(c.tokens))}</td><td>${usd(c.writeUsd)}</td><td>${usd(c.excessUsd)}</td><td>${
        c.rereadUsd ? usd(c.rereadUsd) : '<span class="sf-muted">None</span>'
      }</td></tr>`;
    })
    .join('');
  const top = causes.length ? causes.reduce((a, b) => ((b.excessUsd ?? 0) > (a.excessUsd ?? 0) ? b : a)) : null;
  const cacheTable = causes.length
    ? `<div class="sf-breakdowns sf-tool-tables sf-loop-tables">
          <section class="sf-breakdown" id="cache-events" aria-labelledby="cache-events-title">
            <h3 id="cache-events-title">What made a call write to the cache anew</h3>
            <p class="sf-caption">A cache event is a call that lost its cached context, or wrote 20,000 tokens or more with it intact. The cause is the source’s own. Above a cache read is what the write cost over reading the same tokens from cache${
              top && sum('excessUsd') ? `: ${e(lower(CACHE_CAUSES[top.cause]?.[0] ?? top.cause))} is ${e(formatValue(top.excessUsd, 'usd'))} of ${e(formatValue(sum('excessUsd'), 'usd'))}` : ''
            }. A large input is paid for again by each later call that reads it. <a href="${ROUTE}methodology/#def-cache_events">Definition</a></p>
            <table class="sf-table"><thead><tr><th scope="col">Cause</th><th scope="col">Events</th><th scope="col">Tokens written</th><th scope="col">Cost of the write</th><th scope="col">Above a cache read</th><th scope="col">Read again later</th></tr></thead><tbody>${causeRows}</tbody><tfoot><tr><th scope="row">All</th><td>${count(
              sum('events')
            )}</td><td>${e(tokens(sum('tokens')))}</td><td>${usd(sum('writeUsd'))}</td><td>${usd(sum('excessUsd'))}</td><td>${usd(sum('rereadUsd'))}</td></tr></tfoot></table>
          </section>
        </div>`
    : '';
  return `<p class="sf-eyebrow">Sessions</p>
        <h2 id="sf-sessions-title">${e(f.claim)}</h2>
        <p class="sf-section-lede">${f.lede}${
          en.most
            ? ` One session was compacted ${plural(en.most.compactions, 'time')}${en.most.elapsedSeconds ? ` in ${hours(en.most.elapsedSeconds)} on the clock` : ''}${link(en.most.summaryUrl, 'its summary').replace(/^ · /, ': ')}.`
            : ''
        } <a href="${ROUTE}methodology/#def-session_endurance">Definition</a></p>
        <dl class="sf-figures">${tiles}</dl>
        <p class="sf-coverage">Coverage: ${plural(en.sessions, 'session')} the source’s rollup counts · All time: the filters lower on the page don’t change this part</p>
        ${enduranceShares(f)}
        <p class="sf-caption">Each bar is all of one quantity. A session is one Claude Code conversation, with everything after a compaction.</p>
        ${cacheTable}`;
}

// The verdicts an example can have alone: the first three of the legend's (format.js).
const SINGLE = VERDICTS.slice(0, 3);
const LIBRARY = 'real-world';
// The catalog's own mark for each verdict, as its labels write them.
const MARKS = [
  ['✗', 'violation'],
  ['✓', 'verified'],
  ['⚠', 'unverifiable'],
];
/**
 * The verdicts an example has. Most have the one the catalog gives. Where it
 * gives none, the label may still record a result for each claim with the
 * catalog's marks: those are read, each verdict once, in the legend's order.
 * [] for an example with no result yet.
 */
export function verdictsOf(x) {
  if (SINGLE.some((v) => v.key === x.verdict)) return [x.verdict];
  const label = x.verdictLabel ?? '';
  return MARKS.filter(([mark]) => label.includes(mark)).map(([, key]) => key);
}
/** How an example is counted: by its one verdict, as having more than one, or as not proved yet. */
export function verdictOf(x) {
  const all = verdictsOf(x);
  return all.length > 1 ? 'several' : (all[0] ?? 'none');
}
// A label that records a result carries one of the catalog's own marks.
const hasResult = (x) => verdictsOf(x).length > 0;
const wordOf = (key) => VERDICTS.find((v) => v.key === key);
// The classes of an example's swatch or square: more than one verdict is drawn as its parts.
const verdictParts = (x) => (verdictOf(x) === 'several' ? verdictsOf(x) : null);
const verdictClass = (x) => `sf-verdict-${verdictOf(x)}${verdictParts(x) ? ` sf-parts-${verdictParts(x).join('-')}` : ''}`;
// An example's verdicts in words: "Refuted", "Refuted and established", "Not proved yet".
const verdictWords = (x) => {
  const all = verdictsOf(x);
  if (!all.length) return wordOf('none').label;
  return sentence(all.map((k) => wordOf(k).word).join(all.length > 2 ? ', ' : ' and ').replace(/, ([^,]*)$/, ' and $1'));
};
// The catalog's label, where it says more than the verdict's own name.
const BARE = /^[✓✗⚠]\s*(Violation|Verified|Unverifiable)$/i;
const labelBeside = (x) => (x.verdictLabel && !BARE.test(x.verdictLabel.trim()) ? x.verdictLabel : null);

const SEVERE = ['critical', 'high'];
const WORDS_OF = { 'bug-fix': 'Bug fix', refactor: 'Refactor', feature: 'Feature', cleanup: 'Cleanup', logging: 'Logging', configuration: 'Configuration' };
const sentence = (word) => (word ? word[0].toUpperCase() + word.slice(1) : word);
// The catalog writes code in backticks: shown as code, and escaped either way.
const prose = (text) =>
  String(text)
    .split('`')
    .map((part, i) => (i % 2 ? `<code>${e(part)}</code>` : e(part)))
    .join('');
const exampleUrl = (x, sha) => (x.path ? `${REPO}/tree/${sha}/${x.path}` : null);

const seconds = (s) => (s >= 100 ? `${count(s)} s` : `${Number(s.toFixed(1))} s`);

/**
 * What an example's verdict rests on, as its result file has it: the test
 * task and how it went, then the counterexample (its input, what was expected
 * and what came back) or the trace, and what the attempt took. Drawn as the
 * run record is, since it is a tool's output. '' for a record with none.
 */
function evidenceHtml(x) {
  const ev = x.evidence;
  if (!ev) return '';
  const passed = typeof x.testsPassed === 'boolean' ? x.testsPassed : ev.tests ? ev.tests.failed.length === 0 : null;
  const ce = ev.counterexample;
  const trace = ev.trace;
  const took = [ev.checker ? e(ev.checker) : null, typeof ev.seconds === 'number' ? e(seconds(ev.seconds)) : null].filter(Boolean);
  const rows = [
    ev.tests
      ? [
          'tests',
          `${passed === null ? '' : `<strong class="sf-proof-${passed ? 'passed' : 'failed'}">${passed ? 'passed' : 'failed'}</strong> `}${e(ev.tests.task)}${
            ev.tests.failed.length ? `<span class="sf-proof-note">${ev.tests.failed.map((t) => e(t)).join('<br>')}</span>` : ''
          }`,
        ]
      : null,
    ce ? ['input', e(ce.input)] : null,
    ce && ce.expected !== null ? ['expected', e(ce.expected)] : null,
    ce && ce.actual !== null ? ['got', e(ce.actual)] : null,
    trace?.invariant ? ['breaks', e(trace.invariant)] : null,
    trace ? ['trace', trace.actions.length ? trace.actions.map((a) => e(a)).join(' <span aria-hidden="true">→</span> ') : e(plural(trace.steps, 'step'))] : null,
    trace ? ['explored', `${plural(trace.steps, 'step')} in the trace${trace.states === null ? '' : `, ${plural(trace.states, 'state')} explored`}`] : null,
    took.length ? ['verifier', took.join(' · ')] : null,
  ].filter(Boolean);
  if (!rows.length) return '';
  const more = ce && ce.count > 1 ? `<p class="sf-ledger-total">The first of ${count(ce.count)} counterexamples the result records.</p>` : '';
  return `<div class="sf-ledger sf-proof">
              <div class="sf-ledger-bar"><span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span><code>example ${e(x.id)}: result.json</code></div>
              <div class="sf-ledger-body">
                <dl>${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
                ${more}
              </div>
            </div>`;
}

/**
 * One example's record, shown when a reader picks its square: what it is,
 * the verdict, the catalog's paragraph about it, what the verdict rests on
 * and the catalog's answers, with links to the example and to the change it
 * verifies. `x` is a record of the examples collection.
 */
export function exampleRecordHtml(x, { sha }) {
  const facts = [
    x.testsPassed === null || x.testsPassed === undefined ? null : ['Existing tests on the same patch', x.testsPassed ? 'Passed' : 'Failed'],
    x.severity ? ['Severity if it shipped unnoticed', sentence(x.severity)] : null,
    x.changeKind ? ['Kind of change', WORDS_OF[x.changeKind] ?? sentence(x.changeKind)] : null,
    x.freshness ? ['Verdict at this revision', sentence(x.freshness)] : null,
  ].filter(Boolean);
  const tags = [...(x.tags?.defect ?? []), ...(x.tags?.technique ?? []), ...(x.tags?.domain ?? [])];
  const url = exampleUrl(x, sha);
  const links = `${link(url, 'The example, with its evidence')}${link(x.sourceUrl, 'The change it verifies')}`.replace(/^ · /, '');
  return `<article class="sf-example">
            <p class="sf-example-kicker"><code>${e(x.id)}</code>${x.system ? ` ${e(x.system)}` : ''} · ${x.origin === LIBRARY ? 'A change to a published library' : 'Constructed for the catalog'}</p>
            <h3>${e(x.title)}</h3>
            <p class="sf-example-verdict"><span class="sf-swatch ${verdictClass(x)}" aria-hidden="true"></span><span><strong>${e(verdictWords(x))}</strong>${labelBeside(x) ? ` <span class="sf-example-label">${e(labelBeside(x))}</span>` : ''}${
              x.vacuous ? ' <span class="sf-tag">Vacuous</span>' : ''
            }</span></p>
            ${x.summary ? `<p class="sf-example-summary">${prose(x.summary)}</p>` : ''}
            ${evidenceHtml(x)}
            ${facts.length ? `<dl class="sf-example-facts">${facts.map(([k, v]) => `<div><dt>${e(k)}</dt><dd>${e(v)}</dd></div>`).join('')}</dl>` : ''}
            ${tags.length ? `<p class="sf-example-tags">${tags.map((t) => `<span class="sf-tag">${e(t)}</span>`).join(' ')}</p>` : ''}
            ${links ? `<p class="sf-example-links">${links}</p>` : ''}
          </article>`;
}

/**
 * What the finding and the catalog's page both say of the catalog: its counts
 * and the claim they lead with. `examples` is the records of the examples
 * collection; they name the squares only when they are the snapshot's own
 * (as many as the overview counts). Null for a snapshot with no catalog.
 */
function catalogFacts(snapshot, examples) {
  const { overview, manifest } = snapshot;
  const stock = overview.stocks?.examples;
  if (!stock?.total) return null;
  const n = (key) => stock.verdict?.[key] ?? 0;
  const named = Array.isArray(examples) && examples.length === stock.total ? examples : null;
  // The catalog's own answers, when the snapshot counts them: of the changes
  // the verifier refuted, how many the existing tests passed, and how many it
  // rates severe.
  const answers = overview.catalog ?? null;
  const tests = answers?.tests?.violation ?? null;
  const said = tests ? (tests.passed ?? 0) + (tests.failed ?? 0) : 0;
  const passed = said ? (tests.passed ?? 0) : 0;
  const severity = answers?.severity?.violation ?? null;
  const counts = `${plural(n('violation'), 'change')} refuted and ${count(n('verified'))} established, in a catalog of ${plural(stock.total, 'example')}`;
  // Those with a verdict so far: all but the ones not proved yet.
  const decided = stock.total - n('none');
  const libraries = stock.origin?.[LIBRARY] ?? 0;
  return {
    sha: manifest.source.sha,
    stock,
    n,
    decided,
    named,
    libraries,
    withResult: named ? named.filter((x) => x.origin === LIBRARY && hasResult(x)) : [],
    answers,
    said,
    passed,
    // What the refuted changes come with, when the snapshot counts it: an input, or a trace.
    shown: answers?.counterexamples && answers.counterexamples.input + answers.counterexamples.trace > 0 ? answers.counterexamples : null,
    rated: severity ? Object.values(severity).reduce((t, v) => t + v, 0) : 0,
    severe: severity ? SEVERE.reduce((t, k) => t + (severity[k] ?? 0), 0) : 0,
    counts,
    // The project's own page says it in these words.
    claim: said && passed ? (said === 1 ? 'The one refuted example change had passed its unit tests' : `${count(passed)} of ${count(said)} refuted example changes had passed their unit tests`) : counts,
    legend: `<ul class="sf-legend">${VERDICTS.filter((v) => n(v.key))
      .map((v) => `<li><span class="sf-swatch sf-verdict-${v.key}" aria-hidden="true"></span>${e(v.label)}: ${count(n(v.key))}</li>`)
      .join('')}${named && libraries ? '<li><span class="sf-swatch sf-verdict-none sf-cell-ring" aria-hidden="true"></span>A change to a published library</li>' : ''}</ul>`,
  };
}

const cellTip = (x) => `${x.id} · ${x.system ? `${x.system}: ` : ''}${x.title}. ${verdictWords(x)}${labelBeside(x) ? `: ${labelBeside(x)}` : ''}${x.vacuous ? ' (vacuous)' : ''}`;
const cellOf = (x) => ({ id: x.id, key: verdictOf(x), parts: verdictParts(x), ring: x.origin === LIBRARY, tip: cellTip(x) });
// Those with a verdict so far, said where some examples have none: the project's own page counts them the same way.
const withVerdict = (c) => (c.decided < c.stock.total ? `${count(c.decided)} have a verdict so far; the other ${c.stock.total - c.decided === 1 ? 'one is' : `${count(c.stock.total - c.decided)} are`} prepared or catalogued, and not proved yet. ` : '');
// Without the records the squares are counted from the overview, by verdict, and none is named.
const countedCells = (c) => VERDICTS.flatMap((v) => Array.from({ length: c.n(v.key) }, () => ({ key: v.key, ring: false, tip: v.label })));

/**
 * What the factory makes: the example catalog, a square for each example.
 * `examples` is the records of the examples collection. Without them (a
 * snapshot whose records aren't loaded yet) the squares are counted from the
 * overview and none is named.
 */
function outputFinding(snapshot, examples) {
  const c = catalogFacts(snapshot, examples);
  if (!c) return '';
  const { sha, stock, named, libraries } = c;
  const cells = named ? named.map(cellOf) : countedCells(c);
  const shown = c.withResult;
  const titled = (x) => (exampleUrl(x, sha) ? `<a href="${e(exampleUrl(x, sha))}">${e(x.title)}</a>` : e(x.title));
  const list = shown.length
    ? `<div class="sf-catalog-list">
              <h3>Changes to published libraries with a result so far</h3>
              <ul>${shown
                .slice(0, 6)
                .map((x) => `<li>${x.system ? `<strong>${e(x.system)}</strong> ` : ''}${titled(x)} <span class="sf-catalog-verdict">${e(x.verdictLabel)}</span></li>`)
                .join('')}</ul>
            </div>`
    : '';
  const jobs = snapshot.overview.verification?.rows ?? [];
  const jobsPassed = jobs.filter((r) => r[1] === 0).length;
  const led = c.claim !== c.counts;
  return finding({
    id: 'output',
    eyebrow: 'Output',
    wide: true,
    claim: c.claim,
    lede: `Each example is a code change run through the project’s formal verifier${led ? `: ${c.counts}` : ', with the verdict it gave'}. ${withVerdict(c)}${
      c.said ? 'Most were constructed for the catalog, with the systems and the tests they change. ' : ''
    }An established label is not a claim of a current, non-vacuous proof${
      stock.vacuous ? `: ${plural(stock.vacuous, 'proof')} ${stock.vacuous === 1 ? 'is' : 'are'} recorded as vacuous` : ''
    }. <a href="${ROUTE}methodology/#def-examples_catalog">Definition</a>`,
    facts: [
      // What a refuted change comes with leads when the snapshot counts it; the verification jobs stand in when it doesn't.
      c.shown ? [`${count(c.shown.input + c.shown.trace)} of ${count(c.shown.violations)}`, `refuted changes come with a counterexample: ${count(c.shown.input)} an input, ${count(c.shown.trace)} a trace`] : null,
      c.rated && c.severe ? [`${count(c.severe)} of ${count(c.rated)}`, 'refuted changes the catalog rates high or critical if they shipped unnoticed'] : null,
      libraries ? [count(libraries), `${libraries === 1 ? 'is a change' : 'are changes'} to published libraries${shown.length ? `; ${count(shown.length)} ${shown.length === 1 ? 'has' : 'have'} a result so far` : ''}`] : null,
      !c.shown && jobs.length ? [`${count(jobsPassed)} of ${count(jobs.length)}`, 'verification jobs passed'] : null,
    ],
    href: `${ROUTE}examples/`,
    more: 'The whole catalog, by change, system and defect',
    legend: c.legend,
    chart: catalogHtml(cells),
    caption: `${named ? 'Each square is an example, in the order of the catalog.' : 'Each square is an example, by verdict.'} From <a href="${REPO}/blob/${e(sha)}/examples/README.md">the catalog</a> at this revision.`,
    after: `${named ? inspectHtml('example', c.shown ? 'Pick a square to read what the example changed and the counterexample the verifier found.' : 'Pick a square to read what the example changed and what the verifier found.') : ''}${list}`,
  });
}

// --- The catalog's own page ---------------------------------------------------

const SEVERITY = ['critical', 'high', 'medium', 'low', 'none'];
const lower = (words) => (words ? words[0].toLowerCase() + words.slice(1) : words);
const tally = () => ({ n: 0, violation: 0, verified: 0, unverifiable: 0, several: 0, none: 0, passed: 0, said: 0 });

/**
 * The ways the catalog's page cuts the examples: by verdict, by whether the
 * existing tests passed, by severity, kind of change, system, kind of defect
 * and what a counterexample is (an input, or a model checker's trace). Each value has a token (`kind:0`) that a square of the grid carries,
 * so the page's script can narrow the grid without the records, and counts by
 * verdict; `passed` of `said` are the refuted changes whose tests passed, of those
 * that say. A facet no example has a value for is left out.
 */
export function catalogFacets(examples) {
  const facet = (key, label, all, of, { order = null, words = (v) => v, token = null, group = null } = {}) => {
    const by = new Map();
    for (const x of examples)
      for (const v of of(x)) {
        const t = by.get(v) ?? by.set(v, { value: v, ...tally() }).get(v);
        const verdict = verdictOf(x);
        t.n += 1;
        t[verdict] += 1;
        if (verdict === 'violation' && typeof x.testsPassed === 'boolean') {
          t.said += 1;
          if (x.testsPassed) t.passed += 1;
        }
        if (group) t.group ??= group(x);
      }
    const rank = (v) => (order?.includes(v.value) ? order.indexOf(v.value) : (order?.length ?? 0));
    const values = [...by.values()]
      .sort((a, b) => rank(a) - rank(b) || (order ? 0 : b.n - a.n) || (a.value < b.value ? -1 : 1))
      .map((v, i) => ({ ...v, label: words(v.value), token: token ? token(v.value) : `${key}:${i}` }));
    return { key, label, all, values, of };
  };
  return [
    facet('verdict', 'Verdict', 'Any', (x) => [verdictOf(x)], { order: VERDICTS.map((v) => v.key), words: (v) => VERDICTS.find((k) => k.key === v).label, token: (v) => `verdict:${v}` }),
    facet('tests', 'Existing tests', 'Either', (x) => (typeof x.testsPassed === 'boolean' ? [x.testsPassed ? 'passed' : 'failed'] : []), {
      order: ['passed', 'failed'],
      words: sentence,
      token: (v) => `tests:${v}`,
    }),
    facet('severity', 'Severity', 'Any', (x) => (x.severity ? [x.severity] : []), { order: SEVERITY, words: sentence }),
    facet('kind', 'Kind of change', 'Any', (x) => (x.changeKind ? [x.changeKind] : []), { words: (v) => WORDS_OF[v] ?? sentence(v) }),
    facet('system', 'System', 'Any', (x) => (x.system ? [x.system] : []), { group: (x) => (x.origin === LIBRARY ? 'library' : 'constructed') }),
    facet('defect', 'Kind of defect', 'Any', (x) => x.tags?.defect ?? []),
    facet('shown', 'Counterexample', 'Any', (x) => (x.evidence?.counterexample ? ['input'] : x.evidence?.trace ? ['trace'] : []), {
      order: ['input', 'trace'],
      words: (v) => (v === 'input' ? 'An input' : 'A trace'),
    }),
  ].filter((f) => f.values.length);
}

const LIBRARY_TOKEN = 'origin:library';
const SEVERE_TOKEN = 'severe';
/** The tokens of one example: a value's token in each facet, and whether it is a library change and rated severe. */
function tokensOf(x, facets) {
  return [
    ...facets.flatMap((f) => f.of(x).map((v) => f.values.find((k) => k.value === v).token)),
    x.origin === LIBRARY ? LIBRARY_TOKEN : null,
    SEVERE.includes(x.severity) ? SEVERE_TOKEN : null,
  ].filter(Boolean);
}

/**
 * What the squares still lit say, in a sentence: how many, their verdicts,
 * and what the existing tests did on the refuted changes among them. `matches` is
 * the tokens of each, `total` the squares in all.
 */
export function matchWords(matches, total) {
  const m = matches.length;
  if (m === total) return `Showing all ${plural(total, 'example')}.`;
  if (!m) return `None of the ${plural(total, 'example')} matches.`;
  const has = (...tokens) => matches.filter((f) => tokens.every((t) => f.includes(t))).length;
  const violations = has('verdict:violation');
  const verdicts = VERDICTS.map((v) => (has(`verdict:${v.key}`) ? `${count(has(`verdict:${v.key}`))} ${v.word}` : null)).filter(Boolean);
  const passed = has('verdict:violation', 'tests:passed');
  const said = passed + has('verdict:violation', 'tests:failed');
  const severe = has('verdict:violation', SEVERE_TOKEN);
  const which = said === 1 ? 'the one refuted change' : `${passed === said || !passed ? 'all ' : `${count(passed)} of the `}${count(said)} refuted changes`;
  const tests = said
    ? ` The existing tests ${passed ? 'passed' : 'failed'} on ${which}${said < violations ? ' that say' : ''}${severe ? `; ${count(severe)} ${severe === 1 ? 'is' : 'are'} rated high or critical` : ''}.`
    : '';
  return `${count(m)} of ${plural(total, 'example')}: ${verdicts.join(', ')}.${tests}`;
}

// A row's examples as a bar beside their count: its length is the count, its colours the verdicts.
const splitBar = (v, most) =>
  `<span class="sf-split-box" aria-hidden="true"><span class="sf-split" style="width:${most ? ((v.n / most) * 100).toFixed(1) : 0}%">${VERDICTS.filter((k) => v[k.key])
    .map((k) => `<span class="sf-verdict-${k.key}" style="flex:${v[k.key]}"></span>`) // more than one verdict is striped here, not split
    .join('')}</span></span>`;

/** One cut of the catalog as a table: a row narrows the grid above to its examples. */
function facetTable({ id, title, caption, head, rows }) {
  if (!rows.length) return '';
  const most = Math.max(...rows.map((r) => r.n));
  const body = rows
    .map(
      (r) =>
        `<tr><th scope="row"><a href="#every-example" data-sf-show="${e(r.token)}">${e(r.label)}</a></th><td>${count(r.n)}${splitBar(r, most)}</td><td>${count(r.violation)}</td><td>${
          r.said ? `${count(r.passed)} of ${count(r.said)}` : `<span class="sf-muted">${r.violation ? 'Not said' : 'None refuted'}</span>`
        }</td></tr>`
    )
    .join('');
  return `<section class="sf-breakdown" id="${id}" aria-labelledby="${id}-title">
            <h3 id="${id}-title">${e(title)}</h3>
            <p class="sf-caption">${caption}</p>
            <table class="sf-table"><thead><tr><th scope="col">${e(head)}</th><th scope="col">Examples</th><th scope="col">Refuted</th><th scope="col">Tests passed</th></tr></thead><tbody>${body}</tbody></table>
          </section>`;
}

const DEFECTS_SHOWN = 10;

/**
 * The catalog's own page: the claim, every example as a square that can be
 * narrowed down and picked, and the catalog cut by kind of change, system,
 * kind of defect and severity. `examples` is the records of the examples
 * collection; without them the page has the overview's counts and the
 * squares by verdict, and says what is missing.
 */
export function examplesHtml(snapshot, examples = null) {
  const c = catalogFacts(snapshot, examples);
  if (!c) return unavailable('Example catalog', 'This snapshot has no example catalog: the source had none at its revision.');
  const { sha, stock, n, named, libraries } = c;
  const constructed = stock.origin?.constructed ?? 0;
  const led = c.claim !== c.counts;
  const figures = [
    tile('Examples', count(stock.total), [c.decided < stock.total ? `${count(c.decided)} with a verdict so far` : '', constructed ? `${count(constructed)} constructed for the catalog` : ''].filter(Boolean).join(', ')),
    tile(
      'Refuted',
      count(n('violation')),
      c.shown
        ? `${c.shown.input + c.shown.trace === c.shown.violations ? 'each' : count(c.shown.input + c.shown.trace)} with a counterexample: ${count(c.shown.input)} an input, ${count(c.shown.trace)} a trace`
        : n('unverifiable')
          ? `${count(n('unverifiable'))} more left open`
          : ''
    ),
    tile('Established', count(n('verified')), stock.vacuous ? `${count(stock.vacuous)} recorded as vacuous` : ''),
    c.said ? tile('Unit tests passed on a refuted change', `${count(c.passed)} of ${count(c.said)}`, 'the system’s own unit tests, on the same patch') : '',
    c.rated ? tile('Rated high or critical', `${count(c.severe)} of ${count(c.rated)}`, 'refuted changes, if they shipped unnoticed') : '',
    libraries ? tile('Changes to published libraries', count(libraries), c.withResult.length ? `${count(c.withResult.length)} with a result so far` : '') : '',
  ].join('');
  const head = `<p class="sf-eyebrow">Example catalog</p>
        <h1 id="sf-examples-title">${e(c.claim)}</h1>
        <p class="sf-section-lede">Each example is a code change run through the project’s formal verifier${led ? `: ${c.counts}` : ', with the verdict it gave'}. ${withVerdict(c)}${
          c.said ? 'Most were constructed for the catalog, with the systems and the tests they change, so this describes the catalog and not how often tests miss a defect elsewhere. ' : ''
        }An established label is not a claim of a current, non-vacuous proof.</p>
        <dl class="sf-figures">${figures}</dl>
        <p class="sf-coverage">Coverage: ${e(c.answers ? formatCoverage(c.answers.coverage) : `${count(c.decided)} of ${count(stock.total)} examples with a verdict`)} · A snapshot total; no filter of dates applies · <a href="${ROUTE}methodology/#def-examples_catalog">Definition</a></p>`;
  const source = `From <a href="${REPO}/blob/${e(sha)}/examples/README.md">the catalog</a> at this revision.`;
  if (!named)
    return `${head}
        <div class="sf-subhead" id="every-example"><h2>Every example</h2></div>
        <div class="sf-subhead sf-subhead-legend">${c.legend}</div>
        ${catalogHtml(countedCells(c))}
        <p class="sf-caption">Each square is an example, by verdict. The catalog’s records aren’t at hand, so none is named and nothing is cut further. ${source}</p>`;

  const facets = catalogFacets(named);
  const of = (key) => facets.find((f) => f.key === key);
  const tokens = new Map(named.map((x) => [x.id, tokensOf(x, facets)]));
  const cells = named.map((x) => ({ ...cellOf(x), tokens: tokens.get(x.id) }));
  const option = (v) => `<option value="${e(v.token)}">${e(v.label)} (${count(v.n)})</option>`;
  const options = (f) => {
    if (f.key !== 'system' || !libraries) return f.values.map(option).join('');
    const made = f.values.filter((v) => v.group !== 'library');
    const published = f.values.filter((v) => v.group === 'library');
    return `${made.length ? `<optgroup label="Constructed for the catalog">${made.map(option).join('')}</optgroup>` : ''}<optgroup label="Published libraries"><option value="${LIBRARY_TOKEN}">All of them (${count(libraries)})</option>${published
      .map(option)
      .join('')}</optgroup>`;
  };
  const controls = `<form class="sf-filters sf-facets" data-sf-facets hidden aria-label="Narrow the examples">${facets
    .map((f) => `<label>${e(f.label)} <select name="${f.key}" data-sf-facet><option value="">${e(f.all)}</option>${options(f)}</select></label>`)
    .join('')}<button type="reset" data-sf-facet-reset hidden>Show all</button></form>`;
  // A few places to start: each is a set of tokens the grid narrows to.
  const start = (label, wanted) => (wanted.every(Boolean) ? `<a href="#every-example" data-sf-show="${e(wanted.join(' '))}">${e(label)}</a>` : null);
  const caught = of('tests')?.values.find((v) => v.value === 'failed');
  const critical = of('severity')?.values.find((v) => v.value === 'critical');
  const starts = [
    caught?.violation ? start(`the ${plural(caught.violation, 'refuted change')} the existing tests also caught`, ['verdict:violation', 'tests:failed']) : null,
    critical?.violation ? start(`the ${plural(critical.violation, 'refuted change')} rated critical`, ['verdict:violation', critical.token]) : null,
    libraries ? start(`the ${plural(libraries, 'change')} to published libraries`, [LIBRARY_TOKEN]) : null,
  ].filter(Boolean);
  const titles = `<details class="sf-titles" data-sf-titles>
          <summary>Read them by title: <span data-sf-titles-count>${plural(named.length, 'example')}</span></summary>
          <ol>${named
            .map(
              (x) =>
                `<li data-for="${e(x.id)}"><span class="sf-swatch ${verdictClass(x)}" aria-hidden="true"></span><a href="#example-${encodeURIComponent(x.id)}"><code>${e(x.id)}</code> ${e(x.title)}</a>${
                  x.system ? ` <span class="sf-muted">${e(x.system)}</span>` : ''
                }</li>`
            )
            .join('')}</ol>
        </details>`;

  const kind = of('kind');
  const top = kind?.values[0];
  const system = of('system');
  const made = system ? system.values.filter((v) => v.group !== 'library') : [];
  const published = system ? system.values.filter((v) => v.group === 'library') : [];
  const libraryRow = published.length
    ? [published.reduce((t, v) => Object.fromEntries(Object.keys(tally()).map((k) => [k, t[k] + v[k]])), tally())].map((t) => ({
        ...t,
        label: 'Published libraries',
        token: LIBRARY_TOKEN,
      }))
    : [];
  const defect = of('defect');
  const untagged = named.filter((x) => !(x.tags?.defect ?? []).length).length;
  const severity = of('severity');
  const tables = [
    kind
      ? facetTable({
          id: 'examples-by-kind',
          title: 'By kind of change',
          caption: `What the change set out to do, in the catalog’s words. The largest group is ${e(lower(top.label))}: ${count(top.violation)} of its ${plural(top.n, 'example')} ${top.violation === 1 ? 'is' : 'are'} refuted${
            top.said ? `, and the existing tests passed on ${count(top.passed)} of ${top.said === top.violation ? 'them' : `the ${count(top.said)} that say`}` : ''
          }.`,
          head: 'Kind of change',
          rows: kind.values,
        })
      : '',
    system
      ? facetTable({
          id: 'examples-by-system',
          title: 'By system',
          caption: `${made.length ? `${word(made.length)} ${made.length === 1 ? 'system was' : 'systems were'} written for the catalog. ` : ''}${
            published.length ? `The ${plural(published.length, 'published library', 'published libraries')} ${published.length === 1 ? 'is' : 'are'} open-source code the catalog did not write.` : ''
          }`,
          head: 'System',
          rows: [...made, ...libraryRow],
        })
      : '',
    defect
      ? facetTable({
          id: 'examples-by-defect',
          title: 'By kind of defect',
          caption: `The catalog’s tag for what goes wrong. An example can have several${untagged ? `, and ${count(untagged)} ${untagged === 1 ? 'has' : 'have'} none` : ''}. ${
            defect.values.length > DEFECTS_SHOWN ? `The ${DEFECTS_SHOWN} most common of ${count(defect.values.length)}; the rest are in the list above the squares.` : ''
          }`,
          head: 'Kind of defect',
          rows: defect.values.slice(0, DEFECTS_SHOWN),
        })
      : '',
    severity
      ? facetTable({
          id: 'examples-by-severity',
          title: 'By severity if it shipped unnoticed',
          caption: 'The catalog’s rating of the change, not of the verdict: a change the verifier passed is mostly rated none.',
          head: 'Severity',
          rows: severity.values,
        })
      : '',
  ].filter(Boolean);
  const pending = libraries - c.withResult.length;
  return `${head}
        <div class="sf-subhead" id="every-example"><h2>Every example</h2></div>
        <p class="sf-caption">Each square is an example, in the order of the catalog. Narrow them down, then pick one to read what it changed and what the verifier found.${
          starts.length ? ` <span class="sf-starts" data-sf-starts hidden>Start with ${starts.join(', ').replace(/, ([^,]*)$/, starts.length > 2 ? ', or $1' : ' or $1')}.</span>` : ''
        }</p>
        ${controls}
        <p class="sf-facet-status" data-sf-facet-status role="status" hidden>${e(matchWords(cells.map((x) => x.tokens), cells.length))}</p>
        <div class="sf-subhead sf-subhead-legend">${c.legend}</div>
        ${catalogHtml(cells)}
        <p class="sf-caption">${source}</p>
        ${inspectHtml('example', c.shown ? 'Pick a square to read what the example changed and the counterexample the verifier found.' : 'Pick a square to read what the example changed and what the verifier found.')}
        ${titles}
        ${
          tables.length
            ? `<div class="sf-subhead"><h2>What the catalog is made of</h2></div>
        <p class="sf-caption">The same examples, cut ${lower(word(tables.length))} ways. A bar’s length is the examples in the row and its colours are their verdicts. A row’s name narrows the squares above to its examples. Tests passed is of the refuted changes that say.</p>
        <div class="sf-breakdowns sf-example-tables">
          ${tables.join('\n          ')}
        </div>`
            : ''
        }
        <p class="sf-caption">Every record as a table, with its tags: <a href="${ROUTE}usage/#explore-examples">Examples, under Usage</a>.</p>
        <aside class="sf-note">
          <h2>What this can't say</h2>
          <p>${
            c.said
              ? 'Whether the existing tests passed, and how severe a change would be, are the catalog’s own statements about examples it mostly wrote, tests included. They show what the verifier finds that these tests don’t. They are not a rate at which tests miss defects in other code. '
              : ''
          }${pending > 0 ? `${word(pending)} of the ${plural(libraries, 'change')} to published libraries ${pending === 1 ? 'is' : 'are'} entered in the catalog and not run yet. ` : ''}The <a href="${ROUTE}methodology/#def-examples_catalog">definition</a> says how an example is counted.</p>
        </aside>`;
}

/**
 * The overview under its headline: one finding each for the loops, what they
 * made, the tools, the code and what it all took. `examples` names the
 * catalog's squares when the examples collection is at hand.
 */
export function findingsHtml(snapshot, { examples = null } = {}) {
  const { overview } = snapshot;
  return [loopsFinding(overview), outputFinding(snapshot, examples), toolsFinding(overview), codeFinding(overview), enduranceFinding(overview), usageFinding(overview)].filter(Boolean).join('\n        ');
}
