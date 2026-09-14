import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {GET,POST} from '../app/api/payroll-correction-reviews/route.ts';
test('payroll correction review proposal preserves canonical history and hosted SQLite limits',()=>{
 const sql=fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort().map(f=>fs.readFileSync('drizzle/'+f,'utf8'));
 execFileSync('python3',['-c',`
import json,sys,sqlite3
c=sqlite3.connect(':memory:');c.execute('PRAGMA foreign_keys=ON')
for limit,value in [(sqlite3.SQLITE_LIMIT_COMPOUND_SELECT,5),(sqlite3.SQLITE_LIMIT_FUNCTION_ARG,32),(sqlite3.SQLITE_LIMIT_VARIABLE_NUMBER,100),(sqlite3.SQLITE_LIMIT_COLUMN,100),(sqlite3.SQLITE_LIMIT_SQL_LENGTH,100000)]:c.setlimit(limit,value)
for migration in json.load(sys.stdin):
 for statement in migration.split('--> statement-breakpoint'):
  if statement.strip():c.executescript(statement)
c.execute('SELECT * FROM payroll_correction_sources').fetchall()
assert c.execute('PRAGMA foreign_key_check').fetchall()==[]
assert c.execute('SELECT enabled FROM payment_live_control').fetchone()[0]==0
assert c.execute('SELECT enabled FROM booking_refund_control').fetchone()[0]==0
`],{input:JSON.stringify(sql),encoding:'utf8',timeout:30000});
});
test('payroll correction endpoint rejects unsigned and foreign-origin requests',async()=>{
 assert.equal((await GET(new Request('https://lokd.co.za/api/payroll-correction-reviews?itemId=private'))).status,401);
 assert.equal((await POST(new Request('https://lokd.co.za/api/payroll-correction-reviews',{method:'POST',headers:{origin:'https://other.test','content-type':'application/json'},body:'{}'}))).status,403);
 assert.equal((await GET(new Request('https://officers.lokd.co.za/api/payroll-correction-reviews?itemId=private',{headers:{'x-lokd-verified-user-id':'other-officer','x-lokd-verified-email':'other@example.test'}}))).status,403);
});
