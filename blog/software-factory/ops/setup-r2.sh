#!/usr/bin/env bash
# Sets up Cloudflare R2 for the Software Factory's published data (Milestone 2):
# the buckets software-factory-data (production) and software-factory-data-preview
# (preview), checked by writing, reading back and deleting a small object in each.
# Run it on a machine where wrangler is logged in (npx wrangler@4.65.0 login), from
# any directory. It is safe to run again: what exists is left as it is.
#
# Usage: blog/software-factory/ops/setup-r2.sh [--location enam] [--github] [--dry-run]
#   --location L  R2 location hint for new buckets (enam, wnam, weur, eeur, apac, oc;
#                 default enam, Eastern North America)
#   --github      afterwards, ask for the bucket-scoped R2 API token's values (hidden
#                 input) and store them as GitHub Actions secrets of pilifs/Terminal-Value
#                 with gh (needs gh auth login); nothing is echoed or written to disk
#   --dry-run     print the wrangler commands that would change something, and run none
#
# With several Cloudflare accounts, set CLOUDFLARE_ACCOUNT_ID first.
#
# What it does not do, because wrangler can't or shouldn't:
#   - create the R2 API token (dashboard only: printed as steps at the end);
#   - bind the buckets to the Pages project: the repo's wrangler.toml does that
#     (the merge loop writes it). The script saves the project's current settings,
#     with `wrangler pages download config`, so that file keeps them;
#   - deploy anything.

set -euo pipefail
WRANGLER=(npx -y wrangler@4.65.0)
PROJECT=terminal-value
REPO=pilifs/Terminal-Value
BUCKETS=(software-factory-data software-factory-data-preview)
LOCATION=enam
GITHUB=
DRY=

while (( $# )); do
  case "$1" in
    --location) LOCATION=$2; shift 2 ;;
    --github) GITHUB=1; shift ;;
    --dry-run) DRY=1; shift ;;
    *) sed -n '2,24p' "$0" >&2; exit 2 ;;
  esac
done
[[ "$LOCATION" =~ ^(enam|wnam|weur|eeur|apac|oc)$ ]] || { echo "unknown location $LOCATION" >&2; exit 2; }

say() { printf '\n== %s\n' "$*"; }
change() {  # a command that changes something in the account
  if [[ -n "$DRY" ]]; then echo "would run: ${WRANGLER[*]} $*"; else "${WRANGLER[@]}" "$@"; fi
}

say "Cloudflare account"
who=$("${WRANGLER[@]}" whoami 2>&1) || { echo "$who"; echo "log in first: ${WRANGLER[*]} login"; exit 1; }
if grep -qi 'not authenticated' <<<"$who"; then echo "log in first: ${WRANGLER[*]} login"; exit 1; fi
mapfile -t accounts < <(grep -oE '\b[0-9a-f]{32}\b' <<<"$who" | sort -u)
if [[ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  ACCOUNT=$CLOUDFLARE_ACCOUNT_ID
elif (( ${#accounts[@]} == 1 )); then
  ACCOUNT=${accounts[0]}
  export CLOUDFLARE_ACCOUNT_ID=$ACCOUNT
else
  echo "found ${#accounts[@]} accounts: set CLOUDFLARE_ACCOUNT_ID to the one that hosts the Pages project $PROJECT"
  exit 1
fi
echo "account id: $ACCOUNT"

say "Pages project $PROJECT"
if "${WRANGLER[@]}" pages project list 2>/dev/null | grep -w "$PROJECT" >/dev/null; then
  echo "found"
else
  echo "no Pages project named $PROJECT in this account: check CLOUDFLARE_ACCOUNT_ID"
  exit 1
fi

say "R2 buckets"
existing=$("${WRANGLER[@]}" r2 bucket list 2>/dev/null || true)
for b in "${BUCKETS[@]}"; do
  if grep -qE "^name:[[:space:]]*$b[[:space:]]*$" <<<"$existing"; then
    echo "$b: exists"
  else
    echo "$b: creating in $LOCATION"
    change r2 bucket create "$b" --location "$LOCATION"
  fi
done

if [[ -z "$DRY" ]]; then
  say "Checking each bucket: write, read back, delete"
  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' EXIT
  printf 'software-factory setup check %s\n' "$(date -u +%FT%TZ)" >"$tmp/check.txt"
  for b in "${BUCKETS[@]}"; do
    key=.setup-check/$(date -u +%s).txt
    "${WRANGLER[@]}" r2 object put "$b/$key" --file "$tmp/check.txt" --remote >/dev/null
    "${WRANGLER[@]}" r2 object get "$b/$key" --file "$tmp/back.txt" --remote >/dev/null
    "${WRANGLER[@]}" r2 object delete "$b/$key" --remote >/dev/null
    if cmp -s "$tmp/check.txt" "$tmp/back.txt"; then echo "$b: ok"; else echo "$b: the object read back differs"; exit 1; fi
  done

  say "Saving the Pages project's current settings"
  out=$PWD/$PROJECT.pages-config.toml
  if (cd "$tmp" && "${WRANGLER[@]}" pages download config "$PROJECT" >/dev/null 2>&1 && [[ -f wrangler.toml ]]); then
    cp "$tmp/wrangler.toml" "$out"
    echo "wrote $out: copy it to blog/software-factory/ops/ in the Terminal-Value repo, so the repo's"
    echo "wrangler.toml keeps the project's existing settings when it adds the buckets"
  else
    echo "wrangler could not download the project's settings; the merge loop will note what to check by hand"
  fi
fi

say "Next: a bucket-scoped R2 API token (dashboard only)"
cat <<EOF
1. Cloudflare dashboard -> R2 Object Storage -> Manage API tokens -> Create Account API token.
2. Permissions: Object Read & Write. Specify bucket(s): ${BUCKETS[*]}. No other buckets.
3. Name it software-factory-publisher. Keep the Access Key ID and Secret Access Key; the
   S3 endpoint is https://$ACCOUNT.r2.cloudflarestorage.com.
EOF

if [[ -n "$GITHUB" ]]; then
  say "GitHub Actions secrets for $REPO"
  command -v gh >/dev/null || { echo "gh is not installed: set the three secrets below by hand"; exit 1; }
  gh auth status >/dev/null 2>&1 || { echo "run gh auth login first"; exit 1; }
  if [[ -n "$DRY" ]]; then
    echo "would set SOFTWARE_FACTORY_R2_ACCOUNT_ID, SOFTWARE_FACTORY_R2_ACCESS_KEY_ID, SOFTWARE_FACTORY_R2_SECRET_ACCESS_KEY"
  else
    printf '%s' "$ACCOUNT" | gh secret set SOFTWARE_FACTORY_R2_ACCOUNT_ID --repo "$REPO"
    read -rsp "Access Key ID: " key; echo
    printf '%s' "$key" | gh secret set SOFTWARE_FACTORY_R2_ACCESS_KEY_ID --repo "$REPO"
    read -rsp "Secret Access Key: " secret; echo
    printf '%s' "$secret" | gh secret set SOFTWARE_FACTORY_R2_SECRET_ACCESS_KEY --repo "$REPO"
    unset key secret
    echo "secrets set; the refresh workflow's schedule still stays off until the repository variable SOFTWARE_FACTORY_SCHEDULE is on"
  fi
else
  cat <<EOF

4. Store them as GitHub Actions secrets of $REPO (or rerun this script with --github):
     SOFTWARE_FACTORY_R2_ACCOUNT_ID         $ACCOUNT
     SOFTWARE_FACTORY_R2_ACCESS_KEY_ID      (from step 3)
     SOFTWARE_FACTORY_R2_SECRET_ACCESS_KEY  (from step 3)
EOF
fi
