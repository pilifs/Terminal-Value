# Brief: Software Factory, stream A (data)

**Status of the brief**: drafted 2026-11-14 after Phase 0; approved by the author on 2026-11-14.

One stream of [`software-factory.md`](software-factory.md), run by `run-streams.sh software-factory` in the jj
workspace `software-factory-data`, on a branch of its own. It turns in-the-loop's published metadata into the
snapshot the pages show: importer, aggregation, browser measures, refresh, and the first real snapshot.

**Inputs.** Read these in full before the first piece of work of every cycle:

- [`software-factory.md`](software-factory.md), the main brief: its Direction and How to work through it apply here.
- [`docs/software-factory.md`](../../docs/software-factory.md): the frozen contract, ownership and commands.
- Sections 4 and 8 (Data) of [`docs/briefs/software-factory.md`](../../docs/briefs/software-factory.md): sources,
  aggregation rules, acceptance.
- The headers of `import.mjs`, `metrics.mjs` and `measures.mjs`: your interfaces. Also `config/metrics.json`,
  `schema.json` and `test/fixtures/`.
- The latest integration check: `$(jj workspace root --name default)/llm-dlc/loop-summaries/software-factory-integration.md`.

## What you own

`blog/software-factory/import.mjs`, `metrics.mjs`, `measures.mjs`, `config/source.json`, `config/areas.json`
(accepted by the author as the initial mapping: apply it as written), `config/models.json`, `data/`, and `test/data-*.test.mjs`. Nothing else.
Record any need for another file (a `package.json` script, a `build.mjs` change, a contract change) under Progress.

## The plan

### A1. Importer (`import.mjs`)

1. `readSources`:
   - resolve a ref to one SHA once;
   - read every input at that SHA, from a local checkout (`git -C PATH show SHA:path`) or from GitHub
     (`https://raw.githubusercontent.com/pilifs/in-the-loop/SHA/path`; the ref through the GitHub API or
     `git ls-remote`);
   - no token is needed (public repo);
   - fetch per-session files only for sessions in the index.
2. `normalizeSources`:
   - check schema names and required fields (`config/source.json`);
   - select public fields explicitly (no prompt text, tool labels or errors, job descriptions or steps, example
     notes);
   - keep raw model ids;
   - keep subagent calls once, flagged;
   - parse verification signals from result summaries;
   - take `expected` and `submitted.session` from job records;
   - give each record its campaign (run records under `llm-dlc/traces/<session>/runs/*.md` name a session's brief;
     a change summary's leading campaign name), so the area rule can place it.
3. Errors: a `SourceError` with the codes of `cases.json`. Test every case of `cases.json` through
   `test/fixtures/cases.mjs`.
4. Reconcile: the rollup's call count and usd equal the sum over the session files it covers (case
   `rollup-disagrees`). A session listed without a metrics file is counted in coverage, never zero-filled.

### A2. Aggregation (`metrics.mjs`)

1. `aggregate` builds the manifest, overview and details, all valid against `schema.json`, with ids from
   `identity.mjs`. Implement `config/metrics.json` as written:
   - weighted cache reuse, null for a zero denominator;
   - Toronto days from UTC timestamps, half-open, across DST;
   - the usage table by day × model × effort;
   - one verification row per job;
   - changes deduplicated by change id, housekeeping kept apart;
   - process outcome apart from signals;
   - stocks apart from period values;
   - the area rule of `config/areas.json` with Unassigned;
   - coverage with every value;
   - insights from the templates, descriptive only.
2. **Golden test**: for `test/fixtures/upstream`, your usage and verification tables, measures and stocks equal
   those of `test/fixtures/snapshot-example`. Breakdowns, insights and details may improve on the example within the
   schema.
3. Tests for each aggregation rule of the plan (section 4), each with a small hand-checkable input:
   - mixed-model sessions;
   - subagents counted once;
   - zero denominators;
   - partial coverage;
   - interval boundaries;
   - the DST day.

### A3. Browser measures (`measures.mjs`)

`computeMeasures` and `series` over an overview, for a period, models and efforts:

- plain ES module, no imports;
- the same values as `aggregate`'s all-time measures when unfiltered;
- a filter a metric doesn't support isn't applied, and the record says `filtered: false`;
- an empty range gives null, not 0.

Test it in Node.

### A4. Refresh (`refresh` in `import.mjs`)

1. Staging, validation (`validateSnapshotDir`), then an atomic replace of `data/latest.json` beside the new
   snapshot.
2. Failures (each failing case) leave `data/` byte for byte as it was.
3. A repeat of the same source, generator and config is `unchanged`: same files, only `lastSourceCheck` moves (case
   `stale-source`).
4. Output is deterministic: two runs on the same input give identical files.
5. Snapshots kept: the current one and the ones any post's `evidence.json` names. Never delete one a post names.
6. `npm run software-factory:refresh` and `software-factory:validate` work.

### A5. The first real snapshot

1. `npm run software-factory:refresh -- --sha 7384f8c23eef441817ddb714c6ef5571cdc138bd --checkout ../in-the-loop`,
   and once without `--checkout`, from GitHub. Both give the same snapshot id.
2. Reconcile its all-time totals with that SHA's rollup (19,963 calls, $1,936.419143 at `7384f8c2`) and record the
   comparison under Progress.
3. Measure `overview.json` and the details, gzipped, against the plan's budget (about 150 KB for the overview and
   series). Split or trim details if needed, within the schema.
4. Commit `data/`.

## Done when

| Phase | Criterion |
|---|---|
| A1 | Every case in `cases.json` gives its expected outcome and code; no prose field reaches a normalized record |
| A2 | The golden test passes; each aggregation rule has its own test |
| A3 | Browser measures match `aggregate` and honour filter scopes |
| A4 | Failure leaves `data/` untouched; a repeat is `unchanged`; output is deterministic |
| A5 | `data/` holds a valid real snapshot of `7384f8c2` that reconciles with the source, its sizes recorded |

## Progress

- **A1 importer: done.** `readSources` reads at one sha from a checkout (`git show`), from GitHub (ref resolved once
  through the API, files from raw.githubusercontent.com, run records listed through the contents and trees API), or
  from a plain directory (`dir`, for the fixtures). `normalizeSources` checks schema names and required fields,
  selects public fields, flags subagent calls, parses signals (only `tool:outcome×N` tokens), takes `expected` and
  `submitted.session` from job records, and gives sessions, changes and jobs their campaign (run record names; a
  summary's or title's leading campaign; else the campaign of the change's sessions or the job's submitting
  session). Reconcile: the rollup's totals equal the sum of its sessions, and each session's entry equals its file.
  `test/data-import.test.mjs`: 24 tests, every case of `cases.json` (refresh outcomes themselves come with A4),
  prose markers planted in every prose field never reach a record, GitHub reading against a fake server.
  - Real source at `7384f8c2`: GitHub and `../in-the-loop` give byte-identical files (399 inputs, 37 run records).
    It normalizes and reconciles: 19,963 calls (260 subagent), $1,936.419143, 84 rollup sessions of 85 in the index,
    599 changes, 309 results (103 with a submitting session), 164 examples.
- **A2 aggregation: done.** `aggregate(normalized, { config, configSha256, metricDefinitions })` in `metrics.mjs`
  builds the manifest, overview and four detail collections, all schema-valid, with the id from `identity.mjs`.
  `test/data-metrics.test.mjs`, 13 tests:
  - Golden: for `test/fixtures/upstream` the days, models, efforts, usage and verification tables, measures, stocks
    and datasets deep-equal `snapshot-example`'s, and the insight texts too.
  - One small hand-checkable input per rule: subagent calls once (and the fixture's totals equal its rollup's),
    mixed-model sessions split by model, zero denominators (null, weighted not averaged), partial coverage (a session
    without metrics, an unpriced call, a job without `finishedAt`, a 0-second duration, an example without verdict),
    half-open day boundaries with gaps filled, the DST day (25 hours; spring's 23), changes with housekeeping and the
    area rule, process apart from signals, stocks apart from periods, insights from the templates, no activity.
  - Beyond the example, within the schema: a value with nothing to compute over is null (usage with no priced call,
    calls with no metrics file, no jobs), and its insight is left out; a session without metrics keeps the index's
    models and has null calls and usd; verification details hold completed jobs only (the schema needs
    `finishedAt`); areas use the importer's campaigns (sessions' run records) and job paths; an extra
    `examples-by-verdict` breakdown; catalog rows by count; Unassigned always shown; durations over 90 seconds in
    minutes. Generator version stays `1`: nothing has been published yet.
  - Real source at `7384f8c2`: valid; $1,936.419143 and 19,963 calls, as the rollup; cache reuse 97.9%; 309 jobs,
    median 10.4 s; 22 days (2026-10-24 to 2026-11-14). Areas place 229 of 599 changes (370 Unassigned) and 209 of
    309 jobs. Gzipped: overview 3.6 KB; details 6.9 (sessions), 41.9 (changes), 36.4 (verification) and 10.1 KB
    (examples).
- **For the merge** (the coordinator decides):
  - `config/source.json`, `areas.json` and `models.json` are hashed into every snapshot id, the frozen example's
    included, so editing one fails `contract.test.mjs` until the example is regenerated. The inputs' required fields
    are therefore in `import.mjs` (`FIELDS`); they could move into `source.json` at the merge, with the example
    regenerated.
  - Additions to `import.mjs`'s interface, all optional: `readSources({ dir, fetchImpl, config })`, `RawSources.runs`,
    `loadConfig()`, and `campaign` and `rollup` on normalized records. A job's linked examples count as paths
    `examples/<id>` for the area rule.
- Next: A3, `computeMeasures` and `series` in `measures.mjs`, matching `aggregate`'s all-time measures unfiltered.
- Status: working

## Loop settings

- session: 72472f30-4f80-4636-ba62-9fe57428a696
- model: claude-opus-5-5
- effort: high
- workspace: software-factory-data
- fork: 60c94760-e373-4bf5-a5a2-9c7a814f275d

## Loop until

Go on while a phase has a step that needs only your work. Stop with `done` when every Done-when row holds, or is
deferred by the timebox with its finding recorded. Stop with `blocked: ...` only for something that needs the
author or another stream, saying exactly what. Keep the last line of Progress a status: `working`, `done`, or
`blocked: ...`.
