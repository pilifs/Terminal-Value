#!/usr/bin/env bash
# Repeat one open-ended instruction unattended: a moonshot.
#
# The simple sibling of feature-loop.sh, after the moonshots of in-the-loop's
# llm-dlc. A brief lists steps and says when it is done; a moonshot is a goal
# with no end, given again every cycle. Each cycle resumes one Claude Code
# session and gives it the instruction. Then:
#
#   - no new commit: the loop stops. The work may not be finished, or it may
#     need a person, and the session is left as it is for them to read.
#   - a commit, and the session ended the cycle above 400,000 tokens of context:
#     the loop compacts the session, then gives the instruction again.
#   - a commit, and a smaller session: it gives the instruction again as it is.
#
# Usage: llm-dlc/tools/moonshot-loop.sh NAME [CYCLES]
#
#   NAME     the moonshot llm-dlc/moonshots/NAME.md: the whole file is the instruction
#   CYCLES   how many cycles to run at most; without it the loop runs until a
#            cycle makes no commit, or Ctrl-C
#
# The session is kept in llm-dlc/loop-summaries/moonshot-NAME.session, so running
# the same command again continues it. The first run starts a fresh session, or
# continues the one MOONSHOT_SESSION names. The session runs on Fable 5.2
# (claude-fable-5-2) at high effort; MOONSHOT_MODEL and MOONSHOT_EFFORT change
# that. MOONSHOT_COMPACT_ABOVE changes the 400,000.
#
# Each run appends a line per commit to a record in llm-dlc/loop-summaries/
# (gitignored). The loop commits locally, never pushes or deploys, has no memory
# cap and no spending limit.
#
# Exits 0 when the cycles run out, 1 when a cycle made no commit, 2 for a bad
# argument, and 130 if interrupted.

set -uo pipefail

MODEL=${MOONSHOT_MODEL:-claude-fable-5-2}
EFFORT=${MOONSHOT_EFFORT:-high}
COMPACT_ABOVE=${MOONSHOT_COMPACT_ABOVE:-400000}

usage() {
  echo "usage: moonshot-loop.sh NAME [CYCLES]   (NAME: a moonshot in llm-dlc/moonshots/)" >&2
  exit 2
}
(( $# >= 1 && $# <= 2 )) || usage
NAME=$1
CYCLES=${2:-inf}
[[ "$NAME" =~ ^[A-Za-z0-9][A-Za-z0-9_-]*$ ]] || usage
[[ "$CYCLES" == inf || "$CYCLES" =~ ^[1-9][0-9]*$ ]] || usage
[[ "$COMPACT_ABOVE" =~ ^[0-9]+$ ]] || usage

# Claude Code files a session under the directory it ran in, so run at the root
# of the repo whatever the caller's directory.
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd) || exit 1
cd "$ROOT" || exit 1
MOONSHOT=llm-dlc/moonshots/$NAME.md
if [[ ! -s "$MOONSHOT" ]]; then
  echo "moonshot-loop.sh: no moonshot at $MOONSHOT" >&2
  exit 2
fi

# log and show_progress
source llm-dlc/tools/loop-common.sh

# The loop finds its commits by jj change id: it needs the repo colocated with jj.
if ! jj root --ignore-working-copy >/dev/null 2>&1; then
  log "this repo has no jj yet: run python3 llm-dlc/tools/sync.py init"
  exit 2
fi

# The moonshot is the instruction, word for word. What follows it is the same
# for every moonshot: what a cycle is, and the honest way to end the loop.
INSTRUCTION="$(cat "$MOONSHOT")

This is one cycle of an unattended loop that gives you this same instruction again after every commit. Take the one improvement that does the most for the goal now, finish it, verify it, and commit it with \`python3 llm-dlc/tools/sync.py commit\` as AGENTS.md describes. Never push or deploy. A cycle that ends without a commit stops the loop and brings the author to read this session. So if what is left needs their decision, or nothing left is worth a commit, don't commit: end with what they need to know."

SUMMARIES=llm-dlc/loop-summaries
mkdir -p "$SUMMARIES" || exit 1

# One session for the moonshot, kept between runs. Claude Code keeps transcripts
# under the working directory's path with every other character turned into a
# dash; a session with no transcript there yet is created by the first turn.
KEPT=$SUMMARIES/moonshot-$NAME.session
SESSION_ID=${MOONSHOT_SESSION:-$(cat "$KEPT" 2>/dev/null)}
[[ -n "$SESSION_ID" ]] || SESSION_ID=$(python3 -c 'import uuid; print(uuid.uuid4())') || exit 1
[[ "$SESSION_ID" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]] || {
  echo "moonshot-loop.sh: not a session id: $SESSION_ID" >&2
  exit 2
}
echo "$SESSION_ID" >"$KEPT"
FRESH=
PROJECT=${CLAUDE_CONFIG_DIR:-$HOME/.claude}/projects/$(printf '%s' "$ROOT" | sed 's/[^A-Za-z0-9]/-/g')
if [[ ! -e "$PROJECT/$SESSION_ID.jsonl" ]]; then
  FRESH=1
  log "session $SESSION_ID has no transcript yet: the first turn creates it"
fi

SUMMARY=$SUMMARIES/$(date +%F-%H%M%S)-moonshot-$NAME.md
{
  echo "# Moonshot loop: $NAME"
  echo
  echo "Started $(date '+%F %T %Z'), ${CYCLES/inf/no limit on} cycles, session $SESSION_ID, $MODEL at $EFFORT effort, compacting above $COMPACT_ABOVE tokens."
  echo
  sed 's/^/> /' <<<"$INSTRUCTION"
  echo
  echo "## Commits"
  echo
} >"$SUMMARY"
note() { printf '%s\n' "$*" >>"$SUMMARY"; }
log "keeping a record of this run in $SUMMARY"

# The raw events of the last turn, to read the session's size from.
STREAM=$(mktemp "${XDG_RUNTIME_DIR:-/tmp}/moonshot-loop.XXXXXX") || exit 1
cycle=0
OF=
[[ "$CYCLES" == inf ]] || OF=" of $CYCLES"
cleanup() {
  rm -f "$STREAM"
  # Last, however the loop ended, so the session to resume or read is on screen.
  log "session: $SESSION_ID (to read it: claude --resume $SESSION_ID)"
}
trap cleanup EXIT
trap 'note; note "Interrupted $(date "+%F %T") during cycle $cycle."; exit 130' INT TERM

# With -p nobody can answer a prompt, so anything auto mode would ask about is
# denied rather than left hanging.
run_claude() {
  local session=(--resume "$SESSION_ID")
  [[ -n "$FRESH" ]] && session=(--session-id "$SESSION_ID")
  FRESH=
  claude -p "$1" "${session[@]}" --model "$MODEL" --effort "$EFFORT" \
    --permission-mode auto --output-format stream-json --verbose </dev/null |
    tee "$STREAM" | show_progress
}

# How large the session was when the turn ended: the tokens the last request of
# the main conversation read and wrote. A subagent's requests are its own
# context, not the session's. Prints nothing when the stream has no such request.
context_tokens() {
  python3 -c '
import json, sys
tokens = None
for line in open(sys.argv[1], encoding="utf-8", errors="replace"):
    try:
        e = json.loads(line)
        if e.get("type") != "assistant" or e.get("parent_tool_use_id"):
            continue
        u = e["message"]["usage"]
        tokens = sum(int(u.get(k) or 0) for k in
                     ("input_tokens", "cache_creation_input_tokens", "cache_read_input_tokens", "output_tokens"))
    except (ValueError, KeyError, TypeError, AttributeError):
        continue
if tokens:
    print(tokens)
' "$STREAM"
}

# `sync.py commit` finishes @ and starts an empty change, so a commit moves @-.
# Change IDs, unlike commit IDs, survive a rewrite of the commit.
last_change() { jj log --no-graph -r @- -T change_id; }

while :; do
  cycle=$(( cycle + 1 ))
  before=$(last_change) || exit 1

  log "cycle $cycle$OF: $NAME"
  run_claude "$INSTRUCTION" || log "cycle $cycle: claude exited with status $?"
  tokens=$(context_tokens)

  after=$(last_change) || exit 1
  if [[ "$after" == "$before" ]]; then
    log "cycle $cycle: no commit, stopping; session $SESSION_ID needs attention"
    note; note "Stopped $(date '+%F %T'): cycle $cycle made no commit; session $SESSION_ID needs attention."
    exit 1
  fi
  log "cycle $cycle: committed $(jj log --no-graph -r @- -T 'description.first_line()')"
  note "- cycle $cycle, $(date '+%F %T'), \`$(jj log --no-graph -r @- -T 'change_id.short()')\`: $(jj log --no-graph -r @- -T 'description.first_line()')"

  if [[ "$CYCLES" != inf ]] && (( cycle >= CYCLES )); then
    log "no cycles left: stopping after cycle $cycle"
    note; note "Ended $(date '+%F %T') after $cycle cycle(s)."
    exit 0
  fi

  # A size that can't be read is treated as too large: a compact too many costs
  # little, and a session that never compacts ends by not fitting.
  if [[ -z "$tokens" ]]; then
    log "cycle $cycle: couldn't read the session's size, so compact"
  elif (( tokens > COMPACT_ABOVE )); then
    log "cycle $cycle: ended at $tokens tokens, above $COMPACT_ABOVE: compact"
  else
    log "cycle $cycle: ended at $tokens tokens: no compact"
    continue
  fi
  run_claude "/compact" || log "cycle $cycle: compact exited with status $?"
done
