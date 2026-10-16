"""Exercise the production Python restore with views, triggers and typed data."""
import importlib.util, sqlite3, tempfile, unittest
from contextlib import closing
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('capture', ROOT/'scripts/owner-backup-capture.py')
capture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(capture)

class RestoreOrder(unittest.TestCase):
 def test_full_canonical_schema(self):
  with closing(sqlite3.connect(':memory:')) as db:
   for p in sorted((ROOT/'drizzle').glob('*.sql')):
    db.executescript(p.read_text(encoding='utf-8'))
   db.executescript('''CREATE TABLE restore_parent(id INTEGER PRIMARY KEY);
    CREATE TABLE restore_child(id INTEGER REFERENCES restore_parent(id), value BLOB, amount REAL);
    CREATE VIEW restore_z AS SELECT * FROM restore_child;
    CREATE VIEW restore_a AS SELECT * FROM restore_z;
    CREATE TRIGGER restore_insert INSTEAD OF INSERT ON restore_a BEGIN
     INSERT INTO restore_child VALUES(new.id,new.value,new.amount); END;''')
   schema=[dict(zip(['type','name','tbl_name','sql'],r)) for r in db.execute('SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY type,name')]
  tables=[{'name':'restore_parent','rowid':None,'columns':[{'name':'id','hidden':0}], 'rows':[[['integer','7']]]},
   {'name':'restore_child','rowid':'rowid','columns':[{'name':n,'hidden':0} for n in ['id','value','amount']],
    'rows':[[['integer','42'],['integer','7'],['blob','00ff80'],['real',1.25]]]}]
  (ROOT/'test-results').mkdir(exist_ok=True)
  with tempfile.TemporaryDirectory(dir=ROOT/'test-results') as tmp:
   path=Path(tmp)/'restore.sqlite'
   report=capture.restore({'schema':schema,'tables':tables},path)
   self.assertEqual(report['rows'],2)
   self.assertEqual(report['foreign_keys'],'ok')
   with closing(sqlite3.connect(path)) as restored:
    restored.execute("INSERT INTO restore_a VALUES(7,X'01',2.5)")
    self.assertEqual(restored.execute('SELECT COUNT(*) FROM restore_child').fetchone()[0],2)
    self.assertEqual(restored.execute('PRAGMA integrity_check').fetchone()[0],'ok')
   with self.assertRaisesRegex(ValueError,'already exists'):
    capture.restore({'schema':schema,'tables':tables},path)

if __name__ == '__main__': unittest.main()
