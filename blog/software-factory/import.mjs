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

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_DIR, sha256 } from './identity.mjs';

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
  return { source: read('source.json'), areas: read('areas.json'), models: read('models.json') };
}

const SHA = /^[0-9a-f]{40}$/;
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const JOB_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const RUN = /^llm-dlc\/traces\/([^/]+)\/runs\/\d{4}-\d\d-\d\d-\d{6}-([a-z0-9][a-z0-9-]*)\.md$/;
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
  return {
    resolve(ref) {
      try {
        return git(['rev-parse', '--verify', `${ref}^{commit}`]).toString().trim();
      } catch {
        throw new SourceError('missing', `no revision ${ref} in ${checkout}`);
      }
    },
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
  const at = sha ?? (await reader.resolve(resolvedRef));
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

  return { source: { repository, sha: at, ref: resolvedRef }, files, runs };
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
    if (m) sessionCampaign.set(m[1], m[2]);
  }

  // Sessions and their calls.
  const calls = [];
  const sessions = [];
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
    }
    sessions.push({
      id: s.session_id,
      title: strOrNull(s.title),
      status: strOrNull(s.status),
      started: strOrNull(s.started),
      ended: strOrNull(s.ended),
      models: Array.isArray(s.models) ? s.models.filter((m) => typeof m === 'string') : [],
      hasMetrics: Boolean(metrics),
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

  // Changes, once per change id; housekeeping kept identifiable.
  const housekeeping = new Set(config.source.housekeeping.summaries);
  const byChange = new Map();
  for (const [i, c] of list(ROLLUP, rollup, 'commits').entries()) {
    if (!isObject(c) || !/^[k-z]{32}$/.test(c.change_id ?? '') || typeof c.summary !== 'string') bad(ROLLUP, `commits[${i}] lacks a change_id or summary`);
    const own = Array.isArray(c.sessions) ? c.sessions.filter((s) => typeof s === 'string') : [];
    const seen = byChange.get(c.change_id);
    if (seen) {
      for (const s of own) if (!seen.sessions.includes(s)) seen.sessions.push(s);
      continue;
    }
    byChange.set(c.change_id, { changeId: c.change_id, summary: c.summary, sessions: [...own], housekeeping: housekeeping.has(c.summary) });
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

  // Examples: the catalog's public facts, never its summaries or notes.
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
    };
  });

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
  };
}

export async function refresh() {
  throw new Error('import.mjs refresh: not implemented yet (stream A, phase A4)');
}
