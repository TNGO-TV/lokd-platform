import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {env} from 'cloudflare:workers';
import {classifyVerifyNow,dispatchVerifyNow,scenarioSignal} from '../app/lib/verifynow-adapter.ts';
import {runApplicantIdentity,readApplicantIdentity} from '../app/lib/applicant-identity.ts';
import {POST as apply} from '../app/api/applications/route.ts';
import {GET,POST} from '../app/api/identity/route.ts';
import {writeSignup} from '../app/lib/signup-server.ts';
class D1 {
 constructor(){this.sql=new DatabaseSync(':memory:');for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())this.sql.exec(fs.readFileSync(`drizzle/${f}`,'utf8').replaceAll('--> statement-breakpoint',''));}
 prepare(sql){const database=this.sql;const make=(values=[])=>({bind:(...v)=>make(v),first:async()=>database.prepare(sql).get(...values)??null,all:async()=>({results:database.prepare(sql).all(...values)}),run:async()=>({meta:{changes:Number(database.prepare(sql).run(...values).changes)}})});return make();}
 async batch(statements){this.sql.exec('BEGIN');try{const results=[];for(const stmt of statements)results.push(await stmt.run());this.sql.exec('COMMIT');return results;}catch(e){this.sql.exec('ROLLBACK');throw e;}}
}
const key='vn_live_'+'a'.repeat(64);
const approved={success:true,results:{said_verification:{Status:'Success',realTimeResults:{Status:'ID Number Valid'}}}};
test('saved VerifyNow fixture signals preserve negatives, review and provider failures',()=>{
 for(const fixture of JSON.parse(fs.readFileSync('tests/fixtures/verifynow-outcomes.json','utf8'))){
  const body={};for(const [path,value] of Object.entries(fixture.fields)){const keys=path.split('.');let node=body;for(const k of keys.slice(0,-1))node=node[k]??={};node[keys.at(-1)]=value;}
  if(fixture.case==='drivers-licence'){body.bundle='drivers_licence_barcode';body.data={};}
  const expected=fixture.http===429?'rate_limited':({mock_id_valid:'mock_approved',mock_bank_verified:'mock_approved',mock_card_decoded:'mock_approved',provider_unavailable:'unavailable'}[fixture.expected]??fixture.expected);
  assert.equal(classifyVerifyNow(scenarioSignal[fixture.case],fixture.http,body),expected,fixture.case);
 }
 assert.equal(classifyVerifyNow('id',200,{success:true}),'unexpected');
 assert.equal(classifyVerifyNow('face',502,{success:true,results:{face_match:{status:'Approved'}}}),'unavailable');
});
test('adapter enforces fixed host, sandbox payload, redirect rejection and preserves Retry-After',async()=>{
 let calls=0;const transport=async(url,options)=>{calls++;assert.equal(url,'https://www.verifynow.co.za/api/external/verify');assert.equal(JSON.parse(options.body).mode,'sandbox');assert.equal(options.redirect,'error');assert.equal(options.headers['Idempotency-Key'],'request-id');return Response.json({},{status:429,headers:{'retry-after':'90'}});};
 const r=await dispatchVerifyNow('id-found',key,'request-id',transport);assert.equal(r.outcome,'rate_limited');assert.ok(Date.parse(r.retryAt)>=Date.now()+89000);
 await assert.rejects(()=>dispatchVerifyNow('https://attacker.test',key,'x',transport));assert.equal(calls,1);
});
async function setup(pathway='qualified',psiraStatus='active'){
 const db=new D1();env.DB=db;
 const response=await apply(new Request('https://lokd.co.za/api/applications',{method:'POST',headers:{origin:'https://lokd.co.za','content-type':'application/json'},body:JSON.stringify({pathway,fullName:'Synthetic Officer',mobile:'0821234567',email:'identity@example.test',city:'Johannesburg',province:'Gauteng',psiraStatus,psiraNumber:psiraStatus==='active'?'1234567':'',psiraGrade:'Grade A',services:['Unarmed'],purposes:['Commercial access'],training:pathway==='training'?['Entry-level security training']:[],over18Confirmed:true,eligibilityAcknowledged:true,contactConsent:true})}));assert.equal(response.status,202);const caseId=(await response.json()).reference;
 await writeSignup(db,{userId:'user_identity',email:'identity@example.test',operations:false},{action:'link',kind:'officer',id:caseId,expectedVersion:0});return {db,caseId,runtime:{DB:db,VERIFYNOW_API_KEY:key,VERIFYNOW_SANDBOX_ENABLED:'true'}};
}
test('owned case dispatch is claimed once; sandbox entry unlocks correct path without real eligibility',async()=>{
 for(const [path,psira,next] of [['qualified','active','registered_enrolment'],['training','not_registered','training_options']]){
  const {db,caseId,runtime}=await setup(path,psira);let calls=0;
  const transport=async()=>{calls++;return Response.json(approved);};
  const input={caseId,caseVersion:1,scenario:'id-found'};
  await assert.rejects(()=>runApplicantIdentity(runtime,'intruder',input,transport),/own/);assert.equal(calls,0);
  await Promise.all([runApplicantIdentity(runtime,'user_identity',input,transport),runApplicantIdentity(runtime,'user_identity',input,transport)]);
  const state=await runApplicantIdentity(runtime,'user_identity',input,transport);assert.equal(calls,1);assert.equal(state.nextStep,next);assert.equal(state.identityVerified,false);assert.equal(state.workEligible,false);assert.equal(state.enrolment.amountMinor,path==='qualified'?35000:null);assert.equal(state.enrolment.liveChargingEnabled,false);
  await assert.rejects(()=>runApplicantIdentity(runtime,'user_identity',{...input,mode:'production'},transport));
  await writeSignup(db,{userId:'user_identity',email:'identity@example.test',operations:false},{action:'correct',kind:'officer',id:caseId,expectedVersion:1,changes:{city:'Sandton'}});
  assert.equal((await readApplicantIdentity(db,'user_identity',caseId)).nextStep,'entry_id');
  await assert.rejects(()=>runApplicantIdentity(runtime,'user_identity',input,transport),/changed/);db.sql.close();
 }
});
test('unknown dispatch stays unverified and does not retry; anonymous and wrong-host access fail',async()=>{
 const {db,caseId,runtime}=await setup();let calls=0;const transport=async()=>{calls++;throw Error('timeout');};const input={caseId,caseVersion:1,scenario:'id-found'};
 let state=await runApplicantIdentity(runtime,'user_identity',input,transport);assert.equal(state.checks[0].state,'delivery_unknown');assert.equal(state.nextStep,'entry_id');await runApplicantIdentity(runtime,'user_identity',input,transport);assert.equal(calls,1);
 assert.equal((await GET(new Request('https://officers.lokd.co.za/api/identity?caseId='+caseId))).status,401);
 assert.equal((await GET(new Request('https://portal.lokd.co.za/api/identity?caseId='+caseId,{headers:{'x-lokd-verified-user-id':'user_identity','x-lokd-verified-email':'identity@example.test'}}))).status,403);
 assert.equal((await POST(new Request('https://officers.lokd.co.za/api/identity',{method:'POST',headers:{origin:'https://attacker.test','content-type':'application/json'},body:'{}'}))).status,403);db.sql.close();
});
