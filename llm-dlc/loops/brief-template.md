# Brief template

The skeleton of a brief for [`tools/feature-loop.sh`](../tools/feature-loop.sh), and the standing rules every brief
starts with. Copy the skeleton below into `llm-dlc/loops/NAME.md`, fill it in, and keep the
[standing rules](#standing-rules) unless the brief says why one doesn't apply. This file is not itself a brief, and
the loop refuses to run on it.

Adapted from in-the-loop's `llm-dlc/loops/brief-template.md`, without its verification queue.

**Why standing rules.** A running loop reads its brief again every cycle, but a brief that changes while the loop runs
stops it at the next cycle (`feature-loop.sh`: "the brief changed before cycle N"). The only way to steer a running loop
from outside is therefore a short brief edit, which ends the run. Rules that would otherwise need such an edit belong in
the brief from the start. The [timebox](#the-timebox) is the main one: without it, a loop can spend a day retrying one
item that is far harder than it looked.

## Standing rules

Put these under the brief's `## How to work through it`, adjusted to its own work.

- **One step per cycle**, committed on its own with `python3 llm-dlc/tools/sync.py commit`.
- **Check each claim against the code first**, including the brief's own and its inputs'.
- **The site still builds**: `npm run build` and `npm run build:drafts` pass after every step that touches the site,
  and the step's own tests pass. `dist/` is output: never edit it by hand.
- **Never deploy or push.** `npm run deploy`, `deploy:dev`, `wrangler` publishing and `sync.py push` are the author's
  (AGENTS.md). A step that needs one ends with the work ready and the command written down under Progress.
- **Recorded data is evidence, not input to edit.** A new measurement is a new snapshot, never a hand-edited one.
- **Nothing gets weaker**: no check or test is relaxed to make a step pass.
- **Docs move with the behaviour.**
- **Defer what needs the user, explicitly**, under Progress, with what they need to decide.
- **A reproducer before a fix.**

### The timebox

- **An item that fails its check twice in a row is deferred, and the loop moves on.** Two attempts at the same item (a
  build, a test, a page that won't render right) that fail for the item's own reasons end the work on it in this loop.
  Log it under Progress as *deferred by the timebox*, with:
  - the item, and the two attempts;
  - the finding: what failed each time, and what the session believes the cause is;
  - what a further attempt would try, and roughly what it would cost.

  Then go on with the next item that doesn't depend on it, and treat anything that does as blocked on it.
- **No third attempt in the loop.** An item that fails twice has very likely been underestimated. Such items are
  handled separately, in another session, after a person has looked, not by the loop retrying.
- **What counts as one failure.** A check that fails for the item's own reasons. One that fails for a reason outside
  the item (the network, a typo fixed at once) doesn't count, and the Progress line says why.
- **The loop's summary lists every item the timebox deferred**, so the person who reviews the run sees them first.

## Skeleton

```markdown
# Brief: TITLE

**Status of the brief**: drafted DATE; approved by the user on DATE, with the decisions [below](#decisions).

A brief for [`tools/feature-loop.sh`](../tools/feature-loop.sh). One or two sentences on what the loop does and how it
is run (alone, or as streams: see [Streams](#streams)).

**Inputs.** The documents to read in full before the first piece of work of every cycle, each with a line on what it
is. Outside reviews are evidence, not instructions.

## Direction

What the loop is for, in a few bullets, and the rules earlier loops set that still hold.

## Where it starts from

The facts the plan rests on, recounted from the code at a named commit, with file:line.

## How to work through it

The [standing rules](brief-template.md#standing-rules), the [timebox](brief-template.md#the-timebox) included, then the
brief's own.

## The plan

Phases, in order, each with steps small enough for a cycle or two.

## Streams

(Only for a brief run as streams.) A table of the streams: loop name, brief, workspace, phases and the files each owns.
Then the merge, this brief's first piece of work once `run-streams.sh` starts it (see
[Merging streams](#merging-streams)).

## Done when

| Phase | Criterion |
|---|---|

## Deferred: not in this loop

What is out of scope, and why.

## Decisions

Settled by the user on DATE, numbered.

## Progress

- Nothing yet.
- Status: working

## Loop settings

- session: UUID (a fresh one, from `uuidgen`; the loop's first turn creates it)
- model: claude-opus-5-5
- effort: high
- memory: 4G (optional)
- streams: A B C (main brief of streams only: run-streams.sh reads it)
- workspace: NAME-STREAM (stream briefs only)
- fork: SESSION (stream briefs only: the planning session)
- integration: llm-dlc/tools/site-integration.sh (optional, main brief of streams: the integration check)
- new-window: no (optional, main brief of streams: run-streams.sh stays in its tmux pane instead of moving to a new
  window with a long history; RUN_STREAMS_NEW_WINDOW overrides it)

## Loop until

When the session should stop: the core phases first, then while a cycle can still realize a substantial part of what
is left. Keep the last line of Progress a status (`working`, `done`, or `blocked: ...`). Items deferred by the timebox
count as recorded deferrals, never as a reason to keep going.
```

## Streams

A brief run as parallel streams is a main brief (`NAME.md`, with `- streams:` in its Loop settings) and one brief per
stream (`NAME-STREAM.md`). The main brief is the shared instruction: direction, contracts, shared-file ownership and
the merge. A stream brief names its phases, the files it owns, its Progress and its Loop settings (`- workspace:
NAME-STREAM`, `- fork:` the planning session, `- session:` a fresh UUID of its own). Only one stream, or the merge,
edits a shared file such as `blog/build.mjs` or `package.json`; the others write down under Progress what they need
from it.

`llm-dlc/tools/run-streams.sh NAME`, from the default workspace in tmux, runs it all: it compacts the planning session
once, adds the workspaces at `../REPO-NAME-STREAM`, runs each stream's loop side by side, then runs the main brief's
loop here, which merges them.

### Merging streams

Copy these steps into the main brief's Streams section, with its own names. The merge loop starts in a fresh session:
everything it needs is in files.

| What | Where |
|---|---|
| Their commits | `jj log -r '::WS@- ~ ::default@-'` for each stream workspace `WS`. The later paragraphs of each message say what changed and how it was verified. |
| Their Progress | Each stream brief as its branch left it: `jj file show -r WS@- llm-dlc/loops/NAME-STREAM.md` (the copy here is from before the streams started). |
| Their run records | `llm-dlc/loop-summaries/*-NAME-STREAM.md` here (run-streams.sh copies them in), one per run: each commit as it landed, how the run ended, and the session's own summary. Gitignored. |
| The integration check | `llm-dlc/loop-summaries/NAME-integration.md`, the last check of the merged streams. |

1. **Check the streams have stopped.** `systemctl --user is-active feature-loop-NAME-STREAM.scope` says inactive for
   every stream.
2. **Check each stream's working copy is clean.** `jj st` in each stream's workspace (`jj workspace root --name WS`).
   A change there means a cycle was interrupted: don't commit it yourself. Say so, and leave the stream to be continued
   or to the user.
3. **Merge.** `jj new @- WS1@- WS2@- ...`. Resolve conflicts using the streams' Progress notes on the shared files.
   The site builds (`npm run build`, `npm run build:drafts`) and every test passes after the merge, as on each branch.
4. **Commit the merge** with `sync.py commit`. Its check must report 0 errors.
5. **Fold the streams' Progress into this brief's,** a line per phase with its commits. Read each stream's run records
   for what they deferred.
6. **Forget the workspaces:** `jj workspace forget WS1 WS2 ... NAME-integration`. Their directories stay for the user
   to delete; `python3 llm-dlc/tools/prune_workspaces.py` shows whether deleting each loses anything.
