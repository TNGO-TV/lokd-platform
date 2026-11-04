#!/usr/bin/env bash
# Restore into an explicitly named EMPTY remote D1 database.
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
[[ $# == 4 ]] || { echo 'Usage: d1-restore.sh BACKUP.sql.age AGE_IDENTITY TARGET_DATABASE_ID --restore-empty-database' >&2; exit 64; }
backup=$(realpath -- "$1")
identity=$(realpath -- "$2")
target=$3
[[ "$4" == --restore-empty-database && "$target" =~ ^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$ ]] || { echo 'Explicit restore acknowledgement and database UUID required.' >&2; exit 64; }
command -v age >/dev/null
[[ -x node_modules/.bin/wrangler ]]
expected=$(awk 'NR==1 {print $1}' "$backup.sha256")
actual=$(sha256sum -- "$backup" | awk '{print $1}')
[[ "$expected" =~ ^[a-f0-9]{64}$ && "$expected" == "$actual" ]] || { echo 'Backup checksum mismatch.' >&2; exit 65; }
private_dir=$(mktemp -d)
trap 'rm -rf -- "$private_dir"' EXIT
age --decrypt --identity "$identity" --output "$private_dir/export.sql" "$backup"
python3 scripts/d1-restore-sql.py "$private_dir/export.sql" "$private_dir/restore.sql"
node_modules/.bin/wrangler d1 execute "$target" --remote --config wrangler.jsonc --json --command "SELECT count(*) AS table_count FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'" > "$private_dir/target.json"
python3 - "$private_dir/target.json" <<'PY'
import json,sys
rows=json.load(open(sys.argv[1]))
if len(rows)!=1 or not rows[0].get('success') or rows[0]['results'][0]['table_count']!=0:
 raise SystemExit('Restore target is not empty; use D1 Time Travel for in-place recovery.')
PY
node_modules/.bin/wrangler d1 execute "$target" --remote --config wrangler.jsonc --file "$private_dir/restore.sql" --yes
node_modules/.bin/wrangler d1 execute "$target" --remote --config wrangler.jsonc --json --command 'PRAGMA quick_check; PRAGMA foreign_key_check;' > "$private_dir/check.json"
python3 - "$private_dir/check.json" <<'PY'
import json,sys
checks=json.load(open(sys.argv[1]))
if len(checks)!=2 or not all(c.get('success') for c in checks) or checks[0]['results']!=[{'quick_check':'ok'}] or checks[1]['results']:
 raise SystemExit('Restored D1 integrity checks failed; do not switch application bindings.')
PY
printf 'D1 restored and integrity checked: %s\n' "$target"
