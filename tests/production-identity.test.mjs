import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {env} from 'cloudflare:workers';
import {POST as apply} from '../app/api/applications/route.ts';
import {writeSignup} from '../app/lib/signup-server.ts';
import {startProductionIdentity as start, readProductionIdentity as read, recoverProductionIdentity as recover, decideProductionIdentity as decide, suspendProductionIdentity as suspend, productionIdentityEvidence as evidence} from '../app/lib/production-identity.ts';
class D1 {
 constructor(){this.sql=new DatabaseSync(':memory:');for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())this.sql.exec(fs.readFileSync(`drizzle/${f}`,'utf8').replaceAll('--> statement-breakpoint',''));}
 prepare(sql){const database=this.sql;const make=(values=[])=>({bind:(...v)=>make(v),first:async()=>database.prepare(sql).get(...values)??null,all:async()=>({results:database.prepare(sql).all(...values)}),run:async()=>({meta:{changes:Number(database.prepare(sql).run(...values).changes)}})});return make();}
 async batch(statements){this.sql.exec('BEGIN');try{const results=[];for(const stmt of statements)results.push(await stmt.run());this.sql.exec('COMMIT');return results;}catch(e){this.sql.exec('ROLLBACK');throw e;}}
}
async function setup(pathway='qualified',psiraStatus='active'){
 const db=new D1();env.DB=db;
 const response=await apply(new Request('https://lokd.co.za/api/applications',{method:'POST',headers:{origin:'https://lokd.co.za','content-type':'application/json'},body:JSON.stringify({pathway,fullName:'Synthetic Officer',mobile:'0821234567',email:'identity@example.test',city:'Johannesburg',province:'Gauteng',psiraStatus,psiraNumber:psiraStatus==='active'?'1234567':'',psiraGrade:'Grade A',services:['Unarmed'],purposes:['Commercial access'],training:pathway==='training'?['Entry-level security training']:[],over18Confirmed:true,eligibilityAcknowledged:true,contactConsent:true})}));assert.equal(response.status,202);const caseId=(await response.json()).reference;
 await writeSignup(db,{userId:'user_identity',email:'identity@example.test',operations:false},{action:'link',kind:'officer',id:caseId,expectedVersion:0});return {db,caseId,runtime:{DB:db,VERIFYNOW_API_KEY:undefined,VERIFYNOW_SANDBOX_ENABLED:'true'}};
}

const applicant={userId:'user_identity',email:'identity@example.test',operations:false};
const reviewer={userId:'independent_reviewer',email:'review@example.test',operations:true};
function fixture(){
 let submits=0,lookups=0;
 const result=b=>({...b,environment:'production',provider:'fixture-only',outcome:'verified',providerReference:'private-result',evidenceReference:'private-evidence',evidenceHash:'b'.repeat(64),checkedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString()});
 const port={key:'fixture-only',capture:async()=>({environment:'production',bindingHash:'a'.repeat(64)}),submit:async b=>{submits++;return result(b);},lookup:async b=>{lookups++;return result(b);}};
 return {port,result,counts:()=>({submits,lookups})};
}
const input=caseId=>({applicantId:caseId,applicantVersion:1,captureReference:'private-capture-fixture',consentVersion:'fixture-consent'});
const approve=(db,s,actor=reviewer)=>decide(db,actor,{id:s.id,outcomeId:s.outcomeId,decision:'approve',reason:'Independently inspected fixture evidence',independentlyChecked:true});

test('production is locked without adapter; exact owner and capture provenance required',async()=>{
 const {db,caseId}=await setup(); const f=fixture();
 await assert.rejects(start(db,applicant,input(caseId)),/not configured/);
 await assert.rejects(start(db,reviewer,input(caseId),f.port),/own/);
 await assert.rejects(start(db,applicant,{...input(caseId),mode:'sandbox'},f.port),/Unsupported/);
 f.port.capture=async()=>({environment:'sandbox',bindingHash:'a'.repeat(64)});
 await assert.rejects(start(db,applicant,input(caseId),f.port),/Production-bound/);
 assert.equal(f.counts().submits,0);db.sql.close();
});

test('concurrent start dispatches once; independent current review is required and private references stay private',async()=>{
 const {db,caseId}=await setup(),f=fixture();
 await Promise.all([start(db,applicant,input(caseId),f.port),start(db,applicant,input(caseId),f.port)]);
 let s=await start(db,applicant,input(caseId),f.port);assert.equal(f.counts().submits,1);assert.equal(s.identityVerified,false);
 assert.equal(JSON.stringify(s).includes('private-evidence'),false);
 await assert.rejects(read(db,{...applicant,userId:'intruder'},s.id),/not found/);
 await assert.rejects(approve(db,s,applicant),/Operations/);
 await assert.rejects(approve(db,s,{...applicant,operations:true}),/Independent/);
 s=await approve(db,s);assert.equal(s.identityVerified,true);assert.equal(s.workEligible,false);
 const e=await evidence(db,caseId,1,applicant.userId,new Date(Date.now()+1000).toISOString());assert.equal(e.contract,'lokd.production-identity.v1');
 assert.equal(await evidence(db,caseId,1,'wrong',new Date(Date.now()+1000).toISOString()),null);
 assert.equal(await evidence(db,caseId,1,applicant.userId,new Date(Date.now()+2*86400000).toISOString()),null);
 await suspend(db,reviewer,s.id,'Evidence withdrawn by source');assert.equal((await read(db,applicant,s.id)).identityVerified,false);
 for(const t of ['cases','outcomes','decisions','suspensions'])assert.throws(()=>db.sql.exec('DELETE FROM production_identity_'+t),/immutable/);
 db.sql.close();
});

test('sandbox, mismatched person, stale and unsupported provider outcomes never approve',async()=>{
 for(const override of [{environment:'sandbox'},{ownerUserId:'other'},{applicantVersion:2},{applicantId:'other'},{caseId:'other'},{bindingHash:'c'.repeat(64)},{captureReference:'other'},{provider:'other'},{outcome:'mock_approved'},{evidenceHash:'invalid'},{checkedAt:'2000-01-01T00:00:00.000Z'},{expiresAt:'2000-01-01T00:00:00.000Z'}]){
  const {db,caseId}=await setup(),f=fixture();f.port.submit=async b=>({...f.result(b),...override});
  await assert.rejects(start(db,applicant,input(caseId),f.port),/mismatched/);
  const s=await start(db,applicant,input(caseId),f.port);assert.equal(s.identityVerified,false);assert.equal(s.outcome,'pending');
  await assert.rejects(approve(db,s),/current identity review/);db.sql.close();
 }
});

test('negative, review and outage results are retained and cannot be manually promoted',async()=>{
 for(const outcome of ['declined','no_record','manual_review','unavailable']){
  const {db,caseId}=await setup(),f=fixture();f.port.submit=async b=>({...f.result(b),outcome});
  const s=await start(db,applicant,input(caseId),f.port);assert.equal(s.outcome,outcome);
  await assert.rejects(approve(db,s),/current identity review/);db.sql.close();
 }
});

test('uncertain delivery and crash-pending recover by lookup only; null and failure never authorise a resubmit',async()=>{
 const {db,caseId}=await setup(),f=fixture();let calls=0;f.port.submit=async()=>{calls++;throw Error('timeout');};
 let s=await start(db,applicant,input(caseId),f.port);assert.equal(s.outcome,'delivery_unknown');
 for(const lookup of [async()=>null,async()=>{throw Error('404 or timeout');}]){
  f.port.lookup=lookup;s=await recover(db,reviewer,s.id,s.outcomeId,f.port);await start(db,applicant,input(caseId),f.port);assert.equal(s.outcome,'delivery_unknown');assert.equal(calls,1);
 }
 f.port.lookup=async b=>f.result(b);
 await assert.rejects(recover(db,applicant,s.id,s.outcomeId,f.port),/Operations/);
 const old=s.outcomeId;s=await recover(db,reviewer,s.id,old,f.port);assert.equal(s.outcome,'verified');assert.equal(s.identityVerified,false);
 await assert.rejects(recover(db,reviewer,s.id,old,f.port),/changed/);
 await assert.rejects(approve(db,s),/current identity review/);s=await approve(db,s,{...reviewer,userId:'second-reviewer'});assert.equal(s.identityVerified,true);assert.equal(calls,1);db.sql.close();
});

test('correction and withdrawal invalidate approved evidence and block review at database commit',async()=>{
 for(const action of ['correct','withdraw']){
  const {db,caseId}=await setup(),f=fixture();let s=await start(db,applicant,input(caseId),f.port);s=await approve(db,s);
  await writeSignup(db,applicant,{action,kind:'officer',id:caseId,expectedVersion:1,changes:{city:'Sandton'},note:'Applicant withdraws fixture'});
  assert.equal((await read(db,applicant,s.id)).identityVerified,false);
  assert.equal(await evidence(db,caseId,1,applicant.userId,new Date(Date.now()+1000).toISOString()),null);
  assert.throws(()=>db.sql.prepare('INSERT INTO production_identity_decisions VALUES(?,?,?,?,?)').run(s.outcomeId,'approve','second-reviewer','stale fixture',new Date().toISOString()),/current identity review/);
  await recover(db,reviewer,s.id,s.outcomeId,f.port);assert.equal((await read(db,applicant,s.id)).identityVerified,false);db.sql.close();
 }
});

test('concurrent reconciliation permits one successor, invalidates prior review, and rejects stale decision',async()=>{
 const {db,caseId}=await setup(),f=fixture();let s=await start(db,applicant,input(caseId),f.port);s=await approve(db,s);
 const results=await Promise.allSettled([recover(db,reviewer,s.id,s.outcomeId,f.port),recover(db,reviewer,s.id,s.outcomeId,f.port)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await read(db,applicant,s.id)).identityVerified,false);
 await assert.rejects(approve(db,s),/changed/);db.sql.close();
});


test('correction cannot create another dispatch while previous delivery is unknown; stale lookup is still possible',async()=>{
 const {db,caseId}=await setup(),f=fixture();f.port.submit=async()=>{throw Error('timeout');};
 const s=await start(db,applicant,input(caseId),f.port);
 await writeSignup(db,applicant,{action:'correct',kind:'officer',id:caseId,expectedVersion:1,changes:{city:'Sandton'}});
 await assert.rejects(start(db,applicant,{...input(caseId),applicantVersion:2,captureReference:'new-private-capture'},f.port),/unresolved/);
 await recover(db,reviewer,s.id,s.outcomeId,f.port);
 assert.equal((await read(db,applicant,s.id)).identityVerified,false);db.sql.close();
});

test('expiry and stale outcome are rejected at commit, including null evidence',async()=>{
 const {db,caseId}=await setup(),f=fixture();const s=await start(db,applicant,input(caseId),f.port);
 const o=db.sql.prepare('SELECT * FROM production_identity_outcomes WHERE id=?').get(s.outcomeId);
 for(const override of [{expires_at:'2000-01-01T00:00:00.000Z'},{evidence_hash:null},{checked_at:'invalid'}]){
  const row={...o,id:crypto.randomUUID(),sequence:3,...override};
  assert.throws(()=>db.sql.prepare('INSERT INTO production_identity_outcomes VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(...Object.values(row)),/Current identity evidence/);
 }
 const next=await recover(db,reviewer,s.id,s.outcomeId,f.port);
 assert.throws(()=>db.sql.prepare('INSERT INTO production_identity_decisions VALUES(?,?,?,?,?)').run(s.outcomeId,'approve',reviewer.userId,'racing stale review',new Date().toISOString()),/current identity review/);
 assert.equal(next.identityVerified,false);db.sql.close();
});

test('replayed provider reference cannot bind a second case, and capture races fail before dispatch',async()=>{
 const {db,caseId}=await setup(),f=fixture();await start(db,applicant,input(caseId),f.port);
 await writeSignup(db,applicant,{action:'correct',kind:'officer',id:caseId,expectedVersion:1,changes:{city:'Sandton'}});
 await assert.rejects(start(db,applicant,{...input(caseId),applicantVersion:2,captureReference:'second-capture'},f.port),/another identity case/);
 db.sql.close();
 const fresh=await setup(),g=fixture();g.port.capture=async()=>{
  await writeSignup(fresh.db,applicant,{action:'correct',kind:'officer',id:fresh.caseId,expectedVersion:1,changes:{city:'Sandton'}});
  return {environment:'production',bindingHash:'a'.repeat(64)};
 };
 await assert.rejects(start(fresh.db,applicant,input(fresh.caseId),g.port),/applicant changed/);
 assert.equal(g.counts().submits,0);fresh.db.sql.close();
});

test('VerifyNow receipt survives ID-01 projection failure and recovers without dispatch or approval',async()=>{
 const {createVerifyNowProductionProvider}=await import('../app/lib/verifynow-production.ts');
 const {verifyNowD1Receipts}=await import('../app/lib/verifynow-receipts.ts');
 const {db,caseId}=await setup();
 try{
  const capture={...input(caseId),ownerUserId:applicant.userId,environment:'production',idNumber:'0000000000000',capturedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+60000).toISOString(),consentEvidenceReference:'fixture-consent-evidence'};
  let calls=0,failProjection=true;const prepare=db.prepare.bind(db);
  db.prepare=sql=>{const stmt=prepare(sql);if(sql==='INSERT INTO production_identity_outcomes VALUES(?,?,?,?,?,?,?,?,?,?,?)'&&failProjection){const bind=stmt.bind;stmt.bind=(...values)=>{const bound=bind(...values);bound.run=async()=>{failProjection=false;throw Error('fixture projection crash');};return bound;};}return stmt;};
  const port=createVerifyNowProductionProvider({apiKey:'fixture-key',policyReference:'fixture-policy',evidenceLifetimeMs:30000,captures:{read:async()=>capture},receipts:verifyNowD1Receipts(db),evidence:{put:async()=> 'private-fixture:response'},transport:async()=>{calls++;return Response.json({success:true,requestId:'fixture-request-id',mode:'production',reportType:'said_verification',input:{idNumber:capture.idNumber},results:{said_verification:{Status:'Success',realTimeResults:{Status:'ID Number Valid'},meta:{environment:'production',timestamp:new Date().toISOString()}}}});}});
  await assert.rejects(start(db,applicant,input(caseId),port),/projection crash/);
  const pending=await start(db,applicant,input(caseId),port);assert.equal(pending.outcome,'pending');assert.equal(calls,1);
  const restored=await recover(db,reviewer,pending.id,pending.outcomeId,port);assert.equal(restored.outcome,'manual_review');assert.equal(restored.identityVerified,false);assert.equal(calls,1);
  await assert.rejects(approve(db,restored),/current identity review/);
 }finally{db.sql.close();}
});

test('private reader uses canonical provider receipt, applicant currentness and suspension audit',async()=>{
 const {createVerifyNowProductionProvider}=await import('../app/lib/verifynow-production.ts');
 const {verifyNowD1Receipts}=await import('../app/lib/verifynow-receipts.ts');
 const {readPrivateIdentityEvidence}=await import('../app/lib/production-identity-evidence-reader.ts');
 const {db,caseId}=await setup();let bytes;
 try{
  const capture={...input(caseId),ownerUserId:applicant.userId,environment:'production',idNumber:'0000000000000',capturedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+60000).toISOString(),consentEvidenceReference:'fixture-consent-evidence'};
  const port=createVerifyNowProductionProvider({apiKey:'fixture-key',policyReference:'fixture-policy',evidenceLifetimeMs:30000,captures:{read:async()=>capture},receipts:verifyNowD1Receipts(db),evidence:{put:async(_id,value)=>{bytes=value;return 'private-fixture:response';}},transport:async()=>Response.json({success:true,requestId:'fixture-private-request',mode:'production',reportType:'said_verification',input:{idNumber:capture.idNumber},results:{said_verification:{Status:'Success',realTimeResults:{Status:'ID Number Valid'},meta:{environment:'production',timestamp:new Date().toISOString()}}}})});
  const state=await start(db,applicant,input(caseId),port);assert.equal(state.outcome,'manual_review');
  const reader={authorize:async()=>({allowed:true,policyReference:'fixture-private-access',decisionReference:'fixture-decision'}),open:async reference=>({caseId:state.id,reference,body:new Response(bytes).body})};
  const response=await readPrivateIdentityEvidence(db,reviewer,state.id,reader);assert.deepEqual(new Uint8Array(await response.arrayBuffer()),bytes);
  assert.equal(db.sql.prepare("SELECT count(*) n FROM audit_events WHERE event_type='identity_provider_evidence_read_ready' AND actor_id=?").get(reviewer.userId).n,1);
  assert.equal((await read(db,applicant,state.id)).identityVerified,false);
  await suspend(db,reviewer,state.id,'Fixture withdrawal');await assert.rejects(readPrivateIdentityEvidence(db,reviewer,state.id,reader));
 }finally{db.sql.close();}
});
