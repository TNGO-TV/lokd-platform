#!/usr/bin/env bash
# Native Cloudflare Worker deploy for lokd-security (NOT ChatGPT Sites).
# Do not wrap with sites-env.sh — it remaps HOME and hides wrangler OAuth.
set -euo pipefail
cd "$(dirname "$0")/.."
export LOKD_NATIVE_CF=1
export PYTHONDONTWRITEBYTECODE=1
export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-d7000a5708fdeb67be6e21ee40e9105e}"
mode="${1:---prepare-and-deploy}"
case "$mode" in
  --prepare|--prepare-and-deploy)
    node scripts/release-candidate.mjs begin
    # pipefail propagates gate failures; begin invalidates any previous receipt.
    npm run check:security 2>&1 | tee .sites-runtime/release/validation.log
    node scripts/release-candidate.mjs seal
    ;;
  --deploy-candidate) ;;
  *) echo "Usage: $0 [--prepare|--deploy-candidate|--prepare-and-deploy]" >&2; exit 64 ;;
esac
if [[ "$mode" != "--prepare" ]]; then
  node scripts/release-candidate.mjs verify
  # Explicit generated config and no bundling: deploy the checked native output,
  # never invoke another build or use Sites' generated configuration redirect.
  ./node_modules/.bin/wrangler deploy --config dist/server/wrangler.json --no-bundle
fi
