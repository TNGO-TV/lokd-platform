import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {clerk,clerkSetup,setupClerkTestingToken} from '@clerk/testing/playwright';
const emails=JSON.parse(process.env.LOKD_TEST_EMAILS);
test.beforeAll(async()=>clerkSetup({dotenv:false}));
async function login(page,role){await setupClerkTestingToken({page});await page.goto('/sign-in');await clerk.loaded({page});await clerk.signIn({page,emailAddress:emails[role]});await expect.poll(()=>page.evaluate(()=>!!window.Clerk?.user)).toBe(true);}
test('production connections keep intake pending, expose approved signing and isolate Operations',async({browser},testInfo)=>{
 test.setTimeout(240000);const contexts=await Promise.all([browser.newContext({viewport:{width:390,height:844}}),browser.newContext(),browser.newContext()]);
 try{const client=await contexts[0].newPage(),ops=await contexts[1].newPage();await login(client,'client');await login(ops,'owner');const reviewer=await contexts[2].newPage();await login(reviewer,'operations');ops.setDefaultTimeout(15000);client.setDefaultTimeout(15000);
 const r=await client.request.post('/api/enquiries',{data:{organisationName:'Production Connection Fixture',contactName:'Test Client',email:emails.client,mobile:'0821234567',siteArea:'Sandton',siteType:'commercial_property',requiredStart:'planning',message:'Isolated browser test; no production contract or service.',advanceFundingAcknowledged:true,privacyConsent:true}});expect(r.status()).toBe(202);const id=(await r.json()).reference;
 expect((await client.request.post('/api/signup?scope=client',{data:{kind:'client',id,action:'link',expectedVersion:0}})).status()).toBe(200);
 expect((await ops.request.post('/api/signup?scope=operations&kind=client',{data:{kind:'client',id,action:'review',expectedVersion:1,status:'reviewed',note:'Isolated intake fixture independently reviewed.'}})).status()).toBe(200);
 const prepared=await ops.request.post('/api/agreements/production?kind=client&scope=operations',{data:{action:'prepare_entity',kind:'client',caseId:id,caseVersion:2}});expect(prepared.status()).toBe(200);const preparation=(await prepared.json()).result;expect(preparation.grantsAccess).toBe(false);const clientEntity=preparation.entityId;
 await ops.goto('/ops/agreements');await ops.getByText('Prepare a legal document for approval',{exact:true}).click();await ops.getByLabel('Document version',{exact:true}).fill('browser-test-v1');await ops.getByLabel('Contracting or employing entity ID',{exact:true}).fill('TEST-ENTITY');await ops.getByLabel('Exact legal wording',{exact:true}).fill('TEST AGREEMENT — Browser fixture only. Not approved for production signing or work eligibility.');await ops.getByRole('button',{name:'Save immutable draft',exact:true}).click();await expect(ops.getByRole('heading',{name:'CLIENT_MSA · browser-test-v1'})).toBeVisible();
 const endpoint='/api/agreements/production?kind=client&scope=operations',d=await(await ops.request.get(endpoint)).json(),doc=d.documents[0];
 const rejected=await ops.request.post(endpoint,{data:{action:'approve',documentId:doc.id,contentHash:doc.content_hash,legalApprovalConfirmed:true,effectiveFrom:'2026-01-01T00:00:00Z'}});expect(rejected.status()).toBe(409);
 expect((await client.request.get(endpoint)).status()).toBe(403);expect((await client.request.post('/api/production-operations?kind=client',{data:{action:'grant_operator',email:emails.client,role:'operations_owner',limitCents:100000}})).status()).toBe(403);
 await client.goto('/client/agreements');await expect(client.getByText('No quotes have been issued yet.')).toBeVisible();expect(await client.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await client.goto('/client/service');await expect(client.getByText('No production roster records are available for this account.')).toBeVisible();
 await ops.goto('/ops/service');await expect(ops.getByRole('button',{name:'Prepare for independent approval'})).toBeVisible();await expect(ops.getByText('No production roster records are available for this account.')).toBeVisible();
 const reviewResult=await reviewer.request.post('/api/production-operations?kind=client&scope=operations',{data:{action:'prepare_client_review',clientId:clientEntity,caseVersion:2,documentsActuallyReviewed:true,checkedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+30*86400000).toISOString(),identityReference:'Browser fixture identity evidence',companyReference:'Browser fixture company evidence',authorityReference:'Browser fixture signing mandate',note:'Isolated browser source review. No production customer approval.'}});expect(reviewResult.status()).toBe(200);console.log('Client source review prepared.');
 ops.on('dialog',async d=>d.type()==='prompt'?d.accept('Independent browser fixture review findings.'):d.accept());
 await ops.getByRole('button',{name:'Refresh production records'}).click();console.log('Review refresh requested.');await ops.getByRole('button',{name:'Approve reviewed client',exact:true}).click();const clientApproval=ops.getByRole('form',{name:'Approve reviewed client',exact:true});await clientApproval.getByLabel('Independent review findings',{exact:true}).fill('Independent review of explicitly fictional sources in the isolated test database.');await clientApproval.getByRole('checkbox').check();await clientApproval.getByRole('button',{name:'Confirm approve reviewed client',exact:true}).click();console.log('Independent approval submitted.');await expect(ops.getByText('approve · expires',{exact:false})).toBeVisible();
 console.log('Independent approval visible.');await ops.getByText('Prepare a priced service order',{exact:true}).click();await ops.getByLabel('Approved client',{exact:true}).selectOption(clientEntity);
 for(const [label,value] of [['Unique service order reference','browser-order'],['Contracting entity reference','BROWSER-ENTITY'],['Site name','Browser Site'],['Site area','Sandton'],['Site address','Isolated fixture address'],['Post name','Gate'],['Post instructions','Browser fixture instructions pending review.'],['Site latitude','-26.1'],['Site longitude','28.05']])await ops.getByLabel(label,{exact:true}).fill(value);
 for(const [label,value] of [['Service','Unarmed'],['Purpose','commercial_access'],['Engagement','flex'],['Term in months (single for flex)','single'],['Shift','day'],['Roster pattern','daily'],['Asset exposure','standard'],['Public access','controlled'],['Incident history','none'],['Existing site controls','strong']])await ops.getByLabel(label,{exact:true}).selectOption(value);
 await ops.getByLabel('Start date',{exact:true}).fill(new Date(Date.now()+7*86400000).toISOString().slice(0,10));console.log('Service order inputs filled.');await ops.getByRole('button',{name:'Calculate service price',exact:true}).click();await expect(ops.getByRole('button',{name:'Prepare this priced order',exact:true})).toBeEnabled();await ops.getByRole('button',{name:'Prepare this priced order',exact:true}).click();await expect(ops.getByRole('heading',{name:'Browser Site',exact:true})).toBeVisible();await ops.getByRole('button',{name:'Prepare next roster shifts',exact:true}).click();await expect(ops.getByText('1 of 1 shifts prepared',{exact:false})).toBeVisible();
 await client.goto('/client/service');await expect(client.getByRole('heading',{name:'Browser Site',exact:true})).toBeVisible();await expect(client.getByText('ORDER-browser-order · draft · unfunded',{exact:true})).toBeVisible();expect(await client.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);

 const productionEndpoint='/api/production-operations?kind=client&scope=operations';const orderState=await(await ops.request.get(productionEndpoint)).json();const serviceOrder=orderState.serviceOrders.find(o=>o.id==='ORDER-browser-order');
 await reviewer.goto('/ops/service');await reviewer.getByText('Prepare site or workforce review',{exact:true}).click();await reviewer.getByLabel('Review type',{exact:true}).selectOption('site');
 for(const [label,value] of [['Site reference',serviceOrder.site_id],['Post reference',serviceOrder.post_id],['Approved instruction version','BROWSER-ORDERS-v1'],['Independent site risk assessment reference','Isolated browser inspected risk report'],['Approved post instructions reference','Isolated browser post orders approval'],['Site review findings','These fixture findings cover the exact quoted site and post.'],['Evidence expiry (ISO date and time)',new Date(Date.now()+86400000).toISOString()]])await reviewer.getByLabel(label,{exact:true}).fill(value);
 await reviewer.getByLabel('I reviewed the actual source documents and confirm their applicability to these exact records.').check();await reviewer.getByRole('button',{name:'Submit source evidence for review',exact:true}).click();await expect(reviewer.getByRole('heading',{name:'Site risk and post instructions',exact:true})).toBeVisible();
 await ops.getByRole('button',{name:'Refresh production records'}).click();await ops.getByRole('button',{name:'Approve source evidence',exact:true}).click();const evidenceApproval=ops.getByRole('form',{name:'Approve source evidence',exact:true});for(const field of await evidenceApproval.getByRole('textbox').all())await field.fill('Independent review of fictional site evidence in the isolated fixture.');await evidenceApproval.getByRole('checkbox').check();await evidenceApproval.getByRole('button',{name:'Confirm approve source evidence',exact:true}).click();await expect(ops.getByRole('button',{name:'Suspend readiness from this evidence',exact:true})).toBeVisible();
 await expect(client.getByRole('heading',{name:'Service records',exact:true})).toBeVisible();expect(await client.getByRole('button',{name:'Approve source evidence',exact:true}).count()).toBe(0);

 // Actual Clerk development sessions with isolated application DB/R2. Delivery
 // transports are unconfigured: queued notifications are not delivered emails.
 const quoteEndpoint='/api/quotes?scope=operations';
 const pdfPath=new URL('../fixtures/dummy-client-terms.pdf',import.meta.url);
 const pdf=await readFile(pdfPath),pdfHash=createHash('sha256').update(pdf).digest('hex');
 await reviewer.goto('/ops/agreements');await reviewer.getByText('Upload standard terms',{exact:true}).click();
 await reviewer.getByLabel('Title',{exact:true}).fill('DUMMY — synthetic browser terms only');
 await reviewer.getByLabel('Version',{exact:true}).fill('browser-dummy-v1');
 await reviewer.getByLabel('LOKD contracting entity ID',{exact:true}).fill('BROWSER-ENTITY');
 await reviewer.getByLabel('Terms PDF (maximum 5 MB)',{exact:true}).setInputFiles({name:'dummy-client-terms.pdf',mimeType:'application/pdf',buffer:pdf});
 await reviewer.getByRole('button',{name:'Upload terms for approval',exact:true}).click();
 await expect(reviewer.getByRole('heading',{name:'DUMMY — synthetic browser terms only · browser-dummy-v1',exact:true})).toBeVisible();
 const terms=(await(await ops.request.get(quoteEndpoint)).json()).terms[0];expect(terms.file_hash).toBe(pdfHash);
 // This approval is confined to the disposable fixture; it makes no legal claim.
 await ops.goto('/ops/agreements');await ops.getByRole('button',{name:'Approve terms version',exact:true}).click();const termsApproval=ops.getByRole('form',{name:'Approve terms version',exact:true});await expect(termsApproval.getByRole('checkbox')).not.toBeChecked();await termsApproval.getByRole('checkbox').check();await termsApproval.getByRole('button',{name:'Confirm approve terms version',exact:true}).click();await expect(ops.getByText('Approved · BROWSER-ENTITY',{exact:true})).toBeVisible();
 const issued=await ops.request.post(quoteEndpoint,{data:{action:'issue',orderId:'ORDER-browser-order',termsId:terms.id,expectedSequence:0,expiresAt:new Date(Date.now()+86400000).toISOString()}});expect(issued.status()).toBe(200);
 const offer=(await issued.json()).quotes[0];expect(offer.email_delivery_state).toBe('queued');
 const accept={action:'accept',quoteId:offer.id,offerHash:offer.offer_hash,affirmative:true};
 expect((await ops.request.post(quoteEndpoint,{data:accept})).status()).toBe(403);
 const strangerContext=await browser.newContext();contexts.push(strangerContext);const stranger=await strangerContext.newPage();await login(stranger,'unassigned');
 expect((await stranger.request.post('/api/quotes',{data:accept})).status()).toBe(404);
 expect((await stranger.request.get('/api/quotes?file='+terms.id)).status()).toBe(404);
 expect((await client.request.post('/api/quotes',{data:{...accept,affirmative:false}})).status()).toBe(400);
 expect((await client.request.post('/api/quotes',{data:{...accept,offerHash:'wrong'}})).status()).toBe(400);
 const downloaded=await client.request.get('/api/quotes?file='+terms.id);expect(downloaded.status()).toBe(200);expect(createHash('sha256').update(await downloaded.body()).digest('hex')).toBe(pdfHash);
 await client.goto('/client/agreements');await expect(client.getByRole('button',{name:'Accept quote',exact:true})).toBeDisabled();
 await client.getByRole('checkbox',{name:/I accept this quote and the linked Terms and Conditions/}).check();
 await client.getByRole('button',{name:'Accept quote',exact:true}).click();await expect(client.getByRole('button',{name:'Download acceptance record',exact:true})).toBeVisible();
 const accepted=(await(await client.request.get('/api/quotes')).json()).quotes[0];expect(JSON.parse(accepted.receipt_json).terms.sha256).toBe(pdfHash);
 const receiptDownload=client.waitForEvent('download');await client.getByRole('button',{name:'Download acceptance record',exact:true}).click();
 const receiptFile=await receiptDownload;const receiptPath=testInfo.outputPath('dummy-quote-acceptance-receipt.json');await receiptFile.saveAs(receiptPath);
 const savedReceipt=JSON.parse(await readFile(receiptPath,'utf8'));
 expect(savedReceipt.receiptHash).toBe(accepted.receipt_hash);
 expect(createHash('sha256').update(accepted.receipt_json).digest('hex')).toBe(accepted.receipt_hash);
 expect(savedReceipt.receipt.terms.sha256).toBe(pdfHash);
 await testInfo.attach('dummy-quote-acceptance-receipt',{path:receiptPath,contentType:'application/json'});
 await testInfo.attach('accepted-quote-mobile',{body:await client.screenshot({fullPage:true}),contentType:'image/png'});
 await testInfo.attach('test-scope',{body:JSON.stringify({mode:'isolated-development-accounts',providerDelivery:'queued-only',books:'not-contacted',payments:'not-dispatched',pdfSha256:pdfHash,orderId:accepted.order_id,quoteId:accepted.id,receiptHash:accepted.receipt_hash},null,2),contentType:'application/json'});
 const replay=await client.request.post('/api/quotes',{data:accept});expect(replay.status()).toBe(200);const replayed=await replay.json();expect(replayed.result.alreadyAccepted).toBe(true);expect(replayed.quotes[0].receipt_hash).toBe(accepted.receipt_hash);
 expect(JSON.stringify(replayed.quotes)).not.toMatch(/officerRateCents|officer_rate|marginCents|pricingBreakdown/);
 expect((await ops.request.post(quoteEndpoint,{data:{action:'cancel',quoteId:offer.id,reason:'Synthetic revised-scope test'}})).status()).toBe(200);
 expect((await client.request.post('/api/quotes',{data:accept})).status()).toBe(409);
 const replacement=await ops.request.post(quoteEndpoint,{data:{action:'issue',orderId:'ORDER-browser-order',termsId:terms.id,expectedSequence:1,expiresAt:new Date(Date.now()+86400000).toISOString()}});expect(replacement.status()).toBe(200);
 const revised=(await replacement.json()).quotes.find(q=>q.sequence===2);expect(revised.receipt_json).toBeNull();
 await client.reload();await expect(client.getByRole('button',{name:'Accept quote',exact:true})).toBeDisabled();
 console.log('Dummy PDF upload, quote acceptance, account isolation, replay and fresh revision acceptance checks passed; notifications queued only.');

 }finally{await Promise.allSettled(contexts.map(c=>c.close()));}
});
