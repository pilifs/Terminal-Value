// The Software Factory post template (stream C, phase C3): what
// `npm run new -- --software-factory` copies. Run: npm run test:software-factory

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadPosts } from '../../posts.mjs';
import { selectPosts, validateEvidence } from '../editorial.mjs';

const TEMPLATE = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../templates/software-factory-post');

/** A posts folder holding the template as `slug`, the way the build would read it. */
function postsWithTemplate(t, slug = 'new-analysis') {
  const postsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-template-'));
  t.after(() => fs.rmSync(postsDir, { recursive: true, force: true }));
  fs.cpSync(TEMPLATE, path.join(postsDir, slug), { recursive: true });
  return postsDir;
}

test('the template is a Software Factory draft with its own author', (t) => {
  const [post] = loadPosts(postsWithTemplate(t), { includeDrafts: true, render: () => '' });
  assert.equal(post.meta.draft, true);
  assert.equal(post.meta.collection, 'software-factory');
  assert.equal(post.meta.author, 'Filip Stankovic');
  assert.equal(post.meta.featured, false);
  assert.equal(post.meta.image, 'cover.png');
});

test('the evidence line is commented out, so a new post has nothing to validate yet', (t) => {
  const [post] = loadPosts(postsWithTemplate(t), { includeDrafts: true, render: () => '' });
  assert.equal(post.meta.evidence, undefined);
  assert.match(post.source, /^# evidence: evidence\.json$/m);
  assert.deepEqual(validateEvidence(post), []);
});

test('uncommenting the evidence line before the file exists is still a valid draft', (t) => {
  const [post] = loadPosts(postsWithTemplate(t), { includeDrafts: true, render: () => '' });
  assert.deepEqual(validateEvidence({ ...post, meta: { ...post.meta, evidence: 'evidence.json' } }), []);
});

test('every file the template links is in its folder', () => {
  const source = fs.readFileSync(path.join(TEMPLATE, 'index.md'), 'utf8');
  const linked = [...source.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)].map((m) => m[1]);
  for (const file of ['cover.png', ...linked]) assert.ok(fs.existsSync(path.join(TEMPLATE, file)), file);
});

test('a copy of the template is never built or selected without drafts', (t) => {
  const postsDir = postsWithTemplate(t);
  assert.deepEqual(loadPosts(postsDir, { includeDrafts: false, render: () => '' }), []);
  const drafts = loadPosts(postsDir, { includeDrafts: true, render: () => '' });
  assert.deepEqual(selectPosts(drafts, { postImage: () => undefined }), { featured: null, items: [], related: [] });
});
