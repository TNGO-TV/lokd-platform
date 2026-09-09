#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node --experimental-loader=./tests/cloudflare-loader.mjs --test \
  tests/clerk-access.test.mjs tests/operations-mfa.test.mjs \
  tests/psira-verification.test.mjs tests/application-network-flow.test.mjs \
  tests/agreement-acceptance.test.mjs tests/unified-predeployment.test.mjs
printf '%s\n' 'LOCAL acceptance mechanics passed. This does not confirm production MFA, provider integration, legal execution or money movement.'
