# Agent loops

How this repo is built by unattended Claude Code loops. The process and tools are copied from
[in-the-loop](https://github.com/pilifs/in-the-loop)'s `llm-dlc/`, which stays the reference. This copy leaves out the
session traces, Langfuse, redaction, the CDN and the verification queue, and keeps the loops and a lightweight
`sync.py`.

```
llm-dlc/
  README.md                  this file
  loops/                     briefs: markdown instructions a loop works through
  loops/brief-template.md    the skeleton of a brief, and the standing rules every brief starts with
  loop-summaries/            each run's record, and run-streams.sh's state (gitignored)
  tools/sync.py              commit, check and push with jj; test_sync.py tests it
  tools/feature-loop.sh      works through a brief unattended: instruction, commit, compact, repeat, then a summary
  tools/moonshot-loop.sh     repeats one open-ended instruction unattended, until a cycle makes no commit;
                             test_moonshot_loop.py tests it
  moonshots/                 the instructions moonshot-loop.sh repeats, one file each
  tools/run-streams.sh       runs a brief's parallel streams, each in a jj workspace, then the merge
  tools/loop-common.sh       what the two share: log lines and the live display of a session
  tools/streams_status.py    run-streams.sh's state and status bar; test_streams_status.py tests it
  tools/run_records.py       copies a stream's run records into the default workspace
  tools/site-integration.sh  the integration check for streams: install, build, test
  tools/prune_workspaces.py  lists jj workspaces no longer used, and whether deleting each loses nothing;
                             test_prune_workspaces.py tests it
  tools/screenshot.sh        desktop and mobile, light and dark screenshots of a page, in headless Chromium
                             (Playwright pinned, run with npx; --setup installs the browser)
```

## Set up

Once per clone:

```sh
python3 llm-dlc/tools/sync.py init
```

It colocates jj with git (the `.jj/` folder sits beside `.git/`), and makes `main` track `main@origin`. Git keeps
working for reading history. Commits are made with jj, because the loops identify each commit by its jj change id.

## Committing

Commit each feature as soon as it is finished and verified, without asking. A feature is the smallest change a
reviewer can understand on its own that leaves the site working.

```sh
jj status
python3 llm-dlc/tools/sync.py commit -m "Add the Factory overview" -m "What changed, why, and how it was verified."
```

Each `-m` is one paragraph. The first is the summary line: imperative, at most 72 characters. The command describes
`@`, starts a new empty change on top, and checks the commit it just made. An `ERROR` fails the command, but the commit
stands: fix it and commit the fix. A secret must be rewritten out before it is pushed. A `warn` is for a person to
judge. `sync.py check` checks every commit not pushed yet.

Don't run `git commit`: it bypasses the jj change ids the loops key on.

**Push only when the author asks:** `python3 llm-dlc/tools/sync.py push --bookmark main`. It refuses while `@` holds
uncommitted work, checks every unpushed commit, moves `main` to `@-` and runs `jj git push`. Deploying the site is a
separate step, with the same rule (AGENTS.md).

### Keeping another session's files out of a commit

Two sessions can share a working copy. If `jj st` shows files that belong to another session, move them into a change
of their own below yours, commit, then move them back on top:

```sh
jj split -r @ -m "wip: another session's files" PATH ...   # their files, now the parent of @
OTHER=$(jj log --no-graph -r @- -T change_id)
python3 llm-dlc/tools/sync.py commit -m "..." -m "..."
jj rebase -r "$OTHER" -A "$(jj log --no-graph -r @- -T change_id)"
jj squash --from "$OTHER" --into @ -u                       # their files uncommitted again, on top
```

## Unattended loops

[`tools/feature-loop.sh`](tools/feature-loop.sh) resumes one Claude Code session and works through a brief, a
markdown file in [`loops/`](loops/). Each cycle tells the session to read the brief again in full and take the next
piece of work it calls for, then commit it. The loop then compacts the session and starts the next cycle. Write a new
brief from [`loops/brief-template.md`](loops/brief-template.md).

```sh
llm-dlc/tools/feature-loop.sh factory              # llm-dlc/loops/factory.md
llm-dlc/tools/feature-loop.sh factory 5            # at most 5 cycles
llm-dlc/tools/feature-loop.sh factory 8 "Stop once the overview renders real data."
```

- **Stopping.** A number after the name caps the cycles. Instructions for when to stop come from the command line or
  the brief's `## Loop until`. When there are any, the session gets one more turn after each commit to weigh them, and
  it ends that reply with `LOOP: continue` or `LOOP: stop`. A cycle that makes no commit stops the loop and leaves the
  session uncompacted, so a person can read why.
- **Status.** Each brief ends its Progress with `- Status: working`, `done` or `blocked: ...`. If the session decides
  to stop while the status still says working, it gets one more turn to record why.
- **Fixed brief.** A brief is fixed for the run. Editing it outside `## Progress` stops the loop at the next cycle.
- **Continuing.** Run the same command again. The brief's Loop settings fix the session, and its Progress says what is
  done. Each cycle first finishes a change an interrupted cycle left in the working copy.
- **Settings.** A brief can set `- session:`, `- model:` (default `claude-opus-5-5`), `- effort:` (default `high`)
  and `- memory:` (default `4G`) under `## Loop settings`. `FEATURE_LOOP_SESSION`, `FEATURE_LOOP_MODEL`,
  `FEATURE_LOOP_EFFORT` and `FEATURE_LOOP_MEMORY_MAX` override them. A brief with no session gets a fresh one for the
  run, and the loop prints its id.
- **Memory cap.** The loop runs in the systemd scope `feature-loop-NAME.scope` under that memory cap, so a runaway
  process is killed alone. A loop won't start if its scope is still active, or if less memory is free than its cap.
- **Run record.** Each run writes one to `llm-dlc/loop-summaries/`: the instruction, a line per commit as it lands,
  how the run ended, and the session's own summary of the run.
- **Limits.** The loop commits locally, never pushes or deploys, and has no spending limit.

While it runs, it reads commands typed in its terminal:

| Command | Effect |
| --- | --- |
| `+N`, `-N` | run N more or N fewer cycles after the current one (`+` and `-` alone mean 1) |
| `=N`, `N` | run exactly N more cycles after the current one |
| `0`, `stop` | end after the current cycle |
| `inf` | no limit |
| `?`, `help` | where the loop stands, or the list of commands |

### Moonshots

A brief lists steps and says when it is done. A moonshot is a goal with no end: one instruction, given again every
cycle. [`tools/moonshot-loop.sh`](tools/moonshot-loop.sh) is the simple loop for it, after the moonshots of
in-the-loop's `llm-dlc`.

```sh
llm-dlc/tools/moonshot-loop.sh software-factory-impact       # llm-dlc/moonshots/software-factory-impact.md
llm-dlc/tools/moonshot-loop.sh software-factory-impact 5     # at most 5 cycles
```

- **The instruction** is the whole of `llm-dlc/moonshots/NAME.md`, word for word. The loop adds one paragraph after
  it: take one improvement, verify it, commit it with `sync.py`, never push or deploy, and end without a commit when
  the author is needed.
- **No commit stops the loop.** A cycle that ends without a new commit may mean the work isn't finished or a person
  is needed. The loop exits with status 1 and leaves the session as it is, to be read with `claude --resume`.
- **Compact only when large.** After a commit, if the session ended the cycle above 400,000 tokens of context, the
  loop compacts it and then gives the instruction again. A smaller session gets the instruction again as it is.
  The size is the tokens of the main conversation's last request; a size that can't be read counts as too large.
  `MOONSHOT_COMPACT_ABOVE` changes the 400,000.
- **One session.** Its id is kept in `llm-dlc/loop-summaries/moonshot-NAME.session`, so the same command continues
  it. The first run starts a fresh session, or continues the one `MOONSHOT_SESSION` names. `MOONSHOT_MODEL` and
  `MOONSHOT_EFFORT` set the model and effort; without them the session runs on Claude Code's own defaults.
- **Record.** Each run writes one to `llm-dlc/loop-summaries/`: the instruction, a line per commit, and how it ended.
- **Limits.** It commits locally and never pushes or deploys. Unlike `feature-loop.sh` it has no memory cap, no
  commands while it runs and no closing summary, and like it no spending limit. Ctrl-C stops it.

### Parallel streams

Loops can run in parallel on separate branches, each in its own
[jj workspace](https://jj-vcs.github.io/jj/latest/working-copy/#workspaces): a directory with its own working copy,
sharing the repository. A brief that sets `- workspace: NAME` runs only from that workspace's copy of the script, so
its commits can't land on another branch. A brief that sets `- fork: SESSION` starts its session, the first time, as a
fork of that one, so every stream begins from the conversation that planned them.

[`tools/run-streams.sh`](tools/run-streams.sh) `NAME` runs a brief's whole loop from the default workspace, in one
terminal. The brief's Loop settings list its streams (`- streams: data dashboard editorial`), and each stream has its
own brief, `loops/NAME-STREAM.md`. The script:

1. compacts the planning session once;
2. adds the workspaces next to the repo (`../Terminal-Value-NAME-STREAM`);
3. runs every stream's loop side by side, each line prefixed with its loop;
4. once every stream is done or blocked, runs the main brief's own loop here, which merges them.

Inside tmux it also keeps a status bar: the run's age and spend, the integration check's last result, and per loop its
cycle, commits, spend, status and time since its last output. With `- integration: llm-dlc/tools/site-integration.sh`
in the main brief, it builds and tests a merge of every stream's latest commit while they run (at most hourly), in a
workspace of its own. The report goes to `llm-dlc/loop-summaries/NAME-integration.md`, which the streams read. Ctrl-C
stops everything. Running it again continues.

[`loops/brief-template.md`](loops/brief-template.md#streams) describes how to split a brief into streams and the merge
steps. After a run, `python3 llm-dlc/tools/prune_workspaces.py` lists the workspaces no longer used. It checks that
deleting each loses nothing, and prints the delete command for a person to run.
