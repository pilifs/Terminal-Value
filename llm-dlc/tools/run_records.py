#!/usr/bin/env python3
"""Copies a stream's run records into the default workspace, where they are read together.

feature-loop.sh writes a record of each run in llm-dlc/loop-summaries/ of the workspace it runs in
(gitignored). A stream's records are its own workspace's, so run-streams.sh copies them into the
default workspace after each of the stream's runs and before the merge, so that the merge loop and
the status bar find every run's record in one place. A record only grows, so a copy is replaced
only by the record it is a start of; one that is not (edited, or another run's of the same name)
is left, and reported. Files there that are not run records, such as integration reports, are not
copied.

Usage: python3 llm-dlc/tools/run_records.py collect STREAM_WORKSPACE DEFAULT_WORKSPACE
"""
import os
import shutil
import sys
import tempfile
from pathlib import Path

FOLDER = Path("llm-dlc") / "loop-summaries"
HEADER = b"# Feature loop:"  # how feature-loop.sh starts a record


def collect(stream: Path, default: Path) -> list[str]:
    """Copies each run record of the workspace `stream` into the workspace `default` that is new
    there or has grown since it was copied; returns the names copied, oldest first."""
    src, dest = stream / FOLDER, default / FOLDER
    if src.resolve() == dest.resolve() or not src.is_dir():
        return []
    copied = []
    for path in sorted(src.glob("*.md")):
        data = path.read_bytes()
        if not data.startswith(HEADER):
            continue
        target = dest / path.name
        old = target.read_bytes() if target.exists() else None
        if old == data:
            continue
        if old is not None and not data.startswith(old):
            print(f"{path.name}: not copied: {target} is not a start of {path}, so one of them is not this run's record")
            continue
        dest.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=dest, prefix=f".{path.name}.")
        os.close(fd)
        shutil.copy2(path, tmp)
        os.replace(tmp, target)
        copied.append(path.name)
    return copied


def main(argv: list[str]) -> int:
    if len(argv) != 3 or argv[0] != "collect":
        print(__doc__.strip().splitlines()[-1], file=sys.stderr)
        return 2
    for name in collect(Path(argv[1]), Path(argv[2])):
        print(f"copied the run record {name} into {Path(argv[2]) / FOLDER}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
