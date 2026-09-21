import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {receivePaystackTest} from '../app/lib/paystack-test.ts';
import {receiveBookingCollectionWebhook} from '../app/lib/booking-collections.ts';
import {receiveLiveTransferWebhook} from '../app/lib/payment-execution.ts';
import {receiveEmployeeTransferWebhook} from '../app/lib/employee-payments.ts';
import {receivePartnerTransferWebhook} from '../app/lib/partner-payments.ts';
import {readFinanceText,readFinanceWebhookBytes,readFinanceProviderJson} from '../app/lib/finance-body.ts';
import {fetchRecipient} from '../app/lib/destination-evidence.ts';

const runtime={PAYSTACK_TEST_SECRET_KEY:'sk_test_offline_body_fixture',PAYSTACK_LIVE_SECRET_KEY:'sk_live_offline_body_fixture'};
const req=(body,signature='0'.repeat(128))=>new Request('https://example.test/callback',{method:'POST',body,duplex:'half',headers:{'x-paystack-signature':signature}});
const receivers=[
 ['test',async(r,db)=>{const response=await receivePaystackTest(r,{...runtime,DB:db});return response.status;}],
 ['collection',(r,db)=>receiveBookingCollectionWebhook(r,db,runtime,'test')],
 ['live transfer',(r,db)=>receiveLiveTransferWebhook(r,db,runtime)],
 ['employee',(r,db)=>receiveEmployeeTransferWebhook(r,db,runtime)],
 ['partner',(r,db)=>receivePartnerTransferWebhook(r,db,runtime)],
];

for(const [name,receive] of receivers)test(`${name} webhook cancels stalled untrusted input before any database access`,async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 let cancelled=false,accesses=0;
 const request=req(new ReadableStream({cancel(){cancelled=true;}}));
 const pending=receive(request,{prepare(){accesses++;throw Error('Unexpected database access');}})
   .then(result=>({status:result}),error=>({status:error.status}));
 t.mock.timers.tick(5001);
 assert.equal((await pending).status,408);
 assert.equal(cancelled,true);assert.equal(request.body.locked,false);assert.equal(accesses,0);
});

test('finance limits count streamed UTF8 bytes and retain original raw HMAC bytes',async()=>{
 await assert.rejects(readFinanceText(req('éé'),3),error=>error.status===413);
 assert.equal(await readFinanceText(req('éé'),4),'éé');
 const bytes=new TextEncoder().encode('éé');
 const stream=new ReadableStream({start(c){c.enqueue(bytes.slice(0,1));c.enqueue(bytes.slice(1));c.close();}});
 assert.deepEqual(await readFinanceWebhookBytes(req(stream)),bytes);
});

for(const [name,receive] of receivers.slice(1))test(`${name} still accepts exact chunked signed bytes and rejects altered bytes`,async()=>{
 const mode=name==='live transfer'?'live':'test';
 const payload=JSON.stringify({event:name==='collection'?'charge.success':'transfer.success',data:{domain:mode,reference:'unknown-offline',description:'é financier'}});
 const bytes=new TextEncoder().encode(payload),signature=createHmac('sha512',runtime[mode==='live'?'PAYSTACK_LIVE_SECRET_KEY':'PAYSTACK_TEST_SECRET_KEY']).update(bytes).digest('hex');
 let reads=0;
 const db={prepare(){reads++;return {bind(){return {async first(){return null;}};}};}};
 const stream=new ReadableStream({start(c){for(let i=0;i<bytes.length;i++)c.enqueue(bytes.slice(i,i+1));c.close();}});
 assert.equal((await receive(req(stream,signature),db)).received,true);
 assert.equal(reads,1);
 await assert.rejects(receive(req(payload+' ',signature),db),error=>error.status===401);
 assert.equal(reads,1);
});

test('provider response cap cancels oversized streams and preserves transport error boundary',async()=>{
 let cancelled=false;
 const response=new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(262145));},cancel(){cancelled=true;}}));
 await assert.rejects(readFinanceProviderJson(response),error=>error.status===413);
 assert.equal(cancelled,true);assert.equal(response.body.locked,false);
 const transport=async()=>new Response(' '.repeat(262145));
 await assert.rejects(fetchRecipient(runtime.PAYSTACK_TEST_SECRET_KEY,'RCP_abcdef','test',transport),error=>error.status===503);
 assert.deepEqual(await readFinanceProviderJson(Response.json({status:true,data:{id:1}})),{status:true,data:{id:1}});
});

test('provider response parsing has an absolute deadline',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let cancelled=false;
 const response=new Response(new ReadableStream({cancel(){cancelled=true;}}));
 const pending=readFinanceProviderJson(response).then(()=>0,error=>error.status);
 t.mock.timers.tick(20001);assert.equal(await pending,408);assert.equal(cancelled,true);
});
