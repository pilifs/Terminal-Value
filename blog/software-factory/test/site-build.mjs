// Whole builds of a temporary copy of the site, for the coordinator's site-*
// tests: section.json's published set in the copy only (never committed), the
// project demo copied in, and the copies removed when the test file ends.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '../../..');
const PROJECT_DIST = path.join(REPO, 'projects', 'terminal-value-pipeline', 'dist');
export const read = (file) => fs.readFileSync(file, 'utf8');

/** False when a build can run, else why the build tests are skipped. */
export const skip = fs.existsSync(path.join(PROJECT_DIST, 'index.html')) ? false : 'needs `npm run build:projects` first';

const copies = [];
test.after(() => copies.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

/** Builds a copy of blog/ with section.json's published set, and returns its dist/. */
export function buildCopy({ published, drafts = false, dataDir }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-site-'));
  copies.push(root);
  fs.cpSync(path.join(REPO, 'blog'), path.join(root, 'blog'), { recursive: true });
  fs.symlinkSync(path.join(REPO, 'node_modules'), path.join(root, 'node_modules'));
  fs.cpSync(PROJECT_DIST, path.join(root, 'projects', 'terminal-value-pipeline', 'dist'), { recursive: true });
  const config = path.join(root, 'blog', 'software-factory', 'config', 'section.json');
  fs.writeFileSync(config, `${JSON.stringify({ ...JSON.parse(read(config)), published }, null, 2)}\n`);
  const env = { ...process.env };
  delete env.SOFTWARE_FACTORY_DATA_DIR;
  if (dataDir) env.SOFTWARE_FACTORY_DATA_DIR = dataDir;
  execFileSync(process.execPath, ['blog/build.mjs', ...(drafts ? ['--drafts'] : [])], { cwd: root, env, stdio: 'pipe' });
  return path.join(root, 'dist');
}

/** Every text file in dir, as [relative path, contents]. */
export function texts(dir) {
  return fs
    .readdirSync(dir, { recursive: true })
    .filter((f) => /\.(html|xml|txt|md|css|js)$/.test(f) || path.basename(f) === '_headers')
    .map((f) => [f, read(path.join(dir, f))]);
}
