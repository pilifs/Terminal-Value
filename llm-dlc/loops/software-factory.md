# Brief: Software Factory section

**Status of the brief**: drafted 2026-11-14 after Phase 0; approved by the author on 2026-11-14, with the decisions
[below](#decisions).

A brief for [`tools/feature-loop.sh`](../tools/feature-loop.sh), run as three parallel streams and then this loop,
which merges them, finishes Milestone 1 and builds Milestone 2. Run it all, from the default workspace in tmux, with
`llm-dlc/tools/run-streams.sh software-factory`.

**Inputs.** Read these in full before the first piece of work of every cycle:

- [`docs/briefs/software-factory.md`](../../docs/briefs/software-factory.md): the plan. Where it says "Factory", read
  "Software Factory".
- [`docs/software-factory.md`](../../docs/software-factory.md): what Phase 0 froze (the contract, routes, file
  ownership, fixtures, commands) and the R2 options.
- `AGENTS.md` and [`llm-dlc/README.md`](../README.md): writing, committing, never deploying.
- `llm-dlc/loop-summaries/software-factory-integration.md`, the latest integration check of the merged streams,
  once it exists.

## Direction

- **Aggregate first.** Compact metrics, one principal chart, useful breakdowns, then detail on demand (Plausible,
  the shadcn dashboard). Not Buildkite: no build list, agent terminal or execution waterfall as the main page.
- **Authored analysis is first-class**, near the aggregate insights. Automatic observations stay descriptive; a
  reader can always tell measured data from interpretation.
- **Honest data.** Real data from one pinned in-the-loop SHA per snapshot. Never demo data, invented values, or zeros
  standing in for missing data. Nothing called "Live" that isn't.
- **Software Factory** in every title, route, folder, front matter value and schema name; never "Factory" alone.
- **The static site stays.** No React, Next.js, Tailwind or bundler. shadcn is a visual reference only.
- **Unpublished until the author says so.** `config/section.json` stays `published: false`. With it false, the
  production build has nothing of the section, its navigation or its posts' new metadata surfaces.
- **No deploying.** Not to production, and not to dev: `/verify-bytecode/` lives in another copy of the repo, and its
  draft must not be seen. A deploy from here would remove it. Nobody runs `deploy`, `deploy:dev`, `wrangler pages
  deploy` or `sync.py push`.

## Where it starts from

Phase 0, commit `woxwyrxkkzmm` ("Freeze the Software Factory contract and build seams"), on top of `main`:

- `blog/software-factory/` holds the frozen contract (`schema.json`, `validate.mjs`, `identity.mjs`,
  `config/metrics.json`), the config, the stubs each stream fills, the build seam `index.mjs`, and fixtures: a real
  subset of in-the-loop at `7384f8c23eef441817ddb714c6ef5571cdc138bd`, an example snapshot made from it, and ten
  failure cases.
- `npm run test:software-factory` passes 20 tests.
- The production build is byte for byte the pre-Phase 0 build. The drafts build has a placeholder
  `/software-factory/` page.
- in-the-loop is public. `origin/main` was `7384f8c2` on 2026-11-14. The local checkout `../in-the-loop` moves while
  its own loops run: pin SHAs.

## How to work through it

The [standing rules](brief-template.md#standing-rules), the [timebox](brief-template.md#the-timebox) included, then:

- **The contract is frozen.** `schema.json`, `validate.mjs`, `identity.mjs`, `config/metrics.json`,
  `config/section.json` and the Phase 0 tests and fixtures change only in this loop. A stream that needs a contract
  change records it under its Progress, with why, and works around it. This loop decides at the merge. A change bumps
  the version it touches and regenerates the example (`make-snapshot-example.mjs`).
- **One owner per file** (docs/software-factory.md, Ownership). This loop owns the coordinator's files and carries
  out what the streams asked of them.
- **Every workspace sets itself up**: `npm ci` and `npm run build:projects` before its first build. A preview uses its
  own port, so loops don't collide: `PORT=8790 npm run dev` here.
- **Checks for every step that touches the site**: `npm run test:software-factory`, `npm run build`,
  `npm run build:drafts`. While the section is unpublished, the production build must not change, apart from
  published posts' own edits.
- **Network**: npm installs, GitHub (raw files and the API, for in-the-loop at a pinned SHA), and fetching the
  design references named in the plan for their look only. No credentials, no Cloudflare API, no uploads.
- **What needs the author** goes under Progress with what they must do, and the work around it goes on. Examples:
  running `blog/software-factory/ops/setup-r2.sh`, creating the R2 token, deploying, publishing the section.

## Streams

| Loop | Brief | Workspace | Builds | Owns |
| --- | --- | --- | --- | --- |
| `software-factory-data` | [`software-factory-data.md`](software-factory-data.md) | `software-factory-data` | Importer, metrics, browser measures, refresh, the first real snapshot | `import.mjs`, `metrics.mjs`, `measures.mjs`, `config/source.json`, `areas.json`, `models.json`, `data/`, `test/data-*` |
| `software-factory-dashboard` | [`software-factory-dashboard.md`](software-factory-dashboard.md) | `software-factory-dashboard` | The three pages, styles and the client module | `render.mjs`, `blog/assets/software-factory/`, `test/render-*`, `test/client-*` |
| `software-factory-editorial` | [`software-factory-editorial.md`](software-factory-editorial.md) | `software-factory-editorial` | Post selection, bylines, evidence, the template, the draft | `editorial.mjs`, `blog/templates/software-factory-post/`, `blog/posts/fable-5-1-vs-5-2/`, `test/editorial-*` |
| `software-factory` | this brief | `default` | The merge, then Milestone 1's integration, then Milestone 2 | the coordinator's files |

Each stream commits on its own branch, the `@-` line of its workspace. Nothing is merged until all three have
stopped. While they run, `run-streams.sh` builds and tests a merge of their latest commits at most hourly
(`- integration:` below) and writes the result to `llm-dlc/loop-summaries/software-factory-integration.md`. The
streams read that file every cycle.

**Where the streams' work is.** This loop starts in a fresh session. Nothing of theirs is in its context; it all is
in files.

| What | Where |
| --- | --- |
| The planning | Session `60c94760-e373-4bf5-a5a2-9c7a814f275d`: this brief, Phase 0 and the tools. The streams forked from it. |
| Their commits | `jj log -r '::software-factory-STREAM@- ~ ::default@-'` for `data`, `dashboard` and `editorial` |
| Their Progress | `jj file show -r software-factory-STREAM@- llm-dlc/loops/software-factory-STREAM.md`. The copy here predates the streams. It names what each needs from the coordinator's files. |
| Their run records | `llm-dlc/loop-summaries/*-software-factory-STREAM.md` here: each commit, how each run ended, and its summary |
| The integration check | `llm-dlc/loop-summaries/software-factory-integration.md` |

## The plan

### M0. Merge (first, once every stream is finished)

`run-streams.sh` starts this loop only when each stream's status is `done` or `blocked`. A blocked stream is merged
with what it committed, and what it needs goes on the author's list. Started by hand while a stream still runs, a
cycle of this loop does nothing and makes no commit, which stops the loop.

1. **Check the streams have stopped**:
   `systemctl --user is-active feature-loop-software-factory-{data,dashboard,editorial}.scope` all say inactive.
2. **Check each stream's working copy is clean**: run `jj st` in each `$(jj workspace root --name
   software-factory-STREAM)`. A change there is an interrupted cycle: don't commit it. Say so under Progress and stop
   as blocked.
3. **Merge**: `jj new @- software-factory-data@- software-factory-dashboard@- software-factory-editorial@-`. Resolve
   conflicts with the streams' Progress notes. Then `npm ci`, the three builds and every test pass.
4. **Commit the merge** with `sync.py commit`; 0 errors.
5. **Fold the streams' Progress into this brief's**: a line per stream phase with its commits. Read their run
   records for anything deferred. Every contract change a stream asked for is decided here, applied or refused,
   with why.
6. **Forget the workspaces**: `jj workspace forget software-factory-data software-factory-dashboard
   software-factory-editorial software-factory-integration`. Their directories stay for the author:
   `prune_workspaces.py` reports on them.

### M1. Milestone 1: a reviewable section on real data

1. **Carry out what the streams asked** of the coordinator's files. Expected:
   - wire C's byline and the "Data used in this analysis" / "Latest Software Factory data" links into
     `renderPost` (only for posts with the new metadata; older posts render as before);
   - `npm run new -- --software-factory <slug>` from C's template;
   - C's authoring section into `AGENTS.md`;
   - any `build.mjs` or `package.json` need of A or B.
2. **Navigation and home page**: a modest Software Factory entry, rendered only while `published` is true. The
   production build stays unchanged.
3. **Real data in the drafts build**: the committed snapshot from A (`npm run software-factory:validate` passes).
   The overview, analysis and methodology pages render from it, and the static HTML holds the numbers and post
   links without script. Measure the transferred sizes (gzip) of the overview page, `overview.json` and the
   scripts against the plan's budget, about 150 KB, and record them.
4. **End-to-end checks**, recorded under Progress:
   - the production build matches the Phase 0 build apart from published posts' own changes;
   - no draft title, file or evidence appears in any production surface (pages, home, RSS, sitemap, `llms.txt`,
     post folders);
   - the drafts build is noindex throughout;
   - the empty analysis state, a populated one (on a temporary published copy in a test, never committed), the
     unavailable-data state and the fixture banner all render;
   - existing posts and the project demo are unchanged.
5. **Visual review**: desktop and mobile, light and dark, for the four states above.
   - Take the shots with `llm-dlc/tools/screenshot.sh URL OUT_PREFIX` against a local preview (`PORT=8790 npm run
     dev`), into the scratchpad or `/tmp`, never the repo.
   - Look at every shot.
   - Fix what is wrong in B's files (this loop's after the merge), and record what was checked.

### M2. Milestone 2: published-data updates without rebuilding

Built to the R2 decision under [Decisions](#decisions), with tests that need no credentials.

1. **Pages Function** `functions/software-factory/data/[[path]].js`, on the binding `SOFTWARE_FACTORY_DATA`:
   - GET and HEAD only;
   - only `latest.json` and `snapshots/<snapshotId>/(manifest|overview|details/…).json` (anything else 404);
   - `latest.json` with `Cache-Control: no-cache` and a strong ETag, answering `If-None-Match` with 304;
   - snapshot files with `public, max-age=31536000, immutable`;
   - never a generic R2 gateway.

   Test it with a fake binding under `node --test`, and with Wrangler Pages local development if it runs without an
   account.
2. **Configuration**: a repo `wrangler.toml` for the Pages project, with `pages_build_output_dir = "dist"` and
   `SOFTWARE_FACTORY_DATA` bound to `software-factory-data` (production) and `software-factory-data-preview`
   (preview).
   - Once that file exists, Pages takes its bindings from it, so it must carry the project's existing settings. Build
     on `blog/software-factory/ops/terminal-value.pages-config.toml` if the author has copied it in (made by
     `setup-r2.sh`).
   - Otherwise write the file and record under Progress that the author must compare it with the project's
     settings before the first deploy.
   - `npm run deploy` and `deploy:dev` must keep working with it.
3. **Publisher** `blog/software-factory/publish.mjs` (coordinator-owned):
   - runs A's `refresh` into staging and validates it;
   - uploads a new snapshot's files, then reads them back and checks their sha256;
   - only then writes `latest.json`;
   - never replaces a pointer whose snapshot comes from a newer source commit than its own;
   - an unchanged source updates only `lastSourceCheck`.

   - Destinations: separate preview and production.
   - Uploads: R2's S3-compatible API (`https://ACCOUNT.r2.cloudflarestorage.com`), signed with SigV4 in Node, with
     no new dependency.
   - Credentials: only from `SOFTWARE_FACTORY_R2_ACCOUNT_ID`, `SOFTWARE_FACTORY_R2_ACCESS_KEY_ID` and
     `SOFTWARE_FACTORY_R2_SECRET_ACCESS_KEY` (a bucket-scoped token).
   - Tests against a fake store: failure at each step leaves the previous pointer, and an older run never overwrites
     a newer pointer.
4. **Workflow** `.github/workflows/software-factory-refresh.yml`: `workflow_dispatch`, plus a 15-minute schedule
   that does nothing unless the repository variable `SOFTWARE_FACTORY_SCHEDULE` is `on`. A concurrency group
   serializes runs. Secrets are named, never valued, in docs/software-factory.md.
5. **Client against the remote pointer**: check that B's module tries `/software-factory/data/latest.json` and
   falls back to the bundled snapshot whole on a missing binding, error or invalid snapshot, including on a first
   visit with filters set. If it doesn't, fix it here (B's files are this loop's after the merge).
6. **Runbook**: docs/software-factory.md gets what works locally, what is configured, and what the author must
   create and run. Nothing is reported as running remotely unless it was observed running.

## Done when

| Phase | Criterion |
|---|---|
| M0 | The merge is committed with 0 errors; every stream's Progress and contract requests are folded in; the workspaces are forgotten |
| M1 | The drafts build shows the three pages on the committed real snapshot; the production build is unchanged and leaks no draft; the four states render; sizes and the visual review are recorded |
| M2 | The function, publisher and workflow exist with passing credential-free tests for caching, ETags, path limits, fallback, failure and ordering; the runbook says what the author must create |

## Deferred: not in this loop

- **Deploying, publishing the section, creating buckets, tokens or secrets**: the author's.
- **`/verify-bytecode/` reconciliation**: the author brings that source in before any deploy.
- **A runtime producer on the factory machine**: only the contract (`runtime` in schema.json) and its examples.
- **The Fable 5.1 vs. 5.2 comparison**: data imported later from the other project. Here, only the general
  editorial capability and the draft scaffold.

## Decisions

Settled by the author on 2026-11-14:

1. The section is named **Software Factory**, never "Factory" alone, in titles and folders (and, from Phase 0, in
   routes, front matter and schema names).
2. Phase 0 was done interactively before the streams.
3. Three streams (data, dashboard, editorial); this loop merges them and builds Milestone 2.
4. Loops run on `claude-opus-5-5` at high effort. The Fable comparison comes later, with data from another project.
5. The area mapping Phase 0 proposed (`config/areas.json`) is accepted as the initial mapping. What it doesn't
   place goes to Unassigned.
6. `/verify-bytecode/` stays unseen: no deploys from here until the author brings in its source.
7. **R2**: new buckets `software-factory-data` (production) and `software-factory-data-preview` (preview), bound as
   `SOFTWARE_FACTORY_DATA`. Option 1 in docs/software-factory.md.
   - The author creates them on another machine with `blog/software-factory/ops/setup-r2.sh`, which also saves the
     Pages project's current settings.
   - The author also creates a bucket-scoped R2 API token, stored as the three `SOFTWARE_FACTORY_R2_*` GitHub
     secrets.
   - This machine gets updated over ssh when they are ready.
8. A headless browser is set up on this machine (Playwright 1.64.1's Chromium, run by
   `llm-dlc/tools/screenshot.sh`) for visual review; `screenshot.sh --setup` prepares another machine.

## Progress

- Phase 0 done interactively in session `60c94760`: commit `woxwyrxkkzmm`.
- **M0 merge: done** (cycle 1). The three streams had stopped (`is-active` inactive for all three scopes), each
  `done`, each working copy clean. `jj new` of `@-` and the three `@-` merged with no conflict. One test failed on
  the merge, the frozen sitemap assertion stream B asked to change (below), and passed once changed. Then
  `site-integration.sh` passed: `npm ci`, `build:projects`, `build` (2 posts), `build:drafts` (3 posts), 188 of 188
  Software Factory tests, the three Python suites. `software-factory:validate`: valid. The production build is byte
  for byte its parent `d4d33a0`'s (85 files, same sha256). The workspaces are forgotten; their directories stay
  for the author (`prune_workspaces.py`).
  - Each stream's full Progress is now in `llm-dlc/loops/software-factory-{data,dashboard,editorial}.md`. No stream
    deferred anything by the timebox.
  - **A, data** (`software-factory-data.md`): A1 importer `lnmzstnzoqrt`; A2 aggregation `uolsnvpqksnk`; A3 browser
    measures `wtolwwvvsour`; A4 refresh `nmxxoutuylzp`; A5 first real snapshot `nzoxrqzlmyyv`, `sf1-95bf08f3ebdea3fa`
    of in-the-loop `7384f8c2` (19,963 calls, $1,936.419143, reconciled with the rollup; first load about 29 KB gzip).
  - **B, dashboard** (`software-factory-dashboard.md`): B1 overview `xrpswrwsmpxm`, analysis and methodology
    `mkxwywproyvp`; B2 styles `ytuvrukrtoqk`; B3 client module `mllrslyoyyxv`; B4 tests `szuvpsotkuso`; B5 screenshot
    review `rzlsxuxwyqvt`.
  - **C, editorial** (`software-factory-editorial.md`): C1 selection and bylines `omtnqyxuusmq`; C2 evidence checks
    `xswtzwpvuzlk`; C3 template `vxlpnsvvtkrm`; C4 Fable 5.1 vs. 5.2 scaffold `lpyyltmqnnls`; C5 production-leak tests
    `wyllrqpvrmnz`; C6 the coordinator's diffs `usrxuoksolpk`.
  - **Contract requests, decided:**
    - B: `test/build.test.mjs` asserts the published sitemap is exactly `/software-factory/`. **Applied**: it now
      asserts the three pages' URLs, which is what `index.mjs` lists since the analysis and methodology pages exist.
      No version bump: no schema or record changed.
    - A: move the inputs' required fields from `import.mjs` into `config/source.json`. **Refused**: `source.json` is
      hashed into every snapshot id, so the move would change the committed real snapshot's id and the example's
      for no reader-visible gain. They stay in `import.mjs` (`FIELDS`).
    - A: optional additions to `import.mjs`'s interface (`readSources({ dir, fetchImpl, config })`,
      `RawSources.runs`, `loadConfig()`, `campaign` and `rollup`, `refresh`'s options and result) and `measures.mjs`'s
      `METRICS` export. **Accepted**: additive, documented in the module headers, and `METRICS` is tested equal to
      `config/metrics.json`.
    - A: move `source.inputs` (most of the 25 KB gzip manifest) to a detail file in a later schema version.
      **Refused for now**: the first load is about 29 KB of the ~150 KB budget; M1 measures it again.
    - B: "factory wall time" in `config/metrics.json`'s note on the median duration. **Refused**: it is the plain
      word for the factory's elapsed time, not the section's name, and changing the note changes the metric
      definitions' hash and so every snapshot id.
  - **Carried to M1** (coordinator's files, or B's and A's now this loop's): C's five changes (export `SECTION`;
    byline, evidence links and the evidence check in `build.mjs`; `npm run new -- --software-factory`; the
    `AGENTS.md` section); switch B's `measures-local.js` to A's `computeMeasures` and `series` (browser and
    `render.mjs`), keeping `trend`, `periodRange`, `torontoDay`, `datasetDays` and `usageBreakdown`; optional
    `modulepreload` for the client modules; B's note that the area coverage reads "229 of 599 area mapping accepted"
    (A's generator writes that note, so rewording it makes a new snapshot).
  - **For the author** (not this loop's): at launch, add `related: software-factory` to
    `blog/posts/reading-the-trace/index.md` (C's change 4); the Fable 5.1 vs. 5.2 draft's content, evidence and
    cover; a Software Factory cover for the template, if wanted.
- **M1.1 streams' asks: done** (cycle 2).
  - C's changes 1, 2, 3 and 5 as C6 wrote them:
    - `index.mjs` exports `SECTION`;
    - `renderPost` adds `byline(post)` to the date line and `evidenceLinks` after the article, with
      `section: SECTION.published || includeDrafts`;
    - `build()` throws on any `validateEvidence` problem;
    - `npm run new -- --software-factory <slug>`;
    - the "Software Factory posts" section in `AGENTS.md`, between Posts and Format, unwrapped like the rest of the
      file.
  - Change 4 (`related:` on `reading-the-trace`) stays for launch.
  - A's measures:
    - `app.js` imports `computeMeasures` and `series` from `./measures.js`, and `render.mjs` imports `series` from
      `./measures.mjs`.
    - `measures-local.js` keeps only B's own: `METRICS`, `addDays`, `periodRange`, `torontoDay`, `datasetDays`,
      `usageBreakdown`, and `trend`.
    - `trend` now takes `series` points, so the module still has no imports and Node can import it from
      `blog/assets/`.
    - The client tests use A's module. Two expectations follow A's documented rules: `filtered` is true when no filter
      was asked for, and stocks keep their value with `filtered: false` for a period with no data.
  - Checks:
    - 188 of 188 tests pass.
    - The production build is byte for byte `d4d33a0`'s (85 files).
    - The drafts build shows the scaffold's "· By Filip Stankovic" and its "Data used in this analysis" and "Latest
      Software Factory data" line; `reading-the-trace` is unchanged.
    - Headless Chromium on `PORT=8790`: the client loads with no script error. `?period=7d` recomputes the cards with
      A's module ($224.22, 3,498 calls) and the table has 7 days. The only 404 is `/software-factory/data/latest.json`,
      expected without the Function.
    - The evidence check fails the drafts build when the scaffold says `complete` (restored).
    - `new` was checked in a copy under `/tmp`: the flag before or after the slug, a plain post without it, usage and
      exit 1 with no slug.
  - Optional `modulepreload` is left to M1.3's size and round-trip measurement.
- **M1.2 navigation and home page: done** (cycle 3).
  - `blog/software-factory/site.mjs` (coordinator's) adds a "Software Factory" link to every page's header, marked
    `aria-current` on the section's own pages, and a short bordered block under the home page's tagline. Both use
    the section's title and description, now exported by `render.mjs`.
  - Their rules are in `blog/software-factory/site.css`, appended to `dist/style.css` only when the entry shows. The
    production `style.css` stays byte for byte `blog/assets/style.css`.
  - The entry shows where the section is built: in production once `published` is true, and in the drafts build,
    which previews the section. It uses the same condition as the evidence links, `SECTION.published ||
    includeDrafts`.
  - Checks:
    - `test/site-entry.test.mjs` builds whole temporary copies of the site. Unpublished production has no
      "software-factory" in any page, feed, sitemap, `llms.txt` or `_headers`, and its `style.css` matches. Published
      production, in the copy only, has the header link on every page and the home block. It also has the sitemap
      entry, no noindex, and nothing of the draft. The drafts build previews the entry, noindex.
    - 192 of 192 tests pass.
    - The production build is byte for byte `d4d33a0`'s (85 files).
    - `software-factory:validate`: valid.
    - Headless Chromium on `PORT=8790` (shots in `/tmp/sf-m12/`): home, a post and the overview, desktop and mobile,
      light and dark. The header link sits right of the site title, muted. The home block sits between the tagline
      and the posts. Nothing wraps or overflows at 390 px.
- **M1.3 real data and sizes: done** (cycle 4).
  - `software-factory:validate`: valid. The drafts build renders the three pages from the committed
    `sf1-95bf08f3ebdea3fa` (in-the-loop `7384f8c2`). The overview's static HTML already holds $1,936.42 and 19,963
    calls, and the methodology page holds the source SHA. The page has no post links yet, because no Software
    Factory post is published. The empty state says so, and the draft is never listed.
  - **First load of the overview, gzip (level 6)**: 67.3 KB in total, under the ~150 KB budget.
    - Page: 6.7 KB.
    - CSS: 6.6 KB (site 2.2 KB, section 4.4 KB).
    - Scripts: 25.6 KB (`zoom.js` plus `app.js` and its 9 modules; `measures.js` is 3.6 KB).
    - `latest.json`: 0.2 KB.
    - `manifest.json`: 24.5 KB, mostly `source.inputs`, as A said.
    - `overview.json`: 3.6 KB.
    - Brotli would make the total about 57 KB.
    - The details (95 KB gzip, `changes.json` 42 KB and `verification.json` 36 KB) load only when a reader opens
      them. Headless Chromium fetched none on first load.
  - **Script only where it runs.** `app.js` was loaded on the analysis and methodology pages too, along with its
    whole module graph, and did nothing there. It now goes only on the overview, and only when there is a snapshot
    to load.
  - **`modulepreload`: added.** `index.mjs`'s `moduleGraph()` follows `app.js`'s static imports, and `layout()`'s
    new `preloads` option lists them in the head.
    - Measured at 100 ms RTT on the local HTTP/1.1 preview: the modules arrive by 324 ms instead of 439 ms. Without
      preload they wait for `app.js` and come in later waves.
    - The data shows at 844 ms instead of 860 ms. Chromium allows only six HTTP/1.1 connections per host, and the
      deferred `zoom.js`, which runs before the module, queued behind the preloads.
    - Over HTTP/2 the preloads should save one whole round trip. That is reasoning, not a measurement: only the
      local HTTP/1.1 preview was tested.
  - Waterfall, for M2:
    - The data chain is serial: the remote `latest.json` (404 until the Function exists), the bundled `latest.json`,
      the manifest, then the overview.
    - Fetching the overview beside the manifest and checking it afterwards would save one more round trip. That
      change is in `snapshot.js`, and it is left as a finding.
  - Checks:
    - `test/site-load.test.mjs` (with `test/site-build.mjs`, the build harness now shared with `site-entry`):
      - `moduleGraph` on a small graph;
      - the overview preloads every shipped module, and the analysis and methodology pages carry no script;
      - the first load is under 150 KB gzip;
      - with no data, the overview carries no script.
    - With preloads removed, the test fails.
    - 195 of 195 tests pass.
    - The production build is byte for byte `d4d33a0`'s (85 files).
    - `?period=7d` in headless Chromium still recomputes ($224.22, 3,498 calls), with no script error.
- **M1.4 end-to-end checks: done** (cycle 5).
  - **Production against Phase 0.** Phase 0 (`c13b1f23`) built from `git archive` in `/tmp`, beside today's
    production build: the same 85 files, every sha256 equal. No published post changed since Phase 0; the only new
    post is the draft.
  - **`test/site-e2e.test.mjs`**, 7 tests on whole builds of temporary copies (`buildCopy` gained an `edit(root)`
    hook):
    - No draft leak, unpublished and published: no file named for the draft, no file with the content of one of
      its own files, no text naming its slug or title, in any page, the home page, `feed.xml`, `sitemap.xml`,
      `llms.txt` or `_headers`. The post folders are exactly the published posts. The drafts build has the draft,
      so the markers are real, and its section pages never list it.
    - Noindex: every page of the drafts build has the robots meta. Production has none, and no `X-Robots-Tag`.
    - Empty analysis: real numbers in the static HTML, "No analysis published yet" on the overview and the analysis
      page, no banner, no unavailable notice.
    - Populated, on a published copy that adds one Software Factory post and marks `reading-the-trace` related:
      the overview's featured slot and the analysis list carry it with its byline. The related post sits apart
      under "Related background". The posts keep their canonical `/posts/` pages, with the byline, the "Latest
      Software Factory data" link and the related post's link back.
    - Unavailable: a snapshot whose `overview.json` no longer matches its manifest gives "Data unavailable" and
      the validation problem on the overview and methodology. No numbers, no client, no `static-data`.
    - Fixture: the banner on the overview and methodology, from `snapshot-example`. Real data has none.
    - Existing posts and the demo: each published post's files are byte for byte production's in the drafts and
      published builds, apart from the noindex meta, the header link and the related post's link back. The project
      demo is its own build plus `blog/assets/`'s comparison page, the same in every build.
    - Mutations: dropping the new header fails the noindex test; loading drafts into production fails the leak
      and posts tests.
  - **Fixed: the drafts build was not noindex throughout.** Pages had the meta and `robots.txt` disallowed
    everything, but the project demo's pages, the JSON data and the Markdown sources had no noindex. Disallow is
    not noindex. A drafts build's `_headers` now starts with `/*` and `X-Robots-Tag: noindex`. Production's
    `_headers` is unchanged. docs/software-factory.md says so.
  - Found: the draft's `cover.png` is the templates' placeholder, the same file as `terminal-value-pipeline`'s
    cover. That is not a leak, and replacing it is already on the author's list.
  - Checks: 202 of 202 tests pass. The production build is byte for byte Phase 0's (85 files). The drafts build has
    3 posts. `software-factory:validate`: valid.
  - For M2: the author has already copied in `blog/software-factory/ops/terminal-value.pages-config.toml` (commit
    `d4d33a0`), so `wrangler.toml` builds on it.
- **M1.5 visual review: done** (cycle 6).
  - **Shot**: `screenshot.sh` on `PORT=8790`, 64 full-page shots in `/tmp/sf-m15/shots/` (desktop 1280 and mobile
    390, light and dark), cut into tiles, and every one looked at.
    - Empty (the drafts build on the committed snapshot): home, overview, analysis, methodology, `reading-the-trace`
      and the draft.
    - Populated: a published copy in `/tmp/sf-m15/populated` with two temporary Software Factory posts (one featured)
      and `reading-the-trace` related. It showed home, overview, analysis, the featured post and
      `reading-the-trace`.
    - Unavailable: `SOFTWARE_FACTORY_DATA_DIR` on a copy of `data/` whose `overview.json` no longer matches its
      manifest. It showed the overview, analysis and methodology.
    - Fixture: `snapshot-example`, on the overview and methodology.
  - **Fixed**:
    - **The fixture banner on unavailable data.** Any `SOFTWARE_FACTORY_DATA_DIR` set the banner. It then said
      "These numbers come from a small test fixture" over a page that showed no numbers, from data that wasn't the
      fixture. `index.mjs` now sets it only when the override's snapshot loads. The e2e unavailable test asserts
      there is no banner, and it fails with the old line.
    - **Methodology, wrong unit.** The share of usage by model said "share of input tokens", the cache-reuse
      words. It now says "share of estimated usage".
    - **Methodology, figures kept separate.** Each of the three said "Shown on the methodology page only", on the
      methodology page, which shows none of them, because no snapshot carries them. The page drops that sentence
      and says no published snapshot includes them yet. The notes come from `config/metrics.json`, which is left
      alone: changing it changes every snapshot id. A later metrics version can reword them.
    - **Chart caption.** "A day the data doesn't cover shows no column" was the wrong way round. A zero day has
      no column, and a day with no value has a short mark on the baseline: compare the fixture's Nov 3–8 with the
      real data's Nov 9–13. The caption now says both (`view.js`, so the static page and the client match).
    - **The overview's way to the methodology.** It was only in the foot nav, below about 3,400 px of page. Each
      card's Definition now ends with a link to its entry (`methodology/#def-<id>`).
    - **Mobile methodology tables.** Coverage by dataset and Areas of work scrolled sideways at 390 px, with
      coverage and paths off screen. Below 36rem each row now stacks, each cell labelled with its column.
    - **Mobile analysis list.** Every post had a full-width cover. Now only the featured post does, and the
      others keep a 6rem thumbnail, as the plan's "restrained cover treatment" asks.
  - **Looked right, unchanged**:
    - the aggregate-first order, the green-on-pale palette, and dark mode in both themes;
    - the populated featured slot, list, byline, "Related background" apart, and the posts' evidence and back
      links;
    - the existing articles and home page;
    - the draft's prompts and its "Draft" tag;
    - "Data unavailable" with the validation problem.
  - **Left as findings**:
    - The fixture's "Examples by system" and "by origin" are in the fixture's order, not by count. The real
      snapshot is sorted.
    - The fixture has no "Examples by verdict" breakdown. Both come from Phase 0's example generator, not the
      renderer.
  - Checks:
    - Headless Chromium at 390 and 320 px, light and dark: no horizontal page overflow on any of the 17 page-state
      pairs, and no script error. The live overview shows the new caption and four methodology links.
    - The changed views were shot again (`/tmp/sf-m15/shots2/`) and looked at.
    - 202 of 202 tests pass.
    - The production build is byte for byte Phase 0's (85 files).
    - The drafts build has 3 posts.
    - `software-factory:validate`: valid.
- **M1 is done**: every Done-when criterion for M1 holds.
- **M2.1 Pages Function: done** (cycle 7). `functions/software-factory/data/[[path]].js` serves the bucket bound as
  `SOFTWARE_FACTORY_DATA`.
  - **Paths**: only `latest.json` and `snapshots/sf1-<16 hex>/` + `manifest`, `overview` or
    `details/(sessions|changes|verification|examples)` `.json`. That is schema.json's collection path pattern.
    Anything else is 404 without touching the bucket, even when the bucket holds that key. Encoded slashes and dot
    segments are covered too.
  - **Methods**: GET and HEAD. HEAD uses the bucket's `head()` and sends `Content-Length`. Other methods get 405 with
    `Allow`.
  - **Caching**: `latest.json` is `no-cache`. Snapshot files are `public, max-age=31536000, immutable`. Both carry
    R2's strong `httpEtag`, and both answer 304 when `If-None-Match` matches, with the unread body cancelled.
    `If-None-Match` is compared the weak way RFC 9110 asks, because the edge may weaken an ETag when it compresses.
  - **Failures**: a missing object is 404. A missing binding or a throwing bucket is 503, so the client falls back.
    Errors are `no-store`, so a file published later is never stuck at 404.
  - Every response carries `nosniff` and `X-Robots-Tag: noindex`, because `_headers` doesn't apply to a Function.
  - **Added, not in the brief: the unpublished gate.** `wrangler pages deploy` uploads `functions/` with any deploy.
    A production deploy would then serve the section's data while `config/section.json` says `published: false`.
    The function bundles `section.json`. While it is unpublished, the function serves only where
    `SOFTWARE_FACTORY_ENVIRONMENT` is `preview`. Anywhere else, the variable missing included, it answers 404, as a
    site without the section would. M2.2's `wrangler.toml` must set that variable to `preview` and `production`
    per environment.
  - **Checks**:
    - `test/site-function.test.mjs`, 12 tests, against a fake binding with R2's interface (`get`, `head`,
      `httpEtag` as quoted MD5, `size`, `body`) loaded with the committed snapshot. They cover the path allowlist
      and the not-a-gateway case, the methods, both cache policies, ETags and 304 (exact, weak, list, `*`, then a
      changed pointer gives 200), HEAD, the failures and the gate. They also run the browser module through the
      function: `firstSnapshot` loads the remote snapshot, a poll with its ETag is `unchanged`, and an empty,
      failing, partial or unbound bucket falls back to the bundled snapshot, whole.
    - Mutations fail them: no allowlist, no 304, a one-hour cache, no gate, strong-only comparison, and GET for
      HEAD.
    - **Wrangler Pages local dev runs without an account** (wrangler 4.65.0), in a copy under `/tmp/sf-m21`, so no
      `.wrangler/` lands in the repo. The commands:
      - `wrangler pages functions build` bundles the function, with `section.json` inlined.
      - `wrangler r2 object put software-factory-data-preview/<key> --local --persist-to …` loads the 7 files.
      - `wrangler pages dev dist --r2 SOFTWARE_FACTORY_DATA=software-factory-data-preview --binding
        SOFTWARE_FACTORY_ENVIRONMENT=preview --persist-to … --port 8791`.
      - curl showed the same headers. The bytes equal the committed files. 304 came back for the exact and the W/
        ETag, and gzip kept the ETag strong locally. Every rejected path was 404, POST was 405, and the static
        `static-data/` stayed static.
      - Headless Chromium loaded the overview from `/software-factory/data/` (three 200s, "Published data as of
        Nov 14, 2026"), with and without `?period=7d`, with no script error.
    - 214 of 214 tests pass.
    - The production build is byte for byte Phase 0's (85 files). `functions/` is outside `dist/`.
    - The drafts build has 3 posts.
    - `software-factory:validate`: valid.
- **M2.2 configuration: done** (cycle 8). The repo-root `wrangler.toml` builds on the author's
  `ops/terminal-value.pages-config.toml`, saved on 2026-11-14. That file has name `terminal-value`,
  `compatibility_date = "2026-02-14"`, an empty `[env.production]`, and no bindings or variables.
  - The new file adds `pages_build_output_dir = "dist"`.
  - **Top level** (preview, which is every branch but production, and local `wrangler pages dev`):
    `SOFTWARE_FACTORY_DATA` is `software-factory-data-preview`, and `SOFTWARE_FACTORY_ENVIRONMENT` is `preview`.
  - **`[env.production]`**: `software-factory-data` and `production`. Bindings and vars aren't inherited in
    Pages, so this block names both again.
  - **Deploy scripts**: `deploy` and `deploy:dev` are unchanged and keep working. They are read from wrangler
    4.65.0's `pages deploy` source, not run. The `dist` argument and `--project-name` take precedence over the
    file, and both match it. Wrangler picks `[env.production]` when `--branch` is the project's production
    branch, so `deploy` (`--branch=production`) gets production and `deploy:dev` (`--branch=dev`) gets preview.
  - **Checks**:
    - Wrangler's own Pages validator (`readPagesConfig`, the one `pages deploy` runs, called from a copy of
      wrangler's bundle in `/tmp`) accepts the file for the top level, `preview` and `production`, and resolves the
      bindings and vars above. It rejects a copy with an `[env.staging]`.
    - `wrangler pages dev` from a copy in `/tmp/sf-m22/site`, with no `--r2` or `--binding` flags, listed
      `env.SOFTWARE_FACTORY_DATA (software-factory-data-preview)` and `SOFTWARE_FACTORY_ENVIRONMENT ("preview")`. It
      took the directory from `pages_build_output_dir`. `latest.json` came back 200 with the function's headers and
      the committed bytes. The manifest was 200 and a rejected path 404.
    - `test/site-config.test.mjs`, 4 tests, reads the file with wrangler's exported `unstable_readConfig`:
      - each environment's bucket, var and output directory, with no other bindings;
      - the function's gate under each environment's vars (unpublished: preview 200, production 404; published:
        both 200);
      - name, date and flags equal to the saved settings;
      - the deploy scripts naming the same project and directory, with branches `production` and `dev`.
    - Mutations fail those tests: production's var set to `preview`, production bound to the preview bucket,
      production's vars dropped, and a renamed project.
    - 218 of 218 tests pass.
    - The production build is byte for byte Phase 0's (85 files).
    - The drafts build has 3 posts.
    - `software-factory:validate`: valid.
    - No `.wrangler/` was left in the repo.
  - **For the author, before the next deploy of either kind** (from now on, every deploy carries these bindings):
    - Compare `wrangler.toml` with the Pages project's settings. The saved copy is from 2026-11-14.
    - Confirm that the project's production branch is `production`.
    - Run `setup-r2.sh` first, so both buckets exist. A deploy that binds a missing bucket is expected to fail.
      That expectation is untried.
- **M2.3 publisher: done** (cycle 9). `blog/software-factory/publish.mjs`, run as `npm run software-factory:publish
  -- --destination preview|production [--ref REF | --sha SHA] [--checkout PATH]` (a new `publish` command in
  `cli.mjs`).
  - **Steps**, each named in the result when it fails:
    1. **refresh**: A's `refresh` into an empty staging directory, then `validateSnapshotDir` again.
    2. **remote**: read the destination's `latest.json`. When it names another snapshot, read that snapshot's
       manifest for its source commit.
    3. **order**: when the commits differ, ours must descend from theirs. Otherwise the outcome is `refused` and
       nothing is written. A pointer is never replaced by one whose snapshot comes from an older or unrelated
       source commit. A new snapshot of the same commit, from a generator or config change, replaces it.
    4. **upload**: each file the bucket doesn't already hold byte for byte is put, read back and checked by
       sha256. A run after a failed upload puts only what is missing.
    5. **pointer**: only then `latest.json`, as a conditional put. It uses `If-Match` with the ETag read in step 2,
       or `If-None-Match: *` when there was none, so a pointer another run wrote meanwhile stands. It is read back
       too.
  - **Pointer contents.** The same snapshot as the current pointer is `unchanged`: only `lastSourceCheck` moves,
    and `publishedAt` stays. A new one is `new-snapshot`, with `publishedAt` now. A run whose clock is behind the
    pointer's last check is refused. A failed run never touches the pointer, so `lastSourceCheck` stays the last
    successful check.
  - **Destinations**: `DESTINATIONS` maps `preview` and `production` to wrangler.toml's two buckets, and a test
    holds them equal.
  - **Uploads**: `s3Store`, path-style on `https://<account>.r2.cloudflarestorage.com/<bucket>/<key>`, signed with
    SigV4 in `node:crypto` (`signRequest`), no new dependency. A missing key is null. A missing bucket is an error,
    never an empty destination.
  - **Credentials**: only the three `SOFTWARE_FACTORY_R2_*` variables. Missing ones are named, never a value. The
    account id must be 32 hex digits before it goes into a URL.
  - **Order**: `sourceOrder` uses `git merge-base --is-ancestor` in a local checkout, or GitHub's compare API.
    `GITHUB_TOKEN` is optional, only for the API's rate limit.
  - **Checks**:
    - SigV4 equals AWS's published S3 "GET Object" example. It also equals `@smithy/signature-v4`, installed in
      `/tmp`, not the repo, on 4 R2 requests: conditional puts with `If-Match` and with `If-None-Match`, a 5 KB
      put, and a get. Both values are fixed in the test.
    - `test/site-publish.test.mjs`, 24 tests, with no credentials and no network:
      - A fake store: a first publish, unchanged, newer, older and diverged commits, the same commit with a new
        id, and the clock guard.
      - A failure at each step leaves the previous pointer byte for byte. The cases are: refresh (network),
        validate, remote (a store error, an invalid pointer, a missing manifest), order, upload, read-back and
        pointer.
      - A newer pointer written mid-run is never overwritten, and a retry after a failed upload finishes it.
      - A local fake of R2's S3 API checks every request's signature from what arrived. It covers path-style keys,
        ETags, 412, `NoSuchBucket`, and a wrong secret (403, no credential in the result).
      - The rest: the default endpoint, the compare API's URL and token, real git ancestry, the destinations
        against wrangler.toml, the credential variables, and the CLI's usage and missing-credential exits.
    - Each of 10 mutations fails a test. The mutations are: no read-back, no `If-Match`, `behind` accepted, the
      pointer written first, `publishedAt` moved when unchanged, unsorted signed headers, no clock guard, no
      re-validation, no order check, and a 404 always taken as missing.
    - **End to end on the real source**: from the local in-the-loop checkout at `7384f8c2`, through `s3Store`, to
      a local signed fake of R2 (30 requests, no signature rejected). It published `sf1-95bf08f3ebdea3fa`, the
      committed snapshot, and its 6 files equal the committed files byte for byte. A second run was `unchanged`,
      with 0 uploads. It took 1.3 s.
    - 242 of 242 tests pass.
    - The production build is byte for byte Phase 0's (85 files).
    - The drafts build has 3 posts.
    - `software-factory:validate`: valid.
  - **Untried** (no credentials here): real R2. The conditional pointer put relies on R2's S3 API honouring
    `If-Match` and `If-None-Match` on PutObject. M2.4's concurrency group is the first guard either way.
  - **Left as a finding**: older snapshots stay in the bucket. Nothing deletes them yet, and posts copy their own
    evidence.
  - **For the author**: the first real run, `--destination preview`, once the buckets and token exist.
- **M2.4 workflow: done** (cycle 10). `.github/workflows/software-factory-refresh.yml` runs `npm run
  software-factory:publish` on GitHub Actions.
  - **Triggers**:
    - **By hand** (`workflow_dispatch`): to `preview` (the default) or `production`, at `origin/main` or at a
      commit given as 40 lowercase hex digits. Any other input fails before anything is published.
    - **Every 15 minutes** (`*/15 * * * *`): to preview, then production, but only when
      `github.event_name == 'workflow_dispatch' || vars.SOFTWARE_FACTORY_SCHEDULE == 'on'`. Otherwise the job is
      skipped.
    - If one destination fails, the other is still published, and the run fails.
  - **Serialized**: the workflow-level group `software-factory-refresh`, with `cancel-in-progress: false`, across
    both triggers. A run times out after 15 minutes, so a stuck run can't hold the group for long.
  - **Secrets**:
    - The three `SOFTWARE_FACTORY_R2_*` secrets reach only the publish step, through its `env`.
    - Inputs reach the script as environment, never as a `${{ }}` inside it, so no input is ever run as script.
    - The token is `contents: read`. Both checkouts set `persist-credentials: false`.
    - No `GITHUB_TOKEN` is passed. in-the-loop is checked out whole (`fetch-depth: 0`), so the publisher reads it and
      checks commit order with git alone.
  - **Nothing installed**: from a clean copy with no `node_modules`, the publisher and CLI import only Node built-ins.
    So the job skips `npm ci`, and no package's install script runs beside the credentials. Node is
    `24.13.1`, as `package.json` asks.
  - docs/software-factory.md gets the workflow's part: triggers, the gate, the schedule's limits, serializing, and
    the secrets by name. M2.6 makes that the full runbook.
  - **Checks**:
    - `test/site-workflow.test.mjs`, 12 tests, no credentials or network. A small reader handles the YAML subset the
      file uses and throws on anything else. PyYAML 6.0.3, where installed, reads the file the same way; that test
      skips otherwise. The tests cover:
      - the triggers and inputs, with the destination options equal to `DESTINATIONS`;
      - the exact gate, the concurrency group, permissions and the timeout;
      - the publish step's exact `env`, with every secret named being one of `CREDENTIALS` and named nowhere else;
      - the docs naming each secret, the variable and the file;
      - no expression inside a script;
      - the four steps: checkout settings, in-the-loop as `config/source.json`'s repository, and Node equal to
        `engines`;
      - the publish script, run in bash as GitHub runs it (`--noprofile --norc -eo pipefail`) with a stand-in npm:
        each trigger's calls, a failing destination, five bad commit inputs, and an unexpected event.
    - Each of 15 mutations fails a test: `cancel-in-progress: true`, a per-run group, an always-on gate, a secret
      given to a checkout, an input expanded in the script, no commit check, stopping at the first failure, a
      shallow source, stored credentials, an install step, an hourly cron, production alone on the schedule, an
      extra destination, an extra secret, and `contents: write`.
    - **The workflow's own script, end to end**: run with the real npm and CLI from a copy with no `node_modules`,
      on a full clone of the local in-the-loop. Requests went to a local signed fake of R2: dummy credentials, and
      a preload that sent `*.r2.cloudflarestorage.com` there and refused any other host. 93 requests, none
      rejected.
      - A manual preview run at `7384f8c2` gave `new-snapshot` `sf1-95bf08f3ebdea3fa`. A repeat gave `unchanged`,
        and so did a scheduled run's preview leg.
      - The scheduled run then published production. Its 6 files equal the committed snapshot byte for byte.
      - A manual preview run at `f542897f`, a descendant, gave `new-snapshot` `sf1-19b881c0147e875a`.
      - A run at `7384f8c2` after it was `refused` at `order` (`behind`), with the pointer left alone.
      - A commit input of `main` published nothing.
    - 254 of 254 tests pass.
    - The production build is byte for byte Phase 0's (85 files).
    - The drafts build has 3 posts.
    - `software-factory:validate`: valid.
  - **Untried**: no run on GitHub. These come from GitHub's documented behaviour, not from a run:
    - `actions/checkout@v5` and `actions/setup-node@v5`, which the author may pin to commit SHAs;
    - `origin/main` existing in a `fetch-depth: 0` checkout;
    - the `vars` context in a job's `if`.
    A scheduled run happens only from the default branch's copy, so the file must reach `main` first, and that is
    a push, which is the author's.
  - **Found, for the next piece**: in-the-loop moves on in ways A's importer refuses. At `e26b4eb0`, the local
    checkout's HEAD, 83 commits past the pin and not known to be on GitHub, `llm-dlc/traces/metrics.json` has
    `commits[681]` with `summary: null`. `import.mjs` rejects the whole rollup (`schema`, "lacks a change_id or
    summary"), so every publish of a commit like it fails at `refresh`. The pointer stays, as it should, but the
    data stops advancing. `f542897f`, the commit before it, passes.
  - **For the author**:
    - push, so the workflow reaches `main`;
    - one manual run to `preview` once the buckets and secrets exist;
    - then `SOFTWARE_FACTORY_SCHEDULE=on`.
    In a private repository, the schedule costs about 2,900 Actions minutes a month (docs/software-factory.md).
- **M2.5 client against the remote pointer: done** (cycle 11). B's module already did what the brief asks:
  `firstSnapshot` tries `/software-factory/data/latest.json` and, on any failure, loads the bundled snapshot whole.
  The link's filters are fitted to whichever snapshot loads. Nothing needed fixing. What was missing was a test of
  the page itself, `app.js`, rather than its pure modules.
  - **`test/client-browser.test.mjs`**, 19 cases in headless Chromium (Playwright 1.64.1):
    - **Setup.** A drafts build of a temporary copy, served the way Pages serves it: static files, and
      `/software-factory/data/` through the real Pages Function on a fake bucket.
    - **Each case** is a first visit to `?period=7d&model=claude-opus-5-5&measure=model_calls`. It checks:
      - the snapshot shown;
      - the four cards, equal to `computeMeasures` on that snapshot for those filters;
      - the URL and controls kept;
      - the status sentence;
      - no script error;
      - the overview from one base only;
      - the sessions records from the same base.
    - **Remote shown**: the Function with the committed snapshot, and with a different one (the fixture).
    - **Bundled shown**, in 14 cases:
      - no Function route (the static 404 page);
      - no binding, and a failing bucket (both 503);
      - an empty bucket, and the production gate while unpublished (both 404);
      - a pointer whose snapshot is missing, one that isn't JSON, and one with another schema;
      - a manifest naming another snapshot;
      - overview bytes that differ from the manifest, and a missing overview;
      - HTTP 500, a dropped connection, and a remote that never answers (after the 8 s timeout).
    - **Polling**, on the page's faked clock:
      - After a 503 fallback, a poll that gets 500 changes nothing.
      - Then the remote comes back with other data. It is announced, and nothing moves until the reader clicks.
        Then the new snapshot shows under the same filters, with records from the remote.
      - Without a Function route, polls go to the bundled pointer only.
    - **Running it.** Playwright isn't a site dependency, so the file skips unless `NODE_PATH` finds it. In the
      normal run it is the one skipped test. The command is in docs/software-factory.md, Commands.
    - **Mutations**: each of these fails it:
      - no fallback;
      - the link's filters ignored;
      - no byte check;
      - new data shown at once;
      - polling always the bundled pointer;
      - records always from the remote;
      - the static numbers kept when another snapshot loads.
  - **The overview beside the manifest** (M1.3's finding): `loadSnapshot` now asks for
    `snapshots/<id>/overview.json` at the same time as the manifest. It uses that response only if the manifest
    lists the overview at that path, and checks it as before. Otherwise it fetches the listed path. A failed early
    request is swallowed until the manifest says it matters.
    - Measured at 100 ms latency in headless Chromium, on the drafts preview with no Function: data ready at a
      median of 753 ms instead of 861 ms (5 loads each). That is one round trip saved, on the first load and on each
      poll that finds a new snapshot.
    - Three new tests in `client-snapshot.test.mjs`: the overview asked before the manifest answers (fails on the
      old code), an overview listed elsewhere, and no unhandled rejection when the manifest fails. Dropping the
      `catch`, or always using the early response, fails them.
  - **Left as a finding**: the client reads a remote 404 as a missing route and then polls the bundled pointer. That
    is right for the production gate and a site without functions. An empty bucket is a 404 too, so a tab opened
    before the first publish doesn't see it until reload.
  - Checks:
    - 257 of 258 tests pass, with the browser test skipped. With `NODE_PATH` set, its 19 cases pass.
    - The production build is byte for byte Phase 0's (85 files).
    - The drafts build has 3 posts.
    - `software-factory:validate`: valid.
- **The importer finding (M2.4): decided** (cycle 12). A rollup change with `summary: null` is now accepted and
  left out of the changes.
  - **What null means upstream.** in-the-loop's `sync.py` (`commit_summary`) writes None "while the change has no
    message besides trailers", and its session summaries skip such a row as "the working copy before its first
    commit message". It is transient: `vntrxswn…`, null at `e26b4eb0`, is gone from the rollup at the local HEAD
    `6e9a99ee`, which has 683 changes, all with summaries.
  - **Why it is left out, not kept with a null summary.** schema.json requires a change's `summary` to be a string.
    Allowing null is a contract change, so it means `software-factory-changes/v2`. That would change every changes
    file, so every snapshot id, the committed snapshot and the example, for a state upstream itself doesn't count.
    A stand-in text would be an invented value.
  - **No version bump.** Every input that imported before imports byte for byte the same. Before, an input with a
    null summary had no snapshot at all, so no id now means two contents. `GENERATOR` stays version 1. The rule is in
    `import.mjs`'s header.
  - A null row whose change id also has a described row gives that change its sessions. Its sessions' calls count
    in usage from their own metrics files either way. Any other non-string summary is still refused.
  - The methodology's Comparison limits now say that Recorded changes leave such a change out until it has a
    summary.
  - **Checks**:
    - A new `data-import` test: a null row left out, a null row merged into its described twin, and calls, sessions,
      totals, verification and examples unchanged. `undefined`, `42` and `['x']` are still refused. The old importer
      fails it, and so does a version that doesn't merge sessions. `render-pages` asserts the methodology line.
    - `refresh` from the local in-the-loop checkout: `7384f8c2` still gives `sf1-95bf08f3ebdea3fa` (599 changes),
      and `f542897f` still gives `sf1-19b881c0147e875a` (681). `e26b4eb0`, refused before, gives
      `sf1-4bb97a65b3f676db` with 682 changes from 683 rows. `6e9a99ee` gives `sf1-8938373b929f3465` (683).
    - 258 of 259 tests pass, with the browser test skipped. With `NODE_PATH` set, its 19 cases pass.
    - The production build is byte for byte Phase 0's (85 files).
    - The drafts build has 3 posts, and its methodology page has the new line.
    - `software-factory:validate`: valid.
- **M2.6 runbook: done** (cycle 13). docs/software-factory.md gets a Runbook section. It keeps apart what works
  locally, what is configured but has never run remotely, and what the author must create and run. It says plainly
  that nothing of Milestone 2 has run remotely.
  - **Works locally**:
    - the tests, and the browser test with `NODE_PATH`;
    - `software-factory:refresh`, which writes and prunes the committed `data/`, and `validate`;
    - Wrangler Pages local development, as a command block that runs from a `/tmp` copy and loads local R2 from the
      committed snapshot;
    - the publisher, against fakes only: the CLI always talks to real R2, and the two end-to-end runs used a
      throwaway preload that isn't in the repo.
  - **Configured**: `wrangler.toml`'s two environments, the function's gate and failures, the workflow, and the
    destinations. It lists what rests on documentation rather than a run.
  - **Reading a publish result**: the JSON fields, the exit codes, each outcome and what it does to the pointer, the
    steps, and the failure codes.
  - **The importer**: each refusal code (`missing`, `schema`, `malformed`, `reconcile`, `network`, `invalid`,
    `conflict`), keyed to `cases.json`. What it accepts: missing optional inputs, cycle 12's null summary, and
    housekeeping changes. Also how an importer fix gets a new snapshot of the same commit.
  - **The author's steps, in order**: buckets, token, secrets, the checks before any deploy (`/verify-bytecode/`
    included), push, the first manual preview run, the schedule, then launch.
  - The old author list in the Milestone 2 section moved into the runbook. Source layout: `cli.mjs` now says
    "refresh, validate and publish". It adds `publish.mjs`, `ops/`, the function, `wrangler.toml` and the workflow.
  - **Fixed, found while writing it**: an account id that isn't 32 hex digits made the CLI crash with a stack trace,
    because `s3Store` ran outside the CLI's `try`. It now gives the same `ERROR` line as missing variables, exit 1,
    with no value printed. A new assertion in `site-publish`'s CLI test fails on the old `cli.mjs`.
  - **Checks**:
    - The runbook's Wrangler block was run as written, from a `/tmp` copy with wrangler 4.65.0 and no account, on
      port 8791. Both bindings were listed as local.
    - `latest.json` returned the committed bytes, with `no-cache`, an ETag, `nosniff` and noindex, and a 304 on
      `If-None-Match`. A snapshot file was `immutable`. Another path and an encoded slash were 404, and POST was 405.
    - Headless Chromium loaded the overview's data from `/software-factory/data/` with no script error. Then the
      server was stopped by its port.
    - 258 of 259 tests pass, with the browser test skipped. With `NODE_PATH` set, its 19 cases pass.
    - The production build is byte for byte Phase 0's (85 files).
    - The drafts build has 3 posts.
    - `software-factory:validate`: valid.
- **M2 is done**: the function, publisher and workflow exist with passing credential-free tests for caching, ETags,
  path limits, fallback, failure and ordering, and the runbook says what the author must create. Every Done-when row
  holds.
- **For the author** (docs/software-factory.md, Runbook, "What the author must create and run"):
  1. Run `setup-r2.sh`.
  2. Create the bucket-scoped R2 token.
  3. Add the three `SOFTWARE_FACTORY_R2_*` secrets.
  4. Before any deploy:
     - bring in `/verify-bytecode/`'s source;
     - compare `wrangler.toml` with the project's settings;
     - confirm that the production branch is `production`.
  5. Push, optionally pinning the actions to SHAs first.
  6. Run the workflow once by hand, to preview.
  7. Set `SOFTWARE_FACTORY_SCHEDULE=on`.
  8. At launch:
     - set `published: true`;
     - add `related: software-factory` to `reading-the-trace`;
     - deploy.

  Also the author's: the Fable 5.1 vs. 5.2 draft's content, evidence and cover, and the template's cover.
- **Left as findings**: older snapshots stay in R2, since nothing deletes them. The fixture's breakdown order comes
  from Phase 0's generator. A tab opened before the first publish doesn't see it until reload.
- **After the loop** (2026-11-15, interactive, in session `725e0a62`): the author's `verify-bytecode-page` branch is
  merged (`/verify-bytecode/`, `_redirects`, `reading-the-trace` moved to `blog/archive/`); the merge's production
  build equals that branch's (82 files). The first dev deploy ran. Three findings are fixed: an empty bucket now
  answers 404 with `Software-Factory-Data: none`, so a tab opened before the first publish announces it; the
  workflow's actions are pinned to commit SHAs; the publisher prunes snapshots a day after they are superseded.
  The author list above is out of date in three places: the `/verify-bytecode/` source is in; `reading-the-trace` is
  archived, so which post (if any) gets `related: software-factory` at launch is the author's choice; the actions
  are pinned. The runbook in docs/software-factory.md is current. Still the author's: the R2 secrets, the push, the
  first manual run, the schedule, the launch, the Fable draft, and deleting the four stream workspaces
  (`prune_workspaces.py` reports all four safe).
- **The leading sections** (2026-11-15, interactive, at the author's request): the overview now opens with the
  feature loops, the tools and the code, before usage. docs/software-factory.md, "The leading sections", says what
  each shows and what changed in the contract (additive: `overview.loops`, `.tools`, `.code`, the `loops`
  collection, generator and metric definitions 2). The committed snapshot is `sf1-16c8d7d65a6a7ef8`, of in-the-loop
  `fbd1fa86` read from the local clone: 47 runs, 243 cycles, 12,681 tool calls and no prompt typed by a person
  inside a run; 24,066 of 24,501 tool calls succeeded; 172,735 lines of code added, 161,261 in the tree. Checked by
  hand against the run records and `git log --numstat` outside the importer. What the pages can't measure yet is
  in docs/software-factory-upstream.md, for in-the-loop's agents. Still the author's, beside the list above: the
  push, so the workflow publishes a generator 2 snapshot to R2 (until then the page shows its bundled one).
- **A second pass on the leading sections** (2026-11-15, interactive, the author asked to keep going):
  docs/software-factory.md, "A second pass, the same day", lists the new figures. Who set off each day's tool calls
  (the loop's own prompts are behind 74% of all 24,501) and tool calls for each prompt a person typed (14 on Oct 24,
  202 on Nov 8); the loop scripts' own 40 commits; what followed a failed call (404 of 427 were followed by a call
  that succeeded) and failures by time into a run and by loops at once; how much of each day's code still stands,
  from git blame; and what each change took (the middle change 158 output tokens per line). Two corrections: the
  script's four early fixed prompts are no longer counted as a person's, and a change committed in two runs counts
  once in a total, so the headline is 311 commits, not 320. Generator and metric definitions 3; the committed
  snapshot is `sf1-69af3d419ef2c8fd`, still of in-the-loop `fbd1fa86`. Still the author's: the push, so the
  workflow publishes a generator 3 snapshot to R2.
- **A short overview** (2026-11-15, interactive, the author found the overview too cluttered):
  docs/software-factory.md, "A short overview, and a page for each section". The overview is the headline and three
  findings, each a claim, three numbers, one chart and a link; the loops, the tools, the code and the usage panels
  each have their own page (`loops/`, `tools/`, `code/`, `usage/`) under one navigation row. At 1280 wide the
  overview went from 12,750 px to 2,300 px. No change to the contract or the snapshot. `app.js` runs on every page
  of numbers; the filters live on the usage page.
- **Every run on one clock** (2026-11-15, interactive): docs/software-factory.md, "Every run on one clock". The
  loops finding now claims the pace of the busiest stretch ("A commit every 13 minutes for 49 hours") over one
  figure of all 47 runs: a bar a run, a notch a cycle's commit, a diamond where a run ended asking for a person,
  nights shaded, the idle days cut out of the clock. The same figure is on the loops page. Drawn from
  `overview.loops.runs`; no change to the contract or the snapshot. The loops page's title says "no prompt from a
  person", not "nobody at the keyboard".
- **A run's record under the clock** (2026-11-15, interactive): docs/software-factory.md, "Every run on one
  clock". A click on a run of the figure shows its record: every cycle by its commit's summary line, what the run
  took, how it ended, and links to the run record in the source. Two buttons step through all the runs; the address
  keeps the pick as `#run-<id>`. From the `loops` collection the snapshot already has. The overview's opening
  sentence now says what in-the-loop is, from its README: a project that formally verifies Java code.
- **What the factory made** (2026-11-15, moonshot loop `software-factory-impact`): docs/software-factory.md, "What
  the factory made: the example catalog". A second finding, "Output", on the overview: the example catalog as a
  square per example, coloured by verdict, the changes to published libraries ringed and the five with a result so
  far listed by name. From `overview.stocks.examples` and the `examples` collection; no change to the contract or
  the snapshot.
- **What an example found** (2026-11-15, moonshot loop `software-factory-impact`): same section of the docs. The
  snapshot carries each example's `path`, `summary`, source link, severity, kind of change and whether the existing
  tests passed on the same patch, with counts in `overview.catalog` (generator 4, metric definitions 4). The Output
  finding's claim is now "The existing tests passed on 92 of the 100 changes where the verifier found a violation",
  with the sentence that most examples were constructed for the catalog. A square opens its example's record under
  the grid, with links to the example and the change it verifies; the address keeps the pick as `#example-<id>`.
- **The catalog's own page** (2026-11-15, moonshot loop `software-factory-impact`): docs/software-factory.md, "The
  catalog's own page". `/software-factory/examples/`, linked from the Output finding and the navigation: the grid
  narrowed by verdict, existing tests, severity, kind of change, system and kind of defect, with a sentence for
  what is lit, every title, and the catalog cut into four tables. From the `examples` collection; no change to the
  contract or the snapshot.
- **Model performance, as a finding** (2026-11-15, moonshot loop `software-factory-impact`):
  docs/software-factory.md, "The model performance finding". The overview's third finding leads with "24,501 tool
  calls, never more than 4 failures in a row" and shows the share that failed by time into a run and by context
  size, in place of the share that succeeded over a chart of days. From `overview.tools`; no change to the
  contract or the snapshot.
- **What it took** (2026-11-15, moonshot loop `software-factory-impact`): docs/software-factory.md, "What it took:
  the usage finding" and "What the section ships". A fifth finding on the overview: every session on record for an
  estimated $2,174.98 of model usage, with usage per day by model; it replaces the "What the factory used" card.
  It took the first load over the 150 KB budget, so the build now ships the section's scripts and stylesheet
  without their full-line comments: 135.7 KB. Open for the author: the manifest's list of source files is 34 KB of
  the first load and grows with every session.
- **The counterexample itself** (2026-11-15, moonshot loop `software-factory-impact`): docs/software-factory.md,
  "What a verdict rests on" and "The counterexample, in an example's record". The importer reads each example's
  own `result.json`; a record carries the test task, the first counterexample or the model checker's trace, and
  the attempt's seconds (generator 5, snapshot `sf1-5959e891382708eb` from the same revision). A picked example
  shows them as a terminal panel, and the Output finding says 100 of 100 violations come with a counterexample.
  The result files are one input in the manifest, to keep the first load at 136.7 KB.
- **What was read against what was written** (2026-11-15, moonshot loop `software-factory-impact`):
  docs/software-factory.md, "The figures kept beside the estimate" and "The usage page leads with a result". The
  importer reads each call's thinking tokens and its price with nothing cached, and Claude Code's own count per
  session (generator 6, snapshot `sf1-7cf8461b4bb82b59` from the same revision). The usage page opens with
  "3.58 billion tokens read to write 23.3 million", bars on one scale for tokens and for list price ($18,406.98
  with nothing cached, $2,174.98 as recorded, $2,806.76 by the client's count), and a note that the estimate
  runs low. The overview's usage finding says both in passing; the methodology page gives the separate figures
  their values. First load 139.9 KB.
- **What a link preview says** (2026-11-15, moonshot loop `software-factory-impact`): docs/software-factory.md,
  "What a link preview says". Each page's description starts with the result it leads with, read from its
  headline, so a shared link or a search result shows "12,681 tool calls and 311 commits without a prompt from a
  person" and not a sentence about the section. No share image yet.
- **One revision with the landing page** (2026-11-15, moonshot loop `software-factory-impact`):
  docs/software-factory.md, "One revision with the landing page". The author's decisions of that day: the snapshot
  follows the revision `/prove-java-change/` reads, these pages match its totals and wording, the first-load
  budget is 300 KB. Snapshot `sf1-9d69f4babf0c2699` at in-the-loop `e9908ab3`; usage, tool calls, commits and the
  catalog now agree with the landing page. Loops do not yet: the source's new `llm-dlc/traces/loops.json` (34
  loops, 109 runs) is not read. `claude-fable-5-2` is shown by its raw id until the author maps it.
- **The source's own account of its loops** (2026-11-15, moonshot loop `software-factory-impact`):
  docs/software-factory.md, "The source's own account of its loops". The importer reads
  `llm-dlc/traces/loops.json` (generator 7, `overview.loopAccount`, snapshot `sf1-9860c93fb02006c6`). The overview
  now opens with the landing page's sentence, "590 of 742 commits were made inside a loop run", and the loops page
  with 34 loops, 109 runs and 350 cycles, a table by kind and every loop. The clock and the campaigns still come
  from the 50 run records and say so.
- **The landing page's verdict words and count** (2026-11-15, moonshot loop `software-factory-impact`):
  docs/software-factory.md, "The landing page's verdict words and count". Refuted, Established and Left open on
  every page (generator 8, snapshot `sf1-2bb59ff53f60af2d`). The claim is the landing page's "92 of 100 refuted
  example changes had passed their unit tests". An example the catalog gives no verdict is counted by the marks
  in its label, so 163 of 183 have a verdict, as the landing page says; five have more than one and are drawn
  split.
- **Every run of every loop on one clock** (2026-11-15, moonshot loop `software-factory-impact`):
  docs/software-factory.md, "Every run of every loop on one clock". The clock on the overview and the loops page is
  drawn from the source's account (generator 9, `overview.loopAccount.runs`, snapshot `sf1-a9d0b91194c5ab43`): 109
  runs from Oct 31, the verification loop's sessions in a gray row of their own. The pace claim stays on the loops
  that write code. Runs with a run record still open; the other 59 don't yet.
- **How the sessions lasted** (2026-11-15, moonshot loop `software-factory-impact`): docs/software-factory.md,
  "How the sessions lasted: a sixth finding". Time at work, compactions, peak context and the cache events by
  cause are read from the rollup (generator 10, `overview.endurance`, snapshot `sf1-dc701302bcf135a5`). The
  overview's sixth finding is "Sessions compacted their context 392 times and kept working"; the usage page has
  the numbers, the shares and the table of cache events under it.
- Status: done

## Loop settings

- session: 725e0a62-c947-420f-aa40-a10073f7d900
- model: claude-opus-5-5
- effort: high
- memory: 6G
- streams: data dashboard editorial
- integration: llm-dlc/tools/site-integration.sh

## Loop until

The merge comes first. Don't stop before the merge is committed, unless a stream's working copy holds an interrupted
cycle, or the merge needs the author. Then M1, then M2. Go on while a cycle can finish a piece of work that needs
only you. Stop with `done` when every Done-when row holds or is deferred by the timebox with a recorded finding.
Stop with `blocked: ...` when what is left needs the author, with exactly what they must do. Keep the last line of
Progress a status: `working`, `done`, or `blocked: ...`.
