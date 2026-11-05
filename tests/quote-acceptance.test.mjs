import {observeReads} from './read-observer.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {uploadTerms,manageTerms,issueQuote,acceptQuote,declineQuote,cancelQuote,readQuotes,quoteFile,quoteAcceptanceCopy,currentQuote,acceptedOrderQuote} from '../app/lib/quote-acceptance.ts';
import {readActivationAgreements} from '../app/lib/agreement-activation.ts';
import {currentEnvelopeRecipient} from '../app/lib/operational-delivery.ts';
import {deliverClientNotifications,clientNotificationStatement,readClientNotificationFailures} from '../app/lib/quote-notifications.ts';
import {quoteAcceptanceDocument} from '../app/lib/quote-document.ts';
class D1 {
 constructor(){this.database=new DatabaseSync(':memory:');this.database.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())this.database.exec(fs.readFileSync('drizzle/'+f,'utf8'));}
 prepare(sql){const database=this.database;const make=(values=[])=>({bind:(...v)=>make(v),first:async()=>database.prepare(sql).get(...values)??null,all:async()=>({results:database.prepare(sql).all(...values)}),run:async()=>({meta:{changes:Number(database.prepare(sql).run(...values).changes)}})});return make();}
 async batch(statements){this.database.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());this.database.exec('COMMIT');return r;}catch(e){this.database.exec('ROLLBACK');throw e;}}
}
class Bucket {
 objects=new Map();
 async put(key,bytes){this.objects.set(key,new Uint8Array(bytes));}
 async get(key){const b=this.objects.get(key);return b?{size:b.length,arrayBuffer:async()=>b.slice().buffer}:null;}
}
async function setup(){
 const {prepareProductionEntity}=await import('../app/lib/production-intake.ts');const {POST:enquire}=await import('../app/api/enquiries/route.ts');const {writeSignup}=await import('../app/lib/signup-server.ts');const {env}=await import('cloudflare:workers');
 const db=new D1(),database=db.database;env.DB=db;
 const applicant={userId:'intake-user',email:'intake-fixture@example.test',operations:false},ops={userId:'intake-ops',email:'intake-ops@example.test',operations:true};
 const response=await enquire(new Request('https://lokd.co.za/api/enquiries',{method:'POST',headers:{origin:'https://lokd.co.za','content-type':'application/json'},body:JSON.stringify({organisationName:'Intake Fixture Client',contactName:'Fixture Signer',email:applicant.email,mobile:'0821234567',siteArea:'Sandton',siteType:'commercial_property',requiredStart:'planning',message:'Production intake fixture in isolated memory only.',advanceFundingAcknowledged:true,privacyConsent:true})}));const caseId=(await response.json()).reference;
 await writeSignup(db,applicant,{action:'link',kind:'client',id:caseId,expectedVersion:0});
 await assert.rejects(()=>prepareProductionEntity(db,ops,{kind:'client',caseId,caseVersion:1}),/reviewed/);
 await writeSignup(db,ops,{action:'review',kind:'client',id:caseId,expectedVersion:1,status:'reviewed',note:'Fixture intake details independently reviewed.'});
 const prepared=await prepareProductionEntity(db,ops,{kind:'client',caseId,caseVersion:2});assert.equal(prepared.workEligible,false);assert.equal((await prepareProductionEntity(db,ops,{kind:'client',caseId,caseVersion:2})).entityId,prepared.entityId);
 await writeSignup(db,applicant,{action:'correct',kind:'client',id:caseId,expectedVersion:2,changes:{organisationName:'Corrected Fixture Client'}});
 await writeSignup(db,ops,{action:'review',kind:'client',id:caseId,expectedVersion:3,status:'reviewed',note:'Corrected fixture details independently reviewed.'});
 assert.equal((await prepareProductionEntity(db,ops,{kind:'client',caseId,caseVersion:4})).reconciled,true);
 const client=database.prepare('SELECT * FROM clients WHERE id=?').get(prepared.entityId);assert.equal(client.organisation_name,'Corrected Fixture Client');assert.equal(client.approval_status,'pending');assert.equal(client.integrity_state,'production_candidate');
 assert.throws(()=>database.prepare("UPDATE clients SET approval_status='approved' WHERE id=?").run(prepared.entityId),/Candidate intake/);
 assert.throws(()=>database.prepare("UPDATE clients SET integrity_state='production_verified' WHERE id=?").run(prepared.entityId),/immutable/);
 assert.equal(database.prepare("SELECT count(*) AS n FROM audit_events WHERE event_type='production_entity_reconciled'").get().n,1);
 const {reviewProductionClient,currentClientReview}=await import('../app/lib/production-client-review.ts');
 const reviewer={...ops,owner:false},owner={userId:'independent-owner',email:'independent-owner@example.test',operations:true,owner:true};
 const reviewInput={action:'prepare_client_review',clientId:prepared.entityId,caseVersion:4,documentsActuallyReviewed:true,checkedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString(),identityReference:'Isolated fixture identity source',companyReference:'Isolated fixture company source',authorityReference:'Isolated fixture representative mandate',note:'Independent fixture document review, no live customer.'};
 await assert.rejects(()=>reviewProductionClient(db,reviewer,{...reviewInput,documentsActuallyReviewed:false}),/Confirm/);
 const review=await reviewProductionClient(db,reviewer,reviewInput);
 assert.equal(await currentClientReview(db,prepared.entityId),false);
 const decision={action:'decide_client_review',reviewId:review.reviewId,decision:'approve',evidenceIndependentlyChecked:true,reason:'Independent fixture owner checked all source references.'};
 await assert.rejects(()=>reviewProductionClient(db,{...reviewer,owner:true},decision),/Self-approval/);
 await assert.rejects(()=>reviewProductionClient(db,owner,{...decision,evidenceIndependentlyChecked:false}),/Independently/);
 await reviewProductionClient(db,owner,decision);
 assert.equal(await currentClientReview(db,prepared.entityId),true);
 assert.equal(database.prepare('SELECT approval_status FROM clients WHERE id=?').get(prepared.entityId).approval_status,'approved');
 assert.equal((await reviewProductionClient(db,owner,decision)).alreadyRecorded,true);
 const {prepareProductionOrder}=await import('../app/lib/production-orders.ts');
 const quoteRequest={serviceType:'Unarmed',engagementModel:'flex',term:'single',purposeCode:'commercial_access',startDate:new Date(Date.now()+7*86400000).toISOString().slice(0,10),shift:'day',rosterPattern:'daily',riskInput:{assetExposure:'standard',publicAccess:'controlled',incidentHistory:'none',existingControls:'strong',nightOperation:false,vulnerablePeople:false}};
 const quoted=await prepareProductionOrder(db,reviewer,{action:'quote_order',quoteRequest});
 const order={action:'prepare_order',orderReference:'isolated-client-review-order',clientId:prepared.entityId,caseVersion:4,quoteRequest,quoteHash:quoted.quoteHash,siteName:'Fixture Site',siteArea:'Sandton',address:'Fixture address',postName:'Gate',instructions:'Fixture post orders awaiting review.',latitude:-26.1,longitude:28.05,contractingEntityId:'FIXTURE-ENTITY'};
 await assert.rejects(()=>prepareProductionOrder(db,{...applicant,owner:false},order),/Operations/);
 await assert.rejects(()=>prepareProductionOrder(db,reviewer,{...order,quoteHash:'wrong'}),/Pricing changed/);
 const setup=await prepareProductionOrder(db,reviewer,order);assert.equal(setup.funded,false);
 assert.equal((await prepareProductionOrder(db,reviewer,order)).alreadyPrepared,true);
 await assert.rejects(()=>prepareProductionOrder(db,reviewer,{...order,address:'Different address'}),/different details/);

 const bucket=new Bucket(),termsInput={title:'Isolated synthetic terms fixture',version:'fixture-v1',entityId:order.contractingEntityId,contentBase64:fs.readFileSync(new URL('./fixtures/dummy-client-terms.pdf',import.meta.url)).toString('base64')};
 const {termsId}=await uploadTerms(db,bucket,reviewer,termsInput);
 const terms=(await readQuotes(db,reviewer)).terms[0];
 await manageTerms(db,bucket,owner,{action:'approve_terms',termsId,fileHash:terms.file_hash,legalApprovalConfirmed:true});
 const issue={orderId:setup.orderId,termsId,expiresAt:new Date(Date.now()+86400000).toISOString(),expectedSequence:0};
 return {db,database,bucket,applicant,reviewer,owner,issue,termsInput,termsId,orderId:setup.orderId,caseId};
}
const issueAndAccept=async x=>{
 const {quoteId}=await issueQuote(x.db,x.bucket,x.reviewer,x.issue);
 const q=(await readQuotes(x.db,x.applicant)).quotes.find(q=>q.id===quoteId);
 const input={quoteId,offerHash:q.offer_hash,affirmative:true};
 await acceptQuote(x.db,x.bucket,x.applicant,input);return {q,input};
};

test('client accepts quote with linked terms before any officer or roster assignment; immutable replay and privacy',async()=>{
 const x=await setup(),{q,input}=await issueAndAccept(x);
 assert.equal(x.database.prepare('SELECT count(*) AS n FROM roster_slots').get().n,0);
 assert.equal((await acceptedOrderQuote(x.db,x.orderId)).receipt.documentId,x.termsId);
 assert.equal((await acceptQuote(x.db,x.bucket,x.applicant,input)).alreadyAccepted,true);
 assert.equal(x.database.prepare('SELECT count(*) AS n FROM client_quote_receipts').get().n,1);
 assert.throws(()=>x.database.prepare("UPDATE client_quote_receipts SET receipt_hash='wrong'").run(),/immutable/);
 assert.throws(()=>x.database.prepare("DELETE FROM client_terms_files").run(),/immutable/);
 const details=JSON.stringify((await readQuotes(x.db,x.applicant)).quotes);
 assert.doesNotMatch(details,/officerRateCents|officer_rate|marginCents|pricingBreakdown/);
 const stranger={...x.applicant,userId:'different-client'};
 assert.equal((await readQuotes(x.db,stranger)).quotes.length,0);
 await assert.rejects(quoteFile(x.db,x.bucket,stranger,x.termsId),/not found/);
 await assert.rejects(acceptQuote(x.db,x.bucket,stranger,input),/not found/);
 await assert.rejects(acceptQuote(x.db,x.bucket,x.reviewer,input),/Only/);
 await assert.rejects(issueQuote(x.db,x.bucket,x.reviewer,{...x.issue,expectedSequence:1}),/already has/);
 const before=x.database.prepare('SELECT revision FROM activation_evidence_epoch').get().revision;
 await cancelQuote(x.db,x.reviewer,{quoteId:q.id,reason:'Client requested a different scope'});
 assert.equal((await acceptedOrderQuote(x.db,x.orderId)).receipt,null);
 assert.ok(x.database.prepare('SELECT revision FROM activation_evidence_epoch').get().revision>before);
 const revised=await issueQuote(x.db,x.bucket,x.reviewer,{...x.issue,expectedSequence:1});
 assert.notEqual(revised.quoteId,q.id);
 assert.equal((await acceptedOrderQuote(x.db,x.orderId)).receipt,null);
 x.database.close();
});
test('affirmative checkbox, exact quote hash, PDF integrity and current scope are enforced',async()=>{
 const x=await setup();
 await assert.rejects(uploadTerms(x.db,x.bucket,x.applicant,x.termsInput),/Operations/);
 await assert.rejects(uploadTerms(x.db,x.bucket,x.reviewer,{...x.termsInput,version:'bad',contentBase64:btoa('<script>not a pdf</script>')}),/PDF/);
 const {quoteId}=await issueQuote(x.db,x.bucket,x.reviewer,x.issue);
 const {q}=await currentQuote(x.db,quoteId);
 assert.deepEqual(await currentEnvelopeRecipient(x.db,quoteId,Date.now()),{owner:x.applicant.userId,kind:'client'});
 await assert.rejects(acceptQuote(x.db,x.bucket,x.applicant,{quoteId,offerHash:q.offer_hash,affirmative:false}),/Tick/);
 await assert.rejects(acceptQuote(x.db,x.bucket,x.applicant,{quoteId,offerHash:'wrong',affirmative:true}),/Tick/);
 const key=[...x.bucket.objects.keys()][0],original=x.bucket.objects.get(key);
 x.bucket.objects.set(key,new Uint8Array(original.length).fill(65));
 await assert.rejects(acceptQuote(x.db,x.bucket,x.applicant,{quoteId,offerHash:q.offer_hash,affirmative:true}),/integrity/);
 x.bucket.objects.set(key,original);
 x.database.prepare("UPDATE bookings SET site_name='Revised site' WHERE id=?").run(x.orderId);
 await assert.rejects(acceptQuote(x.db,x.bucket,x.applicant,{quoteId,offerHash:q.offer_hash,affirmative:true}),/changed/);
 await assert.rejects(currentEnvelopeRecipient(x.db,quoteId,Date.now()),/quote_no_longer_current/);
 assert.equal(x.database.prepare('SELECT count(*) AS n FROM client_quote_receipts').get().n,0);
 x.database.close();
});
test('terms approval, entity binding, withdrawal, expiry and superseded versions fail closed',async()=>{
 const x=await setup();
 const {termsId}=await uploadTerms(x.db,x.bucket,x.reviewer,{...x.termsInput,version:'fixture-v2'});
 await assert.rejects(issueQuote(x.db,x.bucket,x.reviewer,{...x.issue,termsId}),/approved terms/);
 const t=(await readQuotes(x.db,x.reviewer)).terms.find(t=>t.id===termsId);
 await assert.rejects(manageTerms(x.db,x.bucket,x.reviewer,{action:'approve_terms',termsId,fileHash:t.file_hash,legalApprovalConfirmed:true}),/owner/);
 await assert.rejects(manageTerms(x.db,x.bucket,x.owner,{action:'approve_terms',termsId,fileHash:'wrong',legalApprovalConfirmed:true}),/exact/);
 await assert.rejects(issueQuote(x.db,x.bucket,x.reviewer,{...x.issue,expiresAt:new Date(Date.now()-1).toISOString()}),/expiry/);
 const {quoteId}=await issueQuote(x.db,x.bucket,x.reviewer,x.issue);
 const {q}=await currentQuote(x.db,quoteId);
 await assert.rejects(currentQuote(x.db,quoteId,Date.now()+2*86400000),/expired/);
 await issueQuote(x.db,x.bucket,x.reviewer,{...x.issue,expectedSequence:1});
 await assert.rejects(acceptQuote(x.db,x.bucket,x.applicant,{quoteId,offerHash:q.offer_hash,affirmative:true}),/changed/);
 await manageTerms(x.db,x.bucket,x.owner,{action:'withdraw_terms',termsId:x.termsId,reason:'Superseded after document review'});
 assert.equal(x.database.prepare("SELECT count(*) AS n FROM operational_delivery_jobs WHERE source_id LIKE 'QUOTE-%' AND state='cancelled'").get().n,2);
 assert.equal((await quoteFile(x.db,x.bucket,x.applicant,x.termsId)).bytes.byteLength>0,true);
 x.database.close();
});
test('order acceptance satisfies both client agreement requirements across officers but never workforce terms',async()=>{
 const x=await setup();await issueAndAccept(x);
 const facts={environment:'production',evaluatedAt:new Date().toISOString(),client:{id:'unused',orderVersion:1},shift:{bookingId:x.orderId,rosterSlotId:'slot1',startsAt:'2030-01-01',endsAt:'2030-01-02'},officer:{id:'officer1'},site:{id:'site',version:1,risk:{id:'risk',version:1}},post:{id:'post',postOrdersVersion:1},funding:{currency:'ZAR',bookingAmountCents:100},compensation:{pricingVersion:'v1',officerOfferCents:50},workforce:{model:'employee',engagementId:'engagement',termsVersion:1,employer:{id:'employer',legalName:'Employer'}}};
 const a=await readActivationAgreements(x.db,facts);
 assert.deepEqual(a.missing,['OFFICER_EMPLOYMENT']);assert.equal(a.receipts.length,1);
 const b=await readActivationAgreements(x.db,{...facts,officer:{id:'replacement'},shift:{...facts.shift,rosterSlotId:'slot2'}});
 assert.deepEqual(b.receipts,a.receipts);
 x.database.prepare("UPDATE bookings SET site_name='Changed site' WHERE id=?").run(x.orderId);
 assert.deepEqual((await readActivationAgreements(x.db,facts)).missing,['CLIENT_MSA','SERVICE_ORDER','OFFICER_EMPLOYMENT']);
 x.database.close();
});
test('issue assigns a global SAST public number and INV- invoice number while keeping the QUOTE- id',async()=>{
 const x=await setup();
 const september=new Date('2026-09-30T21:59:59.999Z'),october=new Date('2026-09-30T22:00:00.000Z');
 const first=await issueQuote(x.db,x.bucket,x.reviewer,x.issue,september);
 assert.equal(first.publicNumber,'LOKD260901');
 assert.equal(first.invoicePublicNumber,'INV-LOKD260901');
 assert.match(first.quoteId,/^QUOTE-/);
 assert.equal(x.database.prepare('SELECT public_number FROM client_quote_offers WHERE id=?').get(first.quoteId).public_number,'LOKD260901');
 const second=await issueQuote(x.db,x.bucket,x.reviewer,{...x.issue,expectedSequence:1},september);
 assert.equal(second.publicNumber,'LOKD260902');
 assert.equal(second.invoicePublicNumber,'INV-LOKD260902');
 assert.notEqual(second.quoteId,first.quoteId);
 const third=await issueQuote(x.db,x.bucket,x.reviewer,{...x.issue,expectedSequence:2},october);
 assert.equal(third.publicNumber,'LOKD261001');
 assert.equal(third.invoicePublicNumber,'INV-LOKD261001');
 assert.equal(x.database.prepare('SELECT COUNT(DISTINCT public_number) AS n FROM client_quote_offers').get().n,3);
 assert.throws(()=>x.database.prepare("UPDATE client_quote_offers SET public_number='LOKD269999' WHERE id=?").run(first.quoteId),/immutable/);
 const visible=(await readQuotes(x.db,x.applicant)).quotes.find(q=>q.id===third.quoteId);
 assert.equal(visible.public_number,'LOKD261001');
 x.database.close();
});
test('atomic acceptance rejects source edits occurring after validation',async()=>{
 const x=await setup(),{quoteId}=await issueQuote(x.db,x.bucket,x.reviewer,x.issue),{q}=await currentQuote(x.db,quoteId);
 const get=x.bucket.get.bind(x.bucket);
 x.bucket.get=async key=>{const result=await get(key);x.database.prepare("UPDATE bookings SET site_name='Race changed site' WHERE id=?").run(x.orderId);return result;};
 await assert.rejects(acceptQuote(x.db,x.bucket,x.applicant,{quoteId,offerHash:q.offer_hash,affirmative:true}),/quote_acceptance_requires_current_source/);
 assert.equal(x.database.prepare('SELECT count(*) AS n FROM client_quote_receipts').get().n,0);
 x.database.close();
});

test('quote API rejects anonymous, cross-origin and wrong workspace access; protected downloads have no-store headers',async()=>{
 const {GET,POST}=await import('../app/api/quotes/route.ts'),{env}=await import('cloudflare:workers');
 const x=await setup();env.DB=x.db;env.BUCKET=x.bucket;
 assert.equal((await GET(new Request('https://demo.lokd.co.za/api/quotes'))).status,401);
 const identity={'x-lokd-verified-user-id':x.applicant.userId,'x-lokd-verified-email':x.applicant.email};
 assert.equal((await GET(new Request('https://officers.lokd.co.za/api/quotes',{headers:identity}))).status,403);
 assert.equal((await POST(new Request('https://demo.lokd.co.za/api/quotes',{method:'POST',headers:{...identity,origin:'https://evil.example','content-type':'application/json'},body:'{}'}))).status,403);
 await issueAndAccept(x);
 const response=await GET(new Request('https://demo.lokd.co.za/api/quotes?file='+x.termsId,{headers:identity}));
 assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/pdf');
 assert.match(response.headers.get('cache-control'),/no-store/);assert.match(response.headers.get('content-disposition'),/attachment/);
 assert.match(response.headers.get('content-security-policy'),/sandbox/);
 const denied=await GET(new Request('https://demo.lokd.co.za/api/quotes?file='+x.termsId,{headers:{...identity,'x-lokd-verified-user-id':'other'}}));
 assert.equal(denied.status,404);
 x.database.close();
});

test('changed post scope or minimum grade invalidates earlier client acceptance',async()=>{
 for(const [table,column,value] of [['site_posts','post_orders_content','Changed contractual duties'],['bookings','minimum_grade','A']]){
  const x=await setup();await issueAndAccept(x);
  x.database.prepare('UPDATE '+table+' SET '+column+'=? WHERE '+(table==='bookings'?'id':'booking_id')+'=?').run(value,x.orderId);
  assert.equal((await acceptedOrderQuote(x.db,x.orderId)).receipt,null);
  x.database.close();
 }
});

test('issued and accepted quotes send branded email with a stable Resend idempotency key',async()=>{
 const x=await setup(),{quoteId}=await issueQuote(x.db,x.bucket,x.reviewer,x.issue),messages=[];
 const runtime={RESEND_API_KEY:'in-process-credential',LOKD_EMAIL_FROM:'notices@example.test',LOKD_QUOTE_EMAIL_FROM:'quotes@example.test',LOKD_TEAM_EMAIL:'team@example.test'};
 const options={now:()=>Date.now()+1000,verifiedEmail:async()=>x.applicant.email,transport:async(url,init)=>{assert.equal(url,'https://api.resend.com/emails');messages.push({body:JSON.parse(init.body),key:init.headers['idempotency-key']});return Response.json({id:'email-'+messages.length});}};
 const delivered=await deliverClientNotifications(x.db,runtime,options);
 assert.equal(delivered.sent,1);assert.equal(messages[0].body.from,'quotes@example.test');assert.ok(messages[0].body.text.includes('https://portal.lokd.co.za/client/agreements/'+quoteId));
 assert.match(messages[0].key,/^client-[a-f0-9]{64}$/);assert.equal(messages[0].body._lokdProvider,undefined);
 const {q}=await currentQuote(x.db,quoteId);
 await acceptQuote(x.db,x.bucket,x.applicant,{quoteId,offerHash:q.offer_hash,affirmative:true});
 assert.equal((await deliverClientNotifications(x.db,runtime,options)).sent,2);
 assert.ok(messages.some(message=>message.body.subject==='Your LOKD quote is accepted'&&message.body.to[0]===x.applicant.email));
 assert.ok(messages.some(message=>message.body.subject==='LOKD quote accepted'&&message.body.to[0]===runtime.LOKD_TEAM_EMAIL));
 assert.equal((await deliverClientNotifications(x.db,runtime,options)).sent,0);
 assert.equal(x.database.prepare("SELECT count(*) AS n FROM audit_events WHERE event_type IN ('quote_issued','quote_accepted')").get().n,2);
 x.database.close();
});

test('quote reads overlap only authorized queries and reject any storage failure',async()=>{
 const x=await setup(),{q}=await issueAndAccept(x);
 try {
  for(const [actor,expected,count] of [[x.reviewer,1,3],[x.applicant,1,1],[{...x.applicant,userId:'unrelated-client'},0,1]]){
   const f=observeReads(x.database),result=await readQuotes(f.db,actor);
   assert.equal(f.observed.max,count);assert.equal(f.observed.queries.length,count);
   assert.equal(result.quotes.length,expected);
   if(expected)assert.equal(result.quotes[0].id,q.id);
   if(!actor.operations){assert.deepEqual(result.terms,[]);assert.deepEqual(result.orders,[]);assert.deepEqual(f.observed.queries[0].values,[actor.userId]);}
  }
  for(const failing of ['FROM client_quote_offers q','FROM client_terms_files t','FROM client_quote_sources s']){
   const f=observeReads(x.database,failing);
   try{await assert.rejects(readQuotes(f.db,x.reviewer),/storage unavailable/);}finally{await f.drain();}
  }
 }finally{x.database.close();}
});

test('signed terms remain viewable after the live order changes and never expose another client',async()=>{
 const x=await setup();
 try {
  const {q}=await issueAndAccept(x);
  x.database.prepare("UPDATE bookings SET site_name='Updated site' WHERE id=?").run(x.orderId);
  const copy=await quoteAcceptanceCopy(x.db,x.bucket,x.applicant,q.id);
  assert.equal(copy.receipt.quote.siteName,'Fixture Site');
  assert.equal(copy.receipt.signerEmail,x.applicant.email);
  assert.ok(quoteAcceptanceDocument(copy).includes('Signed service agreement'));
  copy.receipt.quote.siteName='<script>alert(1)</script>';
  assert.ok(quoteAcceptanceDocument(copy).includes('&lt;script&gt;'));
  await assert.rejects(quoteAcceptanceCopy(x.db,x.bucket,{...x.applicant,userId:'other'},q.id),/not found/);
 } finally {x.database.close();}
});

test('client decline is audited, sends both notices and cannot accept or overwrite the decision',async()=>{
 const x=await setup();
 try {
  const {quoteId}=await issueQuote(x.db,x.bucket,x.reviewer,x.issue),{q}=await currentQuote(x.db,quoteId);
  const decision={quoteId,offerHash:q.offer_hash,reason:'Our dates have changed'};
  await assert.rejects(declineQuote(x.db,{...x.applicant,userId:'other'},decision),/not found/);
  await assert.rejects(declineQuote(x.db,x.reviewer,decision),/Only/);
  await assert.rejects(declineQuote(x.db,x.applicant,{...decision,offerHash:'changed'}),/changed/);
  assert.equal((await declineQuote(x.db,x.applicant,decision)).declined,true);
  assert.equal((await declineQuote(x.db,x.applicant,decision)).alreadyDeclined,true);
  assert.equal((await readQuotes(x.db,x.applicant)).quotes[0].declined,1);
  assert.equal(x.database.prepare("SELECT count(*) AS n FROM audit_events WHERE event_type='quote_declined'").get().n,1);
  assert.equal(x.database.prepare("SELECT count(*) AS n FROM client_notification_jobs WHERE id LIKE 'quote:declined:%'").get().n,2);
  assert.equal(x.database.prepare("SELECT state FROM client_notification_jobs WHERE id=?").get('quote:issued:client:'+q.id).state,'cancelled');
  await assert.rejects(acceptQuote(x.db,x.bucket,x.applicant,{quoteId,offerHash:q.offer_hash,affirmative:true}),/changed/);
 } finally {x.database.close();}
});

test('mail configuration errors preserve the action and can be retried after configuration',async()=>{
 const x=await setup();
 try {
  const {quoteId}=await issueQuote(x.db,x.bucket,x.reviewer,x.issue),id='quote:issued:client:'+quoteId;
  const blocked=await deliverClientNotifications(x.db,{}, {ids:[id]});
  assert.equal(blocked.blocked,1);assert.match(blocked.errors[0],/Email is not configured/);
  assert.equal(x.database.prepare('SELECT attempts FROM client_notification_jobs WHERE id=?').get(id).attempts,0);
  assert.equal((await readClientNotificationFailures(x.db,x.applicant.userId)).length,1);
  assert.equal((await readClientNotificationFailures(x.db,'unrelated')).length,0);
  assert.equal((await deliverClientNotifications(x.db,{RESEND_API_KEY:'in-process-credential',LOKD_EMAIL_FROM:'quotes@example.test'}, {ids:[id],verifiedEmail:async()=>x.applicant.email,transport:async()=>Response.json({id:'mail-ok'})})).sent,1);
 } finally {x.database.close();}
});

test('mail replays reuse the frozen Resend body and key; no other provider can send',async()=>{
 const x=await setup();
 try {
  const {quoteId}=await issueQuote(x.db,x.bucket,x.reviewer,x.issue),id='quote:issued:client:'+quoteId,requests=[];
  const runtime={RESEND_API_KEY:'in-process-credential',LOKD_EMAIL_FROM:'quotes@example.test'};
  let fail=true;
  const options={ids:[id],verifiedEmail:async()=>x.applicant.email,transport:async(url,init)=>{requests.push({body:init.body,key:init.headers['idempotency-key']});if(fail)throw Error('lost response');return Response.json({id:'mail-ok'});}};
  assert.equal((await deliverClientNotifications(x.db,runtime,options)).pending,1);
  fail=false;assert.equal((await deliverClientNotifications(x.db,runtime,options)).sent,1);
  assert.deepEqual(requests[0],requests[1]);
  const other='local-unsupported-provider';
  await clientNotificationStatement(x.db,{id:other,sourceId:quoteId,ownerUserId:x.applicant.userId,recipient:'client',subject:'LOKD update',text:'Your account update is saved.'}).run();
  let calls=0;const otherOptions={ids:[other],verifiedEmail:async()=>x.applicant.email,transport:async()=>{calls++;return Response.json({id:'never'});}};
  assert.equal((await deliverClientNotifications(x.db,{...runtime,LOKD_EMAIL_PROVIDER:'smtp'},otherOptions)).sent,0);assert.equal(calls,0);
 } finally {x.database.close();}
});

test('client notices send through the SMTP mailbox and a lost SMTP reply is never resent',async()=>{
 const x=await setup();
 const {installSmtpServer,smtpRuntime}=await import('./fixtures/smtp-server.mjs');
 let lost=false;const server=installSmtpServer({mode:()=>lost?'lost':'accept'});
 try {
  const {quoteId}=await issueQuote(x.db,x.bucket,x.reviewer,x.issue),id='quote:issued:client:'+quoteId;
  const runtime={...smtpRuntime,LOKD_EMAIL_FROM:'notices@example.test',LOKD_QUOTE_EMAIL_FROM:'notices@example.test'};
  const options={ids:[id],verifiedEmail:async()=>x.applicant.email,transport:async url=>{assert.fail('No HTTP provider request expected: '+url);}};
  assert.equal((await deliverClientNotifications(x.db,runtime,options)).sent,1);
  const [mail]=server.messages();assert.equal(mail.to,x.applicant.email);assert.equal(mail.from,'notices@example.test');
  const row=x.database.prepare('SELECT state,provider_id,request_json FROM client_notification_jobs WHERE id=?').get(id);
  assert.equal(row.state,'sent');assert.match(row.provider_id,/^smtp:client-[a-f0-9]{64}:250/);assert.equal(JSON.parse(row.request_json)._lokdProvider,'smtp');
  const other='local-smtp-lost';lost=true;
  await clientNotificationStatement(x.db,{id:other,sourceId:quoteId,ownerUserId:x.applicant.userId,recipient:'client',subject:'LOKD update',text:'Your account update is saved.'}).run();
  assert.equal((await deliverClientNotifications(x.db,runtime,{...options,ids:[other]})).uncertain,1);
  lost=false;assert.equal((await deliverClientNotifications(x.db,runtime,{...options,ids:[other]})).sent,0);
  assert.equal(server.messages().length,2);
  assert.equal(x.database.prepare('SELECT state FROM client_notification_jobs WHERE id=?').get(other).state,'uncertain');
 } finally {server.uninstall();x.database.close();}
});

test('pending client service agreements remain visible and cannot be signed through another account or role',async()=>{
 const x=await setup();
 try{
  const {readClientAgreements,acceptClientAgreement,clientAgreementCopy}=await import('../app/lib/agreement-client.ts');
  const at=new Date().toISOString(),expires=new Date(Date.now()+86400000).toISOString();
  x.database.prepare('INSERT INTO signing_document_bodies VALUES(?,?,?,?,?,?,?,?,?)').run('DOC-client-agreement','CLIENT_MSA','v1','ENTITY','en-ZA','Local agreement wording for permission checks.','content-hash',x.reviewer.userId,at);
  const insert=x.database.prepare('INSERT INTO production_signing_envelopes(id,document_id,role,owner_user_id,case_kind,case_id,case_version,roster_slot_id,officer_id,slot_version,context_json,context_hash,content_hash,identity_evidence,authority_evidence,issued_by,issued_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  insert.run('ENV-client-agreement','DOC-client-agreement','CLIENT_MSA',x.applicant.userId,'client',x.caseId,4,'SLOT-local','OFF-local',1,JSON.stringify({scope:{siteName:'Local site'}}),'context-hash','content-hash','Reviewed identity','Reviewed authority',x.reviewer.userId,at,expires);
  insert.run('ENV-officer-agreement','DOC-client-agreement','OFFICER_EMPLOYMENT',x.applicant.userId,'officer','officer-case',1,'SLOT-local','OFF-local',1,JSON.stringify({scope:{siteName:'Local site'}}),'other-context-hash','content-hash','Reviewed identity',null,x.reviewer.userId,at,expires);
  const rows=await readClientAgreements(x.db,x.applicant);
  assert.equal(rows.agreements.length,1);assert.equal(rows.agreements[0].id,'ENV-client-agreement');assert.equal(rows.agreements[0].receipt_json,null);
  assert.equal((await readClientAgreements(x.db,{...x.applicant,userId:'other-account'})).agreements.length,0);
  const input={action:'sign',envelopeId:'ENV-client-agreement',contentHash:'content-hash',contextHash:'wrong',affirmative:true};
  await assert.rejects(acceptClientAgreement(x.db,x.applicant,input),/exact/);
  await assert.rejects(acceptClientAgreement(x.db,{...x.applicant,userId:'other-account'},input),/not found/);
  await assert.rejects(acceptClientAgreement(x.db,x.applicant,{...input,envelopeId:'ENV-officer-agreement'}),/not found/);
  await assert.rejects(clientAgreementCopy(x.db,x.applicant,'ENV-client-agreement'),/not found/);
  const {GET,POST}=await import('../app/api/client-agreements/route.ts');
  const headers={'x-lokd-verified-user-id':x.applicant.userId,'x-lokd-verified-email':x.applicant.email};
  const response=await GET(new Request('https://portal.lokd.co.za/api/client-agreements',{headers}));
  assert.equal(response.status,200);assert.equal((await response.json()).agreements.length,1);
  assert.equal((await POST(new Request('https://portal.lokd.co.za/api/client-agreements',{method:'POST',headers:{...headers,'content-type':'application/json',origin:'https://evil.example'},body:JSON.stringify(input)}))).status,403);
 }finally{x.database.close();}
});
