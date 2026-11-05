import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { env } from "cloudflare:workers";
import { installSmtpServer, smtpRuntime } from "./fixtures/smtp-server.mjs";

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

function publicRequest(body) {
  return new Request("https://lokd.co.za/api/enquiries", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://lokd.co.za", "sec-fetch-site": "same-origin" },
    body: JSON.stringify(body),
  });
}

function operationsRequest(method, body) {
  return new Request("https://operations.lokd.co.za/api/enquiries", {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      origin: "https://operations.lokd.co.za",
      "sec-fetch-site": "same-origin",
      "x-lokd-verified-email": "owner@lokd.example",
      "x-lokd-verified-user-id": "fixture-owner",
      "x-lokd-verified-mfa-enrolled": "true",
      "x-lokd-verified-second-factor-at": new Date().toISOString(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const validEnquiry = {
  requestKey:"11111111-1111-4111-8111-111111111111",
  organisationName: "Controlled Client",
  contactName: "Client Contact",
  email: "client.contact@example.test",
  mobile: "082 555 0123",
  siteArea: "Midrand",
  siteType: "logistics_industrial",
  requiredStart: "one_to_three_months",
  message: "We need a planned access-control post for an approved Johannesburg logistics site.",
  advanceFundingAcknowledged: true,
  privacyConsent: true,
  company: "",
};

test('every advertised service saves without granting credit or bypassing intake integrity',async(t)=>{
 t.mock.timers.enable({apis:['Date'],now:new Date()});
 const database=migratedDatabase(),db=new D1Adapter(database),{submitClientEnquiry}=await import('../app/api/enquiries/route.ts');
 try{
  for(const serviceType of ['scheduled_unarmed_fixed_site','armed_static','armed_movement','vip_unarmed','vip_armed','vip_protective_driver','vip_team']){
   t.mock.timers.tick(3600001);
   const result=await submitClientEnquiry(publicRequest({...validEnquiry,serviceType,requestKey:crypto.randomUUID()}),db);
   assert.equal(result.status,202,await result.clone().text());const {reference}=await result.json();
   const row=database.prepare('SELECT * FROM client_enquiries WHERE id=?').get(reference);
   assert.equal(row.service_type,serviceType);assert.equal(row.credit_terms_days,0);assert.equal(row.integrity_state,'user_submitted');assert.equal(row.environment,'production');
   const columns=Object.keys(row),insert=database.prepare('INSERT INTO client_enquiries('+columns.join(',')+') VALUES('+columns.map(()=>'?').join(',')+')');
   for(const changed of [{service_type:'unsupported_service'},{credit_terms_days:30},{environment:'staging'},{integrity_state:'synthetic'}]){
    const forged={...row,...changed,id:crypto.randomUUID()};
    assert.throws(()=>insert.run(...columns.map(key=>forged[key])),/CHECK|invalid|production|controlled/);
   }
  }
  assert.equal(database.prepare('SELECT count(*) n FROM client_enquiries').get().n,7);
  assert.equal(database.prepare('SELECT count(*) n FROM bookings').get().n,0);
 }finally{database.close();}
});

test('same contact can save distinct site, service and brief enquiries without disclosure or silent loss',async(t)=>{
 t.mock.timers.enable({apis:['Date'],now:new Date()});
 const database=migratedDatabase(),db=new D1Adapter(database),{submitClientEnquiry}=await import('../app/api/enquiries/route.ts');
 try{
  const ids=[];
  for(const change of [{},{siteArea:'Pretoria'},{serviceType:'vip_team'},{message:'A separate brief for a different building and a different operating schedule.'}]){
   t.mock.timers.tick(3600001);
   const result=await submitClientEnquiry(publicRequest({...validEnquiry,...change,requestKey:crypto.randomUUID()}),db);
   assert.equal(result.status,202);const saved=await result.json();assert.equal(saved.saved,true);ids.push(saved.reference);
  }
  assert.equal(new Set(ids).size,4);assert.equal(database.prepare('SELECT count(*) n FROM client_enquiries').get().n,4);
  // An anonymous caller knowing contact details receives a new receipt, never
  // another person's saved case. Old clients without a key are still accepted.
  const noKey={...validEnquiry};delete noKey.requestKey;
  for(let i=0;i<2;i++){const result=await(await submitClientEnquiry(publicRequest(noKey),db)).json();assert.equal(result.saved,true);assert.ok(!ids.includes(result.reference));ids.push(result.reference);}
  assert.equal(new Set(ids).size,6);assert.equal(database.prepare('SELECT count(*) n FROM client_enquiries').get().n,6);
 }finally{database.close();}
});

test('exact concurrent submission retries return one durable UUID receipt and one audit event',async()=>{
 const database=migratedDatabase(),db=new D1Adapter(database),{submitClientEnquiry}=await import('../app/api/enquiries/route.ts');
 try{
  const responses=await Promise.all(Array.from({length:4},()=>submitClientEnquiry(publicRequest(validEnquiry),db)));
  const bodies=await Promise.all(responses.map(async response=>{assert.equal(response.status,202);return response.json();}));
  assert.ok(bodies.every(body=>body.saved&&body.reference===bodies[0].reference));
  assert.equal(database.prepare('SELECT count(*) n FROM client_enquiries').get().n,1);
  assert.equal(database.prepare('SELECT count(*) n FROM client_enquiry_receipts').get().n,1);
  assert.equal(database.prepare("SELECT count(*) n FROM audit_events WHERE event_type='public_client_enquiry_submitted'").get().n,1);
  const mismatch=await submitClientEnquiry(publicRequest({...validEnquiry,siteArea:'Another site'}),db);
  assert.equal(mismatch.status,409);assert.doesNotMatch(await mismatch.text(),new RegExp(bodies[0].reference));
  assert.equal(database.prepare('SELECT site_area FROM client_enquiries').get().site_area,validEnquiry.siteArea);
 }finally{database.close();}
});

test('receipt recovery handles an acknowledgement lost after commit; failed batches save neither case nor receipt',async()=>{
 const database=migratedDatabase(),db=new D1Adapter(database),{submitClientEnquiry}=await import('../app/api/enquiries/route.ts');
 try{
  const batch=db.batch.bind(db);db.batch=async writes=>{await batch(writes);throw Error('Synthetic acknowledgement lost');};
  const recovered=await submitClientEnquiry(publicRequest(validEnquiry),db);assert.equal(recovered.status,202);assert.equal((await recovered.json()).saved,true);
  db.batch=batch;database.exec("CREATE TRIGGER reject_enquiry_audit BEFORE INSERT ON audit_events WHEN NEW.event_type='public_client_enquiry_submitted' BEGIN SELECT RAISE(ABORT,'synthetic storage failure'); END");
  const next={...validEnquiry,requestKey:crypto.randomUUID()};
  assert.equal((await submitClientEnquiry(publicRequest(next),db)).status,500);
  assert.equal(database.prepare('SELECT count(*) n FROM client_enquiries').get().n,1);assert.equal(database.prepare('SELECT count(*) n FROM client_enquiry_receipts').get().n,1);
  database.exec('DROP TRIGGER reject_enquiry_audit');
  assert.equal((await submitClientEnquiry(publicRequest(next),db)).status,202);assert.equal(database.prepare('SELECT count(*) n FROM client_enquiries').get().n,2);
 }finally{database.close();}
});

test('honeypots, malformed bodies and invalid submission keys do not claim a saved enquiry',async()=>{
 const database=migratedDatabase(),db=new D1Adapter(database),{submitClientEnquiry}=await import('../app/api/enquiries/route.ts');
 try{
  const honeypot=await submitClientEnquiry(publicRequest({...validEnquiry,company:'Bot field'}),db);assert.equal(honeypot.status,202);assert.deepEqual(await honeypot.json(),{received:true});
  for(const body of [null,[],{...validEnquiry,requestKey:'guess'}])assert.equal((await submitClientEnquiry(publicRequest(body),db)).status,400);
  assert.equal(database.prepare('SELECT count(*) n FROM client_enquiries').get().n,0);
 }finally{database.close();}
});

test("public client intake stays production, zero-credit and separate from bookings", async () => {
  const database = migratedDatabase();
  env.DB = new D1Adapter(database);
  env.LOKD_APP_STAGE = "production";
  env.LOKD_ROLE_ACCESS_JSON = JSON.stringify({ owners: ["owner@lokd.example"] });
  env.LOKD_OWNER_ACCESS_JSON = JSON.stringify(["owner@lokd.example"]);
  const enquiries = await import("../app/api/enquiries/route.ts");

  const submitted = await enquiries.POST(publicRequest(validEnquiry));
  assert.equal(submitted.status, 202, await submitted.clone().text());
  const body = await submitted.json();
  assert.match(body.reference, /^ENQ-[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/);
  assert.equal(body.saved,true);
  const saved = database.prepare(`SELECT environment,integrity_state AS integrityState,service_type AS serviceType,
    funding_model AS fundingModel,credit_terms_days AS creditTermsDays,status,version FROM client_enquiries WHERE id=?`).get(body.reference);
  assert.deepEqual({ ...saved }, {
    environment: "production",
    integrityState: "user_submitted",
    serviceType: "scheduled_unarmed_fixed_site",
    fundingModel: "advance_only",
    creditTermsDays: 0,
    status: "new",
    version: 1,
  });
  assert.equal(database.prepare("SELECT COUNT(*) AS total FROM bookings").get().total, 0);
  assert.equal(database.prepare("SELECT COUNT(*) AS total FROM audit_events WHERE entity_id=? AND event_type NOT LIKE 'public_enquiry_rate_%'").get(body.reference).total, 1);
  assert.throws(() => database.prepare("UPDATE client_enquiries SET credit_terms_days=30 WHERE id=?").run(body.reference), /controlled_transition_required/);
  assert.throws(() => database.prepare("DELETE FROM client_enquiries WHERE id=?").run(body.reference), /history_required/);

  const duplicate = await enquiries.POST(publicRequest(validEnquiry));
  assert.equal(duplicate.status, 202);
  assert.equal(database.prepare("SELECT COUNT(*) AS total FROM client_enquiries").get().total, 1);
  database.close();
  delete env.DB;
});

test("only signed-in Operations can own and close a client enquiry, including same-millisecond reviews", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date() });
  const database = migratedDatabase();
  env.DB = new D1Adapter(database);
  env.LOKD_APP_STAGE = "production";
  env.LOKD_ROLE_ACCESS_JSON = JSON.stringify({ owners: ["owner@lokd.example"] });
  delete env.LOKD_OWNER_ACCESS_JSON;
  const enquiries = await import("../app/api/enquiries/route.ts");
  const submitted = await enquiries.POST(publicRequest({ ...validEnquiry, email: "second@example.test" }));
  const { reference } = await submitted.json();

  const anonymous = await enquiries.GET(new Request("https://operations.lokd.co.za/api/enquiries"));
  assert.equal(anonymous.status, 401);
  const queue = await enquiries.GET(operationsRequest("GET"));
  assert.equal(queue.status, 200, await queue.clone().text());
  assert.equal((await queue.json()).enquiries[0].id, reference);

  const triaged = await enquiries.PATCH(operationsRequest("PATCH", { id: reference, action: "triage", version: 1 }));
  assert.equal(triaged.status,200,await triaged.clone().text());
  const {matchesWorkspaceCommand}=await import('../app/lib/workspace-command-receipt.ts');
  assert.equal(await matchesWorkspaceCommand(await triaged.json(),'client-enquiries',{id:reference,action:'triage',version:1}),true);
  const closed = await enquiries.PATCH(operationsRequest("PATCH", { id: reference, action: "close", version: 2, resolution: "Approved for a controlled site review." }));
  assert.equal(closed.status, 200, await closed.text());
  assert.deepEqual({ ...database.prepare("SELECT status,owner_id AS ownerId,resolution,version FROM client_enquiries WHERE id=?").get(reference) }, {
    status: "closed",
    ownerId: "owner@lokd.example",
    resolution: "Approved for a controlled site review.",
    version: 3,
  });
  const stale = await enquiries.PATCH(operationsRequest("PATCH", { id: reference, action: "close", version: 2, resolution: "Stale write" }));
  assert.equal(stale.status, 409);
  assert.equal(database.prepare("SELECT COUNT(*) AS total FROM audit_events WHERE entity_id=? AND event_type NOT LIKE 'public_enquiry_rate_%'").get(reference).total, 3);
  database.close();
  delete env.DB;
});

test('public schedule and both Resend messages persist with exactly one saved receipt',async()=>{
 const database=migratedDatabase(),db=new D1Adapter(database),{submitClientEnquiry}=await import('../app/api/enquiries/route.ts');
 const messages=[];
 const runtime={LOKD_EMAIL_PROVIDER:'resend',RESEND_API_KEY:'local-only-credential',LOKD_EMAIL_FROM:'sender@example.test',LOKD_TEAM_EMAIL:'operations@example.test'};
 const transport=async(url,init)=>{assert.equal(url,'https://api.resend.com/emails');messages.push({key:init.headers['idempotency-key'],body:JSON.parse(init.body)});return Response.json({id:'receipt-'+messages.length});};
 const input={...validEnquiry,siteAddress:'A local fixture address',startDate:'2099-01-01',endDate:'2099-01-03',startTime:'18:00',endTime:'06:00',officers:2,schedule:'Every day in this period'};
 try{
  const response=await submitClientEnquiry(publicRequest(input),db,{runtime,transport});assert.equal(response.status,202);const saved=await response.json();assert.equal(saved.confirmationEmailSent,true);assert.equal(saved.opsEmailSent,true);
  const row=database.prepare('SELECT * FROM client_enquiries').get();assert.equal(row.site_address,input.siteAddress);assert.equal(row.start_date,input.startDate);assert.equal(row.end_time,'06:00');assert.equal(row.officer_count,2);
  assert.equal(messages.length,2);assert.deepEqual(messages[0].body.to,['operations@example.test']);assert.deepEqual(messages[1].body.to,[validEnquiry.email]);assert.match(messages[1].body.text,new RegExp(saved.reference));
  const replay=await(await submitClientEnquiry(publicRequest(input),db,{runtime,transport})).json();assert.equal(replay.reference,saved.reference);assert.equal(replay.confirmationEmailSent,true);assert.equal(messages.length,2);
  assert.equal(database.prepare("SELECT state FROM operational_delivery_jobs WHERE kind='enquiry_email'").get().state,'sent');
  assert.equal((await submitClientEnquiry(publicRequest({...input,officers:3}),db,{runtime,transport})).status,409);
 }finally{database.close();}
});

test('the SMTP mailbox sends the team notice and visitor confirmation once, with no provider setting',async()=>{
 const database=migratedDatabase(),db=new D1Adapter(database),{submitClientEnquiry}=await import('../app/api/enquiries/route.ts');
 const server=installSmtpServer();
 const runtime={...smtpRuntime,LOKD_EMAIL_FROM:'notices@example.test',LOKD_TEAM_EMAIL:'operations@example.test'};
 const transport=async url=>{assert.fail('No HTTP provider request expected: '+url);};
 try{
  const saved=await(await submitClientEnquiry(publicRequest(validEnquiry),db,{runtime,transport})).json();
  assert.equal(saved.confirmationEmailSent,true);assert.equal(saved.opsEmailSent,true);
  const messages=server.messages();assert.equal(messages.length,2);
  assert.equal(messages[0].to,'operations@example.test');assert.equal(messages[1].to,validEnquiry.email);assert.equal(messages[1].from,'notices@example.test');
  const job=database.prepare("SELECT state,provider_id,request_json FROM operational_delivery_jobs WHERE kind='enquiry_email'").get();
  assert.equal(job.state,'sent');assert.match(job.provider_id,/^smtp:/);assert.equal(JSON.parse(job.request_json)._lokdProvider,'smtp');
  const replay=await(await submitClientEnquiry(publicRequest(validEnquiry),db,{runtime,transport})).json();
  assert.equal(replay.reference,saved.reference);assert.equal(replay.confirmationEmailSent,true);assert.equal(server.messages().length,2);
 }finally{server.uninstall();database.close();}
});

test('a lost SMTP reply leaves the enquiry email uncertain and is never resent',async()=>{
 const database=migratedDatabase(),db=new D1Adapter(database),{submitClientEnquiry}=await import('../app/api/enquiries/route.ts');
 const server=installSmtpServer({mode:session=>session===2?'lost':'accept'});
 const runtime={...smtpRuntime,LOKD_EMAIL_FROM:'notices@example.test',LOKD_TEAM_EMAIL:'operations@example.test'};
 try{
  const first=await(await submitClientEnquiry(publicRequest(validEnquiry),db,{runtime})).json();
  assert.equal(first.saved,true);assert.equal(first.confirmationEmailSent,false);assert.equal(server.messages().length,2);
  assert.equal(database.prepare("SELECT state FROM operational_delivery_jobs WHERE kind='enquiry_email'").get().state,'uncertain');
  const replay=await(await submitClientEnquiry(publicRequest(validEnquiry),db,{runtime})).json();
  assert.equal(replay.reference,first.reference);assert.equal(replay.confirmationEmailSent,false);assert.equal(server.messages().length,2);
 }finally{server.uninstall();database.close();}
});

test('lost email acknowledgement retries frozen messages and never reports false email success',async()=>{
 const database=migratedDatabase(),db=new D1Adapter(database),{submitClientEnquiry}=await import('../app/api/enquiries/route.ts');
 const runtime={LOKD_EMAIL_PROVIDER:'resend',RESEND_API_KEY:'local-only-credential',LOKD_EMAIL_FROM:'sender@example.test',LOKD_TEAM_EMAIL:'operations@example.test'};
 let lost=true;const requests=[];
 const transport=async(_url,init)=>{requests.push({key:init.headers['idempotency-key'],body:init.body});if(lost&&requests.length===2)throw new TypeError('Lost acknowledgement');return Response.json({id:init.headers['idempotency-key'].endsWith(':confirmation')?'confirmation-id':'operations-id'});};
 try{
  const first=await(await submitClientEnquiry(publicRequest(validEnquiry),db,{runtime,transport})).json();assert.equal(first.saved,true);assert.equal(first.confirmationEmailSent,false);
  lost=false;const recovered=await(await submitClientEnquiry(publicRequest(validEnquiry),db,{runtime,transport})).json();assert.equal(recovered.reference,first.reference);assert.equal(recovered.confirmationEmailSent,true);
  assert.deepEqual(requests[0],requests[2]);assert.deepEqual(requests[1],requests[3]);assert.equal(database.prepare('SELECT count(*) n FROM client_enquiries').get().n,1);
 }finally{database.close();}
});

test('missing email configuration remains visible without losing a valid enquiry',async()=>{
 const database=migratedDatabase(),db=new D1Adapter(database),{submitClientEnquiry}=await import('../app/api/enquiries/route.ts');
 try{const result=await(await submitClientEnquiry(publicRequest(validEnquiry),db,{runtime:{},transport:async()=>{assert.fail('No provider request without configuration');}})).json();assert.equal(result.saved,true);assert.equal(result.confirmationEmailSent,false);assert.match(database.prepare("SELECT last_error FROM operational_delivery_jobs WHERE kind='enquiry_email'").get().last_error,/RESEND_API_KEY/);}finally{database.close();}
});

test('an older operations-only receipt never claims a visitor confirmation',async()=>{
 const database=migratedDatabase(),db=new D1Adapter(database),{submitClientEnquiry}=await import('../app/api/enquiries/route.ts');
 try{
  const first=await(await submitClientEnquiry(publicRequest(validEnquiry),db,{runtime:{}})).json();
  database.prepare("UPDATE operational_delivery_jobs SET state='sent',request_json=?,provider_id='resend:existing' WHERE source_id=? AND kind='enquiry_email'").run(JSON.stringify({_lokdProvider:'cpanel_smtp',to:['operations@example.test']}),first.reference);
  const replay=await(await submitClientEnquiry(publicRequest(validEnquiry),db,{runtime:{}})).json();
  assert.equal(replay.reference,first.reference);assert.equal(replay.saved,true);assert.equal(replay.confirmationEmailSent,false);
 }finally{database.close();}
});

test('spam admission is atomic and exact receipt recovery remains available after the limit',async()=>{
 const database=migratedDatabase(),db=new D1Adapter(database),{submitClientEnquiry}=await import('../app/api/enquiries/route.ts');
 try{
  const inputs=Array.from({length:4},()=>({...validEnquiry,requestKey:crypto.randomUUID()}));
  const responses=await Promise.all(inputs.map(input=>submitClientEnquiry(publicRequest(input),db)));
  assert.deepEqual(responses.map(r=>r.status).sort(),[202,202,202,429]);assert.equal(database.prepare('SELECT count(*) n FROM client_enquiries').get().n,3);
  const original=inputs[responses.findIndex(r=>r.status===202)];assert.equal((await submitClientEnquiry(publicRequest(original),db)).status,202);
 }finally{database.close();}
});

test('invalid schedules and cross-origin submissions leave no enquiry behind',async()=>{
 const database=migratedDatabase(),db=new D1Adapter(database),{submitClientEnquiry}=await import('../app/api/enquiries/route.ts');
 const base={...validEnquiry,siteAddress:'A local fixture address',startDate:'2099-01-01',endDate:'2099-01-03',startTime:'18:00',endTime:'06:00',officers:2,schedule:'Every day in this period'};
 try{
  for(const change of [{startDate:'2099-02-30'},{endDate:'2098-12-31'},{startTime:'25:00'},{officers:0},{officers:1.5},{schedule:'unknown'},{siteAddress:''}])assert.equal((await submitClientEnquiry(publicRequest({...base,...change}),db)).status,400);
  const request=publicRequest(base);request.headers.set('origin','https://unrelated.example.test');assert.equal((await submitClientEnquiry(request,db)).status,403);
  assert.equal(database.prepare('SELECT count(*) n FROM client_enquiries').get().n,0);
 }finally{database.close();}
});
