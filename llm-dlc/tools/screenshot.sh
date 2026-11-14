#!/usr/bin/env bash
# Screenshots of a page in headless Chromium, for visual review by people and loops.
# Playwright is pinned here and run with npx: it is not a dependency of the site.
#
# Usage: llm-dlc/tools/screenshot.sh URL OUT_PREFIX
#   Writes OUT_PREFIX-{desktop,mobile}-{light,dark}.png: full-page shots at
#   1280x900 and 390x844, in each colour scheme. Serve the site first, for
#   example: PORT=8791 npm run dev
#
#        llm-dlc/tools/screenshot.sh --setup
#   Downloads Playwright's Chromium into ~/.cache/ms-playwright (no sudo). On a
#   machine without Chromium's system libraries, it prints the apt command that
#   installs them (Ubuntu 26.04 package names), for a person with sudo to run.
#
# Exits 0 when every shot was written, 1 otherwise, 2 for a bad argument.

set -uo pipefail
PLAYWRIGHT=playwright@1.64.1  # released 2026-10-14
LIBS=(libasound2t64 libatk1.0-0t64 libatk-bridge2.0-0t64 libatspi2.0-0t64 libgbm1 libnspr4 libnss3
      libxcomposite1 libxdamage1 libxfixes3 libxkbcommon0 libxrandr2 fonts-liberation)

if [[ "${1:-}" == --setup ]]; then
  npx -y "$PLAYWRIGHT" install chromium || exit 1
  shell=$(ls -d "$HOME"/.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell 2>/dev/null | tail -1)
  if [[ -n "$shell" ]] && ldd "$shell" | grep -q 'not found'; then
    echo "Chromium is missing system libraries: $(ldd "$shell" | awk '/not found/ { print $1 }' | tr '\n' ' ')"
    echo "install them with: sudo apt-get install -y --no-install-recommends ${LIBS[*]}"
    exit 1
  fi
  echo "headless Chromium is ready"
  exit 0
fi

(( $# == 2 )) || { sed -n '4,13p' "$0" >&2; exit 2; }
URL=$1 OUT=$2
mkdir -p "$(dirname "$OUT")"
failed=0
for view in desktop:1280,900 mobile:390,844; do
  for scheme in light dark; do
    file="$OUT-${view%%:*}-$scheme.png"
    if npx -y "$PLAYWRIGHT" screenshot -b chromium --viewport-size="${view#*:}" --color-scheme="$scheme" \
        --full-page --wait-for-timeout=500 "$URL" "$file" >/dev/null 2>&1 && [[ -s "$file" ]]; then
      echo "wrote $file"
    else
      echo "could not shoot $URL as ${view%%:*} $scheme (run llm-dlc/tools/screenshot.sh --setup)" >&2
      failed=1
    fi
  done
done
exit $failed
