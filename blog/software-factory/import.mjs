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

export class SourceError extends Error {
  /** code: 'missing' | 'schema' | 'malformed' | 'network' | 'reconcile'. */
  constructor(code, message, { path = null } = {}) {
    super(message);
    this.name = 'SourceError';
    this.code = code;
    this.path = path;
  }
}

const notYet = (name) => {
  throw new Error(`import.mjs ${name}: not implemented yet (stream A)`);
};
export async function readSources() {
  notYet('readSources');
}
export function normalizeSources() {
  notYet('normalizeSources');
}
export async function refresh() {
  notYet('refresh');
}
