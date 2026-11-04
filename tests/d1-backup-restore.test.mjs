import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

test('D1 restore validates the complete production schema and loads data before installing triggers',()=>{
 const output=execFileSync('python3',['-c',String.raw`
import importlib.util,sqlite3,sys
sys.dont_write_bytecode=True
from pathlib import Path
spec=importlib.util.spec_from_file_location('restore','scripts/d1-restore-sql.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
db=sqlite3.connect(':memory:')
for path in sorted(Path('drizzle').glob('*.sql')):db.executescript(path.read_text())
db.executescript("CREATE TABLE fixture_parent(id INTEGER PRIMARY KEY); CREATE TABLE fixture_child(id INTEGER REFERENCES fixture_parent(id),body TEXT); CREATE TABLE fixture_audit(id INTEGER); CREATE TRIGGER fixture_insert AFTER INSERT ON fixture_child BEGIN INSERT INTO fixture_audit VALUES(NEW.id); END; INSERT INTO fixture_parent VALUES(7); INSERT INTO fixture_child VALUES(7,'line one'||char(10)||'line two; é');")
export='\n'.join(db.iterdump());ordered=module.prepare(export)
restored=sqlite3.connect(':memory:');restored.executescript(ordered)
assert restored.execute('SELECT count(*) FROM fixture_audit').fetchone()[0]==1
assert restored.execute('PRAGMA foreign_key_check').fetchall()==[]
assert restored.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
assert restored.execute('SELECT body FROM fixture_child').fetchone()[0]=='line one\nline two; é'
try:module.prepare('CREATE TABLE parent(id PRIMARY KEY); CREATE TABLE child(id REFERENCES parent(id)); INSERT INTO child VALUES(7);')
except ValueError:pass
else:raise AssertionError('Dangling foreign key accepted')
try:module.prepare('SELECT load_extension("untrusted");')
except ValueError:pass
else:raise AssertionError('Unexpected export command accepted')
print('restore-verified')
`],{encoding:'utf8'});
 assert.equal(output.trim(),'restore-verified');
});
