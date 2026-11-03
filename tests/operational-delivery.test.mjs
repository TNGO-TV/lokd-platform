import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { env } from "cloudflare:workers";
import {runOperationalDelivery,reconcileUnsubmittedNotice} from '../app/lib/operational-delivery.ts';

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

const input={requestKey:'9e2f2d2d-45c5-4ac8-bfa1-791156cbaf6e',organisationName:'Fictional Delivery Client',contactName:'Synthetic Signer',email:'signer@example.test',siteArea:'Sandton',siteType:'commercial_property',requiredStart:'planning',message:'Synthetic isolated delivery test with no provider connection.',advanceFundingAcknowledged:true,privacyConsent:true};
async function fixture(){const database=migratedDatabase(),db=new D1Adapter(database);const {submitClientEnquiry}=await import('../app/api/enquiries/route.ts');const response=await submitClientEnquiry(publicRequest(input),db);assert.equal(response.status,202);return {database,db,id:(await response.json()).reference};}
const reply=value=>Response.json(value);
const RELAY='https://mail-relay.example.test/smtp';
const runtime=id=>({LOKD_OPERATIONAL_DELIVERY_ENABLED:'true',LOKD_DELIVERY_SOURCE_ALLOWLIST:id,LOKD_DELIVERY_EMAIL_ALLOWLIST:'team@example.test',LOKD_TEAM_EMAIL:'team@example.test',LOKD_EMAIL_PROVIDER:'smtp',LOKD_EMAIL_FROM:'notices@example.test',LOKD_SMTP_HOST:'mail.lokd.co.za',LOKD_SMTP_PORT:'587',LOKD_SMTP_USER:'notices@example.test',LOKD_SMTP_PASSWORD:'synthetic-only',LOKD_SMTP_RELAY_URL:RELAY,LOKD_SMTP_RELAY_TOKEN:'synthetic-relay-token'});
const job=(x,kind)=>x.database.prepare('SELECT * FROM operational_delivery_jobs WHERE kind=?').get(kind);
const relayCalls=calls=>calls.filter(c=>c.url===RELAY);
function transportFor(calls,{postEmail}={}){return async(url,init)=>{calls.push({url,init});if(url===RELAY){assert.equal(init.redirect,'manual');const body=JSON.parse(init.body);assert.equal(body.password,undefined);assert.equal(init.headers.authorization,'Bearer synthetic-relay-token');assert.equal(JSON.stringify(body).includes('synthetic-only'),false);return postEmail?postEmail(init):reply({provider_id:'smtp:fixture:250 ok'});}throw Error('Unexpected URL '+url);};}

test('intake atomically queues one CRM and one team job, with no traffic by default',async()=>{
 const x=await fixture();try{assert.equal(x.database.prepare('SELECT count(*) AS n FROM operational_delivery_jobs').get().n,2);await runOperationalDelivery(x.db,{}, {transport:()=>{throw Error('Network forbidden');}});assert.equal(job(x,'enquiry_crm').attempts,0);
 const {submitClientEnquiry}=await import('../app/api/enquiries/route.ts');await submitClientEnquiry(publicRequest(input),x.db);assert.equal(x.database.prepare('SELECT count(*) AS n FROM operational_delivery_jobs').get().n,2);
 assert.throws(()=>x.database.prepare('DELETE FROM operational_delivery_jobs').run(),/history/);
 assert.throws(()=>x.database.prepare("INSERT OR REPLACE INTO operational_delivery_jobs(id,kind,source_id,environment,next_attempt_at,created_at,updated_at) SELECT id,kind,source_id,environment,next_attempt_at,created_at,updated_at FROM operational_delivery_jobs LIMIT 1").run(),/original_claim/);
 }finally{x.database.close();}
});
test('unconfigured CRM job settles with no request while SMTP acceptance stays separate from inbox confirmation and booking funding',async()=>{
 const x=await fixture(),calls=[];let now=Date.now()+1000;try{await runOperationalDelivery(x.db,runtime(x.id),{transport:transportFor(calls),now:()=>now});assert.equal(job(x,'enquiry_crm').state,'cancelled');assert.equal(job(x,'enquiry_crm').last_error,'crm_companion_not_configured');assert.equal(job(x,'enquiry_crm').attempts,0);assert.equal(job(x,'enquiry_crm').provider_id,null);assert.equal(job(x,'enquiry_email').state,'sent');assert.match(job(x,'enquiry_email').provider_id,/^smtp:/);assert.equal(x.database.prepare('SELECT count(*) AS n FROM bookings').get().n,0);
 assert.equal(calls.every(c=>c.url===RELAY),true);
 const mail=JSON.parse(relayCalls(calls)[0].init.body);assert.equal(mail.text.includes(input.message),false);assert.equal(mail.text.includes(input.email),false);assert.ok(mail.text.includes('https://operations.lokd.co.za/ops/intake?kind=client'));assert.equal(mail.text.includes('demo.lokd.co.za'),false);
 now+=61000;await runOperationalDelivery(x.db,runtime(x.id),{transport:transportFor(calls),now:()=>now});assert.equal(job(x,'enquiry_email').state,'sent');assert.equal(job(x,'enquiry_crm').state,'cancelled');assert.equal(relayCalls(calls).length,1);
 }finally{x.database.close();}
});
test('parallel dispatchers claim each job once',async()=>{
 const x=await fixture(),calls=[];try{const options={transport:transportFor(calls),now:()=>Date.now()+1000};await Promise.all([runOperationalDelivery(x.db,runtime(x.id),options),runOperationalDelivery(x.db,runtime(x.id),options)]);assert.equal(relayCalls(calls).length,1);assert.equal(calls.every(c=>c.url===RELAY),true);}finally{x.database.close();}
});
test('lost SMTP acceptance stays uncertain and is never automatically resent',async()=>{
 for(const change of ['expiry','recipient']){const x=await fixture(),calls=[];let now=Date.now()+1000;try{const transport=transportFor(calls,{postEmail:()=>{throw Error('lost');}});await runOperationalDelivery(x.db,runtime(x.id),{transport,now:()=>now});assert.equal(job(x,'enquiry_email').state,'uncertain');now+=change==='expiry'?24*3600000:120001;const r=runtime(x.id);if(change==='recipient'){r.LOKD_TEAM_EMAIL='other@example.test';r.LOKD_DELIVERY_EMAIL_ALLOWLIST='other@example.test';}await runOperationalDelivery(x.db,r,{transport,now:()=>now});assert.equal(relayCalls(calls).length,1);assert.equal(job(x,'enquiry_email').state,'uncertain');assert.throws(()=>x.database.prepare("UPDATE operational_delivery_jobs SET recipient='another@example.test' WHERE kind='enquiry_email'").run(),/immutable/);}finally{x.database.close();}}
});
test('missing allowlists block email before sending and an unconfigured CRM never calls out',async()=>{
 const x=await fixture(),calls=[];let now=Date.now()+1000;try{await runOperationalDelivery(x.db,{...runtime(x.id),LOKD_DELIVERY_SOURCE_ALLOWLIST:''},{transport:transportFor(calls),now:()=>now});assert.equal(calls.length,0);assert.equal(job(x,'enquiry_email').state,'blocked');assert.equal(job(x,'enquiry_crm').state,'cancelled');assert.equal(job(x,'enquiry_crm').attempts,0);now+=900001;await runOperationalDelivery(x.db,{...runtime(x.id),LOKD_DELIVERY_EMAIL_ALLOWLIST:''},{transport:transportFor(calls),now:()=>now});assert.equal(calls.length,0);assert.equal(job(x,'enquiry_email').state,'blocked');assert.equal(job(x,'enquiry_crm').last_error,'crm_companion_not_configured');}finally{x.database.close();}
});
test('SMTP acceptance has no later receipt poll and never resends',async()=>{
 const x=await fixture(),calls=[];let now=Date.now()+1000;try{await runOperationalDelivery(x.db,runtime(x.id),{transport:transportFor(calls),now:()=>now});now+=61000;await runOperationalDelivery(x.db,runtime(x.id),{transport:transportFor(calls),now:()=>now});assert.equal(job(x,'enquiry_email').state,'sent');assert.equal(job(x,'enquiry_email').last_error,null);now+=3600000;await runOperationalDelivery(x.db,runtime(x.id),{transport:transportFor(calls),now:()=>now});assert.equal(relayCalls(calls).length,1);}finally{x.database.close();}
});
test('removed email providers make no requests',async()=>{
 const {emailReceipt,sendEmail,configuredEmailProvider}=await import('../app/lib/operational-provider.ts');let requests=0;const transport=async()=>{requests++;throw Error('network');};
 for(const provider of ['foreign-mail','resend','disabled',''])await assert.rejects(async()=>configuredEmailProvider({LOKD_EMAIL_PROVIDER:provider,LOKD_SMTP_HOST:'mail.lokd.co.za',LOKD_SMTP_USER:'notices@example.test',LOKD_SMTP_PASSWORD:'synthetic-only'}),/not_configured/);
 const foreign={LOKD_EMAIL_PROVIDER:'foreign-mail',FOREIGN_MAIL_TOKEN:'synthetic-only',LOKD_FOREIGN_MAIL_ORIGIN:'https://mail-api.example.test'};
 await assert.rejects(()=>sendEmail(foreign,'job',{_lokdProvider:'foreign-mail',from:'notices@example.test',to:['team@example.test'],subject:'Test',text:'Test'},transport),/not_configured/);
 await assert.rejects(()=>emailReceipt(runtime('test'),{_lokdProvider:'smtp',from:'notices@example.test',to:['team@example.test'],subject:'Test',text:'Test'},'job','not-smtp','team@example.test',transport),/receipt_mismatch/);
 assert.equal(await emailReceipt(runtime('test'),{_lokdProvider:'smtp',from:'notices@example.test',to:['team@example.test'],subject:'Test',text:'Test'},'job','smtp:job:250 ok','team@example.test',transport),'sent');
 assert.equal(requests,0);
});
test('delivery API requires authenticated Operations and same-origin writes',async()=>{const x=await fixture();try{env.DB=x.db;env.LOKD_PILOT_ACCESS_JSON=JSON.stringify({owners:['owner@example.test']});const route=await import('../app/api/operational-delivery/route.ts');assert.equal((await route.GET(new Request('https://demo.lokd.co.za/api/operational-delivery'))).status,401);const headers={'x-lokd-verified-user-id':'owner','x-lokd-verified-email':'owner@example.test'};assert.equal((await route.GET(new Request('https://demo.lokd.co.za/api/operational-delivery',{headers}))).status,200);assert.notEqual((await route.POST(new Request('https://demo.lokd.co.za/api/operational-delivery',{method:'POST',headers:{...headers,origin:'https://attacker.example','content-type':'application/json'},body:'{}'}))).status,200);}finally{delete env.DB;x.database.close();}});
test('SMTP unknown outcomes and lost leases never automatically resend',async()=>{
 for(const mode of ['timeout','server','malformed','lost-lease']){
  const x=await fixture(),calls=[];let now=Date.now()+1000,sends=0;
  try{
   const fallback=transportFor(calls);const transport=async(url,init)=>{
    if(url===RELAY){sends++;if(mode==='server')return new Response('',{status:503});if(mode==='malformed')return reply({});throw Error('lost');}return fallback(url,init);
   };
   if(mode==='lost-lease')x.database.prepare("UPDATE operational_delivery_jobs SET state='dispatching',request_json=?,attempts=1,first_attempt_at=?,lease_expires_at=? WHERE kind='enquiry_email'").run(JSON.stringify({_lokdProvider:'smtp'}),new Date(now-1000).toISOString(),new Date(now-1).toISOString());
   await runOperationalDelivery(x.db,runtime(x.id),{transport,now:()=>now});assert.equal(job(x,'enquiry_email').state,'uncertain');
   now+=3600001;await runOperationalDelivery(x.db,runtime(x.id),{transport,now:()=>now});assert.equal(sends,mode==='lost-lease'?0:1);
  }finally{x.database.close();}
 }
});

test('explicit non-submission reconciliation preserves history and grants just one retry after expiry',async()=>{
 const x=await fixture(),calls=[];let now=Date.now()+1000,sends=0;
 try{
  const fallback=transportFor(calls),transport=async(url,init)=>{if(url===RELAY){sends++;throw Error('synthetic unknown outcome');}return fallback(url,init);};
  await runOperationalDelivery(x.db,runtime(x.id),{transport,now:()=>now});
  const original=job(x,'enquiry_email');now+=24*3600000;
  const notice={id:original.id,updatedAt:original.updated_at,evidence:'Confirmed pre-network runtime rejection and reviewed complete provider logs; this synthetic notice was never submitted.',confirmedNotSubmitted:true};
  for(const invalid of [{...notice,confirmedNotSubmitted:false},{...notice,evidence:'missing proof'}])await assert.rejects(()=>reconcileUnsubmittedNotice(x.db,runtime(x.id),invalid,'operator',now));
  await assert.rejects(()=>reconcileUnsubmittedNotice(x.db,{...runtime(x.id),LOKD_DELIVERY_SOURCE_ALLOWLIST:''},notice,'operator',now));
  await assert.rejects(()=>reconcileUnsubmittedNotice(x.db,{...runtime(x.id),LOKD_TEAM_EMAIL:'changed@example.test'},notice,'operator',now));
  await assert.rejects(()=>reconcileUnsubmittedNotice(x.db,{...runtime(x.id),LOKD_EMAIL_PROVIDER:'foreign-mail'},notice,'operator',now));
  const concurrent=await Promise.allSettled([reconcileUnsubmittedNotice(x.db,runtime(x.id),notice,'operator',now),reconcileUnsubmittedNotice(x.db,runtime(x.id),notice,'operator',now)]);
  assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,1);
  const audit=x.database.prepare("SELECT * FROM audit_events WHERE event_type='delivery_non_submission_confirmed'").all();assert.equal(audit.length,1);assert.equal(audit[0].actor_id,'operator');assert.equal(JSON.parse(audit[0].detail).attempts,1);
  assert.equal(job(x,'enquiry_email').attempts,1);assert.equal(job(x,'enquiry_email').request_json,original.request_json);assert.equal(job(x,'enquiry_email').first_attempt_at,original.first_attempt_at);
  await runOperationalDelivery(x.db,runtime(x.id),{transport,now:()=>now});assert.equal(sends,2);assert.equal(job(x,'enquiry_email').state,'uncertain');
  now+=3600000;await runOperationalDelivery(x.db,runtime(x.id),{transport,now:()=>now});assert.equal(sends,2);
  await assert.rejects(()=>reconcileUnsubmittedNotice(x.db,runtime(x.id),notice,'operator',now));
 }finally{x.database.close();}
});
test('reconciliation cannot replay the company check, accepted email or a closed enquiry',async()=>{
 const x=await fixture(),calls=[];const now=Date.now()+1000;
 try{
  const fallback=transportFor(calls),transport=async(url,init)=>url===RELAY?Promise.reject(Error('unknown')):fallback(url,init);
  await runOperationalDelivery(x.db,runtime(x.id),{transport,now:()=>now});
  const current=job(x,'enquiry_email'),notice={id:current.id,updatedAt:current.updated_at,evidence:'Verified provider non-submission evidence for this synthetic notice with exact source correlation.',confirmedNotSubmitted:true};
  await assert.rejects(()=>reconcileUnsubmittedNotice(x.db,runtime(x.id),{...notice,id:job(x,'enquiry_crm').id},'operator',now));
  x.database.prepare("UPDATE operational_delivery_jobs SET state='sent',provider_id='smtp:accepted:250 ok' WHERE kind='enquiry_email'").run();
  await assert.rejects(()=>reconcileUnsubmittedNotice(x.db,runtime(x.id),notice,'operator',now));
  assert.equal(x.database.prepare("SELECT count(*) n FROM audit_events WHERE event_type='delivery_non_submission_confirmed'").get().n,0);
 }finally{x.database.close();}
});

test('manual receipt checks never dispatch queued jobs or call the relay again',async()=>{
 const x=await fixture(),calls=[];let now=Date.now()+1000;
 try{
  await runOperationalDelivery(x.db,runtime(x.id),{transport:transportFor(calls),now:()=>now,receiptsOnly:true});assert.equal(calls.length,0);
  await runOperationalDelivery(x.db,runtime(x.id),{transport:transportFor(calls),now:()=>now});
  now+=61000;await runOperationalDelivery(x.db,runtime(x.id),{transport:transportFor(calls),now:()=>now,receiptsOnly:true});assert.equal(job(x,'enquiry_email').state,'sent');assert.equal(job(x,'enquiry_email').last_error,null);assert.equal(job(x,'enquiry_email').attempts,1);assert.equal(relayCalls(calls).length,1);
  await runOperationalDelivery(x.db,runtime(x.id),{transport:transportFor(calls),now:()=>now,receiptsOnly:true});assert.equal(relayCalls(calls).length,1);
 }finally{x.database.close();}
});
