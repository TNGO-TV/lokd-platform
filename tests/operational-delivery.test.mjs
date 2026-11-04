import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { env } from "cloudflare:workers";
import {runOperationalDelivery} from '../app/lib/operational-delivery.ts';
import {configuredEmailProvider} from '../app/lib/operational-provider.ts';

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

const input={requestKey:'9e2f2d2d-45c5-4ac8-bfa1-791156cbaf6e',organisationName:'Example Delivery Client',contactName:'Example Signer',email:'signer@example.test',siteArea:'Sandton',siteType:'commercial_property',requiredStart:'planning',message:'Local delivery check with no provider connection.',advanceFundingAcknowledged:true,privacyConsent:true};
async function fixture(){const database=migratedDatabase(),db=new D1Adapter(database);const {submitClientEnquiry}=await import('../app/api/enquiries/route.ts');const response=await submitClientEnquiry(publicRequest(input),db);assert.equal(response.status,202);return {database,db,id:(await response.json()).reference};}
const runtime={LOKD_TEAM_EMAIL:'team@example.test',LOKD_EMAIL_PROVIDER:'resend',LOKD_EMAIL_FROM:'notices@example.test',RESEND_API_KEY:'re_local_fixture'};
const job=(x,kind)=>x.database.prepare('SELECT * FROM operational_delivery_jobs WHERE kind=?').get(kind);
function resend(calls,{fail=false,lastEvent='delivered'}={}){return async(url,init={})=>{calls.push({url,init});
 if(url==='https://api.resend.com/emails'){if(fail)throw Error('lost response');const body=JSON.parse(init.body);assert.deepEqual(body.to,['team@example.test']);assert.equal(body.from,'notices@example.test');return Response.json({id:'email_1'});}
 if(url==='https://api.resend.com/emails/email_1')return Response.json({id:'email_1',from:'notices@example.test',to:['team@example.test'],subject:'New LOKD service enquiry',last_event:lastEvent});
 throw Error('unexpected '+url);};}

test('intake atomically queues one CRM and one team job, with no traffic when email is not configured',async()=>{
 const x=await fixture();try{assert.equal(x.database.prepare('SELECT count(*) AS n FROM operational_delivery_jobs').get().n,2);await runOperationalDelivery(x.db,{}, {transport:()=>{throw Error('Network forbidden');}});assert.equal(job(x,'enquiry_email').attempts,0);assert.equal(job(x,'enquiry_email').state,'blocked');
 const {submitClientEnquiry}=await import('../app/api/enquiries/route.ts');await submitClientEnquiry(publicRequest(input),x.db);assert.equal(x.database.prepare('SELECT count(*) AS n FROM operational_delivery_jobs').get().n,2);
 assert.throws(()=>x.database.prepare('DELETE FROM operational_delivery_jobs').run(),/history/);
 assert.throws(()=>x.database.prepare("INSERT OR REPLACE INTO operational_delivery_jobs(id,kind,source_id,environment,next_attempt_at,created_at,updated_at) SELECT id,kind,source_id,environment,next_attempt_at,created_at,updated_at FROM operational_delivery_jobs LIMIT 1").run(),/original_claim/);
 }finally{x.database.close();}
});

test('the team enquiry notice is sent once through Resend and the CRM job settles with no request',async()=>{
 const x=await fixture(),calls=[];try{
  await runOperationalDelivery(x.db,runtime,{transport:resend(calls)});
  const sends=calls.filter(c=>c.url==='https://api.resend.com/emails');
  assert.equal(sends.length,1);assert.equal(sends[0].init.headers['idempotency-key'],job(x,'enquiry_email').id);
  assert.equal(job(x,'enquiry_email').state,'sent');assert.equal(job(x,'enquiry_email').provider_id,'resend:email_1');
  assert.equal(job(x,'enquiry_crm').state,'cancelled');
  await runOperationalDelivery(x.db,runtime,{transport:resend(calls)});
  assert.equal(calls.filter(c=>c.url==='https://api.resend.com/emails').length,1,'a sent notice is never resent');
  await runOperationalDelivery(x.db,runtime,{transport:resend(calls),receiptsOnly:true});
  assert.equal(job(x,'enquiry_email').state,'delivered');
 }finally{x.database.close();}
});

test('a lost Resend response retries with the same idempotency key and payload',async()=>{
 const x=await fixture(),calls=[];let now=Date.now()+1000;try{
  await runOperationalDelivery(x.db,runtime,{transport:resend(calls,{fail:true}),now:()=>now});
  assert.equal(job(x,'enquiry_email').state,'retry_wait');const frozen=job(x,'enquiry_email').request_json;
  now+=3600000;await runOperationalDelivery(x.db,runtime,{transport:resend(calls),now:()=>now});
  const sends=calls.filter(c=>c.url==='https://api.resend.com/emails');
  assert.equal(sends.length,2);assert.equal(sends[0].init.headers['idempotency-key'],sends[1].init.headers['idempotency-key']);
  assert.equal(job(x,'enquiry_email').request_json,frozen);assert.equal(job(x,'enquiry_email').state,'sent');
 }finally{x.database.close();}
});

test('operators can pause sending without losing queued notices',async()=>{
 const x=await fixture(),calls=[];try{
  const before=job(x,'enquiry_email');
  assert.deepEqual(await runOperationalDelivery(x.db,{...runtime,LOKD_OPERATIONAL_DELIVERY_ENABLED:'false'},{transport:resend(calls)}),{enabled:false,processed:0});
  assert.equal(calls.length,0);assert.deepEqual(job(x,'enquiry_email'),before);
 }finally{x.database.close();}
});

test('only Resend is accepted as the email provider',()=>{
 assert.equal(configuredEmailProvider(runtime),'resend');
 assert.equal(configuredEmailProvider({...runtime,LOKD_EMAIL_PROVIDER:undefined}),'resend');
 for(const provider of ['smtp','foreign-mail','disabled'])assert.throws(()=>configuredEmailProvider({...runtime,LOKD_EMAIL_PROVIDER:provider}),/email_provider_not_configured/);
 assert.throws(()=>configuredEmailProvider({...runtime,RESEND_API_KEY:undefined}),/email_provider_not_configured/);
});
