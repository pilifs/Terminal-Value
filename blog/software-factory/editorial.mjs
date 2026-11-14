// Which posts the Software Factory pages show, and article evidence. Owned by
// stream C (editorial): llm-dlc/loops/software-factory-editorial.md.
//
// Interface, frozen in Phase 0 (docs/software-factory.md):
//
//   COLLECTION = 'software-factory'
//     The front matter value `collection: software-factory` that puts a post
//     in the section's analysis.
//
//   postSummary(post, { postImage }) -> schema.json postSummary
//     post is one of build.mjs's posts ({ slug, dir, meta, html }).
//
//   selectPosts(posts, { postImage }) -> { featured, items, related }
//     From the already draft-filtered collection only (never reading files
//     itself). items: the author's posts in the collection, newest first;
//     featured: one of them by `featured: true`, the newest then the first slug
//     on a tie, else null; related: posts linked as background, never presented
//     as the author's analysis (such as an agent-written post).
//
//   validateEvidence(post) -> [problem]
//     A published post's `evidence: FILE` must name a well-formed evidence
//     manifest (schema.json evidence) with status complete. A draft's may be
//     incomplete or absent. Never invents values to make one validate.
//
// Added by stream C, for the coordinator to place in build.mjs's renderPost:
//
//   byline(post) -> HTML ('' when the post has no `author` field of its own)
//   evidenceLinks(post, { section }) -> HTML ('' unless the post relates to
//     the section and `section` says the section is built)
//
// Front matter the section reads, all flat and optional:
//
//   collection: software-factory   the post is part of the section's analysis
//   author: Filip Stankovic         explicit attribution; required to be an item
//   featured: true                  a candidate for the featured slot
//   evidence: evidence.json         the frozen data, in the post's own folder
//   related: software-factory       background the section links, never an item
//
// Authorship is never inferred: the site's global author is not a post's.

export const COLLECTION = 'software-factory';
export const ROUTE = `/${COLLECTION}/`;

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const text = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);

const author = (post) => text(post.meta.author);

const inCollection = (post) => post.meta.collection === COLLECTION;

/** An item of the section's analysis: in the collection, with its own author, and not a draft. */
const isItem = (post) => inCollection(post) && author(post) !== null && !post.meta.draft;

/** Background the section links: marked related, not an item, and not a draft. */
const isRelated = (post) => post.meta.related === COLLECTION && !isItem(post) && !post.meta.draft;

/** Newest first; the first slug on a tie, so the order never depends on the file system. */
const newestFirst = (a, b) => b.meta.date.localeCompare(a.meta.date) || a.slug.localeCompare(b.slug);

export function postSummary(post, { postImage }) {
  const { slug, meta } = post;
  const evidence = text(meta.evidence);
  return {
    slug,
    url: `/posts/${slug}/`,
    title: meta.title,
    description: meta.description,
    author: author(post),
    date: meta.date,
    cover: postImage(post) ?? null,
    collection: text(meta.collection),
    featured: meta.featured === true,
    evidence: evidence ? { url: `/posts/${slug}/${evidence}` } : null,
  };
}

/**
 * The section's posts. featured is also one of items, so a page can show it
 * apart and list the rest. A post with `draft: true` is never selected, even
 * in a drafts build: postSummary has no draft flag, so a page could not mark it.
 */
export function selectPosts(posts, { postImage }) {
  const summarize = (post) => postSummary(post, { postImage });
  const items = posts.filter(isItem).sort(newestFirst);
  const featured = items.find((post) => post.meta.featured === true) ?? null;
  return {
    featured: featured && summarize(featured),
    items: items.map(summarize),
    related: posts.filter(isRelated).sort(newestFirst).map(summarize),
  };
}

/**
 * The byline for a post with its own `author` field, to sit in the post's
 * `.meta` line after the date. Empty for every other post.
 */
export function byline(post) {
  const name = author(post);
  return name ? `<span class="byline"> · By ${escapeHtml(name)}</span>` : '';
}

/**
 * The links between a post and the section, as a `.source` paragraph for the
 * end of the post page. A collection post links its own frozen evidence ("Data
 * used in this analysis") and the section ("Latest Software Factory data"); a
 * related post links the section's analysis. Empty for other posts, and while
 * the section isn't built (`section` false), so no page links to a route that
 * isn't there.
 */
export function evidenceLinks(post, { section }) {
  if (!section) return '';
  const links = [];
  if (inCollection(post)) {
    const evidence = text(post.meta.evidence);
    if (evidence) {
      links.push(`<a href="/posts/${post.slug}/${escapeHtml(evidence)}">Data used in this analysis</a>`);
    }
    links.push(`<a href="${ROUTE}">Latest Software Factory data</a>`);
  } else if (post.meta.related === COLLECTION) {
    links.push(`<a href="${ROUTE}analysis/">More analysis in the Software Factory</a>`);
  }
  return links.length ? `<p class="source">${links.join(' · ')}</p>` : '';
}

export function validateEvidence() {
  return [];
}
