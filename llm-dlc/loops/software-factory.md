# Brief: Software Factory section

**Status of the brief**: drafted 2026-11-14 after Phase 0; awaiting the author's review before
`run-streams.sh software-factory`.

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
  creating buckets, tokens, secrets, deploying, publishing the section, the area mapping's review.

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
5. **Visual review**: desktop and mobile, light and dark, for the four states above. Use screenshots if a headless
   browser can be run without adding a dependency to `package.json` (for example `npx -y playwright@<a version at
   least two weeks old> screenshot`). Otherwise list exactly what the author should look at.

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
2. **Configuration**: the binding for preview and production, in the form Pages reads, with the bucket names the
   decision gives. Note under Progress anything that only the dashboard or an account can set.
3. **Publisher** `blog/software-factory/publish.mjs` (coordinator-owned):
   - runs A's `refresh` into staging and validates it;
   - uploads a new snapshot's files, then reads them back and checks their sha256;
   - only then writes `latest.json`;
   - never replaces a pointer whose snapshot comes from a newer source commit than its own;
   - an unchanged source updates only `lastSourceCheck`.

   Separate preview and production destinations; credentials only from the environment. Test it against a fake
   store: failure at each step leaves the previous pointer, and an older run never overwrites a newer pointer.
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
- **Reviewing the area mapping**: the author's. The data stream applies the proposed one, with Unassigned.

## Decisions

Settled by the author on 2026-11-14:

1. The section is named **Software Factory**, never "Factory" alone, in titles and folders (and, from Phase 0, in
   routes, front matter and schema names).
2. Phase 0 was done interactively before the streams.
3. Three streams (data, dashboard, editorial); this loop merges them and builds Milestone 2.
4. Loops run on `claude-opus-5-5` at high effort. The Fable comparison comes later, with data from another project.
5. Phase 0 proposed an area mapping for direction; the data stream starts with Unassigned for whatever the mapping
   doesn't place.
6. `/verify-bytecode/` stays unseen: no deploys from here until the author brings in its source.
7. **R2 (to confirm before running)**: new buckets `software-factory-data` (production) and
   `software-factory-data-preview` (preview), bound as `SOFTWARE_FACTORY_DATA`. Option 1 in docs/software-factory.md.
   The author creates them later.

## Progress

- Phase 0 done interactively in session `60c94760`: commit `woxwyrxkkzmm`.
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
