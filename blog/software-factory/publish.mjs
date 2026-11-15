// Publishing a Software Factory snapshot to R2, where the Pages Function
// functions/software-factory/data/[[path]].js serves it (docs/software-factory.md,
// Milestone 2). Coordinator-owned. The CLI is `npm run software-factory:publish`.
//
//   publish({ store, order, ref, sha, checkout, dir, fetchImpl, now, config })
//     -> Promise<{ outcome, snapshotId, sha, previous, uploaded, pruned, pruneError, step, code, error }>
//
//   1. refresh: import.mjs's refresh() into an empty staging directory, which
//      builds the snapshot and validates it; then validateSnapshotDir again.
//   2. remote: read the destination's latest.json and, when it names another
//      snapshot, that snapshot's manifest, for its source commit.
//   3. order: when the source commits differ, order(theirs, ours) must say
//      'ahead' (ours descends from theirs). Otherwise the outcome is 'refused'
//      and nothing is written: a pointer is never replaced by one whose
//      snapshot comes from an older (or unrelated) source commit.
//   4. upload: each of the snapshot's files that the store doesn't already
//      hold byte for byte is put, then read back, and its sha256 checked.
//   5. pointer: only then latest.json, as a conditional put (If-Match the ETag
//      read in step 2, or If-None-Match: * when there was none), so a pointer
//      another run wrote meanwhile is never overwritten. It is read back too.
//      The same snapshot as the current pointer is 'unchanged': only
//      lastSourceCheck moves. A new one is 'new-snapshot', with publishedAt now.
//
//   6. prune: once the pointer is written and read back, the snapshots a newer
//      upload superseded more than PRUNE_AFTER_MS (a day) ago are deleted, every
//      file of each (pruned lists their ids). The pointer's snapshot is never
//      one, nor any key outside the snapshot layout, and a day lets an open tab
//      still load the details of the snapshot it shows. Best effort: a failure
//      here is pruneError, never a failed outcome, and the next run tries again.
//      Posts don't need old snapshots: each copies its own evidence.
//
//   A failure at any step is outcome 'failed', with the step, a code and the
//   error. latest.json is then the previous one: nothing before step 5 writes
//   it. A failed source check doesn't touch the pointer either, so
//   lastSourceCheck stays the last successful one.
//
//   store: { get(key) -> { body: Buffer, etag } | null,
//            put(key, body, { contentType, ifMatch, ifNoneMatch }) -> { etag },
//            list(prefix) -> [{ key, lastModified }], delete(key) },
//     throwing StoreError (status 412 for a failed condition). Keys are the
//     Function's: latest.json and snapshots/<id>/(manifest|overview|details/*).json.
//   order: async (base, head) -> 'ahead' | 'behind' | 'identical' | 'diverged'.
//
//   s3Store({ accountId, accessKeyId, secretAccessKey, bucket }) is R2's
//   S3-compatible API at https://<accountId>.r2.cloudflarestorage.com, signed
//   with SigV4 here (signRequest), no dependency. credentialsFromEnv() reads
//   the three SOFTWARE_FACTORY_R2_* variables and nothing else. sourceOrder()
//   compares commits in a local checkout, or with GitHub's compare API.
//   DESTINATIONS names each destination's bucket, as wrangler.toml binds them.

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { serialize } from './identity.mjs';
import { loadConfig, refresh as importRefresh } from './import.mjs';
import { validate, validateSnapshotDir } from './validate.mjs';

export const DESTINATIONS = { preview: 'software-factory-data-preview', production: 'software-factory-data' };
export const CREDENTIALS = ['SOFTWARE_FACTORY_R2_ACCOUNT_ID', 'SOFTWARE_FACTORY_R2_ACCESS_KEY_ID', 'SOFTWARE_FACTORY_R2_SECRET_ACCESS_KEY'];
export const POINTER = 'latest.json';
/** How long a superseded snapshot stays, for tabs still showing it. */
export const PRUNE_AFTER_MS = 24 * 60 * 60 * 1000;
const SNAPSHOT_KEY = /^snapshots\/(sf1-[0-9a-f]{16})\/(?:manifest|overview|details\/(?:sessions|changes|verification|examples|loops|inputs))\.json$/;
const JSON_TYPE = 'application/json; charset=utf-8';
const SHA = /^[0-9a-f]{40}$/;
const RELATIONS = ['ahead', 'behind', 'identical', 'diverged'];

export class PublishError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PublishError';
    this.code = code;
  }
}

export class StoreError extends Error {
  /** status: the HTTP status (412 when a condition failed); code: S3's error code, when it gave one. */
  constructor(message, { status = null, code = null } = {}) {
    super(message);
    this.name = 'StoreError';
    this.status = status;
    this.code = code;
  }
}

const hex = (data) => crypto.createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
const instant = (now) => new Date(now ?? Date.now()).toISOString().replace(/\.\d{3}Z$/, 'Z');

// --- Credentials -------------------------------------------------------------

/** The R2 token, from the three variables only. Errors name what is missing, never a value. */
export function credentialsFromEnv(env = process.env) {
  const missing = CREDENTIALS.filter((name) => !env[name]?.trim());
  if (missing.length) throw new PublishError('credentials', `missing ${missing.join(', ')}`);
  const [accountId, accessKeyId, secretAccessKey] = CREDENTIALS.map((name) => env[name].trim());
  return { accountId, accessKeyId, secretAccessKey };
}

// --- SigV4 -------------------------------------------------------------------

/** RFC 3986 encoding, as SigV4 asks: everything but A-Z a-z 0-9 - . _ ~ */
const uriEncode = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/**
 * The headers that sign a request with AWS Signature Version 4: the given
 * headers (lowercased), x-amz-date, x-amz-content-sha256 and authorization.
 * Host is signed from the URL; fetch sends the same value itself.
 */
export function signRequest({ method, url, headers = {}, body = '', accessKeyId, secretAccessKey, region = 'auto', service = 's3', now = new Date() }) {
  const u = new URL(url);
  const amzDate = instant(now).replace(/[-:]/g, '');
  const day = amzDate.slice(0, 8);
  const payload = hex(body ?? '');
  const given = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v)]));
  const signed = { ...given, host: u.host, 'x-amz-date': amzDate, 'x-amz-content-sha256': payload };
  const names = Object.keys(signed).sort();
  const query = [...u.searchParams]
    .map(([k, v]) => `${uriEncode(k)}=${uriEncode(v)}`)
    .sort()
    .join('&');
  const canonical = [
    method,
    u.pathname, // already encoded, once: S3 doesn't double-encode
    query,
    names.map((n) => `${n}:${signed[n].trim().replace(/\s+/g, ' ')}\n`).join(''),
    names.join(';'),
    payload,
  ].join('\n');
  const scope = `${day}/${region}/${service}/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, hex(canonical)].join('\n');
  const key = [day, region, service, 'aws4_request'].reduce((k, part) => hmac(k, part), `AWS4${secretAccessKey}`);
  const signature = crypto.createHmac('sha256', key).update(toSign).digest('hex');
  const { host, ...out } = signed;
  out.authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`;
  return out;
}

// --- R2 through its S3-compatible API ----------------------------------------

/** A store on one R2 bucket, path-style: <endpoint>/<bucket>/<key>. */
export function s3Store({ accountId, accessKeyId, secretAccessKey, bucket, endpoint, fetchImpl = globalThis.fetch, clock = () => new Date(), timeoutMs = 30_000 }) {
  if (!endpoint) {
    if (!/^[0-9a-f]{32}$/.test(accountId ?? '')) throw new PublishError('credentials', 'SOFTWARE_FACTORY_R2_ACCOUNT_ID is not a Cloudflare account id (32 hex digits)');
    endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  }
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket ?? '')) throw new PublishError('destination', `not a bucket name: ${bucket}`);
  const base = endpoint.replace(/\/+$/, '');

  async function send(method, key, { body, headers = {}, query } = {}) {
    const url = query ? `${base}/${bucket}?${query}` : `${base}/${bucket}/${key.split('/').map(uriEncode).join('/')}`;
    const signed = signRequest({ method, url, headers, body: body ?? '', accessKeyId, secretAccessKey, now: clock() });
    try {
      return await fetchImpl(url, { method, headers: signed, body, signal: AbortSignal.timeout(timeoutMs) });
    } catch (e) {
      throw new StoreError(`${method} ${key}: ${e.message}`);
    }
  }
  async function failure(method, key, res) {
    const text = await res.text().catch(() => '');
    const code = text.match(/<Code>([^<]*)<\/Code>/)?.[1] ?? null;
    return new StoreError(`${method} ${key}: ${res.status}${code ? ` ${code}` : ''}`, { status: res.status, code });
  }

  return {
    name: `r2:${bucket}`,
    async get(key) {
      const res = await send('GET', key);
      if (res.status === 404) {
        // A missing key is null; a missing bucket is an error, not an empty destination.
        const code = (await res.text().catch(() => '')).match(/<Code>([^<]*)<\/Code>/)?.[1] ?? null;
        if (code && code !== 'NoSuchKey') throw new StoreError(`GET ${key}: 404 ${code}`, { status: 404, code });
        return null;
      }
      if (res.status !== 200) throw await failure('GET', key, res);
      return { body: Buffer.from(await res.arrayBuffer()), etag: res.headers.get('etag') };
    },
    async put(key, body, { contentType = JSON_TYPE, ifMatch, ifNoneMatch } = {}) {
      const headers = { 'content-type': contentType };
      if (ifMatch) headers['if-match'] = ifMatch;
      if (ifNoneMatch) headers['if-none-match'] = ifNoneMatch;
      const res = await send('PUT', key, { body, headers });
      if (res.status !== 200) throw await failure('PUT', key, res);
      await res.body?.cancel();
      return { etag: res.headers.get('etag') };
    },
    /** Every key under prefix with its LastModified, through ListObjectsV2's pages. */
    async list(prefix) {
      const out = [];
      let token = null;
      do {
        const query = new URLSearchParams({ 'list-type': '2', prefix, ...(token ? { 'continuation-token': token } : {}) }).toString();
        const res = await send('GET', '', { query });
        if (res.status !== 200) throw await failure('LIST', prefix, res);
        const xml = await res.text();
        for (const [, item] of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
          const key = unxml(item.match(/<Key>([^<]*)<\/Key>/)?.[1]);
          const lastModified = item.match(/<LastModified>([^<]*)<\/LastModified>/)?.[1];
          if (!key || !lastModified) throw new StoreError(`LIST ${prefix}: an entry without a key or a date`);
          out.push({ key, lastModified });
        }
        token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? unxml(xml.match(/<NextContinuationToken>([^<]*)<\/NextContinuationToken>/)?.[1]) : null;
        if (token === undefined) throw new StoreError(`LIST ${prefix}: truncated without a continuation token`);
      } while (token);
      return out;
    },
    async delete(key) {
      const res = await send('DELETE', key);
      if (res.status !== 204 && res.status !== 200) throw await failure('DELETE', key, res);
      await res.body?.cancel();
    },
  };
}

const XML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unxml = (s) => s?.replace(/&(amp|lt|gt|quot|apos);/g, (_, e) => XML_ENTITIES[e]);

/**
 * The snapshots to delete, from a listing of snapshots/: each one a later
 * upload superseded at least graceMs before now, never keepId's, and only keys
 * of the snapshot layout. A snapshot's upload time is its newest file's.
 *   -> [{ id, keys }]
 */
export function supersededSnapshots(listing, keepId, now, graceMs = PRUNE_AFTER_MS) {
  const snapshots = new Map();
  for (const { key, lastModified } of listing) {
    const id = key.match(SNAPSHOT_KEY)?.[1];
    if (!id) continue;
    const t = Date.parse(lastModified);
    if (!Number.isFinite(t)) throw new PublishError('prune', `${key}: not a date, ${lastModified}`);
    const s = snapshots.get(id) ?? { id, uploaded: -Infinity, keys: [] };
    s.uploaded = Math.max(s.uploaded, t);
    s.keys.push(key);
    snapshots.set(id, s);
  }
  // A listing without the pointer's own snapshot is not one to delete by.
  if (!snapshots.has(keepId)) throw new PublishError('prune', `the listing doesn't include the pointer's snapshot ${keepId}`);
  const times = [...snapshots.values()].map((s) => s.uploaded);
  return [...snapshots.values()]
    .filter((s) => {
      if (s.id === keepId) return false;
      const next = Math.min(...times.filter((t) => t > s.uploaded)); // when a later upload superseded it
      return Number.isFinite(next) && Date.parse(now) - next >= graceMs;
    })
    .map(({ id, keys }) => ({ id, keys: keys.sort() }));
}

// --- Source order ------------------------------------------------------------

/**
 * How head relates to base in in-the-loop's history: 'ahead' when head
 * descends from base. From a local checkout (git merge-base --is-ancestor),
 * or from GitHub's compare API (a token is optional, for its rate limit).
 */
export function sourceOrder({ checkout, repository = loadConfig().source.repository, fetchImpl = globalThis.fetch, token } = {}) {
  const check = (base, head) => {
    if (!SHA.test(base) || !SHA.test(head)) throw new PublishError('order', `not commit SHAs: ${base}, ${head}`);
  };
  if (checkout) {
    const isAncestor = (a, b) => {
      try {
        execFileSync('git', ['-C', checkout, 'merge-base', '--is-ancestor', a, b], { stdio: 'ignore' });
        return true;
      } catch (e) {
        if (e.status === 1) return false;
        throw new PublishError('order', `git can't compare ${a} and ${b} in ${checkout}`);
      }
    };
    return async (base, head) => {
      check(base, head);
      if (base === head) return 'identical';
      if (isAncestor(base, head)) return 'ahead';
      return isAncestor(head, base) ? 'behind' : 'diverged';
    };
  }
  return async (base, head) => {
    check(base, head);
    const headers = { accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'software-factory-publisher' };
    if (token) headers.authorization = `Bearer ${token}`;
    let res;
    try {
      res = await fetchImpl(`https://api.github.com/repos/${repository}/compare/${base}...${head}?per_page=1`, { headers });
    } catch (e) {
      throw new PublishError('order', `GitHub compare failed: ${e.message}`);
    }
    if (!res.ok) throw new PublishError('order', `GitHub compare answered ${res.status}`);
    const { status } = await res.json();
    if (!RELATIONS.includes(status)) throw new PublishError('order', `GitHub compare gave no status`);
    return status;
  };
}

// --- Publishing --------------------------------------------------------------

/** Every file under dir, as relative path -> bytes, in path order. */
function tree(dir, base = dir, out = new Map()) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) tree(file, base, out);
    else out.set(path.relative(base, file).split(path.sep).join('/'), fs.readFileSync(file));
  }
  return out;
}

function parseRecord(name, bytes, what) {
  let value;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new PublishError('remote', `${what} is not JSON`);
  }
  const problems = validate(name, value);
  if (problems.length) throw new PublishError('remote', `${what} is not a valid ${name}: ${problems[0]}`);
  return value;
}

export async function publish({ store, order, ref, sha, checkout, dir, fetchImpl, now, config, refresh = importRefresh } = {}) {
  if (!store || !order) throw new TypeError('publish needs a store and an order');
  const at = instant(now);
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'software-factory-publish-'));
  let step = 'refresh';
  let ours = null;
  let previous = null;
  const uploaded = [];
  const pruned = [];
  let pruneError = null;
  const result = (outcome, extra = {}) => ({
    outcome,
    snapshotId: ours?.snapshotId ?? null,
    sha: ours?.sha ?? null,
    previous,
    uploaded,
    pruned,
    pruneError,
    step: null,
    code: null,
    error: null,
    ...extra,
  });

  try {
    // 1. Build and validate the snapshot in staging; nothing remote yet.
    const dataDir = path.join(staging, 'data');
    const refreshed = await refresh({ ref, sha, checkout, dir, fetchImpl, dataDir, postsDir: path.join(staging, 'posts'), now: at, config });
    if (refreshed.outcome === 'failed') throw new PublishError(refreshed.code ?? 'error', refreshed.error);
    step = 'validate';
    const problems = validateSnapshotDir(dataDir);
    if (problems.length) throw new PublishError('invalid', `the staged snapshot failed validation: ${problems.join('; ')}`);
    const id = JSON.parse(fs.readFileSync(path.join(dataDir, POINTER), 'utf8')).snapshotId;
    const rel = `snapshots/${id}`;
    const manifest = JSON.parse(fs.readFileSync(path.join(dataDir, rel, 'manifest.json'), 'utf8'));
    ours = { snapshotId: id, sha: manifest.source.sha };
    const files = [...tree(path.join(dataDir, rel))].map(([name, body]) => ({ key: `${rel}/${name}`, body }));

    // 2. What the destination points at now.
    step = 'remote';
    const remote = await store.get(POINTER);
    const current = remote ? parseRecord('pointer', remote.body, `the destination's ${POINTER}`) : null;
    if (current) {
      if (Date.parse(current.lastSourceCheck.at) > Date.parse(at))
        return result('refused', { step, code: 'older-check', error: `the destination's pointer was checked at ${current.lastSourceCheck.at}, after this run's ${at}` });
      previous = { snapshotId: current.snapshotId, sha: current.snapshotId === id ? ours.sha : null };
    }

    // 3. Never replace a pointer to a snapshot of a newer source commit.
    if (current && current.snapshotId !== id) {
      const theirs = await store.get(current.manifest);
      if (!theirs) throw new PublishError('remote', `the destination's ${POINTER} names ${current.snapshotId}, whose manifest is missing`);
      const theirManifest = parseRecord('manifest', theirs.body, `${current.snapshotId}'s manifest`);
      if (theirManifest.snapshotId !== current.snapshotId) throw new PublishError('remote', `${current.manifest} is the manifest of ${theirManifest.snapshotId}`);
      previous.sha = theirManifest.source.sha;
      if (previous.sha !== ours.sha) {
        step = 'order';
        const relation = await order(previous.sha, ours.sha);
        if (relation !== 'ahead')
          return result('refused', {
            step,
            code: relation,
            error: `the destination's snapshot ${current.snapshotId} comes from ${previous.sha}, which this run's ${ours.sha} is ${relation === 'behind' ? 'older than' : `not ahead of (${relation})`}`,
          });
      }
    }

    // 4. The snapshot's files, each read back and checked.
    for (const file of files) {
      step = 'upload';
      const want = hex(file.body);
      const have = await store.get(file.key);
      if (have && hex(have.body) === want) continue;
      await store.put(file.key, file.body, { contentType: JSON_TYPE });
      uploaded.push(file.key);
      step = 'verify';
      const back = await store.get(file.key);
      if (!back || hex(back.body) !== want) throw new PublishError('verify', `${file.key} read back ${back ? `with sha256 ${hex(back.body)}` : 'missing'}, not ${want}`);
    }

    // 5. Only then the pointer, on the condition that it is still the one read in step 2.
    step = 'pointer';
    const unchanged = current?.snapshotId === id;
    const check = { at, sha: ours.sha, outcome: unchanged ? 'unchanged' : 'new-snapshot', error: null };
    const pointer = unchanged
      ? { ...current, lastSourceCheck: check }
      : { schema: 'software-factory-pointer/v1', snapshotId: id, manifest: `${rel}/manifest.json`, publishedAt: at, lastSourceCheck: check };
    const invalid = validate('pointer', pointer);
    if (invalid.length) throw new PublishError('invalid', `the new pointer is not valid: ${invalid[0]}`);
    const body = Buffer.from(serialize(pointer));
    try {
      await store.put(POINTER, body, { contentType: JSON_TYPE, ...(remote ? { ifMatch: remote.etag } : { ifNoneMatch: '*' }) });
    } catch (e) {
      if (e.status === 412) throw new PublishError('conflict', `${POINTER} changed while this run published, and was left as the other run wrote it`);
      throw e;
    }
    step = 'verify';
    const back = await store.get(POINTER);
    if (!back || !back.body.equals(body)) throw new PublishError('verify', `${POINTER} read back different from what this run wrote`);

    // 6. Snapshots superseded for a day: best effort, after the pointer is safe.
    try {
      for (const old of supersededSnapshots(await store.list('snapshots/'), pointer.snapshotId, at)) {
        for (const key of old.keys) await store.delete(key);
        pruned.push(old.id);
      }
    } catch (e) {
      pruneError = e.message;
    }
    return result(check.outcome, { pointer });
  } catch (e) {
    return result('failed', { step, code: e instanceof StoreError ? 'store' : (e.code ?? 'error'), error: e.message });
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}
