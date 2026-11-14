#!/usr/bin/env bash
# The integration check for a brief of this site run as streams: run-streams.sh
# runs it (the brief's "- integration: llm-dlc/tools/site-integration.sh") from
# the workspace NAME-integration, on a merge of every stream's latest commit,
# while they run. run-streams.sh reports a merge conflict itself; this script
# tells the other outcomes apart, so the report says which one it was:
#   INSTALL FAILED  npm ci failed on the merged lockfile;
#   BUILD FAILED    a site build failed (projects, production, drafts);
#   TESTS FAILED    an npm test script (test, test:*) or a Python suite of
#                   llm-dlc/tools failed.
# It never deploys. A brief that needs more (a Wrangler check, say) names a
# script of its own that calls this one first.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

# A workspace starts without node_modules, and the merged lockfile can change:
# install again only when it did.
lock=$(sha256sum package-lock.json | cut -d' ' -f1)
if [[ ! -d node_modules || "$(cat node_modules/.lock-sha256 2>/dev/null)" != "$lock" ]]; then
  echo "== npm ci"
  npm ci --no-fund --no-audit || { echo "INSTALL FAILED"; exit 1; }
  printf '%s\n' "$lock" >node_modules/.lock-sha256
fi

status=0
build() { echo "== $*"; "$@" || { echo "BUILD FAILED: $*"; status=1; }; }
build npm run build:projects
build npm run build
build npm run build:drafts

run() { echo "== $*"; "$@" || { echo "TESTS FAILED: $*"; status=1; }; }
while IFS= read -r script; do
  run npm run --silent "$script"
done < <(node -e 'for (const s of Object.keys(require("./package.json").scripts || {})) if (s === "test" || s.startsWith("test:")) console.log(s)')
for suite in llm-dlc/tools/test_*.py; do
  run python3 "$suite"
done
exit $status
