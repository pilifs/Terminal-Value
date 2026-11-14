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
- Next: M1.2, a Software Factory entry in the navigation and on the home page, rendered only while `published` is
  true.
- Status: working

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
