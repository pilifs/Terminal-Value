// The first article's draft scaffold, blog/posts/fable-5-1-vs-5-2/ (stream C, phase C4).
// Run: npm run test:software-factory

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadPosts } from '../../posts.mjs';
import { validateEvidence } from '../editorial.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const POSTS = path.join(HERE, '../../posts');
const SLUG = 'fable-5-1-vs-5-2';
const DRAFT = path.join(POSTS, SLUG);

const HEADINGS = [
  'What I observed and why it matters',
  'Exact model identities, effort, harness, and other configuration changes',
  'Workload and cohort selection, dates, sample sizes, and exclusions',
  'Observed differences in outcomes, rework, duration, usage, and cache behavior',
  'Concrete incidents and qualitative details the aggregates miss',
  'What I am changing in the Software Factory as a result',
  'Method, frozen evidence, limitations, and unresolved questions',
];

function draft() {
  const post = loadPosts(POSTS, { includeDrafts: true, render: () => '' }).find((p) => p.slug === SLUG);
  assert.ok(post, `${SLUG} is in blog/posts/`);
  return post;
}

test('the draft has the exact title and stays a draft', () => {
  const { meta } = draft();
  assert.equal(meta.title, 'Fable 5.1 vs. 5.2');
  assert.equal(meta.draft, true);
  assert.equal(meta.collection, 'software-factory');
  assert.equal(meta.author, 'Filip Stankovic');
  assert.equal(meta.featured, false);
  assert.equal(meta.image, 'cover.png');
});

test('the body is the seven headings of the plan, each with a prompt only', () => {
  const body = draft().source.split(/^---$/m).slice(2).join('---');
  assert.deepEqual([...body.matchAll(/^## (.+)$/gm)].map((m) => m[1]), HEADINGS);
  const sections = body.split(/^## .+$/m).slice(1);
  for (const [i, section] of sections.entries()) {
    const paragraphs = section.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p && !p.startsWith('[^'));
    assert.ok(paragraphs.length > 0, HEADINGS[i]);
    for (const p of paragraphs) assert.match(p, /^_Prompt: .+_(\[\^\w+\])?$/s, HEADINGS[i]);
  }
});

test('the note says the date is a placeholder and Fable 5.2 has no raw id yet', () => {
  const { source } = draft();
  assert.match(source, /date is a placeholder/);
  assert.match(source, /No raw model id is mapped to Fable 5\.2 yet/);
  assert.doesNotMatch(source, /claude-fable-5-2/, 'no raw id is inferred for Fable 5.2');
});

test('the evidence is the incomplete fixture, honest nulls, and valid for a draft', () => {
  const post = draft();
  const fixture = fs.readFileSync(path.join(HERE, 'fixtures/evidence.incomplete.json'), 'utf8');
  assert.equal(fs.readFileSync(path.join(DRAFT, post.meta.evidence), 'utf8'), fixture);
  const evidence = JSON.parse(fixture);
  assert.equal(evidence.status, 'incomplete');
  assert.deepEqual(evidence.models.map((m) => m.raw), ['claude-fable-5-1']);
  assert.deepEqual(validateEvidence(post), []);
});

test('every file the draft links is in its folder', () => {
  const { source } = draft();
  const linked = [...source.matchAll(/\]\(([^)\s#]+)/g)].map((m) => m[1]).filter((f) => !/^[a-z]+:/.test(f));
  for (const file of ['cover.png', ...linked]) assert.ok(fs.existsSync(path.join(DRAFT, file)), file);
});
