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
  files had the same sha256. A drafts build (`npm run dev`, `build:drafts`) includes the section, noindex. Only
  the author sets `published: true`.
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
  cli.mjs                         refresh and validate commands (coordinator)
  schema.json  validate.mjs       the frozen contract and its validator
  identity.mjs                    canonical JSON, config hash, snapshot id
  config/                         section, source, metrics, areas, models
  import.mjs  metrics.mjs  measures.mjs    stream A
  render.mjs                      stream B (+ blog/assets/software-factory/)
  editorial.mjs                   stream C (+ the draft post and its template)
  data/                           the committed snapshot (written by refresh only)
  test/                           *.test.mjs per workstream; fixtures/
```

Nothing under `test/`, `config/` or the modules is public. `blog/assets/` is copied whole into the site, so only
intended browser files go in `blog/assets/software-factory/`.

## Ownership

One owner per file, so streams merge cleanly. A stream that needs a change in a file it doesn't own writes down
what it needs under its Progress, and the merge does it.

| Owner | Files |
| --- | --- |
| Coordinator (Phase 0, then the merge loop) | `blog/build.mjs`, `blog/posts.mjs`, `blog/new-post.mjs`, `blog/assets/style.css`, `package.json`, `package-lock.json`, `blog/software-factory/index.mjs`, `cli.mjs`, `functions/`, `wrangler.toml`, `.github/workflows/`, `docs/software-factory.md`, site navigation and the home page |
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

`config/areas.json` is a proposed mapping, for the author to review. It has six areas of the factory's work
(verification engine, example catalog, runtime evidence, verification pipeline, agent process, skills and plugins),
matched by campaign (loop brief names, change summaries) and then by path. Anything else goes to **Unassigned**,
which is always shown. The data stream applies the rule as written, and the example already puts 58 of its 64
changes in Unassigned. That is the honest starting point the author asked for, and the mapping improves as
campaigns get recorded. Example subject tags (payments, consensus, …) are a separate taxonomy.

## Commands

```sh
npm run test:software-factory        # every workstream's tests
npm run software-factory:refresh -- --sha <sha> [--checkout ../in-the-loop]
npm run software-factory:validate    # the committed snapshot
npm run build && npm run build:drafts
PORT=8791 npm run dev                # a second preview beside another on 8788
SOFTWARE_FACTORY_DATA_DIR=blog/software-factory/test/fixtures/snapshot-example npm run dev   # preview on the fixture
```

## Milestone 2: serving from R2 (decision pending)

The Pages Function serves `/software-factory/data/*` with GET and HEAD only, from one R2 bucket binding:
`latest.json` with `Cache-Control: no-cache` and a correct ETag, and immutable caching under `snapshots/`. A
publisher job runs the same importer, uploads a new snapshot's files, checks them, and only then replaces
`latest.json`. The job runs one at a time, and never lets an older run overwrite a newer pointer.

Options for the bucket:

1. **New buckets, one per environment (recommended):** `software-factory-data` for production and
   `software-factory-data-preview` for preview, both bound as `SOFTWARE_FACTORY_DATA` in the Pages project. They
   stay apart from `llm-traces`, which holds redacted session logs behind the in-the-loop CDN Worker. A
   publishing token scoped to these two buckets can't touch the logs.
2. **Reuse `llm-traces` under a `software-factory/` prefix:** nothing new to create, but the function and the
   publishing token would reach the session logs, and only code would keep them apart.
3. **No R2:** each refresh commits a snapshot and redeploys the site (Milestone 1 only). Simplest, but every data
   update is a deploy.

Whichever is chosen, the merge loop writes the function, its config and the workflow, with tests that run without
credentials. The author creates the buckets and the token (wrangler isn't logged in on this machine) and adds the
workflow's secrets.
