// The deeper exploration's tables, drawn in the browser when a reader opens
// one: the records of a details/*.json file, in the file's order. Strings in,
// strings out. Raw ids live here, not on the first screen. Only the long text
// columns (wrap) break across lines; ids, numbers and dates stay whole.

import { escapeHtml as e, formatDay, formatValue } from './format.js';
import { torontoDay } from './measures-local.js';

/** Rows shown before "Show all": a short view of a long list. */
export const FIRST_ROWS = 20;

const muted = (text) => `<span class="sf-muted">${e(text)}</span>`;
const day = (instant) => (instant ? `<time datetime="${e(instant)}">${e(formatDay(torontoDay(instant)))}</time>` : muted('Unknown'));
const id = (text) => `<code>${e(text)}</code>`;
const link = (url, html) => (url && /^https:\/\//.test(url) ? `<a href="${e(url)}">${html}</a>` : html);

const COMMIT = 'https://github.com/pilifs/in-the-loop/commit/';
const OUTCOMES = { done: 'Done', waiting: 'Waiting on jobs', blocked: 'Blocked on a person', attention: 'Stopped for attention', ended: 'Ended', open: 'No end recorded' };
const known = (value, unit) => (value === null || value === undefined ? muted('Not recorded') : e(formatValue(value, unit)));

const TABLES = {
  loops: {
    caption: 'Feature loop runs, oldest first',
    head: ['Run', 'Started', 'Duration', 'Cycles', 'Commits', 'Tool calls', 'Estimated usage', 'From a person', 'Ended'],
    wrap: [0],
    row: (r) => [
      `${link(r.recordUrl, id(r.loop))}<br>${muted(r.id.slice(0, 17))} ${link(r.summaryUrl, 'session')}`,
      day(r.started),
      known(r.seconds, 'seconds'),
      e(r.cycles.length),
      e(r.commits),
      known(r.toolCalls, 'calls'),
      known(r.usd, 'usd'),
      r.prompts ? e(r.prompts.person + r.prompts.interrupt) : muted('Not recorded'),
      e(OUTCOMES[r.outcome] ?? r.outcome),
    ],
  },
  changes: {
    caption: 'Recorded changes, as the rollup lists them',
    head: ['Change', 'Summary', 'Area', 'Sessions', 'Code lines', 'Still standing', 'Output tokens', 'Estimated usage'],
    wrap: [1],
    row: (r) => [
      r.commit ? `<a href="${COMMIT}${e(r.commit)}">${id(r.changeId.slice(0, 12))}</a>` : id(r.changeId.slice(0, 12)),
      `${e(r.summary)}${r.housekeeping ? ` <span class="sf-tag">Housekeeping</span>` : ''}`,
      e(r.area === 'unassigned' ? 'Unassigned' : r.area),
      e(r.sessions.length),
      r.codeAdded === undefined ? muted('Not recorded') : `+${e(r.codeAdded.toLocaleString('en-US'))} −${e(r.codeRemoved.toLocaleString('en-US'))}`,
      r.codeSurviving === undefined || !r.codeAdded ? muted(r.codeSurviving === undefined ? 'Not recorded' : 'No code') : `${e(r.codeSurviving.toLocaleString('en-US'))} of ${e(r.codeAdded.toLocaleString('en-US'))}`,
      known(r.outputTokens, 'tokens'),
      known(r.usd, 'usd'),
    ],
  },
  sessions: {
    caption: 'Sessions in the trace index',
    head: ['Session', 'Models', 'Calls', 'Estimated usage', 'Cache reuse', 'Changes'],
    wrap: [0, 1],
    row: (r) => [
      `${link(r.summaryUrl, id(r.id.slice(0, 8)))}${r.title ? ` ${e(r.title)}` : ''}${r.hasMetrics ? '' : ` ${muted('(no metrics file)')}`}`,
      r.models.length ? r.models.map(id).join(' ') : muted('None recorded'),
      e(formatValue(r.calls, 'calls')),
      e(formatValue(r.usd, 'usd')),
      e(formatValue(r.cacheReuse, 'ratio')),
      e(r.changes),
    ],
  },
  verification: {
    caption: 'Verification results: the process outcome says whether the job ran as its steps expected, not whether a property holds',
    head: ['Job', 'Process', 'Finished', 'Duration', 'Area'],
    wrap: [0],
    row: (r) => [
      `${e(r.title)}<br>${id(r.id)}`,
      e(r.process === 'passed' ? 'Ran as expected' : 'Failed'),
      day(r.finishedAt),
      e(formatValue(r.wallSeconds, 'seconds')),
      e(r.area === 'unassigned' ? 'Unassigned' : r.area),
    ],
  },
  examples: {
    caption: 'The example catalog at the source revision',
    head: ['Example', 'Origin', 'System', 'Verdict', 'Freshness'],
    wrap: [0, 2, 3],
    row: (r) => [
      `${id(r.id)} ${e(r.title)}`,
      e(r.origin === 'real-world' ? 'Real-world' : 'Constructed'),
      r.system ? e(r.system) : muted('None'),
      `${r.verdictLabel ? e(r.verdictLabel) : muted('No verdict')}${r.vacuous ? ' <span class="sf-tag">Vacuous</span>' : ''}`,
      r.freshness ? e(r.freshness) : muted('Absent'),
    ],
  },
};

/** The table for a collection's records, the first `limit` of them. */
export function detailTable(name, records, { limit = FIRST_ROWS } = {}) {
  const t = TABLES[name];
  if (!t) throw new Error(`details: no table for ${name}`);
  const shown = records.slice(0, limit);
  const head = t.head.map((h) => `<th scope="col">${e(h)}</th>`).join('');
  const body = shown.length
    ? shown
        .map((r) => {
          const cells = t.row(r).map((cell, i) => {
            const cls = t.wrap.includes(i) ? ' class="sf-wrap"' : '';
            return i ? `<td${cls}>${cell}</td>` : `<th scope="row"${cls}>${cell}</th>`;
          });
          return `<tr>${cells.join('')}</tr>`;
        })
        .join('')
    : `<tr><td colspan="${t.head.length}" class="sf-muted">No records in this snapshot</td></tr>`;
  return `<div class="sf-table-wrap" tabindex="0" role="region" aria-label="${e(t.caption)}"><table class="sf-table sf-detail-table"><caption class="sf-visually-hidden">${e(t.caption)}</caption><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

/** The line under a table: how many are shown. */
export function detailCount(records, limit) {
  return records.length > limit ? `Showing ${limit} of ${records.length.toLocaleString('en-US')}.` : `${records.length.toLocaleString('en-US')} in all.`;
}
