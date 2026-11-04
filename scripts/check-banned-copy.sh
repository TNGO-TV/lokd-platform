#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mode="${1:---check}"
[[ "$mode" == --check || "$mode" == --warn ]] || { echo 'Usage: check-banned-copy.sh [--check|--warn]' >&2; exit 64; }
paths=()
for path in app worker public config; do [[ ! -d "$path" ]] || paths+=("$path"); done
pattern='demo|sandbox|synthetic|test-cycle|test[[:space:]]+mode|rehears|pilot|lorem|placeholder|coming[[:space:]]+soon|demo\.lokd\.co\.za'
set +e
if command -v rg >/dev/null; then
  rg --line-number --ignore-case --glob '!**/tests/**' --glob '!check-banned-copy.sh' "$pattern" "${paths[@]}"
  result=$?
else
  grep -RInEI --exclude-dir=tests --exclude=check-banned-copy.sh "$pattern" "${paths[@]}"
  result=$?
fi
set -e
if [[ $result == 1 ]]; then exit 0; fi
if [[ $result == 0 ]]; then echo 'Production copy check: prohibited content remains.' >&2; else echo 'Production copy check could not complete.' >&2; fi
[[ "$mode" == --warn ]] && exit 0
exit 1
