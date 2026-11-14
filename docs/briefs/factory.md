# Terminal Value: Factory page execution brief

**Prepared:** 2026-11-14  
**Implementation repository:** `pilifs/Terminal-Value`  
**Suggested repository location:** `docs/briefs/factory.md`  
**Purpose:** A shared brief for a coordinator and three parallel implementation agents. Build the data contract first, then an aggregate-first Factory page and a section for Filip's authored analysis.

## 1. Product direction and agreed preferences

Create a public Factory section at **`terminalvalue.net/factory/`**. It should explain what the software factory produces, how its activity and efficiency change, and what Filip is learning from running it. Readers should understand the headline data quickly, then follow a metric or article into its supporting evidence.

The user's design preferences are explicit:

- **Plausible:** compact aggregate metrics, one principal chart, useful breakdowns, and progressive disclosure.
- **shadcn/ui dashboard:** restrained components, clear spacing, typography, filters, and responsive layouts.
- **Terminal Value's `/verify-bytecode/` draft:** white/pale surfaces, green accents, fine boundaries, and readable technical detail.
- **Buildkite is not a design reference for this work.** The user found it too technical and insufficiently focused on aggregate data and insights. Do not make a build list, agent terminal, or execution waterfall the main page.
- **Authored analysis is a first-class section.** Filip wants to publish his own observations and bespoke analysis about the Factory. The tentative first article is **“Fable 5.1 vs. 5.2.”** Build the general editorial capability independently of whether that becomes the first published post.

The overview combines measured data with links to human interpretation. Automatically calculated observations should remain descriptive; qualitative judgments and explanations belong in the authored posts. A reader must be able to distinguish the two.

### Initial scope

Deliver a source-backed published-data overview; automatic refresh plumbing; aggregate filters and drill-down; a Factory analysis archive integrated with the existing blog; and a draft scaffold for the tentative first post. Define the interface for future machine-level runtime observations, but do not make the first useful release depend on installing a collector in another repository or on Filip's workstation.

Preserve the current static-site architecture. shadcn is the component and visual reference, not a requirement to migrate the site to React, Next.js, or Tailwind. A new framework or large client bundle needs a concrete benefit beyond reproducing these layouts.

## 2. Repository baseline and preflight

This brief was grounded in these revisions:

| Repository | Inspected revision | Role |
| --- | --- | --- |
| `pilifs/Terminal-Value` | `3c76511262983bb9396211dbceedbc477a7bc67d` | Website and editorial implementation |
| `pilifs/in-the-loop` | `7384f8c23eef441817ddb714c6ef5571cdc138bd` | Published Factory metadata |

Recheck the actual working branch before implementing. These revisions are audit baselines, not instructions to discard newer work.

### What the website already provides

- `AGENTS.md` defines the writing, draft, image, and deployment conventions; `CLAUDE.md` refers to it. Read and follow them.
- Node 24.13.1, native ES modules, Marked, footnotes, and Shiki. The blog has no React runtime or bundler.
- `blog/build.mjs` builds `dist/`, including article HTML, original Markdown and post assets, homepage, RSS, sitemap, `llms.txt`, headers, and robots rules.
- Posts are `blog/posts/<slug>/index.md`, with **flat** `key: value` front matter. The parser does not support nested YAML or arrays.
- `npm run new -- <slug>` copies the current post template as a draft.
- Cloudflare Pages project `terminal-value`; existing deployment scripts target the `production` and `dev` branches.
- `projects/terminal-value-pipeline/` is an archived project. Leave its source outside this feature's edits. The existing build requires its generated demo output.

### Preflight issues the coordinator must resolve

1. **Locate the current `/verify-bytecode/` source.** It is live on the development site but absent from the inspected website `main`. Check the actual working tree, branches, and deployment setup. Continue isolated Factory implementation while resolving this; reconcile the source before any eventual site deployment. The builder deletes and replaces `dist/`, so deploying an incomplete source tree could remove an existing page.
2. **Preserve build ordering.** Assets are copied into `dist/`, then project output, then generated pages and posts. Generate Factory HTML/data after the relevant copy steps; never hand-edit `dist/`.
3. **Keep draft/internal files out of `blog/assets/`.** Everything in that directory is copied into public output. Put importer caches, raw upstream inputs, test fixtures, and draft evidence elsewhere.
4. **Fix draft filtering at the correct seam.** `loadPosts()` currently renders Markdown before excluding drafts. Filter production drafts before rendering them so a draft-only body image does not break a production build. Test this behavior.
5. **Use explicit authorship.** The existing `reading-the-trace` article says it was written by Claude, despite the site's global author metadata naming Filip. Do not feature it as Filip's personal analysis or silently reattribute historical posts.

Implementation belongs in Terminal-Value. Changes to the upstream factory, its trace publisher, or its workstation are separate producer work; document required interfaces without silently expanding into those codebases.

## 3. Information architecture and experience

### Routes

| Route | Purpose |
| --- | --- |
| `/factory/` | Aggregate overview, descriptive insights, and prominent authored analysis |
| `/factory/analysis/` | Archive of Filip's published Factory posts |
| `/factory/methodology/` | Metric definitions, coverage, source provenance, freshness, and comparison limits |
| `/posts/<slug>/` | Existing canonical article route |
| `/posts/<slug>/index.md` | Existing agent-readable article source |
| `/factory/data/...` | Remote versioned public data resources; see transfer design |
| `/factory/static-data/...` | Bundled checked data outside the Function route, for static preview and fallback |

Keep articles canonical under `/posts/`; do not create a second copy under `/factory/`. Add a modest Factory entry to site navigation and the homepage, preserving the blog's existing purpose. Include actual new pages in the sitemap and `llms.txt`. Published Factory posts remain in the existing main RSS feed.

### Overview order

1. **Compact introduction and freshness.** “The Factory,” one sentence explaining it, a date-range control, and a quiet “Published data as of…” label. Runtime availability is secondary.
2. **Four summary metrics.** Initial period-aware measures: estimated model usage, model calls, input cache reuse, and completed verification jobs. Use plain labels, units, a definition on demand, and coverage information. Model calls measure activity, not productivity.
3. **One selectable trend chart.** Switch among usage, calls, cache reuse, and completed verification. Show the selected measure's unit and aggregation window. A data table remains available for accessibility and precise reading.
4. **Two or three short calculated observations.** Examples: share of usage by model; weighted cache reuse; median observed verification duration with sample count. Each links to its underlying breakdown. Do not generate causal claims or a model “winner.”
5. **Analysis & notes by Filip.** A featured published article and a short list, with title, description, byline, date, and restrained cover treatment. This section sits near the aggregate insights, before technical records.
6. **Output and breakdowns.** Snapshot totals for distinct recorded changes and examples; breakdowns by model, explicitly mapped Factory area, and example system/technique where supported. Mark snapshot stock separately from period activity.
7. **Optional deeper exploration.** A short recent-changes view and drill-down into sessions, verification results, and evidence. Raw IDs, commands, logs, and process status belong here.

Default to **All time** when the available history is sparse. Offer bounded periods only where the metric supports them. A current example catalog is a stock: do not turn its count into “examples created this week” without historical evidence.

Scope model filters to usage/activity panels until verification and change attribution are sufficiently complete. If a panel is unaffected, label its scope explicitly. Do not allow an apparently global filter to silently produce unrelated denominators.

### Progressive disclosure and live behavior

Selecting a metric or breakdown opens a focused panel or section: definition, values, coverage, and supporting records. A record can then expose its source revision and evidence. Preserve selected filters in the URL, support browser back/forward, and provide a stable link to the selected view. Keep the initial route count small; deep record pages are optional when a query-backed view suffices.

Refresh values without moving focus, resetting filters, or reordering a list someone is reading. Announce new records with a count and an explicit refresh action. Pause unnecessary polling in hidden tabs, cancel obsolete requests, and retain the last valid view on a transient error.

The static HTML must already contain meaningful aggregate content and published article links. The client module adds interaction; article reading must not depend on the data service being available.

### Visual implementation

Use a Factory-specific shell approximately 70–72rem wide, a system font, tabular numbers, muted chart grids, thin borders, and modest radii. Use the preferred green/white reference within scoped Factory styles. The current blog has a narrower reading measure and blue accents; avoid changing every article's typography or palette as a side effect.

Make light and dark appearances coherent. At mobile widths, stack metrics and panels, keep controls usable, and avoid horizontal page overflow. Charts and selectors need keyboard access, visible focus, accessible names, and a table or textual equivalent. Color must not be the only indication of state. A positive delta is not automatically good: higher cost or more calls should use neutral treatment unless the interpretation is explicitly justified.

## 4. Data transfer and metric contract — implement first

### Source inputs

Read public metadata from a **single pinned `in-the-loop` Git revision per snapshot**:

| Input | Use |
| --- | --- |
| `llm-dlc/traces/metrics.json` | Aggregate totals, existing breakdowns, deduplicated change records |
| `llm-dlc/index.json` | Session identity and links |
| `llm-dlc/traces/<id>/metrics.json` | Numeric call rows needed for combined date/model filters |
| `verification/results/index.json` | Historical job results, timing, memory, capabilities, and attention flags |
| `examples/index.json` and `examples/tags.json` | Catalog stock, subjects, techniques, outcomes, and freshness |
| Selected briefs / job records / manifests | Optional enrichments and evidence links, fetched only as needed |

Resolve a moving ref such as `main` once, then fetch every file by that SHA. Support an explicit SHA and a local checkout for reproducibility. Validate input schema names and required fields. Select public fields explicitly: session metric documents contain prose as well as numbers, so do not copy entire upstream documents into the browser model. Raw transcripts are unnecessary for the overview.

Provide proposed commands such as:

```sh
npm run factory:refresh -- --ref <git-ref>
npm run factory:validate
npm run test:factory
```

The ordinary site build remains offline and consumes a checked snapshot. Refresh writes to staging, validates, then replaces the local checked snapshot atomically. A failed refresh retains the last good snapshot and reports the failure. Never substitute demo data or zeroes for unavailable production data.

### Minimal public contract

Freeze version 1 before the parallel UI work. Use these conceptual records; exact field spelling can be finalized once by the contract owner:

| Record | Required information |
| --- | --- |
| Snapshot manifest | Schema version, snapshot ID, source repository/SHA, generator and metric-definition version, collection URLs/hashes, measurement bounds and completeness per dataset |
| Transport metadata | Published/check time, last successful source check, latest available snapshot ID; separate from deterministic content identity |
| Overview | Summary measures, units, scope, numerator/denominator where applicable, missing/coverage counts, trend buckets, breakdowns, descriptive insight records |
| Details | Stable session/change/job/example IDs, source links, relevant normalized facts, evidence references |
| Authored content summaries | Slug, title, description, explicit author, date, cover, collection, featured flag, optional evidence reference; derived from selected posts |
| Optional runtime observation | Producer/run IDs, observed/expiry times, source revision, typed states, counters, and completeness |

The snapshot ID derives from normalized content and source/generator/config identity. Do not include a refresh clock in its hash. The refresh no-op check compares the upstream SHA **and** schema, generator, configuration, and metric-definition identity; an importer fix or model-alias change must be able to produce a corrected snapshot without a new upstream commit. Keep transport check times separate so checking an unchanged source does not invent a new measurement or snapshot. An older source can be successfully checked today without containing new work today.

Authored-content summaries are a separate build-derived input, identified by the website source revision where needed. Automatic Factory-data refresh does not read draft posts, regenerate article cards, or publish editorial metadata.

### Aggregation rules

1. **Usage:** sum recorded token-priced `usd` for the selected call cohort. Label it estimated USD usage and preserve `pricing_as_of` and priced-call coverage. Keep client-reported usage, unattributed usage, and hypothetical uncached cost separate; they are not additive components of one bill.
2. **Cache reuse:** `sum(cache_read_tokens) / sum(input_tokens + cache_read_tokens + cache_write_tokens)`. Use weighted totals. A zero denominator is unavailable. Thinking tokens are already within output tokens; cache reads are repeated context processing, not unique input.
3. **Combined filters:** the source's global `by_day` and all-time `by_model` tables cannot be combined into model-by-day data. Preaggregate numeric call rows by day/model/effort when offering those filters. Do not assign a mixed-model session's total to one model or add subagent usage twice.
4. **Time:** store event timestamps in UTC and carry the aggregation timezone explicitly. Use `America/Toronto` for the initial author-facing calendar windows, rebucketing original timestamps rather than relabeling upstream UTC daily buckets. Use half-open intervals `[start, end)` and test boundary/DST behavior. Show the timezone for calendar-based comparisons.
5. **Changes:** deduplicate by jj `change_id`. Keep trace-publication housekeeping identifiable. The rollup lacks actual change timestamps, and per-session contribution timestamps are not Git commit timestamps. Initially keep change counts as snapshot totals unless actual commit dates are deliberately imported and their meaning documented.
6. **Verification:** keep process outcome, semantic conclusion, and expectation separate. A passed job can successfully detect a violation. Historical attention entries are not counts of currently unresolved blockers. Duration summaries use valid observed values and show sample size; summed parallel session time is not factory wall time.
7. **Catalog:** preserve constructed versus real-world origin, unknown freshness, absent conclusions, and vacuity. Do not advertise all verified labels as current, non-vacuous proofs.
8. **Deltas:** require comparable coverage for both periods. Missing baseline means unavailable. A zero baseline with new activity is “new” or an absolute change, not infinite growth. Different task mixes do not establish relative model quality.
9. **Missing joins:** retain null/unattributed values. Only 103 of 309 job records had a submitting-session link in the audit; model-level verification claims need a documented coverage basis.
10. **Domains:** use an explicit website configuration mapping domains/areas to campaigns/streams/source paths. Keep an Unassigned bucket. Example subject tags such as payments/consensus are a separate taxonomy. There was no first-class Factory domain registry at the audited revision.

All initial descriptive insights must be reproducible functions over the normalized data. Carry a metric ID, scope, evidence reference, and coverage with each insight. Keep causal interpretation out of automatic copy.

## 5. Refresh and serving architecture

### Milestone 1: real data without a service dependency

Commit a compact, validated public snapshot and its provenance under `blog/factory/data/`. Generate `/factory/static-data/latest.json` and immutable snapshot resources during the site build. The first `/factory/` implementation uses that bundled endpoint, renders real aggregate data, and works locally even with no Cloudflare credentials.

This is a published snapshot. It becomes fresher only when a new dataset is published. Do not show an unconditional “Live” badge.

### Milestone 2: published-data updates without rebuilding the site

Preferred extension within this repository:

- A read-only Cloudflare Pages Function for `/factory/data/*`, backed by an R2 metadata namespace and a configured binding. Reuse an existing suitable data endpoint if the coordinator finds one; do not create duplicate infrastructure blindly.
- A website-owned refresh/publish job that runs the same importer, uploads immutable snapshot objects, then changes `latest.json` only after the objects are available and validated.
- Start with a manual workflow entry point. Prepare an explicitly configured schedule, initially every 15 minutes; scheduled CI is best-effort and is not a guarantee of real-time delivery. A future upstream dispatch can reduce publication latency.
- Browser conditional polling of the one same-origin pointer every 30–60 seconds while visible. Fetch immutable data only when the snapshot changes. No browser fan-out to hundreds of GitHub files.
- Serialize publishers and prevent an older run from overwriting a newer pointer. Separate preview and production destinations.

Cache immutable snapshot resources aggressively; give the mutable pointer revalidation/short-cache behavior and implement ETag handling correctly. Preserve last successful source-check time separately from underlying data age. Restrict the function to the metadata namespace and GET/HEAD; it is not a public generic R2 gateway. Keep publishing credentials in the job environment, never the client bundle or generated JSON.

Configure the client with both the optional remote `/factory/data/latest.json` and bundled `/factory/static-data/latest.json`. The bundled path stays outside the Function's route. On a first visit with a missing binding, unavailable service, or invalid remote snapshot, load one complete bundled snapshot and label its actual measurement age; do not mix collections from different snapshots. A missing remote detail may be reported unavailable rather than replaced with an unrelated local record. Test first-load fallback and its filters, not only preservation of an already loaded view.

Ordinary local/static preview uses the bundled snapshot. Exercise the actual function with Wrangler Pages local development separately; the existing custom `npm run dev` server does not execute Pages Functions. Function responses own their cache headers; do not assume static `_headers` rules apply to them.

Implement the refresh code and tests even if deployment credentials are unavailable. Report separately what works locally, what is configured, and what has been deployed. Under the existing `AGENTS.md`, deployment happens when the author requests it; this brief itself is not a deployment instruction.

### Optional runtime producer seam

Accept versioned, expiring runtime observations later. Missing/expired data becomes unavailable/stale, never zero active work. An upstream session marked `open` only indicates recent activity when synchronized; a last-output timestamp is not an independent heartbeat. Actual agent liveness and unpushed queue state require a producer on the Factory machine. Publish a producer contract and example fixture in this repository; installing and operating that producer is a separate task.

Runtime detail should enrich deeper views without turning the aggregate homepage into an operations console.

## 6. Authored analysis and the first post

Reuse the current Markdown article workflow. Add optional flat metadata, preserving backward compatibility:

```yaml
collection: factory
author: Filip Stankovic
featured: true
evidence: evidence.json
draft: true
```

Keep the parser's required `title`, `date`, and `description` fields, plus `image` under the existing authoring convention. Rich cohort data belongs in `evidence.json`, not nested front matter. Use the author's eventual publication date; do not treat the draft's creation date as a publication commitment.

Use one publication-selection path: Factory cards, archive, generated content index, homepage, RSS, sitemap, and `llms.txt` all consume the same already draft-filtered post collection. Apply Factory collection/author filters to that collection instead of independently reading files. Select the personal Factory archive from explicit `collection: factory` and author metadata. If multiple published articles are featured, select deterministically by date then slug. Do not include an agent-written historical article in a section promising Filip's authored analysis; it may be linked separately as related background.

Render a visible byline on the Factory cards and authored post. Make per-post author metadata consistent with article metadata when supplied, without silently rewriting authorship of older content. Provide a link back to Factory analysis from relevant posts.

### Draft: “Fable 5.1 vs. 5.2”

Create a draft scaffold at `blog/posts/fable-5-1-vs-5-2/` using the existing post workflow. Preserve that exact tentative title. Include prompts for Filip to fill in, not invented observations or first-person conclusions:

1. What I observed and why it matters.
2. Exact model identities, effort, harness, and other configuration changes.
3. Workload/cohort selection, dates, sample sizes, and exclusions.
4. Observed differences in outcomes, rework/intervention, duration, usage, and cache behavior where measured.
5. Concrete incidents and qualitative details the aggregates miss.
6. What I am changing in the Factory as a result.
7. Method, frozen evidence, limitations, and unresolved questions.

The audited data includes `claude-fable-5-1`; do not infer a mapping from other IDs to “Fable 5.2.” Maintain raw model IDs and explicit display aliases. The eventual comparison needs a supplied, documented alias/cohort mapping. Build the general page even if no matched comparison is available. Do not create a benchmarking platform merely to scaffold this article.

The post remains `draft: true`. Its evidence reference can initially be omitted, or point to a well-formed manifest explicitly marked incomplete. Draft previews do not require finished cohort/model mappings. Never invent snapshot IDs or checksums to make a scaffold validate. Publishing quantitative claims requires completed provenance and valid declared evidence references; a missing or malformed published reference fails validation.

Use valid local draft assets; the repository's post convention requires a centered 1200×630 `cover.png`. The existing template cover is acceptable while drafting, but the finished post needs a relevant cover before publication.

### Frozen evidence for articles

An article's data must remain stable while the dashboard updates. Its evidence manifest records source repository/SHA, snapshot ID, metric-definition version, pricing basis, measurement interval/timezone, exact cohort or included record IDs, raw model identities, exclusions, missing-data coverage, relevant configuration, and supporting data checksums.

Provide separate links for **“Data used in this analysis”** and **“Latest Factory data.”** Keep article-linked snapshots available, or copy the necessary public evidence into the published post folder; data retention must not break published analysis. Do not silently update article numbers or conclusions when the live pointer changes.

Production draft exclusion covers cards, archives, homepage, RSS, sitemap, `llms.txt`, generated content indexes, article HTML/Markdown, and post-local assets/evidence. A draft title must not leak through a public “coming soon” card unless Filip explicitly chooses to announce it. If no authored post is published yet, use a small honest empty state while retaining the section's layout. Draft builds retain noindex behavior.

## 7. Code organization and parallel agents

Use four roles. One coordinator owns shared integration files. All agents follow the repository's current instructions and work on isolated branches/worktrees if available. Do not let multiple agents edit `blog/build.mjs` independently.

### Phase 0 — coordinator plus data owner

Before parallel UI work:

1. Check the current branch and resolve the source/layout inventory described above.
2. Freeze `factory/v1`, metric definitions/filter applicability, the post-card shape, public paths, and source/public file boundaries.
3. Create a small real pinned fixture plus explicit missing/stale/error test fixtures.
4. Agree pure interfaces such as `normalizeFactorySources`, `aggregateFactory`, `renderFactoryPage`, and `selectFactoryPosts`. Name and finalize them once; other agents consume the contract.
5. Record shared-file ownership and the existing site build baseline. This phase should be a small integration step, not a new framework project.

### Workstream assignments

| Agent | Owns | Deliverable and acceptance |
| --- | --- | --- |
| **A — Data and insights** | `blog/factory/import.mjs`, `metrics.mjs`, `schema.json`, `data/`, `config/`, data tests | Pinned importer, normalized public snapshot, correct aggregations, compact series/breakdowns, provenance and coverage. Reconciles all-time totals with source and retains last good data on invalid refresh. |
| **B — Dashboard and interaction** | `blog/factory/render.mjs`, `blog/assets/factory/`, UI-specific tests | Static meaningful overview; small client module; aggregate-first hierarchy; one chart; filters; responsive accessible details; prominent authored-analysis slot. Consumes data/post contracts without changing their meaning. |
| **C — Editorial and evidence** | `blog/factory/editorial.mjs`, Factory template/guidance, draft post folder, evidence validation, editorial tests | Explicit post selection/bylines, archive/card inputs, immutable article evidence convention, tentative comparison draft. No invented findings or production draft leakage. |
| **D — Coordinator, feed and integration** | `blog/build.mjs`, `blog/new-post.mjs` if needed, root package/lockfile, global navigation, Pages Function/config, refresh workflow, integration docs/tests | Integrates modules; publishes intended public files only; wires feeds and fallback; owns shared-file edits and end-to-end acceptance. Preserves all existing site routes and build behavior. |

Suggested source placement:

- Factory source/modules/config/data: `blog/factory/`.
- Intentionally public CSS and browser ES modules: `blog/assets/factory/`.
- Pages Function: `functions/factory/data/[[path]].js` or an equivalent route fixed in Phase 0.
- Refresh automation and its scripts: website-owned workflow plus importer/publisher modules; credentials outside source.
- Implementation notes/runbook: `docs/factory.md`.
- Per-workstream tests: separate files under `blog/factory/test/` to avoid collisions.

The coordinator extends `layout()` with optional page class and page-specific assets; defaults preserve existing articles. Integrate Factory generation into `build()` after copying assets, add `.json` to the local server MIME map, compose `_headers` with its existing JSONL rule, and update sitemap/`llms.txt`/navigation. Normal article RSS behavior continues.

### Integration order

1. Merge contract and data foundation; prove one real snapshot can produce a readable static overview.
2. Integrate dashboard and editorial modules against that contract. These can run in parallel after Phase 0.
3. Wire optional remote data serving and refresh, then exercise update/failure behavior.
4. Run the complete production/draft build checks and visual review. Deliver a reviewable local build, implementation summary, remaining configuration, and deployment instructions. Do not report a running remote feed unless it was actually configured and observed.

Each agent's handoff includes files changed, interfaces used, decisions, meaningful validation, and concrete remaining issues. Avoid speculative refactoring or unrelated archive changes.

## 8. Acceptance and completion criteria

### Data

- Every snapshot uses one source SHA and records generator/config identity.
- Weighted cache ratios, zero denominators, shared-change deduplication, mixed-model calls, and partial coverage behave correctly.
- Date/model filters use real combined aggregates; timezone/DST and interval boundaries are checked.
- Snapshot stock is not presented as period production; unsupported model attribution remains explicit.
- Process pass, semantic outcome, expected outcome, vacuity, and unknown freshness remain distinct.
- Invalid input/unsupported schema/network failure preserves valid published data and does not advance the latest pointer.
- An unchanged source does not create a duplicate content snapshot. Source-check freshness and measurement freshness remain separate.

### Product and editorial

- The first screen communicates aggregate activity, efficiency, output, and authored interpretation without requiring technical knowledge of job IDs.
- One chart and concise breakdowns lead to deeper evidence; keyboard and URL navigation work.
- Published author posts are prominent, use explicit attribution, and open at canonical article URLs.
- The tentative comparison stays a draft, with valid assets and no fabricated findings.
- Production output excludes every draft-only surface and file; draft preview remains noindex.
- Article evidence remains pinned and readable after dashboard refresh or feed failure.
- Existing homepage/posts/project demo remain functional; no unrequested global restyling.

### Serving and failure behavior

- Static HTML remains useful with JavaScript disabled or the remote feed unavailable.
- The function serves only intended data paths; cache behavior and ETags are correct for mutable versus immutable resources.
- A failed fetch does not erase the chart, reset filters, or show false zeroes; stale/unknown runtime observations are labeled honestly.
- No client secrets, raw transcripts, importer caches, or draft evidence appear in generated public output.
- Live values update without disruptive reflow; initial payload is compact and detail records are lazy-loaded. Measure the actual transferred sizes and keep the public overview/series around 150 KB gzip or less where feasible; split larger details instead of loading everything up front.

Use targeted semantic and integration checks, not tests that merely mirror implementation. Existing baseline commands are:

```sh
npm ci
npm run build:projects
npm run build
npm run build:drafts
npm run dev
```

`npm run dev` builds and serves but is not currently a watcher. Add only the new scripts needed for refresh, validation, and focused tests. Use Wrangler Pages local development to verify actual Function/binding behavior; it complements the current static preview.

Visually inspect desktop and mobile layouts in light and dark appearance, including an empty analysis section, a populated published section, unavailable data, and the existing article pages. Deploy only under the repository's author-request policy, after the current source/deployment discrepancy has been reconciled.

## 9. Completion milestones

**First reviewable milestone:** complete Milestone 1 with a polished `/factory/` overview built from actual published data, a reproducible manual importer, clear measurement scope, useful aggregate exploration, and a prominent path into Filip's authored analysis. This can be reviewed without service credentials. It is ready for the first comparison article without pretending that the article or its experiment has already been completed.

**Complete website-side implementation:** finish Milestone 2's read service, publisher, refresh workflow, and failure tests next. Automatic publication refresh is part of the overall plan, while remote deployment/configuration is reported separately and follows the author-request policy. Do not hold the first reviewable milestone for infrastructure credentials, or describe a static snapshot alone as the completed live feed.

The next increment can connect runtime observations and richer attribution. Neither is a reason to delay the static data, editorial, or aggregate UI work.

## Sources and design references

### Website implementation evidence

- [Terminal-Value baseline](https://github.com/pilifs/Terminal-Value/tree/3c76511262983bb9396211dbceedbc477a7bc67d)
- [Repository instructions](https://github.com/pilifs/Terminal-Value/blob/3c76511262983bb9396211dbceedbc477a7bc67d/AGENTS.md)
- [Build, rendering, routing, and draft behavior](https://github.com/pilifs/Terminal-Value/blob/3c76511262983bb9396211dbceedbc477a7bc67d/blog/build.mjs)
- [Dependencies and existing commands](https://github.com/pilifs/Terminal-Value/blob/3c76511262983bb9396211dbceedbc477a7bc67d/package.json)
- [Current blog styles](https://github.com/pilifs/Terminal-Value/blob/3c76511262983bb9396211dbceedbc477a7bc67d/blog/assets/style.css)
- [Post template](https://github.com/pilifs/Terminal-Value/blob/3c76511262983bb9396211dbceedbc477a7bc67d/blog/templates/post/index.md)
- [Existing trace article and explicit authorship note](https://github.com/pilifs/Terminal-Value/blob/3c76511262983bb9396211dbceedbc477a7bc67d/blog/posts/reading-the-trace/index.md)

### Factory data evidence

- [Aggregate metrics](https://github.com/pilifs/in-the-loop/blob/7384f8c23eef441817ddb714c6ef5571cdc138bd/llm-dlc/traces/metrics.json)
- [Metric definitions and attribution](https://github.com/pilifs/in-the-loop/blob/7384f8c23eef441817ddb714c6ef5571cdc138bd/llm-dlc/tools/metrics.py)
- [Session index](https://github.com/pilifs/in-the-loop/blob/7384f8c23eef441817ddb714c6ef5571cdc138bd/llm-dlc/index.json)
- [Verification results](https://github.com/pilifs/in-the-loop/blob/7384f8c23eef441817ddb714c6ef5571cdc138bd/verification/results/index.json)
- [Verification pipeline](https://github.com/pilifs/in-the-loop/blob/7384f8c23eef441817ddb714c6ef5571cdc138bd/verification/pipeline.py)
- [Example catalog](https://github.com/pilifs/in-the-loop/blob/7384f8c23eef441817ddb714c6ef5571cdc138bd/examples/index.json)
- [Result format normalization](https://github.com/pilifs/in-the-loop/blob/7384f8c23eef441817ddb714c6ef5571cdc138bd/examples/tools/result_format.py)
- [Stream state semantics](https://github.com/pilifs/in-the-loop/blob/7384f8c23eef441817ddb714c6ef5571cdc138bd/llm-dlc/tools/streams_status.py)

### Design and serving references

- [Plausible live dashboard](https://plausible.io/plausible.io) and [dashboard interaction guide](https://plausible.io/docs/guided-tour)
- [shadcn/ui dashboard](https://ui.shadcn.com/examples/dashboard)
- [Preferred Terminal Value landing-page style](https://dev.terminal-value.pages.dev/verify-bytecode/)
- [Stable live-update interaction example](https://trigger.dev/changelog/live-runs-page)
- [Cloudflare Pages R2 bindings and local development](https://developers.cloudflare.com/pages/functions/bindings/)
- [Cloudflare Pages Function configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)
- [Cloudflare Pages Function routing](https://developers.cloudflare.com/pages/functions/routing/) and [static versus Function headers](https://developers.cloudflare.com/pages/configuration/headers/)
- [GitHub workflow schedule behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)

Repository facts above were read from the pinned sources. New routes, modules, contracts, cadence, and acceptance criteria are implementation proposals in this brief. The user's design and authorship requirements take precedence over optional implementation suggestions.
