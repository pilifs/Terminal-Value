#!/usr/bin/env bash
# Run a brief's whole loop unattended, in one terminal: its parallel streams, each
# a feature loop in a jj workspace of its own on a branch of its own, then the
# brief's own loop, which merges them and finishes the work. You are needed only
# once that loop is done.
#
# Copied from in-the-loop's llm-dlc/tools/run-streams.sh, without its traces and
# verification queue.
#
# Usage: [RUN_STREAMS_POLL=300] [RUN_STREAMS_INTEGRATION_EVERY=3600] llm-dlc/tools/run-streams.sh NAME
#   NAME  the brief llm-dlc/loops/NAME.md, whose Loop settings list its streams:
#         "- streams: data dashboard editorial". Each stream STREAM has its own
#         brief, llm-dlc/loops/NAME-STREAM.md, whose Loop settings name its
#         workspace ("- workspace: NAME-STREAM") and the planning session it
#         forks ("- fork: SESSION").
#
# From the default workspace, in order:
#  1. Before any stream has a session, it compacts the conversation that planned
#     the streams, once. Each stream's brief forks its session from it ("- fork:"
#     in its Loop settings), so every stream starts from that conversation.
#  2. It adds a workspace per stream that doesn't have one, from the latest
#     commit (@-), named by the stream brief's "- workspace: NAME" and made at
#     ../REPO-NAME. The names must differ from every other workspace's, so a
#     brief names them after itself (factory-data); a directory already at
#     that path, such as a forgotten workspace's, stops the run before anything
#     starts.
#  3. It runs each stream's loop, feature-loop.sh NAME-STREAM, from its
#     workspace, side by side, and looks after each until it is finished.
#     If the brief's Loop settings name "- integration: SCRIPT", it also runs
#     the integration check while they do (below).
#  4. It runs the brief's own loop, feature-loop.sh NAME, here: the merge (see
#     the brief's Streams section), then whatever is left.
#
# Each brief ends its "## Progress" with a status line its loop keeps current:
# "- Status: working", "- Status: done" or "- Status: blocked: what needs the
# user". When a loop stops, this script reads it: done or blocked, the loop is
# finished. A loop that stops with no such status, on an error, a cycle with no
# commit, or a decision to stop that left it working, is run once more to finish
# what it left; twice in a row, it counts as blocked. A blocked stream doesn't
# hold the merge up: the merge takes what it committed and lists what needs the
# user.
#
# Every line comes here, prefixed with its loop ([data], [dashboard], [merge]).
# Ctrl-C stops them all, each recording the interruption. Running this again
# continues: workspaces and sessions are kept, nothing is compacted again, a
# loop whose status is done or blocked is not run again (set its status back to
# working to run it), and each loop finishes what an interrupted cycle left.
#
# The integration check, for a brief that names one, shows while the streams
# run whether their work fits together, rather than only at the merge. It keeps
# a workspace of its own, NAME-integration (../REPO-NAME-integration), used for
# nothing else: never committed from or pushed. Whenever a stream's @- has moved
# since the last check, at most once every RUN_STREAMS_INTEGRATION_EVERY seconds,
# it makes there a merge of every stream's @- and runs SCRIPT (a path in the
# repo, run from that workspace's root; llm-dlc/tools/site-integration.sh builds
# the site and runs its tests) in the systemd scope
# feature-loop-NAME-integration.scope with a 6 GB cap and a loop's CPU weight.
# What it found, with the commits it merged, goes to
# llm-dlc/loop-summaries/NAME-integration.md here, which each stream reads every
# cycle. A merge with a conflict is reported, not resolved, and SCRIPT isn't run
# on it. The previous check's merge is abandoned at the next; the merge loop
# forgets the workspace. Neither the streams' branches nor the default workspace
# change.
#
# In tmux, it makes the run easy to follow over ssh. It turns the mouse on for
# the tmux session, so the wheel scrolls back through the output (or Ctrl-b [,
# then PgUp, PgDn and the arrows; q to leave). A pane keeps the history limit it
# was made with, so if this one keeps fewer than RUN_STREAMS_HISTORY lines
# (200000) it raises the session's limit and goes on in a new window,
# streams-NAME, which keeps them; that window stays open with the output after
# the run, until Enter. "- new-window: no" in the brief's Loop settings, or
# RUN_STREAMS_NEW_WINDOW=no (which wins over the brief), keeps it in this pane. And it
# shows a status bar at the bottom of the pane, refreshed every
# RUN_STREAMS_STATUS_EVERY seconds (15): the run's age and spend, then for each
# loop its current cycle, its commits, its spend, its state, and how long since
# its last output line, and the integration check's last result. The same line
# is logged every half hour (every quarter hour outside tmux, where there is no
# bar). Spend is the sum of the "turn done" figures the loops print, kept with
# the rest of the state in llm-dlc/loop-summaries/run-streams-NAME/, so it
# survives a restart. llm-dlc/tools/streams_status.py reads and renders it.
#
# Exits 0 when the brief's own loop is finished, 1 if it is blocked or the setup
# fails, 2 for a bad argument and 130 if interrupted.

set -uo pipefail

usage() {
  echo "usage: run-streams.sh NAME   (the brief llm-dlc/loops/NAME.md, with '- streams:' in its Loop settings)" >&2
  exit 2
}

(( $# == 1 )) || usage
NAME=$1
[[ "$NAME" =~ ^[a-z0-9][a-z0-9-]*$ ]] || usage
BRIEF=llm-dlc/loops/$NAME.md
POLL=${RUN_STREAMS_POLL:-300}
INTEGRATION_EVERY=${RUN_STREAMS_INTEGRATION_EVERY:-3600}
[[ "$POLL" =~ ^[1-9][0-9]*$ && "$INTEGRATION_EVERY" =~ ^[0-9]+$ ]] || usage

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd) || exit 1
cd "$ROOT" || exit 1
source llm-dlc/tools/loop-common.sh

[[ -f "$BRIEF" ]] || { log "no brief $BRIEF"; exit 2; }
if [[ "$(realpath "$(jj workspace root --ignore-working-copy --name default 2>/dev/null)")" != "$ROOT" ]]; then
  log "run this from the default workspace's copy of the script, not $ROOT"
  exit 2
fi

# "- key: value" under a brief's "## Loop settings" heading, as feature-loop.sh reads it.
setting() {
  awk -v key="$2" '
    /^## / { inside = ($0 ~ /^## +Loop settings[[:space:]]*$/); next }
    inside && match($0, "^[-*] +" key ": *") { v = substr($0, RLENGTH + 1); gsub(/[`[:space:]]/, "", v); print v; exit }
  ' "$1"
}
# The same for a list of words, separated by spaces or commas.
setting_words() {
  awk -v key="$2" '
    /^## / { inside = ($0 ~ /^## +Loop settings[[:space:]]*$/); next }
    inside && match($0, "^[-*] +" key ": *") { v = substr($0, RLENGTH + 1); gsub(/[`,]/, " ", v); print v; exit }
  ' "$1"
}
read -ra STREAMS <<<"$(setting_words "$BRIEF" streams)"
(( ${#STREAMS[@]} )) || { log "$BRIEF lists no streams: add '- streams: A B ...' to its Loop settings"; exit 2; }
for s in "${STREAMS[@]}"; do
  [[ "$s" =~ ^[a-z0-9][a-z0-9-]*$ && "$s" != integration ]] || { log "$BRIEF: '$s' is not a stream name"; exit 2; }
done

# Every stream's brief, checked before anything starts or changes, tmux included.
project_dir() { printf '%s/%s' "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/projects" "$(printf '%s' "$1" | sed 's/[^A-Za-z0-9]/-/g')"; }

PARENT=
MODEL=$(setting "$BRIEF" model)
EFFORT=$(setting "$BRIEF" effort)
declare -A DIR SESSION WS
fresh=0
for s in "${STREAMS[@]}"; do
  brief=${BRIEF%.md}-$s.md
  [[ -f "$brief" ]] || { log "no brief $brief"; exit 1; }
  ws=$(setting "$brief" workspace)
  [[ -n "$ws" ]] || { log "$brief has no '- workspace:' in its Loop settings"; exit 1; }
  [[ "$ws" != default && "$ws" != "$NAME-integration" ]] || { log "$brief names workspace '$ws', which this script keeps for itself"; exit 1; }
  for other in "${!WS[@]}"; do
    [[ "${WS[$other]}" != "$ws" ]] || { log "the streams $other and $s both name workspace '$ws'"; exit 1; }
  done
  WS[$s]=$ws
  fork=$(setting "$brief" fork)
  [[ -n "$fork" ]] || { log "$brief has no '- fork:' in its Loop settings"; exit 1; }
  [[ -z "$PARENT" || "$fork" == "$PARENT" ]] || { log "the streams fork different sessions: $PARENT and $fork"; exit 1; }
  PARENT=$fork
  SESSION[$s]=$(setting "$brief" session)
  [[ -n "${SESSION[$s]}" ]] || { log "$brief has no '- session:' in its Loop settings: give each stream a fresh UUID"; exit 1; }
  DIR[$s]=$(jj workspace root --ignore-working-copy --name "$ws" 2>/dev/null) || DIR[$s]=
  if [[ -z "${DIR[$s]}" || ! -e "$(project_dir "${DIR[$s]}")/${SESSION[$s]}.jsonl" ]]; then
    fresh=$(( fresh + 1 ))
  fi
done

# tmux: scrollback and the status bar (see the header).
PANE=
HISTORY=${RUN_STREAMS_HISTORY:-200000}
# Whether to move to a new window: RUN_STREAMS_NEW_WINDOW, else the brief's "- new-window:", else yes.
NEW_WINDOW=${RUN_STREAMS_NEW_WINDOW:-$(setting "$BRIEF" new-window)}
NEW_WINDOW=${NEW_WINDOW:-yes}
[[ "$NEW_WINDOW" == yes || "$NEW_WINDOW" == no ]] || { log "new-window must be yes or no, not '$NEW_WINDOW'"; exit 2; }
STATUS_EVERY=${RUN_STREAMS_STATUS_EVERY:-15}
[[ "$HISTORY" =~ ^[0-9]+$ && "$STATUS_EVERY" =~ ^[1-9][0-9]*$ ]] || usage
if [[ -n "${TMUX:-}" && -n "${TMUX_PANE:-}" ]] && command -v tmux >/dev/null; then
  tmux set-option -t "$TMUX_PANE" mouse on >/dev/null 2>&1
  have=$(tmux display-message -p -t "$TMUX_PANE" '#{history_limit}' 2>/dev/null)
  if [[ "$have" =~ ^[0-9]+$ ]] && (( have < HISTORY )) && [[ "$NEW_WINDOW" != no ]]; then
    tmux set-option -t "$TMUX_PANE" history-limit "$HISTORY" >/dev/null 2>&1
    passed=()
    while IFS= read -r kv; do passed+=(-e "$kv"); done < <(env | grep -E '^((RUN_STREAMS|FEATURE_LOOP)_[A-Z_]*|CLAUDE_CONFIG_DIR)=')
    if tmux new-window -n "streams-$NAME" -c "$ROOT" "${passed[@]}" -e RUN_STREAMS_NEW_WINDOW=no -e RUN_STREAMS_IN_WINDOW=1 \
        bash -c '"$0" "$1"; code=$?; printf "\nrun-streams.sh %s ended with status %s. Scroll back with the mouse wheel or Ctrl-b [; press Enter to close this window.\n" "$1" "$code"; read -r' \
        "$ROOT/llm-dlc/tools/run-streams.sh" "$NAME"; then
      log "this pane keeps only $have lines of history, so the run goes on in the new tmux window streams-$NAME, which keeps $HISTORY"
      exit 0
    fi
    log "could not open a tmux window: going on here, with $have lines of history"
  fi
  if [[ "$have" =~ ^[0-9]+$ ]] && (( have < HISTORY )) && [[ "$NEW_WINDOW" == no && -z "${RUN_STREAMS_IN_WINDOW:-}" ]]; then
    tmux set-option -t "$TMUX_PANE" history-limit "$HISTORY" >/dev/null 2>&1
    log "this pane keeps $have lines of history; new panes in this tmux session now keep $HISTORY (new-window is no, so the run stays here)"
  fi
  PANE=$TMUX_PANE
  tmux set-option -p -t "$PANE" pane-border-status bottom >/dev/null 2>&1
  tmux set-option -p -t "$PANE" pane-border-format ' #{@run_streams} ' >/dev/null 2>&1
  tmux set-option -p -t "$PANE" @run_streams "run-streams.sh $NAME: starting" >/dev/null 2>&1
  log "tmux: the mouse wheel scrolls (or Ctrl-b [, then PgUp/PgDn; q to leave); the status bar is at the bottom of this pane"
else
  log "not in tmux: no status bar, and scrollback is the terminal's; run it inside tmux (tmux new -s streams) for both"
fi
# A workspace to add needs its directory free: a forgotten workspace's directory
# stays on disk, and jj would refuse it only after the planning session was compacted.
INTEGRATION=$(setting "$BRIEF" integration)
INTEGRATION_WS=$NAME-integration
INTEGRATION_DIR=
if [[ -n "$INTEGRATION" ]]; then
  INTEGRATION_DIR=$(jj workspace root --ignore-working-copy --name "$INTEGRATION_WS" 2>/dev/null) || INTEGRATION_DIR=
fi
taken=0
for s in "${STREAMS[@]}" ${INTEGRATION:+integration}; do
  if [[ "$s" == integration ]]; then
    [[ -z "$INTEGRATION_DIR" ]] || continue
    want=$(dirname "$ROOT")/$(basename "$ROOT")-$INTEGRATION_WS
  else
    [[ -z "${DIR[$s]}" ]] || continue
    want=$(dirname "$ROOT")/$(basename "$ROOT")-${WS[$s]}
  fi
  if [[ -e "$want" ]]; then
    log "$want already exists, but no jj workspace here is at it: a forgotten workspace's directory? Delete it, or name another workspace in the brief"
    taken=1
  fi
done
(( taken == 0 )) || exit 1

# The planning session, compacted once: before the first fork, when no stream has a session yet.
if (( fresh == ${#STREAMS[@]} )); then
  transcript=$(project_dir "$ROOT")/$PARENT.jsonl
  if [[ ! -f "$transcript" ]]; then
    log "the streams fork session $PARENT, and it has no transcript here: $transcript"
    log "copy it from the machine it ran on, to that path, before running this; continue it only here from then on"
    exit 1
  fi
  log "compacting session $PARENT, which every stream forks"
  claude -p "/compact" --resume "$PARENT" ${MODEL:+--model "$MODEL"} ${EFFORT:+--effort "$EFFORT"} \
    --permission-mode auto --output-format stream-json --verbose </dev/null | show_progress
  (( PIPESTATUS[0] == 0 )) || { log "the compact failed; nothing started"; exit 1; }
fi

for s in "${STREAMS[@]}"; do
  if [[ -z "${DIR[$s]}" ]]; then
    DIR[$s]=$(dirname "$ROOT")/$(basename "$ROOT")-${WS[$s]}
    log "adding jj workspace ${WS[$s]} at ${DIR[$s]}"
    jj workspace add --name "${WS[$s]}" -r @- "${DIR[$s]}" >/dev/null || { log "could not add workspace ${WS[$s]}"; exit 1; }
  fi
done

# A stream's run records are its own workspace's (feature-loop.sh writes them
# where it runs). They are copied here at the start, after each of the stream's
# runs, and before the merge, so the merge loop and the status bar find every
# run's record in one place. LABEL names the loop in the log.
collect_records() {
  local dir=$1 label=$2 line
  [[ "$dir" == "$ROOT" ]] && return 0
  python3 "$ROOT/llm-dlc/tools/run_records.py" collect "$dir" "$ROOT" | while IFS= read -r line; do log "[$label] $line"; done
}

# Records a stream's earlier runs left in its workspace (an interrupted run of this script).
for s in "${STREAMS[@]}"; do collect_records "${DIR[$s]}" "$s"; done

# The last "- Status:" line under a brief's "## Progress", without the label.
status_of() {
  awk '/^## / { inside = ($0 ~ /^## +Progress[[:space:]]*$/); next }
       inside && /^[-*] +Status: */ { s = $0 }
       END { sub(/^[-*] +Status: */, "", s); gsub(/`/, "", s); print s }' "$1"
}
finished() { [[ "$1" == done* || "$1" == blocked* ]]; }

# The status bar's state (see the header): spend and the run's start survive a
# restart; phases, cycles and activity are this invocation's.
STATE=$ROOT/llm-dlc/loop-summaries/run-streams-$NAME
mkdir -p "$STATE" || exit 1
rm -f "$STATE"/*.phase "$STATE"/*.cycle "$STATE"/*.last
[[ -s "$STATE/start" ]] || date +%s >"$STATE/start"
START=$(<"$STATE/start")
phase() { printf '%s\n' "$2" >"$STATE/$1.phase"; }

# Run one loop until it is finished, as the header says: LABEL, the workspace it
# runs in, its name for feature-loop.sh, and its brief there. Exits 0 when its
# brief says done, 3 when it is blocked, 130 if interrupted.
supervise() {
  local label=$1 dir=$2 loop=$3 brief=$2/$4 code status failed=0
  while :; do
    log "[$label] starting feature-loop.sh $loop in $dir"
    phase "$label" running
    "$dir/llm-dlc/tools/feature-loop.sh" "$loop" </dev/null 2>&1 | python3 -u "$ROOT/llm-dlc/tools/streams_status.py" tag "$label" "$STATE"
    code=${PIPESTATUS[0]}
    collect_records "$dir" "$label"
    (( code == 130 )) && exit 130
    status=$(status_of "$brief")
    log "[$label] the loop ended with status $code; its brief says: ${status:-no status}"
    case "$status" in
      done*) exit 0 ;;
      blocked*) exit 3 ;;
    esac
    # A clean stop with a status that says neither done nor blocked isn't
    # finished: feature-loop.sh records the status at a stop, so a stop without
    # one is run again like a failure.
    (( code == 0 )) && log "[$label] it decided to stop, but its status doesn't say why (${status:-no status})"
    failed=$(( failed + 1 ))
    if (( failed >= 2 )); then
      log "[$label] stopped twice in a row without a status that says why: counted as blocked; its session needs a look"
      exit 3
    fi
    log "[$label] running it again once, to finish what it left"
  done
}

# The integration check (see the header), when the brief names a script for it.
if [[ -n "$INTEGRATION" ]]; then
  [[ -x "$INTEGRATION" ]] || { log "the brief's integration script $INTEGRATION isn't an executable file here"; exit 1; }
  if [[ -z "$INTEGRATION_DIR" ]]; then
    INTEGRATION_DIR=$(dirname "$ROOT")/$(basename "$ROOT")-$INTEGRATION_WS
    log "adding jj workspace $INTEGRATION_WS at $INTEGRATION_DIR, for the integration check"
    jj workspace add --name "$INTEGRATION_WS" -r @- "$INTEGRATION_DIR" >/dev/null || { log "could not add workspace $INTEGRATION_WS"; exit 1; }
  fi
  INTEGRATION_REPORT=$ROOT/llm-dlc/loop-summaries/$NAME-integration.md
  INTEGRATION_SCOPE=feature-loop-$NAME-integration
fi

# Every stream's @-, as short commit ids, in the order of STREAMS.
stream_heads() {
  local s
  for s in "${STREAMS[@]}"; do
    jj log --ignore-working-copy --no-graph -r "${WS[$s]}@-" -T 'commit_id.short(12) ++ " "' 2>/dev/null || printf '? '
  done
}

# One check of the streams' current commits: merge, run the script, report.
integrate_once() {
  local heads=$1 s revs=() previous conflicted code tmp
  for s in "${STREAMS[@]}"; do revs+=("${WS[$s]}@-"); done
  tmp=$(mktemp) || return 1
  {
    printf '# Integration check of %s\n\n' "$BRIEF"
    printf -- '- When: %s\n' "$(date '+%F %T')"
    printf -- '- Merged: '
    for s in "${!STREAMS[@]}"; do printf '%s@- %s; ' "${WS[${STREAMS[$s]}]}" "$(cut -d' ' -f$(( s + 1 )) <<<"$heads")"; done
    printf '\n- Where: the workspace %s, %s\n' "$INTEGRATION_WS" "$INTEGRATION_DIR"
  } >"$tmp"
  previous=$(cd "$INTEGRATION_DIR" && jj log --no-graph -r @ -T 'if(description, "", change_id)' 2>/dev/null)
  if ! (cd "$INTEGRATION_DIR" && jj new --quiet "${revs[@]}" >/dev/null 2>&1); then
    printf -- '- Result: the merge could not be made (jj new failed)\n' >>"$tmp"
    mv "$tmp" "$INTEGRATION_REPORT"
    return 1
  fi
  [[ -n "$previous" ]] && (cd "$INTEGRATION_DIR" && jj abandon --quiet "$previous" >/dev/null 2>&1)
  conflicted=$(cd "$INTEGRATION_DIR" && jj resolve --list 2>/dev/null)
  if [[ -n "$conflicted" ]]; then
    printf -- '- Result: the streams conflict; the script was not run. Files in conflict:\n\n```\n%s\n```\n' "$conflicted" >>"$tmp"
    mv "$tmp" "$INTEGRATION_REPORT"
    log "[integration] the streams conflict: see $INTEGRATION_REPORT"
    return 0
  fi
  log "[integration] running $INTEGRATION on $heads"
  (cd "$INTEGRATION_DIR" && systemd-run --user --scope --quiet --collect --unit="$INTEGRATION_SCOPE" \
    -p MemoryMax=6G -p MemorySwapMax=0 -p OOMPolicy=continue -p CPUWeight=50 \
    timeout 3600 "$INTEGRATION_DIR/$INTEGRATION" </dev/null) >"$tmp.out" 2>&1
  code=$?
  printf -- '- Result: %s (exit %s)\n\n## Output, last 200 lines\n\n```\n' \
    "$( (( code == 0 )) && echo passed || echo failed )" "$code" >>"$tmp"
  tail -n 200 "$tmp.out" >>"$tmp"
  printf '```\n' >>"$tmp"
  rm -f "$tmp.out"
  mv "$tmp" "$INTEGRATION_REPORT"
  log "[integration] $( (( code == 0 )) && echo passed || echo "failed (exit $code)" ): see $INTEGRATION_REPORT"
}

# Runs until killed: a check whenever a stream's @- has moved, at most every INTEGRATION_EVERY seconds.
integrate() {
  local last= heads
  mkdir -p "$(dirname "$INTEGRATION_REPORT")"
  while kill -0 "$MAIN" 2>/dev/null; do
    heads=$(stream_heads)
    if [[ "$heads" != "$last" ]]; then
      integrate_once "$heads"
      last=$heads
      sleep "$INTEGRATION_EVERY"
    else
      sleep "$POLL"
    fi
  done
}

# Each stream runs in a process group of its own (job control), so a Ctrl-C here
# reaches only this script, which passes it on to each group whole: the loop, its
# claude and its output. Without job control, bash would start them ignoring
# SIGINT, and a loop could neither be stopped by it nor record it.
set -m
declare -A PID
MAIN=$$  # the background loops below end when this script is gone
INTEGRATE=
STATUS=
stop_all() {
  log "stopping every loop"
  for p in "${PID[@]}"; do kill -INT -- "-$p" 2>/dev/null; done
  [[ -n "$INTEGRATE" ]] && kill -TERM -- "-$INTEGRATE" 2>/dev/null
  [[ -n "$STATUS" ]] && kill -TERM -- "-$STATUS" 2>/dev/null
}
trap 'stop_all; wait; exit 130' INT TERM HUP

# The status line: each stream, then the merge, from the state above.
STATUS_LOOPS=()
for s in "${STREAMS[@]}"; do STATUS_LOOPS+=("$s=${DIR[$s]}=${BRIEF%.md}-$s.md"); done
STATUS_LOOPS+=("merge=$ROOT=$BRIEF")
status_line() {
  python3 "$ROOT/llm-dlc/tools/streams_status.py" render --name "$NAME" --state "$STATE" --start "$START" \
    ${INTEGRATION:+--integration "$INTEGRATION_REPORT"} "${STATUS_LOOPS[@]}" 2>/dev/null
}
show_status() {
  local text
  text=$(status_line) || return 0
  [[ -n "$PANE" ]] && tmux set-option -p -t "$PANE" @run_streams "$text" >/dev/null 2>&1
  [[ -n "${1:-}" ]] && log "[status] $text"
  return 0
}
# Runs until killed: the bar every STATUS_EVERY seconds, the log every half hour (quarter hour without a bar).
status_bar() {
  local every=900 logged=0 now
  [[ -n "$PANE" ]] && every=1800
  while kill -0 "$MAIN" 2>/dev/null; do
    now=$(date +%s)
    if (( now - logged >= every )); then show_status log; logged=$now; else show_status; fi
    sleep "$STATUS_EVERY"
  done
}
for s in "${STREAMS[@]}"; do
  brief=${BRIEF%.md}-$s.md
  status=$(status_of "${DIR[$s]}/$brief")
  if finished "$status"; then
    log "[$s] its brief says $status: not run again"
    phase "$s" "finished: $status"
    continue
  fi
  supervise "$s" "${DIR[$s]}" "$NAME-$s" "$brief" &
  PID[$s]=$!
done
status_bar &
STATUS=$!
if [[ -n "$INTEGRATION" ]] && (( ${#PID[@]} )); then
  log "[integration] checking the streams together as they commit, into $INTEGRATION_REPORT"
  integrate &
  INTEGRATE=$!
fi

for s in "${!PID[@]}"; do
  wait "${PID[$s]}"
  code=$?
  (( code == 130 )) && { log "[$s] interrupted"; stop_all; wait; exit 130; }
  log "[$s] finished: $(status_of "${DIR[$s]}/${BRIEF%.md}-$s.md")"
  phase "$s" "finished: $(status_of "${DIR[$s]}/${BRIEF%.md}-$s.md")"
done
PID=()
if [[ -n "$INTEGRATE" ]]; then
  kill -TERM -- "-$INTEGRATE" 2>/dev/null
  wait "$INTEGRATE" 2>/dev/null
  INTEGRATE=
  log "[integration] stopped: every stream is finished"
fi

for s in "${STREAMS[@]}"; do collect_records "${DIR[$s]}" "$s"; done
code=0
status=$(status_of "$ROOT/$BRIEF")
if finished "$status"; then
  log "[merge] its brief says $status: not run again"
  phase merge "finished: $status"
else
  log "every stream is finished: the brief's own loop merges them"
  supervise merge "$ROOT" "$NAME" "$BRIEF" &
  PID[merge]=$!
  wait "${PID[merge]}"
  code=$?
  PID=()
  phase merge "finished: $(status_of "$ROOT/$BRIEF")"
fi
if [[ -n "$STATUS" ]]; then
  kill -TERM -- "-$STATUS" 2>/dev/null
  wait "$STATUS" 2>/dev/null
  STATUS=
fi
show_status log
(( code == 130 )) && exit 130
status=$(status_of "$ROOT/$BRIEF")
log "finished: the brief $BRIEF says ${status:-no status}"
# Every loop's session, so the one to resume or read is on screen. The
# integration check is a script, with no session of its own.
log "sessions: planning $PARENT, merge ${FEATURE_LOOP_SESSION:-$(setting "$ROOT/$BRIEF" session)}"
for s in "${STREAMS[@]}"; do log "sessions: $s ${SESSION[$s]}"; done
log "what needs you: its Progress and the run records in llm-dlc/loop-summaries/"
[[ "$status" == done* ]] && exit 0
exit 1
