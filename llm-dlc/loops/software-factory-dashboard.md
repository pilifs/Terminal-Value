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
  asserts the sitemap is exactly `['/software-factory/']`. Now that the analysis and methodology pages exist (cycle
  2), `index.mjs` lists all three and that frozen test fails. Asked of the merge: assert the three URLs
  (`/software-factory/`, `/software-factory/analysis/`, `/software-factory/methodology/`). Until then that one test
  fails in this stream and in the integration check, and nothing else does.
- **B1, analysis and methodology** (cycle 2): `renderPages` returns all three pages. B1 is done.
  - `analysis/index.html`: every post in `posts.items` in selectPosts' order (newest first), the featured one
    marked, with cover, title, byline (only with an author), date and description; `posts.related` in a separate
    "Related background" panel that says it isn't Filip's analysis; the empty state links the overview. It shows
    no data, so no fixture banner and no unavailable variant.
  - `methodology/index.html`: source and freshness (repository and SHA, snapshot id and input count, data as of,
    published, last source check and its outcome, generator, metric-definition version and hash, pricing date,
    timezone and the interval rule), coverage per manifest dataset (Toronto days or snapshot total, coverage,
    metrics it feeds), every metric's definition, coverage, notes, kind and filter scope from
    `config/metrics.json`, the separate figures, the area mapping from `config/areas.json` with its status and
    Unassigned, and comparison limits. No snapshot: an unavailable notice, the definitions kept. Fixture banner.
  - The separate figures (`reported_usd`, `unattributed_usd`, `uncached_usd`) are described but have no values:
    no snapshot file carries them (overview and sessions don't). If the data stream adds them, show them here.
  - Shared footer navigation on the two new pages (Overview · Analysis · Methodology, the current one marked).
  - Tests: `test/render-pages.test.mjs` (11): three pages, no "Live", no "Factory" alone, analysis order,
    featured, bylines, related apart, empty state with and without data, methodology definitions, provenance,
    coverage table, areas and limits, unavailable, fixture banner, escaping. 52 tests, 51 pass; the one failure is
    the frozen sitemap assertion above. Production build byte-identical (85 files); drafts build renders the
    three pages from the example and from no snapshot.
- **B2, styles** (cycle 3): `blog/assets/software-factory/style.css`, 17.1 KB (3.7 KB gzip). B2 is done.
  - Every rule is under `body.software-factory`. The section overrides the site's own tokens there, so its header
    and footer follow the palette. The pages are 72rem wide on a pale surface (`#f6f8f6`, dark `#0f130f`) with white
    panels (dark `#161b16`). Text is the system font with tabular numbers.
  - Green accents: bars `#0ca30c` (dark `#2ea043`), links `#008300` (dark `#5cc85c`). The dataviz validator passes
    both bar greens against their surfaces, and the text contrast is at least 4.6:1.
  - Charts and tables: hairline grids, 8px radii and thin borders. The measure control is a segmented radio group;
    its checked option is bold and outlined, not only coloured, and it has a visible focus ring. Focus is a 2px
    green outline. Numbers sit to the right in data tables and breakdowns; share bars are `aria-hidden`.
  - Widths: four metrics a row on desktop, two on a tablet, one on a phone. Breakdowns and the post list use
    `auto-fit` grids clamped with `min(…, 100%)`. Wide text tables (coverage, areas) keep a 40rem minimum and scroll
    inside their panel. Long SHAs and paths break anywhere. Forced-colors mode draws the bars in `CanvasText`.
  - The chart's tick text is in viewBox units, so it grows and shrinks with the SVG. Six width ranges set its size
    so it shows at about 10–13px; at first it was 20px on desktop and 8px on a phone.
  - The overview's footer is now the shared section navigation (Overview · Analysis · Methodology).
  - Checked in screenshots (desktop and mobile, light and dark): the example overview, the methodology page and
    the empty analysis page. The full review of every state is B5.
  - Test: `test/render-style.test.mjs` (2): every selector is scoped, and there is a dark scheme and a phone
    layout. 54 tests, 53 pass; the one failure is the frozen sitemap assertion above. The production build is
    byte-identical (85 files). The drafts build links `style.css` only on the three section pages.
  - For stream A: the coverage note on "Recorded changes by area" reads as "6 of 64 area mapping accepted".
    `formatCoverage` joins `included of total` and the note, so a note that isn't a noun phrase ("changes in a
    mapped area") reads badly.
- **B3, client module** (cycle 4): `app.js` and its pure modules in `blog/assets/software-factory/`. B3 is done.
  - Modules: `state.js` (URL state: parse, serialize, fit to a snapshot, the view in words), `snapshot.js` (loading,
    checks and fallback), `poll.js` (the poller, with its clock and visibility passed in), `view.js` (pieces drawn
    by both the build and the browser) and `details.js` (the exploration's tables). `measures-local.js` gains
    `usageBreakdown`, which recomputes the by-model and by-effort breakdowns for a view; A's module has no
    breakdowns, so it stays after the merge. `app.js` only reads and writes the page.
  - Controls: date range (all time, last 7 or 30 days, ending on the snapshot's last day), model and effort
    selects, the chart's measure, and "Link to this view". The URL is canonical (`?period=7d&model=…`, defaults
    left out, unknown values dropped). Each change is a `pushState`, and back and forward redraw the view.
    Focus stays on the control the reader used.
  - Filter reach: each summary metric's scope line names the period and filters it follows, and the ones that
    don't apply ("Last 7 days · jobs · the model filter doesn't apply"). The chart caption does the same. The two
    usage breakdowns follow the view, tagged with what they follow. Snapshot breakdowns, stocks ("no filter
    applies"), observations ("the filters don't change them") and the exploration say the filters don't reach
    them. The unfiltered view shows the snapshot's own all-time values, as the static page does.
  - Data: `firstSnapshot` tries `/software-factory/data/`, and on a 404, an HTML answer, an HTTP or network error,
    a timeout (8 s) or any failed check loads the bundled snapshot, whole. The checks: pointer, manifest and
    overview structure, one snapshot id throughout, and each file's bytes and SHA-256 against its manifest
    (SubtleCrypto). The full schema check stays in `validate.mjs`, because `schema.json` isn't public.
  - Polling: every 45 s while the tab is visible. It sends `If-None-Match`, and fetches the manifest and overview
    only for a new snapshot id. A new check or a hidden tab aborts the request in flight. Errors keep the view.
    It polls the remote pointer unless that route was missing; otherwise the bundled pointer, which changes on a
    redeploy. A newer snapshot is announced in a live region with its count ("New data published (as of …): 6
    more recorded changes.") and a "Show the new data" button. Nothing changes until the reader clicks; then
    the filters are kept and open details reload from the new snapshot. A new source check of the same snapshot
    only updates the quiet freshness line.
  - Lazy details: a `details/*.json` loads when its panel is first opened, from the snapshot's own base, checked
    against the manifest. It shows 20 rows, then "Show all" (focus moves to the count line). A failed load says
    so and offers "Try again"; it is never replaced with other data.
  - `render.mjs` now draws the metric scopes, chart caption, breakdown rows and tags, observations, freshness,
    stocks and exploration caption with `view.js`, and carries the hooks `app.js` updates (`data-sf-freshness`,
    `data-sf-insights`, `data-breakdown` with `data-rows`, `data-tag` and `data-coverage`, `data-stock`,
    `data-sf-source`, `data-count`, `data-json`). The page without a snapshot has no `data-snapshot`, so
    `app.js` leaves it static.
  - Tests: `client-state` (6: the round trip of all 180 states, canonical links, unknown values, periods, the
    sentence), `client-snapshot` (11: remote whole; fallback on 404, HTML, 503 and network failure; six refused
    tampered remotes with nothing of them used; neither loadable; the first visit with filters on the fallback;
    abort; the client refusing what `validate.mjs` refuses; conditional polling; details from their own base;
    the announcement), `client-poll` (5) and `client-view` (5: labels against config, breakdowns against the
    snapshot's, filter reach, the detail tables and their escaping). 81 tests, 80 pass; the one failure is the
    frozen sitemap assertion above.
  - In headless Chromium (Playwright) on the example:
    - a first visit with `?period=7d&model=claude-opus-5-5&measure=model_calls` fell back to the bundled data
      with those filters;
    - filters, the measure (by arrow keys too), back and forward worked;
    - all four details loaded on opening;
    - a simulated new snapshot was announced with focus left on a select, and applied on the click with the
      filters kept;
    - no horizontal overflow at 390px with every detail open.
    The browser logs the remote route's 404 while no Function serves it; that is expected.
  - Production build byte-identical (85 files). The drafts build is made from the example and from no snapshot.
  - Sizes, gzip -9: `index.html` 5.0 KB, `style.css` 3.9 KB, `app.js` 4.2 KB. All nine client modules come to
    18.8 KB gzipped, unbundled ES modules up to three imports deep.
  - For the merge: with A's `measures.mjs`, `app.js` imports `computeMeasures` from `./measures.js` (the copy
    `index.mjs` makes) and keeps `trend` and `usageBreakdown` from `measures-local.js`. Optional, for the
    coordinator: `<link rel="modulepreload">` for the modules in `layout()` would save the import round trips.
- **B4, tests** (cycle 5): checked against the brief's list; B4 is done. Numbers in the static HTML, no "Live",
  stock and period labels ("Snapshot total" apart, "All time ·" on all four metrics), the four states (no snapshot,
  fixture, no posts, escaping), a populated analysis list from made-up `postSummary` records (overview and analysis
  page) and escaping were already covered in `render-overview` and `render-pages`; the client list (URL round trip,
  first-visit fallback with filters, refusing an invalid snapshot) in `client-state` and `client-snapshot`.
  - Gap filled: a test that ids and paths from data are escaped inside attributes (a breakdown id, an insight's
    evidence, a collection path, the source SHA and the snapshot id, each with a quote).
  - Hardening: the `datetime` attributes in `chart.js`, `view.js` and `render.mjs` now escape their day too. A
    malformed day can't be tested through the page: date formatting throws on it at build time, and
    `validate.mjs` refuses it first.
  - 82 tests, 81 pass; the one failure is the frozen sitemap assertion above. Production build byte-identical
    (85 files); the drafts build is made from the example and from no snapshot.
- **B5, review** (cycle 6): every page in each state shot at 1280×900 and 390×844 in light and dark with
  `llm-dlc/tools/screenshot.sh` (shots in `/tmp/sf-b5/`), looked at, fixed and shot again. B5 is done.
  - Shot: the example overview (default, and `?period=7d&model=claude-opus-5-5&measure=model_calls`), the
    overview and the analysis page with posts, the empty analysis page, methodology with data, and all three
    pages with no snapshot. `selectPosts` is still the Phase 0 placeholder, so the populated states came from a
    scratch script (`/tmp/sf-b5/populate.mjs`): it renders `renderPages` with made-up `postSummary` records into
    the built page under `dist/`. No repo post.
  - Fixed:
    - On a phone the trend chart was a 100px strip with the first day label running into "$0". The chart now has
      two shapes from `chartSvg`, wide (640×220) and compact (360×240, four day labels), and CSS shows the compact
      one under 30rem. The other is `display: none`, so out of the accessibility tree; each has its own ids.
    - Long breakdown labels ("Apache Commons Numbers") wrapped to three lines. Breakdowns are now two columns on
      desktop (22rem minimum), and on a phone the share bar and cell padding are narrower.
    - In the archive, the featured post had a double rule and was marked only by size. It now says "Featured" in
      its meta line (overview too) and shares the list's rules.
    - "Figures kept separate" ran into the last metric's table on the methodology page: now a ruled block.
    - The coverage and areas tables scroll sideways on a phone with no sign of more columns. They now show an edge
      shadow on the side with more, and the scroll region takes focus with a name (the exploration's tables too).
    - With no snapshot, the overview said "Showing all time, all models and efforts" about data it doesn't
      have. The view line and controls render only with a snapshot.
    - Chart ticks: a count of 1 got ticks 0, 0.5, 1, printed "0, 1, 1"; counts now step by whole units. Money
      ticks were "$5.0" beside "$10"; now "$5", "$10", and "$2.50" or "$0.01" only where needed.
  - Checked in headless Chromium (Playwright): no horizontal overflow at 320 and 390px, light and dark, on all
    five pages, with every detail open on the overview; a filter change redraws the compact chart (7 days).
  - Sizes, gzip -9, drafts build on the example: `index.html` 5.5 KB (26.8 KB raw; the compact chart added about
    0.4 KB), `style.css` 4.4 KB, `app.js` 4.2 KB, `analysis/index.html` 1.0 KB, `methodology/index.html` 4.9 KB.
    The nine client modules come to 22.4 KB gzipped. Cycle 4's 18.8 KB was wrong: the same nine measured 21.9 KB
    at that revision.
  - Tests: 82, 81 pass; the one failure is the frozen sitemap assertion above. Production build byte-identical
    (85 files). The drafts build is made from the example (with the compact chart) and from no snapshot (no
    `data-snapshot`, no controls).
- For the coordinator, beyond the notes above: the frozen `config/metrics.json` note on the median duration says
  "factory wall time", which the methodology page shows. It is a plain word, not the name; change it at the
  merge if the "Software Factory" rule is meant to cover it.
- Status: done

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
