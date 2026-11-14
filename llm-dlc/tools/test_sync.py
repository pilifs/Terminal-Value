#!/usr/bin/env python3
"""Tests of sync.py, each on a throwaway colocated jj repository with a copy of the script.
Run: python3 llm-dlc/tools/test_sync.py

Values that look like secrets are assembled at run time, so this file itself passes the check."""

import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().with_name("sync.py")
ENV = {**os.environ, "JJ_USER": "Test", "JJ_EMAIL": "test@example.invalid", "JJ_CONFIG": "/dev/null"}
FAKE_TOKEN = "gh" + "p_" + "A1b2C3d4" * 5  # the shape of a GitHub token, made up


def sh(cwd, *cmd):
    return subprocess.run(cmd, cwd=cwd, env=ENV, check=True, capture_output=True, text=True).stdout


@unittest.skipUnless(shutil.which("jj"), "needs jj")
class SyncTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name) / "repo"
        (self.root / "llm-dlc" / "tools").mkdir(parents=True)
        shutil.copy(SCRIPT, self.root / "llm-dlc" / "tools" / "sync.py")
        sh(self.root, "git", "init", "-q")
        code, out = self.sync("init")
        self.assertEqual(code, 0, out)
        self.write("README.md", "base\n")
        self.assertEqual(self.sync("commit", "-m", "Add the base", "-m", "Made up.")[0], 0)

    def tearDown(self):
        self.tmp.cleanup()

    def sync(self, *args):
        r = subprocess.run([sys.executable, "llm-dlc/tools/sync.py", *args], cwd=self.root, env=ENV,
                           capture_output=True, text=True)
        return r.returncode, r.stdout + r.stderr

    def write(self, path, text):
        p = self.root / path
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text)

    def description(self, rev):
        return sh(self.root, "jj", "log", "--no-graph", "-r", rev, "-T", "description")

    def test_init_colocates_and_is_idempotent(self):
        self.assertTrue((self.root / ".jj").is_dir())
        code, out = self.sync("init")
        self.assertEqual(code, 0)
        self.assertIn("already set up", out)

    def test_commit_moves_at_minus_and_leaves_at_empty(self):
        self.write("a.txt", "one\n")
        code, out = self.sync("commit", "-m", "Add a", "-m", "Why and how it was verified.")
        self.assertEqual(code, 0, out)
        self.assertIn("0 error(s), 0 warning(s)", out)
        self.assertEqual(self.description("@-"), "Add a\n\nWhy and how it was verified.\n")
        self.assertEqual(sh(self.root, "jj", "diff", "--name-only"), "")

    def test_commit_refuses_an_empty_change(self):
        before = self.description("@-")
        code, out = self.sync("commit", "-m", "Nothing")
        self.assertEqual(code, 1)
        self.assertIn("nothing to commit", out)
        self.assertEqual(self.description("@-"), before)

    def test_usage(self):
        self.assertEqual(self.sync("commit")[0], 2)
        self.assertEqual(self.sync("commit", "-m", " ")[0], 2)
        self.assertEqual(self.sync("nonsense")[0], 2)

    def test_long_summary_and_no_body_warn(self):
        self.write("a.txt", "one\n")
        code, out = self.sync("commit", "-m", "x" * 80)
        self.assertEqual(code, 0, out)
        self.assertIn("over 72", out)
        self.assertIn("no paragraph after the summary", out)

    def test_credentials_file_is_an_error_but_its_example_is_not(self):
        self.write(".env.example", "TOKEN=\n")
        code, out = self.sync("commit", "-m", "Add an example", "-m", "Made up.")
        self.assertEqual(code, 0, out)
        self.write("site/.dev.vars", "TOKEN=x\n")
        code, out = self.sync("commit", "-m", "Add vars", "-m", "Made up.")
        self.assertEqual(code, 1, out)
        self.assertIn("site/.dev.vars is a credentials file", out)
        self.assertEqual(self.description("@-").splitlines()[0], "Add vars")  # the commit stands

    def test_renamed_into_a_credentials_file(self):
        self.write("notes.txt", "x\n")
        self.sync("commit", "-m", "Add notes", "-m", "Made up.")
        (self.root / "notes.txt").rename(self.root / ".env")
        code, out = self.sync("commit", "-m", "Rename", "-m", "Made up.")
        self.assertEqual(code, 1, out)
        self.assertIn(".env is a credentials file", out)

    def test_secret_shaped_line_is_an_error(self):
        self.write("config.js", f"export const token = '{FAKE_TOKEN}';\n")
        code, out = self.sync("commit", "-m", "Add config", "-m", "Made up.")
        self.assertEqual(code, 1, out)
        self.assertIn("config.js adds what looks like a GitHub token", out)
        self.assertNotIn(FAKE_TOKEN, out)

    def test_archived_project_warns(self):
        self.write("projects/terminal-value-pipeline/x.js", "1\n")
        code, out = self.sync("commit", "-m", "Touch the archive", "-m", "Made up.")
        self.assertEqual(code, 0, out)
        self.assertIn("archived project", out)

    def branch(self, name, path, text):
        sh(self.root, "jj", "new", "-r", "root()+")  # from the base commit
        self.write(path, text)
        self.sync("commit", "-m", name, "-m", "Made up.")
        return sh(self.root, "jj", "log", "--no-graph", "-r", "@-", "-T", "change_id").strip()

    def test_clean_merge_commits_and_conflict_is_an_error(self):
        a = self.branch("A", "a.txt", "a\n")
        b = self.branch("B", "b.txt", "b\n")
        sh(self.root, "jj", "new", a, b)
        code, out = self.sync("commit", "-m", "Merge A and B", "-m", "Made up.")
        self.assertEqual(code, 0, out)  # a clean merge has no diff of its own, and still commits
        self.assertNotIn("is empty", out)
        c = self.branch("C", "README.md", "one side\n")
        d = self.branch("D", "README.md", "other side\n")
        sh(self.root, "jj", "new", c, d)
        code, out = self.sync("commit", "-m", "Merge C and D", "-m", "Made up.")
        self.assertEqual(code, 1, out)
        self.assertIn("has a conflict", out)

    def test_check_defaults_to_unpushed_commits(self):
        code, out = self.sync("check")
        self.assertEqual(code, 0, out)
        self.assertIn("1 commit(s) checked", out)  # the base: no remote here, so nothing is pushed

    def test_push_refuses_uncommitted_work(self):
        self.write("wip.txt", "x\n")
        code, out = self.sync("push", "--bookmark", "main")
        self.assertEqual(code, 1)
        self.assertIn("uncommitted work in @", out)
        self.assertIn("wip.txt", out)


if __name__ == "__main__":
    unittest.main()
