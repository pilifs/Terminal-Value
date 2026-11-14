// Post selection, bylines and the post page's links to the section (stream C,
// phase C1). Run: npm run test:software-factory

import assert from 'node:assert/strict';
import test from 'node:test';
import { byline, evidenceLinks, postSummary, selectPosts } from '../editorial.mjs';
import { validate } from '../validate.mjs';

const postImage = ({ slug, meta }) =>
  meta.image ? { url: `/posts/${slug}/${meta.image}`, width: 1200, height: 630 } : undefined;

const post = (slug, meta) => ({
  slug,
  dir: `/posts/${slug}`,
  html: '',
  meta: { title: `Title ${slug}`, date: '2026-11-01', description: `About ${slug}`, ...meta },
});

const AUTHOR = 'Filip Stankovic';
const mine = (slug, meta = {}) => post(slug, { collection: 'software-factory', author: AUTHOR, ...meta });
const slugs = (list) => list.map((p) => p.slug);

test('items are the collection posts with their own author, newest first', () => {
  const posts = [
    mine('older', { date: '2026-10-01' }),
    mine('newer', { date: '2026-11-10' }),
    post('no-author', { collection: 'software-factory' }),
    post('blank-author', { collection: 'software-factory', author: '  ' }),
    post('other-collection', { collection: 'notes', author: AUTHOR }),
    post('plain', { author: AUTHOR }),
  ];
  const { items, featured, related } = selectPosts(posts, { postImage });
  assert.deepEqual(slugs(items), ['newer', 'older']);
  assert.equal(featured, null);
  assert.deepEqual(related, []);
});

test('posts on the same date are ordered by slug, whatever the input order', () => {
  const a = [mine('b-post'), mine('a-post'), mine('c-post')];
  const b = [...a].reverse();
  assert.deepEqual(slugs(selectPosts(a, { postImage }).items), ['a-post', 'b-post', 'c-post']);
  assert.deepEqual(slugs(selectPosts(b, { postImage }).items), ['a-post', 'b-post', 'c-post']);
});

test('featured is the newest featured item, then the first slug on a tie', () => {
  const posts = [
    mine('old-featured', { date: '2026-09-01', featured: true }),
    mine('tie-b', { date: '2026-10-05', featured: true }),
    mine('tie-a', { date: '2026-10-05', featured: true }),
    mine('newest-unfeatured', { date: '2026-11-01' }),
  ];
  for (const order of [posts, [...posts].reverse()]) {
    const { featured, items } = selectPosts(order, { postImage });
    assert.equal(featured.slug, 'tie-a');
    assert.ok(slugs(items).includes('tie-a'), 'featured is one of the items');
  }
});

test('featured needs the boolean true, not a string', () => {
  const { featured } = selectPosts([mine('a', { featured: 'yes' })], { postImage });
  assert.equal(featured, null);
});

test('a draft is never selected, even when featured', () => {
  const posts = [
    mine('draft', { date: '2026-11-12', featured: true, draft: true }),
    mine('published', { date: '2026-11-01' }),
    post('draft-background', { related: 'software-factory', draft: true }),
  ];
  const { featured, items, related } = selectPosts(posts, { postImage });
  assert.equal(featured, null);
  assert.deepEqual(slugs(items), ['published']);
  assert.deepEqual(related, []);
});

test('an agent-written post is related background, never an item', () => {
  // reading-the-trace has no author field: the site's global author is not its author.
  const posts = [
    post('reading-the-trace', { related: 'software-factory', date: '2026-10-30' }),
    post('agent-in-collection', { collection: 'software-factory', related: 'software-factory' }),
    mine('analysis'),
  ];
  const { items, related } = selectPosts(posts, { postImage });
  assert.deepEqual(slugs(items), ['analysis']);
  assert.deepEqual(slugs(related), ['agent-in-collection', 'reading-the-trace']);
  assert.ok(related.every((p) => p.author === null));
});

test('an item marked related too stays an item only', () => {
  const { items, related } = selectPosts([mine('both', { related: 'software-factory' })], { postImage });
  assert.deepEqual(slugs(items), ['both']);
  assert.deepEqual(related, []);
});

test('postSummary is a valid schema record, from the post\'s own fields only', () => {
  const full = postSummary(
    mine('full', { image: 'cover.png', featured: true, evidence: 'evidence.json' }),
    { postImage }
  );
  assert.deepEqual(validate('postSummary', full), []);
  assert.deepEqual(full, {
    slug: 'full',
    url: '/posts/full/',
    title: 'Title full',
    description: 'About full',
    author: AUTHOR,
    date: '2026-11-01',
    cover: { url: '/posts/full/cover.png', width: 1200, height: 630 },
    collection: 'software-factory',
    featured: true,
    evidence: { url: '/posts/full/evidence.json' },
  });

  const bare = postSummary(post('bare', {}), { postImage });
  assert.deepEqual(validate('postSummary', bare), []);
  assert.equal(bare.author, null);
  assert.equal(bare.cover, null);
  assert.equal(bare.collection, null);
  assert.equal(bare.featured, false);
  assert.equal(bare.evidence, null);
});

test('the byline shows only a post\'s own author, escaped', () => {
  assert.equal(byline(mine('a')), '<span class="byline"> · By Filip Stankovic</span>');
  assert.equal(byline(post('b', {})), '');
  assert.equal(byline(post('c', { author: '' })), '');
  assert.equal(byline(post('d', { author: 'A <b>&</b>' })), '<span class="byline"> · By A &lt;b&gt;&amp;&lt;/b&gt;</span>');
});

test('a collection post links its evidence and the latest data', () => {
  const html = evidenceLinks(mine('a', { evidence: 'evidence.json' }), { section: true });
  assert.equal(
    html,
    '<p class="source"><a href="/posts/a/evidence.json">Data used in this analysis</a> · ' +
      '<a href="/software-factory/">Latest Software Factory data</a></p>'
  );
  const noEvidence = evidenceLinks(mine('b'), { section: true });
  assert.equal(noEvidence, '<p class="source"><a href="/software-factory/">Latest Software Factory data</a></p>');
});

test('a related post links back to the section\'s analysis', () => {
  const html = evidenceLinks(post('r', { related: 'software-factory' }), { section: true });
  assert.equal(html, '<p class="source"><a href="/software-factory/analysis/">More analysis in the Software Factory</a></p>');
});

test('no links for unrelated posts, or while the section is not built', () => {
  assert.equal(evidenceLinks(post('plain', {}), { section: true }), '');
  assert.equal(evidenceLinks(mine('a', { evidence: 'evidence.json' }), { section: false }), '');
  assert.equal(evidenceLinks(post('r', { related: 'software-factory' }), { section: false }), '');
});
