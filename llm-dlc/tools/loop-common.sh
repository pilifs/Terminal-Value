# Shared by feature-loop.sh and run-streams.sh, which source it from the root
# of the repo.

log() { printf '[%s] %s\n' "$(date '+%F %T')" "$*"; }

# Print each stream-json event as it arrives: a turn in text mode stays silent
# until it ends, which can be hours. This only displays, so it must outlive any
# line it cannot read, or a closed pipe would kill claude.
show_progress() {
  python3 -u -c '
import json, sys, time

def say(text):
    print(time.strftime("[%F %T]"), text, flush=True)

def event(e):
    if e.get("type") == "assistant":
        sub = "subagent " if e.get("parent_tool_use_id") else ""
        for block in e["message"]["content"]:
            if block.get("type") == "text" and block["text"].strip():
                say(sub + "says: " + block["text"].strip())
            elif block.get("type") == "tool_use":
                i = block.get("input") or {}
                detail = i.get("description") or i.get("file_path") or i.get("command") or ""
                detail = " ".join(str(detail).split())[:100]
                say("%s%s: %s" % (sub, block.get("name"), detail))
    elif e.get("type") == "system" and e.get("subtype") == "task_notification":
        say("background task %s: %s" % (e.get("status", "done"), " ".join(str(e.get("summary", "")).split())[:100]))
    elif e.get("type") == "result":
        say("turn done: %s, %s steps, %.1f min, $%.2f" % (
            e.get("subtype"), e.get("num_turns"),
            e.get("duration_ms", 0) / 60000, e.get("total_cost_usd", 0)))

try:
    for line in sys.stdin:
        try:
            event(json.loads(line))
        except (ValueError, KeyError, TypeError, AttributeError):
            pass
except KeyboardInterrupt:
    pass
'
}
