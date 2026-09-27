#!/usr/bin/env bash
# Native Cloudflare Worker deploy for lokd-security (NOT ChatGPT Sites).
# Do not wrap with sites-env.sh — it remaps HOME and hides wrangler OAuth.
set -euo pipefail
cd "$(dirname "$0")/.."
export LOKD_NATIVE_CF=1
export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-d7000a5708fdeb67be6e21ee40e9105e}"
echo "Building with native D1/R2 bindings..."
npx vinext build
echo "Deploying Worker lokd-security..."
npx wrangler deploy
