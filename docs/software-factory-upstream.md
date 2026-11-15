# Software Factory: what the pages ask of in-the-loop

The Software Factory pages read [in-the-loop](https://github.com/pilifs/in-the-loop) and never write to it. This is
the list of what they can't measure from its published files yet, written for whoever changes in-the-loop. Each
request says what the page does today, what to publish, and what the page would then show.

The short form of this list is `blog/software-factory/config/requests.json`, which the methodology page shows under
"Not measured yet". Keep the two in step.

Nothing here blocks the pages. Until a request lands, its figure is left out or labelled, never estimated.

## What the pages read today

At one pinned commit of in-the-loop (`blog/software-factory/import.mjs`):

| File | Read for |
| --- | --- |
| `llm-dlc/traces/metrics.json` | Sessions, changes and what each change took; each session's `reported_usd` and the totals' `unattributed_usd` |
| `llm-dlc/index.json` | The session list |
| `llm-dlc/traces/<session>/metrics.json` | `calls` (with `thinking_tokens` and `uncached_usd`), `prompts`, `tools` and `commits` rows |
| `llm-dlc/traces/<session>/runs/<record>.md` | A feature loop's run: header, cycle lines, Ended line |
| `llm-dlc/loops/*.md` | Brief names only, to group loops into campaigns |
| `verification/results/index.json`, `verification/jobs/*.json` | Verification jobs |
| `examples/index.json`, `examples/tags.json` | The example catalog |
| `git log -M --numstat` and the tree, from a checkout | Lines added, removed and present, per commit |

Prompt text is read only to tell who sent a prompt. Tool labels and error text are never read.

## Requests, most useful first

### 1. Loops while they run

**Today.** The page shows finished, published runs. Its "Loops running now" panel says it is not connected. A
preview build fills it with made-up rows from `blog/software-factory/preview/running-loops.json`, labelled as an
example.

**Ask.** A small reporter on the machine the loops run on. `run-streams.sh` and `streams_status.py` already hold
this state for the tmux status bar. Publish it every minute or so as one JSON document, with an expiry:

```json
{
  "schema": "software-factory-runtime/v2",
  "observedAt": "2026-11-15T04:20:00Z",
  "expiresAt": "2026-11-15T04:25:00Z",
  "sourceRevision": "fbd1fa86…",
  "loops": [
    {
      "loop": "example-targets-positive",
      "campaign": "example-targets",
      "session": "…",
      "state": "active",
      "startedAt": "2026-11-15T03:10:00Z",
      "cycle": 7,
      "lastCommit": { "change": "qroonxrs", "at": "2026-11-15T04:08:00Z", "summary": "…" },
      "lastOutputAt": "2026-11-15T04:19:20Z",
      "spendUsd": 21.4
    }
  ],
  "queue": { "pending": 3, "running": 1 }
}
```

`state` is `active`, `waiting on jobs`, `blocked` or `stopped`. This extends the `runtime` record in
`blog/software-factory/schema.json`, whose `states` list has no cycle, commit or spend.

**Where to put it.** Not in git: a commit a minute is noise. An object in R2 beside the snapshots is enough. The
site's Pages Function would serve it at `/software-factory/data/runtime.json`. That route and its token are this
repo's work, once the reporter exists.

**Then.** The panel lists each loop with its cycle, last commit and time since its last output. Past `expiresAt`
the panel says the report is stale. It never shows a quiet loop as running.

### 2. Who sent each prompt

**Today.** A prompt's sender is read from the start of its text, against the templates in
`blog/software-factory/config/loops.json`: the loop harness, another agent, an interruption, or else a person. A
new harness template would count as a person until it is added there. This has already happened once: the four
fixed prompts the script sent from Oct 31 to Nov 4 were counted as a person's (46 prompts) until they were found in
the script's git history and listed. The page uses the same patterns to say who set off each tool call.

**Ask.** In each session's `metrics.json`, a field on every `prompts` row:

```json
{ "index": 12, "kind": "human", "origin": "loop", "origin_detail": "cycle" }
```

`origin` is one of `person`, `loop`, `agent`, `interrupt`, `command`, `notification`. `feature-loop.sh` knows which
prompts it sends, so it can mark them when it sends them.

**Then.** The page drops its text patterns. "Who set off the work" and "tool calls for each prompt a person typed"
stop depending on a list someone has to keep up. A slash command would also say who sent it: today the page can't
tell a person's `/compact` from the one `verification-loop.sh` sends, so it counts both as other.

### 3. Run records as data

> As of in-the-loop `e9908ab3` the source publishes `llm-dlc/traces/loops.json` (`llm-trace-loops/v1`): every loop,
> run and cycle, moonshots and the verification loop included, with time, jobs and cost. That answers this request.
> The importer reads its totals, categories, loops and runs (`overview.loopAccount`); the clock and each run's cycle
> lines still come from the markdown records.

**Today.** The importer parses the markdown record: the `Started` header, each `- cycle N, time, change: summary`
line with its `decided to continue` or `decided to stop`, and the last `Ended` or `Stopped` line. A change to the
record's wording would break it.

**Ask.** A JSON file beside each record, `runs/<record>.json`:

```json
{
  "schema": "feature-loop-run/v1",
  "loop": "foundations-heap",
  "campaign": "foundations",
  "brief": { "path": "llm-dlc/loops/foundations-heap.md", "sha256": "…" },
  "session": "…", "forkedFrom": "…",
  "model": "claude-opus-5-5", "effort": "high",
  "startedAt": "2026-11-07T04:01:19Z", "endedAt": "2026-11-07T12:21:16Z",
  "cycleLimit": null,
  "outcome": "done",
  "outcomeDetail": "the session decided the work was done",
  "cycles": [
    { "n": 1, "committedAt": "2026-11-07T04:15:59Z", "change": "uyqkxslyysrm…", "decision": "continue" }
  ]
}
```

`campaign` matters most. Today a loop's campaign is guessed from brief names, and `run-streams.sh` knows it.
`forkedFrom` would let the page draw the planning session a campaign's streams started from.

**Then.** No markdown parsing, and exact campaigns.

### 4. Code lines without a checkout

**Today.** Lines come from `git log --numstat` in a checkout. The publish workflow has one. A refresh from GitHub
alone has none, and its snapshot has no code section.

**Ask.** A generated table, written when the traces are, such as `llm-dlc/traces/code.json`:

```json
{
  "schema": "llm-trace-code/v1",
  "changes": [
    { "change_id": "…", "commit": "…", "committed": "…",
      "files": 12, "lines": { "rs": [310, 42], "py": [0, 0], "md": [25, 3], "other": [1200, 0] } }
  ],
  "tree": { "rs": 88439, "py": 40772 }
}
```

By file extension is enough. This repo classes extensions in `config/code.json`.

**Then.** The same code numbers whichever way a snapshot is made.

### 5. Rework by line age

**Today.** The importer runs `git blame -w -M` over every code file at the published revision, so the page shows
how much of each day's code, and of each change's, still stands. That takes a checkout and about six seconds. It
doesn't say when a line was replaced, or by which change: a line rewritten an hour later counts the same as one
retired weeks later.

**Ask.** Per change: how many code lines it replaced, and how old those lines were.

```json
{ "change_id": "…", "replaced": { "same_session": 40, "within_1d": 12, "within_7d": 3, "older": 0 },
  "replaced_from": ["<change id>", "…"] }
```

`same_session` separates an agent revising its own work in progress from later rework. Blame over the whole tree is
slow, so do it once per publish and only for files that changed.

**Then.** Rework as a rate over time and per campaign. The page could also say which loops' code was rewritten
soonest, and by which later loop.

### 6. What happened after a failed call

**Today.** Each tool call's outcome, and whether the next tool call in the same session succeeded: 404 of 427
failed calls were followed by one that did, and the longest run of failures was four calls. The trace doesn't link
a call to the one it retries, so the page can't say the next call was a retry.

**Ask.** On each failed row of `tools`: `retried` (the next call by the same agent ran the same tool or command
family within a minute) and `recovered` (that call succeeded). Also `error_class` for a refused call: `invalid_input`,
`blocked_pattern`, `not_read_first`, and so on. The error text has this, and the page never reads error text.

**Then.** The page can separate a slip the model recovers from in one step from one that derails a cycle. That
separation is what "model performance" should mean. It can also name the harness rules that refuse the most calls.
Today that shows up only as `sleep`: 42 of 117 calls refused.

### 7. What review changed

**Today.** Nothing. The traces don't record review, and in-the-loop's history has no pull request merges (0 of 719
commits at `fbd1fa86`), so GitHub has no pull request data to read.

**Ask.** Where a person or a review loop reviews a campaign: a record per finding with the change it was raised
against, its severity, and the change that answered it. `llm-dlc/reviewed-findings.json` and the briefs' for-review
lists hold some of this as prose.

**Then.** Findings per thousand lines, and time from finding to fix, per campaign.

## Smaller things

- **A session's loop in the index.** `llm-dlc/index.json` could name each session's loop and campaign, so the
  sessions table can link to them.
- **Commit times in the rollup.** `traces/metrics.json` lists changes without times. Per-session files have them.
  With times in the rollup, recorded changes become a daily series without a checkout.
- **Model display names.** `config/models.json` here maps raw ids to names by hand. A documented map in
  `llm-dlc/pricing.json` would be the source to cite.
- **Verdicts by claim in the examples index.** `examples/index.json` gives six examples with results no `verdict`:
  the label records one for each claim ("✗ unbounded on 2.7.17; ✓ bounded on 2.7.18"). The pages read the label's
  marks (✗, ✓, ⚠) to count them. A `verdicts` list on the entry, one per claim, would replace that.
- **Loops before 2026-11-06.** A one-off backfill of run records from the logs would extend the loops section back
  to the first loop.
