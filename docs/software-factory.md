# Software Factory: contract, ownership and runbook

The Software Factory section shows what the software factory in [in-the-loop](https://github.com/pilifs/in-the-loop)
produces, how its activity and efficiency change, and what the author learns from running it. The plan is
[`docs/briefs/software-factory.md`](briefs/software-factory.md). This page holds what Phase 0 froze for the
streams that build it, and how to run it.

## Naming

The section is called **Software Factory**, never "Factory" alone, in titles, routes, folders, front matter and
schema names. The plain word would collide with the company Factory AI. Where the brief says "Factory", read
"Software Factory". Code inside `blog/software-factory/` uses short names (`aggregate`, `renderPages`), since the
folder already qualifies them.

## State at Phase 0

- **Unpublished.** `blog/software-factory/config/section.json` says `published: false`. A production build leaves
  out every page, asset and data file of the section, and stays byte for byte what it was before Phase 0: all 85
  files had the same sha256. A drafts build (`npm run dev`, `build:drafts`) includes the section, noindex: a
  robots meta on every page, and `X-Robots-Tag: noindex` on every response through `_headers`. Only the author sets
  `published: true`.
- **`/verify-bytecode/`.** The source lives in another copy of the repo, and its draft must not be seen. This repo
  doesn't have it, and building and deploying from here would remove that page. Nobody deploys from here, to dev
  or production, until the author has brought that source in.
- **Upstream baseline.** in-the-loop `origin/main` was `7384f8c23eef441817ddb714c6ef5571cdc138bd`, the brief's
  audited revision. It is public: a refresh fetches by SHA from `raw.githubusercontent.com` with no token. The
  local checkout's HEAD moves while its loops run, so always pin a SHA.

## Routes and files

| Route | What | Made by |
| --- | --- | --- |
| `/software-factory/` | Overview | `render.mjs` (B) |
| `/software-factory/analysis/` | The author's Software Factory posts | `render.mjs` (B) from `editorial.mjs` (C) |
| `/software-factory/methodology/` | Definitions, coverage, provenance, freshness, limits | `render.mjs` (B) from `config/metrics.json` |
| `/software-factory/style.css`, `app.js` | Browser files | `blog/assets/software-factory/` (B) |
| `/software-factory/measures.js` | Period measures in the browser | `measures.mjs` (A), copied by `index.mjs` |
| `/software-factory/static-data/latest.json` | Pointer to the bundled snapshot | `data/` (A's refresh), copied by `index.mjs` |
| `/software-factory/static-data/snapshots/<id>/…` | The bundled snapshot: `manifest.json`, `overview.json`, `details/*.json` | as above |
| `/software-factory/data/…` | The same layout, served from R2 by a Pages Function (Milestone 2) | `functions/software-factory/data/[[path]].js` (merge loop) |
| `/posts/<slug>/` | Posts stay canonical here, never copied under the section | `build.mjs` |

Source layout:

```
blog/posts.mjs                    parsePost, loadPosts (drafts left out before rendering)
blog/software-factory/
  index.mjs                       buildSection: the build seam (coordinator)
  cli.mjs                         refresh, validate and publish commands (coordinator)
  publish.mjs                     the publisher to R2 (coordinator)
  ops/                            setup-r2.sh and the saved Pages settings (coordinator)
  site.mjs  site.css              the section's entry in the site header and home page (coordinator)
  schema.json  validate.mjs       the frozen contract and its validator
  identity.mjs                    canonical JSON, config hash, snapshot id
  config/                         section, source, metrics, areas, models
  import.mjs  metrics.mjs  measures.mjs    stream A
  render.mjs                      stream B (+ blog/assets/software-factory/)
  editorial.mjs                   stream C (+ the draft post and its template)
  data/                           the committed snapshot (written by refresh only)
  test/                           *.test.mjs per workstream; fixtures/
functions/software-factory/data/[[path]].js   the Pages Function serving R2 (coordinator)
wrangler.toml                     the Pages project's bindings and variables (coordinator)
.github/workflows/software-factory-refresh.yml   the publisher on GitHub Actions (coordinator)
```

Nothing under `test/`, `config/` or the modules is public. `blog/assets/` is copied whole into the site, so only
intended browser files go in `blog/assets/software-factory/`.

## Ownership

One owner per file, so streams merge cleanly. A stream that needs a change in a file it doesn't own writes down
what it needs under its Progress, and the merge does it.

| Owner | Files |
| --- | --- |
| Coordinator (Phase 0, then the merge loop) | `blog/build.mjs`, `blog/posts.mjs`, `blog/new-post.mjs`, `blog/assets/style.css`, `package.json`, `package-lock.json`, `blog/software-factory/index.mjs`, `cli.mjs`, `ops/`, `functions/`, `wrangler.toml`, `.github/workflows/`, `docs/software-factory.md`, site navigation and the home page (`site.mjs`, `site.css`, `test/site-*.mjs`) |
| Contract (frozen; changes only at the merge) | `schema.json`, `validate.mjs`, `identity.mjs`, `config/metrics.json`, `config/section.json`, `test/contract.test.mjs`, `test/build.test.mjs`, `test/fixtures/upstream/`, `snapshot-example/`, `cases.*`, `make-*.mjs` |
| A, data | `import.mjs`, `metrics.mjs`, `measures.mjs`, `config/source.json`, `config/areas.json`, `config/models.json`, `data/`, `test/data-*.test.mjs` |
| B, dashboard | `render.mjs`, `blog/assets/software-factory/`, `test/render-*.test.mjs`, `test/client-*.test.mjs` |
| C, editorial | `editorial.mjs`, `blog/templates/software-factory-post/`, `blog/posts/fable-5-1-vs-5-2/`, `test/editorial-*.test.mjs`, the authoring section of `AGENTS.md` (written as a proposal under Progress for the merge) |

## The contract, `software-factory/v1`

`blog/software-factory/schema.json` defines every record. `validate.mjs` checks them: `validate(name, value)` for
one record, `validateSnapshotDir(dir)` for a whole snapshot.

| Record | File | Notes |
| --- | --- | --- |
| `pointer` | `latest.json` | Transport: `publishedAt` and `lastSourceCheck` change on every check, the snapshot doesn't |
| `manifest` | `snapshots/<id>/manifest.json` | Source repo and SHA, each input's sha256, generator, config hash, metric definitions, collections with sha256 and bytes, and datasets with bounds and coverage |
| `overview` | `overview.json` | All-time measures; a usage table by day × model × effort; one verification row per job; stocks; breakdowns; insights |
| `sessions`, `changes`, `verification`, `examples` | `details/*.json` | Loaded only when a reader asks for detail |
| `postSummary` | in memory | `editorial.mjs` output for the pages |
| `evidence` | a post's `evidence.json` | Frozen article data; `status: complete` before a post with numbers is published |
| `runtime` | (future) | A producer on the factory machine; past `expiresAt` it is unavailable, never zero |

**Snapshot identity** (`identity.mjs`): the id is `sf1-` plus 16 hex digits of a hash over the source SHA, the
generator, the config hash, the metric definitions' hash and the content. No clock goes into it. Refreshing an
unchanged source makes no new snapshot. A fix to the importer (a new generator version) or to the config makes a
new snapshot without a new upstream commit. Published JSON is compact, with one trailing newline.

**Metrics** (`config/metrics.json`, version 1): estimated model usage, model calls, input cache reuse and completed
verification jobs on the first screen. Then median verification duration, recorded changes and examples in the
catalog (stocks), and share of usage by model. Each metric names the filters it supports. Usage metrics take
period, model and effort. Verification metrics take period only, because 111 of 321 job records link a submitting
session. Stocks take none. Calendar days are America/Toronto, rebucketed from UTC timestamps, half-open.

**Interfaces**, each written out in its module's header:

- `import.mjs`: `readSources`, `normalizeSources`, `refresh`, `SourceError`
- `metrics.mjs`: `GENERATOR`, `aggregate`
- `measures.mjs`: `computeMeasures`, `series` (a plain browser module, too)
- `render.mjs`: `renderPages`
- `editorial.mjs`: `COLLECTION`, `postSummary`, `selectPosts`, `validateEvidence`
- `index.mjs`: `buildSection`, `loadSnapshot`

**Fixtures** (`blog/software-factory/test/fixtures/`):

- `upstream/` is a real subset of in-the-loop at `7384f8c2`: four sessions (590 calls, $101.07, four models,
  subagent calls, Toronto's DST change on 2026-11-01), one session listed without a metrics file, 12 verification
  results with their job records, and 11 examples. Prose is left out. `SOURCE.json` lists every change, and
  `make-upstream-fixture.mjs` regenerates it.
- `snapshot-example/` is a whole snapshot made from it by `make-snapshot-example.mjs`. Stream B renders against it.
  Stream A's `aggregate()` must reproduce its usage and verification tables, measures and stocks.
- `cases.json` and `cases.mjs` hold ten explicit missing, stale and error cases, each with the outcome `refresh()`
  must give.
- `runtime-observation*.json` and `evidence.incomplete.json` are examples of the producer and evidence contracts.

## Areas

`config/areas.json` was proposed in Phase 0 and accepted by the author on 2026-11-14 as the initial mapping. It
has six areas of the factory's work
(verification engine, example catalog, runtime evidence, verification pipeline, agent process, skills and plugins),
matched by campaign (loop brief names, change summaries) and then by path. Anything else goes to **Unassigned**,
which is always shown. The data stream applies the rule as written, and the example already puts 58 of its 64
changes in Unassigned. That is the honest starting point the author asked for, and the mapping improves as
campaigns get recorded. Example subject tags (payments, consensus, …) are a separate taxonomy.

## Commands

```sh
npm run test:software-factory        # every workstream's tests
NODE_PATH=/tmp/pw/node_modules node --test blog/software-factory/test/client-browser.test.mjs
                                     # the overview in headless Chromium against each remote failure; it skips
                                     # without Playwright (npm i --prefix /tmp/pw playwright@1.64.1)
npm run software-factory:refresh -- --sha <sha> [--checkout ../in-the-loop]
npm run software-factory:validate    # the committed snapshot
npm run build && npm run build:drafts
PORT=8791 npm run dev                # a second preview beside another on 8788
llm-dlc/tools/screenshot.sh http://localhost:8791/software-factory/ /tmp/sf/overview   # 4 shots: desktop/mobile x light/dark
llm-dlc/tools/screenshot.sh --setup  # headless Chromium on another machine (prints the apt line if libraries are missing)
SOFTWARE_FACTORY_DATA_DIR=blog/software-factory/test/fixtures/snapshot-example npm run dev   # preview on the fixture
```

## Milestone 2: serving from R2

The Pages Function serves `/software-factory/data/*` with GET and HEAD only, from one R2 bucket binding:
`latest.json` with `Cache-Control: no-cache` and a correct ETag, and immutable caching under `snapshots/`. A
publisher job runs the same importer, uploads a new snapshot's files, checks them, and only then replaces
`latest.json`. The job runs one at a time, and never lets an older run overwrite a newer pointer.

**Decided on 2026-11-14: option 1.** The options were:

1. **New buckets, one per environment (chosen):** `software-factory-data` for production and
   `software-factory-data-preview` for preview, both bound as `SOFTWARE_FACTORY_DATA` in the Pages project. They
   stay apart from `llm-traces`, which holds redacted session logs behind the in-the-loop CDN Worker. A
   publishing token scoped to these two buckets can't touch the logs.
2. **Reuse `llm-traces` under a `software-factory/` prefix:** nothing new to create, but the function and the
   publishing token would reach the session logs, and only code would keep them apart.
3. **No R2:** each refresh commits a snapshot and redeploys the site (Milestone 1 only). Simplest, but every data
   update is a deploy.

**The refresh workflow**, `.github/workflows/software-factory-refresh.yml`, runs the publisher on GitHub Actions:

- **By hand** (Actions, Software Factory refresh, Run workflow): to `preview` (the default) or `production`, at the
  head of in-the-loop's `main` or at one commit, given as 40 lowercase hex digits.
- **On a schedule**, every 15 minutes, to preview and then production, but only while the repository variable
  `SOFTWARE_FACTORY_SCHEDULE` is `on`. Otherwise each scheduled run is skipped. GitHub's schedule is best-effort: a
  run can start late or be dropped under load. Only the default branch's copy of the file is scheduled. In a public
  repository, GitHub turns the schedule off after 60 days without activity. In a private one, each run bills at least
  a minute, so about 2,900 minutes a month at 96 runs a day.
- **One run at a time**, across both triggers: the concurrency group `software-factory-refresh`. A run under way is
  never cancelled. GitHub keeps only one waiting run, though, and a newer one replaces it, so a manual run waiting
  behind another can be replaced by the next scheduled one. The publisher never lets an older source commit replace
  a newer pointer either way.
- **Secrets**: `SOFTWARE_FACTORY_R2_ACCOUNT_ID`, `SOFTWARE_FACTORY_R2_ACCESS_KEY_ID` and
  `SOFTWARE_FACTORY_R2_SECRET_ACCESS_KEY`, as repository secrets. Only the publish step gets them, through its
  environment. No other secret or token is used: in-the-loop is checked out whole, and the publisher reads it and
  orders its commits with git.
- Nothing is installed (the publisher needs no npm package), and the token has `contents: read` only.

The steps that need an account, and everything else needed to run this, are in the [runbook](#runbook) below.

## Runbook

What follows keeps three things apart, as the plan asks: what works locally, what is configured but has never run
remotely, and what the author must create and run. **Nothing of Milestone 2 has run remotely.** No bucket, token or
secret was created from this repo, nothing was deployed, and the workflow has never run on GitHub.

### What works locally

Everything here runs without an account, credentials or network, apart from the npm install for the browser test.

- **The tests**: `npm run test:software-factory`. They cover the function (fake R2 binding), `wrangler.toml` (read
  with wrangler's own config reader), the publisher (a fake store, and a local fake of R2's S3 API that checks every
  signature), the workflow (its YAML, and its script run in bash with a stand-in npm), the importer, the pages and
  the client. The browser test (Commands, above) is the one that skips without Playwright.
- **A snapshot from in-the-loop**: `npm run software-factory:refresh -- --sha <sha>`, from GitHub, or add
  `--checkout ../in-the-loop` to read a local clone. It writes into `blog/software-factory/data/`, the committed
  snapshot, and prunes the snapshots there that neither the pointer nor a post's evidence names. Commit the result
  only as a change of its own. `npm run software-factory:validate` checks what is there.
- **The function, with Wrangler Pages local development.** It needs no account. Run it from a copy, so wrangler's
  `.wrangler/` state stays out of the repo. `wrangler.toml` supplies the binding and the variable, and local R2
  starts empty, so load the committed snapshot into it first:

  ```sh
  npm run build:drafts
  R=$PWD W=$PWD/node_modules/.bin/wrangler D=$(mktemp -d)
  mkdir -p "$D/blog/software-factory"
  cp -r dist functions wrangler.toml "$D/"
  cp -r blog/software-factory/config "$D/blog/software-factory/"   # the function bundles section.json
  for k in $(cd blog/software-factory/data && find . -name '*.json' | sed 's|^\./||'); do
    (cd "$D" && "$W" r2 object put "software-factory-data-preview/$k" \
      --file "$R/blog/software-factory/data/$k" --content-type 'application/json; charset=utf-8' \
      --local --persist-to .state)
  done
  (cd "$D" && "$W" pages dev --persist-to .state --port 8792)
  ```

  On 2026-11-15, with wrangler 4.65.0, it listed `env.SOFTWARE_FACTORY_DATA (software-factory-data-preview)` and
  `SOFTWARE_FACTORY_ENVIRONMENT ("preview")`, both local. Then:
  - `/software-factory/data/latest.json` was the committed bytes, with `Cache-Control: no-cache`, an ETag, `nosniff`
    and `X-Robots-Tag: noindex`, and 304 for `If-None-Match` with that ETag;
  - a snapshot file was `public, max-age=31536000, immutable`;
  - any other path was 404, an encoded slash included, and POST was 405;
  - the overview at `/software-factory/` loaded its data from `/software-factory/data/` in headless Chromium, with
    no script error.

  Stop it with Ctrl-C, or by the pid that `ss -ltnp 'sport = :8792'` shows.
- **The publisher.** Locally it runs only against fakes, in the tests. `software-factory:publish` itself always
  talks to real R2 (`https://<account>.r2.cloudflarestorage.com`), so without the three credentials it stops before
  doing anything and names the missing variables. Twice during development it ran end to end, through
  `s3Store`, on the local in-the-loop clone, against a local signed fake of R2. That needed a throwaway preload to
  send R2's host to the fake, which is not in the repo. The runs gave `new-snapshot`, then `unchanged`, then
  `refused` for an older commit (Progress in `llm-dlc/loops/software-factory.md`, M2.3 and M2.4).

### What is configured, and has never run remotely

- **`wrangler.toml`** (repo root). The top level is preview: every branch but production, `npm run deploy:dev`'s
  `dev` included, and local `wrangler pages dev`. It binds `SOFTWARE_FACTORY_DATA` to `software-factory-data-preview`
  and sets `SOFTWARE_FACTORY_ENVIRONMENT = "preview"`. `[env.production]`, which `npm run deploy`'s
  `--branch=production` selects, binds `software-factory-data` and sets `production`. The name and compatibility date
  come from the project's settings, saved on 2026-11-14 in `ops/terminal-value.pages-config.toml`. From now on,
  every deploy of either kind carries these bindings.
- **The function's gate.** While `config/section.json` says `published: false`, the function answers only where
  `SOFTWARE_FACTORY_ENVIRONMENT` is `preview`. Anywhere else, a missing variable included, it answers 404, as a site
  without the section would. That matters because `wrangler pages deploy` uploads `functions/` with any deploy. Once
  the section is published, it serves in both environments.
- **The function's failures**: a missing object is 404, and a missing binding or a failing bucket is 503. Errors are
  `no-store`. The client falls back to the bundled snapshot on any of them.
- **The workflow**, `.github/workflows/software-factory-refresh.yml`, as described above. GitHub schedules only the
  default branch's copy, so it does nothing until it is pushed to `main`.
- **The publisher's destinations**: `preview` is `software-factory-data-preview` and `production` is
  `software-factory-data`, the buckets in `wrangler.toml`. A test keeps them equal.

These rest on documentation, not on a run: R2's S3 API honouring `If-Match` and `If-None-Match: *` on PutObject (the
concurrency group is the first guard either way), a deploy failing while a bound bucket is missing,
`actions/checkout@v5` and `actions/setup-node@v5`, and the `vars` context in a job's `if`.

### Reading a publish result

`software-factory:publish` prints one JSON line, never a credential: `destination`, `outcome`, `snapshotId`, `sha`,
`previous`, `uploaded` (the keys it wrote), and on a refusal or failure `step`, `code` and `error`. It exits 0 for
`new-snapshot` and `unchanged`, 1 for `refused`, `failed` or a credential problem, and 2 for a usage error.

| Outcome | Meaning | The pointer |
| --- | --- | --- |
| `new-snapshot` | A new snapshot was uploaded, read back and pointed to | Replaced; `publishedAt` is now |
| `unchanged` | The destination already points at this snapshot | Only `lastSourceCheck` moves |
| `refused` | Code `behind` or `diverged`: the destination's snapshot comes from a newer or unrelated source commit. Code `older-check`: the destination was checked later than this run's clock | Untouched |
| `failed` | `step` says where: `refresh`, `validate`, `remote`, `order`, `upload`, `verify` or `pointer` | Untouched, so `lastSourceCheck` stays the last successful check |

Failure codes:

- `store`: R2 answered with an error. A missing bucket is an error here, never an empty destination.
- `remote`: the destination's pointer or the manifest it names is missing or invalid.
- `verify`: a file read back differently.
- `conflict`: another run changed `latest.json` meanwhile, and its pointer stands.
- `order`: the source commits couldn't be compared.
- An importer code, below.

Missing variables, or an account id that isn't 32 hex digits, stop it before anything runs, with an `ERROR` line
that names the variable, never its value.

A run after a failure uploads only what is still missing. Older snapshots stay in the bucket. Nothing deletes them
yet.

### What the importer refuses, and what it accepts

A publish builds its snapshot with the same importer as `software-factory:refresh`. When in-the-loop changes in a
way the importer doesn't trust, every publish of that commit fails at `refresh` and the published data stops
advancing. The pointer stays as it was. The codes:

| Code | When | Example |
| --- | --- | --- |
| `missing` | A required input is missing at the commit: the rollup `llm-dlc/traces/metrics.json`, `llm-dlc/index.json`, `verification/results/index.json`, `examples/index.json` or `examples/tags.json`. Or the ref or sha doesn't exist | `missing-rollup` |
| `schema` | An input's `schema` isn't one `config/source.json` lists, a required field is missing, or a record lacks what it needs | `unsupported-schema`, `missing-required-field` |
| `malformed` | An input isn't a JSON object | `malformed-json` |
| `reconcile` | The rollup's totals don't add up to its sessions, or a session's metrics file disagrees with the rollup | `rollup-disagrees` |
| `network` | GitHub couldn't be read, or a listing came back truncated | `network-error` |
| `invalid` | The snapshot built fails `validate.mjs` | |
| `conflict` | A snapshot with the same id already in `data/` has other files (refresh into `data/` only) | |

The examples are cases in `test/fixtures/cases.json`. What it accepts, and how it counts:

- A session's own metrics file, or a job record, may be missing. That session's calls are then left out and counted
  in coverage, and that job's `expected` and submitting session are null.
- A rollup change whose `summary` is null, in-the-loop's working copy before its first commit message, is left out
  of the recorded changes until it has one. Its sessions' calls still count in usage. Any other kind of summary that
  isn't a string is refused (`schema`).
- Changes whose summary is "Record session traces" are housekeeping. They are counted and kept identifiable, never
  mixed with feature work.

A fix to the importer is a new `GENERATOR` version in `metrics.mjs`, which makes a new snapshot of the same commit.
The publisher replaces the pointer with it without asking the order. Changing the contract or the metric definitions
changes every snapshot id (above).

### What the author must create and run

In this order. Each step is the author's, on a machine logged in to Cloudflare or GitHub. None of it is done.

1. **R2 buckets**: `blog/software-factory/ops/setup-r2.sh` (`--dry-run` first, if you like). It creates
   `software-factory-data` and `software-factory-data-preview` in `enam` if missing, and checks each by writing,
   reading back and deleting an object. It also saves the project's settings as
   `terminal-value.pages-config.toml`. The copy saved on 2026-11-14 is already in `ops/`, and `wrangler.toml`
   builds on it. If the new copy differs, bring the difference into `wrangler.toml`.
2. **Token**: in the dashboard, an R2 API token with Object Read & Write on those two buckets only.
3. **Secrets**: store its values as the repository secrets `SOFTWARE_FACTORY_R2_ACCOUNT_ID`,
   `SOFTWARE_FACTORY_R2_ACCESS_KEY_ID` and `SOFTWARE_FACTORY_R2_SECRET_ACCESS_KEY`. `setup-r2.sh --github` asks for
   them with hidden input and sets them with `gh`.
4. **Before any deploy**, of either kind:
   - bring in `/verify-bytecode/`'s source (State at Phase 0);
   - compare `wrangler.toml` with the project's settings;
   - confirm that the project's production branch is `production`;
   - make sure both buckets exist.
5. **Push**, so the workflow reaches `main`. Optionally, pin `actions/checkout` and `actions/setup-node` to commit
   SHAs first.
6. **First run, by hand, to preview**: Actions, Software Factory refresh, Run workflow, destination `preview`. A
   successful run's log ends with the JSON result, `new-snapshot` the first time. Then a preview deploy
   (`npm run deploy:dev`) serves it at `/software-factory/data/latest.json` on the dev site.
7. **Schedule**: set the repository variable `SOFTWARE_FACTORY_SCHEDULE` to `on`. Each run then publishes preview,
   then production.
8. **Launch**: set `published: true` in `config/section.json`, add `related: software-factory` to
   `blog/posts/reading-the-trace/index.md`, and deploy (`npm run deploy`). The production function serves only once
   the section is published.

The author also writes the Fable 5.1 vs. 5.2 draft's content, evidence and cover, and the template's cover, if one
is wanted.
