// The Pages project's wrangler.toml, read by wrangler's own config reader: each
// Pages environment binds SOFTWARE_FACTORY_DATA to its own bucket and names
// itself in SOFTWARE_FACTORY_ENVIRONMENT, which the function's unpublished gate
// reads. The file keeps the project's saved settings, and the deploy scripts
// still name the same project and output directory. No credentials, no network.
// Coordinator-owned. Run: npm run test:software-factory

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { unstable_readConfig } from 'wrangler';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const CONFIG = path.join(ROOT, 'wrangler.toml');
const SAVED = path.join(ROOT, 'blog', 'software-factory', 'ops', 'terminal-value.pages-config.toml');
const FUNCTION = path.join(ROOT, 'functions', 'software-factory', 'data', '[[path]].js');
const { serve } = await import(pathToFileURL(FUNCTION).href);

// Pages: the top level is preview and local dev; [env.production] is production.
const ENVIRONMENTS = {
  top: { env: undefined, environment: 'preview', bucket: 'software-factory-data-preview' },
  preview: { env: 'preview', environment: 'preview', bucket: 'software-factory-data-preview' },
  production: { env: 'production', environment: 'production', bucket: 'software-factory-data' },
};

const read = (env, config = CONFIG) => unstable_readConfig({ config, env }, { hideWarnings: true });

test('each Pages environment binds its own bucket and names itself', () => {
  for (const [name, want] of Object.entries(ENVIRONMENTS)) {
    const config = read(want.env);
    assert.deepEqual(config.r2_buckets, [{ binding: 'SOFTWARE_FACTORY_DATA', bucket_name: want.bucket }], name);
    assert.deepEqual(config.vars, { SOFTWARE_FACTORY_ENVIRONMENT: want.environment }, name);
    assert.equal(config.pages_build_output_dir, path.join(ROOT, 'dist'), name);
    assert.deepEqual(config.kv_namespaces, [], name);
    assert.deepEqual(config.d1_databases, [], name);
    assert.deepEqual(config.services, [], name);
  }
});

test("the function's gate follows each environment while the section is unpublished", async () => {
  const objects = { 'latest.json': '{}' };
  const bucket = {
    get: async (key) => (key in objects ? { httpEtag: '"x"', size: 2, body: objects[key] } : null),
    head: async (key) => (key in objects ? { httpEtag: '"x"', size: 2 } : null),
  };
  const request = () => new Request('https://terminalvalue.test/software-factory/data/latest.json');
  for (const [name, want] of Object.entries(ENVIRONMENTS)) {
    const env = { ...read(want.env).vars, SOFTWARE_FACTORY_DATA: bucket };
    const unpublished = await serve(request(), env, { published: false });
    assert.equal(unpublished.status, want.environment === 'preview' ? 200 : 404, name);
    const published = await serve(request(), env, { published: true });
    assert.equal(published.status, 200, name);
  }
});

test("it keeps the project's saved settings", () => {
  const saved = read(undefined, SAVED);
  const config = read(undefined);
  assert.equal(config.name, saved.name);
  assert.equal(config.compatibility_date, saved.compatibility_date);
  assert.deepEqual(config.compatibility_flags, saved.compatibility_flags);
  // The saved settings had no bindings or variables of their own to carry over.
  assert.deepEqual(saved.vars, {});
  assert.deepEqual(saved.r2_buckets, []);
  assert.deepEqual(read('production', SAVED).vars, {});
});

test('the deploy scripts name the same project and output directory', () => {
  const { scripts } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const config = read(undefined);
  const branches = {};
  for (const name of ['deploy', 'deploy:dev']) {
    const m = scripts[name].match(/wrangler pages deploy (\S+) --project-name=(\S+) --branch=(\S+)$/);
    assert.ok(m, name);
    assert.equal(path.join(ROOT, m[1]), config.pages_build_output_dir, name);
    assert.equal(m[2], config.name, name);
    branches[name] = m[3];
  }
  // Wrangler picks [env.production] when the branch is the project's production
  // branch; `deploy` uses production, `deploy:dev` a preview branch.
  assert.deepEqual(branches, { deploy: 'production', 'deploy:dev': 'dev' });
});
