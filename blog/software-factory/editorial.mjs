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

export const COLLECTION = 'software-factory';

export function postSummary() {
  throw new Error('editorial.mjs postSummary: not implemented yet (stream C)');
}

export function selectPosts() {
  // Phase 0 placeholder: no posts until stream C selects them.
  return { featured: null, items: [], related: [] };
}

export function validateEvidence() {
  return [];
}
