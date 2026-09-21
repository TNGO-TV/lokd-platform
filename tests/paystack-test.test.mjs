import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {receivePaystackTest} from '../app/lib/paystack-test.ts';
const secret='sk_test_local_signature_fixture';
function fixture(){const sql=new DatabaseSync(':memory:');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+f,'utf8').replaceAll('--> statement-breakpoint',''));return {sql,DB:{prepare(query){return {bind(...values){return {async run(){return sql.prepare(query).run(...values);}};}}}}};}
function request(data={domain:'test',id:77,reference:'test-77',status:'success',amount:100,currency:'ZAR'},signatureKey=secret){const body=JSON.stringify({event:'charge.success',data});return new Request('https://lokd.co.za/api/paystack/test/webhook',{method:'POST',body,headers:{'x-paystack-signature':createHmac('sha512',signatureKey).update(body).digest('hex')}});}
test('Paystack test signatures, live-domain rejection and configuration fail closed',async()=>{
 const f=fixture();const env={DB:f.DB,PAYSTACK_TEST_SECRET_KEY:secret};
 assert.equal((await receivePaystackTest(request(),{})).status,503);
 assert.equal((await receivePaystackTest(request(),{...env,PAYSTACK_TEST_SECRET_KEY:'sk_live_forbidden'})).status,503);
 assert.equal((await receivePaystackTest(request(undefined,'wrong'),env)).status,401);
 assert.equal((await receivePaystackTest(request({domain:'live'}),env)).status,422);
 assert.equal((await receivePaystackTest(request({}),env)).status,422);
 assert.equal(f.sql.prepare('select count(*) n from paystack_test_deliveries').get().n,0);f.sql.close();
});
test('signed test deliveries persist minimal evidence and duplicate retries are harmless',async()=>{
 const f=fixture();const env={DB:f.DB,PAYSTACK_TEST_SECRET_KEY:secret};
 for(let i=0;i<2;i++){const r=await receivePaystackTest(request(),env);assert.equal(r.status,200);assert.equal((await r.json()).financialEffect,false);}
 const rows=f.sql.prepare('select * from paystack_test_deliveries').all();assert.equal(rows.length,1);assert.equal(rows[0].amount_minor,100);assert.equal(rows[0].reference,'test-77');assert.ok(rows[0].received_at);f.sql.close();
});
test('storage failure requests retry and oversized events are rejected',async()=>{
 const broken={prepare(){throw Error('offline');}};assert.equal((await receivePaystackTest(request(),{DB:broken,PAYSTACK_TEST_SECRET_KEY:secret})).status,503);
 const f=fixture();const r=new Request('https://lokd.co.za/api/paystack/test/webhook',{method:'POST',body:'a'.repeat(262145),headers:{'x-paystack-signature':'0'.repeat(128)}});
 assert.equal((await receivePaystackTest(r,{DB:f.DB,PAYSTACK_TEST_SECRET_KEY:secret})).status,413);f.sql.close();
});
