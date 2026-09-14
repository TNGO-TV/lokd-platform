import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {POST} from '../app/api/payment-recovery/route.ts';
import {env} from 'cloudflare:workers';
test('FI-05 migration applies after existing history and fits hosted SQLite limits',()=>{
 const files=fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort().map(f=>({name:f,sql:fs.readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8')}));
 execFileSync('python3',['-c',`
import json,sqlite3,sys
c=sqlite3.connect(':memory:')
for limit,value in [(sqlite3.SQLITE_LIMIT_COMPOUND_SELECT,5),(sqlite3.SQLITE_LIMIT_FUNCTION_ARG,32),(sqlite3.SQLITE_LIMIT_VARIABLE_NUMBER,100),(sqlite3.SQLITE_LIMIT_COLUMN,100),(sqlite3.SQLITE_LIMIT_SQL_LENGTH,100000)]: c.setlimit(limit,value)
for f in json.load(sys.stdin):
 for i,sql in enumerate(f['sql'].split('--> statement-breakpoint')):
  if sql.strip():
   try: c.executescript(sql)
   except Exception as e: raise RuntimeError(f"{f['name']} statement {i}: {e}") from e
for k in ['employee','partner']:
 for suffix in ['terminal','reviewable','available','chain_holds']:
  c.execute('SELECT * FROM '+k+'_recovery_'+suffix).fetchall()
`],{input:JSON.stringify(files),encoding:'utf8'});
});
test('recovery HTTP route rejects anonymous, cross-origin, participant and wrong-workspace requests',async()=>{
 const before=env.LOKD_PILOT_ACCESS_JSON;
 env.LOKD_PILOT_ACCESS_JSON=JSON.stringify({owners:['finance@example.test'],operations:[],clients:{'client@example.test':'fixture-client'}});
 const request=(email,url='https://lokd.co.za/api/payment-recovery',origin=new URL(url).origin)=>new Request(url,{method:'POST',headers:{origin,'content-type':'application/json',...(email?{'x-lokd-verified-user-id':'fixture-user','x-lokd-verified-email':email,'x-lokd-verified-mfa-enrolled':'true','x-lokd-verified-second-factor-at':new Date().toISOString()}:{})},body:'{}'});
 try{
  assert.equal((await POST(request())).status,401);
  assert.equal((await POST(request('finance@example.test',undefined,'https://attacker.example'))).status,403);
  assert.equal((await POST(request('client@example.test'))).status,403);
  assert.equal((await POST(request('finance@example.test'))).status,503);
  assert.equal((await POST(request('finance@example.test','https://officers.lokd.co.za/api/payment-recovery'))).status,403);
 }finally{if(before===undefined)delete env.LOKD_PILOT_ACCESS_JSON;else env.LOKD_PILOT_ACCESS_JSON=before;}
 assert.equal(env.DB,undefined,'HTTP denial tests never acquire a real database');
});
