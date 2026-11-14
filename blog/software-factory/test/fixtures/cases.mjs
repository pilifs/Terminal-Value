// Materializes a case of cases.json: a copy of upstream/ with the case's
// changes applied, in a new temporary directory. Shared by every stream's tests.
//
//   const { dir, kase } = materialize('missing-rollup');

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const UPSTREAM = path.join(HERE, 'upstream');
export const CASES = JSON.parse(fs.readFileSync(path.join(HERE, 'cases.json'), 'utf8')).cases;

const setPath = (obj, dotted, value) => {
  const keys = dotted.split('.');
  let o = obj;
  for (const k of keys.slice(0, -1)) o = o[k];
  o[keys.at(-1)] = value;
};

export function materialize(id) {
  const kase = CASES.find((c) => c.id === id);
  if (!kase) throw new Error(`no case ${id}`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `sf-case-${id}-`));
  fs.cpSync(UPSTREAM, dir, { recursive: true });
  const file = (rel) => {
    const f = path.join(dir, rel);
    if (!fs.existsSync(f)) throw new Error(`case ${id}: no ${rel} in the fixture`);
    return f;
  };
  for (const rel of kase.remove ?? []) fs.rmSync(file(rel));
  for (const [rel, changes] of Object.entries(kase.set ?? {})) {
    const json = JSON.parse(fs.readFileSync(file(rel), 'utf8'));
    for (const [k, v] of Object.entries(changes)) setPath(json, k, v);
    fs.writeFileSync(file(rel), JSON.stringify(json));
  }
  for (const [rel, keys] of Object.entries(kase.unset ?? {})) {
    const json = JSON.parse(fs.readFileSync(file(rel), 'utf8'));
    for (const k of keys) delete json[k];
    fs.writeFileSync(file(rel), JSON.stringify(json));
  }
  for (const [rel, text] of Object.entries(kase.text ?? {})) fs.writeFileSync(file(rel), text);
  return { dir, kase };
}
