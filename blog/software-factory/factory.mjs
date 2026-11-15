// The feature loops, the tools and the code of a snapshot: what metrics.mjs's
// aggregate() adds to the overview beside usage and verification, and the
// loops collection behind it. Pure: normalized records in, plain values out.
//
//   aggregateFactory(normalized, { config, days, day, modelIds, label, area, changeRecords })
//     -> { loops, tools, code, runRecords, changeFacts }
//     loops, tools and code are each null when nothing was measured for them
//     (no run record; no session with a tools table; no git checkout), never
//     zeros. changeFacts maps a change id to its commit and code lines.
//
// What counts as what is config: config/loops.json (who sent a prompt, how a
// run ended, a loop's campaign) and config/code.json (which files are code).

const round6 = (n) => Math.round(n * 1e6) / 1e6;
const ms = (instant) => Date.parse(instant);
// Instants as the rest of the snapshot writes them: whole seconds, UTC.
const iso = (epochMs) => new Date(epochMs).toISOString().replace(/\.\d{3}Z$/, 'Z');
const KINDS = { exit_code: 'exit', tool_use_error: 'rejected', denied: 'denied', blocked: 'denied' };
const kindOf = (t) => (t.status === 'error' ? (KINDS[t.errorKind] ?? 'other') : null);
const tally = () => ({ calls: 0, errors: 0, exit: 0, rejected: 0, denied: 0, other: 0, noResult: 0 });
function count(into, tool) {
  into.calls++;
  if (tool.status === 'no_result') into.noResult++;
  const kind = kindOf(tool);
  if (kind) {
    into.errors++;
    into[kind]++;
  }
}

/** The most runs under way at once, and when that first happened. */
function peak(runs) {
  const edges = [];
  for (const r of runs) {
    if (r.end === null) continue;
    edges.push([ms(r.started), 1], [r.end, -1]);
  }
  edges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let now = 0;
  let best = { runs: 0, at: null };
  for (const [at, step] of edges) {
    now += step;
    if (now > best.runs) best = { runs: now, at: iso(at) };
  }
  return best;
}

export function aggregateFactory(normalized, { config, days, day, modelIds, label, area, areaLabel, changeRecords }) {
  const { sessions, prompts, tools, sessionCommits, runs, code: git } = normalized;
  const dayIndex = new Map(days.map((d, i) => [d, i]));
  const modelIndex = new Map(modelIds.map((m, i) => [m, i]));
  const session = new Map(sessions.map((s) => [s.id, s]));
  const change = new Map(changeRecords.map((c) => [c.changeId, c]));
  const bySession = (rows) => Map.groupBy(rows, (r) => r.session);
  const promptsOf = bySession(prompts ?? []);
  const toolsOf = bySession(tools ?? []);
  const commitsOf = bySession(sessionCommits ?? []);

  // --- Code: git's account of each commit --------------------------------
  const languageIds = config.code.languages.map((l) => l.id);
  const codeLines = (lines) => languageIds.reduce((t, id) => [t[0] + (lines[id]?.[0] ?? 0), t[1] + (lines[id]?.[1] ?? 0)], [0, 0]);
  const changeFacts = new Map();
  if (git)
    for (const c of git.commits) {
      if (!c.changeId) continue;
      const [added, removed] = codeLines(c.lines);
      const seen = changeFacts.get(c.changeId);
      // A change id rewritten into several commits keeps the newest (git log lists newest first).
      if (!seen) changeFacts.set(c.changeId, { commit: c.sha, committedAt: c.committedAt, codeAdded: added, codeRemoved: removed });
    }

  // --- Feature loops ------------------------------------------------------
  // Each run's window, then what its session did inside it.
  const runsOf = bySession(runs ?? []);
  const windows = [];
  for (const [sid, own] of runsOf) {
    own.sort((a, b) => a.started.localeCompare(b.started));
    own.forEach((r, i) => {
      const from = ms(r.started);
      const next = own[i + 1] ? ms(own[i + 1].started) : Infinity;
      let to = r.ended ? ms(r.ended) : null;
      const mine = (promptsOf.get(sid) ?? []).filter((p) => ms(p.start) >= from - 5000 && ms(p.start) < next);
      if (to === null) {
        const last = mine.filter((p) => p.sender === 'harness' && p.end).at(-1);
        to = last ? ms(last.end) : null;
      }
      windows.push({ run: r, from, to, session: sid, prompts: to === null ? [] : mine.filter((p) => ms(p.start) <= to) });
    });
  }
  const housekeeping = (id) => change.get(id)?.housekeeping === true;
  const runRows = windows
    .map(({ run, from, to, session: sid, prompts: own }) => {
      const measured = session.get(sid)?.hasPrompts === true && to !== null;
      const sum = (k) => own.reduce((t, p) => t + p[k], 0);
      const sent = (kind) => own.filter((p) => p.sender === kind).length;
      const commits = new Set(
        (commitsOf.get(sid) ?? []).filter((c) => to !== null && ms(c.at) >= from && ms(c.at) <= to + 60000 && !housekeeping(c.changeId)).map((c) => c.changeId)
      );
      for (const c of run.cycles) for (const id of change.keys()) if (id.startsWith(c.change) && !housekeeping(id)) commits.add(id);
      let codeAdded = null;
      if (git) {
        codeAdded = 0;
        for (const id of commits) codeAdded += changeFacts.get(id)?.codeAdded ?? 0;
      }
      return {
        id: run.id,
        loop: run.loop,
        campaign: run.campaign,
        session: sid,
        model: run.model,
        effort: run.effort,
        started: run.started,
        ended: to === null ? null : iso(to),
        end: to,
        seconds: to === null ? null : Math.round((to - from) / 1000),
        outcome: run.outcome,
        cycles: run.cycles.length,
        commits: commits.size,
        measured,
        calls: measured ? sum('calls') : null,
        toolCalls: measured ? sum('toolCalls') : null,
        toolErrors: measured ? sum('toolErrors') : null,
        outputTokens: measured ? sum('outputTokens') : null,
        usd: measured ? round6(sum('usd')) : null,
        agentSeconds: measured ? Math.round(sum('agentMs') / 1000) : null,
        prompts: measured
          ? { harness: sent('harness'), person: sent('person'), agent: sent('agent'), interrupt: sent('interrupt'), compactions: own.filter((p) => p.command === '/compact').length }
          : null,
        codeAdded,
        record: run,
      };
    })
    .sort((a, b) => a.started.localeCompare(b.started) || a.id.localeCompare(b.id));

  const total = (rows, k) => rows.reduce((t, r) => t + (r[k] ?? 0), 0);
  const people = (rows, k) => rows.reduce((t, r) => t + (r.prompts?.[k] ?? 0), 0);
  const sums = (rows) => {
    const measured = rows.filter((r) => r.measured);
    return {
      runs: rows.length,
      loops: new Set(rows.map((r) => r.loop)).size,
      cycles: total(rows, 'cycles'),
      commits: total(rows, 'commits'),
      calls: total(measured, 'calls'),
      toolCalls: total(measured, 'toolCalls'),
      toolErrors: total(measured, 'toolErrors'),
      outputTokens: total(measured, 'outputTokens'),
      usd: round6(total(measured, 'usd')),
      agentSeconds: total(measured, 'agentSeconds'),
      runSeconds: total(rows, 'seconds'),
      prompts: {
        harness: people(measured, 'harness'),
        person: people(measured, 'person'),
        agent: people(measured, 'agent'),
        interrupt: people(measured, 'interrupt'),
        compactions: people(measured, 'compactions'),
      },
      codeAdded: git ? total(rows, 'codeAdded') : null,
    };
  };

  let loops = null;
  if (runRows.length) {
    const measured = runRows.filter((r) => r.measured);
    const campaigns = [...Map.groupBy(runRows, (r) => r.campaign)].map(([id, rows]) => {
      const ends = rows.map((r) => r.end).filter((e) => e !== null);
      const main = rows.filter((r) => r.loop === id).at(-1) ?? rows.at(-1);
      const areaId = area({ campaign: id });
      return {
        id,
        area: areaId,
        areaLabel: areaLabel(areaId),
        first: rows[0].started,
        last: ends.length ? iso(Math.max(...ends)) : null,
        streams: new Set(rows.filter((r) => r.loop !== id).map((r) => r.loop)).size,
        peakParallel: peak(rows).runs,
        outcome: main.outcome,
        ...sums(rows),
      };
    });
    // The longest run no person typed into, by the clock.
    const unattended = measured.filter((r) => r.prompts.person === 0 && r.prompts.interrupt === 0 && r.seconds !== null);
    const longest = unattended.reduce((a, b) => (a === null || b.seconds > a.seconds ? b : a), null);
    // Where each day's tool calls were made: inside a recorded run, or outside.
    const inRun = new Map(days.map((d) => [d, [0, 0]]));
    for (const [sid, own] of toolsOf) {
      const spans = windows.filter((w) => w.session === sid && w.to !== null);
      for (const t of own) {
        const at = ms(t.start);
        const cell = inRun.get(day(t.start));
        if (cell) cell[spans.some((w) => at >= w.from && at <= w.to) ? 0 : 1]++;
      }
    }
    loops = {
      coverage: { included: measured.length, total: runRows.length, missing: runRows.length - measured.length, note: 'runs whose session has a prompts table' },
      totals: sums(runRows),
      campaigns,
      peakParallel: peak(runRows),
      longest: longest
        ? {
            run: longest.id,
            loop: longest.loop,
            session: longest.session,
            model: longest.model,
            effort: longest.effort,
            started: longest.started,
            seconds: longest.seconds,
            cycles: longest.cycles,
            commits: longest.commits,
            toolCalls: longest.toolCalls,
            // Its ledger, as the run record lists it: when each cycle committed, and the commit's summary line.
            ledger: longest.record.cycles.map((c) => ({ n: c.n, at: c.at, summary: c.summary })),
          }
        : null,
      outcomes: Object.fromEntries(Object.entries(Object.groupBy(runRows, (r) => r.outcome)).map(([k, v]) => [k, v.length])),
      runs: runRows.map((r) => ({
        id: r.id,
        loop: r.loop,
        campaign: r.campaign,
        started: r.started,
        ended: r.ended,
        seconds: r.seconds,
        outcome: r.outcome,
        cycles: r.cycles,
        commits: r.commits,
        toolCalls: r.toolCalls,
        usd: r.usd,
        person: r.prompts ? r.prompts.person + r.prompts.interrupt : null,
        // Seconds from the start at which each cycle committed.
        ticks: r.record.cycles.map((c) => Math.max(0, Math.round((ms(c.at) - ms(r.started)) / 1000))),
      })),
      daily: { columns: ['day', 'inRuns', 'outside'], rows: days.map((d, i) => [i, ...inRun.get(d)]).filter((r) => r[1] || r[2]) },
    };
  }

  const runRecords = runRows.map((r) => ({
    id: r.id,
    loop: r.loop,
    campaign: r.campaign,
    session: r.session,
    model: r.model,
    effort: r.effort,
    started: r.started,
    ended: r.ended,
    seconds: r.seconds,
    agentSeconds: r.agentSeconds,
    outcome: r.outcome,
    limit: r.record.limit,
    commits: r.commits,
    calls: r.calls,
    toolCalls: r.toolCalls,
    toolErrors: r.toolErrors,
    outputTokens: r.outputTokens,
    usd: r.usd,
    prompts: r.prompts,
    codeAdded: r.codeAdded,
    cycles: r.record.cycles.map((c) => ({ n: c.n, at: c.at, change: c.change, summary: c.summary, decision: c.decision })),
    recordUrl: config.source.runUrl.replace('{sha}', normalized.source.sha).replace('{session}', r.session).replace('{run}', r.id),
    summaryUrl: config.source.summaryUrl.replace('{sha}', normalized.source.sha).replace('{session}', r.session),
  }));

  // --- Tools ---------------------------------------------------------------
  let toolsOut = null;
  const withTools = sessions.filter((s) => s.hasTools).length;
  if (tools?.length) {
    const all = tally();
    const cells = new Map();
    const byTool = new Map();
    const byFamily = new Map();
    const byModel = new Map();
    const buckets = config.code.contextBuckets.map((from, i, list) => ({ from, to: list[i + 1] ?? null, ...tally() }));
    const mode = { runs: tally(), outside: tally() };
    const dayTop = new Map();
    const get = (map, key, make = tally) => map.get(key) ?? map.set(key, make()).get(key);
    for (const [sid, own] of toolsOf) {
      const spans = windows.filter((w) => w.session === sid && w.to !== null);
      for (const t of own) {
        const d = dayIndex.get(day(t.start));
        if (d === undefined) continue;
        const m = modelIndex.get(t.model) ?? null;
        count(all, t);
        count(get(cells, `${d},${m}`, () => ({ key: [d, m], ...tally() })), t);
        count(get(byTool, t.name), t);
        count(get(byModel, t.model), t);
        if (t.family) count(get(byFamily, t.family), t);
        if (t.contextTokens !== null) count(buckets.findLast((b) => t.contextTokens >= b.from) ?? buckets[0], t);
        const at = ms(t.start);
        count(spans.some((w) => at >= w.from && at <= w.to) ? mode.runs : mode.outside, t);
        if (kindOf(t)) {
          const source = t.name === 'Bash' && t.family ? `${t.family} (Bash)` : t.name;
          const top = get(dayTop, d, () => new Map());
          top.set(source, (top.get(source) ?? 0) + 1);
        }
      }
    }
    const row = (key, v) => ({ ...key, calls: v.calls, errors: v.errors, exit: v.exit, rejected: v.rejected, denied: v.denied, other: v.other });
    const ranked = (map, name) => [...map].map(([k, v]) => row({ [name]: k }, v)).sort((a, b) => b.calls - a.calls || (a[name] < b[name] ? -1 : 1));
    toolsOut = {
      coverage: { included: withTools, total: sessions.length, missing: sessions.length - withTools, note: 'sessions with a tools table' },
      totals: { ...row({}, all), ok: all.calls - all.errors - all.noResult, noResult: all.noResult },
      daily: {
        columns: ['day', 'model', 'calls', 'errors', 'exit', 'rejected', 'denied', 'other'],
        rows: [...cells.values()]
          .sort((a, b) => a.key[0] - b.key[0] || (a.key[1] ?? 1e9) - (b.key[1] ?? 1e9))
          .map((c) => [...c.key, c.calls, c.errors, c.exit, c.rejected, c.denied, c.other]),
      },
      byModel: [...byModel]
        .map(([id, v]) => row({ id: id ?? 'unknown', label: id ? label(id) : 'Unknown model' }, v))
        .sort((a, b) => b.calls - a.calls || (a.id < b.id ? -1 : 1)),
      byTool: ranked(byTool, 'name'),
      // The Bash command families with the most failed calls: where the stumbles are.
      byFamily: ranked(byFamily, 'family')
        .filter((f) => f.errors > 0)
        .sort((a, b) => b.errors - a.errors || b.calls - a.calls || (a.family < b.family ? -1 : 1))
        .slice(0, 12),
      byContext: buckets.filter((b) => b.calls).map(({ from, to, ...v }) => row({ from, to }, v)),
      byMode: { runs: row({}, mode.runs), outside: row({}, mode.outside) },
      // Each day's largest single source of failed calls.
      dayTop: [...dayTop]
        .sort((a, b) => a[0] - b[0])
        .map(([d, sources]) => {
          const [source, errors] = [...sources].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0];
          return { day: d, source, errors };
        }),
    };
  }

  // --- Code ----------------------------------------------------------------
  let code = null;
  if (git) {
    const classes = new Map();
    const add = (id, added, removed) => {
      const c = classes.get(id) ?? classes.set(id, { added: 0, removed: 0 }).get(id);
      c.added += added;
      c.removed += removed;
    };
    const dated = git.commits.filter((c) => c.committedAt);
    const commitDays = dated.map((c) => day(c.committedAt)).sort();
    const codeDays = [];
    if (commitDays.length) {
      const next = (d) => {
        const x = new Date(`${d}T12:00:00Z`);
        x.setUTCDate(x.getUTCDate() + 1);
        return x.toISOString().slice(0, 10);
      };
      for (let d = commitDays[0]; d <= commitDays.at(-1); d = next(d)) codeDays.push(d);
    }
    const perDay = new Map(codeDays.map((d) => [d, [0, 0, 0]]));
    for (const c of git.commits) {
      for (const [id, [added, removed]] of Object.entries(c.lines)) add(id, added, removed);
      if (!c.committedAt) continue;
      const [added, removed] = codeLines(c.lines);
      const cell = perDay.get(day(c.committedAt));
      cell[0] += added;
      cell[1] += removed;
      cell[2]++;
    }
    const part = (id, name) => ({ id, label: name, added: classes.get(id)?.added ?? 0, removed: classes.get(id)?.removed ?? 0, inTree: git.tree[id] ?? 0 });
    const languages = config.code.languages
      .map((l) => part(l.id, l.label))
      .filter((l) => l.added || l.inTree)
      .sort((a, b) => b.added - a.added || (a.id < b.id ? -1 : 1));
    const totals = languages.reduce((t, l) => ({ added: t.added + l.added, removed: t.removed + l.removed, inTree: t.inTree + l.inTree }), { added: 0, removed: 0, inTree: 0 });
    const joined = git.commits.filter((c) => c.changeId && change.has(c.changeId)).length;
    const calls = normalized.calls;
    const outputTokens = calls.reduce((t, c) => t + c.outputTokens, 0);
    const usd = calls.reduce((t, c) => t + (c.usd ?? 0), 0);
    code = {
      coverage: { included: joined, total: git.commits.length, missing: git.commits.length - joined, note: 'commits whose change id the traces record' },
      commits: git.commits.length,
      languages,
      docs: part('docs', config.code.docs.label),
      data: part('data', config.code.data.label),
      totals,
      days: codeDays,
      daily: { columns: ['day', 'added', 'removed', 'commits'], rows: codeDays.map((d, i) => [i, ...perDay.get(d)]).filter((r) => r[3]) },
      outputTokens,
      usd: round6(usd),
      tokensPerLine: totals.added ? outputTokens / totals.added : null,
      usdPerLine: totals.added ? usd / totals.added : null,
      retained: totals.added ? totals.inTree / totals.added : null,
      removedShare: totals.added ? totals.removed / totals.added : null,
    };
  }

  return { loops, tools: toolsOut, code, runRecords, changeFacts };
}
