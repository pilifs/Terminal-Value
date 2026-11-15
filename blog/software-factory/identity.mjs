// How a snapshot is identified (docs/software-factory.md, Snapshot identity).
// Owned by the contract: the importer and the fixtures both use these, so a
// snapshot id means the same thing everywhere.
//
// A snapshot id depends on the source revision, the generator, the
// configuration, the metric definitions and the content, and on no clock:
//   1. build every collection with snapshotId PLACEHOLDER;
//   2. contentSha256 = sha256(canonicalJson([those collections, in manifest order]));
//   3. snapshotId = 'sf1-' + the first 16 hex digits of
//      sha256(canonicalJson({ sha, generator, configSha256, metricDefinitionsSha256, contentSha256 }));
//   4. put the id in every collection and the manifest, and publish each with serialize().
// An unchanged source, generator and config give the same id, so a refresh
// that finds nothing new makes no new snapshot; a fix to the importer (a new
// generator version) or the config makes a new one without a new upstream commit.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PLACEHOLDER = 'sf1-0000000000000000';
export const CONFIG_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'config');
// The config files a snapshot depends on. section.json (launch switch) and
// metrics.json (hashed on its own as the metric definitions) are not among them.
export const CONFIG_FILES = ['source.json', 'areas.json', 'models.json', 'loops.json', 'code.json'];

export const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');

/** JSON with object keys sorted at every level, no whitespace: the same value gives the same bytes. */
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`)
      .join(',')}}`;
  return JSON.stringify(value);
}

/** How a published JSON file is written: compact, one trailing newline. */
export const serialize = (value) => `${JSON.stringify(value)}\n`;

export function configSha256(dir = CONFIG_DIR) {
  const config = Object.fromEntries(CONFIG_FILES.map((f) => [f, JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))]));
  return sha256(canonicalJson(config));
}

export function metricDefinitions(dir = CONFIG_DIR) {
  const bytes = fs.readFileSync(path.join(dir, 'metrics.json'));
  return { version: JSON.parse(bytes).version, sha256: sha256(bytes) };
}

export function snapshotId({ sha, generator, configSha256, metricDefinitionsSha256, collections }) {
  const contentSha256 = sha256(canonicalJson(collections));
  const identity = canonicalJson({ sha, generator, configSha256, metricDefinitionsSha256, contentSha256 });
  return `sf1-${sha256(identity).slice(0, 16)}`;
}
