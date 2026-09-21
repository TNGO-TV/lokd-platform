#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Uses isolated fixtures only. Never runs test:accounts or deploys a release.
# npm audit sends the locked dependency metadata to the configured npm registry.
npm audit --audit-level=moderate
npm run lint
./node_modules/.bin/tsc --noEmit
node scripts/generate-readiness-schema.mjs --check
npm run build
node --experimental-loader=./tests/cloudflare-loader.mjs --test --test-concurrency=2 tests/*.test.mjs
