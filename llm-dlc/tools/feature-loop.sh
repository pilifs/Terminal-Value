#!/usr/bin/env bash
# Work through a brief unattended.
#
# Copied from in-the-loop's llm-dlc/tools/feature-loop.sh, without its traces and
# verification queue. Each cycle resumes one Claude Code session and runs:
# instruction, commit, compact. A cycle that leaves no new commit stops the
# loop, before compacting, so the session keeps its full context for the person
# who has to look at why.
#
# The loop re-executes itself in a systemd scope with a memory cap, so a build or
# test that runs away is killed alone and cannot exhaust the machine.
#
# Usage: [FEATURE_LOOP_MEMORY_MAX=4G] llm-dlc/tools/feature-loop.sh BRIEF [CYCLES] [UNTIL]
#
#   BRIEF     NAME for the brief llm-dlc/loops/NAME.md (factory, factory-data, ...),
#             or the path of a brief in a markdown file. A brief has a
#             "## Progress" section; brief-template.md is not one.
#   CYCLES    how many cycles to run at most; without it there is no limit
#   UNTIL     instructions the session weighs after each commit to decide whether
#             the loop goes on; a second argument that isn't a count is UNTIL
#
# Each loop runs in a systemd scope of its own name, feature-loop-NAME.scope.
#
# A stopped loop is continued by running the same command again: the brief fixes
# the session, its Progress section says what is done, and each cycle first
# finishes a change an interrupted cycle left in the working copy, keeping any
# other session's uncommitted files out of its commit.
#
# A brief is fixed for the run: each cycle tells the session to read it again in
# full, so it outlives every compact, and a brief that changes while the loop
# runs stops it. Its "## Progress" section is the exception: the session keeps it
# current, in the commit that does the work, and edits there don't count as a
# change. Without UNTIL, a brief's own "## Loop until" section is UNTIL,
# and with neither, nor CYCLES, the loop runs until the session decides the
# brief is done.
#
# A brief may also set the session, model and effort in a "## Loop settings"
# section of "- session: ID", "- model: ID" and "- effort: LEVEL" lines, the
# memory cap with "- memory: SIZE", and with "- workspace: NAME" the jj workspace
# it must run in, so loops run in parallel each on their own branch (see
# llm-dlc/README.md). "- fork: SESSION" starts the brief's session, when it has
# no transcript yet, as a fork of that one, so parallel streams all begin from
# the conversation that planned them. FEATURE_LOOP_SESSION, FEATURE_LOOP_MODEL,
# FEATURE_LOOP_EFFORT and FEATURE_LOOP_MEMORY_MAX override both the brief and
# the defaults. A brief with no session, or FEATURE_LOOP_SESSION=new, starts a
# fresh session that the run's cycles share, and a session id with no
# transcript yet (one opened but never sent a message) is created by the first
# turn.
#
# With UNTIL, each commit is followed by one more turn, before the compact, in
# which the session applies UNTIL to what it has done and ends its reply with
# "LOOP: continue" or "LOOP: stop". A stop ends the loop after that cycle like
# running out of cycles does; a reply with neither stops it as needing attention.
# A brief whose Progress ends with a "- Status:" line (see run-streams.sh) has the
# cycle keep it current. If the session decides to stop while it still says
# working, one more turn, before the compact, sets the status that says why
# (done or blocked) and commits it; the decision turn itself can't, since it
# only decides. A status still working after that turn ends the loop as needing
# attention.
#
# While it runs, the number of cycles left can be changed by typing in its
# terminal (see HELP below): +N, -N, =N, inf, or 0 or stop to end after the
# cycle under way. A cycle always finishes, commit and compact included.
#
# Each run keeps a log in llm-dlc/loop-summaries/ (gitignored, never pushed): a
# line per commit as it lands, so it survives a restart, and when the cycles run
# out the session's own summary of the run, written for the person reading it.
#
# Exits 0 when the cycles run out or the session decides to stop, 1 when a cycle
# made no commit, the session's decision was unclear, a stop left the brief's
# status working, the brief changed or the scope cannot start, 2 for a bad argument, and 130 if interrupted.

set -uo pipefail

SESSION_ID=new
MODEL=claude-opus-5-5
EFFORT=high
MEMORY_MAX=4G
WORKSPACE=
FORK_FROM=

usage() {
  echo "usage: feature-loop.sh NAME|FILE.md [CYCLES] [UNTIL]   (NAME: a brief in llm-dlc/loops/)" >&2
  exit 2
}

(( $# >= 1 && $# <= 3 )) || usage
PROMPT=$1
CYCLES=inf
UNTIL=
is_count() { [[ "$1" == inf || "$1" =~ ^[1-9][0-9]*$ ]]; }
if (( $# == 3 )); then
  is_count "$2" && [[ -n "$3" ]] || usage
  CYCLES=$2 UNTIL=$3
elif (( $# == 2 )); then
  if is_count "$2"; then CYCLES=$2; else UNTIL=$2; fi
fi
[[ -z "$UNTIL" || -n "${UNTIL//[[:space:]]/}" ]] || usage
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd) || exit 1

# A name is a brief in llm-dlc/loops/. Found in this script's repo first, then
# from the caller's directory, and named relative to the repo when it is inside
# it, which is where the loop runs. The repo comes first because run-streams.sh
# starts each stream's copy from the default workspace: found from there, a
# stream's brief would be the default workspace's copy, whose Progress no stream
# edits.
[[ "$PROMPT" == *.md ]] || PROMPT=llm-dlc/loops/$PROMPT.md
if [[ "$PROMPT" != /* && -f "$ROOT/$PROMPT" ]]; then
  BRIEF=$(realpath "$ROOT/$PROMPT")
elif [[ -f "$PROMPT" ]]; then
  BRIEF=$(realpath "$PROMPT")
else
  echo "feature-loop.sh: no brief at $PROMPT" >&2
  exit 2
fi
if [[ "$(basename "$BRIEF")" == brief-template.md ]]; then
  echo "feature-loop.sh: brief-template.md is the template, not a brief: copy its skeleton into llm-dlc/loops/NAME.md" >&2
  exit 2
elif ! grep -qE '^## +Progress[[:space:]]*$' "$BRIEF"; then
  echo "feature-loop.sh: $BRIEF is not a brief: it has no '## Progress' section (see llm-dlc/loops/brief-template.md)" >&2
  exit 2
fi
# Without UNTIL, the text under the brief's "## Loop until" heading, up to the
# next heading, on one line.
if [[ -z "$UNTIL" ]]; then
  UNTIL=$(awk '/^## / { inside = ($0 ~ /^## +Loop until[[:space:]]*$/); next } inside' "$BRIEF" |
    tr '\n' ' ' | sed 's/  */ /g; s/^ //; s/ $//')
fi
# "- key: value" lines under the brief's "## Loop settings" heading.
setting() {
  awk -v key="$1" '
    /^## / { inside = ($0 ~ /^## +Loop settings[[:space:]]*$/); next }
    inside && match($0, "^[-*] +" key ": *") { v = substr($0, RLENGTH + 1); gsub(/[`[:space:]]/, "", v); print v; exit }
  ' "$BRIEF"
}
v=$(setting session); [[ -n "$v" ]] && SESSION_ID=$v
v=$(setting model); [[ -n "$v" ]] && MODEL=$v
v=$(setting effort); [[ -n "$v" ]] && EFFORT=$v
v=$(setting memory); [[ -n "$v" ]] && MEMORY_MAX=$v
WORKSPACE=$(setting workspace)
FORK_FROM=$(setting fork)
[[ "$BRIEF" == "$ROOT"/* ]] && BRIEF=${BRIEF#"$ROOT"/}
set -- "$BRIEF" "${@:2}"
PROMPT=$(basename "$BRIEF" .md)
if [[ -z "$UNTIL" && "$CYCLES" == inf ]]; then
  UNTIL="Stop when everything the brief in $BRIEF asks for is done, or when what is left needs a person's decision first."
fi

SESSION_ID=${FEATURE_LOOP_SESSION:-$SESSION_ID}
MODEL=${FEATURE_LOOP_MODEL:-$MODEL}
EFFORT=${FEATURE_LOOP_EFFORT:-$EFFORT}
MEMORY_MAX=${FEATURE_LOOP_MEMORY_MAX:-$MEMORY_MAX}
SCOPE=feature-loop-$PROMPT
[[ "$SESSION_ID" == new || "$SESSION_ID" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]] || {
  echo "feature-loop.sh: not a session id: $SESSION_ID" >&2
  exit 2
}

# Claude Code files a session under the directory it ran in, and the instruction
# is meant for the root of the repo, so run there whatever the caller's directory.
cd "$ROOT" || exit 1

# log and show_progress
source llm-dlc/tools/loop-common.sh

# The loop finds its commits by jj change id: it needs the repo colocated with jj.
if ! jj root --ignore-working-copy >/dev/null 2>&1; then
  log "this repo has no jj yet: run python3 llm-dlc/tools/sync.py init"
  exit 2
fi

# A brief for a stream of parallel work names its jj workspace: run anywhere else,
# its commits would land on another stream's branch. The script runs from the
# workspace it is in, so this is the copy under that workspace's directory.
if [[ -n "$WORKSPACE" ]]; then
  wanted=$(jj workspace root --ignore-working-copy --name "$WORKSPACE" 2>/dev/null)
  if [[ -z "$wanted" ]]; then
    log "the brief $BRIEF runs in jj workspace $WORKSPACE, which doesn't exist; see llm-dlc/README.md for adding it"
    exit 2
  elif [[ "$(realpath "$wanted")" != "$ROOT" ]]; then
    log "the brief $BRIEF runs in jj workspace $WORKSPACE, not in $ROOT"
    log "run it as: $wanted/llm-dlc/tools/feature-loop.sh $1"
    exit 2
  fi
fi

# The loop moves to a systemd scope of its own, so an out-of-memory kill takes
# only what is in it. Everything it starts inherits the cap, including node,
# wrangler and any dev server. OOMPolicy=continue matters: under the default,
# systemd stops the scope on the first kill, and claude dies with the build
# instead of seeing it fail. Without swap the cap is exact, and a process over it
# is killed rather than left thrashing.
contain() {
  grep -q "/$SCOPE\.scope\$" /proc/self/cgroup && return

  # The scope outlives the loop while anything in it runs, such as a dev server.
  if systemctl --user is-active --quiet "$SCOPE.scope"; then
    log "$SCOPE.scope is active: another loop, or processes left by the last one"
    log "to clear it: systemctl --user stop $SCOPE.scope"
    exit 1
  fi

  # A cap above what is free only protects the loop from itself.
  local available wanted
  available=$(awk '/^MemAvailable:/ { print $2 * 1024 }' /proc/meminfo)
  wanted=$(numfmt --from=iec "$MEMORY_MAX") || exit 1
  if (( available < wanted )); then
    log "$MEMORY_MAX cap, but only $(numfmt --to=iec "$available") is available"
    log "free some memory, or lower FEATURE_LOOP_MEMORY_MAX"
    exit 1
  fi

  # Half the default CPU weight: when the CPUs are contended, an interactive
  # terminal (weight 100) keeps its share ahead of the loops.
  log "starting in $SCOPE.scope with a $MEMORY_MAX cap"
  exec systemd-run --user --scope --quiet --collect --unit="$SCOPE" \
    -p MemoryMax="$MEMORY_MAX" -p MemorySwapMax=0 -p OOMPolicy=continue -p CPUWeight=50 \
    "$BASH" llm-dlc/tools/feature-loop.sh "$@"
}
contain "$@"

# The run's record: what it was asked, a line per commit, and how it ended.
SUMMARIES=llm-dlc/loop-summaries
mkdir -p "$SUMMARIES" || exit 1
SUMMARY=$SUMMARIES/$(date +%F-%H%M%S)-$PROMPT.md
START=$(jj log --no-graph -r @- -T change_id) || exit 1

# A fresh session gets its id here, and it and a session with no transcript yet
# are created by the first turn. Claude Code keeps transcripts under the working
# directory's path with every other character turned into a dash.
PROJECTS=${CLAUDE_CONFIG_DIR:-$HOME/.claude}/projects
project_dir() { printf '%s/%s' "$PROJECTS" "$(printf '%s' "$1" | sed 's/[^A-Za-z0-9]/-/g')"; }
FRESH=
if [[ "$SESSION_ID" == new ]]; then
  SESSION_ID=$(python3 -c 'import uuid; print(uuid.uuid4())') || exit 1
  FRESH=1
  log "a fresh session for this run: $SESSION_ID (put it in the brief's Loop settings to continue it next run)"
elif [[ ! -e "$(project_dir "$ROOT")/$SESSION_ID.jsonl" ]]; then
  log "session $SESSION_ID has no transcript yet: the first turn creates it"
  FRESH=1
fi

# The brief without its "## Progress" section, which the session updates as it goes.
brief_hash() {
  awk '/^## / { progress = ($0 ~ /^## +Progress[[:space:]]*$/) } !progress' "$BRIEF" |
    sha256sum | cut -d' ' -f1
}
BRIEF_HASH=$(brief_hash) || exit 1
INSTRUCTION="Work on the brief in \`$BRIEF\`. Read it in full now, even if you have read it before: it is the instruction for this cycle and every cycle of this loop, and what you remember of it may be a summary. First run \`jj status\` and judge what a change in the working copy is. Another session may be at work in this repository at the same time, and its uncommitted files are not yours. A change that belongs to the brief's current work (the step its \`## Progress\` section or your own last turn left in progress) is a cycle that was interrupted: finish, verify and commit it first. Anything else is another session's: leave it alone, never finish, revert or discard it, and keep it out of your commit by moving it below yours and back, as \`llm-dlc/README.md\` (Keeping another session's files out of a commit) shows. Finishing an interrupted step is this cycle's piece of work. Otherwise take the next piece of work the brief calls for that is not done yet, by its \`## Progress\` section (it carries over from earlier runs of this loop) and by the commits since (\`jj log -r '$START..@-'\` lists this run's), finish it, verify it, and commit it with \`python3 llm-dlc/tools/sync.py commit\` as AGENTS.md describes. Don't edit the brief outside its \`## Progress\` section; update that section in the same commit with what this piece did and what comes next, and if it ends with a \`- Status:\` line, keep that line current there too: \`working\` while a piece of work that needs only you is left, otherwise the status the brief's \`## Loop until\` gives for stopping (\`done\`, or \`blocked: ...\` with what needs the user or another stream). Never deploy or push. If the rest of the brief is wrong or out of date, say so in the commit message."
{
  echo "# Feature loop: $PROMPT"
  echo
  echo "Started $(date '+%F %T %Z'), ${CYCLES/inf/no limit on} cycles, session $SESSION_ID, $MODEL at $EFFORT effort, after change $START."
  echo
  echo "> $INSTRUCTION"
  echo
  echo "Brief \`$BRIEF\` at sha256 $BRIEF_HASH."
  echo
  if [[ -n "$UNTIL" ]]; then
    echo "After each commit the session decides whether to go on:"
    echo
    echo "> $UNTIL"
    echo
  fi
  echo "## Commits"
  echo
} >"$SUMMARY"
note() { printf '%s\n' "$*" >>"$SUMMARY"; }
log "keeping a record of this run in $SUMMARY"

HELP='while it runs, type a command and Enter:
  +N / -N   run N more / N fewer cycles after this one (+ and - alone mean 1)
  =N or N   run exactly N more cycles after this one
  0, stop   end after this cycle (it still commits and compacts)
  inf       run until stopped
  ?         show where the loop stands'

# The loop and the terminal reader share "cycle remaining" in a state file:
# the cycle under way, and how many cycles start after it ("inf" for no limit).
STATE=$(mktemp "${XDG_RUNTIME_DIR:-/tmp}/feature-loop.XXXXXX") || exit 1
LOCK=$STATE.lock
echo "0 $CYCLES" >"$STATE"

# Run "$@" with $cycle and $remaining read from the state file, under the lock,
# and write them back afterwards.
with_state() {
  {
    flock 9
    read -r cycle remaining <"$STATE"
    "$@"
    echo "$cycle $remaining" >"$STATE"
  } 9>"$LOCK"
}

standing() {
  local total=$(( cycle + ${remaining/inf/0} ))
  if [[ "$remaining" == inf ]]; then
    if (( cycle == 0 )); then
      log "no limit: the loop runs until stopped"
    else
      log "cycle $cycle, no limit: the loop runs until stopped"
    fi
  elif (( cycle == 0 )); then
    log "$remaining cycle(s) to run"
  elif (( remaining == 0 )); then
    log "cycle $cycle is the last: the loop ends after it"
  else
    log "cycle $cycle of $total: $remaining more after this one"
  fi
}

apply() {
  local line=${1,,} n
  line=${line// /}
  case "$line" in
    "" | "?" | status) standing; return ;;
    help | h) printf '%s\n' "$HELP"; return ;;
    stop | q | quit) line=0 ;;
    inf | unlimited) remaining=inf; standing; return ;;
  esac
  if [[ "$line" =~ ^([-+=]?)([0-9]*)$ && -n "$line" ]]; then
    n=${BASH_REMATCH[2]:-1}
    n=$((10#$n))
    case "${BASH_REMATCH[1]}" in
      "" | =) remaining=$n ;;
      +) [[ "$remaining" == inf ]] && { log "no limit already; =N sets one"; return; }
         remaining=$(( remaining + n )) ;;
      -) [[ "$remaining" == inf ]] && { log "no limit to lower; =N sets one, 0 stops"; return; }
         remaining=$(( remaining > n ? remaining - n : 0 )) ;;
    esac
    standing
  else
    log "not a command: $1"
    printf '%s\n' "$HELP"
  fi
}

# Read the terminal in the background, so the count can change while claude
# works. claude gets /dev/null as its input, or it would compete for the lines.
# A background job's input is /dev/null unless redirected, hence fd 3.
reader=
if [[ -t 0 ]]; then
  exec 3<&0
  (
    while read -r line <&3; do
      with_state apply "$line"
    done
  ) &
  reader=$!
  exec 3<&-
fi

cleanup() {
  [[ -n "$reader" ]] && kill "$reader" 2>/dev/null
  rm -f "$STATE" "$LOCK"
  # Last, however the loop ended, so the session to resume or read is on screen.
  log "session: $SESSION_ID"
}
trap cleanup EXIT
trap 'note; note "Interrupted $(date "+%F %T") during cycle $cycle."; exit 130' INT TERM

# With -p nobody can answer a prompt, so anything auto mode would ask about is
# denied rather than left hanging. A second argument names a file that receives
# the raw event stream as well.
run_claude() {
  local session=(--resume "$SESSION_ID")
  [[ -n "$FRESH" ]] && session=(--session-id "$SESSION_ID")
  FRESH=
  claude -p "$1" "${session[@]}" --model "$MODEL" --effort "$EFFORT" \
    --permission-mode auto --output-format stream-json --verbose </dev/null |
    tee ${2:+"$2"} | show_progress
}

# Print the text of the last result event in a stream-json file.
result_text() {
  python3 -c '
import json, sys
text = None
for line in open(sys.argv[1], encoding="utf-8"):
    try:
        e = json.loads(line)
    except ValueError:
        continue
    if isinstance(e, dict) and e.get("type") == "result" and isinstance(e.get("result"), str):
        text = e["result"]
if text and text.strip():
    print(text.strip())
else:
    sys.exit(1)
' "$1"
}

# Ask the session for a summary of the run's commits and append it to the record.
# It is only a report: it changes nothing.
summarize() {
  local stream
  stream=$(mktemp "${XDG_RUNTIME_DIR:-/tmp}/feature-loop-summary.XXXXXX") || return 1
  log "summarizing the run into $SUMMARY"
  run_claude "The feature loop is ending after $cycle cycle(s). Summarize the work this run committed, the revisions that \`jj log -r '$START..@-'\` lists, for the user, who was not watching and will read it later. For each commit say what it adds and how it was verified; then list the warnings \`python3 llm-dlc/tools/sync.py check\` reports that they must judge before pushing, the items the brief's timebox deferred, the work deferred because it needs their input, such as credentials, a deployment or a decision, with what each item needs, and anything else that needs their attention. Reply with the summary in Markdown and nothing else. This turn only reports: don't edit files, commit, push or deploy." "$stream" ||
    log "summary: claude exited with status $?"
  note
  note "## Summary"
  note
  if ! result_text "$stream" >>"$SUMMARY"; then
    note "No summary came back; the commits above are the record. Session $SESSION_ID has the details."
    log "summary: no text came back"
  fi
  rm -f "$stream"
}

# With UNTIL: ask the session whether the loop goes on after this cycle's commit,
# while it still has the cycle in context. Sets $decision to continue, stop or
# unclear, and records the answer.
decide() {
  local stream answer verdict
  stream=$(mktemp "${XDG_RUNTIME_DIR:-/tmp}/feature-loop-decide.XXXXXX") || { decision=unclear; return; }
  log "cycle $cycle: asking whether to go on"
  run_claude "Cycle $cycle of the feature loop is committed. Before the next cycle starts, decide whether the loop should go on, by these instructions from the user: $UNTIL

Weigh them against what this run has done so far (\`jj log -r '$START..@-'\` lists its commits) and what is left. Reply with two or three sentences on why, then a last line that is exactly \`LOOP: continue\` or \`LOOP: stop\`. A status such as \`done\` or \`blocked: ...\` is never the last line: when one applies, the answer is \`LOOP: stop\`, and if the brief's status line doesn't say so yet, the loop gives you a turn to record it after this one. This turn only decides: don't edit files, commit, push or deploy." "$stream" ||
    log "cycle $cycle: decision turn exited with status $?"
  answer=$(result_text "$stream") || answer=
  rm -f "$stream"
  verdict=$(printf '%s\n' "$answer" | awk 'NF { last = $0 } END { print last }' | tr -d '`*_ \t\r' | tr '[:upper:]' '[:lower:]')
  case "$verdict" in
    loop:continue) decision=continue ;;
    loop:stop) decision=stop ;;
    *) decision=unclear ;;
  esac
  log "cycle $cycle: the session says $decision"
  note "  - decided to $decision: $(printf '%s' "$answer" | sed '/^[[:space:]`*_]*LOOP:/Id' | tr '\n' ' ' | sed 's/  */ /g; s/ *$//')"
}

# The last "- Status:" line under the brief's "## Progress", without the label
# (as run-streams.sh reads it), and whether the brief has one at all.
brief_status() {
  awk '/^## / { inside = ($0 ~ /^## +Progress[[:space:]]*$/); next }
       inside && /^[-*] +Status: */ { s = $0 }
       END { sub(/^[-*] +Status: */, "", s); gsub(/`/, "", s); print s }' "$BRIEF"
}
has_status() {
  awk '/^## / { inside = ($0 ~ /^## +Progress[[:space:]]*$/); next }
    inside && /^[-*] +Status: */ { found = 1 } END { exit !found }' "$BRIEF"
}

# After a decision to stop: a status that still says working tells run-streams.sh
# nothing about why, so the session, which still has the cycle in context, sets
# and commits the one the brief's Loop until gives. Sets $closed to ok or failed.
close_status() {
  local before_close status
  closed=ok
  has_status || return 0
  status=$(brief_status)
  [[ "$status" == working* ]] || return 0
  log "cycle $cycle: the session decided to stop, but the brief's status says working: asking it to record why"
  before_close=$(last_change) || { closed=failed; return; }
  run_claude "You decided that the loop stops after this cycle, but the status line at the end of the \`## Progress\` section of \`$BRIEF\` still says \`working\`. That tells whoever runs the loop nothing about why it stopped: a loop that is done or blocked is finished, and one still working is run again. Set that line now to the status the brief's \`## Loop until\` gives for where the work stands: \`done\`, or \`blocked: ...\` with what needs the user or another stream. Make sure Progress records what the status depends on. Change nothing else in the brief or anywhere, then commit it with \`python3 llm-dlc/tools/sync.py commit\`, keeping any other session's uncommitted files out of your commit." ||
    log "cycle $cycle: the status turn exited with status $?"
  status=$(brief_status)
  if [[ "$(last_change)" == "$before_close" || "$status" == working* || -z "$status" ]]; then
    closed=failed
    log "cycle $cycle: the brief's status is still ${status:-missing}, or wasn't committed; session $SESSION_ID needs attention"
    note "  - the stop left the brief's status ${status:-missing}, or uncommitted; session $SESSION_ID needs attention"
    return
  fi
  log "cycle $cycle: committed $(jj log --no-graph -r @- -T 'description.first_line()')"
  note "  - recorded the status \`$(jj log --no-graph -r @- -T 'change_id.short()')\`: $status"
}

# `sync.py commit` finishes @ and starts an empty change, so a commit moves @-.
# Change IDs, unlike commit IDs, survive a rewrite of the commit.
last_change() { jj log --no-graph -r @- -T change_id; }

# Start a cycle: count it, and take it from the ones left.
next_cycle() {
  cycle=$(( cycle + 1 ))
  [[ "$remaining" == inf ]] || remaining=$(( remaining - 1 ))
}

# With "- fork: SESSION", a session that has no transcript yet starts as a fork of
# that one, in a turn of its own. Claude Code finds a session to resume under the
# directory it runs in, and the parent belongs to the default workspace, so its
# transcript is copied here for the fork and removed straight after, so that the
# parent goes on in one place only. That turn runs without the repo's settings or
# any tool.
fork_session() {
  local source here copied=
  source=$(project_dir "$(jj workspace root --ignore-working-copy --name default 2>/dev/null || echo "$ROOT")")/$FORK_FROM.jsonl
  here=$(project_dir "$ROOT")
  if [[ ! -f "$source" ]]; then
    log "no transcript of session $FORK_FROM to fork, at $source"
    return 1
  fi
  mkdir -p "$here" || return 1
  if [[ "$source" != "$here/$FORK_FROM.jsonl" ]]; then
    cp -- "$source" "$here/$FORK_FROM.jsonl" || return 1
    copied=1
  fi
  log "starting session $SESSION_ID as a fork of $FORK_FROM"
  claude -p "This conversation goes on as one of the parallel streams it planned: the loop of the brief \`$BRIEF\`, in the jj workspace at \`$ROOT\`, on a branch of its own, while other forks of this conversation work the other streams in their own workspaces. From now on, work only in this workspace and only on what that brief gives you. Tools are off for this one turn: reply in a few sentences with how you will approach the brief's phases, given what this conversation established. The loop's first cycle follows." \
    --resume "$FORK_FROM" --fork-session --session-id "$SESSION_ID" --model "$MODEL" --effort "$EFFORT" \
    --setting-sources user --tools "" --output-format stream-json --verbose </dev/null | show_progress
  [[ -n "$copied" ]] && rm -f -- "${here:?}/${FORK_FROM:?}.jsonl"
  if [[ ! -f "$here/$SESSION_ID.jsonl" ]]; then
    log "the fork of session $FORK_FROM made no session $SESSION_ID"
    return 1
  fi
  FRESH=
  note "Session $SESSION_ID was forked from session $FORK_FROM."
  note
}
if [[ -n "$FRESH" && -n "$FORK_FROM" ]]; then
  fork_session || { note "Stopped $(date '+%F %T'): the fork of session $FORK_FROM failed."; exit 1; }
fi

if [[ -n "$reader" ]]; then
  printf '%s\n' "$HELP"
else
  log "no terminal: the cycle count can't be changed while it runs"
fi
with_state standing

while :; do
  with_state next_cycle
  before=$(last_change) || exit 1
  if [[ "$(brief_hash)" != "$BRIEF_HASH" ]]; then
    log "the brief $BRIEF changed during the run, stopping before cycle $cycle"
    note; note "Stopped $(date '+%F %T'): the brief changed before cycle $cycle; restart the loop to work from the new one."
    exit 1
  fi

  log "cycle $cycle: $PROMPT instruction"
  with_state standing
  [[ -n "$reader" ]] && log "type +N, -N, =N, 0 to stop, ? or help"
  run_claude "$INSTRUCTION" || log "cycle $cycle: claude exited with status $?"

  after=$(last_change) || exit 1
  if [[ "$after" == "$before" ]]; then
    log "cycle $cycle: no commit, stopping; session $SESSION_ID needs attention"
    note; note "Stopped $(date '+%F %T'): cycle $cycle made no commit; session $SESSION_ID needs attention."
    exit 1
  fi
  log "cycle $cycle: committed $(jj log --no-graph -r @- -T 'description.first_line()')"
  note "- cycle $cycle, $(date '+%F %T'), \`$(jj log --no-graph -r @- -T 'change_id.short()')\`: $(jj log --no-graph -r @- -T 'description.first_line()')"

  decision=continue
  # The last cycle of a count ends the loop anyway, so there is nothing to decide.
  if [[ -n "$UNTIL" ]]; then
    read -r _ left <"$STATE"
    [[ "$left" == 0 ]] || decide
  fi
  if [[ "$decision" == unclear ]]; then
    log "cycle $cycle: no clear decision, stopping; session $SESSION_ID needs attention"
    note; note "Stopped $(date '+%F %T'): after cycle $cycle the session gave no clear LOOP: continue or LOOP: stop; session $SESSION_ID needs attention."
    exit 1
  fi
  closed=ok
  [[ "$decision" == stop ]] && close_status

  log "cycle $cycle: compact"
  run_claude "/compact" || log "cycle $cycle: compact exited with status $?"

  read -r cycle remaining <"$STATE"
  if [[ "$decision" == stop ]]; then
    log "the session decided to stop: stopping after cycle $cycle"
    summarize
    if [[ "$closed" == failed ]]; then
      note; note "Stopped $(date '+%F %T') after $cycle cycle(s): the session decided to stop, but the brief's status still says $(brief_status); session $SESSION_ID needs attention."
      log "record of the run: $SUMMARY"
      exit 1
    fi
    if has_status; then
      note; note "Ended $(date '+%F %T') after $cycle cycle(s): the session decided to stop; the brief says $(brief_status)."
    else
      note; note "Ended $(date '+%F %T') after $cycle cycle(s): the session decided the work was done."
    fi
    log "record of the run: $SUMMARY"
    exit 0
  fi
  if [[ "$remaining" == 0 ]]; then
    log "no cycles left: stopping after cycle $cycle"
    summarize
    note; note "Ended $(date '+%F %T') after $cycle cycle(s)."
    log "record of the run: $SUMMARY"
    exit 0
  fi
done
