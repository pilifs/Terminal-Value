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
- **C5 done** (2026-11-14). The selection tests (C1) and evidence tests (C2) were already in place. The production
  test is `test/editorial-production.test.mjs` (6 tests, 62 in the suite, all passing) and runs on the real
  `blog/posts/`. `loadPosts` without drafts leaves out every draft, the scaffold included. No published post's source
  names the draft's slug or title. `selectPosts` on production posts never names it. A published section built from
  production posts into a temporary folder writes no file, sitemap entry, llms.txt line or header that names it.
  Every post, drafts included, passes `validateEvidence`. Production build unchanged (85 files, 0 files name the
  slug or title).
  - To check the tests bite, I set the scaffold to `draft: false` for one run: 7 tests failed, then I restored it.
    The section-build test still passed, because Phase 0's `render.mjs` (stream B's) doesn't list posts yet. That
    test guards the merged result once the section page lists `selectPosts` output.
- **C6 done** (2026-11-14). The coordinator's changes, below. I checked them in a throwaway copy of the blog under
  `/tmp`, not in this workspace, then deleted it.
  - Production build byte-identical to today's (85 files, same sha256).
  - Drafts build (3 posts): the scaffold's `.meta` reads "Nov 14, 2026 · By Filip Stankovic" before the Draft badge,
    and a `.source` line links `evidence.json` and `/software-factory/`. `reading-the-trace` is unchanged.
  - Setting the scaffold's evidence to `complete` failed the drafts build (exit 1, one line per null field).
  - `new` makes a dated Software Factory draft with the flag before or after the slug, and still makes a plain post
    without it. With no slug it prints usage and exits 1.
  - No CSS is needed: `.byline` sits inside `.meta` and takes its muted colour; the links reuse `.source`.
  - **1. The section's published flag** (`blog/software-factory/index.mjs`). `renderPost` must know whether
    `/software-factory/` exists, so export the flag that's already read:
    ```diff
    -const SECTION = JSON.parse(fs.readFileSync(path.join(HERE, 'config', 'section.json'), 'utf8'));
    +export const SECTION = JSON.parse(fs.readFileSync(path.join(HERE, 'config', 'section.json'), 'utf8'));
    ```
  - **2. The byline, the evidence links and the evidence check** (`blog/build.mjs`):
    - The byline goes in the post's date line.
    - The links go between the article and the "available as Markdown" line. A collection post links "Data used in
      this analysis" (its own `evidence.json`) and "Latest Software Factory data" (`/software-factory/`). A
      `related: software-factory` post links back to the section's analysis, "More analysis in the Software
      Factory" (`/software-factory/analysis/`).
    - Both are empty in production while `published: false`, so no page links a route that isn't there.
    - Every build, drafts included, fails on an evidence problem.
    ```diff
    -import { buildSection } from './software-factory/index.mjs';
    +import { byline, evidenceLinks, validateEvidence } from './software-factory/editorial.mjs';
    +import { buildSection, SECTION } from './software-factory/index.mjs';
    @@ function renderPost(post) {
       const draft = meta.draft ? '<span class="draft">Draft</span>' : '';
    +  // Software Factory: the author's byline, and links to the post's frozen
    +  // evidence and the section, once the section is built.
    +  const links = evidenceLinks(post, { section: SECTION.published || includeDrafts });
       const body = `      <article>
         <h1>${escapeHtml(meta.title)}</h1>
         <p class="meta"><time datetime="${meta.date}">${formatDate(
         meta.date
    -  )}</time>${draft}</p>
    +  )}</time>${byline(post)}${draft}</p>
         ${html}
    -      </article>
    +      </article>${links ? `\n      ${links}` : ''}
           <p class="source">This post is also available as ...
    @@ async function build() {
         render: (dir, body) => createMarkdown(highlighter, dir).parse(body),
       });
    +  const problems = posts.flatMap(validateEvidence);
    +  if (problems.length) throw new Error(problems.join('\n'));
    ```
  - **3. `npm run new -- --software-factory <slug>`** (`blog/new-post.mjs`). Same date rewrite, other template:
    ```diff
    -// Starts a new draft post from blog/templates/post.
    +// Starts a new draft post from blog/templates/post, or with
    +// --software-factory from blog/templates/software-factory-post.
     //
     //   npm run new -- <slug>
    +//   npm run new -- --software-factory <slug>
    @@
    -const slug = process.argv[2];
    +const args = process.argv.slice(2);
    +const softwareFactory = args.includes('--software-factory');
    +const slug = args.find((arg) => !arg.startsWith('--'));
    @@
    -  console.error('Usage: npm run new -- <slug>   (lowercase words joined by -)');
    +  console.error(
    +    'Usage: npm run new -- [--software-factory] <slug>   (lowercase words joined by -)'
    +  );
    @@
    -fs.cpSync(path.join(BLOG_DIR, 'templates', 'post'), dir, { recursive: true });
    +const template = softwareFactory ? 'software-factory-post' : 'post';
    +fs.cpSync(path.join(BLOG_DIR, 'templates', template), dir, { recursive: true });
    ```
  - **4. At launch only** (when `config/section.json` turns `published: true`), add one front matter line to
    `blog/posts/reading-the-trace/index.md`, after `image: cover.png`: `related: software-factory`.
    - In the throwaway copy, the drafts build then showed the "More analysis" link on that post.
    - The production build hid the link, but its copied `index.md` carried the line. That is why the line waits for
      launch.
  - **5. An authoring section for `AGENTS.md`**, between `## Posts` and `## Format`:
    ```md
    ## Software Factory posts

    - Start one with `npm run new -- --software-factory <slug>`. This copies
      `blog/templates/software-factory-post/`, whose body repeats these rules.
    - Extra front matter, all flat and optional:
      - `collection: software-factory` lists the post in the section's analysis
        at `/software-factory/analysis/`, if it also has an `author` line.
      - `author: Filip Stankovic` is the byline. Attribution is explicit: a post
        without its own `author` line gets no byline and is never listed as the
        author's analysis, whoever the site's author is. Never add an author line
        to a post someone else wrote.
      - `featured: true` makes it a candidate for the featured slot. The newest
        wins.
      - `evidence: evidence.json` names the frozen data the article was written
        from.
      - `related: software-factory` links a background post, such as one an agent
        wrote, from the section without listing it as analysis.
    - Evidence is frozen. Copy `evidence.json` and every data file it lists into
      the post's folder, so the article keeps its numbers when the dashboard's
      data changes or the feed fails. Never update a published article's evidence
      from a later snapshot: a new analysis gets new evidence. Start from
      `blog/software-factory/test/fixtures/evidence.incomplete.json`, keep what
      isn't known `null` and the status `incomplete`, and set `complete` only
      when every field is real. The build fails when a published post's evidence
      is missing, incomplete, or doesn't match its files' sha256.
    - A draft's evidence may be incomplete or absent. The section never lists a
      draft, even in the drafts build. Preview it at its own URL with
      `npm run dev`.
    - Name a model by its display name with the raw id beside it, such as
      "Fable 5.1 (`claude-fable-5-1`)". Map a raw id to a display name only from
      a documented source. Keep what was measured apart from what you interpret.
    ```
- Every Done-when row holds, C1 to C6. What's left is the coordinator's: the five changes above, at the merge or (4)
  at launch.
- Status: done

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
