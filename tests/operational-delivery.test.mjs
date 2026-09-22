import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { env } from "cloudflare:workers";
import {runOperationalDelivery,reconcileUnsubmittedNotice} from '../app/lib/operational-delivery.ts';
import {crmEnquiryBody,zohoSession} from '../app/lib/operational-provider.ts';

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

const input={organisationName:'Fictional Delivery Client',contactName:'Synthetic Signer',email:'signer@example.test',siteArea:'Sandton',siteType:'commercial_property',requiredStart:'planning',message:'Synthetic isolated delivery test with no provider connection.',advanceFundingAcknowledged:true,privacyConsent:true};
async function fixture(){const database=migratedDatabase(),db=new D1Adapter(database);const {submitClientEnquiry}=await import('../app/api/enquiries/route.ts');const response=await submitClientEnquiry(publicRequest(input),db);assert.equal(response.status,202);return {database,db,id:(await response.json()).reference};}
const reply=value=>Response.json(value);
const runtime=id=>({LOKD_OPERATIONAL_DELIVERY_ENABLED:'true',LOKD_DELIVERY_SOURCE_ALLOWLIST:id,LOKD_DELIVERY_EMAIL_ALLOWLIST:'team@example.test',LOKD_TEAM_EMAIL:'team@example.test',LOKD_EMAIL_PROVIDER:'resend',LOKD_EMAIL_FROM:'notices@example.test',RESEND_API_KEY:'synthetic-only',LOKD_ZOHO_ACCOUNTS_ORIGIN:'https://accounts.zoho.com',LOKD_ZOHO_API_ORIGIN:'https://www.zohoapis.com',LOKD_ZOHO_CLIENT_ID:'synthetic',LOKD_ZOHO_CLIENT_SECRET:'synthetic',LOKD_ZOHO_REFRESH_TOKEN:'synthetic',LOKD_ZOHO_CRM_ORG_ID:'org-fixture',LOKD_ZOHO_CRM_OWNER_ID:'owner-fixture'});
const job=(x,kind)=>x.database.prepare('SELECT * FROM operational_delivery_jobs WHERE kind=?').get(kind);
function transportFor(calls,{postEmail,event='delivered',org='org-fixture'}={}){return async(url,init)=>{calls.push({url,init});assert.equal(init.redirect,'manual');if(url.endsWith('/oauth/v2/token'))return reply({access_token:'synthetic',api_domain:'https://www.zohoapis.com'});if(url.endsWith('/crm/v8/org'))return reply({org:[{id:org}]});if(url.endsWith('/upsert'))return reply({data:[{code:'SUCCESS',status:'success',details:{id:'crm-fixture'}}]});if(url==='https://api.resend.com/emails')return postEmail?postEmail(init):reply({id:'mail-fixture'});if(url==='https://api.resend.com/emails/mail-fixture')return reply({id:'mail-fixture',to:['team@example.test'],last_event:event});throw Error('Unexpected URL');};}

test('intake atomically queues one CRM and one team job, with no traffic by default',async()=>{
 const x=await fixture();try{assert.equal(x.database.prepare('SELECT count(*) AS n FROM operational_delivery_jobs').get().n,2);await runOperationalDelivery(x.db,{}, {transport:()=>{throw Error('Network forbidden');}});assert.equal(job(x,'enquiry_crm').attempts,0);
 const {submitClientEnquiry}=await import('../app/api/enquiries/route.ts');await submitClientEnquiry(publicRequest(input),x.db);assert.equal(x.database.prepare('SELECT count(*) AS n FROM operational_delivery_jobs').get().n,2);
 assert.throws(()=>x.database.prepare('DELETE FROM operational_delivery_jobs').run(),/history/);
 assert.throws(()=>x.database.prepare("INSERT OR REPLACE INTO operational_delivery_jobs(id,kind,source_id,environment,next_attempt_at,created_at,updated_at) SELECT id,kind,source_id,environment,next_attempt_at,created_at,updated_at FROM operational_delivery_jobs LIMIT 1").run(),/original_claim/);
 }finally{x.database.close();}
});
test('CRM and email acceptances are separate from inbox confirmation and booking funding',async()=>{
 const x=await fixture(),calls=[];let now=Date.now()+1000;try{await runOperationalDelivery(x.db,runtime(x.id),{transport:transportFor(calls),now:()=>now});assert.equal(job(x,'enquiry_crm').provider_id,'crm-fixture');assert.equal(job(x,'enquiry_email').state,'sent');assert.equal(x.database.prepare('SELECT count(*) AS n FROM bookings').get().n,0);
 const body=JSON.parse(calls.find(c=>c.url.endsWith('/upsert')).init.body);assert.deepEqual(body.duplicate_check_fields,['LOKD_Enquiry_Reference']);assert.deepEqual(body.trigger,[]);assert.equal(body.data[0].Owner.id,'owner-fixture');assert.equal(body.data[0].LOKD_Enquiry_Reference,x.id);
 const mail=JSON.parse(calls.find(c=>c.url==='https://api.resend.com/emails').init.body);assert.equal(mail.text.includes(input.message),false);assert.equal(mail.text.includes(input.email),false);
 now+=61000;await runOperationalDelivery(x.db,runtime(x.id),{transport:transportFor(calls),now:()=>now});assert.equal(job(x,'enquiry_email').state,'delivered');assert.equal(calls.filter(c=>c.url.endsWith('/upsert')).length,1);assert.equal(calls.filter(c=>c.url==='https://api.resend.com/emails').length,1);
 }finally{x.database.close();}
});
test('parallel dispatchers claim each job once',async()=>{
 const x=await fixture(),calls=[];try{const options={transport:transportFor(calls),now:()=>Date.now()+1000};await Promise.all([runOperationalDelivery(x.db,runtime(x.id),options),runOperationalDelivery(x.db,runtime(x.id),options)]);assert.equal(calls.filter(c=>c.url==='https://api.resend.com/emails').length,1);assert.equal(calls.filter(c=>c.url.endsWith('/upsert')).length,1);}finally{x.database.close();}
});
test('timeout reuses an immutable message and idempotency key, then confirms once',async()=>{
 const x=await fixture(),calls=[];let now=Date.now()+1000,attempt=0;try{const transport=transportFor(calls,{postEmail:()=>{if(++attempt===1)throw Error('lost response');return reply({id:'mail-fixture'});}});await runOperationalDelivery(x.db,runtime(x.id),{transport,now:()=>now});assert.equal(job(x,'enquiry_email').state,'retry_wait');now+=120001;await runOperationalDelivery(x.db,{...runtime(x.id),LOKD_EMAIL_FROM:'changed@example.test'},{transport,now:()=>now});const sent=calls.filter(c=>c.url==='https://api.resend.com/emails');assert.equal(sent.length,2);assert.equal(sent[0].init.body,sent[1].init.body);assert.equal(sent[0].init.headers['Idempotency-Key'],sent[1].init.headers['Idempotency-Key']);assert.equal(job(x,'enquiry_email').state,'sent');assert.throws(()=>x.database.prepare("UPDATE operational_delivery_jobs SET recipient='another@example.test' WHERE kind='enquiry_email'").run(),/immutable/);}finally{x.database.close();}
});
test('uncertain email is never resent after deduplication expiry or to a changed recipient',async()=>{
 for(const change of ['expiry','recipient']){const x=await fixture(),calls=[];let now=Date.now()+1000;try{const transport=transportFor(calls,{postEmail:()=>{throw Error('lost');}});await runOperationalDelivery(x.db,runtime(x.id),{transport,now:()=>now});now+=change==='expiry'?24*3600000:120001;const r=runtime(x.id);if(change==='recipient'){r.LOKD_TEAM_EMAIL='other@example.test';r.LOKD_DELIVERY_EMAIL_ALLOWLIST='other@example.test';}await runOperationalDelivery(x.db,r,{transport,now:()=>now});assert.equal(calls.filter(c=>c.url==='https://api.resend.com/emails').length,1);assert.equal(job(x,'enquiry_email').state,change==='expiry'?'uncertain':'blocked');}finally{x.database.close();}}
});
test('missing allowlists block before sending and wrong CRM organization prevents upsert',async()=>{
 const x=await fixture(),calls=[];let now=Date.now()+1000;try{await runOperationalDelivery(x.db,{...runtime(x.id),LOKD_DELIVERY_SOURCE_ALLOWLIST:''},{transport:transportFor(calls),now:()=>now});assert.equal(calls.length,0);assert.equal(job(x,'enquiry_crm').state,'blocked');assert.equal(job(x,'enquiry_crm').attempts,0);now+=900001;await runOperationalDelivery(x.db,{...runtime(x.id),LOKD_DELIVERY_EMAIL_ALLOWLIST:''},{transport:transportFor(calls,{org:'other-org'}),now:()=>now});assert.equal(calls.some(c=>c.url.endsWith('/upsert')),false);assert.equal(calls.some(c=>c.url.includes('resend')),false);assert.equal(job(x,'enquiry_crm').last_error,'zoho_crm_org_mismatch');}finally{x.database.close();}
});
test('bounce remains failed and never automatically resends',async()=>{
 const x=await fixture(),calls=[];let now=Date.now()+1000;try{const transport=transportFor(calls,{event:'bounced'});await runOperationalDelivery(x.db,runtime(x.id),{transport,now:()=>now});now+=61000;await runOperationalDelivery(x.db,runtime(x.id),{transport,now:()=>now});assert.equal(job(x,'enquiry_email').state,'failed');assert.equal(job(x,'enquiry_email').last_error,'email_delivery_failed');now+=3600000;await runOperationalDelivery(x.db,runtime(x.id),{transport,now:()=>now});assert.equal(calls.filter(c=>c.url==='https://api.resend.com/emails').length,1);}finally{x.database.close();}
});
test('Zoho refresh rejects arbitrary origins without leaking credentials',async()=>{let requests=0;await assert.rejects(()=>zohoSession({...runtime('test'),LOKD_ZOHO_ACCOUNTS_ORIGIN:'https://attacker.example'},async()=>{requests++;throw Error();}),/authorization_missing/);assert.equal(requests,0);assert.equal(crmEnquiryBody({id:'ENQ-1',contact_name:'Person',organisation_name:'Company',email_normalized:'person@example.test'},'owner').data[0].LOKD_Enquiry_Reference,'ENQ-1');});
test('delivery API requires authenticated Operations and same-origin writes',async()=>{const x=await fixture();try{env.DB=x.db;env.LOKD_PILOT_ACCESS_JSON=JSON.stringify({owners:['owner@example.test']});const route=await import('../app/api/operational-delivery/route.ts');assert.equal((await route.GET(new Request('https://demo.lokd.co.za/api/operational-delivery'))).status,401);const headers={'x-lokd-verified-user-id':'owner','x-lokd-verified-email':'owner@example.test'};assert.equal((await route.GET(new Request('https://demo.lokd.co.za/api/operational-delivery',{headers}))).status,200);assert.notEqual((await route.POST(new Request('https://demo.lokd.co.za/api/operational-delivery',{method:'POST',headers:{...headers,origin:'https://attacker.example','content-type':'application/json'},body:'{}'}))).status,200);}finally{delete env.DB;x.database.close();}});
test('Books reads compare exact organisation, customer, order, amounts and revision without financial writes',async()=>{
 const {inspectBooksDocument,booksAmountMinor}=await import('../app/lib/zoho-books.ts');assert.equal(booksAmountMinor('12.30'),1230);assert.throws(()=>booksAmountMinor('12.301'),/amount_invalid/);
 const expected={kind:'estimate',documentId:'1234567',customerId:'2345678',orderId:'ORDER-FIXTURE',totalMinor:11500,taxMinor:1500};
 for(const mismatch of [null,'currency','customer','reference','amount','revision']){const calls=[];const transport=async(url,init)=>{calls.push({url,init});if(url.endsWith('/oauth/v2/token'))return reply({access_token:'synthetic',api_domain:'https://www.zohoapis.com'});assert.notEqual(init.method,'POST');if(url.endsWith('/organizations/3456789'))return reply({code:0,organization:{organization_id:'3456789',currency_code:'ZAR',is_org_active:true,name:'Fictional Books',address:{country:'South Africa'}}});const doc={estimate_id:'1234567',customer_id:'2345678',reference_number:'ORDER-FIXTURE',currency_code:'ZAR',total:115,tax_total:15,last_modified_time:'2026-09-21T12:00:00+02:00',status:'draft'};if(mismatch==='currency')doc.currency_code='USD';if(mismatch==='customer')doc.customer_id='other';if(mismatch==='reference')doc.reference_number='other';if(mismatch==='amount')doc.total=116;if(mismatch==='revision')doc.last_modified_time='unknown';return reply({code:0,estimate:doc});};const action=()=>inspectBooksDocument({...runtime('test'),LOKD_ZOHO_BOOKS_ORG_ID:'3456789'},expected,transport);if(mismatch)await assert.rejects(action,/binding_mismatch/);else{const result=await action();assert.equal(result.funded,false);assert.equal(result.independentlyApproved,false);assert.equal(result.providerRead,true);}assert.equal(calls.filter(c=>c.init.method==='POST').length,1);}
});

const zeptoRuntime=id=>({...runtime(id),LOKD_EMAIL_PROVIDER:'zeptomail',LOKD_ZEPTOMAIL_API_ORIGIN:'https://api.zeptomail.com',ZEPTOMAIL_SEND_TOKEN:'synthetic-only'});
test('ZeptoMail freezes provider, sends minimal content and verifies matching provider logs',async()=>{
 const x=await fixture(),calls=[];let now=Date.now()+1000;
 try{
  let mail;
  const fallback=transportFor(calls);
  const transport=async(url,init)=>{
   if(url==='https://api.zeptomail.com/v1.1/email'){
    calls.push({url,init});mail=JSON.parse(init.body);
    assert.equal(init.headers.Authorization,'Zoho-enczapikey synthetic-only');assert.equal(mail.client_reference,'team:'+x.id);assert.equal(mail.track_clicks,false);assert.equal(mail.textbody.includes(input.email),false);
    return reply({data:[{code:'EM_104'}],request_id:'zepto-fixture'});
   }
   if(url.startsWith('https://api.zeptomail.com/v1.1/email?'))return reply({status:'success',data:[{request_id:'zepto-fixture',from:mail.from.address,to:mail.to[0].email_address.address,subject:mail.subject,status:'delivered'}]});
   return fallback(url,init);
  };
  await runOperationalDelivery(x.db,zeptoRuntime(x.id),{transport,now:()=>now});assert.equal(job(x,'enquiry_email').state,'sent');
  now+=61000;await runOperationalDelivery(x.db,runtime(x.id),{transport,now:()=>now});assert.equal(job(x,'enquiry_email').state,'sent');assert.equal(calls.some(c=>c.url.includes('resend')),false);
  now+=3600001;await runOperationalDelivery(x.db,zeptoRuntime(x.id),{transport,now:()=>now});assert.equal(job(x,'enquiry_email').state,'delivered');
 }finally{x.database.close();}
});
test('ZeptoMail unknown outcomes and lost leases never automatically resend',async()=>{
 for(const mode of ['timeout','server','malformed','lost-lease']){
  const x=await fixture(),calls=[];let now=Date.now()+1000,sends=0;
  try{
   const fallback=transportFor(calls);const transport=async(url,init)=>{
    if(url==='https://api.zeptomail.com/v1.1/email'){sends++;if(mode==='server')return new Response('',{status:503});if(mode==='malformed')return reply({});throw Error('lost');}return fallback(url,init);
   };
   if(mode==='lost-lease')x.database.prepare("UPDATE operational_delivery_jobs SET state='dispatching',request_json=?,attempts=1,first_attempt_at=?,lease_expires_at=? WHERE kind='enquiry_email'").run(JSON.stringify({_lokdProvider:'zeptomail'}),new Date(now-1000).toISOString(),new Date(now-1).toISOString());
   await runOperationalDelivery(x.db,zeptoRuntime(x.id),{transport,now:()=>now});assert.equal(job(x,'enquiry_email').state,'uncertain');
   now+=3600001;await runOperationalDelivery(x.db,zeptoRuntime(x.id),{transport,now:()=>now});assert.equal(sends,mode==='lost-lease'?0:1);
  }finally{x.database.close();}
 }
});
test('ZeptoMail rejects mismatched receipts and unverified API origins',async()=>{
 const {emailReceipt,sendEmail}=await import('../app/lib/operational-provider.ts');let requests=0;
 const body={_lokdProvider:'zeptomail',from:'notices@example.test',to:['team@example.test'],subject:'Test',text:'Test'};
 await assert.rejects(()=>sendEmail({...zeptoRuntime('test'),LOKD_ZEPTOMAIL_API_ORIGIN:'https://attacker.example'},'job',body,async()=>{requests++;}),/not_configured/);assert.equal(requests,0);
 await assert.rejects(()=>emailReceipt(zeptoRuntime('test'),body,'job','req','team@example.test',async(url)=>url.endsWith('/oauth/v2/token')?reply({access_token:'synthetic',api_domain:'https://www.zohoapis.com'}):reply({status:'success',data:[{request_id:'other',to:'team@example.test',from:body.from,subject:body.subject,status:'delivered'}]})),/receipt_mismatch/);
});

test('actual ZeptoMail log shape requires correlated per-recipient delivery detail',async()=>{
 const {emailReceipt}=await import('../app/lib/operational-provider.ts');
 const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/zeptomail-provider-logs.json',import.meta.url),'utf8'));
 const body={_lokdProvider:'zeptomail',from:'notices@example.test',to:['team@example.test'],subject:'Fixture connection test',text:'Test'};
 for(const mode of ['delivered','processing','wrong-request','wrong-reference','wrong-recipient','wrong-time','wrong-subject','extra-event','multiple-logs']){
  const list=structuredClone(fixture.list),detail=structuredClone(fixture.detail);
  if(mode==='processing')detail.data.email_delivery_details={};
  if(mode==='wrong-request')detail.data.request_id='other';
  if(mode==='wrong-reference')detail.data.email_info.email_reference='other';
  if(mode==='wrong-recipient')detail.data.email_delivery_details.delivery[0].recipient='other@example.test';
  if(mode==='wrong-time')detail.data.email_delivery_details.delivery[0].delivery_time='unknown';
  if(mode==='wrong-subject')detail.data.email_info.subject='other';
  if(mode==='extra-event')detail.data.email_delivery_details.unrecognized_failure={};
  if(mode==='multiple-logs')list.data.logs.push(structuredClone(list.data.logs[0]));
  const transport=async(url,init)=>{
   if(url.endsWith('/oauth/v2/token'))return reply({access_token:'synthetic',api_domain:'https://www.zohoapis.com'});
   assert.notEqual(init.method,'POST');
   if(url.includes('/email/email-reference/')){assert.equal(url.endsWith('/reference-fixture'),true);return reply(detail);}
   assert.equal(new URL(url).searchParams.get('request_id'),'request-fixture');return reply(list);
  };
  const action=()=>emailReceipt(zeptoRuntime('test'),body,'job','request-fixture','team@example.test',transport);
  if(mode.startsWith('wrong-')||mode==='multiple-logs')await assert.rejects(action,/receipt_mismatch/);
  else assert.equal(await action(),mode==='delivered'?'delivered':'sent');
 }
});

test('explicit non-submission reconciliation preserves history and grants just one retry after expiry',async()=>{
 const x=await fixture(),calls=[];let now=Date.now()+1000,sends=0;
 try{
  const fallback=transportFor(calls),transport=async(url,init)=>{if(url==='https://api.zeptomail.com/v1.1/email'){sends++;throw Error('synthetic unknown outcome');}return fallback(url,init);};
  await runOperationalDelivery(x.db,zeptoRuntime(x.id),{transport,now:()=>now});
  const original=job(x,'enquiry_email');now+=24*3600000;
  const input={id:original.id,updatedAt:original.updated_at,evidence:'Confirmed pre-network runtime rejection and reviewed complete provider logs; this synthetic notice was never submitted.',confirmedNotSubmitted:true};
  for(const invalid of [{...input,confirmedNotSubmitted:false},{...input,evidence:'missing proof'}])await assert.rejects(()=>reconcileUnsubmittedNotice(x.db,zeptoRuntime(x.id),invalid,'operator',now));
  await assert.rejects(()=>reconcileUnsubmittedNotice(x.db,{...zeptoRuntime(x.id),LOKD_DELIVERY_SOURCE_ALLOWLIST:''},input,'operator',now));
  await assert.rejects(()=>reconcileUnsubmittedNotice(x.db,{...zeptoRuntime(x.id),LOKD_TEAM_EMAIL:'changed@example.test'},input,'operator',now));
  const concurrent=await Promise.allSettled([reconcileUnsubmittedNotice(x.db,zeptoRuntime(x.id),input,'operator',now),reconcileUnsubmittedNotice(x.db,zeptoRuntime(x.id),input,'operator',now)]);
  assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,1);
  const audit=x.database.prepare("SELECT * FROM audit_events WHERE event_type='delivery_non_submission_confirmed'").all();assert.equal(audit.length,1);assert.equal(audit[0].actor_id,'operator');assert.equal(JSON.parse(audit[0].detail).attempts,1);
  assert.equal(job(x,'enquiry_email').attempts,1);assert.equal(job(x,'enquiry_email').request_json,original.request_json);assert.equal(job(x,'enquiry_email').first_attempt_at,original.first_attempt_at);
  await runOperationalDelivery(x.db,zeptoRuntime(x.id),{transport,now:()=>now});assert.equal(sends,2);assert.equal(job(x,'enquiry_email').state,'uncertain');
  now+=3600000;await runOperationalDelivery(x.db,zeptoRuntime(x.id),{transport,now:()=>now});assert.equal(sends,2);
  await assert.rejects(()=>reconcileUnsubmittedNotice(x.db,zeptoRuntime(x.id),input,'operator',now));
 }finally{x.database.close();}
});
test('reconciliation cannot replay CRM, accepted email or a closed enquiry',async()=>{
 const x=await fixture(),calls=[];const now=Date.now()+1000;
 try{
  const fallback=transportFor(calls),transport=async(url,init)=>url==='https://api.zeptomail.com/v1.1/email'?Promise.reject(Error('unknown')):fallback(url,init);
  await runOperationalDelivery(x.db,zeptoRuntime(x.id),{transport,now:()=>now});
  const current=job(x,'enquiry_email'),input={id:current.id,updatedAt:current.updated_at,evidence:'Verified provider non-submission evidence for this synthetic notice with exact source correlation.',confirmedNotSubmitted:true};
  await assert.rejects(()=>reconcileUnsubmittedNotice(x.db,zeptoRuntime(x.id),{...input,id:job(x,'enquiry_crm').id},'operator',now));
  x.database.prepare("UPDATE operational_delivery_jobs SET state='sent',provider_id='accepted' WHERE kind='enquiry_email'").run();
  await assert.rejects(()=>reconcileUnsubmittedNotice(x.db,zeptoRuntime(x.id),input,'operator',now));
  assert.equal(x.database.prepare("SELECT count(*) n FROM audit_events WHERE event_type='delivery_non_submission_confirmed'").get().n,0);
 }finally{x.database.close();}
});

test('manual receipt checks never dispatch queued jobs and throttle repeated provider reads',async()=>{
 const x=await fixture(),calls=[];let now=Date.now()+1000,reads=0;
 try{
  await runOperationalDelivery(x.db,runtime(x.id),{transport:transportFor(calls),now:()=>now,receiptsOnly:true});assert.equal(calls.length,0);
  await runOperationalDelivery(x.db,runtime(x.id),{transport:transportFor(calls),now:()=>now});
  const fallback=transportFor(calls),transport=async(url,init)=>{if(url==='https://api.resend.com/emails/mail-fixture'){reads++;return new Response('',{status:403});}return fallback(url,init);};
  now+=61000;await runOperationalDelivery(x.db,runtime(x.id),{transport,now:()=>now,receiptsOnly:true});assert.equal(reads,1);assert.equal(job(x,'enquiry_email').last_error,'provider_http_403');
  await runOperationalDelivery(x.db,runtime(x.id),{transport,now:()=>now,receiptsOnly:true});assert.equal(reads,1);
  now+=61000;await runOperationalDelivery(x.db,runtime(x.id),{transport:transportFor(calls),now:()=>now,receiptsOnly:true});assert.equal(job(x,'enquiry_email').state,'delivered');assert.equal(job(x,'enquiry_email').attempts,1);assert.equal(calls.filter(c=>c.url==='https://api.resend.com/emails').length,1);
 }finally{x.database.close();}
});
