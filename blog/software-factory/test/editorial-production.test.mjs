// Production: the draft scaffold reaches no surface (stream C, phase C5).
// Uses the real blog/posts/ folder. Run: npm run test:software-factory

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadPosts } from '../../posts.mjs';
import { selectPosts, validateEvidence } from '../editorial.mjs';
import { buildSection } from '../index.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const POSTS = path.join(HERE, '../../posts');
const SLUG = 'fable-5-1-vs-5-2';
const TITLE = 'Fable 5.1 vs. 5.2';
const render = () => '';
const postImage = () => undefined;

const production = () => loadPosts(POSTS, { includeDrafts: false, render });
const everything = () => loadPosts(POSTS, { includeDrafts: true, render });

test('the draft scaffold is in blog/posts/ and marked as a draft', () => {
  const post = everything().find((p) => p.slug === SLUG);
  assert.ok(post, `${SLUG} exists`);
  assert.equal(post.meta.draft, true);
});

test('loadPosts without drafts leaves out every draft, the scaffold included', () => {
  const posts = production();
  assert.ok(posts.length > 0, 'production has published posts');
  assert.ok(!posts.some((p) => p.slug === SLUG), `${SLUG} is left out`);
  assert.ok(!posts.some((p) => p.meta.draft), 'no draft at all');
  const drafts = everything().filter((p) => p.meta.draft).map((p) => p.slug);
  assert.deepEqual(posts.map((p) => p.slug).sort(), everything().map((p) => p.slug).filter((s) => !drafts.includes(s)).sort());
});

test('no published post carries the draft title, folder or evidence', () => {
  for (const post of production()) {
    assert.ok(!post.source.includes(TITLE), post.slug);
    assert.ok(!post.source.includes(SLUG), post.slug);
    assert.notEqual(post.dir, path.join(POSTS, SLUG), post.slug);
  }
});

test('the section selection made from production posts never names the draft', () => {
  const { featured, items, related } = selectPosts(production(), { postImage });
  const selected = [featured, ...items, ...related].filter(Boolean);
  assert.ok(!JSON.stringify(selected).includes(SLUG));
  assert.ok(!JSON.stringify(selected).includes(TITLE));
});

test('a published section built from production posts writes nothing of the draft', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-editorial-'));
  const helpers = { escapeHtml: (s) => String(s), formatDate: (s) => s, postImage };
  const layout = (page) => `<!doctype html>${page.title ?? ''}|${page.body}`;
  const result = buildSection({
    outDir: out,
    posts: production(),
    includeDrafts: false,
    site: { url: 'https://example.invalid' },
    layout,
    helpers,
    published: true,
  });
  const files = fs.readdirSync(out, { recursive: true }).filter((f) => fs.statSync(path.join(out, f)).isFile());
  assert.ok(files.length > 0, 'the section wrote files');
  for (const file of files) {
    assert.ok(!file.includes(SLUG), file);
    const text = fs.readFileSync(path.join(out, file), 'utf8');
    assert.ok(!text.includes(SLUG) && !text.includes(TITLE), file);
  }
  const listed = JSON.stringify(result);
  assert.ok(!listed.includes(SLUG) && !listed.includes(TITLE), 'sitemap, llms.txt and headers');
});

test('every post in blog/posts/, drafts included, passes evidence validation', () => {
  for (const post of everything()) assert.deepEqual(validateEvidence(post), [], post.slug);
});
