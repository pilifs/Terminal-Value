// Parsers for the records the feature loops, the tools and the code are read
// from: a loop's run record (markdown), who sent a prompt, and git's numstat.
// Pure functions, strings in and plain objects out, so the tests run them on
// short samples. import.mjs calls them; config/loops.json and config/code.json
// hold the patterns, so a change to either makes a new snapshot.
//
//   parseRunRecord(text, loopsConfig) -> { started, limit, session, model, effort,
//     ended, outcome, cycles: [{ n, at, change, summary, decision }] } | null
//   senderOf(text, loopsConfig)       -> 'harness' | 'agent' | 'interrupt' | 'person'
//   campaignOf(loop, briefs)          -> the campaign a loop runs in
//   classOf(path, codeConfig)         -> a language id, 'docs' or 'data'
//   parseGitLog(text, codeConfig)     -> [{ sha, changeId, committedAt, lines: { class: [added, removed] } }]
//   parseTree(text, codeConfig)       -> { class: lines in the tree }

const utc = (stamp) => `${stamp.replace(' ', 'T')}Z`;
const HEADER = /^Started (\d{4}-\d\d-\d\d \d\d:\d\d:\d\d) UTC, ([^,]+), session ([0-9a-f-]{36}), (\S+) at (\S+) effort/m;
const CYCLE = /^- cycle (\d+), (\d{4}-\d\d-\d\d \d\d:\d\d:\d\d), `([k-z]{8,32})`: (.*)$/;
const DECISION = /^ {2}- decided to (continue|stop)\b/;
const END = /^(Ended|Stopped) (\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)((?: after \d+ cycle\(s\))?[:.].*)$/;

/**
 * A feature loop's run record, as feature-loop.sh writes it: a header line, a
 * `## Commits` list with one line per cycle and the session's decision under
 * it, the session's summary, and an Ended or Stopped line. The cycles are read
 * from the commits section only: the summary below it is prose. Returns null
 * when there is no header.
 */
export function parseRunRecord(text, loops) {
  const header = text.match(HEADER);
  if (!header) return null;
  const from = text.search(/^## Commits\s*$/m);
  const rest = from === -1 ? '' : text.slice(from);
  const until = rest.search(/^## Summary\s*$/m);
  const lines = (until === -1 ? rest : rest.slice(0, until)).split('\n');
  const cycles = [];
  let ended = null;
  let reason = null;
  for (const line of lines) {
    const cycle = line.match(CYCLE);
    if (cycle) {
      cycles.push({ n: Number(cycle[1]), at: utc(cycle[2]), change: cycle[3], summary: cycle[4].trim(), decision: null });
      continue;
    }
    const decision = line.match(DECISION);
    if (decision && cycles.length) {
      cycles.at(-1).decision = decision[1];
      continue;
    }
  }
  // The Ended or Stopped line closes the record, below the summary: the last one counts.
  for (const line of text.split('\n')) {
    const end = line.match(END);
    if (end) {
      ended = utc(end[2]);
      reason = `${end[1]}${end[3]}`;
    }
  }
  const limit = header[2].match(/(\d+) cycles?/);
  return {
    started: utc(header[1]),
    limit: limit ? Number(limit[1]) : null,
    session: header[3],
    model: header[4],
    effort: header[5],
    ended,
    outcome: ended === null ? 'open' : outcomeOf(reason, loops),
    cycles,
  };
}

function outcomeOf(reason, loops) {
  for (const { outcome, pattern } of loops.outcomes.patterns) if (new RegExp(pattern).test(reason)) return outcome;
  return loops.outcomes.fallback;
}

const compiled = new WeakMap();
/** Who sent a prompt the trace records as typed input, by config/loops.json's patterns. */
export function senderOf(text, loops) {
  if (!compiled.has(loops))
    compiled.set(
      loops,
      ['harness', 'agent', 'interrupt'].map((kind) => [kind, loops.senders[kind].map((p) => new RegExp(p))])
    );
  const t = typeof text === 'string' ? text : '';
  for (const [kind, patterns] of compiled.get(loops)) if (patterns.some((p) => p.test(t))) return kind;
  return 'person';
}

/** The campaign of a loop: the longest brief name it equals or extends with '-'. */
export function campaignOf(loop, briefs) {
  let best = loop;
  let length = Infinity;
  for (const b of briefs) if ((loop === b || loop.startsWith(`${b}-`)) && b.length < length) [best, length] = [b, b.length];
  return best;
}

/** The class of a path: a language id from config/code.json, 'docs' or 'data'. */
export function classOf(file, code) {
  const name = file.slice(file.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
  for (const l of code.languages) if (l.extensions.includes(ext)) return l.id;
  return code.docs.extensions.includes(ext) ? 'docs' : 'data';
}

/** The new path of a numstat entry: 'a/{b => c}/d' and 'a => b' name a rename. */
function newPath(entry) {
  const braces = entry.replace(/\{[^{}]* => ([^{}]*)\}/g, '$1').replace(/\/\//g, '/');
  if (braces !== entry) return braces;
  const arrow = entry.indexOf(' => ');
  return arrow === -1 ? entry : entry.slice(arrow + 4);
}

const NUMSTAT = /^(\d+|-)\t(\d+|-)\t(.+)$/;

/**
 * `git log --format=raw -M --numstat`, as commits with their lines added and
 * removed per class. A commit's message is indented, so a line starting with
 * 'commit ' starts a commit. Binary files (- -) add nothing.
 */
export function parseGitLog(text, code) {
  const commits = [];
  let current = null;
  let inHeader = false;
  for (const line of text.split('\n')) {
    if (line.startsWith('commit ')) {
      current = { sha: line.slice(7, 47), changeId: null, committedAt: null, lines: {} };
      commits.push(current);
      inHeader = true;
      continue;
    }
    if (!current) continue;
    if (inHeader) {
      if (line === '') inHeader = false;
      else if (line.startsWith('committer ')) {
        const epoch = line.match(/ (\d+) [+-]\d{4}$/);
        if (epoch) current.committedAt = new Date(Number(epoch[1]) * 1000).toISOString();
      } else if (line.startsWith('change-id ')) current.changeId = line.slice(10).trim();
      continue;
    }
    const stat = line.match(NUMSTAT);
    if (!stat || stat[1] === '-') continue;
    const cls = classOf(newPath(stat[3]), code);
    const tally = (current.lines[cls] ??= [0, 0]);
    tally[0] += Number(stat[1]);
    tally[1] += Number(stat[2]);
  }
  return commits;
}

/** `git diff --numstat <empty tree> <sha>`: the lines in the tree at a revision, per class. */
export function parseTree(text, code) {
  const tree = {};
  for (const line of text.split('\n')) {
    const stat = line.match(NUMSTAT);
    if (!stat || stat[1] === '-') continue;
    const cls = classOf(stat[3], code);
    tree[cls] = (tree[cls] ?? 0) + Number(stat[1]);
  }
  return tree;
}

/**
 * `git blame -w -M --incremental` of one or more files, joined: the lines each
 * commit still holds at the blamed revision. An entry starts with a line of
 * '<sha> <source line> <result line> <lines>'; every other line has a keyword first.
 */
export function parseBlame(text) {
  const lines = {};
  for (const m of text.matchAll(/^([0-9a-f]{40}) \d+ \d+ (\d+)$/gm)) lines[m[1]] = (lines[m[1]] ?? 0) + Number(m[2]);
  return lines;
}

/** `git log --format=%H%x09%ct%x09%s`: the commits that changed the loop's own scripts, oldest first. */
export function parseScriptLog(text) {
  const commits = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^([0-9a-f]{40})\t(\d+)\t(.*)$/);
    if (m) commits.push({ sha: m[1], at: new Date(Number(m[2]) * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z'), subject: m[3] });
  }
  return commits.sort((a, b) => a.at.localeCompare(b.at) || a.sha.localeCompare(b.sha));
}
