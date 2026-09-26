import {observeReads} from './read-observer.mjs';
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

test('new booking and quote emails use Operations and client portals (provider transport simulated)',async()=>{
 const x=await setup(),{quoteId}=await issueQuote(x.db,x.bucket,x.reviewer,x.issue),messages=[];
 const {runOperationalDelivery}=await import('../app/lib/operational-delivery.ts');
 await runOperationalDelivery(x.db,{LOKD_OPERATIONAL_DELIVERY_ENABLED:'true',LOKD_DELIVERY_SOURCE_ALLOWLIST:[x.orderId,quoteId].join(','),LOKD_DELIVERY_EMAIL_ALLOWLIST:[x.applicant.email,'team@example.test'].join(','),LOKD_TEAM_EMAIL:'team@example.test',LOKD_EMAIL_PROVIDER:'resend',LOKD_EMAIL_FROM:'notices@example.test',LOKD_QUOTE_EMAIL_FROM:'quotes@example.test',RESEND_API_KEY:'synthetic-only'},{now:()=>Date.now()+1000,verifiedEmail:async()=>x.applicant.email,transport:async(url,init)=>{messages.push(JSON.parse(init.body));return Response.json({id:'mail-'+messages.length});}});
 assert.equal(messages.length,2);
 const booking=messages.find(m=>m.subject==='LOKD service order prepared'),quote=messages.find(m=>m.subject==='Your LOKD quote is ready to review');
 assert.equal(booking.from,'notices@example.test');assert.equal(quote.from,'quotes@example.test');
 assert.ok(booking.text.includes('https://operations.lokd.co.za/ops/service'));
 assert.ok(quote.text.includes('https://portal.lokd.co.za/client/agreements#'+quoteId));
 for(const m of messages)assert.equal(m.text.includes('demo.lokd.co.za'),false);
 x.database.close();
});


// All Books transport below is simulated. No external financial records are written.
const booksRuntime={LOKD_ZOHO_ACCOUNTS_ORIGIN:'https://accounts.zoho.com',LOKD_ZOHO_API_ORIGIN:'https://www.zohoapis.com',LOKD_ZOHO_CLIENT_ID:'fixture',LOKD_ZOHO_CLIENT_SECRET:'fixture',LOKD_ZOHO_REFRESH_TOKEN:'fixture',LOKD_ZOHO_BOOKS_ORG_ID:'3456789'};
function booksTransport(q,overrides={},beforeDocument){const scope=JSON.parse(q.source_json);return async(url,init)=>{
 if(url.endsWith('/oauth/v2/token'))return Response.json({access_token:'fixture',api_domain:'https://www.zohoapis.com'});
 assert.notEqual(init.method,'POST');
 if(url.endsWith('/organizations/3456789'))return Response.json({code:0,organization:{organization_id:'3456789',currency_code:'ZAR',is_org_active:true}});
 if(beforeDocument)await beforeDocument();
 const kind=url.includes('/invoices/')?'invoice':'estimate';
 return Response.json({code:0,[kind]:{[kind+'_id']:'1234567',[kind+'_number']:'FIXTURE-001',customer_id:'2345678',reference_number:q.id,currency_code:'ZAR',total:scope.totalCents/100,tax_total:scope.vatCents/100,last_modified_time:'2026-09-22T12:00:00+02:00',status:'draft',...overrides}});
};}
const booksInput=q=>({quoteId:q.id,kind:'estimate',documentId:'1234567',customerId:'2345678',customerConfirmed:true});
test('Books links retain exact accepted revision, replay safely and become historical after cancellation',async()=>{
 const {linkQuoteBooks,readQuoteBooksLinks}=await import('../app/lib/quote-books-links.ts');const x=await setup(),{q}=await issueAndAccept(x);
 const input=booksInput(q),send=()=>linkQuoteBooks(x.db,booksRuntime,x.owner,input,booksTransport(q));
 const result=await send();assert.equal(result.funded,false);assert.equal(result.financialRecordsChanged,false);assert.equal((await send()).alreadyLinked,true);
 assert.equal(x.database.prepare('SELECT count(*) AS n FROM quote_books_links').get().n,1);
 const linked=(await readQuoteBooksLinks(x.db))[0];assert.equal(linked.currentAcceptance,true);assert.equal(linked.liveProviderRechecked,false);assert.equal(linked.comparison.referenceNumber,q.id);assert.match(q.id,/^QUOTE-/);assert.match(q.public_number,/^LOKD\d{6}$/);assert.notEqual(linked.comparison.referenceNumber,q.public_number);
 assert.throws(()=>x.database.prepare("UPDATE quote_books_links SET customer_id='9999999'").run(),/immutable/);
 assert.throws(()=>x.database.prepare('DELETE FROM quote_books_links').run(),/immutable/);
 await cancelQuote(x.db,x.reviewer,{quoteId:q.id,reason:'Fixture scope changed'});
 assert.equal((await readQuoteBooksLinks(x.db))[0].currentAcceptance,false);
 await assert.rejects(send(),/changed/);x.database.close();
});
test('Books links require owner, explicit customer confirmation and valid client acceptance before provider reads',async()=>{
 const {linkQuoteBooks}=await import('../app/lib/quote-books-links.ts');const x=await setup(),{quoteId}=await issueQuote(x.db,x.bucket,x.reviewer,x.issue),{q}=await currentQuote(x.db,quoteId);const input=booksInput(q);let calls=0;const transport=async()=>{calls++;throw Error('Must not call provider');};
 await assert.rejects(linkQuoteBooks(x.db,booksRuntime,x.reviewer,input,transport),/owner/);
 await assert.rejects(linkQuoteBooks(x.db,booksRuntime,x.owner,{...input,customerConfirmed:false},transport),/confirm/);
 await assert.rejects(linkQuoteBooks(x.db,booksRuntime,x.owner,input,transport),/accepted quote/);assert.equal(calls,0);x.database.close();
});
test('Books rejects wrong quote revision, customer, amount, currency and changed provider revision',async()=>{
 const {linkQuoteBooks}=await import('../app/lib/quote-books-links.ts');const x=await setup(),{q}=await issueAndAccept(x),input=booksInput(q);
 for(const mismatch of [{reference_number:x.orderId},{customer_id:'9999999'},{currency_code:'USD'},{total:0},{tax_total:9999}])await assert.rejects(linkQuoteBooks(x.db,booksRuntime,x.owner,input,booksTransport(q,mismatch)),/binding_mismatch/);
 assert.equal(x.database.prepare('SELECT count(*) AS n FROM quote_books_links').get().n,0);
 await linkQuoteBooks(x.db,booksRuntime,x.owner,input,booksTransport(q));
 await assert.rejects(linkQuoteBooks(x.db,booksRuntime,x.owner,input,booksTransport(q,{last_modified_time:'2026-09-23T12:00:00+02:00'})),/revision changed/);
 await assert.rejects(linkQuoteBooks(x.db,booksRuntime,x.owner,{...input,kind:'invoice',customerId:'9999999'},booksTransport(q,{customer_id:'9999999'})),/same Books customer/);
 x.database.close();
});
test('Books network race and direct duplicate document claims cannot attach stale or conflicting links',async()=>{
 const {linkQuoteBooks}=await import('../app/lib/quote-books-links.ts');const x=await setup(),{q}=await issueAndAccept(x),input=booksInput(q);
 await assert.rejects(linkQuoteBooks(x.db,booksRuntime,x.owner,input,booksTransport(q,{},async()=>cancelQuote(x.db,x.reviewer,{quoteId:q.id,reason:'Changed during provider request'}))),/changed/);
 assert.equal(x.database.prepare('SELECT count(*) AS n FROM quote_books_links').get().n,0);x.database.close();
});
test('Books API denies anonymous, non-owner and cross-origin link writes',async()=>{
 const {GET,POST}=await import('../app/api/zoho-books/route.ts');
 assert.equal((await GET(new Request('https://operations.lokd.co.za/api/zoho-books?links=true'))).status,401);
 const headers={'x-lokd-verified-user-id':'ordinary-client','x-lokd-verified-email':'client@example.test'};
 assert.equal((await GET(new Request('https://operations.lokd.co.za/api/zoho-books?links=true',{headers}))).status,403);
 assert.equal((await POST(new Request('https://operations.lokd.co.za/api/zoho-books',{method:'POST',headers:{...headers,origin:'https://attacker.example','content-type':'application/json'},body:'{}'}))).status,403);
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

// One continuous synthetic journey; external transports remain explicitly simulated.
test('one dummy quote binds notification, downloaded terms, immutable acceptance and Books reconciliation',async()=>{
 const x=await setup();
 try {
  const {quoteId}=await issueQuote(x.db,x.bucket,x.reviewer,x.issue),messages=[];
  const {runOperationalDelivery}=await import('../app/lib/operational-delivery.ts');
  await runOperationalDelivery(x.db,{LOKD_OPERATIONAL_DELIVERY_ENABLED:'true',LOKD_DELIVERY_SOURCE_ALLOWLIST:quoteId,LOKD_DELIVERY_EMAIL_ALLOWLIST:x.applicant.email,LOKD_EMAIL_PROVIDER:'resend',LOKD_EMAIL_FROM:'notices@example.test',LOKD_QUOTE_EMAIL_FROM:'quotes@example.test',RESEND_API_KEY:'synthetic-only'},{now:()=>Date.now()+1000,verifiedEmail:async()=>x.applicant.email,transport:async(url,init)=>{messages.push(JSON.parse(init.body));return Response.json({id:'synthetic-quote-message'});}});
  assert.equal(messages.length,1);assert.ok(messages[0].text.includes('/client/agreements#'+quoteId));
  const {bytes,t}=await quoteFile(x.db,x.bucket,x.applicant,x.termsId);
  assert.deepEqual(Buffer.from(bytes),fs.readFileSync(new URL('./fixtures/dummy-client-terms.pdf',import.meta.url)));
  const {q}=await currentQuote(x.db,quoteId);
  await acceptQuote(x.db,x.bucket,x.applicant,{quoteId,offerHash:q.offer_hash,affirmative:true});
  const {receipt}=await currentQuote(x.db,quoteId,Date.now(),true);
  assert.equal(JSON.parse(receipt.receipt_json).terms.sha256,t.file_hash);
  const {linkQuoteBooks,readQuoteBooksLinks}=await import('../app/lib/quote-books-links.ts');
  const linked=await linkQuoteBooks(x.db,booksRuntime,x.owner,booksInput(q),booksTransport(q));
  const accounting=(await readQuoteBooksLinks(x.db))[0];
  assert.equal(accounting.quoteId,quoteId);assert.equal(accounting.currentAcceptance,true);
  assert.equal(linked.financialRecordsChanged,false);assert.equal(linked.funded,false);
  assert.equal(x.database.prepare('SELECT funding_status FROM bookings WHERE id=?').get(x.orderId).funding_status,'unfunded');
  const evidence={mode:'isolated-actual-handlers',externalEmail:'simulated-provider-acceptance',externalBooks:'simulated-provider-read',liveMoneyMoved:false,quoteId,orderId:x.orderId,termsSha256:t.file_hash,notification:messages[0],receipt:JSON.parse(receipt.receipt_json),receiptHash:receipt.receipt_hash,accounting};
  if(process.env.LOKD_DUMMY_JOURNEY_EVIDENCE)fs.writeFileSync(process.env.LOKD_DUMMY_JOURNEY_EVIDENCE,JSON.stringify(evidence,null,2));
 } finally {x.database.close();}
});
