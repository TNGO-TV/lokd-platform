import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const output='test-results/frontend/screenshots';
const serviceKeys=['rosters','approvals','shifts','operators','collections','collectionRecoveries','settlementReviews','clientReviews','reviewClients','employeePaymentCandidates','employeePayments','partnerDestinationCandidates','partnerDestinationReviews','partnerPayableCandidates','partnerPayableReviews','partnerPaymentCandidates','partnerPayments','destinationCandidates','destinationReviews','evidenceReviews','serviceOrders','payrollCandidates','payrollItems','payrollPolicies','payrollRuns','availability','outsideWork','scheduleDeclarations','serviceEvents','timesheets'];
const service={...Object.fromEntries(serviceKeys.map(k=>[k,[]])),owner:false};
const accessKeys=['employeePaymentAccess','partnerDestinationAccess','partnerPayableAccess','partnerPaymentAccess','destinationAccess'];
for(const key of accessKeys)service[key]=true;
const record=kind=>({id:'SYNTHETIC-'+kind,kind,email:kind+'@example.test',createdAt:'2026-09-13T10:00:00Z',updatedAt:'2026-09-13T10:00:00Z',accountLinked:true,version:1,status:'needs_information',note:'Please confirm your contact details.',details:kind==='client'?{organisationName:'Synthetic Example Client',contactName:'Example Contact',mobile:'0821234567',siteArea:'Johannesburg',message:'Synthetic site enquiry for frontend validation.'}:{fullName:'Synthetic Example Officer',mobile:'0821234567',city:'Johannesburg',province:'Gauteng',pathway:'qualified',psiraStatus:'active',psiraNumber:'1234567',psiraGrade:'Grade C'},events:[]});
async function fits(page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();}
async function shot(page,name,info){await mkdir(output,{recursive:true});await page.screenshot({path:`${output}/${info.project.name}-${name}.png`,fullPage:false});}
test.beforeEach(async({page})=>{
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await page.route('**/api/**',route=>{
  const url=new URL(route.request().url());let data={};
  if(url.pathname==='/api/signup'){const kind=url.searchParams.get('kind')||url.searchParams.get('scope');data={records:[record(kind)],email:kind+'@example.test',hasMore:false};}
  else if(url.pathname==='/api/production-operations')data=service;
  else if(url.pathname==='/api/finance-documents')data={documents:[],sources:[],calendar:'Africa/Johannesburg'};
  else if(url.pathname==='/api/booking-refunds')data={sources:[],refundCases:[],refundReceipts:[],refundObservations:[],refundStates:[],liveRefundsEnabled:false,pageSize:50,pagination:Object.fromEntries((url.searchParams.has('dataset')?[url.searchParams.get('dataset')]:['sources','cases','receipts','observations','states']).map(dataset=>[dataset,{hasMore:false,nextCursor:null}]))};
  else if(url.pathname==='/api/credit-notes')data={invoice:{invoice_id:url.searchParams.get('invoiceId'),source_json:'{}',total_cents:0,credited_cents:0},creditNotes:[],moneyMoved:false,liabilitiesCancelled:false};
  else if(url.pathname==='/api/payment-execution')data={liveDispatchEnabled:false,reserves:[],releases:[],reconciliations:[]};
  else if(url.pathname==='/api/agreements/production')data={documents:[],envelopes:[],entities:[],owner:false};
  else if(url.pathname==='/api/psira')data={cases:[]};
  else if(url.pathname==='/api/test-cycle')data={cycles:[]};
  else if(url.pathname==='/api/identity')data={caseVersion:1,nextStep:'training_options',checks:[],history:[]};
  else if(url.pathname==='/api/enrolment')data={canInitialize:false,package:{version:'synthetic'},order:null,history:[],events:[]};
  return route.fulfill({json:data});
 });
});
for(const base of ['/client','/officer','/ops'])test(`${base}: navigation, direct links, empty states and keyboard`,async({page},info)=>{
 const paths=['','/agreements','/service','/test-cycle',...(base!='/client'?['/psira','/identity']:[]),...(base==='/ops'?['/intake','/security']:[])];
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const suffix of paths){
  await page.goto(base+suffix+(suffix==='/identity'?'?caseId=SYNTHETIC-CASE':''));
  await expect(page.locator('h1')).toBeVisible();
  const nav=page.getByRole('navigation',{name:/navigation$/});
  await expect(nav.locator('[aria-current=page]')).toHaveCount(1);
  await expect(nav.getByRole('link',{name:'Agreements',exact:true})).toBeVisible();
  if(base!='/ops')await expect(nav.getByRole('link',{name:'Account security'})).toHaveCount(0);
  if(suffix==='/service')await expect(page.getByText('No production roster records are available for this account.')).toBeVisible();
  if(suffix==='/agreements')await expect(page.getByText('No approved agreements have been delivered to this account.')).toBeVisible();
  await fits(page);await shot(page,(base+suffix).slice(1).replaceAll('/','-')||'account',info);
 }
 await page.goto(base);await expect(page.locator('h1')).toBeVisible();await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Skip to page content'})).toBeFocused();await page.keyboard.press('Enter');await expect(page.locator('#workspace-content')).toBeFocused();
 await page.getByRole('navigation',{name:/navigation$/}).getByRole('link',{name:'Agreements',exact:true}).click();await expect(page).toHaveURL(new RegExp(base+'/agreements$'));await page.getByRole('link',{name:'← Back to account'}).click();await expect(page).toHaveURL(new RegExp(base+'$'));
 expect(errors).toEqual([]);
});
test('Operations intake selection survives reload and direct links',async({page},info)=>{
 await page.goto('/ops');await page.getByRole('link',{name:'Client enquiries',exact:true}).click();await expect(page).toHaveURL(/\/ops\/intake\?kind=client$/);await expect(page.getByRole('heading',{name:'Synthetic Example Client'})).toBeVisible();await page.reload();await expect(page.getByRole('navigation',{name:'Intake type'}).getByRole('link',{name:'Client enquiries'})).toHaveAttribute('aria-current','page');
 const selected=page.getByRole('navigation',{name:'Intake type'}).getByRole('link',{name:'Client enquiries'});await selected.click();await expect(page.getByRole('heading',{name:'Synthetic Example Client'})).toBeVisible();await fits(page);await shot(page,'ops-intake-active-link',info);
});
for(const status of [401,403,409,423,503])test(`intake ${status}: denial clears private edits; transient failures preserve them`,async({page},info)=>{
 await page.goto('/client');await page.getByRole('button',{name:'Correct my details'}).click();await page.getByLabel('Organisation',{exact:true}).fill('Unsaved correction');
 await page.route('**/api/signup?**',route=>route.fulfill({status,json:{error:'Synthetic request failure.'}}));
 await page.getByRole('button',{name:'Save and resubmit for review'}).click();await expect(page.getByRole('alert')).toContainText(status===401?'session has expired':status===403?'cannot access':status===409?'record changed':status===423?'currently locked':'temporarily unavailable');if(status===401||status===403)await expect(page.getByLabel('Organisation',{exact:true})).toHaveCount(0);else await expect(page.getByLabel('Organisation',{exact:true})).toHaveValue('Unsaved correction');
 await page.getByRole('button',{name:'Refresh',exact:true}).click();await expect(page.getByRole('alert')).toBeVisible();if(status===401||status===403)await expect(page.getByLabel('Organisation',{exact:true})).toHaveCount(0);else await expect(page.getByLabel('Organisation',{exact:true})).toHaveValue('Unsaved correction');await fits(page);if(status===503)await shot(page,'client-failed-save',info);
});
test('agreement expiry removes signature action without refreshing',async({page},info)=>{
 await page.route('**/api/agreements/production?**',route=>route.fulfill({json:{documents:[],entities:[],owner:false,envelopes:[{id:'SYNTHETIC-AGREEMENT',role:'client',wording:'SYNTHETIC UI FIXTURE — not an approved legal document.',context_json:JSON.stringify({site:'Synthetic site',scope:'UI validation only'}),expires_at:new Date(Date.now()+4000).toISOString(),cancelled:0,document_withdrawn:0,receipt_json:null}]}}));
 await page.goto('/client/agreements');await expect(page.getByRole('button',{name:'Agree and record my signature'})).toBeVisible();await page.getByText('Read exact agreement and service scope').click();await expect(page.getByText('SYNTHETIC UI FIXTURE', {exact:false})).toBeVisible();await expect(page.getByRole('status')).toHaveText('Expired',{timeout:10000});await expect(page.getByRole('button',{name:'Agree and record my signature'})).toHaveCount(0);await fits(page);await shot(page,'agreement-expired',info);
});
test('public routes retain mobile navigation and one exact active destination',async({page},info)=>{
 const routes=['/','/security-services','/armed-security','/vip-protection','/industries','/locations/johannesburg','/clients','/officers','/training','/compliance','/about','/contact','/privacy'];
 const primary=['/security-services','/armed-security','/vip-protection','/industries','/clients','/officers','/about'];
 for(const path of routes){await page.goto((process.env.LOKD_PUBLIC_BASE_URL??'http://127.0.0.1:4178')+path);await expect(page.locator('h1')).toBeVisible();if(path!='/privacy'){const nav=page.getByRole('navigation',{name:'Main navigation'});await expect(nav).toBeVisible();await expect(nav.locator('[aria-current=page]')).toHaveCount(primary.includes(path)?1:0);await expect(nav.getByRole('link',{name:'Armed security',exact:true})).toBeVisible();}await fits(page);if(['/','/armed-security','/contact'].includes(path))await shot(page,'public-'+(path.slice(1)||'home'),info);}
});
test('workspace reflows at 200 percent text size',async({page},info)=>{
 await page.goto('/officer');await page.addStyleTag({content:'html { font-size: 200%; } button, input, select, textarea, a, p, label, small { font-size: 1rem !important; }'});await fits(page);await shot(page,'officer-large-text',info);
});

for(const endpoint of ['agreements/production','production-operations'])for(const status of [401,403,409,423,503])test(`${endpoint} ${status}: access-aware recovery does not replay`,async({page},info)=>{
 const agreement=endpoint==='agreements/production';await page.goto(agreement?'/ops/agreements':'/ops/service');
 if(agreement){await page.getByText('Prepare a legal document for approval',{exact:true}).click();await page.getByLabel('Document version',{exact:true}).fill('SYNTHETIC-DRAFT');await page.getByLabel('Contracting or employing entity ID',{exact:true}).fill('SYNTHETIC-ENTITY');await page.getByLabel('Exact legal wording',{exact:true}).fill('SYNTHETIC legal text used only for browser presentation validation.');}
 else {await page.getByLabel('Production roster slot',{exact:true}).fill('SYNTHETIC-SLOT');await page.getByLabel('Operational officer ID',{exact:true}).fill('SYNTHETIC-OFFICER');await page.getByLabel('Current slot version',{exact:true}).fill('1');await page.getByLabel('Unique activation reference',{exact:true}).fill('SYNTHETIC-ORIGINAL-REFERENCE');}
 let posts=0;await page.route(`**/api/${endpoint}?**`,route=>{if(route.request().method()==='POST')posts++;return route.fulfill({status,contentType:'text/html',body:'<html>Upstream unavailable</html>'});});
 await page.getByRole('button',{name:agreement?'Save immutable draft':'Evaluate readiness',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText(status===401?'session has expired':status===403?'cannot perform':status===409?'evidence has changed':status===423?'action is locked':'outcome may be unknown');
 const input=page.getByLabel(agreement?'Document version':'Unique activation reference',{exact:true});if(status===401||status===403)await expect(input).toHaveCount(0);else await expect(input).toHaveValue(agreement?'SYNTHETIC-DRAFT':'SYNTHETIC-ORIGINAL-REFERENCE');
 await page.getByRole('button',{name:status===401||status===403?'Refresh workspace access':agreement?'Refresh agreements':'Refresh production records',exact:true}).click();await expect(page.getByRole('alert')).toBeVisible();if(status===401||status===403)await expect(input).toHaveCount(0);else await expect(input).toHaveValue(agreement?'SYNTHETIC-DRAFT':'SYNTHETIC-ORIGINAL-REFERENCE');expect(posts).toBe(1);await fits(page);if(status===503)await shot(page,agreement?'agreement-recovery':'service-recovery',info);
});
test('PSiRA draft survives a failed refresh and requires status review',async({page},info)=>{
 await page.goto('/officer/psira');await page.getByRole('combobox',{name:'Registration pathway',exact:true}).selectOption('registered');await page.getByLabel('PSiRA number',{exact:true}).fill('1234567');
 await page.route('**/api/psira?**',route=>route.fulfill({status:503,contentType:'text/html',body:'Unavailable'}));await page.getByRole('button',{name:'Refresh records'}).click();await expect(page.getByRole('alert')).toContainText('outcome may be unknown');await expect(page.getByLabel('PSiRA number',{exact:true})).toHaveValue('1234567');await expect(page.getByRole('button',{name:'Submit for review'})).toBeDisabled();await fits(page);await shot(page,'psira-recovery',info);
});
test('agreement structured details preserve every source field and exact wording',async({page},info)=>{
 const context={subjectId:'SYNTHETIC-SUBJECT',scope:{rosterSlotId:'SYNTHETIC-SLOT',amountMinor:12345,conditions:['Exact first condition','Exact second condition']}};
 await page.route('**/api/agreements/production?**',route=>route.fulfill({json:{documents:[],entities:[],owner:false,envelopes:[{id:'SYNTHETIC-AGREEMENT',role:'SERVICE_ORDER',wording:'SYNTHETIC UI FIXTURE — exact wording retained.',context_json:JSON.stringify(context),expires_at:'2099-01-01T00:00:00Z',cancelled:0,document_withdrawn:0,receipt_json:null}]}}));
 await page.goto('/client/agreements');await expect(page.getByRole('heading',{name:'Service order agreement'})).toBeVisible();await page.getByText('Read exact agreement and service scope').click();await expect(page.getByText('SYNTHETIC UI FIXTURE — exact wording retained.',{exact:true})).toBeVisible();await expect(page.getByText('Amount Minor',{exact:true})).toBeVisible();await expect(page.getByText('12345',{exact:true})).toBeVisible();await page.getByText('View exact stored record',{exact:true}).click();await expect(page.locator('pre').filter({hasText:'subjectId'})).toHaveText(JSON.stringify(context));await fits(page);await shot(page,'agreement-readable-record',info);
});
test('identity session recovery preserves the case return path',async({page})=>{
 await page.route('**/api/identity?**',route=>route.fulfill({status:401,json:{error:'Sign in required.'}}));await page.goto('/officer/identity?caseId=SYNTHETIC-CASE');await expect(page.getByRole('alert')).toContainText('session has expired');await expect(page.getByRole('link',{name:'Sign in again'})).toHaveAttribute('href','/sign-in?return_to=%2Fofficer%2Fidentity%3FcaseId%3DSYNTHETIC-CASE');
});
test('Operations PSiRA review retains source evidence across a failed refresh',async({page})=>{
 await page.route('**/api/psira?**',route=>route.fulfill({json:{cases:[{id:'SYNTHETIC-PSIRA',version:1,declaration:'registered',psira_number:'1234567',owner_email:'officer@example.test',events:[],verified:false,recheckDue:false}]}}));await page.goto('/ops/psira');await page.getByText('Record an Operations review',{exact:true}).click();await page.getByLabel('Dated result excerpt or failure description').fill('Unsaved synthetic review evidence');await page.route('**/api/psira?**',route=>route.fulfill({status:503,json:{error:'Temporary test outage.'}}));await page.getByRole('button',{name:'Refresh records'}).click();await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByLabel('Dated result excerpt or failure description')).toHaveValue('Unsaved synthetic review evidence');await expect(page.getByRole('button',{name:'Save dated review'})).toBeDisabled();
});
test('uncertain booking checkout keeps its original reference and offers no replacement',async({page},info)=>{
 const collection={reference:'SYNTHETIC-ORIGINAL-COLLECTION',order_id:'SYNTHETIC-ORDER',client_id:'SYNTHETIC-CLIENT',case_version:1,source_hash:'synthetic',amount_minor:10000,currency:'ZAR',mode:'test',state:'approved',revision:1,current:true,checkout_url:null,evidence:[]};let posts=[];
 await page.route('**/api/production-operations?**',route=>{if(route.request().method()==='POST'){posts.push(route.request().postDataJSON());return route.fulfill({status:503,contentType:'text/html',body:'Uncertain result'});}return route.fulfill({json:{...service,collections:[{...collection,state:posts.length?'initialization_unknown':'approved'}]}});});
 await page.goto('/client/service');await page.getByRole('button',{name:'Open test checkout',exact:true}).click();await expect(page.getByRole('alert')).toContainText('outcome may be unknown');expect(posts).toHaveLength(1);expect(posts[0].reference).toBe(collection.reference);await page.getByRole('button',{name:'Refresh production records'}).click();await expect(page.getByText('The checkout outcome is uncertain.',{exact:false})).toBeVisible();await expect(page.getByRole('button',{name:'Open test checkout',exact:true})).toHaveCount(0);expect(posts).toHaveLength(1);await fits(page);await shot(page,'collection-uncertain',info);
});
