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
  robots meta on every blog page, and `X-Robots-Tag: noindex` on every response through `_headers`, hand-written
  pages included. Only the author sets `published: true`.
- **`/verify-bytecode/`.** Its source lived in another copy of the repo until 2026-11-15, when the author's
  `verify-bytecode-page` branch was merged here: the hand-written page in `blog/assets/verify-bytecode/`,
  `blog/assets/_redirects`, build.mjs's `PAGES`, and `reading-the-trace` moved to `blog/archive/`, which the build
  doesn't publish. With the section unpublished, the merge's production build equals that branch's byte for byte
  (82 files). The same day `reading-the-trace` went back to `blog/posts/` as a draft: readable on the dev site as
  background for the data, never in production, which it likely never reaches.
- **Upstream baseline.** in-the-loop `origin/main` was `7384f8c23eef441817ddb714c6ef5571cdc138bd`, the brief's
  audited revision. It is public: a refresh fetches by SHA from `raw.githubusercontent.com` with no token. The
  local checkout's HEAD moves while its loops run, so always pin a SHA.

## The leading sections (2026-11-15)

The overview used to open with four usage tiles. It now opens with what the factory's feature loops did, then how
reliably the models' tools ran, then what the code took. Usage, output and the records follow. The author asked for
this on 2026-11-15, after the loop.

| Section | What it shows | From |
| --- | --- | --- |
| Headline | Tool calls and commits made inside loop runs, prompts typed by a person during them, and the longest such run as its own record, cycle by cycle | `overview.loops` |
| Feature loops | Runs, cycles, commits and usage. Tool calls per day inside a run and outside one. Campaigns compared in the order they ran. Each campaign's runs as lanes on one clock, opening to every run and cycle | `overview.loops`, `details/loops.json` |
| Loops running now | A panel that says it is not connected. A drafts build also shows its shape with made-up rows, labelled as an example | `preview/running-loops.json` |
| Model performance | Tool call success. Failed calls per day by kind, for all models or one. The tools and commands that fail most. Failure by model, by context size, and inside a run or outside | `overview.tools` |
| Code | Lines of code added, removed and still in the tree, from git. Output tokens and estimated usage per line. Lines per day and per language | `overview.code` |

**How it is counted** is on the methodology page and in three config files:

- `config/loops.json`: a run's window, who sent a prompt (by the start of its text, which is never published), a
  loop's campaign, and how a run ended.
- `config/code.json`: which file extensions are code, which are docs, and that everything else is generated data.
- `config/metrics.json`, `figures`: the definitions the methodology page shows.

**What changed in the contract.** Everything is additive, so a version 1 reader still reads every snapshot:

- `overview.loops`, `overview.tools` and `overview.code` are new and optional. Each is `null` when nothing was
  measured for it: no run record, no session with a tools table, or no git checkout.
- `details/loops.json` is a new collection: one record per run, with its cycles. The Pages Function and the
  publisher allow its key.
- A change record gains `commit`, `committedAt`, `codeAdded`, `codeRemoved`, `calls`, `outputTokens` and `usd`,
  where known.
- The manifest lists the datasets `loops`, `tools` and `code` when they exist.
- The generator was version 2 and the metric definitions version 2 (both 3 since the second pass, below). `loops.json` and `code.json` are part of
  the config hash. Every snapshot id changed.

**Code needs a checkout.** Lines come from `git log -M --numstat`. A refresh from GitHub alone gives a snapshot
with no code section, so use `--checkout` for the committed snapshot. The publish workflow always has one.

**An older remote snapshot.** A snapshot in R2 made by generator 1 has none of this. The page then keeps showing
its bundled snapshot, whole, until the publisher catches up: `app.js` compares the remote manifest's generator
version with the bundled one's. The publish workflow runs `main`'s copy of the code, so R2 gets a generator 2
snapshot on the first run after this is pushed.

**What isn't measured yet** is in [`software-factory-upstream.md`](software-factory-upstream.md): what to ask of
in-the-loop for running loops, prompt senders, run records as data, rework by line age and review.

### A second pass, the same day

The author asked to keep going. This pass answers three of the brief's questions that the first left thin: how the
loops changed over time, what tool failures follow, and what rework there was.

| Figure | What it shows | From |
| --- | --- | --- |
| Who set off the work | Each day's tool calls by who sent the prompt before them: the loop's script, a person, or a command or agent. It needs no run record, so it covers the loops run before Nov 6. Days the loop's scripts changed are flagged | `overview.loops.drive`, `.scripts` |
| Tool calls for each prompt a person typed | A day's tool calls divided by the prompts a person typed that day | `overview.loops.drive` |
| How the loop itself changed | Every commit to `feature-loop.sh`, `run-streams.sh` and `loop-common.sh`, by its own summary line | `overview.loops.scripts` |
| After a failure | Whether the session's next tool call succeeded, and how many failures came in a row | `overview.tools.recovery` |
| By time into a run, by loops at once | Failure rates for calls inside a run, by hours since it started and by runs under way | `overview.tools.byRunHour`, `.byParallel` |
| How much of each day's code still stands | A day's added lines split by whether `git blame -w -M` still gives them to that day's commits | `overview.code.daily`, column `surviving` |
| What a change took | Output tokens per line change by change: the middle change, the spread, and a plot of every change that loads when opened | `overview.code.perChange`, `details/changes.json` |
| In a loop and outside | Lines of code and tokens per line for each campaign, inside the runs and outside them | `overview.loops`, `overview.code` |

Three things changed what the page says, not just what it shows:

- **Early loop prompts were counted as a person's.** Before it worked from briefs (Oct 31 to Nov 4), the loop's
  script sent one of four fixed prompts. `config/loops.json` now lists them, each checked against the script's git
  history. No run record covers those days, so the headline didn't move, but 46 prompts are no longer a person's.
- **A change committed in two runs counts once in a total.** A merge loop recommits some of its streams' changes.
  The headline was 320 commits and is now 311. A run's own count is unchanged.
- **Tokens per line has a spread.** 135 is the average over everything. Change by change, the middle change that
  added code took 158 per line, and 90% of output tokens went to changes that added code.

The contract stays additive: `overview.loops.drive` and `.scripts`, `overview.tools.byRunHour`, `.byParallel` and
`.recovery`, `overview.code.perChange`, a fifth column in `overview.code.daily`, and `codeSurviving` and `loop` on a
change record. The generator and the metric definitions are version 3. Blame adds about six seconds to a refresh
from a checkout.

### A short overview, and a page for each section

The author found the overview too cluttered: at 1280 wide it was 12,750 px tall, with every figure on it. It is now
2,300 px, and its HTML is 10 KB gzipped, down from 33.

| Page | What is on it |
| --- | --- |
| `/software-factory/` | The headline and the longest run's record. Then four findings, one each for the loops, what they made, the tools and the code: a claim computed from the data, a sentence, three numbers, one figure and a link. Then where to go next: usage, analysis, methodology |
| `/software-factory/loops/` | Everything the feature loops section had, and the "Loops running now" panel |
| `/software-factory/tools/` | Model performance: tool call success, failures by day, recovery, and the six tables |
| `/software-factory/code/` | Code: rework by day, what a change took, languages, and loops against the rest |
| `/software-factory/usage/` | The filters, the four usage tiles, the trend, observations, output and breakdowns, and the records |

How it is put together:

- **One navigation row** at the top of every page of the section, the current page marked. It replaces the jump
  links, the breadcrumb and the foot navigation.
- **A finding and its page draw from the same code.** `findingsHtml` in `factory.js` uses the chart data its page
  uses. A finding's chart has no table under it, so its description names the page that has one.
- **No snapshot, no data pages.** `renderPages` then returns the overview, analysis and methodology only, and the
  navigation lists only those.
- **`app.js` runs on every page of numbers.** A page says so with `app: true`, an optional field `index.mjs` reads.
  Each part of the script runs where its elements are: the filters and the address's query only on the usage page.
- **Links between pages are absolute**, from `/software-factory/`. A link to a closed `<details>`, such as
  `usage/#explore-changes`, opens it. A test follows every link between the pages to a page and an id that exist.
- **Each section's title is the page's `h1`**, and the headings under it moved up a level.

### What the factory made: the example catalog

The overview said how the loops worked and how much code came out, but not what the code does. The second finding,
"Output", shows the example catalog: 183 code changes, each with the verdict the project's formal verifier gave.
Its claim is the catalog's own answer to "would the tests have caught it?", counted in `overview.catalog`: "The
existing tests passed on 92 of the 100 changes where the verifier found a violation". A snapshot without those
counts, or with no passing answer, gets the counts of `overview.stocks.examples` as its claim instead: "100
violations found and 55 changes verified, in a catalog of 183 examples". The sentence under the claim says what an
example is, gives those counts, and says that most examples were constructed for the catalog, with the systems and
the tests they change: the claim is about a catalog built to show this, not a field study.

- **A square for each example**, in the catalog's order (`catalogHtml` in `figures.js`). A square under the pointer
  says the example's id, system, title and verdict label. A ringed square is a change to a published library.
- **Two hues and a gray.** A violation is blue and a verified change green. A third hue for "unverifiable" could not
  be told from the green by every reader (the palette check failed it in dark mode), so those two squares are the
  gray of "several verdicts, or none yet", hatched.
- **The names come from the `examples` collection.** The build reads it with the snapshot (`loadSnapshot` returns
  `examples`) and `findingsHtml(snapshot, { examples })` names the squares. The browser redraws the findings only for
  a snapshot other than the one built in; it then draws the squares by verdict from the overview at once, loads that
  snapshot's own records, and names them. Records whose count doesn't match the overview name nothing.
- **Library changes listed by name** are those whose verdict label carries one of the catalog's own marks (✓, ✗ or
  ⚠). Of the 24 library changes at this revision 5 do; the other 19 are entered in the catalog and not run yet, and
  the finding says "5 have a result so far". This reads a label, since the record has no field for it.
- **What it doesn't claim.** The sentence under the claim repeats the metric's note: a verified label is not a claim
  of a current, non-vacuous proof, and it gives the count of proofs recorded as vacuous.
- **The three numbers** are the violations the catalog rates high or critical if they shipped unnoticed
  (`overview.catalog.severity.violation`), the library changes, and the verification jobs that passed of those
  completed (`overview.verification`).
- **A square opens its example's record** under the grid (`exampleRecordHtml` in `factory.js`): the title, the
  verdict label, the catalog's paragraph about it (its backticks become code), whether the existing tests passed on
  the same patch, the severity, the kind of change, its tags, and links to the example's folder at the snapshot's
  revision and to the change it verifies. A field the record doesn't have is left out. Two buttons step through the
  catalog, and the address keeps the pick as `#example-<id>`. The listed library changes link to their folders too.
- **One picker for runs and examples.** `inspectHtml(noun, hint)` draws the box and `PICKS` in `app.js` says, per
  noun, which marks can be picked, which collection has their records and how a record is drawn. The noun is in the
  box (`data-sf-inspect="run"`) and in the address, so the two picks on the overview don't disturb each other. The
  `examples` collection is loaded on the first pick, once.
- **What an example's record carries (generator 4, metric definitions 4).** Besides its title, system and verdict:
  `path` (its folder in the source), `summary` (the catalog's one paragraph about it), `sourceUrl` (the pull request
  or commit it verifies, when published elsewhere), `testsPassed` (the catalog's `existingTestsPassed`: did the
  module's own unit tests pass on the same patch), `severity` (if the change shipped unnoticed) and `changeKind`.
  All optional in `schema.json`, so an older snapshot still validates. The catalog's working `notes` stay out. The
  importer's first version left the summary out with them; it is the catalog's own public paragraph, like a change's
  summary line, so it is now selected.
- **`overview.catalog`** counts those answers by verdict: `tests` (passed and failed, over the examples that say)
  and `severity`, with a coverage count. At this revision the existing tests passed on 92 of the 100 changes where
  the verifier found a violation. Most examples were constructed for the catalog, with the systems and tests they
  change, and the definition on the methodology page says so.
- The snapshot was made again from the same source revision (`fbd1fa86`), so no other number moved.

### Every run on one clock

The loops finding leads the overview with one figure of every finished loop run, and its claim is the pace of the
busiest stretch: "A commit every 13 minutes for 49 hours". The same figure is on the loops page under "Every run on
one clock". It needs nothing new in the snapshot: `overview.loops.runs` already has each run's start, end, outcome
and the seconds at which its cycles committed.

- **A stretch** is a run of work with no pause longer than six hours (`stretches` in `factory.js`). The claim comes
  from the stretch with the most commits, and only when it has at least ten commits over at least two hours.
  Otherwise the finding counts campaigns, runs and cycles instead. "Nobody typed a prompt into any of them" is
  printed only when the runs of that stretch record no prompt from a person.
- **The clock is cut** where no loop ran for more than six hours, and each stretch is drawn to the same scale. The
  cut is hatched, and the caption says how long it was. The figure shows the newest stretches, up to about 120
  hours of them; when older ones are left out the caption says so.
- **Rows.** A campaign takes a block of rows, one for each of its loops, with the loop that merges the others last.
  Campaigns that overlap in time get blocks under each other.
- **Marks.** A bar is a run and a notch is a cycle's commit. A diamond on a run's end means it ended blocked on a
  person or flagged for one. The shaded bands are 10 pm to 6 am on Toronto's clock: a definition, not a measurement.
- **`floorHtml` in `figures.js` is HTML and CSS**, positioned in percent, so it needs no second shape for a phone.
  The axis shows hours from 60rem wide, days from 36rem, and each stretch's first day below that. The campaign
  names over the plot are links to the campaign's card on the loops page; the plot itself is hidden from a screen
  reader, because that page lists every run.
- **A run can be picked.** With the page's script, a click on a run shows that run's record under the clock: every
  cycle by the summary line of its commit, the model, what the run took and how it ended, with links to the run
  record and the session summary in the source repository. It comes from the snapshot's `loops` collection, loaded
  once on the first pick (`runRecordHtml` in `factory.js`). Two buttons step to the earlier and the later run, so
  every run is reachable from the keyboard and by touch. The address keeps the pick as `#run-<id>`, so a link to
  `/software-factory/#run-<id>` or `/software-factory/loops/#run-<id>` opens that run. Without the script the
  place for the record stays hidden and the link scrolls to the run.
- The loops page's title no longer says "nobody at the keyboard". The record shows no prompt from a person inside
  the runs; it does not show where the person was. It now says "no prompt from a person".

The contract and the snapshot did not change. The filters' link, `?period=…`, now belongs to
`/software-factory/usage/`. The section isn't published, so no public link moved.

## Routes and files

| Route | What | Made by |
| --- | --- | --- |
| `/software-factory/` | Overview: the headline and four findings | `render.mjs` (B) |
| `/software-factory/loops/`, `tools/`, `code/` | The feature loops, model performance and code, in full | `render.mjs` (B), drawn by `factory.js` |
| `/software-factory/usage/` | Usage, verification, output, breakdowns and the records, with the filters | `render.mjs` (B) |
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
  config/                         section, source, metrics, areas, models, loops, code, requests
  import.mjs  metrics.mjs  measures.mjs    stream A
  records.mjs                     parsers: a loop's run record, who sent a prompt, git's numstat
  factory.mjs                     the feature loops, tools and code of a snapshot, called by metrics.mjs
  preview/                        example rows for the running-loops panel, drafts builds only
  render.mjs                      stream B (+ blog/assets/software-factory/; factory.js and figures.js there
                                  draw the leading sections)
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
| `sessions`, `changes`, `verification`, `examples`, `loops` | `details/*.json` | Loaded only when a reader asks for detail |
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
remotely, and what the author must create and run. On 2026-11-14 and 15 the author set up the buckets and secrets
(steps 1 to 3), deployed the dev site with the bindings, and pushed (step 5). **The first remote run** (step 6) was
on 2026-11-15, by hand to preview, run `43718952743`: `new-snapshot` `sf1-da7bddeff100f650` of in-the-loop at
`fbd1fa86`, after which the dev site served it under `/software-factory/data/` with the headers below. Production
has never been published to, and the schedule is off.

### What works locally

Everything here runs without an account, credentials or network, apart from the npm install for the browser test.

- **The tests**: `npm run test:software-factory`. They cover the function (fake R2 binding), `wrangler.toml` (read
  with wrangler's own config reader), the publisher (a fake store, and a local fake of R2's S3 API that checks every
  signature), the workflow (its YAML, and its script run in bash with a stand-in npm), the importer, the pages and
  the client. The browser test (Commands, above) is the one that skips without Playwright.
- **A snapshot from in-the-loop**: `npm run software-factory:refresh -- --sha <sha> --checkout ../in-the-loop`, which
  reads a local clone and never writes to it. Without `--checkout` it reads GitHub, and the snapshot then has no
  code section. It writes into `blog/software-factory/data/`, the committed
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
  `no-store`. The client falls back to the bundled snapshot on any of them. A bucket with no `latest.json` yet
  answers 404 with `Software-Factory-Data: none`, so an open overview keeps polling the remote pointer and
  announces the first publish. A plain 404, as from the gate or a site without the function, sends polling to the
  bundled pointer instead.
- **The workflow**, `.github/workflows/software-factory-refresh.yml`, as described above. GitHub schedules only the
  default branch's copy, so it does nothing until it is pushed to `main`.
- **The publisher's destinations**: `preview` is `software-factory-data-preview` and `production` is
  `software-factory-data`, the buckets in `wrangler.toml`. A test keeps them equal.

These rest on documentation, not on a run: R2's S3 API honouring `If-Match` and `If-None-Match: *` on PutObject (the
concurrency group is the first guard either way), a deploy failing while a bound bucket is missing,
`actions/checkout@v5` and `actions/setup-node@v5`, and the `vars` context in a job's `if`.

### Reading a publish result

`software-factory:publish` prints one JSON line, never a credential: `destination`, `outcome`, `snapshotId`, `sha`,
`previous`, `uploaded` (the keys it wrote), `pruned` and `pruneError` (below), and on a refusal or failure `step`,
`code` and `error`. It exits 0 for
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

A run after a failure uploads only what is still missing.

Old snapshots are pruned. After a run's pointer is written and read back, it deletes every snapshot that a later
upload superseded at least a day before (`PRUNE_AFTER_MS`), all its files, and lists their ids in `pruned`. The
day lets a tab still showing the old snapshot load its details. The pointer's snapshot is never deleted, nor any
key outside the snapshot layout, and a listing that lacks the pointer's snapshot deletes nothing. Pruning is best
effort: a failure is `pruneError` and a `WARN` line on stderr, the outcome stands, and the next run tries again.
So a bucket holds the current snapshot and at most a day's worth of superseded ones: about 0.6 MB each at the
committed snapshot's size, and at most 96 a day on the 15-minute schedule. Posts don't need old snapshots, because
each copies its own evidence. The token's Object Read & Write covers the listing and deletes.

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

1. **R2 buckets** (done 2026-11-15): `blog/software-factory/ops/setup-r2.sh` (`--dry-run` first, if you like). It creates
   `software-factory-data` and `software-factory-data-preview` in `enam` if missing, and checks each by writing,
   reading back and deleting an object. It also saves the project's settings as
   `terminal-value.pages-config.toml`. The copy saved on 2026-11-14 is already in `ops/`, and `wrangler.toml`
   builds on it. If the new copy differs, bring the difference into `wrangler.toml`. Run on 2026-11-15, it found
   both buckets, created nothing, passed the check on each, and saved settings with the same three entries as the
   copy in `ops/`.
2. **Token** (decided 2026-11-15): one R2 API token, with Object Read & Write, for both buckets. There is no token
   per environment: the publisher's `--destination` picks the bucket, `preview` or `production`, and the workflow
   passes it, so both are reached with the same credentials. The existing token is kept; don't create another.
3. **Secrets** (set 2026-11-14): the token's values as the repository secrets `SOFTWARE_FACTORY_R2_ACCOUNT_ID`,
   `SOFTWARE_FACTORY_R2_ACCESS_KEY_ID` and `SOFTWARE_FACTORY_R2_SECRET_ACCESS_KEY`. Don't rerun
   `setup-r2.sh --github`, which would replace them. The repository's older `CLOUDFLARE_ACCOUNT_ID` and
   `CLOUDFLARE_API_TOKEN` secrets are not used by this workflow.
4. **Before any deploy**, of either kind:
   - check that this repo has everything the live site has: `/verify-bytecode/` came in on 2026-11-15 (State at
     Phase 0), and a page added elsewhere since then would be removed by a deploy from here;
   - compare `wrangler.toml` with the project's settings;
   - confirm that the project's production branch is `production`;
   - make sure both buckets exist.
5. **Push**, so the workflow reaches `main`. Its actions are pinned to commit SHAs (`actions/checkout` v5.1.0,
   `actions/setup-node` v5.0.0), each with its release tag beside it.
6. **First run, by hand, to preview**: Actions, Software Factory refresh, Run workflow, destination `preview`. A
   successful run's log ends with the JSON result, `new-snapshot` the first time. Then a preview deploy
   (`npm run deploy:dev`) serves it at `/software-factory/data/latest.json` on the dev site.
7. **Schedule**: set the repository variable `SOFTWARE_FACTORY_SCHEDULE` to `on`. Each run then publishes preview,
   then production.
8. **Launch**: set `published: true` in `config/section.json` and deploy (`npm run deploy`). The production
   function serves only once the section is published. The plan linked `reading-the-trace` from the section with
   `related: software-factory`, but that post is now a draft, and the section never links a draft. Add the line to whichever published post, if any,
   should appear as related background.

The author also writes the Fable 5.1 vs. 5.2 draft's content, evidence and cover, and the template's cover, if one
is wanted.
