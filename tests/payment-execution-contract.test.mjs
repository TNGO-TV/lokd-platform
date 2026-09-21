import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {env} from 'cloudflare:workers';
import {POST,GET} from '../app/api/payment-execution/route.ts';
import {POST as webhook} from '../app/api/paystack/transfers/live/webhook/route.ts';
test('FI-02 additive migration fits hosted SQLite limits and starts locked',()=>{
 const files=fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort().map(n=>fs.readFileSync(new URL('../drizzle/'+n,import.meta.url),'utf8'));
 assert.ok(fs.existsSync(new URL('../drizzle/0065_fi02_payment_execution.sql',import.meta.url)), 'FI-02 must be in the canonical migration chain');
 execFileSync('python3',['-c',`
import sys,json,sqlite3
c=sqlite3.connect(':memory:')
c.execute('PRAGMA foreign_keys=ON')
for limit,value in [(sqlite3.SQLITE_LIMIT_COMPOUND_SELECT,5),(sqlite3.SQLITE_LIMIT_FUNCTION_ARG,32),(sqlite3.SQLITE_LIMIT_VARIABLE_NUMBER,100),(sqlite3.SQLITE_LIMIT_COLUMN,100),(sqlite3.SQLITE_LIMIT_SQL_LENGTH,100000)]:c.setlimit(limit,value)
for sql in json.load(sys.stdin):
 for part in sql.split('--> statement-breakpoint'):
  if part.strip():c.executescript(part)
for (name,) in c.execute("SELECT name FROM sqlite_master WHERE type='view' AND (name LIKE 'payment_%' OR name LIKE '%_payment_financial_state' OR name LIKE '%_recovery_chain_holds')").fetchall():c.execute('SELECT * FROM '+name).fetchall()
assert c.execute('SELECT enabled FROM payment_live_control').fetchone()[0]==0
`],{input:JSON.stringify(files),encoding:'utf8',timeout:30000});
});
test('execution HTTP endpoints deny anonymous, cross-origin and wrong-workspace calls without provider access',async()=>{
 const before=env.LOKD_PILOT_ACCESS_JSON;env.LOKD_PILOT_ACCESS_JSON=JSON.stringify({owners:['finance@example.test'],clients:{'client@example.test':'C1'}});
 const req=(email,method='POST',origin='https://lokd.co.za',host='lokd.co.za')=>new Request('https://'+host+'/api/payment-execution',{method,headers:{origin,'content-type':'application/json',...(email?{'x-lokd-verified-user-id':'fixture-user','x-lokd-verified-email':email,'x-lokd-verified-mfa-enrolled':'true','x-lokd-verified-second-factor-at':new Date().toISOString()}:{})},...(method==='POST'?{body:'{}'}:{})});
 try{assert.equal((await POST(req())).status,401);assert.equal((await GET(req(undefined,'GET'))).status,401);assert.equal((await POST(req('finance@example.test','POST','https://attacker.test'))).status,403);assert.equal((await POST(req('client@example.test'))).status,403);assert.equal((await POST(req('finance@example.test','POST','https://officers.lokd.co.za','officers.lokd.co.za'))).status,403);assert.equal((await POST(req('finance@example.test'))).status,503);assert.equal((await webhook(req())).status,503);}finally{if(before===undefined)delete env.LOKD_PILOT_ACCESS_JSON;else env.LOKD_PILOT_ACCESS_JSON=before;}
});
