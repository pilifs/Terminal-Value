# Brief: Software Factory, stream A (data)

**Status of the brief**: drafted 2026-11-14 after Phase 0; awaiting the author's review.

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
(applying it; its review is the author's), `config/models.json`, `data/`, and `test/data-*.test.mjs`. Nothing else.
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

- Nothing yet.
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
