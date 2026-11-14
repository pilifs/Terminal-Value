#!/usr/bin/env python3
"""Find the jj workspaces of this repository that are no longer used, and prove that deleting
them loses nothing. It only reports, and prints the command that deletes the safe ones, for a
person to run.

Usage: python3 llm-dlc/tools/prune_workspaces.py [--into REV] [NAME|PATH ...]
       python3 llm-dlc/tools/prune_workspaces.py --delete [--into REV] [--archive DIR] NAME ...

Run from the default workspace. Without names it considers every workspace but the
default: the ones jj still lists, and the directories of forgotten ones, siblings of the
default workspace named REPO-* whose .jj/repo points at this repository.

A workspace is deleted only when all of these hold. Anything else blocks it, and the report
says why.

1. Nothing uses it: no process has its working directory, or a file open, inside it, and
   no unfinished loop owns it. A brief run as streams names its workspaces after itself
   (factory-data for llm-dlc/loops/factory.md), and its merge loop forgets them at the
   end, so they are kept while that brief's status is neither done nor blocked.
2. Its commits are merged (listed workspaces): every commit of `::WS@` that isn't in
   `::INTO` is empty and has no description. INTO is the default workspace's `@-` unless
   --into names another revset; several commits (a merge's parents) mean the union of
   their ancestors.
3. Every file in its directory, tracked, untracked or gitignored alike, is recoverable (the
   workspace's own metadata aside: .jj, and the `.git` pointer file jj writes into a newer
   workspace; a .git directory blocks):
   - a blob reachable from INTO has its exact content (it was committed at some path, at
     some point of INTO's history; a symlink compares by its target, as git stores it), or
   - a file in the default workspace has its exact content, at any path: a run record copied
     in, an identical .env, a job's work directory; or
   - it lies in a directory that is both gitignored there and one of the build outputs
     named in REGENERABLE (target/, build/, __pycache__/, ...), which a build makes again.

   The check reads file contents, not jj's view of them, so edits jj never snapshotted (a
   stale or forgotten workspace's) count like any other. Gitignored files are never in
   history, so outside the build outputs they must match a file of the default workspace;
   llm-dlc/loop-summaries/, .env files and the like usually do once a reconcile has copied
   them, and otherwise block. --archive DIR copies the files that
   would be lost to DIR/NAME/PATH, checks each copy, and then counts them as recoverable; it
   writes, so it goes with --delete only.

--delete is a person's, from their own terminal: it refuses
without a terminal, or in Claude Code's environment. It takes the workspaces by name, checks
them all again, lists the safe ones and asks to type "delete". Then, re-checking rule 1 just
before each, it runs `jj workspace forget` for a listed workspace, removes the directory
and prunes git's record of a worktree that is gone. Session transcripts that Claude Code
filed under the directory (~/.claude/projects/...) are left alone and named in the report. Exit status: 0 when every workspace considered is safe (or
was deleted), 1 when any is blocked or refused, 2 on a usage error.
"""

from __future__ import annotations

import argparse
import hashlib
import os
import shlex
import shutil
import stat
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

# Directory names whose contents a build makes again. One counts only where it is
# gitignored too, so a tracked directory of the same name is checked file by file.
REGENERABLE = {"target", "build", "out", ".gradle", "__pycache__", ".lake", "node_modules", ".pytest_cache", "dist", ".wrangler"}


def run(cmd: list[str], cwd: Path | None = None, stdin: bytes | None = None) -> bytes:
    result = subprocess.run(cmd, cwd=cwd, input=stdin, capture_output=True)
    if result.returncode != 0:
        raise RuntimeError(f"{' '.join(cmd)} failed: {result.stderr.decode(errors='replace').strip()}")
    return result.stdout


def jj(root: Path, *args: str) -> str:
    # --ignore-working-copy: never snapshot or touch another workspace's working copy.
    return run(["jj", "--ignore-working-copy", *args], cwd=root).decode()


def blob_id(data: bytes) -> str:
    return hashlib.sha1(b"blob %d\0" % len(data) + data).hexdigest()


def file_blob(path: Path) -> str:
    if path.is_symlink():
        return blob_id(os.fsencode(os.readlink(path)))
    h = hashlib.sha1()
    h.update(b"blob %d\0" % path.stat().st_size)
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


@dataclass
class Workspace:
    name: str
    path: Path
    listed: bool  # jj still lists it (else a forgotten workspace's directory)
    problems: list[str] = field(default_factory=list)
    lost: list[tuple[str, int, bool]] = field(default_factory=list)  # (relative path, size, gitignored)
    files: int = 0
    regenerated: int = 0  # bytes in build outputs, not checked file by file
    sessions: Path | None = None


class Repo:
    def __init__(self, root: Path, into: str):
        self.root = root
        self.git_dir = root / ".git"
        out = jj(root, "log", "-r", into, "--no-graph", "-T", 'commit_id ++ "\\n"').split()
        if not out:
            raise RuntimeError(f"--into {into} names no commit")
        # Several commits (a merge's parents, say) mean the union of their ancestors.
        self.intos = out
        self.into = "|".join(out)
        self.into_label = into
        self._reachable: set[str] | None = None
        self._default_by_size: dict[int, list[Path]] | None = None
        self._default_hashed: dict[Path, str] = {}

    def reachable(self) -> set[str]:
        """Every object id reachable from INTO, blobs included."""
        if self._reachable is None:
            out = run(["git", "--git-dir", str(self.git_dir), "rev-list", "--objects", *self.intos])
            self._reachable = {line.split(b" ", 1)[0].decode() for line in out.splitlines() if line}
        return self._reachable

    def default_has(self, blob: str, size: int) -> bool:
        """Whether some file of the default workspace has this content. Files are hashed only
        when their size matches, so a large ignored tree costs a walk, not a read."""
        if self._default_by_size is None:
            self._default_by_size = {}
            for path in walk_files(self.root):
                try:
                    st = path.lstat()
                except OSError:
                    continue
                if stat.S_ISREG(st.st_mode) or stat.S_ISLNK(st.st_mode):
                    key = len(os.fsencode(os.readlink(path))) if stat.S_ISLNK(st.st_mode) else st.st_size
                    self._default_by_size.setdefault(key, []).append(path)
        for path in self._default_by_size.get(size, []):
            if path not in self._default_hashed:
                try:
                    self._default_hashed[path] = file_blob(path)
                except OSError:
                    self._default_hashed[path] = ""
            if self._default_hashed[path] == blob:
                return True
        return False


def git_pointer(path: Path) -> bool:
    """Whether path is a `.git` file that only points at a git directory elsewhere (`gitdir: ...`), as
    jj writes into a secondary workspace of a colocated repository: metadata, like .jj."""
    try:
        return path.is_file() and not path.is_symlink() and path.stat().st_size < 4096 and path.read_text().startswith("gitdir: ")
    except (OSError, UnicodeDecodeError):
        return False


def metadata(top: Path, dirpath: str, name: str) -> bool:
    """The workspace's own metadata at its top level: .jj, and a .git pointer file."""
    return Path(dirpath) == top and (name == ".jj" or (name == ".git" and git_pointer(top / ".git")))


def walk_files(top: Path):
    """Every file and symlink under top, the workspace metadata excluded, not following symlinked directories."""
    for dirpath, dirnames, filenames in os.walk(top):
        dirnames[:] = [d for d in dirnames if not metadata(top, dirpath, d)]
        for name in [f for f in filenames if not metadata(top, dirpath, f)] + [d for d in dirnames if os.path.islink(os.path.join(dirpath, d))]:
            yield Path(dirpath, name)


def ignored(repo: Repo, top: Path, rels: list[str]) -> set[str]:
    """Which of rels (relative to top) are gitignored, by the .gitignore files in top itself."""
    if not rels:
        return set()
    cmd = ["git", "--git-dir", str(repo.git_dir), "--work-tree", str(top), "check-ignore", "--no-index", "--stdin", "-z"]
    result = subprocess.run(cmd, cwd=top, input=b"\0".join(os.fsencode(r) for r in rels) + b"\0", capture_output=True)
    if result.returncode not in (0, 1):  # 1: none ignored
        raise RuntimeError(f"git check-ignore failed in {top}: {result.stderr.decode(errors='replace').strip()}")
    return {os.fsdecode(p) for p in result.stdout.split(b"\0") if p}


def users(path: Path) -> list[str]:
    """Processes whose working directory or an open file is inside path (those this user can see)."""
    found = []
    prefix = str(path.resolve()) + os.sep
    me = os.getpid()
    for pid in os.listdir("/proc"):
        if not pid.isdigit() or int(pid) == me:
            continue
        links = [f"/proc/{pid}/cwd", f"/proc/{pid}/root"]
        try:
            links += [f"/proc/{pid}/fd/{fd}" for fd in os.listdir(f"/proc/{pid}/fd")]
        except OSError:
            pass
        for link in links:
            try:
                target = os.readlink(link)
            except OSError:
                continue
            if target.removesuffix(" (deleted)").startswith(prefix) or target == prefix[:-1]:
                try:
                    cmd = Path(f"/proc/{pid}/cmdline").read_bytes().replace(b"\0", b" ").decode(errors="replace").strip()
                except OSError:
                    cmd = "?"
                found.append(f"pid {pid} ({cmd[:80]})")
                break
    return found


def discover(repo: Repo) -> list[Workspace]:
    spaces = []
    seen: set[Path] = set()
    out = jj(repo.root, "workspace", "list", "-T", 'name ++ "\\n"')
    for name in out.split():
        path = Path(jj(repo.root, "workspace", "root", "--name", name).strip()).resolve()
        seen.add(path)
        if name != "default":
            spaces.append(Workspace(name, path, listed=True))
    stem = repo.root.name + "-"
    for path in sorted(repo.root.parent.iterdir()):
        if not path.name.startswith(stem) or path.resolve() in seen or not path.is_dir():
            continue
        pointer = path / ".jj" / "repo"
        if pointer.is_file():
            target = (path / ".jj" / pointer.read_text().strip()).resolve()
            if target == (repo.root / ".jj" / "repo").resolve():
                spaces.append(Workspace(path.name[len(stem):], path.resolve(), listed=False))
    return spaces


def unfinished_loop(root: Path, name: str) -> str | None:
    """The brief whose loop a workspace belongs to, while that loop is unfinished. A brief run as
    streams names its workspaces after itself (factory-data, factory-integration for
    llm-dlc/loops/factory.md), and its merge loop forgets them at the end; until its status
    (the last `- Status:` line, in the default workspace's copy) is done or blocked, they are its."""
    loops = root / "llm-dlc" / "loops"
    if not loops.is_dir():
        return None
    briefs = sorted((b for b in loops.glob("*.md") if name.startswith(b.stem + "-")), key=lambda b: -len(b.stem))
    for brief in briefs[:1]:
        status = ""
        for line in brief.read_text(errors="replace").splitlines():
            if line.lstrip("-* ").startswith("Status:"):
                status = line.lstrip("-* ").removeprefix("Status:").strip().strip("`")
        if not (status.startswith("done") or status.startswith("blocked")):
            return f"{brief.relative_to(root)} (status: {status or 'none'})"
    return None


def sessions_dir(path: Path) -> Path | None:
    d = Path.home() / ".claude" / "projects" / str(path).replace("/", "-").replace(".", "-")
    return d if d.is_dir() else None


def check(repo: Repo, ws: Workspace, archive: Path | None) -> None:
    ws.sessions = sessions_dir(ws.path)
    if not ws.path.is_dir():
        ws.problems.append(f"{ws.path} is not a directory")
        return
    if (ws.path / ".git").is_dir():
        ws.problems.append("it holds a .git directory, a git repository of its own: look at it by hand")
    if loop := unfinished_loop(repo.root, ws.name):
        ws.problems.append(f"its loop is unfinished: {loop}")
    if here := users(ws.path):
        ws.problems.append("in use by " + "; ".join(here))
    if ws.listed:
        unmerged = jj(repo.root, "log", "-r", f'(::{ws.name}@ ~ ::({repo.into})) ~ (empty() & description(exact:""))', "--no-graph",
                      "-T", 'change_id.short(8) ++ " " ++ if(empty, "(empty) ", "") ++ description.first_line() ++ "\\n"').strip()
        if unmerged:
            lines = unmerged.splitlines()
            ws.problems.append(f"{len(lines)} commit(s) not in ::{repo.into_label}: " + "; ".join(lines[:5]) + (" ..." if len(lines) > 5 else ""))

    # Build outputs: directories named in REGENERABLE that are gitignored here.
    candidates = []
    for dirpath, dirnames, _ in os.walk(ws.path):
        dirnames[:] = [d for d in dirnames if not metadata(ws.path, dirpath, d)]
        for d in dirnames:
            if d in REGENERABLE:
                candidates.append(os.path.relpath(os.path.join(dirpath, d), ws.path) + "/")
        dirnames[:] = [d for d in dirnames if d not in REGENERABLE]
    outputs = ignored(repo, ws.path, candidates)
    skip = {ws.path / c.rstrip("/") for c in outputs}
    for c in outputs:
        for p in walk_files(ws.path / c.rstrip("/")):
            try:
                ws.regenerated += p.lstat().st_size
            except OSError:
                pass

    pending: list[tuple[str, Path, str, int]] = []
    for dirpath, dirnames, filenames in os.walk(ws.path):
        here_dir = Path(dirpath)
        dirnames[:] = [d for d in dirnames if not metadata(ws.path, dirpath, d) and here_dir / d not in skip]
        names = [f for f in filenames if not metadata(ws.path, dirpath, f)] + [d for d in dirnames if os.path.islink(os.path.join(dirpath, d))]
        for name in names:
            p = here_dir / name
            rel = os.path.relpath(p, ws.path)
            st = p.lstat()
            if not (stat.S_ISREG(st.st_mode) or stat.S_ISLNK(st.st_mode)):
                ws.problems.append(f"{rel} is a special file (socket, fifo or device)")
                continue
            ws.files += 1
            blob = file_blob(p)
            if blob in repo.reachable():
                continue
            size = len(os.fsencode(os.readlink(p))) if stat.S_ISLNK(st.st_mode) else st.st_size
            if repo.default_has(blob, size):
                continue
            pending.append((rel, p, blob, size))

    flags = ignored(repo, ws.path, [rel for rel, *_ in pending])
    for rel, p, blob, size in pending:
        if archive is not None:
            dest = archive / ws.name / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            if p.is_symlink():
                if dest.is_symlink() or dest.exists():
                    dest.unlink()
                os.symlink(os.readlink(p), dest)
            else:
                shutil.copy2(p, dest)
            if file_blob(dest) == blob:
                continue
            ws.problems.append(f"the archived copy of {rel} differs from it")
        ws.lost.append((rel, size, rel in flags))
    if ws.lost:
        ws.problems.append(f"{len(ws.lost)} file(s) recoverable from nowhere (listed below; --archive DIR keeps them)")


def human(n: int) -> str:
    for unit in ("B", "KiB", "MiB", "GiB"):
        if n < 1024 or unit == "GiB":
            return f"{n:.0f} {unit}" if unit == "B" else f"{n:.1f} {unit}"
        n /= 1024
    return str(n)


CONFIRMATION = "delete"


def person_at_terminal() -> bool:
    """A check that an agent's shell fails: it has no terminal, and Claude Code marks its environment."""
    return sys.stdin.isatty() and sys.stdout.isatty() and not os.environ.get("CLAUDECODE")


def report(ws: Workspace) -> None:
    kind = "listed" if ws.listed else "forgotten"
    print(f"\n{ws.name} ({kind}, {ws.path}): {'BLOCKED' if ws.problems else 'safe to delete'}")
    print(f"  {ws.files} file(s) checked, each in history or the default workspace" if not ws.lost else f"  {ws.files} file(s) checked")
    if ws.regenerated:
        print(f"  {human(ws.regenerated)} of gitignored build output not checked (regenerable)")
    for p in ws.problems:
        print(f"  - {p}")
    for rel, size, ign in ws.lost[:50]:
        print(f"    {rel} ({human(size)}{', gitignored' if ign else ''})")
    if len(ws.lost) > 50:
        print(f"    ... and {len(ws.lost) - 50} more")
    if ws.sessions:
        print(f"  its Claude Code sessions stay in {ws.sessions}")


def command(names: list[str], into: str, archive: bool = False) -> str:
    parts = ["python3", "llm-dlc/tools/prune_workspaces.py", "--delete"]
    if into != "@-":
        parts += ["--into", shlex.quote(into)]
    if archive:
        parts += ["--archive", "DIR"]
    return " ".join(parts + [shlex.quote(n) for n in names])


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0], formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("workspaces", nargs="*", help="names or directories; default: every workspace but the default")
    ap.add_argument("--into", default="@-", help="the revision a workspace's work must be merged into (default: the default workspace's @-)")
    ap.add_argument("--delete", action="store_true", help="forget and delete the named workspaces that are safe: a person only, from their own terminal")
    ap.add_argument("--archive", type=Path, help="with --delete: copy files that would be lost to ARCHIVE/NAME/PATH first, then count them as kept")
    args = ap.parse_args(argv)
    if args.archive is not None and not args.delete:
        print("--archive writes files, so it goes with --delete only; without it the script only reports", file=sys.stderr)
        return 2
    if args.delete and not args.workspaces:
        print("--delete takes the workspaces to delete by name, as the report's command lists them", file=sys.stderr)
        return 2
    if args.delete and not person_at_terminal():
        print("refused: a person must delete workspaces, from their own terminal. Ask them to run this command.", file=sys.stderr)
        return 1

    try:
        root = Path(run(["jj", "--ignore-working-copy", "workspace", "root", "--name", "default"]).decode().strip()).resolve()
    except RuntimeError as e:
        print(f"not in a jj repository with a default workspace: {e}", file=sys.stderr)
        return 2
    here = Path(run(["jj", "--ignore-working-copy", "workspace", "root"]).decode().strip()).resolve()
    if here != root:
        print(f"run this from the default workspace ({root}), not {here}", file=sys.stderr)
        return 2
    repo = Repo(root, args.into)
    spaces = discover(repo)
    if args.workspaces:
        wanted = []
        for w in args.workspaces:
            match = [s for s in spaces if s.name == w or s.path == Path(w).resolve()]
            if not match:
                print(f"{w}: no such workspace or workspace directory (the default is never one)", file=sys.stderr)
                return 2
            wanted += match
        spaces = wanted
    if args.archive is not None:
        args.archive = args.archive.resolve()
        if any(args.archive == s.path or s.path in args.archive.parents for s in spaces):
            print("--archive must be outside the workspaces it may delete", file=sys.stderr)
            return 2

    print(f"merged means reachable from {args.into} ({', '.join(c[:12] for c in repo.intos)})")
    for ws in spaces:
        check(repo, ws, args.archive)
        report(ws)
    safe = [ws for ws in spaces if not ws.problems]
    blocked = [ws for ws in spaces if ws.problems]
    print(f"\n{len(spaces)} workspace(s): {len(safe)} safe to delete, {len(blocked)} blocked")

    if not args.delete:
        if safe:
            print("\nTo delete the safe ones, run this yourself, in your own terminal (it asks to confirm):")
            print(f"  {command([ws.name for ws in safe], args.into)}")
        keep = [ws for ws in blocked if ws.lost and all(p.startswith(f"{len(ws.lost)} file(s)") for p in ws.problems)]
        if keep:
            print("Blocked only by files found nowhere else; to copy them to DIR first, then delete:")
            print(f"  {command([ws.name for ws in keep], args.into, archive=True)}")
        return 1 if blocked else 0

    if not safe:
        print("nothing to delete")
        return 1
    print("\nTo forget and delete: " + ", ".join(f"{ws.name} ({ws.path})" for ws in safe))
    if input(f'Type "{CONFIRMATION}" to delete {len(safe)} workspace(s): ').strip() != CONFIRMATION:
        print("nothing deleted")
        return 1
    failed = len(blocked)
    for ws in safe:
        if again := users(ws.path):
            print(f"{ws.name}: not deleted, in use now by {'; '.join(again)}")
            failed += 1
            continue
        if ws.listed:
            jj(root, "workspace", "forget", ws.name)
        shutil.rmtree(ws.path)
        # A workspace jj made as a git worktree leaves git's record of it; prune drops records of missing worktrees only.
        run(["git", "--git-dir", str(repo.git_dir), "worktree", "prune"])
        print(f"{ws.name}: {'forgotten and deleted' if ws.listed else 'deleted'}")
    return 1 if failed else 0


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except RuntimeError as e:
        print(f"prune_workspaces.py: {e}", file=sys.stderr)
        sys.exit(2)
