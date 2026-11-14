# Brief: Software Factory, stream B (dashboard)

**Status of the brief**: drafted 2026-11-14 after Phase 0; approved by the author on 2026-11-14.

One stream of [`software-factory.md`](software-factory.md), run by `run-streams.sh software-factory` in the jj
workspace `software-factory-dashboard`, on a branch of its own. It builds the three Software Factory pages, their
styles and the small client module, against the contract and the example snapshot.

**Inputs.** Read these in full before the first piece of work of every cycle:

- [`software-factory.md`](software-factory.md), the main brief: its Direction and How to work through it apply here.
- [`docs/software-factory.md`](../../docs/software-factory.md): the frozen contract, routes, ownership and commands.
- Section 3 (Information architecture and experience), section 5's client behaviour, and section 8 (Product,
  Serving) of [`docs/briefs/software-factory.md`](../../docs/briefs/software-factory.md).
- The header of `render.mjs` (your interface), `index.mjs` (how your pages are wrapped), the header of
  `measures.mjs` (the browser measures stream A provides), `config/metrics.json`, `schema.json`, and
  `test/fixtures/snapshot-example/`.
- The latest integration check: `$(jj workspace root --name default)/llm-dlc/loop-summaries/software-factory-integration.md`.

## What you own

`blog/software-factory/render.mjs`, `blog/assets/software-factory/` (`style.css`, `app.js`, and any further browser
modules), `test/render-*.test.mjs` and `test/client-*.test.mjs`. Nothing else. Record any need for another file
under Progress (a `layout()` option, a `package.json` script, a contract change).

Until stream A's `measures.mjs` lands at the merge, the browser module may compute what it needs from the overview
itself, behind the `computeMeasures`/`series` interface. Leave a note under Progress to switch to A's at the merge.

## Design

- **Order of the overview** (plan, section 3):
  1. a compact introduction with the date-range control and a quiet "Published data as of …" label from the
     snapshot's own dates (never "Live");
  2. four summary metrics with plain labels, units, a definition on demand and coverage;
  3. one trend chart switching among the four, with its unit and window, and a data table;
  4. two or three calculated observations, each linking to its breakdown;
  5. "Analysis & notes by Filip": a featured post and a short list, or a small honest empty state that keeps the
     layout;
  6. output and breakdowns, stocks marked as snapshot totals apart from period activity;
  7. optional deeper exploration (recent changes, sessions, verification results, examples), where raw ids and
     sources live.
- **Look**:
  - a section shell about 70–72rem wide;
  - system font, tabular numbers, muted chart grids, thin borders, modest radii;
  - white and pale surfaces with green accents, coherent in light and dark;
  - every rule scoped under `body.software-factory`, so no article changes;
  - stacked metrics and panels at phone width, with no horizontal overflow.

  The development site's `/verify-bytecode/` page is the colour and spacing reference. Look at it if useful, but
  never link to it or copy its content: it is an unseen draft.
- **Neutral deltas**: higher cost or more calls is not "good"; no green-up / red-down for those.
- **Accessibility**: charts and selectors work by keyboard, with visible focus and accessible names, and a table or
  text equivalent. Colour is never the only signal.
- **Model and effort filters** apply to usage panels only. Every panel a filter doesn't affect says so. No
  apparently global filter changes unrelated denominators.

## The plan

### B1. Static pages (`render.mjs`)

1. The overview from a snapshot, in the order above. The static HTML holds the all-time numbers, the chart for the
   default measure (inline SVG), the table, the insights and the post links, with no script.
2. `analysis/index.html`: the author's Software Factory posts from `posts` (editorial's `selectPosts` output), with
   title, description, byline, date and a restrained cover. `methodology/index.html`: the metric definitions and
   notes from `config/metrics.json`, coverage per dataset, source repository and SHA, the generator and
   metric-definition versions, pricing date, timezone, the area mapping's status, and comparison limits.
3. States:
   - no snapshot (`unavailable`): an honest message, layout kept, posts still listed;
   - fixture data (`fixture: true`): a plain banner saying the numbers are a test fixture;
   - no published posts: the empty state;
   - escape everything that comes from data.

### B2. Styles (`blog/assets/software-factory/style.css`)

As under Design. Check the existing article pages are unchanged (production build unchanged; drafts build changed
only under `/software-factory/`).

### B3. Client module (`blog/assets/software-factory/app.js`)

1. Date range (all time by default; 7 and 30 days where a metric supports them), model and effort filters, and the
   chart's measure. Kept in the URL, with back and forward, and a stable link to the view.
2. Data:
   - try `/software-factory/data/latest.json`; on a missing route, error or invalid snapshot, load the bundled
     `/software-factory/static-data/latest.json` snapshot whole (never mixing snapshots);
   - poll the pointer every 30–60 seconds while the tab is visible, conditionally (`If-None-Match`);
   - fetch immutable files only when the snapshot changes;
   - cancel obsolete requests;
   - keep the last valid view on a transient error.
3. New data never moves focus, resets filters or reorders a list being read. Announce it with a count and an
   explicit refresh action.
4. Lazy details: load `details/*.json` only when a reader opens deeper exploration.
5. Keep the logic in pure functions in their own modules (URL state, choosing a snapshot, fallback, formatting),
   so Node tests can import them without a browser.

### B4. Tests

- Render tests on the example snapshot:
  - the numbers are present in static HTML;
  - no "Live";
  - stock and period labels;
  - all four states;
  - a populated analysis list from made-up `postSummary` records;
  - escaping.
- Client tests for the pure functions: URL state round trip, first-visit fallback with filters set, and refusing a
  snapshot that fails validation.

### B5. Review

1. Build the drafts site on the example (`SOFTWARE_FACTORY_DATA_DIR=blog/software-factory/test/fixtures/snapshot-example
   PORT=8791 npm run dev`).
2. Look at desktop and mobile, light and dark, with `llm-dlc/tools/screenshot.sh URL OUT_PREFIX` (headless
   Chromium, set up on this machine).
   - Shoot every page in each state: the example, no snapshot, the empty and populated analysis.
   - Write the shots to the scratchpad or `/tmp`, never the repo.
   - Look at every image, fix what is wrong, and shoot again.
   - Record under Progress what was checked.
3. Measure the gzipped sizes of the page, `style.css` and `app.js`, and record them.

## Done when

| Phase | Criterion |
|---|---|
| B1 | Three pages render from the example and from no snapshot, with the plan's order and states |
| B2 | Scoped styles; existing pages unchanged; usable at phone width in both themes |
| B3 | URL state, fallback, conditional polling and lazy details work, with logic in tested pure modules |
| B4 | Render and client tests pass |
| B5 | Sizes recorded; every page and state looked at in screenshots, in both widths and themes |

## Progress

- **B1, overview** (cycle 1): `render.mjs` renders `index.html` in the plan's order: intro with "Published data as
  of" (the snapshot's last day) and the source SHA, four summary metrics with coverage, definitions on demand and
  their filter scope, the trend chart (inline SVG) with its data table, three observations linking to their
  breakdown or records, "Analysis & notes by Filip" (featured post and list, or the empty state), stocks marked
  "Snapshot total" apart from the breakdowns, and deeper exploration (lazy details, raw ids, source). States: no
  snapshot (message, layout and posts kept), fixture banner, escaping. Shared browser modules, imported by
  `render.mjs` too: `blog/assets/software-factory/format.js`, `chart.js`, and `measures-local.js`.
  - Days a dataset didn't measure (outside its manifest bounds) are null in the chart and table, never 0.
  - Periods (7d, 30d) end on the snapshot's last day, not the reader's clock.
  - Tests: `test/render-overview.test.mjs` (13) and `test/client-measures.test.mjs` (8), 41 in all pass. The
    production build is byte-identical to the parent's (85 files); the drafts build renders the overview from the
    example and from no snapshot.
- **For the merge: switch to A's measures.** `measures-local.js` keeps stream A's `computeMeasures`/`series`
  interface. At the merge, import `computeMeasures` and `series` from `../software-factory/measures.js` (browser)
  and `./measures.mjs` (`render.mjs`), keep `trend`, `periodRange`, `torontoDay` and `datasetDays` from
  `measures-local.js`, and check A's results against `test/client-measures.test.mjs`.
- **Contract request: `test/build.test.mjs`.** Its test "a published section is listed in the sitemap and llms.txt"
  asserts the sitemap is exactly `['/software-factory/']`. Once the analysis and methodology pages exist (next
  piece), `index.mjs` lists all three and that frozen test fails. Asked of the merge: assert the three URLs
  (`/software-factory/`, `/software-factory/analysis/`, `/software-factory/methodology/`). Until then that one test
  fails in this stream and in the integration check, and nothing else does.
- Next: B1's `analysis/index.html` and `methodology/index.html`, then B2 styles.
- Status: working

## Loop settings

- session: 82a10d3b-810e-4c24-b979-d97ff9a1bfaf
- model: claude-opus-5-5
- effort: high
- workspace: software-factory-dashboard
- fork: 60c94760-e373-4bf5-a5a2-9c7a814f275d

## Loop until

Go on while a phase has a step that needs only your work. Stop with `done` when every Done-when row holds, or is
deferred by the timebox with its finding recorded. Stop with `blocked: ...` only for something that needs the
author or another stream, saying exactly what. Keep the last line of Progress a status: `working`, `done`, or
`blocked: ...`.
