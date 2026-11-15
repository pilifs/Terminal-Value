// The section's leading pieces as HTML strings from a snapshot: the overview's
// headline and its four findings, and the feature loops, tools and code pages
// they open. Drawn the same way by the build (render.mjs) and the browser
// (app.js, when a newer snapshot or a filter changes them). No DOM, no Node APIs.
//
// Each takes the snapshot ({ pointer, manifest, overview }) and returns the
// inside of its section. A snapshot made before these were measured has no
// overview.loops, .tools or .code: each section then says so, and shows no number.

import { catalogHtml, columnsSvg, floorHtml, lanesHtml, legendHtml, scatterSvg } from './figures.js';
import { escapeHtml as e, formatCoverage, formatDay, formatValue } from './format.js';
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
};
export const KINDS = [
  { key: 'exit', label: 'Command exited non-zero' },
  { key: 'rejected', label: 'Refused by the harness' },
  { key: 'denied', label: 'Permission denied' },
  { key: 'other', label: 'Other error' },
];

const unavailable = (title, why) =>
  `<p class="sf-eyebrow">${e(title)}</p><div class="sf-empty" role="status"><p>${e(why)}</p><p>No numbers are shown rather than numbers that weren't measured.</p></div>`;

const tile = (label, value, note) =>
  `<div class="sf-figure"><dt>${e(label)}</dt><dd><span class="sf-figure-value">${e(value)}</span>${note ? `<span class="sf-figure-note">${note}</span>` : ''}</dd></div>`;

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

const HOUR = 3600e3;
const PAUSE = 6 * HOUR; // with no loop running for longer than this, the floor's clock is cut
const FLOOR_HOURS = 120; // the newest stretches the floor shows add up to about this much
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
    typed: s.runs.reduce((t, r) => t + (r.person ?? 0), 0),
  }));
}

/**
 * Every run on one clock. A campaign takes a block of rows: a row for each of
 * its loops, the one that merges the others last. Campaigns under way at the
 * same time get blocks under each other.
 */
function floorFigure(loops) {
  const all = stretches(loops);
  if (!all.length) return null;
  // The newest stretches, as many as fit; the newest always does.
  const shown = [];
  for (const s of all.toReversed()) {
    if (shown.length && shown.reduce((t, q) => t + q.to - q.from, 0) + s.to - s.from > FLOOR_HOURS * HOUR) break;
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
    const from = Math.min(...own.map((r) => r.from));
    const to = Math.max(...own.map((r) => r.to));
    let base = 0;
    while (blocks.some((b) => b.from < to && from < b.to && base < b.base + b.rows && b.base < base + mine.length)) base++;
    blocks.push({ id: c.id, from, to, base, rows: mine.length });
    mine.forEach((loop, i) => rowOf.set(loop, base + i));
  }
  blocks.sort((a, b) => a.from - b.from);

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
      tip: `${r.loop}, from ${moment(r.from)}: ${plural(r.cycles, 'cycle')} and ${plural(r.commits, 'commit')} in ${span(r.seconds)}. ${OUTCOMES[r.outcome] ?? r.outcome}.`,
    })),
    names: blocks.map((b, i) => {
      const next = blocks.slice(i + 1).find((n) => n.from > b.from && panelOf(n.from) === panelOf(b.from));
      return { at: b.from, until: next ? next.from : panelOf(b.from).to, label: b.id, href: `${ROUTE}loops/#loop-${b.id}` };
    }),
  });
  const legend = `<ul class="sf-legend sf-floor-legend">
              <li><span class="sf-swatch sf-swatch-run" aria-hidden="true"></span>A run, with a notch for each cycle’s commit</li>${
                flagged ? `\n              <li><span class="sf-swatch sf-swatch-asked" aria-hidden="true"></span>Ended blocked on a person, or flagged for one</li>` : ''
              }
              <li><span class="sf-swatch sf-swatch-night" aria-hidden="true"></span>${e(clockWords({ hour: NIGHT.from, minute: 0 }))} to ${e(clockWords({ hour: NIGHT.to, minute: 0 }))} in Toronto</li>
            </ul>`;
  const cut = panels.length > 1 ? ` The clock skips ${panels.length === 2 ? `the ${lull(panels[1].from - panels[0].to)}` : 'each pause of more than six hours'} when no loop ran.` : '';
  const partial = shown.length < all.length ? ` Runs before ${e(dayYear(shown[0].from))} are on the feature loops page.` : '';
  // Where a picked run's record is shown. Hidden until the page's script is there to fill it.
  const inspect = `<div class="sf-inspect" data-sf-inspect hidden>
            <div class="sf-inspect-bar">
              <p class="sf-inspect-at" data-sf-inspect-at role="status">Pick a run on the clock to read its record, cycle by cycle.</p>
              <p class="sf-inspect-steps"><button type="button" data-sf-step="-1" hidden>Earlier run</button><button type="button" data-sf-step="1">Show the first run</button><button type="button" data-sf-step="0" hidden>Close</button></p>
            </div>
            <div data-sf-inspect-body></div>
          </div>`;
  return {
    html,
    legend,
    inspect,
    ids: new Set(runs.map((r) => r.id)),
    stretches: all,
    runs: runs.length,
    caption: `${shown.length < all.length ? `${plural(runs.length, 'loop run')}` : `Every loop run`}, ${e(range(shown[0].from, shown.at(-1).to))}, on one clock. Rows are loops working at the same time on separate branches; the last row of a campaign is the loop that merges the others.${cut}${partial}`,
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
function floorSection(loops) {
  const floor = floorFigure(loops);
  if (!floor) return '';
  return `<div class="sf-subhead"><h2>Every run on one clock</h2></div>
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

/**
 * One run's record, shown when a reader picks the run on the floor: every
 * cycle by its own summary, what the run took, and how it ended. `r` is a
 * record of the loops collection; models is overview.models, for the names.
 */
export function runRecordHtml(r, { models = [] } = {}) {
  const started = Date.parse(r.started);
  const label = models.find((m) => m.id === r.model)?.label;
  const typed = r.prompts ? r.prompts.person + r.prompts.interrupt : null;
  const lines = r.cycles
    .map(
      (c) =>
        `<li><span class="sf-ledger-time">${into((Date.parse(c.at) - started) / 1000)}</span><span class="sf-ledger-cycle">cycle ${e(c.n)}</span><span class="sf-ledger-text">${e(c.summary)}${
          c.decision === 'stop' ? ' <span class="sf-ledger-stop">decided to stop</span>' : ''
        }</span></li>`
    )
    .join('\n              ');
  const took = [
    `<strong>${plural(r.cycles.length, 'cycle')}</strong>`,
    plural(r.commits, 'commit'),
    r.toolCalls === null || r.toolCalls === undefined ? null : `${count(r.toolCalls)} tool calls`,
    r.seconds === null ? null : `<strong>${e(span(r.seconds))}</strong>`,
    r.usd === null || r.usd === undefined ? null : `${e(formatValue(r.usd, 'usd'))} estimated usage`,
    r.codeAdded ? `+${count(r.codeAdded)} lines of code` : null,
  ].filter(Boolean);
  const ended = [typed === null ? null : `${plural(typed, 'prompt')} from a person, start to end`, e(OUTCOMES[r.outcome] ?? r.outcome)].filter(Boolean);
  const links = `${link(r.recordUrl, 'Run record')}${link(r.summaryUrl, 'Session summary')}`.replace(/^ · /, '');
  return `<div class="sf-ledger sf-ledger-full">
            <div class="sf-ledger-bar"><span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span><code>feature loop: ${e(r.loop)}</code></div>
            <div class="sf-ledger-body">
              <p class="sf-ledger-meta">started ${e(dayYear(r.started))}, ${e(clockWords(torontoClock(started)))} · ${label ? `${e(label)} (<code>${e(r.model)}</code>)` : `<code>${e(r.model)}</code>`}, ${e(r.effort)} effort</p>
              <ol>
              ${lines || '<li class="sf-ledger-more"><span class="sf-ledger-time"></span><span class="sf-ledger-cycle"></span><span class="sf-ledger-text">No cycle committed.</span></li>'}
              </ol>
              <p class="sf-ledger-total">${took.join(' · ')}<br>${ended.join(' · ')}</p>
            </div>
            <p class="sf-ledger-note">Each line is a cycle, by the summary line of its own commit.${links ? ` ${links}` : ''}</p>
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
        <h1 id="sf-code-title">${count(code.totals.added)} lines of code, about ${count(code.tokensPerLine)} output tokens each</h1>
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
            <p class="sf-caption"><span class="sf-tag">All time</span> A file's language is its extension. In the tree is the count at <a href="${REPO}/tree/${e(sha)}"><code>${e(sha.slice(0, 7))}</code></a>.</p>
            <table class="sf-table"><thead><tr><th scope="col">Language</th><th scope="col">Added</th><th scope="col">Removed</th><th scope="col">In the tree</th><th scope="col">Still there</th></tr></thead><tbody>${languageRows}</tbody></table>
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
  const floor = floorFigure(loops);
  // The stretch with the most commits carries the claim.
  const best = floor?.stretches.reduce((a, b) => (b.commits > a.commits ? b : a)) ?? null;
  const length = best ? best.to - best.from : 0;
  // A pace is a claim only over enough commits and hours to be one.
  const pace = best && best.commits >= 10 && length >= 2 * HOUR ? Math.round(length / 60e3 / best.commits) : null;
  const peak = Date.parse(loops.peakParallel?.at ?? '');
  const peakHere = best && loops.peakParallel.runs > 1 && peak >= best.from && peak <= best.to;
  const drive = loops.drive ? driveFacts(driveDays(overview)) : null;
  const facts = [
    drive ? [pct(rate(drive.byLoop, drive.all), 0), 'of all tool calls were set off by a loop’s own prompt'] : [count(t.cycles), `cycles in ${plural(t.runs, 'loop run')}`],
    drive?.first && drive.peak && drive.peak !== drive.first
      ? [count(drive.peak.per), `tool calls per typed prompt on ${shortDay(drive.peak)}, from ${count(drive.first.per)} on ${shortDay(drive.first)}`]
      : loops.longest
        ? [span(loops.longest.seconds), 'the longest run nobody typed into']
        : null,
    t.commits ? [formatValue(t.usd / t.commits, 'usd'), 'estimated usage for each commit'] : null,
  ];
  return finding({
    id: 'loops',
    eyebrow: 'Feature loops',
    wide: true,
    claim: pace ? `A commit every ${plural(pace, 'minute')} for ${plural(Math.round(length / HOUR), 'hour')}` : `${counts}${typed ? '' : ', no prompt from a person'}`,
    lede: pace
      ? `That is the average from ${e(moment(best.from))} to ${e(moment(best.to))}, Toronto time: ${plural(best.commits, 'commit')} from ${
          best.campaigns === 1 ? 'one campaign' : `${word(best.campaigns).toLowerCase()} campaigns`
        }, with a loop running for ${count(best.busy / HOUR)} of the ${count(length / HOUR)} hours${peakHere ? ` and up to ${word(loops.peakParallel.runs).toLowerCase()} at once` : ''}.${
          best.typed ? '' : ' Nobody typed a prompt into any of them.'
        }`
      : 'A feature loop gives an agent a written brief and lets it work, cycle after cycle.',
    facts,
    href: `${ROUTE}loops/`,
    more: campaigns === 1 ? 'The campaign, run by run' : `All ${word(campaigns).toLowerCase()} campaigns, run by run`,
    legend: floor?.legend ?? '',
    chart: floor?.html ?? '',
    caption: floor?.caption ?? '',
    after: floor?.inspect ?? '',
  });
}

function toolsFinding(overview) {
  const { tools } = overview;
  if (!tools || !tools.totals.calls) return '';
  const t = tools.totals;
  const r = tools.recovery?.failures ? tools.recovery : null;
  const hoursIn = tools.byRunHour?.length > 1 ? [tools.byRunHour[0], tools.byRunHour.at(-1)] : null;
  const points = toolDays(overview);
  return finding({
    id: 'tools',
    eyebrow: 'Model performance',
    claim: `${pct(rate(t.ok, t.calls))} of ${count(t.calls)} tool calls succeeded`,
    lede: `Of the ${count(t.errors)} that failed, ${count(t.exit)} ${t.exit === 1 ? 'was a command' : 'were commands'} that ran and exited non-zero, which is often the tool working, as when a test fails.${
      hoursIn
        ? ` In a run’s first ${hoursIn[0].to === 1 ? 'hour' : plural(hoursIn[0].to, 'hour')}, ${e(pct(rate(hoursIn[0].errors, hoursIn[0].calls)))} of calls failed; ${plural(hoursIn[1].from, 'hour')} in and later, ${e(
            pct(rate(hoursIn[1].errors, hoursIn[1].calls))
          )}.`
        : ''
    }`,
    facts: [
      r ? [pct(rate(r.nextOk, r.failures)), 'of failures were followed by a call that succeeded'] : [count(t.errors), 'tool calls failed'],
      [pct(rate(t.rejected, t.calls), 2), 'of calls were refused by the harness'],
      r?.streaks.length ? [plural(r.streaks.at(-1)[0], 'call'), 'the most failures in a row'] : null,
    ],
    href: `${ROUTE}tools/`,
    more: 'Failures by model, tool and run length',
    legend: legendHtml(KINDS),
    chart: columnsSvg(points, {
      id: 'sf-chart-tools',
      title: 'Share of tool calls that failed per day, all models',
      series: { up: KINDS },
      unit: 'ratio',
      desc: `${points.filter((p) => p.up !== null).length} of ${points.length} days with tool calls.`,
      table: 'The model performance page lists every day.',
    }),
    caption: 'Share of each day’s tool calls that failed, by how.',
  });
}

function codeFinding(overview) {
  const { code, loops } = overview;
  if (!code) return '';
  const { points, blamed } = codeDays(code);
  const inLoops = loops?.totals.codeAdded ? loops.totals : null;
  const outside = inLoops ? code.totals.added - inLoops.codeAdded : 0;
  return finding({
    id: 'code',
    eyebrow: 'Code',
    claim: `${count(code.totals.added)} lines of code, about ${count(code.tokensPerLine)} output tokens each`,
    lede: `Counted from git, not from what the agents report.${
      inLoops && outside > 0
        ? ` A line took ${count(inLoops.outputTokens / inLoops.codeAdded)} output tokens inside a loop run and ${count((code.outputTokens - inLoops.outputTokens) / outside)} outside one.`
        : ''
    }`,
    facts: [
      [pct(code.retained), 'of the lines added are still in the tree'],
      code.perChange?.median ? [count(code.perChange.median), 'output tokens per line for the middle change'] : [count(code.commits), 'commits counted'],
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

// The catalog's verdicts, in the order the legend lists them. An example with
// no single verdict has several in its label, or none yet.
const VERDICTS = [
  { key: 'violation', label: 'Violation found' },
  { key: 'verified', label: 'Verified' },
  { key: 'unverifiable', label: 'Unverifiable' },
  { key: 'none', label: 'Several verdicts, or none yet' },
];
const LIBRARY = 'real-world';
// A label that records a result carries one of the catalog's own marks.
const hasResult = (x) => /[✓✗⚠]/.test(x.verdictLabel ?? '');

/**
 * What the factory makes: the example catalog, a square for each example.
 * `examples` is the records of the examples collection. Without them (a
 * snapshot whose records aren't loaded yet) the squares are counted from the
 * overview and none is named.
 */
function outputFinding(snapshot, examples) {
  const { overview, manifest } = snapshot;
  const stock = overview.stocks?.examples;
  if (!stock?.total) return '';
  const n = (key) => stock.verdict?.[key] ?? 0;
  const libraries = stock.origin?.[LIBRARY] ?? 0;
  const named = Array.isArray(examples) && examples.length === stock.total ? examples : null;
  const cells = named
    ? named.map((x) => ({
        key: x.verdict ?? 'none',
        ring: x.origin === LIBRARY,
        tip: `${x.id} · ${x.system ? `${x.system}: ` : ''}${x.title}. ${x.verdictLabel ?? 'No verdict'}${x.vacuous ? ' (vacuous)' : ''}`,
      }))
    : VERDICTS.flatMap((v) => Array.from({ length: n(v.key) }, () => ({ key: v.key, ring: false, tip: v.label })));
  const shown = named ? named.filter((x) => x.origin === LIBRARY && hasResult(x)) : [];
  const list = shown.length
    ? `<div class="sf-catalog-list">
              <h3>Changes to published libraries with a result so far</h3>
              <ul>${shown
                .slice(0, 6)
                .map((x) => `<li>${x.system ? `<strong>${e(x.system)}</strong> ` : ''}${e(x.title)} <span class="sf-catalog-verdict">${e(x.verdictLabel)}</span></li>`)
                .join('')}</ul>
            </div>`
    : '';
  const jobs = overview.verification?.rows ?? [];
  const passed = jobs.filter((r) => r[1] === 0).length;
  const median = overview.measures?.find((m) => m.id === 'verification_duration_median');
  const legend = `<ul class="sf-legend">${VERDICTS.filter((v) => n(v.key))
    .map((v) => `<li><span class="sf-swatch sf-verdict-${v.key}" aria-hidden="true"></span>${e(v.label)}: ${count(n(v.key))}</li>`)
    .join('')}${named && libraries ? '<li><span class="sf-swatch sf-verdict-none sf-cell-ring" aria-hidden="true"></span>A change to a published library</li>' : ''}</ul>`;
  const href = `${ROUTE}usage/#explore-examples`;
  return finding({
    id: 'output',
    eyebrow: 'Output',
    wide: true,
    claim: `${plural(n('violation'), 'violation')} found and ${plural(n('verified'), 'change')} verified, in a catalog of ${plural(stock.total, 'example')}`,
    lede: `Each example is a code change run through the project’s formal verifier, with the verdict it gave. A verified label is not a claim of a current, non-vacuous proof${
      stock.vacuous ? `: ${plural(stock.vacuous, 'proof')} ${stock.vacuous === 1 ? 'is' : 'are'} recorded as vacuous` : ''
    }. <a href="${ROUTE}methodology/#def-examples_catalog">Definition</a>`,
    facts: [
      libraries ? [count(libraries), `${libraries === 1 ? 'is a change' : 'are changes'} to published libraries${shown.length ? `; ${count(shown.length)} ${shown.length === 1 ? 'has' : 'have'} a result so far` : ''}`] : null,
      jobs.length ? [`${count(passed)} of ${count(jobs.length)}`, 'verification jobs passed'] : null,
      median?.value ? [formatValue(median.value, 'seconds'), 'the median verification job'] : null,
    ],
    href,
    more: 'Every example and its verdict',
    legend,
    chart: catalogHtml(cells),
    caption: `${named ? 'Each square is an example, in the order of the catalog.' : 'Each square is an example, by verdict.'} From <a href="${REPO}/blob/${e(manifest.source.sha)}/examples/README.md">the catalog</a> at this revision.`,
    after: list,
  });
}

/**
 * The overview under its headline: one finding each for the loops, what they
 * made, the tools and the code. `examples` names the catalog's squares when
 * the examples collection is at hand.
 */
export function findingsHtml(snapshot, { examples = null } = {}) {
  const { overview } = snapshot;
  return [loopsFinding(overview), outputFinding(snapshot, examples), toolsFinding(overview), codeFinding(overview)].filter(Boolean).join('\n        ');
}
