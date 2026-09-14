import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {env} from 'cloudflare:workers';
import {POST,GET} from '../app/api/booking-refunds/route.ts';
test('FI-06 additive proposal fits hosted SQLite limits and starts locked',()=>{
 const files=fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort().map(n=>fs.readFileSync(new URL('../drizzle/'+n,import.meta.url),'utf8'));
 for(const proposal of ['fi-build-06-credit-notes.sql','fi06-refund-dispute.sql'])files.push(fs.readFileSync(new URL('../docs/migration-proposals/'+proposal,import.meta.url),'utf8'));
 execFileSync('python3',['-c',`
import sys,json,sqlite3
c=sqlite3.connect(':memory:')
c.execute('PRAGMA foreign_keys=ON')
for limit,value in [(sqlite3.SQLITE_LIMIT_COMPOUND_SELECT,5),(sqlite3.SQLITE_LIMIT_FUNCTION_ARG,32),(sqlite3.SQLITE_LIMIT_VARIABLE_NUMBER,100),(sqlite3.SQLITE_LIMIT_COLUMN,100),(sqlite3.SQLITE_LIMIT_SQL_LENGTH,100000)]:c.setlimit(limit,value)
for sql in json.load(sys.stdin):
 for part in sql.split('--> statement-breakpoint'):
  if part.strip():c.executescript(part)
for (name,) in c.execute("SELECT name FROM sqlite_master WHERE type='view' AND name LIKE 'booking_refund_%'").fetchall():c.execute('SELECT * FROM '+name).fetchall()
assert c.execute('SELECT enabled FROM booking_refund_control').fetchone()[0]==0
assert c.execute('SELECT enabled FROM payment_live_control').fetchone()[0]==0
`],{input:JSON.stringify(files),encoding:'utf8',timeout:30000});
});
test('refund HTTP endpoints deny anonymous, cross-origin and wrong-workspace calls without provider access',async()=>{
 const before=env.LOKD_PILOT_ACCESS_JSON,oldDb=env.DB;delete env.DB;env.LOKD_PILOT_ACCESS_JSON=JSON.stringify({owners:['finance@example.test'],clients:{'client@example.test':'C1'}});
 const req=(email,method='POST',origin='https://lokd.co.za',host='lokd.co.za')=>new Request('https://'+host+'/api/booking-refunds',{method,headers:{origin,'content-type':'application/json',...(email?{'x-lokd-verified-user-id':'fixture-user','x-lokd-verified-email':email,'x-lokd-verified-mfa-enrolled':'true','x-lokd-verified-second-factor-at':new Date().toISOString()}:{})},...(method==='POST'?{body:'{}'}:{})});
 try{assert.equal((await POST(req())).status,401);assert.equal((await GET(req(undefined,'GET'))).status,401);assert.equal((await POST(req('finance@example.test','POST','https://attacker.test'))).status,403);assert.equal((await POST(req('client@example.test'))).status,403);assert.equal((await POST(req('finance@example.test','POST','https://officers.lokd.co.za','officers.lokd.co.za'))).status,403);assert.equal((await POST(req('finance@example.test'))).status,503);}finally{if(oldDb===undefined)delete env.DB;else env.DB=oldDb;if(before===undefined)delete env.LOKD_PILOT_ACCESS_JSON;else env.LOKD_PILOT_ACCESS_JSON=before;}
});

test('credit-note endpoint denies anonymous and cross-client scopes before storage access',async()=>{
 const {GET:read,POST:write}=await import('../app/api/credit-notes/route.ts');
 assert.equal((await read(new Request('https://lokd.co.za/api/credit-notes?invoiceId=private'))).status,401);
 assert.equal((await write(new Request('https://lokd.co.za/api/credit-notes?scope=operations',{method:'POST',headers:{origin:'https://other.test','content-type':'application/json'},body:'{}'}))).status,403);
 assert.equal((await read(new Request('https://officers.lokd.co.za/api/credit-notes?invoiceId=private',{headers:{'x-lokd-verified-user-id':'officer','x-lokd-verified-email':'officer@example.test'}}))).status,403);
});
