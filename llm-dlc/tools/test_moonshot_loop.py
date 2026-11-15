#!/usr/bin/env python3
"""Tests of moonshot-loop.sh, each on a throwaway colocated jj repository with a copy of the script
and a stand-in for `claude` that commits, or doesn't, as the test's plan says.
Run: python3 llm-dlc/tools/test_moonshot_loop.py"""

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
SESSION = "11111111-2222-3333-4444-555555555555"
MOONSHOT = "Make the page better.\n\nThink big.\n"

# Stands in for `claude -p PROMPT ...`: notes how it was called, then plays the next step of
# plan.json. A step commits or not, and says how large the session was when the turn ended.
STUB = r'''#!/usr/bin/env python3
import json, os, subprocess, sys
from pathlib import Path

here = Path(os.environ["STUB_DIR"])
args = sys.argv[1:]
prompt = args[args.index("-p") + 1]
calls = here / "calls.jsonl"
before = [json.loads(l) for l in calls.read_text().splitlines()] if calls.exists() else []
with calls.open("a") as f:
    f.write(json.dumps({"prompt": prompt, "args": args}) + "\n")
if prompt == "/compact":
    print(json.dumps({"type": "result", "subtype": "success", "num_turns": 1}))
    sys.exit(0)
n = sum(1 for c in before if c["prompt"] != "/compact")
step = json.loads((here / "plan.json").read_text())[n]
if step["commit"]:
    Path("work.txt").write_text(f"cycle {n + 1}\n")
    subprocess.run(["jj", "commit", "-m", f"Work of cycle {n + 1}"], check=True, capture_output=True)
# A subagent's request is its own context, however large: it must not count.
print(json.dumps({"type": "assistant", "parent_tool_use_id": "toolu_1", "message": {"content": [], "usage": {"input_tokens": 900000}}}))
if step["tokens"] is not None:
    t = step["tokens"]
    usage = {"input_tokens": 3, "cache_creation_input_tokens": 1000, "cache_read_input_tokens": t - 1503, "output_tokens": 500,
             "service_tier": "standard"}
    print(json.dumps({"type": "assistant", "parent_tool_use_id": None, "message": {"content": [{"type": "text", "text": "done"}], "usage": usage}}))
print("not json: the display and the count both outlive it")
print(json.dumps({"type": "result", "subtype": "success", "num_turns": 2, "duration_ms": 1000, "total_cost_usd": 0.01}))
sys.exit(step.get("exit", 0))
'''


@unittest.skipUnless(shutil.which("jj"), "needs jj")
class MoonshotLoopTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        tmp = Path(self.tmp.name)
        self.root = tmp / "repo"
        tools = self.root / "llm-dlc" / "tools"
        tools.mkdir(parents=True)
        for name in ("moonshot-loop.sh", "loop-common.sh"):
            shutil.copy(TOOLS / name, tools / name)
        (self.root / "llm-dlc" / "moonshots").mkdir()
        (self.root / "llm-dlc" / "moonshots" / "page.md").write_text(MOONSHOT)
        self.stub = tmp / "stub"
        (self.stub / "bin").mkdir(parents=True)
        claude = self.stub / "bin" / "claude"
        claude.write_text(STUB)
        claude.chmod(0o755)
        self.env = {**os.environ, "JJ_USER": "Test", "JJ_EMAIL": "test@example.invalid", "JJ_CONFIG": "/dev/null",
                    "PATH": f"{self.stub / 'bin'}{os.pathsep}{os.environ['PATH']}", "STUB_DIR": str(self.stub),
                    "CLAUDE_CONFIG_DIR": str(tmp / "claude"), "XDG_RUNTIME_DIR": str(tmp)}
        for name in ("MOONSHOT_SESSION", "MOONSHOT_MODEL", "MOONSHOT_EFFORT", "MOONSHOT_COMPACT_ABOVE"):
            self.env.pop(name, None)
        self.sh("git", "init", "-q")
        self.sh("jj", "git", "init", "--colocate")
        (self.root / "README.md").write_text("base\n")
        self.sh("jj", "commit", "-m", "Add the base")

    def tearDown(self):
        self.tmp.cleanup()

    def sh(self, *cmd):
        return subprocess.run(cmd, cwd=self.root, env=self.env, check=True, capture_output=True, text=True).stdout

    def loop(self, plan, *args, **env):
        (self.stub / "plan.json").write_text(json.dumps([{"commit": c, "tokens": t} for c, t in plan]))
        (self.stub / "calls.jsonl").unlink(missing_ok=True)
        # From another directory: the loop runs at the root of its own repo.
        r = subprocess.run(["bash", str(self.root / "llm-dlc/tools/moonshot-loop.sh"), *args], cwd=self.tmp.name,
                           env={**self.env, **env}, capture_output=True, text=True, stdin=subprocess.DEVNULL)
        calls = self.stub / "calls.jsonl"
        self.calls = [json.loads(l) for l in calls.read_text().splitlines()] if calls.exists() else []
        return r.returncode, r.stdout + r.stderr

    def prompts(self):
        return ["compact" if c["prompt"] == "/compact" else "instruction" for c in self.calls]

    def record(self):
        (path,) = (self.root / "llm-dlc" / "loop-summaries").glob("*-moonshot-page.md")
        return path.read_text()

    def test_compacts_only_above_the_threshold_and_stops_on_a_cycle_with_no_commit(self):
        code, out = self.loop([(True, 120_000), (True, 400_001), (True, 400_000), (True, None), (False, 50_000), (True, 1)], "page")
        self.assertEqual(code, 1, out)
        # Cycle 1 is small, cycle 2 is over, cycle 3 is exactly at the line, cycle 4's size can't be read, cycle 5 commits nothing.
        self.assertEqual(self.prompts(), ["instruction", "instruction", "compact", "instruction", "instruction", "compact", "instruction"])
        self.assertIn("cycle 1: ended at 120000 tokens: no compact", out)
        self.assertIn("cycle 2: ended at 400001 tokens, above 400000: compact", out)
        self.assertIn("cycle 3: ended at 400000 tokens: no compact", out)
        self.assertIn("cycle 4: couldn't read the session's size, so compact", out)
        self.assertIn("cycle 5: no commit, stopping", out)
        self.assertNotIn("900000", out, "a subagent's context is not the session's")
        # The instruction is the moonshot word for word, then what a cycle is; the same every cycle.
        instruction = self.calls[0]["prompt"]
        self.assertTrue(instruction.startswith(MOONSHOT.strip() + "\n\nThis is one cycle of an unattended loop"), instruction)
        self.assertIn("python3 llm-dlc/tools/sync.py commit", instruction)
        self.assertIn("Never push or deploy.", instruction)
        self.assertEqual({c["prompt"] for c in self.calls if c["prompt"] != "/compact"}, {instruction})
        # One session: made by the first turn, resumed by every later one, and kept for the next run.
        session = (self.root / "llm-dlc/loop-summaries/moonshot-page.session").read_text().strip()
        self.assertRegex(session, r"^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$")
        self.assertIn(["--session-id", session], [self.calls[0]["args"][2:4]])
        for call in self.calls[1:]:
            self.assertEqual(call["args"][2:4], ["--resume", session])
        for call in self.calls:
            # Fable 5.2 at high effort unless the run says otherwise, on the compact as on the instruction.
            self.assertEqual(call["args"][4:8], ["--model", "claude-fable-5-2", "--effort", "high"])
            self.assertEqual(call["args"][-5:], ["--permission-mode", "auto", "--output-format", "stream-json", "--verbose"])
        # The record: the instruction, a line per commit, and how it ended.
        record = self.record()
        self.assertIn("> Make the page better.", record)
        self.assertEqual(re.findall(r"^- cycle (\d), .*: (.*)$", record, re.M),
                         [(str(n), f"Work of cycle {n}") for n in (1, 2, 3, 4)])
        self.assertIn(f"session {session}, claude-fable-5-2 at high effort, compacting above 400000 tokens.", record)
        self.assertRegex(record, rf"Stopped .*: cycle 5 made no commit; session {session} needs attention\.")
        self.assertIn(f"session: {session}", out.splitlines()[-1])
        self.assertEqual(list(Path(self.tmp.name).glob("moonshot-loop.*")), [], "the turn's events are not left behind")

    def test_a_count_of_cycles_ends_the_loop_without_a_last_compact(self):
        code, out = self.loop([(True, 900_000), (True, 900_000), (True, 900_000)], "page", "2")
        self.assertEqual(code, 0, out)
        self.assertEqual(self.prompts(), ["instruction", "compact", "instruction"])
        self.assertIn("cycle 2 of 2: page", out)
        self.assertRegex(self.record(), r"Ended .* after 2 cycle\(s\)\.")

    def test_the_session_model_effort_and_threshold_can_be_set(self):
        transcripts = Path(self.env["CLAUDE_CONFIG_DIR"]) / "projects" / re.sub(r"[^A-Za-z0-9]", "-", str(self.root.resolve()))
        transcripts.mkdir(parents=True)
        (transcripts / f"{SESSION}.jsonl").write_text("{}\n")
        code, out = self.loop([(True, 150_000), (True, 99_999)], "page", "2", MOONSHOT_SESSION=SESSION, MOONSHOT_MODEL="claude-opus-5-5",
                              MOONSHOT_EFFORT="medium", MOONSHOT_COMPACT_ABOVE="100000")
        self.assertEqual(code, 0, out)
        self.assertEqual(self.prompts(), ["instruction", "compact", "instruction"])
        for call in self.calls:
            # A session that has a transcript is resumed from the first turn.
            self.assertEqual(call["args"][2:8], ["--resume", SESSION, "--model", "claude-opus-5-5", "--effort", "medium"])
        # The next run needs no session named: it is the one kept.
        (self.root / "llm-dlc" / "loop-summaries").joinpath(next(p.name for p in (self.root / "llm-dlc/loop-summaries").glob("*.md"))).unlink()
        code, out = self.loop([(False, 1)], "page")
        self.assertEqual(code, 1, out)
        self.assertEqual(self.calls[0]["args"][2:4], ["--resume", SESSION])

    def test_bad_arguments(self):
        for args, env in ([], {}), (["page", "2", "3"], {}), (["nothing"], {}), (["page", "0"], {}), (["page", "many"], {}), \
                (["../page"], {}), (["page"], {"MOONSHOT_SESSION": "not-an-id"}), (["page"], {"MOONSHOT_COMPACT_ABOVE": "lots"}):
            code, out = self.loop([(True, 1)], *args, **env)
            self.assertEqual(code, 2, f"{args} {env}: {out}")
            self.assertEqual(self.calls, [], f"{args} {env}")


if __name__ == "__main__":
    unittest.main()
