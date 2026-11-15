// The overview's leading sections: the headline, the feature loops, the tools
// and the code, as HTML strings from a snapshot. Drawn the same way by the
// build (render.mjs) and the browser (app.js, when a newer snapshot or a
// filter changes them). No DOM, no Node APIs.
//
// Each takes the snapshot ({ pointer, manifest, overview }) and returns the
// inside of its section. A snapshot made before these were measured has no
// overview.loops, .tools or .code: each section then says so, and shows no number.

import { columnsSvg, lanesHtml, legendHtml } from './figures.js';
import { escapeHtml as e, formatCoverage, formatDay, formatValue } from './format.js';
import { torontoDay } from './measures-local.js';

const REPO = 'https://github.com/pilifs/in-the-loop';
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
};
export const KINDS = [
  { key: 'exit', label: 'Command exited non-zero' },
  { key: 'rejected', label: 'Refused by the harness' },
  { key: 'denied', label: 'Permission denied' },
  { key: 'other', label: 'Other error' },
];
const MODES = [
  { key: 'runs', label: 'Inside a loop run' },
  { key: 'outside', label: 'Outside one' },
];

const unavailable = (title, why) =>
  `<p class="sf-eyebrow">${e(title)}</p><div class="sf-empty" role="status"><p>${e(why)}</p><p>No numbers are shown rather than numbers that weren't measured.</p></div>`;

const tile = (label, value, note) =>
  `<div class="sf-figure"><dt>${e(label)}</dt><dd><span class="sf-figure-value">${e(value)}</span>${note ? `<span class="sf-figure-note">${note}</span>` : ''}</dd></div>`;

// --- Headline ---------------------------------------------------------------

/** The page's opening: what the loops did, the longest run's own record, and four numbers. */
export function heroHtml(snapshot, { title, lede }) {
  const { loops, tools, code } = snapshot.overview;
  if (!loops || !loops.totals.runs)
    return `<div class="sf-hero sf-hero-plain"><div class="sf-hero-text"><h1>${e(title)}</h1><p class="sf-lede">${e(lede)}</p></div></div>`;
  const t = loops.totals;
  const typed = t.prompts.person + t.prompts.interrupt;
  const headline = `${count(t.toolCalls)} tool calls and ${plural(t.commits, 'commit')} ${
    typed ? `with ${plural(typed, 'prompt')} from a person` : 'without a prompt from a person'
  }`;
  const first = loops.runs[0].started;
  const last = loops.runs.map((r) => r.ended).filter(Boolean).sort().at(-1) ?? first;
  const text = `<div class="sf-hero-text">
          <h1><span class="sf-eyebrow">${e(title)}</span> <span class="sf-headline">${e(headline)}</span></h1>
          <p class="sf-lede">That is what the feature loops in <a href="${REPO}">in-the-loop</a> did in ${plural(t.runs, 'recorded run')}, ${e(
            range(first, last)
          )}. Each loop gives an agent a written brief and lets it work: do the next piece, verify it, commit it, decide whether to go on. ${
            typed ? '' : 'Nobody typed into a session between a run’s start and its end. '
          }These pages show what the loops built, how reliably their tools ran and what a line of code took.</p>
          <p class="sf-hero-links"><a class="sf-button" href="#loops">See the loops</a> <a class="sf-button sf-button-quiet" href="methodology/">How it is measured</a></p>
        </div>`;

  const strip = [
    [hours(t.agentSeconds), `of agent time inside ${plural(t.runs, 'loop run')}`, '#loops'],
    loops.longest ? [span(loops.longest.seconds), 'the longest run nobody typed into', '#loops'] : null,
    [count(loops.peakParallel.runs), `${loops.peakParallel.runs === 1 ? 'loop' : 'loops'} running side by side at the peak`, '#loops'],
    tools ? [pct(rate(tools.totals.ok, tools.totals.calls)), `of ${count(tools.totals.calls)} tool calls succeeded`, '#tools'] : null,
    code?.tokensPerLine ? [count(code.tokensPerLine), 'output tokens per line of code committed', '#code'] : null,
  ].filter(Boolean);

  return `<div class="sf-hero">
        ${text}
        ${ledgerHtml(snapshot)}
      </div>
      <dl class="sf-strip">${strip.map(([value, label, href]) => `<div><dt>${e(label)}</dt><dd><a href="${href}">${e(value)}</a></dd></div>`).join('')}</dl>`;
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
          <figcaption>The longest run nobody typed into, from <a href="${e(record)}">its own record</a>: each line is a cycle that ended in a commit.</figcaption>
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
              <h4><code>${esc(campaign.id)}</code></h4>
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

/** Tool calls per day, inside a recorded run and outside one. */
function shiftFigure(overview) {
  const { loops, days } = overview;
  const byDay = new Map(loops.daily.rows.map((r) => [r[0], r]));
  const points = days.map((day, i) => {
    const r = byDay.get(i);
    if (!r) return { day, up: null, tip: `${formatDay(day)}: no tool calls` };
    const total = r[1] + r[2];
    return { day, up: [r[1], r[2]], tip: `${formatDay(day)}: ${count(r[1])} of ${count(total)} tool calls inside a loop run (${pct(rate(r[1], total), 0)})` };
  });
  const rows = points
    .map((p) =>
      p.up === null
        ? `<tr><th scope="row"><time datetime="${p.day}">${e(formatDay(p.day))}</time></th><td colspan="3"><span class="sf-muted">No tool calls</span></td></tr>`
        : `<tr><th scope="row"><time datetime="${p.day}">${e(formatDay(p.day))}</time></th><td>${count(p.up[0])}</td><td>${count(p.up[1])}</td><td>${e(pct(rate(p.up[0], p.up[0] + p.up[1]), 0))}</td></tr>`
    )
    .join('');
  const firstRun = loops.daily.rows.find((r) => r[1] > 0);
  const since = loops.daily.rows.filter((r) => firstRun && r[0] >= firstRun[0]);
  const share = rate(
    since.reduce((t, r) => t + r[1], 0),
    since.reduce((t, r) => t + r[1] + r[2], 0)
  );
  return `<div class="sf-subhead"><h3>Where the work happens</h3>${legendHtml(MODES)}</div>
          <p class="sf-caption">Tool calls per day (Toronto days), inside a recorded loop run and outside one.${
            firstRun ? ` Since the first recorded run on ${e(formatDay(days[firstRun[0]], { year: false }))}, ${e(pct(share, 0))} of tool calls were made inside a run.` : ''
          } Loops before then left no run record, so their work counts as outside.</p>
          <div class="sf-chart-wrap">${columnsSvg(points, {
            id: 'sf-chart-shift',
            title: 'Tool calls per day, inside a loop run and outside one',
            series: { up: MODES },
            desc: `${loops.daily.rows.length} of ${days.length} days with tool calls.`,
          })}</div>
          <details class="sf-data-table"><summary>Data table</summary><table class="sf-table"><thead><tr><th scope="col">Day (Toronto)</th><th scope="col">Inside a run</th><th scope="col">Outside</th><th scope="col">Share inside</th></tr></thead><tbody>${rows}</tbody></table></details>`;
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
          <h3 id="sf-live-title">Loops running now <span class="sf-tag">Not connected yet</span></h3>
          <p>Everything above comes from runs that have finished and been published. Following a loop while it runs needs a small reporter on the machine the loops run on, which doesn't exist yet. When it does, each active loop will be listed here with its cycle, its last commit and the time since its last output, and a loop that goes quiet will be marked stale, never shown as running.</p>
          ${preview ? livePreview(preview) : ''}
        </aside>`;
}

/** The feature loops section. */
export function loopsHtml(snapshot) {
  const { loops } = snapshot.overview;
  if (!loops || !loops.totals.runs)
    return unavailable('Feature loops', 'This snapshot has no feature loop run records: the source had none at its revision, or the snapshot was made before they were read.');
  const t = loops.totals;
  const typed = t.prompts.person + t.prompts.interrupt;
  const campaigns = loops.campaigns;
  const title = `${word(campaigns.length)} ${campaigns.length === 1 ? 'campaign' : 'campaigns'}, ${plural(t.runs, 'run')}, ${plural(t.cycles, 'cycle')}${typed ? '' : ', nobody at the keyboard'}`;
  const stopped = (loops.outcomes.attention ?? 0) + (loops.outcomes.blocked ?? 0);
  const figures = [
    tile('Runs', count(t.runs), `${plural(t.loops, 'loop')} in ${plural(campaigns.length, 'campaign')}`),
    tile('Cycles', count(t.cycles), `${plural(t.commits, 'commit')}`),
    tile('Model calls', count(t.calls), `${count(t.toolCalls)} tool calls`),
    tile('Prompts from a person', count(typed), `${plural(t.prompts.agent, 'message')} from other agents`),
    tile('Agent time', hours(t.agentSeconds), `${hours(t.runSeconds)} on the clock, runs added up`),
    tile('Estimated usage', formatValue(t.usd, 'usd'), t.commits ? `${e(formatValue(t.usd / t.commits, 'usd'))} per commit` : ''),
  ].join('');
  return `<p class="sf-eyebrow">Feature loops</p>
        <h2 id="sf-loops-title">${e(title)}</h2>
        <p class="sf-section-lede">A feature loop starts one agent session on a written brief. Each cycle it reads the brief again, does the next piece of work, verifies it and commits it, then decides whether to go on. A campaign runs several loops side by side on separate branches, then one more to merge them. ${
          stopped ? `${word(stopped)} of the ${count(t.runs)} runs ended blocked on a person or flagged for one's attention.` : ''
        }</p>
        <dl class="sf-figures">${figures}</dl>
        <p class="sf-coverage">Coverage: ${e(formatCoverage(loops.coverage))} · All time; the filters below don't apply · <a href="methodology/#def-loop_person_prompts">What counts as a prompt from a person</a></p>
        ${shiftFigure(snapshot.overview)}
        <div class="sf-subhead"><h3>Campaign by campaign</h3></div>
        <p class="sf-caption">In the order they ran. At once is the most loops under way together. Failed is the share of tool calls that failed, which is not a failed loop: see the tools below.</p>
        ${campaignTable(campaigns)}
        <div class="sf-subhead"><h3>Each campaign</h3></div>
        <p class="sf-caption">Newest first. A bar is one run on the campaign's own clock; a notch is a cycle's commit. Open a campaign for every run and cycle, with links to its record and its session.</p>
        <div class="sf-campaigns">
          ${[...campaigns].reverse().map((c) => campaignCard(c, loops.runs)).join('\n          ')}
        </div>`;
}

/** A campaign's runs with their cycles, from the loops collection: drawn when a reader opens it. */
export function campaignRunsHtml(records, campaignId) {
  const own = records.filter((r) => r.campaign === campaignId);
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
        <h2 id="sf-tools-title">${e(pct(rate(t.ok, t.calls)))} of ${count(t.calls)} tool calls succeeded</h2>
        <p class="sf-section-lede">Everything an agent does is a tool call: a shell command, a file read, an edit. Of the ${count(t.errors)} that failed, ${count(
          t.exit
        )} were commands that ran and exited non-zero, which is often the tool working, as when a test fails. ${count(t.rejected)} were calls the harness refused, the closest thing here to a model's own slip: ${e(
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
        <p class="sf-coverage">Coverage: ${e(formatCoverage(tools.coverage))} · All time; the filters below don't apply · <a href="methodology/#def-tool_success">Definition</a></p>
        <div class="sf-subhead"><h3>When they stumbled</h3>${control}</div>
        <div class="sf-subhead sf-subhead-legend">${legendHtml(KINDS)}</div>
        <p class="sf-caption">Share of each day's tool calls that failed, by how. Days are Toronto days; a short mark on the baseline is a day with no tool calls. The data table names each day's largest source of failures.</p>
        <div data-sf-tool-chart>${toolChartHtml(snapshot.overview)}</div>
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
            rows: tools.byModel.map((m) => ({ ...m, label: `${e(m.label)} <code class="sf-muted">${e(m.id)}</code>` })),
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
        </div>`;
}

// --- Code ---------------------------------------------------------------------

const CODE_SERIES = { up: [{ key: 'added', label: 'Lines added' }], down: [{ key: 'removed', label: 'Lines removed' }] };

export function codeHtml(snapshot) {
  const { code } = snapshot.overview;
  if (!code)
    return unavailable('Code', 'This snapshot has no code figures. They are counted from the source repository’s git history, which only a snapshot made from a checkout has.');
  const sha = snapshot.manifest.source.sha;
  const byDay = new Map(code.daily.rows.map((r) => [r[0], r]));
  const points = code.days.map((day, i) => {
    const r = byDay.get(i);
    return r
      ? { day, up: [r[1]], down: [r[2]], commits: r[3], tip: `${formatDay(day)}: +${count(r[1])} and −${count(r[2])} lines of code in ${plural(r[3], 'commit')}` }
      : { day, up: null, tip: `${formatDay(day)}: no commits` };
  });
  const dayRows = points
    .map((p) =>
      p.up === null
        ? `<tr><th scope="row"><time datetime="${p.day}">${e(formatDay(p.day))}</time></th><td colspan="3"><span class="sf-muted">No commits</span></td></tr>`
        : `<tr><th scope="row"><time datetime="${p.day}">${e(formatDay(p.day))}</time></th><td>${count(p.commits)}</td><td>${count(p.up[0])}</td><td>${count(p.down[0])}</td></tr>`
    )
    .join('');
  const most = Math.max(1, ...code.languages.map((l) => l.added));
  const languageRows = code.languages
    .map(
      (l) =>
        `<tr><th scope="row">${e(l.label)}</th><td>${count(l.added)}<span class="sf-share" aria-hidden="true"><span style="width:${((l.added / most) * 100).toFixed(1)}%"></span></span></td><td>${count(l.removed)}</td><td>${count(
          l.inTree
        )}</td><td>${e(pct(rate(l.inTree, l.added)))}</td></tr>`
    )
    .join('');
  const other = [code.docs, code.data]
    .map((p) => `<tr><th scope="row">${e(p.label)}</th><td>${count(p.added)}</td><td>${count(p.removed)}</td><td>${count(p.inTree)}</td><td>${e(pct(rate(p.inTree, p.added)))}</td></tr>`)
    .join('');
  return `<p class="sf-eyebrow">Code</p>
        <h2 id="sf-code-title">${count(code.totals.added)} lines of code, about ${count(code.tokensPerLine)} output tokens each</h2>
        <p class="sf-section-lede">Counted from git, not from what the agents report: lines added in ${e(
          code.languages
            .slice(0, 3)
            .map((l) => l.label)
            .join(', ')
        )} and ${plural(Math.max(0, code.languages.length - 3), 'other language')} across ${plural(code.commits, 'commit')}. ${e(pct(code.retained))} of those lines are still in the tree. The token figure is an upper bound: the same tokens also wrote ${count(
          code.docs.added
        )} lines of docs and briefs, every commit message and every command.</p>
        <dl class="sf-figures">${[
          tile('Lines of code added', count(code.totals.added), `${count(code.totals.removed)} removed`),
          tile('Still in the tree', pct(code.retained), `${count(code.totals.inTree)} lines at <code>${e(sha.slice(0, 7))}</code>`),
          tile('Output tokens per line', count(code.tokensPerLine), `${count(code.outputTokens)} output tokens in all`),
          tile('Estimated usage per 1,000 lines', formatValue(code.usdPerLine * 1000, 'usd'), `${e(formatValue(code.usd, 'usd'))} in all`),
        ].join('')}</dl>
        <p class="sf-coverage">Coverage: ${e(formatCoverage(code.coverage))} · All time; the filters below don't apply · <a href="methodology/#def-code_lines">What counts as code</a></p>
        <div class="sf-subhead"><h3>Code committed per day</h3>${legendHtml([...CODE_SERIES.up, ...CODE_SERIES.down])}</div>
        <p class="sf-caption">Lines of code added, above the line, and removed, below it, by the day of each commit in Toronto. Both use the same scale.</p>
        <div class="sf-chart-wrap">${columnsSvg(points, {
          id: 'sf-chart-code',
          title: 'Lines of code added and removed per day',
          series: CODE_SERIES,
          desc: `${code.daily.rows.length} of ${code.days.length} days with commits.`,
        })}</div>
        <details class="sf-data-table"><summary>Data table</summary><table class="sf-table"><thead><tr><th scope="col">Day (Toronto)</th><th scope="col">Commits</th><th scope="col">Lines added</th><th scope="col">Lines removed</th></tr></thead><tbody>${dayRows}</tbody></table></details>
        <div class="sf-breakdowns sf-code-tables">
          <section class="sf-breakdown" id="code-by-language" aria-labelledby="code-by-language-title">
            <h3 id="code-by-language-title">By language</h3>
            <p class="sf-caption"><span class="sf-tag">All time</span> A file's language is its extension. In the tree is the count at <a href="${REPO}/tree/${e(sha)}"><code>${e(sha.slice(0, 7))}</code></a>.</p>
            <table class="sf-table"><thead><tr><th scope="col">Language</th><th scope="col">Added</th><th scope="col">Removed</th><th scope="col">In the tree</th><th scope="col">Still there</th></tr></thead><tbody>${languageRows}</tbody></table>
          </section>
          <section class="sf-breakdown" id="code-not-code" aria-labelledby="code-not-code-title">
            <h3 id="code-not-code-title">Counted apart, not as code</h3>
            <p class="sf-caption"><span class="sf-tag">All time</span> Prose, and the data the factory generates: results, receipts, logs and its own traces.</p>
            <table class="sf-table"><thead><tr><th scope="col">Kind</th><th scope="col">Added</th><th scope="col">Removed</th><th scope="col">In the tree</th><th scope="col">Still there</th></tr></thead><tbody>${other}</tbody></table>
            <p class="sf-caption">Each recorded change lists its own commit, lines and tokens under <a href="#explore-changes">Recent changes</a>.</p>
          </section>
        </div>
        <aside class="sf-note">
          <h3>What this can't say yet</h3>
          <p>Still in the tree is a coarse measure of rework. It can't tell a line rewritten the next day from one removed on purpose months later. Rework by line age, and what review changed, need git blame and pull request data that no snapshot has yet. The <a href="methodology/#requests">methodology</a> lists what is asked of the source.</p>
        </aside>`;
}
