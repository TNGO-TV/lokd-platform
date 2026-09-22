import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {uploadTerms,manageTerms,issueQuote,acceptQuote,cancelQuote,readQuotes,quoteFile,currentQuote,acceptedOrderQuote} from '../app/lib/quote-acceptance.ts';
import {readActivationAgreements} from '../app/lib/agreement-activation.ts';
import {currentEnvelopeRecipient} from '../app/lib/operational-delivery.ts';
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
 const browserUsers=JSON.parse(process.env.LOKD_COLLECTION_BROWSER_USERS??'{}'),browserEmails=JSON.parse(process.env.LOKD_COLLECTION_BROWSER_EMAILS??'{}');
 const applicant={userId:browserUsers.client??'intake-user',email:browserEmails.client??'intake-fixture@example.test',operations:false},ops={userId:browserUsers.operations??'intake-ops',email:browserEmails.operations??'intake-ops@example.test',operations:true};
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
 const reviewer={...ops,owner:false},owner={userId:browserUsers.owner??'independent-owner',email:browserEmails.owner??'independent-owner@example.test',operations:true,owner:true};
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
 const {prepareProductionOrder,readProductionOrders}=await import('../app/lib/production-orders.ts');
 const quoteRequest={serviceType:'Unarmed',engagementModel:'flex',term:'single',purposeCode:'commercial_access',startDate:new Date(Date.now()+7*86400000).toISOString().slice(0,10),shift:'day',rosterPattern:'daily',riskInput:{assetExposure:'standard',publicAccess:'controlled',incidentHistory:'none',existingControls:'strong',nightOperation:false,vulnerablePeople:false}};
 const quoted=await prepareProductionOrder(db,reviewer,{action:'quote_order',quoteRequest});
 const order={action:'prepare_order',orderReference:'isolated-client-review-order',clientId:prepared.entityId,caseVersion:4,quoteRequest,quoteHash:quoted.quoteHash,siteName:'Fixture Site',siteArea:'Sandton',address:'Fixture address',postName:'Gate',instructions:'Fixture post orders awaiting review.',latitude:-26.1,longitude:28.05,contractingEntityId:'FIXTURE-ENTITY'};
 await assert.rejects(()=>prepareProductionOrder(db,{...applicant,owner:false},order),/Operations/);
 await assert.rejects(()=>prepareProductionOrder(db,reviewer,{...order,quoteHash:'wrong'}),/Pricing changed/);
 const setup=await prepareProductionOrder(db,reviewer,order);assert.equal(setup.funded,false);
 assert.equal((await prepareProductionOrder(db,reviewer,order)).alreadyPrepared,true);
 await assert.rejects(()=>prepareProductionOrder(db,reviewer,{...order,address:'Different address'}),/different details/);

 const bucket=new Bucket(),termsInput={title:'Isolated synthetic terms fixture',version:'fixture-v1',entityId:order.contractingEntityId,contentBase64:btoa('%PDF-1.7\nIsolated test bytes; not a legal contract.\n%%EOF')};
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
