import {installRehearsal} from './fixtures/isolated-rehearsal.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readdirSync,readFileSync} from 'node:fs';
import {createHmac} from 'node:crypto';
import {env} from 'cloudflare:workers';
import {readProviderTests,initializeProviderTest,reconcileProviderTest,providerTestMetadata,PAYMENT_TEST_VERSION} from '../app/lib/provider-acceptance-test.ts';
import {receivePaystackTest} from '../app/lib/paystack-test.ts';
import {GET,POST} from '../app/api/provider-test/route.ts';
class DB{
 constructor(){this.sql=new DatabaseSync(':memory:');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())this.sql.exec(readFileSync('drizzle/'+f,'utf8'));}
 prepare(q){const make=(v=[])=>({bind:(...x)=>make(x),first:async()=>this.sql.prepare(q).get(...v)??null,all:async()=>({results:this.sql.prepare(q).all(...v)}),run:async()=>({meta:{changes:Number(this.sql.prepare(q).run(...v).changes)}})});return make();}
}
const owner={userId:'owner-fixture',email:'owner@example.test',owner:true},key='sk_test_provider_fixture';
const input=scenario=>({scenario,version:PAYMENT_TEST_VERSION,testOnlyAcknowledged:true});
function setup(t){const db=new DB();t.after(()=>db.sql.close());return {db,runtime:{DB:db,PAYSTACK_TEST_SECRET_KEY:key}};}
const init=async(url,options)=>{assert.equal(url,'https://api.paystack.co/transaction/initialize');assert.equal(options.redirect,'manual');assert.equal(options.headers.authorization,'Bearer '+key);const b=JSON.parse(options.body);assert.equal(b.amount,'100');assert.equal(b.currency,'ZAR');assert.deepEqual(b.channels,['card']);return Response.json({status:true,data:{reference:b.reference,authorization_url:'https://checkout.paystack.com/test-fixture'}});};
const payload=(r,status='success')=>({domain:'test',id:99,reference:r.reference,amount:100,currency:'ZAR',status,customer:{email:owner.email},metadata:providerTestMetadata(r)});
const verify=(data)=>async(url,options)=>{assert.ok(url.endsWith('/transaction/verify/'+data.reference));assert.equal(options.method,'GET');return Response.json({status:true,data});};
async function row(f,scenario='success'){return (await initializeProviderTest(f.runtime,owner,input(scenario),init)).rows.find(r=>r.scenario===scenario);}
async function event(f,data,signatureKey=key){const body=JSON.stringify({event:'charge.success',data});return receivePaystackTest(new Request('https://lokd.co.za/api/paystack/test/webhook',{method:'POST',body,headers:{'x-paystack-signature':createHmac('sha512',signatureKey).update(body).digest('hex')}}),f.runtime);}
const check=(f,r,data)=>reconcileProviderTest(f.runtime,owner,{reference:r.reference,expectedRevision:r.revision},verify(data));
test('only owners can read or create; live keys and unacknowledged requests fail closed',async t=>{
 const f=setup(t);let called=false;const transport=()=>{called=true;throw Error();};
 await assert.rejects(()=>readProviderTests(f.runtime,{...owner,owner:false}),/owner access/);
 await assert.rejects(()=>initializeProviderTest({...f.runtime,PAYSTACK_TEST_SECRET_KEY:'sk_live_forbidden'},owner,input('success'),transport),/configuration/);
 for(const bad of [{...input('success'),testOnlyAcknowledged:false},input('invalid'),{...input('success'),version:'old'}])await assert.rejects(()=>initializeProviderTest(f.runtime,owner,bad,transport));
 assert.equal(called,false);assert.equal(f.db.sql.prepare('SELECT count(*) n FROM provider_acceptance_tests').get().n,0);
});
test('concurrent initialization is exactly once per owner and scenario',async t=>{
 const f=setup(t);let calls=0;const transport=async(...args)=>{calls++;await new Promise(r=>setTimeout(r,10));return init(...args);};
 await Promise.all(Array.from({length:4},()=>initializeProviderTest(f.runtime,owner,input('success'),transport)));
 assert.equal(calls,1);assert.equal((await readProviderTests(f.runtime,owner)).rows.length,1);
 assert.equal((await readProviderTests(f.runtime,{...owner,userId:'other'})).rows.length,0);
});
test('uncertain initialization retains the original reference and never sends a replacement',async t=>{
 const f=setup(t);let calls=0;const transport=async()=>{calls++;throw Error('timeout');};
 const a=await initializeProviderTest(f.runtime,owner,input('success'),transport),b=await initializeProviderTest(f.runtime,owner,input('success'),transport);
 assert.equal(calls,1);assert.equal(a.rows[0].reference,b.rows[0].reference);assert.equal(b.rows[0].state,'initialization_unknown');
});
test('provider redirects, wrong references and unsafe checkout URLs never become usable links',async t=>{
 const f=setup(t);for(const [i,response] of [new Response(null,{status:302,headers:{location:'https://evil.example'}}),Response.json({status:true,data:{reference:'wrong',authorization_url:'https://checkout.paystack.com/a'}}),Response.json({status:true,data:{authorization_url:'https://evil.example'}})].entries()){
 const result=await initializeProviderTest(f.runtime,owner,input(['success','decline','cancel'][i]),async()=>response);
 const r=result.rows.find(r=>r.scenario===['success','decline','cancel'][i]);assert.equal(r.state,'initialization_unknown');assert.equal(r.checkout_url,null);}
});
test('success requires provider verification AND genuine signed matching evidence; duplicates are harmless',async t=>{
 const f=setup(t);let r=await row(f);const data=payload(r);
 r=(await check(f,r,data)).rows[0];assert.equal(r.state,'awaiting_webhook');
 assert.equal((await event(f,data,'wrong')).status,401);
 assert.equal((await event(f,data)).status,200);assert.equal((await event(f,data)).status,200);
 const result=await check(f,r,data);r=result.rows[0];assert.equal(r.state,'verified_test');assert.ok(r.webhook_hash);assert.equal(result.financialEffect,false);
 assert.equal(f.db.sql.prepare('SELECT count(*) n FROM paystack_test_deliveries').get().n,1);
 for(const table of ['booking_collection_requests','test_enrolment_orders','bookings'])assert.equal(f.db.sql.prepare('SELECT count(*) n FROM '+table).get().n,0);
});
test('live domain, amount, currency, identity and metadata mismatches cannot pass',async t=>{
 const f=setup(t);let r=await row(f);for(const patch of [{domain:'live'},{amount:101},{currency:'USD'},{customer:{email:'other@example.test'}},{metadata:{}},{id:null},{reference:'other'}]){
 const data={...payload(r),...patch};const result=await reconcileProviderTest(f.runtime,owner,{reference:r.reference,expectedRevision:r.revision},async()=>Response.json({status:true,data}));r=result.rows[0];assert.equal(r.state,'review_required');assert.equal(r.provider_id,null);}
});
test('a conflicting signed webhook or provider ID is held for review',async t=>{
 const f=setup(t);let r=await row(f);await event(f,payload(r));r=(await check(f,r,payload(r))).rows[0];
 r=(await check(f,r,{...payload(r),id:100})).rows[0];assert.equal(r.state,'review_required');assert.equal(r.provider_id,'99');
 await event(f,{...payload(r),amount:101});r=(await check(f,r,payload(r))).rows[0];assert.equal(r.state,'review_required');assert.equal(r.webhook_hash,null);
});
test('failed and abandoned payments remain unpaid; pending or browser return never implies success',async t=>{
 const f=setup(t);for(const [scenario,status] of [['decline','failed'],['cancel','abandoned'],['success','pending']]){let r=await row(f,scenario);r=(await check(f,r,payload(r,status))).rows.find(r=>r.scenario===scenario);assert.equal(r.state,status);assert.equal(r.webhook_hash,null);}
});
test('signed success cannot be silently replaced by a failure result',async t=>{
 const f=setup(t);let r=await row(f);await event(f,payload(r));r=(await check(f,r,payload(r,'failed'))).rows[0];assert.equal(r.state,'review_required');
});
test('stale revisions and other owners cannot reconcile or make provider calls',async t=>{
 const f=setup(t),r=await row(f);let called=false;const transport=async()=>{called=true;throw Error();};
 await assert.rejects(()=>reconcileProviderTest(f.runtime,owner,{reference:r.reference,expectedRevision:0},transport),/changed/);
 await assert.rejects(()=>reconcileProviderTest(f.runtime,{...owner,userId:'other'},{reference:r.reference,expectedRevision:r.revision},transport),/not found/);assert.equal(called,false);
});
test('API enforces verified owner, workspace, same origin, bounded body and existing MFA policy',async t=>{
 const f=setup(t);Object.assign(env,f.runtime,{LOKD_OWNER_ACCESS_JSON:JSON.stringify([owner.email]),LOKD_OPERATIONS_ACCESS_JSON:'["ops@example.test"]',LOKD_APP_STAGE:'prelaunch',LOKD_OPERATIONS_MFA_REQUIRED:'true'});
 installRehearsal(f.db,{stage:'prelaunch'});
 const req=(method='GET',headers={},body,host='demo.lokd.co.za')=>new Request('https://'+host+'/api/provider-test',{method,headers:{'x-lokd-verified-user-id':owner.userId,'x-lokd-verified-email':owner.email,...headers},...(body?{body}: {})});
 assert.equal((await GET(new Request('https://demo.lokd.co.za/api/provider-test'))).status,401);
 assert.equal((await GET(req('GET',{'x-lokd-verified-email':'ops@example.test'}))).status,403);
 assert.equal((await GET(req('GET',{},null,'portal.lokd.co.za'))).status,404);
 assert.equal((await GET(req())).status,200);
 assert.equal((await POST(req('POST',{origin:'https://evil.example','content-type':'application/json'},'{}'))).status,403);
 assert.equal((await POST(req('POST',{origin:'https://demo.lokd.co.za','content-type':'application/json'},'{}'))).status,403);
 env.LOKD_OPERATIONS_MFA_REQUIRED='false';
 assert.equal((await POST(req('POST',{origin:'https://demo.lokd.co.za','content-type':'application/json'},'a'.repeat(1501)))).status,413);
 assert.equal((await POST(req('POST',{origin:'https://demo.lokd.co.za','content-type':'application/json'},'{bad'))).status,400);
 env.LOKD_APP_STAGE='demo';assert.equal((await GET(new Request('https://app.local/api/provider-test'))).status,401);
 for(const k of Object.keys(env))delete env[k];
});
