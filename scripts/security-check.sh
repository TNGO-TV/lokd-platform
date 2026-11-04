#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Uses isolated fixtures only. Never runs test:accounts or deploys a release.
# npm audit sends the locked dependency metadata to the configured npm registry.
node scripts/verify-vendor.mjs
node scripts/check-dependency-audit.mjs
npm run lint
./node_modules/.bin/eslint --no-ignore build/rsc-source-maps.ts --max-warnings 0
node scripts/verify-lint-policy.mjs
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/tsc --noEmit --strict --skipLibCheck --target ES2022 --module ESNext --moduleResolution Bundler build/rsc-source-maps.ts
node scripts/generate-readiness-schema.mjs --check
node scripts/generate-workspace-contracts.mjs --check
python3 tests/restore-order.test.py
npm run build
node --import ./tests/register-cloudflare.mjs --test --test-concurrency=2 tests/*.test.mjs
node node_modules/@playwright/test/cli.js test --config tests/offline-browser/playwright.config.mjs
