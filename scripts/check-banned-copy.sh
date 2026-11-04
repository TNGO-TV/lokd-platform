#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mode="${1:---check}"
[[ "$mode" == --check || "$mode" == --warn ]] || { echo 'Usage: check-banned-copy.sh [--check|--warn]' >&2; exit 64; }
paths=()
for path in app worker public config; do [[ ! -d "$path" ]] || paths+=("$path"); done
pattern='demo|sandbox|synthetic|test-cycle|test[[:space:]]+mode|rehears|pilot|lorem|placeholder|coming[[:space:]]+soon|demo\.lokd\.co\.za'

# Allowlist. Keep it minimal: only values that cannot be renamed.
#
# Stored identifiers: these files hold exact values persisted in D1 rows or
# created by drizzle/*.sql migrations. Renaming them would break stored data.
allowed_files=(
  app/lib/stored-identifiers.ts          # persisted record markers, used only to reject such records
  app/lib/readiness-schema-generated.ts  # generated list of D1 object names replayed from drizzle/*.sql
)
# HTTP directive: the Content-Security-Policy `sandbox` directive is a real
# header token. Only that exact directive (`; sandbox` ending a policy string)
# is ignored; any other occurrence on the same line is still reported.
csp_sandbox_directive=';[[:space:]]*sandbox(?=[[:space:]]*["'"'"'`;])'

set +e
if command -v rg >/dev/null; then
  hits="$(rg --line-number --ignore-case --glob '!**/tests/**' --glob '!check-banned-copy.sh' "$pattern" "${paths[@]}")"
  result=$?
else
  hits="$(grep -RInEI --exclude-dir=tests --exclude=check-banned-copy.sh "$pattern" "${paths[@]}")"
  result=$?
fi
set -e
if [[ $result -gt 1 ]]; then echo 'Production copy check could not complete.' >&2; exit 1; fi

remaining="$(printf '%s\n' "$hits" | ALLOWED="${allowed_files[*]}" PATTERN="$pattern" CSP="$csp_sandbox_directive" perl -ne '
  BEGIN { %allowed = map { $_ => 1 } split / /, $ENV{ALLOWED}; $pattern = qr/$ENV{PATTERN}/i; $csp = qr/$ENV{CSP}/i; }
  next unless /^([^:]+):(\d+):(.*)$/;
  my ($file, $text) = ($1, $3);
  next if $allowed{$file};
  $text =~ s/$csp//g;
  print if $text =~ $pattern;
')"

if [[ -z "$remaining" ]]; then exit 0; fi
printf '%s\n' "$remaining"
echo 'Production copy check: prohibited content remains.' >&2
[[ "$mode" == --warn ]] && exit 0
exit 1
