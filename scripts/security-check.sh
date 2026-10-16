#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Uses isolated fixtures only. Never runs test:accounts or deploys a release.
# npm audit sends the locked dependency metadata to the configured npm registry.
node scripts/check-dependency-audit.mjs
npm run lint
./node_modules/.bin/tsc --noEmit
node scripts/generate-readiness-schema.mjs --check
python3 tests/restore-order.test.py
npm run build
node --import ./tests/register-cloudflare.mjs --test --test-concurrency=2 tests/*.test.mjs
node node_modules/@playwright/test/cli.js test --config tests/offline-browser/playwright.config.mjs
