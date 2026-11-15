// Loading a Software Factory snapshot in the browser: the pointer, its manifest
// and the overview, all from one base, checked before anything is shown. The
// network is passed in (fetch), so Node tests run the same code on files.
//
//   loadSnapshot(base, { fetch, signal, etag, current })
//     -> { status: 'unchanged', etag }            the pointer answered 304
//      | { status: 'same', pointer, etag }        same snapshot, newer source check
//      | { status: 'new', snapshot, etag }        snapshot = { base, pointer, manifest, overview }
//     Throws a SnapshotError when anything is missing or fails its check.
//   firstSnapshot({ remote, bundled, fetch, signal, timeout })
//     -> { snapshot, source: 'remote' | 'bundled', etag, remoteError }
//     The remote snapshot, or on any failure the bundled one, whole: never a
//     pointer from one and files from the other. remoteError.missing is true
//     when the remote route itself is missing (a 404 or a page that isn't
//     JSON), and false for a failure that may pass, the Function's "nothing
//     published yet" 404 (Software-Factory-Data: none) included.
//   loadCollection(snapshot, name, { fetch, signal }) -> a details file, checked
//   newRecords(oldManifest, newManifest) -> [{ name, added }] for the announcement
//
// The checks cover what the page relies on and the snapshot's integrity (the
// same snapshot id throughout, and each file's bytes and SHA-256 as its
// manifest records them). The full schema check is validate.mjs, run by the
// build and the refresh; schema.json isn't public.

export class SnapshotError extends Error {
  constructor(message, { missing = false } = {}) {
    super(message);
    this.name = 'SnapshotError';
    this.missing = missing;
  }
}

const ID = /^sf1-[0-9a-f]{16}$/;
const SHA = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isCount = (v) => Number.isInteger(v) && v >= 0;
/** Where every snapshot so far keeps its overview, relative to its manifest. */
const OVERVIEW = 'overview.json';

/** Problems with a latest.json; empty when it can be used. */
export function checkPointer(p) {
  if (!isObject(p)) return ['latest.json: not an object'];
  const problems = [];
  if (p.schema !== 'software-factory-pointer/v1') problems.push(`latest.json: schema ${JSON.stringify(p.schema)}`);
  if (!ID.test(p.snapshotId)) problems.push('latest.json: bad snapshotId');
  if (p.manifest !== `snapshots/${p.snapshotId}/manifest.json`) problems.push('latest.json: manifest is not the snapshot’s');
  if (typeof p.publishedAt !== 'string') problems.push('latest.json: no publishedAt');
  const check = p.lastSourceCheck;
  if (!isObject(check) || typeof check.at !== 'string' || !['new-snapshot', 'unchanged', 'failed'].includes(check.outcome))
    problems.push('latest.json: bad lastSourceCheck');
  return problems;
}

/** Problems with a manifest, given the pointer that named it. */
export function checkManifest(m, pointer) {
  if (!isObject(m)) return ['manifest: not an object'];
  const problems = [];
  if (m.schema !== 'software-factory-snapshot/v1') problems.push(`manifest: schema ${JSON.stringify(m.schema)}`);
  if (m.snapshotId !== pointer.snapshotId) problems.push(`manifest: snapshotId ${m.snapshotId}, but latest.json says ${pointer.snapshotId}`);
  if (!isObject(m.source) || !SHA.test(m.source.sha) || !(Array.isArray(m.source.inputs) || isCount(m.source.inputCount))) problems.push('manifest: bad source');
  if (m.timezone !== 'America/Toronto') problems.push('manifest: timezone');
  if (!Array.isArray(m.datasets)) problems.push('manifest: no datasets');
  if (!Array.isArray(m.collections)) problems.push('manifest: no collections');
  else {
    for (const c of m.collections)
      if (!isObject(c) || typeof c.name !== 'string' || typeof c.path !== 'string' || /^\/|\.\./.test(c.path) || !SHA256.test(c.sha256) || !isCount(c.bytes) || !isCount(c.records))
        problems.push(`manifest: bad collection ${JSON.stringify(c?.name)}`);
    if (!m.collections.some((c) => c?.name === 'overview')) problems.push('manifest: no overview');
  }
  return problems;
}

const table = (t, columns) =>
  isObject(t) && Array.isArray(t.columns) && columns.every((c) => t.columns.includes(c)) && Array.isArray(t.rows) && t.rows.every((r) => Array.isArray(r) && r.length === t.columns.length);

/** Problems with an overview.json's content. */
export function checkOverview(o, manifest) {
  if (!isObject(o)) return ['overview: not an object'];
  const problems = [];
  if (o.schema !== 'software-factory-overview/v1') problems.push(`overview: schema ${JSON.stringify(o.schema)}`);
  if (o.snapshotId !== manifest.snapshotId) problems.push(`overview: snapshotId ${o.snapshotId}, not ${manifest.snapshotId}`);
  if (!Array.isArray(o.days) || !o.days.every((d, i) => DAY.test(d) && (i === 0 || d > o.days[i - 1]))) problems.push('overview: bad days');
  if (!Array.isArray(o.models) || !o.models.every((m) => isObject(m) && typeof m.id === 'string' && typeof m.label === 'string')) problems.push('overview: bad models');
  if (!Array.isArray(o.efforts) || !o.efforts.every((x) => typeof x === 'string')) problems.push('overview: bad efforts');
  if (!table(o.usage, ['day', 'model', 'effort', 'calls', 'pricedCalls', 'usd', 'inputTokens', 'cacheReadTokens', 'cacheWriteTokens'])) problems.push('overview: bad usage table');
  if (!table(o.verification, ['day', 'status', 'wallSeconds'])) problems.push('overview: bad verification table');
  if (!Array.isArray(o.measures) || !o.measures.every((m) => isObject(m) && typeof m.id === 'string')) problems.push('overview: bad measures');
  if (!isObject(o.stocks) || !isObject(o.stocks.changes) || !isObject(o.stocks.examples)) problems.push('overview: bad stocks');
  if (!Array.isArray(o.breakdowns) || !o.breakdowns.every((b) => isObject(b) && typeof b.id === 'string' && Array.isArray(b.rows))) problems.push('overview: bad breakdowns');
  if (!Array.isArray(o.insights) || !o.insights.every((i) => isObject(i) && typeof i.text === 'string' && isObject(i.evidence))) problems.push('overview: bad insights');
  return problems;
}

/** Lowercase hex SHA-256 of bytes, or null where the browser has no SubtleCrypto (plain http). */
export async function sha256Hex(bytes) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const digest = new Uint8Array(await subtle.digest('SHA-256', bytes));
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Problems with a file's bytes against its manifest entry. */
export async function checkBytes(bytes, collection) {
  const problems = [];
  if (bytes.byteLength !== collection.bytes) problems.push(`${collection.path}: ${bytes.byteLength} bytes, manifest says ${collection.bytes}`);
  else {
    const hash = await sha256Hex(bytes);
    if (hash !== null && hash !== collection.sha256) problems.push(`${collection.path}: SHA-256 differs from the manifest`);
  }
  return problems;
}

/** GET a JSON file: { status, etag, bytes, json }. 304 has no body. */
async function getJson(url, { fetch, signal, etag = null, conditional = false }) {
  const headers = conditional && etag ? { 'If-None-Match': etag } : {};
  let res;
  try {
    res = await fetch(url, { headers, signal, cache: conditional ? 'no-store' : 'default', credentials: 'same-origin' });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new SnapshotError(`${url}: ${err?.message ?? 'network error'}`);
  }
  if (res.status === 304) return { status: 304, etag };
  // The Function's empty bucket: the route is there, its first publish is still to come.
  if (res.status === 404 && res.headers.get('Software-Factory-Data') === 'none')
    throw new SnapshotError(`${url}: nothing published yet`);
  if (res.status === 404) throw new SnapshotError(`${url}: not found`, { missing: true });
  if (!res.ok) throw new SnapshotError(`${url}: HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let json;
  try {
    json = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    // A static host answers an unknown path with an HTML page: a missing route.
    throw new SnapshotError(`${url}: not JSON`, { missing: true });
  }
  return { status: res.status, etag: res.headers.get('ETag'), bytes, json };
}

const fail = (problems) => {
  if (problems.length) throw new SnapshotError(problems[0]);
};

/** The URL of a file listed in the snapshot's manifest. */
export const collectionUrl = (snapshot, path) => `${snapshot.base}${snapshot.pointer.manifest.replace(/manifest\.json$/, '')}${path}`;

export async function loadSnapshot(base, { fetch, signal, etag = null, current = null } = {}) {
  const head = await getJson(`${base}latest.json`, { fetch, signal, etag, conditional: true });
  if (head.status === 304) return { status: 'unchanged', etag: head.etag };
  const pointer = head.json;
  fail(checkPointer(pointer));
  // A snapshot id is derived from content: the same id is the same data, whichever base served it.
  if (current && current.pointer.snapshotId === pointer.snapshotId)
    return { status: 'same', pointer, etag: head.etag };
  // Immutable files: the browser's cache may answer them. The overview is asked
  // for beside the manifest, at the path every snapshot uses, to save a round
  // trip; it is used only if the manifest lists it there, and checked against it.
  const snapshot = { base, pointer, manifest: null, overview: null };
  const early = getJson(collectionUrl(snapshot, OVERVIEW), { fetch, signal });
  early.catch(() => {}); // its failure counts only once the manifest says it is the overview
  const manifest = (await getJson(`${base}${pointer.manifest}`, { fetch, signal })).json;
  fail(checkManifest(manifest, pointer));
  const entry = manifest.collections.find((c) => c.name === 'overview');
  snapshot.manifest = manifest;
  const file = entry.path === OVERVIEW ? await early : await getJson(collectionUrl(snapshot, entry.path), { fetch, signal });
  fail(await checkBytes(file.bytes, entry));
  fail(checkOverview(file.json, manifest));
  snapshot.overview = file.json;
  return { status: 'new', snapshot, etag: head.etag };
}

/** A signal that also aborts after ms, where the browser can combine signals. */
function withTimeout(signal, ms) {
  if (!ms || typeof AbortSignal?.timeout !== 'function' || typeof AbortSignal.any !== 'function') return signal;
  return signal ? AbortSignal.any([signal, AbortSignal.timeout(ms)]) : AbortSignal.timeout(ms);
}

export async function firstSnapshot({ remote, bundled, fetch, signal, timeout = 8000 }) {
  let remoteError = null;
  if (remote) {
    try {
      const r = await loadSnapshot(remote, { fetch, signal: withTimeout(signal, timeout) });
      return { snapshot: r.snapshot, source: 'remote', etag: r.etag, remoteError };
    } catch (err) {
      if (signal?.aborted) throw err;
      remoteError = err;
    }
  }
  const b = await loadSnapshot(bundled, { fetch, signal });
  return { snapshot: b.snapshot, source: 'bundled', etag: b.etag, remoteError };
}

/** A details file of the loaded snapshot, from the same base, checked. */
export async function loadCollection(snapshot, name, { fetch, signal }) {
  const entry = snapshot.manifest.collections.find((c) => c.name === name);
  if (!entry) throw new SnapshotError(`${name}: not in this snapshot`, { missing: true });
  const file = await getJson(collectionUrl(snapshot, entry.path), { fetch, signal });
  fail(await checkBytes(file.bytes, entry));
  const json = file.json;
  if (!isObject(json) || json.snapshotId !== snapshot.manifest.snapshotId || !Array.isArray(json.records))
    throw new SnapshotError(`${entry.path}: not this snapshot’s ${name}`);
  return json;
}

/** Collections with more records in the new manifest than the old: the announcement's count. */
export function newRecords(oldManifest, newManifest) {
  const before = Object.fromEntries((oldManifest?.collections ?? []).map((c) => [c.name, c.records]));
  return newManifest.collections
    .filter((c) => c.name !== 'overview' && c.records > (before[c.name] ?? 0))
    .map((c) => ({ name: c.name, added: c.records - (before[c.name] ?? 0) }));
}
