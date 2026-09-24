import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{window.confirm=()=>{throw Error('Native confirmation is unsupported');};window.prompt=()=>{throw Error('Native prompt is unsupported');};});
 await page.route('**/api/operational-delivery*',r=>r.fulfill({json:{deliveries:[]}}));
});
async function open(page,label){await page.getByRole('button',{name:label,exact:true}).click();return page.getByRole('form',{name:label,exact:true});}
const terms={id:'TERMS-1',title:'Synthetic terms',version:'v1',entity_id:'ENTITY-1',file_hash:'hash-1',approved_at:null,withdrawn:0};
const agreement={id:'ENV-1',role:'OFFICER_EMPLOYMENT',document_id:'DOC-1',wording:'Synthetic wording for local component verification only.',context_json:'{}',content_hash:'content-1',context_hash:'context-1',expires_at:'2099-01-01T00:00:00Z',cancelled:0,document_withdrawn:0,receipt_json:null};
test('terms approval requires an unchecked acknowledgement; refresh clears it and sends the exact hash',async({page})=>{
 const posts=[];let approved=false;
 await page.route('**/api/quotes?scope=operations',async r=>{if(r.request().method()==='POST'){posts.push(r.request().postDataJSON());approved=true;}await r.fulfill({json:{quotes:[],terms:[{...terms,approved_at:approved?'2026-09-25':null}],orders:[],owner:true,acknowledgement:'I agree'}});});
 await page.goto('/ops/quotes');let form=await open(page,'Approve terms version');
 await expect(form.getByRole('checkbox')).not.toBeChecked();await expect(form.getByRole('button',{name:'Confirm approve terms version'})).toBeDisabled();
 await form.getByRole('checkbox').check();await page.getByRole('button',{name:'Refresh quotes',exact:true}).click();await expect(form).toHaveCount(0);
 form=await open(page,'Approve terms version');await expect(form.getByRole('checkbox')).not.toBeChecked();await form.getByRole('checkbox').check();await form.getByRole('button',{name:'Confirm approve terms version'}).click();
 await expect(form).toHaveCount(0);expect(posts).toEqual([{action:'approve_terms',termsId:'TERMS-1',fileHash:'hash-1',legalApprovalConfirmed:true}]);
});
test('withdrawal preserves findings after failure, cancels without a request, and clears private data on access loss',async({page})=>{
 const posts=[];let forbidden=false;
 await page.route('**/api/quotes?scope=operations',async r=>{if(r.request().method()==='POST'){posts.push(r.request().postDataJSON());return r.fulfill({status:forbidden?403:409,json:{error:forbidden?'Access revoked':'Version changed; refresh records.'}});}await r.fulfill({json:{quotes:[],terms:[terms],orders:[],owner:true,acknowledgement:'I agree'}});});
 await page.goto('/ops/quotes');let form=await open(page,'Withdraw terms');await form.getByRole('textbox').fill('Correct the outdated clause.');await form.getByRole('button',{name:'Keep unchanged'}).click();expect(posts).toHaveLength(0);
 form=await open(page,'Withdraw terms');await expect(form.getByRole('textbox')).toHaveValue('');await form.getByRole('textbox').fill('Correct the outdated clause.');await form.getByRole('button',{name:'Confirm withdraw terms'}).click();
 await expect(page.getByRole('alert')).toContainText('Version changed; refresh records.');await expect(form.getByRole('textbox')).toHaveValue('Correct the outdated clause.');
 forbidden=true;await form.getByRole('button',{name:'Confirm withdraw terms'}).click();await expect(page.getByRole('heading',{name:'Workspace access unavailable'})).toBeVisible();await expect(page.getByRole('textbox')).toHaveCount(0);
});
test('agreement signing remains record-bound, explicit and protected against duplicate submissions',async({page})=>{
 let release;const waiting=new Promise(resolve=>{release=resolve;});const posts=[];
 await page.route('**/api/agreements/production?kind=officer',async r=>{if(r.request().method()==='POST'){posts.push(r.request().postDataJSON());await waiting;return r.fulfill({json:{documents:[],entities:[],owner:false,envelopes:[{...agreement,receipt_json:JSON.stringify({acceptedAt:'2026-09-25T00:00:00Z'})}]}});}return r.fulfill({json:{documents:[],entities:[],owner:false,envelopes:[agreement]}});});
 await page.goto('/officer/agreements');const form=await open(page,'Agree and record my signature');await expect(form.getByRole('checkbox')).not.toBeChecked();await form.getByRole('checkbox').check();
 await form.evaluate(f=>{f.requestSubmit();f.requestSubmit();});await expect.poll(()=>posts.length).toBe(1);await expect(form.getByRole('button',{name:'Keep unchanged'})).toBeDisabled();release();
 await expect(page.getByText('Signature recorded',{exact:true})).toBeVisible();expect(posts).toEqual([{action:'sign',envelopeId:'ENV-1',contentHash:'content-1',contextHash:'context-1',affirmative:true}]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
const keys=['rosters','approvals','shifts','operators','collections','collectionRecoveries','settlementReviews','clientReviews','reviewClients','employeePaymentCandidates','employeePayments','partnerDestinationCandidates','partnerDestinationReviews','partnerPayableCandidates','partnerPayableReviews','partnerPaymentCandidates','partnerPayments','destinationCandidates','destinationReviews','evidenceReviews','serviceOrders','payrollCandidates','payrollItems','payrollPolicies','payrollRuns','availability','outsideWork','scheduleDeclarations','serviceEvents','timesheets'];
test('client review and collection approval retain independent evidence acknowledgement and exact revisions',async({page})=>{
 const posts=[];const state={...Object.fromEntries(keys.map(k=>[k,[]])),owner:true,clientReviews:[{id:'REVIEW-1',client_id:'CLIENT-1',case_version:2,prepared_by:'MAKER-1',prepared_at:'2026-09-24',expires_at:'2099-01-01',evidence_json:'{}',snapshot_json:'{}',decision:null,reason:null}],collections:[{reference:'TEST-COLLECTION-1',order_id:'ORDER-1',client_id:'CLIENT-1',case_version:2,source_hash:'source-1',amount_minor:12345,currency:'ZAR',mode:'test',state:'prepared',revision:3,current:true,checkout_url:null,evidence:[]}]};
 await page.route('**/api/production-operations*',async r=>{if(r.request().method()==='POST'){const body=r.request().postDataJSON();posts.push(body);if(body.action==='decide_client_review')state.clientReviews[0].decision='approve';if(body.action==='approve_collection')state.collections[0].state='approved';}return r.fulfill({json:state});});
 await page.route('**/api/finance-documents*',r=>r.fulfill({json:{documents:[],sources:[],owner:true}}));
 await page.route('**/api/payment-execution*',r=>r.fulfill({json:{liveDispatchEnabled:false,reserves:[],releases:[],reconciliations:[]}}));
 await page.goto('/ops/service');let form=await open(page,'Approve reviewed client');await form.getByRole('textbox').fill('Independently inspected the referenced synthetic fixture evidence.');await expect(form.getByRole('button',{name:'Confirm approve reviewed client'})).toBeDisabled();await form.getByRole('checkbox').check();await form.getByRole('button',{name:'Confirm approve reviewed client'}).click();await expect(form).toHaveCount(0);
 form=await open(page,'Independently approve collection');await expect(form.getByRole('checkbox')).not.toBeChecked();await form.getByRole('checkbox').check();await form.getByRole('button',{name:'Confirm independently approve collection'}).click();await expect(form).toHaveCount(0);
 expect(posts).toEqual([{action:'decide_client_review',reviewId:'REVIEW-1',decision:'approve',evidenceIndependentlyChecked:true,reason:'Independently inspected the referenced synthetic fixture evidence.'},{action:'approve_collection',reference:'TEST-COLLECTION-1',revision:3,evidenceReviewed:true}]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
test('simulated booking transitions collect evidence inline and clear records after access loss',async({page})=>{
 const posts=[];let lost=false;const cycle={id:'CYCLE-1',site_brief:'Synthetic service fixture',amount_minor:5000,officer_amount_minor:3000,state:'proposed',revision:4,note:'No real work or money',bindingCurrent:true,role:'client',events:[]};
 await page.route('**/api/test-cycle?kind=client',async r=>{if(lost)return r.fulfill({status:401,json:{error:'Sign in again.'}});if(r.request().method()==='POST'){posts.push(r.request().postDataJSON());cycle.state='accepted';cycle.revision++;}return r.fulfill({json:{cycles:[cycle]}});});
 await page.goto('/client/test-cycle');const form=await open(page,'accept booking');await form.getByRole('textbox').fill('Reviewed the exact synthetic booking scope.');await form.getByRole('button',{name:'Confirm accept booking'}).click();await expect(form).toHaveCount(0);
 expect(posts).toEqual([{action:'accept_booking',id:'CYCLE-1',expectedRevision:4,note:'Reviewed the exact synthetic booking scope.',testAcknowledged:true}]);
 lost=true;await page.getByRole('button',{name:'Refresh cycles'}).click();await expect(page.getByRole('heading',{name:'Workspace access unavailable'})).toBeVisible();await expect(page.getByText('Synthetic service fixture',{exact:true})).toHaveCount(0);
});
test('identity recovery requires explicit provider reconciliation and retains findings on failure',async({page})=>{
 const posts=[];let failed=true;const state={caseVersion:2,nextStep:'pending',checks:[{id:'CHECK-1',scenario:'id-unavailable',signal:'unknown',state:'delivery_unknown',attempts:1,recoveryNote:'',updatedAt:'2026-09-01T00:00:00Z',retryAt:null}],history:[]};
 await page.route('**/api/identity*',async r=>{if(r.request().method()==='POST'){posts.push(r.request().postDataJSON());if(failed)return r.fulfill({status:503,json:{error:'Provider temporarily unavailable.'}});state.checks[0].state='retry_authorized';}return r.fulfill({json:state});});
 await page.route('**/api/enrolment*',r=>r.fulfill({json:{canInitialize:false,package:{version:'synthetic'},order:null,history:[],events:[]}}));
 await page.goto('/ops/identity');const form=await open(page,'Record provider reconciliation');await form.getByRole('textbox').fill('Provider confirmed there is no completed result for this reference.');await expect(form.getByRole('button',{name:'Confirm record provider reconciliation'})).toBeDisabled();await form.getByRole('checkbox').check();await form.getByRole('button',{name:'Confirm record provider reconciliation'}).click();await expect(page.getByRole('alert')).toContainText('Provider temporarily unavailable.');await expect(form.getByRole('textbox')).toHaveValue('Provider confirmed there is no completed result for this reference.');
 failed=false;await form.getByRole('button',{name:'Confirm record provider reconciliation'}).click();await expect(form).toHaveCount(0);
 expect(posts[0]).toEqual({action:'resolve_unknown',caseId:'SYNTHETIC-CASE',caseVersion:2,checkId:'CHECK-1',expectedAttempts:1,note:'Provider confirmed there is no completed result for this reference.',noResultConfirmed:true});
});
