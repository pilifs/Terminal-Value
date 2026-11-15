// The Software Factory's published data, served from R2 by a Cloudflare Pages
// Function at /software-factory/data/*. It is not a generic R2 gateway: it
// answers GET and HEAD for exactly the files of the published layout, and
// nothing else, from the bucket bound as SOFTWARE_FACTORY_DATA.
//
//   latest.json                                   the pointer: Cache-Control no-cache,
//                                                 an ETag, 304 on If-None-Match
//   snapshots/<sf1-id>/manifest.json              immutable files: a snapshot's id comes
//   snapshots/<sf1-id>/overview.json              from its content, so its files never
//   snapshots/<sf1-id>/details/<name>.json        change (public, a year, immutable)
//
// <name> is one of schema.json's detail collections: sessions, changes,
// verification, examples. Any other path, an encoded one included, is 404.
// Other methods get 405. A missing binding or a failing bucket is 503, so the
// client falls back to the bundled snapshot.
//
// The ETag is R2's: strong, and new with every upload of the object. The edge
// may weaken an ETag when it compresses a response, so If-None-Match is
// compared the weak way, as RFC 9110 asks; W/"x" matches "x".
//
// Unpublished: while config/section.json says published: false, only a
// deployment whose SOFTWARE_FACTORY_ENVIRONMENT is "preview" serves anything
// (the drafts preview). Production, or a deployment with no such variable,
// answers 404, as for a site without the section.
//
// Static _headers rules don't apply to a Function's responses, so each one
// carries its own headers. Data is never a search result: X-Robots-Tag noindex.
//
//   serve(request, env, { published }) -> Response    the whole behaviour, for tests
//   onRequest(context)                                 the Pages entry point
// Coordinator-owned. Tests: blog/software-factory/test/site-function.test.mjs

import section from '../../../blog/software-factory/config/section.json' with { type: 'json' };

export const ROUTE = '/software-factory/data/';
export const POINTER = 'latest.json';
const SNAPSHOT_FILE = /^snapshots\/sf1-[0-9a-f]{16}\/(?:manifest|overview|details\/(?:sessions|changes|verification|examples))\.json$/;

export const POINTER_CACHE = 'no-cache';
export const SNAPSHOT_CACHE = 'public, max-age=31536000, immutable';

/** The bucket key a request path names, or null when it is not a published file. */
export function keyFor(pathname) {
  if (!pathname.startsWith(ROUTE)) return null;
  const key = pathname.slice(ROUTE.length);
  return key === POINTER || SNAPSHOT_FILE.test(key) ? key : null;
}

/** Whether an If-None-Match header matches an ETag, by weak comparison. */
export function etagMatches(header, etag) {
  if (!header || !etag) return false;
  if (header.trim() === '*') return true;
  const opaque = (tag) => tag.trim().replace(/^W\//, '');
  return header.split(',').some((tag) => opaque(tag) === opaque(etag));
}

const base = (cache) => ({
  'Cache-Control': cache,
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex',
});

function text(status, body, extra = {}) {
  return new Response(body, {
    status,
    headers: { ...base('no-store'), 'Content-Type': 'text/plain; charset=utf-8', ...extra },
  });
}

export async function serve(request, env, { published = section.published } = {}) {
  if (request.method !== 'GET' && request.method !== 'HEAD')
    return text(405, 'Method not allowed\n', { Allow: 'GET, HEAD' });
  if (!published && env?.SOFTWARE_FACTORY_ENVIRONMENT !== 'preview') return text(404, 'Not found\n');
  const key = keyFor(new URL(request.url).pathname);
  if (key === null) return text(404, 'Not found\n');
  const bucket = env?.SOFTWARE_FACTORY_DATA;
  if (!bucket || typeof bucket.get !== 'function') return text(503, 'Software Factory data is not configured\n');

  const head = request.method === 'HEAD';
  let object;
  try {
    object = head ? await bucket.head(key) : await bucket.get(key);
  } catch {
    return text(503, 'Software Factory data is unavailable\n');
  }
  if (!object) return text(404, 'Not found\n');

  const headers = {
    ...base(key === POINTER ? POINTER_CACHE : SNAPSHOT_CACHE),
    'Content-Type': 'application/json; charset=utf-8',
    ETag: object.httpEtag,
  };
  if (etagMatches(request.headers.get('If-None-Match'), object.httpEtag)) {
    await object.body?.cancel?.();
    return new Response(null, { status: 304, headers });
  }
  if (head) return new Response(null, { status: 200, headers: { ...headers, 'Content-Length': String(object.size) } });
  return new Response(object.body, { status: 200, headers });
}

export const onRequest = (context) => serve(context.request, context.env);
