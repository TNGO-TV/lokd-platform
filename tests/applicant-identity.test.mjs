import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {env} from 'cloudflare:workers';
import {officerIdNumber,runApplicantIdentity,readApplicantIdentity,recoverApplicantIdentity} from '../app/lib/applicant-identity.ts';
import {GET,POST} from '../app/api/identity/route.ts';
class D1 {
 constructor(){this.sql=new DatabaseSync(':memory:');for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())this.sql.exec(fs.readFileSync(`drizzle/${file}`,'utf8').replaceAll('--> statement-breakpoint',''));}
 prepare(sql){const database=this.sql;const make=(values=[])=>({bind:(...v)=>make(v),first:async()=>database.prepare(sql).get(...values)??null,all:async()=>({results:database.prepare(sql).all(...values)}),run:async()=>({meta:{changes:Number(database.prepare(sql).run(...values).changes)}})});return make();}
 async batch(statements){this.sql.exec('BEGIN');try{const results=[];for(const stmt of statements)results.push(await stmt.run());this.sql.exec('COMMIT');return results;}catch(e){this.sql.exec('ROLLBACK');throw e;}}
}
function fixture(){
 const db=new D1(),objects=new Map(),now=new Date().toISOString();
 db.sql.prepare(`INSERT INTO officer_applications(id,pathway,full_name,mobile_normalized,email_normalized,city,province,psira_status,service_interests,training_interests,over_18_confirmed,eligibility_acknowledged,privacy_notice_version,privacy_acknowledged_at,retention_review_at,environment,integrity_state) VALUES('APP-IDENTITY','qualified','Officer Fixture','+27821234567','fixture@example.test','Johannesburg','Gauteng','active','["Unarmed"]','[]',1,1,'privacy-v1',?,?,'prelaunch','user_submitted')`).run(now,now);
 db.sql.prepare(`INSERT INTO signup_cases VALUES('officer','APP-IDENTITY','fixture-owner','linked','','{}',1,'fixture-event',?)`).run(now);
 const runtime={DB:db,BUCKET:{put:async(key,value)=>{objects.set(key,typeof value==='string'?value:new TextDecoder().decode(value));},get:async key=>objects.has(key)?{json:async()=>JSON.parse(objects.get(key))}:null,delete:async key=>objects.delete(key)},VERIFYNOW_API_KEY:'fixture-provider-key',VERIFYNOW_IDENTITY_POLICY_REFERENCE:'fixture-policy',VERIFYNOW_IDENTITY_VALIDITY_DAYS:'30'};
 const input={caseId:'APP-IDENTITY',caseVersion:1,idNumber:'8001015009087',consent:true,consentVersion:'lokd-officer-identity-2026-11-v1'};
 return {db,objects,runtime,input};
}
const success=async(url,options)=>{const body=JSON.parse(options.body);assert.equal(url,'https://www.verifynow.co.za/api/external/verify');assert.equal(body.mode,'production');assert.equal(options.redirect,'manual');return Response.json({success:true,requestId:'fixture-reference',mode:'production',reportType:'said_verification',input:{idNumber:body.idNumber},results:{said_verification:{Status:'Success',realTimeResults:{Status:'ID Number Valid'},meta:{environment:'production',timestamp:new Date().toISOString()}}}});};
test('production identity binds private consent, stores receipt, audits and reuses dispatch',async()=>{
 const f=fixture();let calls=0;const transport=async(...args)=>{calls++;return success(...args);};
 try{
  await assert.rejects(()=>runApplicantIdentity(f.runtime,'intruder',f.input,transport),/own/);assert.equal(calls,0);
  await assert.rejects(()=>runApplicantIdentity(f.runtime,'fixture-owner',{...f.input,consent:false},transport),/consent/);assert.equal(calls,0);
  const state=await runApplicantIdentity(f.runtime,'fixture-owner',f.input,transport);
  assert.equal(state.outcome,'manual_review');assert.equal(state.identityVerified,false);assert.equal(state.mode,'production');assert.equal(calls,1);
  assert.equal(f.db.sql.prepare('SELECT count(*) n FROM verifynow_production_receipts').get().n,1);
  assert.equal(f.db.sql.prepare('SELECT count(*) n FROM officer_identity_evidence').get().n,1);
  assert.equal(f.db.sql.prepare("SELECT count(*) n FROM audit_events WHERE event_type='identity_consent_recorded'").get().n,1);
  assert.equal(JSON.stringify(state).includes(f.input.idNumber),false);
  const receipt=f.db.sql.prepare('SELECT result_json FROM verifynow_production_receipts').get();assert.equal(receipt.result_json.includes(f.input.idNumber),false);
  await runApplicantIdentity(f.runtime,'fixture-owner',f.input,transport);assert.equal(calls,1);
  assert.throws(()=>f.db.sql.exec('UPDATE officer_identity_captures SET applicant_version=2'),/immutable/);
  assert.throws(()=>f.db.sql.exec('DELETE FROM officer_identity_evidence'),/immutable/);
 }finally{f.db.sql.close();}
});
test('unknown delivery is durable and operations recovery performs no second dispatch',async()=>{
 const f=fixture();let calls=0;const transport=async()=>{calls++;throw Error('fixture transport failure');};
 try{
  let state=await runApplicantIdentity(f.runtime,'fixture-owner',f.input,transport);assert.equal(state.outcome,'delivery_unknown');
  state=await runApplicantIdentity(f.runtime,'fixture-owner',f.input,transport);assert.equal(calls,1);
  const body={caseId:f.input.caseId,identityCaseId:state.identityCaseId,outcomeId:state.outcomeId};
  await assert.rejects(()=>recoverApplicantIdentity(f.runtime,'fixture-owner',body,transport),/Independent/);
  state=await recoverApplicantIdentity(f.runtime,'independent-reviewer',body,transport);assert.equal(state.outcome,'delivery_unknown');assert.equal(calls,1);
  assert.equal(f.db.sql.prepare('SELECT count(*) n FROM verifynow_production_claims').get().n,1);
 }finally{f.db.sql.close();}
});
test('missing production configuration blocks capture and stale version cannot disclose earlier results',async()=>{
 const f=fixture();try{
  for(const field of ['VERIFYNOW_API_KEY','VERIFYNOW_IDENTITY_POLICY_REFERENCE','VERIFYNOW_IDENTITY_VALIDITY_DAYS','BUCKET'])await assert.rejects(()=>runApplicantIdentity({...f.runtime,[field]:undefined},'fixture-owner',f.input,success),/configure|unavailable/);
  assert.equal(f.objects.size,0);
  await runApplicantIdentity(f.runtime,'fixture-owner',f.input,success);
  f.db.sql.exec("UPDATE signup_cases SET version=2 WHERE source_id='APP-IDENTITY'");
  const state=await readApplicantIdentity(f.db,'fixture-owner',f.input.caseId);assert.equal(state.outcome,'not_started');assert.equal(state.identityVerified,false);
  await assert.rejects(()=>runApplicantIdentity(f.runtime,'fixture-owner',f.input,success),/changed/);
 }finally{f.db.sql.close();}
});
test('validation rejects invalid ID and API denies anonymous, foreign-workspace and cross-origin access',async()=>{
 assert.equal(officerIdNumber('8001015009087'),'8001015009087');for(const value of ['8001015009088','8001325009087','bad',8001015009087])assert.throws(()=>officerIdNumber(value));
 const f=fixture();try{
  env.DB=f.db;
  assert.equal((await GET(new Request('https://officers.lokd.co.za/api/identity?caseId=APP-IDENTITY'))).status,401);
  assert.equal((await GET(new Request('https://portal.lokd.co.za/api/identity?caseId=APP-IDENTITY',{headers:{'x-lokd-verified-user-id':'fixture-owner','x-lokd-verified-email':'fixture@example.test'}}))).status,403);
  assert.equal((await POST(new Request('https://officers.lokd.co.za/api/identity',{method:'POST',headers:{origin:'https://attacker.test','content-type':'application/json'},body:'{}'}))).status,403);
 }finally{delete env.DB;f.db.sql.close();}
});
