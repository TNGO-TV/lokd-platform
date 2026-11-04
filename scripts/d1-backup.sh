#!/usr/bin/env bash
# Export the production binding and encrypt before publishing a backup artifact.
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
[[ $# == 2 ]] || { echo 'Usage: d1-backup.sh AGE_RECIPIENT OUTPUT.sql.age' >&2; exit 64; }
recipient=$1
output=$(realpath -m -- "$2")
[[ "$recipient" == age1* || "$recipient" == ssh-* ]] || { echo 'An age public recipient is required.' >&2; exit 64; }
[[ ! -e "$output" && ! -e "$output.sha256" && ! -e "$output.json" ]] || { echo 'Backup output already exists.' >&2; exit 73; }
command -v age >/dev/null
[[ -x node_modules/.bin/wrangler ]] || { echo 'Install locked dependencies first.' >&2; exit 69; }
private_dir=$(mktemp -d)
trap 'rm -rf -- "$private_dir"' EXIT
node_modules/.bin/wrangler d1 export DB --remote --config wrangler.jsonc --output "$private_dir/database.sql"
[[ -s "$private_dir/database.sql" ]]
python3 scripts/d1-restore-sql.py "$private_dir/database.sql" "$private_dir/validated.sql"
age --recipient "$recipient" --output "$private_dir/database.sql.age" "$private_dir/database.sql"
# Refuse to overwrite even if another backup wins the race.
python3 - "$private_dir/database.sql.age" "$output" <<'PYCODE'
import shutil,sys
with open(sys.argv[1], 'rb') as source, open(sys.argv[2], 'xb') as target:
 shutil.copyfileobj(source, target)
PYCODE
sha256sum -- "$output" > "$output.sha256"
python3 - "$output.json" <<'PY'
import datetime,json,subprocess,sys
from pathlib import Path
config=json.loads('\n'.join(line for line in Path('wrangler.jsonc').read_text().splitlines() if not line.lstrip().startswith('//')))
manifest={'account_id':config['account_id'],'database_id':config['d1_databases'][0]['database_id'],'database_name':config['d1_databases'][0]['database_name'],'exported_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'git_commit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'encryption':'age','validation':'SQLite integrity_check and foreign_key_check passed'}
with open(sys.argv[1],'x') as output:json.dump(manifest,output,indent=2)
PY
printf 'Encrypted D1 export created: %s\n' "$output"
