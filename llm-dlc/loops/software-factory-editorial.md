# Brief: Software Factory, stream C (editorial)

**Status of the brief**: drafted 2026-11-14 after Phase 0; approved by the author on 2026-11-14.

One stream of [`software-factory.md`](software-factory.md), run by `run-streams.sh software-factory` in the jj
workspace `software-factory-editorial`, on a branch of its own. It makes the author's analysis a first-class part of
the section: post selection and bylines, frozen article evidence, a template, and the draft scaffold for the first
article.

**Inputs.** Read these in full before the first piece of work of every cycle:

- [`software-factory.md`](software-factory.md), the main brief: its Direction and How to work through it apply here.
- [`docs/software-factory.md`](../../docs/software-factory.md): the frozen contract, ownership and commands.
- Section 6 (Authored analysis and the first post) and section 8 (Product and editorial) of
  [`docs/briefs/software-factory.md`](../../docs/briefs/software-factory.md). Where it says `collection: factory`,
  the value is `collection: software-factory`.
- The header of `editorial.mjs` (your interface), `blog/posts.mjs`, `blog/build.mjs` (read, don't edit),
  `schema.json` (`postSummary`, `evidence`), `test/fixtures/evidence.incomplete.json`, `AGENTS.md`, and
  `blog/templates/post/`.
- The latest integration check: `$(jj workspace root --name default)/llm-dlc/loop-summaries/software-factory-integration.md`.

## What you own

- `blog/software-factory/editorial.mjs`, `blog/templates/software-factory-post/`, `blog/posts/fable-5-1-vs-5-2/`,
  and `test/editorial-*.test.mjs`.
- In existing posts, only flat front matter lines that relate a post to the section, such as marking
  `reading-the-trace` as related background. Never an author line or a body change.

Nothing else. Write what the coordinator must wire into its files under Progress, with the exact code or text: the
byline and evidence links in `renderPost`, `npm run new -- --software-factory`, and an authoring section for
`AGENTS.md`.

## The plan

### C1. Selection and bylines

1. `postSummary` and `selectPosts`, as the interface says, from the already draft-filtered collection only.
   - `items`: posts with `collection: software-factory` and an explicit `author` field, newest first.
   - `featured`: by `featured: true`, deterministic on ties (date, then slug).
   - `related`: posts marked as background. `reading-the-trace` is written by Claude, so it may be related; never
     an item.
   - Never infer authorship from the site's global author.
2. `byline(post)` and `evidenceLinks(post)`: HTML fragments for the coordinator to place in `renderPost`. The byline
   shows only for a post with its own `author` field. The evidence links are "Data used in this analysis" (the
   post's own evidence) and "Latest Software Factory data" (`/software-factory/`).

### C2. Evidence

1. `validateEvidence(post)`:
   - a published post's `evidence: FILE` must exist in its folder, be a valid `evidence` record with status
     complete and every field non-null, and list `files` whose sha256 match the files in the folder;
   - a draft's may be incomplete or absent;
   - a missing or malformed reference in a published post is an error;
   - nothing is ever filled in to make one pass.
2. The convention, written down for the author: an article's evidence is copied into its own post folder, so it
   stays readable when the dashboard's data changes or the remote feed fails.

### C3. Template

`blog/templates/software-factory-post/`: front matter with `collection: software-factory`,
`author: Filip Stankovic`, `featured: false`, a commented `evidence:` line, `draft: true`, and `image: cover.png`
(the existing template cover, to be replaced before publishing). Plus short guidance in the body: frozen evidence,
measured versus interpreted, raw model ids beside display names.

### C4. The draft: "Fable 5.1 vs. 5.2"

`blog/posts/fable-5-1-vs-5-2/`, made from the template, with that exact title and `draft: true`. The body is
prompts for the author under the seven headings of the plan's section 6, with no observations, numbers or
conclusions written for them. A note says:

- the date is a placeholder, not a commitment;
- no raw id is mapped to Fable 5.2 yet: the comparison needs a documented cohort mapping, from data the author
  will import from another project.

Evidence is omitted, or `evidence.json` is a copy of `evidence.incomplete.json` with honest nulls. Its assets come
from the template, so the drafts build works.

### C5. Tests

- Selection: collection and author filters, deterministic featured, a draft never selected even when featured, an
  agent-written post never an item.
- Evidence: complete, incomplete-draft, incomplete-published (error), missing file, checksum mismatch, malformed.
- Production: `loadPosts` without drafts excludes the draft scaffold's folder, so no draft title, file or evidence
  reaches any surface.

### C6. Proposals for the coordinator

Under Progress, the exact changes for files you don't own:

- where `byline` and `evidenceLinks` go in `renderPost`, and how the post page links back to the section's
  analysis;
- the `--software-factory` option for `blog/new-post.mjs`;
- an authoring section for `AGENTS.md` (the new front matter fields, evidence, drafts, attribution).

## Done when

| Phase | Criterion |
|---|---|
| C1 | Selection and bylines follow the rules, with explicit attribution only |
| C2 | Evidence validation catches every case; the convention is written down |
| C3 | The template exists and builds as a draft |
| C4 | The draft exists with the exact title, prompts only, valid assets, `draft: true` |
| C5 | Editorial tests pass, the production exclusion included |
| C6 | The coordinator's changes are written out under Progress |

## Progress

- **C1 done** (2026-11-14). `editorial.mjs` implements `postSummary`, `selectPosts`, and adds `byline(post)` and
  `evidenceLinks(post, { section })`. Tested in `test/editorial-selection.test.mjs` (12 tests); production build
  unchanged (85 files), drafts build still builds.
  - Front matter read: `collection: software-factory`, `author`, `featured: true` (boolean only), `evidence: FILE`,
    and `related: software-factory`, which marks background the section links but never lists as an item.
  - Items need the collection and a non-blank `author` of their own. `featured` is also one of `items`. Ties go to
    the first slug, whatever the input order.
  - A `draft: true` post is never selected, even in a drafts build: `postSummary` has no draft flag, so a page
    couldn't mark it. The author previews a draft at its own URL.
  - `evidenceLinks` returns '' while `section` is false, so no page links to `/software-factory/` before the
    section is built. The coordinator passes `section: SECTION.published || includeDrafts` (C6 gives the code).
  - **Deferred on purpose:** adding `related: software-factory` to `blog/posts/reading-the-trace/index.md`. The
    build copies the post's Markdown into `dist/`, so the line would change a published file while the section is
    unpublished. The coordinator adds that one line when `config/section.json` turns `published: true`.
- **C2 done** (2026-11-14). `validateEvidence(post)` in `editorial.mjs`, read-only, returns problems; tested in
  `test/editorial-evidence.test.mjs` (14 tests, 46 in the suite). Production build unchanged (85 files); drafts
  build still builds.
  - No `evidence` field: nothing to check. The reference must be a `.json` file name in the post's own folder
    (no directories, no dot files), published or draft.
  - Published: the file must exist, parse, be a valid `evidence` record, have status complete, every top-level
    field non-null, and at least one model and one listed file. A draft's file may be absent or incomplete, but a
    file that is there must be a valid record, and a draft that says `complete` gets the published checks.
  - Every listed file must be inside the post folder (no `..`, no absolute path), not the evidence file itself,
    exist, and match its sha256, in drafts too. `models[].alias` may stay null: the schema allows a raw id with
    no display name yet.
  - The convention is written in the header of `editorial.mjs`: evidence and its data files are copied into the
    post folder, published with the post, never updated by a later snapshot. C3's template and C6's `AGENTS.md`
    section repeat it for the author.
  - For the coordinator (C6 will repeat it): in `build.mjs`, after `loadPosts`,
    `const problems = posts.flatMap(validateEvidence); if (problems.length) throw new Error(problems.join('\n'));`
    so every build, drafts included, fails on a problem.
- **C3 done** (2026-11-14). `blog/templates/software-factory-post/` holds `index.md` and `cover.png` (a copy of
  `blog/templates/post/cover.png`, to be replaced). Tested in `test/editorial-template.test.mjs` (5 tests, 51 in
  the suite). A temporary copy in `blog/posts/` built with `--drafts` (3 posts, page with cover and footnote),
  then was removed; the production build is unchanged (85 files).
  - Front matter: `collection: software-factory`, `author: Filip Stankovic`, `featured: false`,
    `# evidence: evidence.json`, `image: cover.png`, `draft: true`. `parsePost` has no comments, so the commented
    line becomes an unused key `# evidence`; nothing reads it, and `meta.evidence` stays undefined until the author
    removes the `# `. The test pins this.
  - The body is a NOTE box with the guidance (frozen evidence copied from `evidence.incomplete.json`, unknowns
    null, measured versus interpreted, raw id beside display name), one opening prompt, one heading, and a
    footnote linking `evidence.json`. It has no example images, so only `cover.png` must exist.
  - The template is never selected and never built without drafts (tested on a copy).
- **C4 done** (2026-11-14). `blog/posts/fable-5-1-vs-5-2/` holds `index.md`, `cover.png` (the template's) and
  `evidence.json` (a byte copy of `evidence.incomplete.json`: status incomplete, honest nulls, only
  `claude-fable-5-1`). Tested in `test/editorial-draft.test.mjs` (5 tests, 56 in the suite). The drafts build makes
  its page (3 posts; h1 "Fable 5.1 vs. 5.2", noindex, evidence and cover copied); the production build is unchanged
  (85 files) and no file in `dist/` names the slug or title.
  - Front matter: the exact title, `draft: true`, `collection: software-factory`, `author: Filip Stankovic`,
    `featured: false`, `evidence: evidence.json`, `image: cover.png`. The date is the scaffold's day, as
    `npm run new` would set it, and the description is a placeholder.
  - A NOTE box says the date is a placeholder, not a commitment; no raw id is mapped to Fable 5.2 yet (the comparison
    needs a documented alias and cohort mapping from the data the author will import); the evidence is incomplete on
    purpose; and what to replace before publishing.
  - The body is the plan's seven headings (with "Software Factory" for "Factory"), each followed only by an italic
    `_Prompt: ..._` paragraph. The test pins the headings and fails on any paragraph that isn't a prompt (checked
    by adding a sentence with a number), and on any `claude-fable-5-2` in the source.
- Next: C5, the production exclusion test (`loadPosts` without drafts leaves out `fable-5-1-vs-5-2`).
- Status: working

## Loop settings

- session: 83381ddf-927a-43ba-866a-0b4a28f15e20
- model: claude-opus-5-5
- effort: high
- workspace: software-factory-editorial
- fork: 60c94760-e373-4bf5-a5a2-9c7a814f275d

## Loop until

Go on while a phase has a step that needs only your work. Stop with `done` when every Done-when row holds, or is
deferred by the timebox with its finding recorded. Stop with `blocked: ...` only for something that needs the
author or another stream, saying exactly what. Keep the last line of Progress a status: `working`, `done`, or
`blocked: ...`.
