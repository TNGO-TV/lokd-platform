#!/usr/bin/env python3
"""Private owner capture and isolated SQLite restore. Never restores over production."""
import argparse,collections,hashlib,json,os,sqlite3,subprocess,urllib.request
from pathlib import Path

def quote(s): return '"'+s.replace('"','""')+'"'
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
 return h.hexdigest()
def cell(value):
 kind,v=value
 if kind=='null':return None
 if kind=='integer':return int(v)
 if kind=='real':return float(v)
 if kind=='blob':return bytes.fromhex(v)
 if kind=='text':return v
 raise ValueError('Unknown storage type')
def restore(snapshot,path):
 if path.exists():raise ValueError('Restore destination already exists')
 db=sqlite3.connect(path)
 db.execute('PRAGMA foreign_keys=OFF')
 for s in snapshot['schema']:
  if s['type']=='table' and s['sql'] and s['name']!='sqlite_sequence':db.execute(s['sql'])
 for t in snapshot['tables']:
  cols=([{'name':t['rowid'],'hidden':0}] if t['rowid'] else [])+t['columns']
  indices=[i for i,c in enumerate(cols) if not c['hidden']]
  if t['name']=='sqlite_sequence':db.execute('DELETE FROM sqlite_sequence')
  sql='INSERT INTO '+quote(t['name'])+' ('+','.join(quote(cols[i]['name']) for i in indices)+') VALUES ('+','.join('?' for _ in indices)+')'
  db.executemany(sql,([cell(row[i]) for i in indices] for row in t['rows']))
 for s in snapshot['schema']:
  if s['type']!='table' and s['sql']:db.execute(s['sql'])
 db.commit()
 schema=[dict(zip(['type','name','tbl_name','sql'],r)) for r in db.execute('SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY type,name')]
 expected=[s for s in snapshot['schema'] if not s['name'].startswith('sqlite_') or s['name']=='sqlite_sequence' or s['sql'] is None]
 if schema!=expected:raise ValueError('Restored schema mismatch')
 total=0
 for t in snapshot['tables']:
  cols=([{'name':t['rowid']}] if t['rowid'] else [])+t['columns']
  actual=collections.Counter(db.execute('SELECT '+','.join(quote(c['name']) for c in cols)+' FROM '+quote(t['name'])))
  wanted=collections.Counter(tuple(cell(c) for c in row) for row in t['rows'])
  if actual!=wanted:raise ValueError('Restored cell mismatch')
  # Compare storage classes separately: integer/real equality alone is insufficient.
  types=collections.Counter(db.execute('SELECT '+','.join('typeof('+quote(c['name'])+')' for c in cols)+' FROM '+quote(t['name'])))
  if types!=collections.Counter(tuple(c[0] for c in row) for row in t['rows']):raise ValueError('Restored storage-class mismatch')
  total+=len(t['rows'])
 if db.execute('PRAGMA integrity_check').fetchall()!=[('ok',)]:raise ValueError('Integrity check failed')
 fk=db.execute('PRAGMA foreign_key_check').fetchall()
 db.close()
 if fk:raise ValueError('Foreign key check failed')
 return {'tables':len(snapshot['tables']),'rows':total,'schema_match':True,'cells_match':True,'integrity':'ok','foreign_keys':'ok','excluded_provider_internal':snapshot.get('excluded_provider_internal',[])}
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):raise ValueError('Backup redirect refused')
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--url',required=True);ap.add_argument('--control',type=Path,required=True);ap.add_argument('--key',type=Path,required=True);ap.add_argument('--output',type=Path,required=True);args=ap.parse_args()
 os.umask(0o077);args.output.mkdir(mode=0o700);private=args.output/'isolated-restore';private.mkdir(mode=0o700)
 cfg=json.loads(args.control.read_text());opener=urllib.request.build_opener(NoRedirect())
 def request(action,**fields):
  return opener.open(urllib.request.Request(args.url,data=json.dumps({'action':action,**fields}).encode(),headers={'x-owner-backup-token':cfg['token'],'Content-Type':'application/json'},method='POST'),timeout=120)
 def read(action,**fields):
  with request(action,**fields) as r:
   if 'no-store' not in r.headers.get('Cache-Control',''):raise ValueError('Missing private response headers')
   return json.load(r)
 def save(name,data):
  p=private/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')));return p
 def inventory():
  objects=[];cursor=None;seen=set()
  while True:
   result=read('objects',**({'cursor':cursor} if cursor else {}));objects.extend(result['objects'])
   if not result['truncated']:break
   cursor=result.get('cursor')
   if not cursor or cursor in seen:raise ValueError('Invalid object pagination')
   seen.add(cursor)
  objects.sort(key=lambda o:o['key'])
  if len({o['key'] for o in objects})!=len(objects):raise ValueError('Duplicate object inventory keys')
  return objects
 read('health');runtime=read('runtime')
 if sorted(runtime['values'])!=sorted(cfg['expected_runtime_keys']):raise ValueError('Incomplete runtime configuration coverage')
 save('runtime.json',runtime)
 before=inventory();manifest=[]
 for i,obj in enumerate(before):
  p=private/'objects'/f'{i:08d}.bin';p.parent.mkdir(exist_ok=True)
  with request('object',key=obj['key'],etag=obj['etag'],version=obj['version']) as r,p.open('xb') as f:
   if r.headers.get('x-backup-version')!=obj['version']:raise ValueError('Object version mismatch')
   for block in iter(lambda:r.read(1024*1024),b''):f.write(block)
  if p.stat().st_size!=obj['size']:raise ValueError('Object byte count mismatch')
  manifest.append({'metadata':obj,'file':str(p.relative_to(private)),'sha256':sha(p)})
 snapshot=read('database');save('database.json',snapshot)
 if before!=inventory():raise ValueError('Object inventory changed during capture; retry in a new destination')
 save('objects.json',manifest)
 refs={c[1][7:] for t in snapshot['tables'] for row in t['rows'] for c in row if c[0]=='text' and c[1].startswith('BUCKET:')}
 if refs-{o['key'] for o in before}:raise ValueError('Database references uncaptured objects')
 verification=restore(snapshot,private/'restored.sqlite')
 verification.update(objects=len(manifest),object_bytes=sum(o['metadata']['size'] for o in manifest),database_object_references=len(refs),runtime_keys=sorted(runtime['values']))
 # Independent encrypted archive extraction, then hash every captured/restored file.
 files={str(p.relative_to(private)):sha(p) for p in private.rglob('*') if p.is_file()}
 save('FILE-HASHES.json',files)
 archive=args.output/'LOKD-Production-Capture.tar.gpg';gh=args.output/'gpg';gh.mkdir(mode=0o700)
 tar=subprocess.Popen(['tar','-cf','-','-C',str(private),'.'],stdout=subprocess.PIPE)
 result=subprocess.run(['gpg','--homedir',str(gh),'--batch','--no-symkey-cache','--pinentry-mode','loopback','--passphrase-file',str(args.key),'--symmetric','--cipher-algo','AES256','--output',str(archive)],stdin=tar.stdout,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE);tar.stdout.close()
 if tar.wait()!=0 or result.returncode:raise ValueError('Archive encryption failed')
 decrypted=args.output/'verified-extraction';decrypted.mkdir(mode=0o700)
 dec=subprocess.Popen(['gpg','--homedir',str(gh),'--batch','--no-symkey-cache','--pinentry-mode','loopback','--passphrase-file',str(args.key),'--decrypt',str(archive)],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
 extracted=subprocess.run(['tar','-xf','-','-C',str(decrypted)],stdin=dec.stdout,stderr=subprocess.PIPE);dec.stdout.close()
 if extracted.returncode or dec.wait()!=0:raise ValueError('Archive extraction failed')
 if any(sha(decrypted/f)!=digest for f,digest in files.items()):raise ValueError('Decrypted archive file hash mismatch')
 verification.update(archive_sha256=sha(archive),archive_bytes=archive.stat().st_size,decrypted_files_match=True,application_data_restore_verified=True,full_production_recovery_complete=False,remaining=['External identity/payment/verification recovery records','Independent off-host copy','Backup window revocation and release receipts'])
 (args.output/'VERIFICATION.json').write_text(json.dumps(verification,indent=2)+'\n');print(json.dumps(verification))
if __name__=='__main__':
 try:main()
 except Exception as e:print('Backup failed: '+type(e).__name__+'; no completion receipt written.');raise SystemExit(1)
