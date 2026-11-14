// Validates Software Factory records against schema.json, and a whole
// snapshot directory against its manifest. No dependencies: it implements the
// part of JSON Schema that schema.json uses (type, const, enum, properties,
// required, additionalProperties, items, minItems, pattern, minimum, $ref).
//
// Shared by every workstream; owned by the contract (docs/software-factory.md).

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCHEMA = JSON.parse(
  fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema.json'), 'utf8')
);

const typeOf = (v) =>
  v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v;
const matchesType = (v, t) => t === typeOf(v) || (t === 'number' && typeof v === 'number');

function check(schema, value, at, errors) {
  if (schema.$ref) {
    const name = schema.$ref.replace('#/$defs/', '');
    if (!SCHEMA.$defs[name]) throw new Error(`schema.json: no $defs/${name}`);
    check(SCHEMA.$defs[name], value, at, errors);
  }
  if (schema.type) {
    const types = [].concat(schema.type);
    if (!types.some((t) => matchesType(value, t))) {
      errors.push(`${at}: expected ${types.join(' or ')}, got ${typeOf(value)}`);
      return;
    }
  }
  if ('const' in schema && value !== schema.const)
    errors.push(`${at}: expected ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}`);
  if (schema.enum && !schema.enum.includes(value))
    errors.push(`${at}: ${JSON.stringify(value)} is not one of ${schema.enum.map((e) => JSON.stringify(e)).join(', ')}`);
  if (typeof value === 'string' && schema.pattern && !new RegExp(schema.pattern).test(value))
    errors.push(`${at}: ${JSON.stringify(value)} does not match ${schema.pattern}`);
  if (typeof value === 'number' && 'minimum' in schema && value < schema.minimum)
    errors.push(`${at}: ${value} is below ${schema.minimum}`);
  if (Array.isArray(value)) {
    if ('minItems' in schema && value.length < schema.minItems)
      errors.push(`${at}: fewer than ${schema.minItems} item(s)`);
    if (schema.items) value.forEach((item, i) => check(schema.items, item, `${at}[${i}]`, errors));
  }
  if (typeOf(value) === 'object') {
    for (const key of schema.required || [])
      if (!(key in value)) errors.push(`${at}: missing ${key}`);
    for (const [key, v] of Object.entries(value)) {
      if (schema.properties && key in schema.properties) check(schema.properties[key], v, `${at}.${key}`, errors);
      else if (schema.additionalProperties === false) errors.push(`${at}: unexpected field ${key}`);
      else if (typeof schema.additionalProperties === 'object') check(schema.additionalProperties, v, `${at}.${key}`, errors);
    }
  }
}

/** The problems with `value` as the record `name` (a $defs entry of schema.json); empty when valid. */
export function validate(name, value) {
  if (!SCHEMA.$defs[name]) throw new Error(`schema.json has no record named ${name}`);
  const errors = [];
  check(SCHEMA.$defs[name], value, name, errors);
  return errors;
}

export const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

/**
 * Checks a snapshot directory as published: latest.json, the manifest it
 * points at, and every collection the manifest lists (present, the bytes and
 * sha256 it records, valid, and of the same snapshot). Returns the problems;
 * empty when the snapshot is whole.
 */
export function validateSnapshotDir(dir) {
  const problems = [];
  const read = (rel) => {
    const file = path.join(dir, rel);
    if (!fs.existsSync(file)) {
      problems.push(`${rel}: missing`);
      return undefined;
    }
    const bytes = fs.readFileSync(file);
    try {
      return { bytes, json: JSON.parse(bytes) };
    } catch (e) {
      problems.push(`${rel}: not JSON (${e.message})`);
      return undefined;
    }
  };
  const pointer = read('latest.json');
  if (!pointer) return problems;
  problems.push(...validate('pointer', pointer.json));
  if (problems.length) return problems;
  const manifest = read(pointer.json.manifest);
  if (!manifest) return problems;
  problems.push(...validate('manifest', manifest.json));
  if (problems.length) return problems;
  const id = pointer.json.snapshotId;
  if (manifest.json.snapshotId !== id) problems.push(`${pointer.json.manifest}: snapshotId ${manifest.json.snapshotId}, but latest.json says ${id}`);
  const base = path.dirname(pointer.json.manifest);
  for (const c of manifest.json.collections) {
    const rel = path.join(base, c.path);
    const file = read(rel);
    if (!file) continue;
    if (file.bytes.length !== c.bytes) problems.push(`${rel}: ${file.bytes.length} bytes, manifest says ${c.bytes}`);
    if (sha256(file.bytes) !== c.sha256) problems.push(`${rel}: sha256 differs from the manifest`);
    problems.push(...validate(c.name, file.json).map((e) => `${rel}: ${e}`));
    if (file.json.snapshotId !== id) problems.push(`${rel}: snapshotId ${file.json.snapshotId}, not ${id}`);
    const records = c.name === 'overview' ? 1 : file.json.records?.length;
    if (records !== c.records) problems.push(`${rel}: ${records} record(s), manifest says ${c.records}`);
  }
  return problems;
}
