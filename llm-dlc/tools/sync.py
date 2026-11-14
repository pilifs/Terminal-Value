#!/usr/bin/env python3
"""Commit, check and push this repo with jj, for people and agent loops alike.

A lightweight version of in-the-loop's llm-dlc/tools/sync.py: the same commands and the same
contract with feature-loop.sh (a commit finishes @ and starts an empty change, so a commit moves
@-), without session traces, Langfuse, redaction or a CDN.

Commands:
  sync.py init                  colocate jj with this git repo (once per clone; a no-op after), and
                                track the remote main bookmark
  sync.py commit -m SUMMARY [-m PARAGRAPH ...]
                                describe @ with the message (each -m is one paragraph, as in git), start
                                a new empty change on top, then check the commit just made; refuses an
                                @ with no changes unless it is a merge
  sync.py check [REVSET]        check commits: by default those not pushed yet in the history of @
                                (`mutable() & ::@-`). ERROR lines must be fixed, warn lines are for a
                                person to judge. Exits 1 on any error
  sync.py push [JJ GIT PUSH ARGS]
                                refuse uncommitted work in @, check every unpushed commit, move each
                                --bookmark NAME to @-, then `jj git push` with the same arguments.
                                Push only when the author asks: `sync.py push --bookmark main`

What check looks at, per commit:
  ERROR  a conflict left in the commit
  ERROR  no description
  ERROR  a file that holds credentials by its name (.env, .dev.vars, *.pem, ...)
  ERROR  an added line that looks like a secret (a private key, an API token of a known shape)
  warn   a summary line over 72 characters, or no paragraph after it
  warn   an empty commit that isn't a merge
  warn   a change under projects/terminal-value-pipeline/, which is archived (AGENTS.md)
  warn   a file over 2 MiB

Standard library only.
"""
from __future__ import annotations

import fnmatch
import re
import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
JJ = shutil.which("jj") or str(Path.home() / ".local" / "bin" / "jj")
DEFAULT_REVSET = "mutable() & ::@-"
SUMMARY_MAX = 72
BIG_FILE = 2 * 1024 * 1024
ARCHIVED = ("projects/terminal-value-pipeline/",)

# Files that hold credentials by their name. Examples and templates of them are fine.
SECRET_FILES = (".env", ".env.*", ".dev.vars", ".dev.vars.*", "*.pem", "*.key", "*.p12", "*.pfx",
                "id_rsa*", "id_ed25519*", "credentials.json", "*-credentials", ".npmrc", ".netrc")
SECRET_FILE_OK = ("*.example", "*.sample", "*.template")

# Added lines that look like a secret: shapes that are unambiguous, so a match is worth stopping for.
SECRET_LINES = [
    ("private key", re.compile(r"-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----")),
    ("Anthropic API key", re.compile(r"\bsk-ant-[A-Za-z0-9_-]{20,}")),
    ("OpenAI API key", re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9]{32,}")),
    ("GitHub token", re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})")),
    ("AWS access key id", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("Slack token", re.compile(r"\bxox[abposr]-[A-Za-z0-9-]{10,}")),
    ("Google API key", re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b")),
]

COMMIT_TEMPLATE = ('change_id.short(12) ++ "\\t" ++ commit_id ++ "\\t" ++ if(conflict, "1", "0") ++ "\\t" ++ '
                   'if(empty, "1", "0") ++ "\\t" ++ parents.len() ++ "\\t" ++ '
                   'description.escape_json() ++ "\\n"')


def jj(*args: str, check: bool = False) -> subprocess.CompletedProcess:
    r = subprocess.run([JJ, *args], cwd=REPO, capture_output=True, text=True)
    if check and r.returncode:
        raise SystemExit(f"jj {' '.join(args)} failed: {r.stderr.strip()}")
    return r


def has_jj_repo() -> bool:
    return jj("root", "--ignore-working-copy").returncode == 0


def commits(revset: str) -> list[dict]:
    import json
    out = jj("log", "--no-graph", "-r", revset, "-T", COMMIT_TEMPLATE, check=True).stdout
    found = []
    for line in out.splitlines():
        if not line:
            continue
        change, commit, conflict, empty, parents, desc = line.split("\t", 5)
        found.append({"change_id": change, "commit_id": commit, "conflict": conflict == "1",
                      "empty": empty == "1", "parents": int(parents), "description": json.loads(desc)})
    return found


def secret_file(path: str) -> bool:
    name = Path(path).name
    return (any(fnmatch.fnmatch(name, p) for p in SECRET_FILES)
            and not any(fnmatch.fnmatch(name, p) for p in SECRET_FILE_OK))


def changed_files(commit_id: str) -> list[tuple[str, str]]:
    """(status letter, path) for each file the commit changes; a rename gives its new path."""
    files = []
    for line in jj("diff", "-r", commit_id, "--summary", check=True).stdout.splitlines():
        status, _, path = line.partition(" ")
        if status in ("R", "C") and " => " in path:  # "R {old => new}" or "R old => new"
            m = re.match(r"^(.*)\{(.*) => (.*)\}(.*)$", path)
            path = (m[1] + m[3] + m[4]) if m else path.split(" => ", 1)[1]
        files.append((status, path))
    return files


def added_lines(commit_id: str) -> list[tuple[str, str]]:
    """(path, line) for each line the commit adds, from its git-format diff."""
    lines, path = [], ""
    for line in jj("diff", "-r", commit_id, "--git", check=True).stdout.splitlines():
        if line.startswith("+++ "):
            path = line[6:] if line.startswith("+++ b/") else ""
        elif line.startswith("+") and not line.startswith("+++"):
            lines.append((path, line[1:]))
    return lines


def file_size(commit_id: str, path: str) -> int:
    r = subprocess.run(["git", "cat-file", "-s", f"{commit_id}:{path}"], cwd=REPO, capture_output=True, text=True)
    return int(r.stdout.strip()) if r.returncode == 0 and r.stdout.strip().isdigit() else 0


def problems(c: dict) -> tuple[list[str], list[str]]:
    """The errors and warnings of one commit, each prefixed with its change id."""
    errors, warnings = [], []
    at = c["change_id"]
    summary, _, body = c["description"].strip().partition("\n")
    if c["conflict"]:
        errors.append(f"{at}: has a conflict; resolve it (jj resolve --list) and commit the resolution")
    if not summary.strip():
        errors.append(f"{at}: has no description; describe it with what changed and why")
    else:
        if len(summary) > SUMMARY_MAX:
            warnings.append(f"{at}: the summary line is {len(summary)} characters, over {SUMMARY_MAX}")
        if not body.strip():
            warnings.append(f"{at}: no paragraph after the summary line saying what changed, why, and how it was verified")
    if c["empty"] and c["parents"] < 2:
        warnings.append(f"{at}: is empty")
    files = changed_files(c["commit_id"])
    for status, path in files:
        if status != "D" and secret_file(path):
            errors.append(f"{at}: {path} is a credentials file by its name; keep it out of the repo (.gitignore)")
        if path.startswith(ARCHIVED):
            warnings.append(f"{at}: changes {path}, under an archived project (AGENTS.md: only when asked)")
        if status != "D" and (size := file_size(c["commit_id"], path)) > BIG_FILE:
            warnings.append(f"{at}: {path} is {size / 1024 / 1024:.1f} MiB")
    for path, line in added_lines(c["commit_id"]):
        for kind, pattern in SECRET_LINES:
            if pattern.search(line):
                errors.append(f"{at}: {path} adds what looks like a {kind}; remove it, and rotate it if it is real")
                break
    return errors, warnings


def cmd_check(args: list[str], quiet_when_clean: bool = False) -> int:
    if len(args) > 1:
        print("usage: sync.py check [REVSET]", file=sys.stderr)
        return 2
    if not has_jj_repo():
        print("no jj repo here: run python3 llm-dlc/tools/sync.py init", file=sys.stderr)
        return 1
    revset = args[0] if args else DEFAULT_REVSET
    found = commits(revset)
    errors, warnings = [], []
    for c in found:
        e, w = problems(c)
        errors += e
        warnings += w
    for w in warnings:
        print("warn ", w)
    for e in errors:
        print("ERROR", e)
    if not (quiet_when_clean and not errors and not warnings):
        print(f"{len(found)} commit(s) checked: {len(errors)} error(s), {len(warnings)} warning(s) for a person to judge")
    return 1 if errors else 0


def cmd_commit(args: list[str]) -> int:
    """Finish @ with the message, then start a new change, so the commit is @-."""
    if not args or len(args) % 2 or any(a != "-m" for a in args[::2]) or not args[1].strip():
        print("usage: sync.py commit -m SUMMARY [-m PARAGRAPH ...]", file=sys.stderr)
        return 2
    if not has_jj_repo():
        print("no jj repo here: run python3 llm-dlc/tools/sync.py init", file=sys.stderr)
        return 1
    at = commits("@")[0]  # snapshots the working copy
    if at["empty"] and at["parents"] < 2:
        print("nothing to commit: @ has no changes (jj status)", file=sys.stderr)
        return 1
    message = "\n\n".join(a.strip() for a in args[1::2] if a.strip())
    if jj("describe", "-r", "@", "-m", message).returncode:
        print("jj describe failed", file=sys.stderr)
        return 1
    if jj("new").returncode:
        print("jj new failed", file=sys.stderr)
        return 1
    print(f"committed {at['change_id']}")
    failed = cmd_check(["@-"])
    if failed:
        print(f"the check of {at['change_id']} found errors: fix them and commit the fix "
              "(or, for a secret, rewrite the commit before it is pushed)", file=sys.stderr)
    return failed


def cmd_push(args: list[str]) -> int:
    if not has_jj_repo():
        print("no jj repo here: run python3 llm-dlc/tools/sync.py init", file=sys.stderr)
        return 1
    work = jj("diff", "--name-only", check=True).stdout.split()
    if work:
        print("uncommitted work in @; commit it first with `sync.py commit`:\n  " + "\n  ".join(work), file=sys.stderr)
        return 1
    if cmd_check([]) != 0:
        print("the check failed; not pushing", file=sys.stderr)
        return 1
    for flag, name in zip(args, args[1:]):
        if flag in ("--bookmark", "-b"):
            r = jj("bookmark", "set", name, "-r", "@-")
            if r.returncode:
                print(f"could not move bookmark {name} to @-: {r.stderr.strip()}", file=sys.stderr)
                return 1
    return subprocess.run([JJ, "git", "push", *args], cwd=REPO).returncode


def cmd_init(args: list[str]) -> int:
    if args:
        print("usage: sync.py init", file=sys.stderr)
        return 2
    if not (REPO / ".jj").exists():
        if not (REPO / ".git").is_dir():
            print(f"{REPO} is not a git repository: nothing to colocate jj with", file=sys.stderr)
            return 1
        r = jj("git", "init", "--colocate")
        if r.returncode:
            print(f"jj git init --colocate failed: {r.stderr.strip()}", file=sys.stderr)
            return 1
        print(f"jj colocated with git in {REPO}")
    else:
        print("jj is already set up here")
    remotes = jj("git", "remote", "list").stdout.split()
    if "origin" in remotes and "main@origin" in jj("bookmark", "list", "--all-remotes", "main").stdout:
        r = jj("bookmark", "track", "main", "--remote", "origin")
        if r.returncode:
            r = jj("bookmark", "track", "main@origin")  # older jj
        print("main tracks main@origin" if r.returncode == 0 or "already tracked" in r.stderr
              else f"could not track main@origin: {r.stderr.strip()}")
    for key in ("user.name", "user.email"):
        if not jj("config", "get", key).stdout.strip():
            print(f"jj has no {key}: set it with jj config set --user {key} ...")
    return 0


def main(argv: list[str]) -> int:
    cmd, args = (argv[0], argv[1:]) if argv else ("", [])
    commands = {"init": cmd_init, "commit": cmd_commit, "check": cmd_check, "push": cmd_push}
    if cmd not in commands:
        print(__doc__)
        return 2
    return commands[cmd](args)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
