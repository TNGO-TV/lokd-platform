import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { env } from "cloudflare:workers";

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

function ownerRequest(method, body) {
  return new Request("https://operations.lokd.co.za/api/applications", {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      origin: "https://operations.lokd.co.za",
      "sec-fetch-site": "same-origin",
      "x-lokd-verified-user-id":"user_fixture", "x-lokd-verified-mfa-enrolled":"true", "x-lokd-verified-second-factor-at":new Date(Date.now()-60000).toISOString(),
      "x-lokd-verified-email": "owner@lokd.example",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const intake = (email, fullName='Public Applicant') => new Request('https://lokd.co.za/api/applications', {
  method:'POST',headers:{'content-type':'application/json',origin:'https://lokd.co.za'},
  body:JSON.stringify({pathway:'qualified',fullName,mobile:'082 555 0199',email,city:'Johannesburg',province:'Gauteng',
    psiraStatus:'active',psiraNumber:'1234567',psiraGrade:'Grade C',services:['Unarmed'],purposes:['Commercial access'],training:[],
    over18Confirmed:true,eligibilityAcknowledged:true,contactConsent:true}),
});

test('concurrent anonymous submissions with shared/recycled phones preserve separate cases and verified account ownership', async () => {
  const database=migratedDatabase(),db=new D1Adapter(database);
  const {submitOfficerApplication}=await import('../app/api/applications/route.ts');
  const {readSignupRecords,writeSignup}=await import('../app/lib/signup-server.ts');
  try {
    const results=await Promise.all(Array.from({length:8},(_,i)=>submitOfficerApplication(intake(`person${i}@example.test`,`Applicant ${i}`),db)));
    const receipts=await Promise.all(results.map(async r=>{assert.equal(r.status,202);return r.json();}));
    assert.equal(new Set(receipts.map(r=>r.reference)).size,8);
    for(const receipt of receipts)assert.deepEqual(Object.keys(receipt).sort(),['pathwayStatus','psiraVerificationRequired','reference','saved']);
    assert.equal(database.prepare("SELECT count(*) AS n FROM officer_applications WHERE mobile_normalized='+27825550199'").get().n,8);
    assert.equal(database.prepare("SELECT count(*) AS n FROM audit_events WHERE event_type='officer_interest_submitted'").get().n,8);
    const actor={userId:'first-account',email:'person0@example.test',operations:false};
    assert.deepEqual((await readSignupRecords(db,actor,'officer')).records.map(r=>r.id),[receipts[0].reference]);
    await assert.rejects(writeSignup(db,actor,{action:'link',kind:'officer',id:receipts[1].reference,expectedVersion:0}),e=>e.status===404);
    await writeSignup(db,actor,{action:'link',kind:'officer',id:receipts[0].reference,expectedVersion:0});
    // Even the same verified email on a different account cannot take an owned case.
    await assert.rejects(writeSignup(db,{...actor,userId:'second-account'},{action:'link',kind:'officer',id:receipts[0].reference,expectedVersion:1}),e=>e.status===404);
    // Unverified repeat submissions neither overwrite the owned case nor suppress new data.
    const repeat=await submitOfficerApplication(intake(actor.email,'Corrected Applicant'),db);
    assert.equal(repeat.status,202);assert.notEqual((await repeat.json()).reference,receipts[0].reference);
    assert.equal(database.prepare('SELECT full_name FROM officer_applications WHERE id=?').get(receipts[0].reference).full_name,'Applicant 0');
    assert.equal(database.prepare('SELECT owner_user_id FROM signup_cases WHERE source_id=?').get(receipts[0].reference).owner_user_id,actor.userId);
  } finally {database.close();}
});

test('intake and its audit record roll back together on a failed write',async()=>{
  const database=migratedDatabase(),db=new D1Adapter(database);
  const {submitOfficerApplication}=await import('../app/api/applications/route.ts');
  try {
    database.exec("CREATE TRIGGER fail_intake_audit BEFORE INSERT ON audit_events WHEN NEW.event_type='officer_interest_submitted' BEGIN SELECT RAISE(ABORT,'fixture audit unavailable'); END;");
    assert.equal((await submitOfficerApplication(intake('rollback@example.test'),db)).status,500);
    assert.equal(database.prepare("SELECT count(*) AS n FROM officer_applications WHERE email_normalized='rollback@example.test'").get().n,0);
  } finally {database.close();}
});

test('production intake appears in the operations queue with confirmation delivery state and no seeded officers',async()=>{
 const database=migratedDatabase();env.DB=new D1Adapter(database);
 env.LOKD_OWNER_ACCESS_JSON=JSON.stringify(['owner@lokd.example']);
 const applications=await import('../app/api/applications/route.ts');
 const officersBefore=database.prepare('SELECT count(*) AS n FROM officers').get().n;
 try{
  const submitted=await applications.POST(intake('queue@example.test'));
  assert.equal(submitted.status,202);const {reference}=await submitted.json();
  const response=await applications.GET(ownerRequest('GET'));assert.equal(response.status,200);
  const queue=await response.json();assert.equal(queue.applications.length,1);assert.equal(queue.applications[0].id,reference);
  assert.equal(queue.applications[0].confirmationEmailStatus,'failed');assert.match(queue.applications[0].confirmationEmailError,/RESEND_API_KEY/);
  assert.equal(database.prepare('SELECT count(*) AS n FROM officers').get().n,officersBefore);
  assert.equal(database.prepare('SELECT count(*) AS n FROM officer_email_outbox').get().n,1);
  const bad=await applications.PATCH(ownerRequest('PATCH',{id:reference,action:'start_demo_identity'}));assert.equal(bad.status,400);
  assert.equal(database.prepare('SELECT identity_verification_status AS s FROM officer_applications WHERE id=?').get(reference).s,'consent_pending');
 }finally{database.close();delete env.LOKD_OWNER_ACCESS_JSON;}
});
test('application queue and review require an assigned operations account and current version',async()=>{
 const database=migratedDatabase();env.DB=new D1Adapter(database);env.LOKD_OWNER_ACCESS_JSON=JSON.stringify(['owner@lokd.example']);
 const applications=await import('../app/api/applications/route.ts');
 try{
  const submitted=await applications.POST(intake('review@example.test'));const {reference}=await submitted.json();
  assert.equal((await applications.GET(new Request('https://operations.lokd.co.za/api/applications'))).status,401);
  const request=ownerRequest('GET');request.headers.set('x-lokd-verified-email','unassigned@example.test');assert.equal((await applications.GET(request)).status,403);
  const review=()=>applications.PATCH(ownerRequest('PATCH',{id:reference,action:'review',expectedVersion:0,status:'needs_information',note:'Please confirm your current PSiRA grade.'}));
  assert.equal((await review()).status,200);assert.equal((await review()).status,409);
  assert.equal(database.prepare('SELECT status FROM signup_cases WHERE source_id=?').get(reference).status,'needs_information');
 }finally{database.close();delete env.LOKD_OWNER_ACCESS_JSON;}
});

test('keyed Officer retries recover one atomic receipt while separate submissions remain independent',async()=>{
 const database=migratedDatabase(),db=new D1Adapter(database),{submitOfficerApplication}=await import('../app/api/applications/route.ts');
 const input=await intake('keyed@example.test').json(),requestKey=crypto.randomUUID();
 const request=(body)=>new Request('https://lokd.co.za/api/applications',{method:'POST',headers:{origin:'https://lokd.co.za','content-type':'application/json'},body:JSON.stringify(body)});
 try{
  const receipts=await Promise.all(Array.from({length:5},async()=>{const response=await submitOfficerApplication(request({...input,requestKey}),db);assert.equal(response.status,202);return response.json();}));
  assert.equal(new Set(receipts.map(r=>r.reference)).size,1);assert.ok(receipts.every(r=>r.saved===true));
  assert.equal(database.prepare('SELECT count(*) n FROM officer_application_receipts').get().n,1);
  assert.equal(database.prepare("SELECT count(*) n FROM audit_events WHERE event_type='officer_interest_submitted'").get().n,1);
  const changed=await submitOfficerApplication(request({...input,requestKey,city:'Cape Town'}),db);assert.equal(changed.status,409);assert.equal('reference' in await changed.json(),false);
  const separate=await submitOfficerApplication(request({...input,requestKey:crypto.randomUUID()}),db);assert.notEqual((await separate.json()).reference,receipts[0].reference);
  const originalBatch=db.batch.bind(db);db.batch=async statements=>{await originalBatch(statements);throw Error('Synthetic acknowledgement lost after committed batch');};
  const recovered=await submitOfficerApplication(request({...input,requestKey:crypto.randomUUID()}),db);assert.equal(recovered.status,202);assert.equal((await recovered.json()).saved,true);
  for(const table of ['officer_application_receipts']){assert.throws(()=>database.exec('DELETE FROM '+table),/history_required/);assert.throws(()=>database.exec('UPDATE '+table+' SET payload_hash=payload_hash'),/immutable/);}
 }finally{database.close();}
});

test('Officer receipt migration preserves existing applications, consent and immutable audit history',async()=>{
 const database=new DatabaseSync(':memory:');
 for(const file of fs.readdirSync(new URL('../drizzle',import.meta.url)).filter(name=>name.endsWith('.sql')&&Number(name.slice(0,4))<86).sort())database.exec(fs.readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8').replaceAll('--> statement-breakpoint',''));
 try{
  // Historical state must not call today's handler, which requires later outbox migrations.
  database.exec(`INSERT INTO officer_applications(id,pathway,full_name,mobile_normalized,email_normalized,city,province,psira_status,service_interests,training_interests,over_18_confirmed,eligibility_acknowledged,privacy_notice_version,privacy_acknowledged_at,retention_review_at)
    VALUES('existing','qualified','Existing applicant','+27825550199','existing@example.test','Johannesburg','Gauteng','active','[]','[]',1,1,'privacy-v1','2026-09-01','2027-09-01');
    INSERT INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at)
    VALUES('existing-audit','applicant','existing','application_submitted','officer_application','existing','Existing consent recorded','2026-09-01');`);
  const snapshot=()=>JSON.stringify(['officer_applications','audit_events','signup_cases'].map(table=>database.prepare('SELECT * FROM '+table).all()));const before=snapshot();
  database.exec(fs.readFileSync(new URL('../drizzle/0086_officer_application_receipts.sql',import.meta.url),'utf8').replaceAll('--> statement-breakpoint',''));
  assert.equal(snapshot(),before);assert.equal(database.prepare('SELECT count(*) n FROM officer_application_receipts').get().n,0);
 }finally{database.close();}
});
