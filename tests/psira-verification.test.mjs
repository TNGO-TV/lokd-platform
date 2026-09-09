import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { env } from 'cloudflare:workers';
import { GET, POST } from '../app/api/psira/route.ts';
import { PSIRA_SOURCE, reviewEvidence, verificationState } from '../app/lib/psira-verification.ts';
class Prepared {
  constructor(owner, sql, values = []) { this.owner = owner; this.sql = sql; this.values = values; }
  bind(...values) { return new Prepared(this.owner, this.sql, values); }
  async first() { return this.owner.database.prepare(this.sql).get(...this.values) ?? null; }
  async all() { return { results: this.owner.database.prepare(this.sql).all(...this.values) }; }
  async run() { return this.runSync(); }
  runSync() {
    const result = this.owner.database.prepare(this.sql).run(...this.values);
    return { meta: { changes: Number(result.changes) } };
  }
}

class D1Adapter {
  constructor(database) { this.database = database; }
  prepare(sql) { return new Prepared(this, sql); }
  async batch(statements) {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const results = statements.map((statement) => statement.runSync());
      this.database.exec("COMMIT");
      return results;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
}

function migratedDatabase() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys=ON");
  for (const file of fs.readdirSync(new URL("../drizzle", import.meta.url)).filter((name) => name.endsWith(".sql")).sort()) {
    database.exec(fs.readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8").replaceAll("--> statement-breakpoint", ""));
  }
  return database;
}


const actors={officer:{id:'user_officer',email:'officer@example.test'},other:{id:'user_other',email:'other@example.test'},ops:{id:'user_ops',email:'ops@example.test'}};
function request(who,scope,body){return new Request(`https://${scope==='officer'?'officers':'operations'}.lokd.co.za/api/psira?scope=${scope}`,{method:body?'POST':'GET',headers:{'content-type':'application/json',...(who?{'x-lokd-verified-email':actors[who].email,'x-lokd-verified-user-id':actors[who].id}:{})},body:body?JSON.stringify(body):undefined});}
const evidence=()=>({source:PSIRA_SOURCE,checkedAt:new Date().toISOString(),returnedNumber:'1234567',returnedName:'Synthetic Officer',returnedStatus:'Registered',grade:'A',certificateExpiry:'',employmentStatus:'Inactive',excerpt:'Synthetic test fixture: Registered, Grade A. Not a live result.',identityEvidence:''});
const review=(record,overrides={})=>({action:'review',caseId:record.id,expectedVersion:record.version,registrationStatus:'registered',identityMatch:'unchecked',evidence:evidence(),recheckAt:new Date(Date.now()+86400000).toISOString(),...overrides});
test('account-bound PSiRA workflow preserves evidence, scope, identity separation, expiry and rechecks',async()=>{
 const db=migratedDatabase();env.DB=new D1Adapter(db);env.LOKD_APP_STAGE='demo';env.LOKD_PILOT_ACCESS_JSON=JSON.stringify({operations:[actors.ops.email],officers:{[actors.officer.email]:'OFF-001',[actors.other.email]:'OFF-002'}});
 try{
  assert.equal((await GET(request(null,'operations'))).status,401);
  const publicDemo=new Request('https://demo.lokd.co.za/api/psira?scope=operations');assert.equal((await GET(publicDemo)).status,401);
  assert.equal((await GET(request('officer','operations'))).status,403);
  assert.equal((await POST(request('officer','officer',{action:'submit',psiraNumber:'bad'}))).status,400);
  let response=await POST(request('officer','officer',{action:'submit',psiraNumber:'1234567'}));assert.equal(response.status,200);
  let record=(await response.json()).cases[0];assert.equal(record.verified,false);assert.equal(record.events[0].identity_match,'unchecked');
  assert.equal((await (await GET(request('other','officer'))).json()).cases.length,0);
  assert.equal((await POST(request('other','officer',{action:'recheck',caseId:record.id,expectedVersion:record.version}))).status,403);
  assert.equal((await POST(request('officer','officer',review(record)))).status,403);
  assert.equal((await POST(request('ops','operations',review(record,{expectedVersion:0})))).status,409);
  response=await POST(request('ops','operations',review(record)));assert.equal(response.status,200);record=(await response.json()).cases[0];assert.equal(record.verified,false);assert.equal(record.events[0].registration_status,'registered');
  assert.equal((await POST(request('ops','operations',review(record,{identityMatch:'confirmed'})))).status,400);
  const proof={...evidence(),identityEvidence:'Synthetic independent identity-review reference IDV-TEST'};
  response=await POST(request('ops','operations',review(record,{identityMatch:'confirmed',evidence:proof})));assert.equal(response.status,200);record=(await response.json()).cases[0];assert.equal(record.verified,true);
  assert.equal(verificationState(record.events[0],Date.now()+2*86400000).verified,false);
  const previousHash=record.events[0].evidence_hash;
  assert.throws(()=>db.prepare('UPDATE psira_verification_events SET evidence_json = ? WHERE id = ?').run('{}',record.events[0].id),/append-only/);
  assert.throws(()=>db.prepare('DELETE FROM psira_verification_events WHERE id = ?').run(record.events[0].id),/append-only/);
  response=await POST(request('officer','officer',{action:'recheck',caseId:record.id,expectedVersion:record.version}));record=(await response.json()).cases[0];assert.equal(record.verified,false);assert.equal(record.events[0].registration_status,'pending_review');assert.equal(record.events[1].evidence_hash,previousHash);
  for(const outcome of ['unavailable','ambiguous','not_registered']){
   response=await POST(request('ops','operations',review(record,{registrationStatus:outcome,evidence:{...evidence(),returnedStatus:outcome==='not_registered'?'Not Registered':'Service inconclusive'}})));assert.equal(response.status,200);record=(await response.json()).cases[0];assert.equal(record.verified,false);
  }
  const first=record.events.at(-1);assert.equal(first.psira_number,'1234567');
  const staleVersion=record.version;
  response=await POST(request('officer','officer',{action:'submit',psiraNumber:'7654321',expectedVersion:staleVersion}));record=(await response.json()).cases[0];assert.equal(record.psira_number,'7654321');assert.equal(record.verified,false);assert.equal(record.events.at(-1).psira_number,'1234567');
  assert.equal((await POST(request('ops','operations',review(record,{expectedVersion:staleVersion})))).status,409);
 }finally{db.close();delete env.DB;delete env.LOKD_PILOT_ACCESS_JSON;delete env.LOKD_APP_STAGE;}
});
test('source evidence fails closed for mismatched registration, future times, missing identity proof and stale deadlines',()=>{
 const base=review({id:'fixture',version:1});
 assert.throws(()=>reviewEvidence({...base,evidence:{...evidence(),returnedNumber:'7654321'}},'1234567'));
 assert.throws(()=>reviewEvidence({...base,evidence:{...evidence(),source:'https://untrusted.example'}},'1234567'));
 assert.throws(()=>reviewEvidence({...base,evidence:{...evidence(),checkedAt:new Date(Date.now()+86400000).toISOString()}},'1234567'));
 assert.throws(()=>reviewEvidence({...base,registrationStatus:'unavailable',identityMatch:'confirmed',evidence:{...evidence(),identityEvidence:'not sufficient'}},'1234567'));
 assert.throws(()=>reviewEvidence({...base,recheckAt:new Date(Date.now()-1).toISOString()},'1234567'));
 const expired=reviewEvidence({...base,evidence:{...evidence(),certificateExpiry:'2020-01-01'}},'1234567');assert.ok(Date.parse(expired.recheckAt)<Date.now());
});

test('training and unregistered declarations avoid lookup without granting work eligibility; switching to registered requires verification',async()=>{
 const db=migratedDatabase();env.DB=new D1Adapter(db);env.LOKD_APP_STAGE='demo';env.LOKD_PILOT_ACCESS_JSON=JSON.stringify({operations:[actors.ops.email],officers:{[actors.officer.email]:'OFF-001'}});
 try{
  for(const declaration of ['training','not_registered']){
   const current=(await(await GET(request('officer','officer'))).json()).cases[0];
   const response=await POST(request('officer','officer',{action:'submit',declaration,psiraNumber:'ignored',expectedVersion:current?.version}));assert.equal(response.status,200);
   const record=(await response.json()).cases[0];assert.equal(record.declaration,declaration);assert.equal(record.psira_number,'');assert.equal(record.events[0].registration_status,'not_required');assert.equal(record.verified,false);assert.equal(record.recheckDue,false);
   assert.equal((await POST(request('ops','operations',review(record)))).status,409);
   assert.equal((await POST(request('officer','officer',{action:'recheck',caseId:record.id,expectedVersion:record.version}))).status,409);
  }
  let current=(await(await GET(request('officer','officer'))).json()).cases[0];
  assert.equal((await POST(request('officer','officer',{action:'submit',declaration:'registered',expectedVersion:current.version}))).status,400);
  const response=await POST(request('officer','officer',{action:'submit',declaration:'registered',psiraNumber:'1234567',expectedVersion:current.version}));assert.equal(response.status,200);current=(await response.json()).cases[0];assert.equal(current.events[0].registration_status,'pending_review');assert.equal(current.verified,false);assert.equal(current.events[1].registration_status,'not_required');
 }finally{db.close();delete env.DB;delete env.LOKD_PILOT_ACCESS_JSON;delete env.LOKD_APP_STAGE;}
});

test('production assignment gate requires matching, current registration and identity evidence',async()=>{
 const { officerHasCurrentPsiraVerification, writePsiraCase }=await import('../app/lib/psira-server.ts');
 const db=migratedDatabase();const adapter=new D1Adapter(db);
 try{
  db.prepare(`INSERT INTO officers (id,full_name,mobile,email,city,psira_number,psira_grade,psira_expiry) VALUES (?,?,?,?,?,?,?,?)`).run('OFF-TEST','Test Officer','+27820000009',actors.officer.email,'Johannesburg','1234567','A','2099-01-01');
  const officer={userId:actors.officer.id,email:actors.officer.email,operations:false};const ops={userId:actors.ops.id,email:actors.ops.email,operations:true};
  const end=new Date(Date.now()+3600000).toISOString();
  assert.equal(await officerHasCurrentPsiraVerification(adapter,'OFF-TEST',end),false);
  const id=await writePsiraCase(adapter,officer,{action:'submit',psiraNumber:'1234567',declaration:'registered'});
  await writePsiraCase(adapter,ops,review({id,version:1},{identityMatch:'confirmed',evidence:{...evidence(),identityEvidence:'Synthetic independent identity record',certificateExpiry:'2099-01-01'}}));
  assert.equal(await officerHasCurrentPsiraVerification(adapter,'OFF-TEST',end),true);
  db.prepare('UPDATE officers SET psira_grade = ? WHERE id = ?').run('B','OFF-TEST');assert.equal(await officerHasCurrentPsiraVerification(adapter,'OFF-TEST',end),false);
  db.prepare('UPDATE officers SET psira_grade = ? WHERE id = ?').run('A','OFF-TEST');
  assert.equal(await officerHasCurrentPsiraVerification(adapter,'OFF-TEST',new Date(Date.now()+2*86400000).toISOString()),false);
  await writePsiraCase(adapter,officer,{action:'submit',declaration:'training',expectedVersion:2});
  assert.equal(await officerHasCurrentPsiraVerification(adapter,'OFF-TEST',end),false);
 }finally{db.close();}
});

test('public intake makes registered checks mandatory and routes training without requiring a number',async()=>{
 const { POST: submit }=await import('../app/api/applications/route.ts');
 const db=migratedDatabase();env.DB=new D1Adapter(db);
 const base={fullName:'Synthetic Applicant',email:'applicant@example.test',city:'Johannesburg',province:'Gauteng',services:['Unarmed'],purposes:['Commercial access'],training:['Entry-level security training'],over18Confirmed:true,eligibilityAcknowledged:true,contactConsent:true};
 const send=(input)=>submit(new Request('https://lokd.co.za/api/applications',{method:'POST',headers:{'content-type':'application/json',origin:'https://lokd.co.za'},body:JSON.stringify({...base,...input})}));
 try{
  assert.equal((await send({mobile:'0820000091',pathway:'qualified',psiraStatus:'active'})).status,400);
  for(const [i,pathway,psiraStatus,expected] of [[1,'qualified','active','psira_review_required'],[2,'qualified','expired','psira_review_required'],[3,'qualified','not_registered','registration_guidance'],[4,'qualified','in_training','training_requested'],[5,'training','active','training_requested']]){
   const response=await send({mobile:`082000008${i}`,pathway,psiraStatus,...(i<3?{psiraNumber:'1234567'}:{})});assert.equal(response.status,202);const body=await response.json();assert.equal(body.psiraVerificationRequired,i<3);const row=db.prepare('SELECT status,psira_number FROM officer_applications WHERE id = ?').get(body.reference);assert.equal(row.status,expected);assert.equal(row.psira_number,i<3?'1234567':null);
  }
 }finally{db.close();delete env.DB;}
});
