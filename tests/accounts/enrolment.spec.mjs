import {test,expect} from '@playwright/test';
import {clerk,clerkSetup,setupClerkTestingToken} from '@clerk/testing/playwright';
import {DatabaseSync} from 'node:sqlite';
const emails=JSON.parse(process.env.LOKD_TEST_EMAILS);
const dbPath='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/faaf2b0445ab934c3aac48ddf0cdfade8f9bac050be98993748742cdd2cb05fb.sqlite';
test.beforeAll(async()=>{await clerkSetup({dotenv:false});});
async function login(page,role){await setupClerkTestingToken({page});await page.goto('/sign-in');await clerk.loaded({page});await clerk.signIn({page,signInParams:{strategy:'email_code',identifier:emails[role]}});}
test('authenticated applicant and Operations retain payment evidence and fail closed without provider configuration',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844}}),opsContext=await browser.newContext();
 try{
 const page=await context.newPage();await login(page,'unassigned');
 const r=await page.request.post('/api/applications',{data:{pathway:'qualified',fullName:'Synthetic Recovery Officer',mobile:'0821234567',email:emails.unassigned,city:'Johannesburg',province:'Gauteng',psiraStatus:'active',psiraNumber:'1234567',psiraGrade:'Grade A',services:['Unarmed'],purposes:['Commercial access'],training:[],over18Confirmed:true,eligibilityAcknowledged:true,contactConsent:true}});expect(r.status()).toBe(202);const id=(await r.json()).reference;
 expect((await page.request.post('/api/signup?scope=officer',{data:{action:'link',kind:'officer',id,expectedVersion:0}})).status()).toBe(200);
 const sql=new DatabaseSync(dbPath),owner=sql.prepare('SELECT owner_user_id FROM signup_cases WHERE source_id=?').get(id).owner_user_id,now=new Date().toISOString();
 // Local evidence fixtures only. No provider call or verification bypass is shipped.
 sql.prepare("INSERT INTO applicant_verification_checks(id,case_id,owner_user_id,case_version,scenario,signal,mode,state,attempts,created_at,updated_at) VALUES(?,?,?,1,'id-found','id','sandbox','mock_approved',1,?,?)").run('browser-id',id,owner,now,now);
 sql.prepare("INSERT INTO applicant_verification_checks(id,case_id,owner_user_id,case_version,scenario,signal,mode,state,attempts,retry_at,created_at,updated_at) VALUES(?,?,?,1,'face-match','face','sandbox','rate_limited',1,?,?,?)").run('browser-rate',id,owner,new Date(Date.now()+90000).toISOString(),now,now);
 await page.goto('/officer/identity?caseId='+id);await expect(page.getByRole('heading',{name:'Identity checks',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Create my R350 test checkout'})).toBeDisabled();await page.getByRole('checkbox').check();await expect(page.getByRole('button',{name:'Create my R350 test checkout'})).toBeEnabled();
 expect((await page.request.get('/api/enrolment?scope=operations&caseId='+id)).status()).toBe(403);
 const ops=await opsContext.newPage();await login(ops,'owner');await ops.goto('/ops/identity?caseId='+id);await expect(ops.getByRole('button',{name:'Retry after provider cooldown'})).toBeDisabled();await expect(ops.getByRole('button',{name:'Create my R350 test checkout'})).toHaveCount(0);
 expect((await ops.request.get('/api/enrolment?caseId='+id)).status()).toBe(404);
 sql.prepare("INSERT INTO test_enrolment_orders(reference,case_id,owner_user_id,case_version,package_id,package_version,amount_minor,currency,state,revision,note,created_at,updated_at) VALUES(?,?,?,1,'registered-officer-enrolment','owner-approved-20260911-test-v1',35000,'ZAR','awaiting_webhook',1,'Provider success verified; waiting for matching signed webhook.',?,?)").run('browser-order',id,owner,now,now);
 await page.reload();await expect(page.getByRole('status')).toHaveText('Payment: awaiting webhook');await page.getByRole('button',{name:'Verify transaction and webhook'}).click();await expect(page.getByRole('alert')).toContainText('Test payments are not configured');await expect(page.getByRole('status')).toHaveText('Payment: awaiting webhook');
 await ops.reload();await expect(ops.getByRole('status')).toHaveText('Payment: awaiting webhook');
 const state=await(await ops.request.get('/api/enrolment?scope=operations&caseId='+id)).json();expect(state.workEligible).toBe(false);expect(state.liveChargingEnabled).toBe(false);
 // Changed application retains the old order and exposes reconciliation, not a replacement checkout.
 expect((await page.request.post('/api/signup?scope=officer',{data:{action:'correct',kind:'officer',id,expectedVersion:1,changes:{city:'Sandton'}}})).status()).toBe(200);
 await page.reload();await page.getByText('Application payment history',{exact:true}).click();await expect(page.getByRole('button',{name:'Reconcile saved order'})).toBeVisible();await expect(page.getByRole('button',{name:'Create my R350 test checkout'})).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);sql.close();
 }finally{await context.close();await opsContext.close();}
});
