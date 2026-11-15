// Reading in-the-loop's published metadata at one pinned revision, and turning
// it into normalized records. Owned by stream A (data): llm-dlc/loops/software-factory-data.md.
//
// Interface, frozen in Phase 0 (docs/software-factory.md):
//
//   readSources({ ref, sha, checkout, fetchImpl }) -> Promise<RawSources>
//     Resolves a moving ref (default config/source.json defaultRef) to one SHA
//     once, then reads every input at that SHA: from GitHub, or from a local
//     checkout (git show SHA:path) when `checkout` is given. RawSources is
//     { source: { repository, sha, ref }, files: Map<path, Buffer> }.
//
//   normalizeSources(raw, config) -> Normalized
//     Checks each input's schema name and required fields (config/source.json)
//     and selects public fields only: never prompt text, tool labels or
//     errors, job descriptions or example notes. Normalized is
//     { source: { repository, sha, inputs: [{ path, sha256, bytes, schema }] },
//       pricingAsOf, calls, sessions, changes, verification, examples, tags },
//     each record holding the fields schema.json's details and overview need
//     (calls: { session, subagent, start, model, effort, inputTokens,
//     cacheReadTokens, cacheWriteTokens, outputTokens, usd }).
//     Throws SourceError on anything it cannot trust.
//
//   refresh({ ref, sha, checkout, dataDir, now }) -> Promise<{ outcome, snapshotId, error }>
//     readSources, normalizeSources, metrics.aggregate, then writes the snapshot
//     to a staging directory, validates it (validate.mjs validateSnapshotDir),
//     and only then replaces dataDir's latest.json and adds the snapshot.
//     outcome is 'new-snapshot', 'unchanged' (same snapshot id: only
//     lastSourceCheck changes) or 'failed' (dataDir's snapshot untouched).
//
// Additions to the frozen interface, all optional:
//   - readSources({ dir }) reads a plain directory laid out like the repository
//     (the test fixtures), with `sha` given; `fetchImpl` replaces fetch for
//     GitHub (tests make it fail for the network case).
//   - RawSources also has `runs`: the paths of the sessions' run records,
//     listed but not read, since their names carry the brief.
//   - loadConfig(dir) reads { source, areas, models } for normalizeSources.
//   - Normalized records carry a `campaign` (sessions, changes, verification)
//     for metrics.mjs's area rule, and the rollup's totals as `rollup`.
//   - refresh also takes `dir` and `fetchImpl` (passed to readSources),
//     `postsDir` (default blog/posts) and `config`; `now` is a Date, an ISO
//     instant or milliseconds (default the clock). It returns
//     { outcome, snapshotId, sha, pruned, error }, and on failure `code` and
//     `path` (a SourceError's, or 'invalid', 'conflict' or 'error') with
//     snapshotId the current one. How it writes:
//       - It stages in a new directory beside dataDir, so a failure of any
//         kind leaves dataDir byte for byte as it was.
//       - A snapshot already in dataDir must have exactly the staged files
//         ('conflict' otherwise). If latest.json already names it, the
//         outcome is 'unchanged' and only lastSourceCheck moves; if not, the
//         pointer moves to it ('new-snapshot').
//       - latest.json is replaced by one rename. publishedAt is when the
//         pointer last changed snapshot.
//       - After a new pointer, snapshots/ keeps the current snapshot and every
//         one named in a post's evidence.json (namedSnapshots); the rest are
//         deleted and listed in `pruned`.
//       - Output depends on the input and `now` only.
//   - A rollup change whose summary is null (a working copy before its first
//     commit message) is accepted and left out of `changes`. Every input that
//     imported before imports the same, so GENERATOR's version and every
//     snapshot id made so far stay as they were.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG_DIR, serialize, sha256 } from './identity.mjs';
import { aggregate, collectionFiles } from './metrics.mjs';
import { campaignOf as loopCampaign, classOf, parseBlame, parseGitLog, parseRunRecord, parseScriptLog, parseTree, senderOf } from './records.mjs';
import { validate, validateSnapshotDir } from './validate.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// index.mjs's DATA_DIR, not imported: index.mjs loads the render modules.
const DATA_DIR = path.join(HERE, 'data');
const POSTS_DIR = path.join(HERE, '..', 'posts');

export class SourceError extends Error {
  /** code: 'missing' | 'schema' | 'malformed' | 'network' | 'reconcile'. */
  constructor(code, message, { path = null } = {}) {
    super(message);
    this.name = 'SourceError';
    this.code = code;
    this.path = path;
  }
}

export function loadConfig(dir = CONFIG_DIR) {
  const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  return { source: read('source.json'), areas: read('areas.json'), models: read('models.json'), loops: read('loops.json'), code: read('code.json') };
}

const SHA = /^[0-9a-f]{40}$/;
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const JOB_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const RUN = /^llm-dlc\/traces\/([^/]+)\/runs\/(\d{4}-\d\d-\d\d-\d{6}-([a-z0-9][a-z0-9-]*))\.md$/;
const BRIEF = /^llm-dlc\/loops\/([a-z0-9][a-z0-9-]*)\.md$/;
// git's empty tree: a diff against it lists every line of a revision.
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const ROLLUP = 'llm-dlc/traces/metrics.json';
const INDEX = 'llm-dlc/index.json';
const RESULTS = 'verification/results/index.json';
const EXAMPLES = 'examples/index.json';
const TAGS = 'examples/tags.json';
export const sessionMetricsPath = (id) => `llm-dlc/traces/${id}/metrics.json`;
export const jobPath = (id) => `verification/jobs/${id}.json`;
// The top-level fields each input must have, by its config/source.json path.
// Kept here, not in source.json: that file is hashed into every snapshot id,
// the frozen example's included (see Progress in the data brief).
const FIELDS = {
  [ROLLUP]: ['totals', 'sessions', 'commits'],
  [INDEX]: ['sessions'],
  'llm-dlc/traces/{session}/metrics.json': ['session_id', 'calls'],
  [RESULTS]: ['results'],
  'verification/jobs/{job}.json': ['id'],
  [EXAMPLES]: ['examples'],
  [TAGS]: ['domain', 'defect', 'technique'],
};

// --- Reading ---------------------------------------------------------------

/** Readers: each resolves a ref, reads a file at the sha (null when absent), and lists a folder's files. */
function gitReader(checkout) {
  const git = (args, opts = {}) => execFileSync('git', ['-C', checkout, ...args], { maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'pipe'], ...opts });
  const resolve = (ref) => {
    try {
      return git(['rev-parse', '--verify', `${ref}^{commit}`]).toString().trim();
    } catch {
      throw new SourceError('missing', `no revision ${ref} in ${checkout}`);
    }
  };
  return {
    resolve,
    // A given sha must be a commit of the checkout, not just absent files.
    verify: resolve,
    async read(sha, rel) {
      try {
        return git(['show', `${sha}:${rel}`]);
      } catch {
        return null;
      }
    },
    async list(sha, dir) {
      return git(['ls-tree', '-r', '--name-only', sha, dir]).toString().split('\n').filter(Boolean);
    },
    // The history's lines per commit and the tree's lines, as git prints them.
    // Only a checkout has them: GitHub has no numstat without a call per commit.
    // `isCode` picks the files whose lines are blamed to the commit that wrote
    // them; `scripts` are the loop's own files, whose history is listed.
    async code(sha, { isCode = () => false, scripts = [] } = {}) {
      const files = git(['ls-tree', '-r', '--name-only', sha]).toString().split('\n').filter((f) => f && isCode(f));
      const blame = files.map((f) => {
        try {
          return git(['blame', '-w', '-M', '--incremental', sha, '--', f]).toString();
        } catch {
          return ''; // a submodule or an unreadable path holds no lines
        }
      });
      return {
        log: git(['log', '--format=raw', '-M', '--numstat', sha]).toString(),
        tree: git(['diff', '--numstat', EMPTY_TREE, sha]).toString(),
        blame: blame.join('\n'),
        scripts: scripts.length ? git(['log', '--format=%H%x09%ct%x09%s', sha, '--', ...scripts]).toString() : '',
      };
    },
  };
}

function dirReader(root) {
  return {
    resolve() {
      throw new SourceError('missing', 'reading a plain directory needs an explicit sha');
    },
    async read(_sha, rel) {
      const file = path.join(root, rel);
      return fs.existsSync(file) ? fs.readFileSync(file) : null;
    },
    async list(_sha, dir) {
      const base = path.join(root, dir);
      if (!fs.existsSync(base)) return [];
      return fs
        .readdirSync(base, { recursive: true, withFileTypes: true })
        .filter((e) => e.isFile())
        .map((e) => path.relative(root, path.join(e.parentPath, e.name)).split(path.sep).join('/'))
        .sort();
    },
  };
}

function githubReader(repository, fetchImpl) {
  const get = async (url, headers = {}) => {
    let res;
    try {
      res = await fetchImpl(url, { headers: { 'User-Agent': 'terminal-value-software-factory', ...headers } });
    } catch (e) {
      throw new SourceError('network', `fetching ${url}: ${e.message}`);
    }
    if (res.status === 404) return null;
    if (!res.ok) throw new SourceError('network', `fetching ${url}: HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  };
  const api = `https://api.github.com/repos/${repository}`;
  return {
    async resolve(ref) {
      const body = await get(`${api}/commits/${encodeURIComponent(ref)}`, { Accept: 'application/vnd.github.sha' });
      if (!body) throw new SourceError('missing', `no revision ${ref} in ${repository}`);
      return body.toString().trim();
    },
    read: (sha, rel) => get(`https://raw.githubusercontent.com/${repository}/${sha}/${rel}`),
    async list(sha, dir) {
      // The folder's tree, then that tree recursively: smaller than the whole repository's.
      const parent = path.posix.dirname(dir);
      const listing = await get(`${api}/contents/${parent}?ref=${sha}`, { Accept: 'application/vnd.github+json' });
      const entry = listing && JSON.parse(listing).find((e) => e.path === dir && e.type === 'dir');
      if (!entry) return [];
      const tree = JSON.parse(await get(`${api}/git/trees/${entry.sha}?recursive=1`, { Accept: 'application/vnd.github+json' }));
      if (tree.truncated) throw new SourceError('network', `the listing of ${dir} at ${sha} was truncated`);
      return tree.tree.filter((e) => e.type === 'blob').map((e) => `${dir}/${e.path}`);
    },
  };
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

const tryJson = (bytes) => {
  try {
    return JSON.parse(bytes);
  } catch {
    return null;
  }
};

/**
 * Every input at one revision. Files that don't exist at it are left out of
 * `files`: normalizeSources decides whether that is allowed.
 */
export async function readSources({ ref, sha, checkout, dir, fetchImpl = globalThis.fetch, config = loadConfig() } = {}) {
  const { repository } = config.source;
  const reader = dir ? dirReader(dir) : checkout ? gitReader(checkout) : githubReader(repository, fetchImpl);
  if (sha && !SHA.test(sha)) throw new SourceError('missing', `${sha} is not a full 40-digit commit sha`);
  const resolvedRef = sha ? null : (ref ?? config.source.defaultRef);
  const at = sha ? (reader.verify?.(sha) ?? sha) : await reader.resolve(resolvedRef);
  if (!SHA.test(at)) throw new SourceError('network', `${resolvedRef} resolved to ${JSON.stringify(at)}, not a sha`);

  const files = new Map();
  const put = async (rel) => {
    const bytes = await reader.read(at, rel);
    if (bytes) files.set(rel, bytes);
  };
  await mapLimit([ROLLUP, INDEX, RESULTS, EXAMPLES, TAGS], 5, put);

  // Per-session and per-job files, only for what the index and results name.
  const index = files.has(INDEX) ? tryJson(files.get(INDEX)) : null;
  const sessionIds = (Array.isArray(index?.sessions) ? index.sessions : []).map((s) => s?.session_id).filter((id) => SESSION_ID.test(id ?? ''));
  const results = files.has(RESULTS) ? tryJson(files.get(RESULTS)) : null;
  const jobIds = (Array.isArray(results?.results) ? results.results : []).map((r) => r?.id).filter((id) => JOB_ID.test(id ?? ''));
  await mapLimit([...sessionIds.map(sessionMetricsPath), ...jobIds.map(jobPath)], 8, put);
  const runs = (await reader.list(at, 'llm-dlc/traces')).filter((p) => RUN.test(p)).sort();
  // The run records themselves, for the feature loops; the briefs' names, for their campaigns.
  await mapLimit(runs, 8, put);
  const briefs = (await reader.list(at, 'llm-dlc/loops')).map((p) => p.match(BRIEF)?.[1]).filter(Boolean).sort();
  const languages = new Set(config.code.languages.map((l) => l.id));
  const code = reader.code ? await reader.code(at, { isCode: (f) => languages.has(classOf(f, config.code)), scripts: config.loops.scripts?.paths ?? [] }) : null;

  return { source: { repository, sha: at, ref: resolvedRef }, files, runs, briefs, code };
}

// --- Normalizing -----------------------------------------------------------

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isCount = (v) => Number.isInteger(v) && v >= 0;
const isInstant = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v)) && /^\d{4}-\d\d-\d\dT/.test(v);
const strOrNull = (v) => (typeof v === 'string' ? v : null);

/** A record's leading campaign name, as in 'application-core Phase 5 step 3: ...'. */
export const campaignOf = (text) => (typeof text === 'string' ? (text.match(/^([a-z][a-z0-9]*(?:-[a-z0-9]+)+)[ :]/)?.[1] ?? null) : null);

/**
 * Semantic signals from a result summary's trailing 'signals: a:b×2, c:d'.
 * Only tokens shaped like a signal (tool:outcome, an optional ×count) are
 * kept, so free text after them never reaches a record.
 */
export function parseSignals(summary) {
  const list = typeof summary === 'string' ? summary.match(/(?:^|;\s*)signals: (.*)$/)?.[1] : null;
  if (!list) return [];
  return list
    .split(/;\s*|,\s*/)
    .map((s) => s.trim().match(/^([a-z0-9][a-z0-9._-]*:[a-z0-9][a-z0-9._-]*)(?:×(\d+))?$/i))
    .filter(Boolean)
    .map((m) => ({ name: m[1], count: Math.max(1, Number(m[2] ?? 1)) }));
}

export function normalizeSources(raw, config = loadConfig()) {
  const specs = config.source.inputs;
  const specOf = (rel) =>
    specs.find((s) => new RegExp(`^${s.path.replace(/[.]/g, '\\.').replace(/\{[a-z]+\}/g, '[^/]+')}$`).test(rel));
  const inputs = new Map();

  // Parses an input and checks its schema name and fields. A missing optional input is null.
  const load = (rel) => {
    const spec = specOf(rel);
    const bytes = raw.files.get(rel);
    if (!bytes) {
      if (spec?.required) throw new SourceError('missing', `${rel} is missing at ${raw.source.sha}`, { path: rel });
      return null;
    }
    let json;
    try {
      json = JSON.parse(bytes);
    } catch (e) {
      throw new SourceError('malformed', `${rel} is not JSON: ${e.message}`, { path: rel });
    }
    if (!isObject(json)) throw new SourceError('malformed', `${rel} is not a JSON object`, { path: rel });
    const schema = typeof json.schema === 'string' ? json.schema : '';
    if (spec.schemas.length && !spec.schemas.includes(schema))
      throw new SourceError('schema', `${rel} has schema ${JSON.stringify(json.schema)}, not ${spec.schemas.join(' or ')}`, { path: rel });
    for (const field of FIELDS[spec.path] ?? [])
      if (!(field in json)) throw new SourceError('schema', `${rel} has no ${field}`, { path: rel });
    inputs.set(rel, { path: rel, sha256: sha256(bytes), bytes: bytes.length, schema });
    return json;
  };
  // A record that breaks the shape the importer relies on.
  const bad = (rel, what) => {
    throw new SourceError('schema', `${rel}: ${what}`, { path: rel });
  };
  const list = (rel, json, key) => (Array.isArray(json[key]) ? json[key] : bad(rel, `${key} is not a list`));

  const rollup = load(ROLLUP);
  const index = load(INDEX);
  const resultsDoc = load(RESULTS);
  const examplesDoc = load(EXAMPLES);
  const tagsDoc = load(TAGS);

  // Campaigns: the brief a session's latest run names.
  const sessionCampaign = new Map();
  for (const p of raw.runs ?? []) {
    const m = p.match(RUN);
    if (m) sessionCampaign.set(m[1], m[3]);
  }

  // Sessions and their calls, prompts, tool calls and commits.
  const calls = [];
  const sessions = [];
  const prompts = [];
  const tools = [];
  const sessionCommits = [];
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const rollupSessions = new Map();
  for (const [i, s] of list(ROLLUP, rollup, 'sessions').entries()) {
    if (!isObject(s) || typeof s.session_id !== 'string' || !isCount(s.api_calls) || typeof s.usd !== 'number')
      bad(ROLLUP, `sessions[${i}] lacks session_id, api_calls or usd`);
    rollupSessions.set(s.session_id, s);
  }
  for (const [i, s] of list(INDEX, index, 'sessions').entries()) {
    if (!isObject(s) || !SESSION_ID.test(s.session_id ?? '')) bad(INDEX, `sessions[${i}] has no valid session_id`);
    const rel = sessionMetricsPath(s.session_id);
    const metrics = load(rel);
    if (metrics) {
      if (metrics.session_id !== s.session_id) bad(rel, `session_id ${metrics.session_id} is not ${s.session_id}`);
      for (const [j, c] of list(rel, metrics, 'calls').entries()) {
        const at = `calls[${j}]`;
        if (!isObject(c) || !isInstant(c.start) || typeof c.model !== 'string') bad(rel, `${at} lacks start or model`);
        for (const k of ['input_tokens', 'cache_read_tokens', 'cache_write_tokens', 'output_tokens'])
          if (!isCount(c[k])) bad(rel, `${at}.${k} is not a count`);
        if (c.usd != null && (typeof c.usd !== 'number' || !Number.isFinite(c.usd) || c.usd < 0)) bad(rel, `${at}.usd is not a price`);
        calls.push({
          session: s.session_id,
          subagent: c.agent != null,
          start: new Date(c.start).toISOString(),
          model: c.model,
          effort: strOrNull(c.effort),
          inputTokens: c.input_tokens,
          cacheReadTokens: c.cache_read_tokens,
          cacheWriteTokens: c.cache_write_tokens,
          outputTokens: c.output_tokens,
          usd: typeof c.usd === 'number' ? c.usd : null,
        });
      }
      // Prompts: who sent each and what it set off. The text is read to tell
      // the sender (config/loops.json) and a command's name, and goes no further.
      for (const [j, q] of (Array.isArray(metrics.prompts) ? metrics.prompts : []).entries()) {
        if (!isObject(q) || !isInstant(q.ts) || typeof q.kind !== 'string') bad(rel, `prompts[${j}] lacks ts or kind`);
        const text = typeof q.text === 'string' ? q.text : '';
        prompts.push({
          session: s.session_id,
          start: new Date(q.ts).toISOString(),
          end: isInstant(q.end) ? new Date(q.end).toISOString() : null,
          sender: q.kind === 'human' ? senderOf(text, config.loops) : q.kind === 'command' ? 'command' : 'notification',
          command: q.kind === 'command' ? (text.match(/^\/[a-z][a-z-]*/)?.[0] ?? null) : null,
          calls: num(q.api_calls),
          toolCalls: num(q.tool_calls),
          toolErrors: num(q.tool_errors),
          outputTokens: num(q.output_tokens),
          usd: num(q.usd),
          agentMs: num(q.agent_ms),
        });
      }
      // Tool calls: the tool, how it ended, and the model call that made it.
      // Never the label or the error text.
      const callRows = metrics.calls;
      for (const [j, t] of (Array.isArray(metrics.tools) ? metrics.tools : []).entries()) {
        if (!isObject(t) || !isInstant(t.start) || typeof t.name !== 'string' || typeof t.status !== 'string') bad(rel, `tools[${j}] lacks start, name or status`);
        const by = Number.isInteger(t.call) ? callRows[t.call] : null;
        tools.push({
          session: s.session_id,
          start: new Date(t.start).toISOString(),
          name: t.name,
          family: strOrNull(t.family),
          status: t.status,
          errorKind: strOrNull(t.error_kind),
          model: typeof by?.model === 'string' ? by.model : null,
          contextTokens: isCount(by?.context_tokens) ? by.context_tokens : null,
        });
      }
      for (const c of Array.isArray(metrics.commits) ? metrics.commits : [])
        if (isObject(c) && isInstant(c.ts) && typeof c.change_id === 'string') sessionCommits.push({ session: s.session_id, at: new Date(c.ts).toISOString(), changeId: c.change_id });
    }
    sessions.push({
      id: s.session_id,
      title: strOrNull(s.title),
      status: strOrNull(s.status),
      started: strOrNull(s.started),
      ended: strOrNull(s.ended),
      models: Array.isArray(s.models) ? s.models.filter((m) => typeof m === 'string') : [],
      hasMetrics: Boolean(metrics),
      hasPrompts: Array.isArray(metrics?.prompts),
      hasTools: Array.isArray(metrics?.tools),
      inRollup: rollupSessions.has(s.session_id),
      campaign: sessionCampaign.get(s.session_id) ?? null,
    });
  }

  // Reconcile: the rollup's totals are the sum of the sessions it covers, and
  // each of those sessions' entry matches its own metrics file where there is one.
  const near = (a, b) => Math.abs(a - b) < 5e-5 + 1e-9 * Math.abs(b);
  const totals = isObject(rollup.totals) ? rollup.totals : bad(ROLLUP, 'totals is not an object');
  const covered = [...rollupSessions.values()];
  const sumCalls = covered.reduce((t, s) => t + s.api_calls, 0);
  const sumUsd = covered.reduce((t, s) => t + s.usd, 0);
  if (totals.api_calls !== sumCalls || !near(totals.usd, sumUsd))
    throw new SourceError('reconcile', `${ROLLUP}: totals say ${totals.api_calls} calls and $${totals.usd}, its sessions add up to ${sumCalls} calls and $${sumUsd.toFixed(6)}`, { path: ROLLUP });
  for (const s of sessions) {
    const r = rollupSessions.get(s.id);
    if (!r || !s.hasMetrics) continue;
    const own = calls.filter((c) => c.session === s.id);
    const usd = own.reduce((t, c) => t + (c.usd ?? 0), 0);
    if (own.length !== r.api_calls || !near(usd, r.usd))
      throw new SourceError('reconcile', `${sessionMetricsPath(s.id)}: ${own.length} calls and $${usd.toFixed(6)}, the rollup says ${r.api_calls} and $${r.usd}`, { path: sessionMetricsPath(s.id) });
  }
  for (const id of rollupSessions.keys())
    if (!sessions.some((s) => s.id === id)) bad(ROLLUP, `session ${id} is not in ${INDEX}`);

  // Changes, once per change id; housekeeping kept identifiable. A summary of
  // null is in-the-loop's working copy before its first commit message
  // (sync.py's commit_summary): not a change yet, so it is left out, as its own
  // session summaries leave it out. Its sessions' calls still count, from their
  // metrics files. If the same id also has a described row, its sessions join it.
  const housekeeping = new Set(config.source.housekeeping.summaries);
  const byChange = new Map();
  const undescribed = new Map();
  for (const [i, c] of list(ROLLUP, rollup, 'commits').entries()) {
    if (!isObject(c) || !/^[k-z]{32}$/.test(c.change_id ?? '') || (typeof c.summary !== 'string' && c.summary !== null)) bad(ROLLUP, `commits[${i}] lacks a change_id or summary`);
    const own = Array.isArray(c.sessions) ? c.sessions.filter((s) => typeof s === 'string') : [];
    if (c.summary === null) {
      undescribed.set(c.change_id, [...(undescribed.get(c.change_id) ?? []), ...own]);
      continue;
    }
    // What the rollup says the change took, where it says: the calls up to its commit.
    const took = isCount(c.api_calls) && isCount(c.output_tokens) ? { calls: c.api_calls, outputTokens: c.output_tokens, usd: num(c.usd) } : null;
    const seen = byChange.get(c.change_id);
    if (seen) {
      for (const s of own) if (!seen.sessions.includes(s)) seen.sessions.push(s);
      if (took) seen.took = seen.took ? { calls: seen.took.calls + took.calls, outputTokens: seen.took.outputTokens + took.outputTokens, usd: seen.took.usd + took.usd } : took;
      continue;
    }
    byChange.set(c.change_id, { changeId: c.change_id, summary: c.summary, sessions: [...own], housekeeping: housekeeping.has(c.summary), took });
  }
  for (const [id, own] of undescribed) {
    const seen = byChange.get(id);
    if (seen) for (const s of own) if (!seen.sessions.includes(s)) seen.sessions.push(s);
  }
  const changes = [...byChange.values()].map((c) => {
    const own = [...new Set(c.sessions.map((s) => sessionCampaign.get(s) ?? null))];
    return { ...c, campaign: campaignOf(c.summary) ?? (own.length === 1 ? own[0] : null) };
  });

  // Verification: every result, its process outcome apart from its signals.
  const verification = list(RESULTS, resultsDoc, 'results').map((r, i) => {
    const at = `results[${i}]`;
    if (!isObject(r) || !JOB_ID.test(r.id ?? '') || typeof r.title !== 'string') bad(RESULTS, `${at} lacks an id or title`);
    if (!['passed', 'failed'].includes(r.status)) bad(RESULTS, `${at}.status ${JSON.stringify(r.status)} is not passed or failed`);
    if (r.finishedAt != null && !isInstant(r.finishedAt)) bad(RESULTS, `${at}.finishedAt is not a time`);
    const job = load(jobPath(r.id));
    if (job && job.id !== r.id) bad(jobPath(r.id), `id ${job.id} is not ${r.id}`);
    const links = isObject(r.links) ? r.links : {};
    const strings = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
    const submittingSession = strOrNull(job?.submitted?.session);
    return {
      id: r.id,
      title: r.title,
      process: r.status,
      signals: parseSignals(r.summary),
      expected: strOrNull(job?.expected),
      attention: Array.isArray(r.attention) ? r.attention.length : 0,
      finishedAt: r.finishedAt ? new Date(r.finishedAt).toISOString() : null,
      wallSeconds: typeof r.wallSeconds === 'number' ? r.wallSeconds : null,
      peakMemoryBytes: Number.isInteger(r.peakMemoryBytes) ? r.peakMemoryBytes : null,
      capabilities: strings(r.capabilities),
      sourceCommit: strOrNull(r.sourceCommit),
      submittingSession,
      hasJob: Boolean(job),
      paths: [...strings(links.paths), ...strings(links.examples).map((x) => `examples/${x}`)],
      campaign: campaignOf(r.title) ?? (submittingSession ? (sessionCampaign.get(submittingSession) ?? null) : null),
    };
  });

  // Examples: the catalog's public facts and its one-paragraph summary of each,
  // never its working notes.
  const examples = list(EXAMPLES, examplesDoc, 'examples').map((x, i) => {
    if (!isObject(x) || typeof x.id !== 'string' || typeof x.title !== 'string') bad(EXAMPLES, `examples[${i}] lacks an id or title`);
    if (!['constructed', 'real-world'].includes(x.origin)) bad(EXAMPLES, `examples[${i}].origin ${JSON.stringify(x.origin)} is unknown`);
    const tags = isObject(x.tags) ? x.tags : {};
    const strings = (v) => (Array.isArray(v) ? v.filter((t) => typeof t === 'string') : []);
    return {
      id: x.id,
      title: x.title,
      origin: x.origin,
      system: strOrNull(x.system),
      verdict: strOrNull(x.verdict),
      verdictLabel: strOrNull(x.verdictLabel),
      vacuous: typeof x.vacuous === 'boolean' ? x.vacuous : null,
      freshness: strOrNull(x.snapshot),
      tags: { domain: strings(tags.domain), defect: strings(tags.defect), technique: strings(tags.technique) },
      // Where the example is in the repository, what it says of itself, and
      // the change it verifies when that was published elsewhere.
      path: typeof x.path === 'string' && /^examples\/[A-Za-z0-9._-]+$/.test(x.path) ? x.path : null,
      summary: strOrNull(x.summary),
      sourceUrl: typeof x.source === 'string' && /^https:\/\//.test(x.source) ? x.source : null,
      // The catalog's own answers: did the module's unit tests pass on the same
      // patch, how bad would the change be if it shipped unnoticed, what kind it is.
      testsPassed: typeof x.existingTestsPassed === 'boolean' ? x.existingTestsPassed : null,
      severity: strOrNull(x.severity),
      changeKind: strOrNull(x.changeKind),
    };
  });

  // Feature loop runs: each run record, in the campaign its loop's name gives.
  // A record that isn't one (no header) is left out and counted.
  const briefs = [...new Set([...(raw.briefs ?? []), ...(raw.runs ?? []).map((p) => p.match(RUN)?.[3]).filter(Boolean)])];
  const runs = [];
  let unreadRuns = 0;
  for (const p of raw.runs ?? []) {
    const m = p.match(RUN);
    const bytes = raw.files.get(p);
    if (!m || !bytes) continue;
    const record = parseRunRecord(bytes.toString('utf8'), config.loops);
    inputs.set(p, { path: p, sha256: sha256(bytes), bytes: bytes.length, schema: '' });
    if (!record) {
      unreadRuns++;
      continue;
    }
    runs.push({ id: m[2], loop: m[3], campaign: loopCampaign(m[3], briefs), ...record, session: m[1] });
  }
  runs.sort((a, b) => a.started.localeCompare(b.started) || a.id.localeCompare(b.id));

  // Code: git's own account of each commit, where the source was a checkout.
  const code = raw.code
    ? {
        commits: parseGitLog(raw.code.log, config.code),
        tree: parseTree(raw.code.tree, config.code),
        // The code lines each commit still holds at this revision, where the reader blamed them.
        blame: typeof raw.code.blame === 'string' ? parseBlame(raw.code.blame) : null,
        scripts: typeof raw.code.scripts === 'string' ? parseScriptLog(raw.code.scripts) : null,
      }
    : null;

  // The tag vocabulary: names only.
  const tags = Object.fromEntries(['domain', 'defect', 'technique'].map((k) => [k, isObject(tagsDoc[k]) ? Object.keys(tagsDoc[k]).sort() : []]));

  return {
    source: { repository: raw.source.repository, sha: raw.source.sha, inputs: [...inputs.values()].sort((a, b) => a.path.localeCompare(b.path)) },
    pricingAsOf: strOrNull(rollup.pricing_as_of),
    rollup: { calls: totals.api_calls, usd: totals.usd, sessions: rollupSessions.size },
    calls,
    sessions,
    changes,
    verification,
    examples,
    tags,
    prompts,
    tools,
    sessionCommits,
    runs,
    unreadRuns,
    code,
  };
}

// --- Refreshing ------------------------------------------------------------

const SNAPSHOT_DIR = /^sf1-[0-9a-f]{16}$/;
const SNAPSHOT_NAME = /sf1-[0-9a-f]{16}/g;
const instant = (now) => new Date(now ?? Date.now()).toISOString().replace(/\.\d{3}Z$/, 'Z');
const readPointer = (dataDir) => {
  try {
    const pointer = JSON.parse(fs.readFileSync(path.join(dataDir, 'latest.json'), 'utf8'));
    return validate('pointer', pointer).length ? null : pointer;
  } catch {
    return null;
  }
};

/** Every file under dir, as relative path -> bytes, in path order. */
function tree(dir, base = dir, out = new Map()) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) tree(file, base, out);
    else out.set(path.relative(base, file).split(path.sep).join('/'), fs.readFileSync(file));
  }
  return out;
}

const sameTree = (a, b) => a.size === b.size && [...a].every(([rel, bytes]) => b.get(rel)?.equals(bytes));

/**
 * The snapshot ids posts depend on: every sf1- id written anywhere in a post's
 * evidence.json, read as text, so that a draft's or a malformed file's still
 * count. Never deleted by a refresh.
 */
export function namedSnapshots(postsDir = POSTS_DIR) {
  const ids = new Set();
  if (!fs.existsSync(postsDir)) return ids;
  for (const entry of fs.readdirSync(postsDir, { withFileTypes: true })) {
    const file = path.join(postsDir, entry.name, 'evidence.json');
    if (entry.isDirectory() && fs.existsSync(file)) for (const id of fs.readFileSync(file, 'utf8').match(SNAPSHOT_NAME) ?? []) ids.add(id);
  }
  return ids;
}

export async function refresh({
  ref,
  sha,
  checkout,
  dir,
  fetchImpl,
  dataDir = DATA_DIR,
  postsDir = POSTS_DIR,
  now,
  config = loadConfig(),
} = {}) {
  const at = instant(now);
  const current = readPointer(dataDir);
  const failed = (e, sourceSha = null) => ({
    outcome: 'failed',
    snapshotId: current?.snapshotId ?? null,
    sha: sourceSha,
    code: e.code ?? 'error',
    path: e.path ?? null,
    error: e.message,
  });

  // Everything that can fail happens before data/ is touched, in a staging
  // directory beside it (so on the same filesystem, for the renames).
  fs.mkdirSync(path.dirname(path.resolve(dataDir)), { recursive: true });
  const staging = fs.mkdtempSync(path.join(path.dirname(path.resolve(dataDir)), '.software-factory-refresh-'));
  let sourceSha = null;
  try {
    let built;
    try {
      const raw = await readSources({ ref, sha, checkout, dir, fetchImpl, config });
      sourceSha = raw.source.sha;
      built = aggregate(normalizeSources(raw, config), { config });
    } catch (e) {
      return failed(e, sourceSha);
    }
    const id = built.manifest.snapshotId;
    const rel = `snapshots/${id}`;
    fs.mkdirSync(path.join(staging, rel, 'details'), { recursive: true });
    fs.writeFileSync(path.join(staging, rel, 'manifest.json'), serialize(built.manifest));
    for (const f of collectionFiles(built)) fs.writeFileSync(path.join(staging, rel, f.path), f.text);

    const target = path.join(dataDir, rel);
    const exists = fs.existsSync(target);
    if (exists && !sameTree(tree(target), tree(path.join(staging, rel))))
      return failed({ code: 'conflict', message: `${rel} already exists with other content: the same id must mean the same files` }, sourceSha);
    const unchanged = exists && current?.snapshotId === id;
    const pointer = {
      schema: 'software-factory-pointer/v1',
      snapshotId: id,
      manifest: `${rel}/manifest.json`,
      publishedAt: unchanged ? current.publishedAt : at,
      lastSourceCheck: { at, sha: sourceSha, outcome: unchanged ? 'unchanged' : 'new-snapshot', error: null },
    };
    fs.writeFileSync(path.join(staging, 'latest.json'), serialize(pointer));
    const problems = validateSnapshotDir(staging);
    if (problems.length) return failed({ code: 'invalid', message: `the new snapshot failed validation: ${problems.join('; ')}` }, sourceSha);

    // Validated: add the snapshot, then replace the pointer in one rename.
    if (!exists) {
      fs.mkdirSync(path.join(dataDir, 'snapshots'), { recursive: true });
      fs.renameSync(path.join(staging, rel), target);
    }
    fs.renameSync(path.join(staging, 'latest.json'), path.join(dataDir, 'latest.json'));

    // Retention, after a new pointer only: the current snapshot and every one a post names stay.
    const pruned = [];
    if (!unchanged) {
      const keep = new Set([id, ...namedSnapshots(postsDir)]);
      for (const name of fs.readdirSync(path.join(dataDir, 'snapshots')).sort())
        if (SNAPSHOT_DIR.test(name) && !keep.has(name)) {
          fs.rmSync(path.join(dataDir, 'snapshots', name), { recursive: true });
          pruned.push(name);
        }
    }
    return { outcome: pointer.lastSourceCheck.outcome, snapshotId: id, sha: sourceSha, pruned, error: null };
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}
