import {test,expect} from '@playwright/test';
import {clerk,clerkSetup,setupClerkTestingToken} from '@clerk/testing/playwright';
const emails=JSON.parse(process.env.LOKD_TEST_EMAILS);
test.beforeAll(async()=>clerkSetup({dotenv:false}));
async function login(page,role){await setupClerkTestingToken({page});await page.goto('/sign-in');await clerk.loaded({page});await clerk.signIn({page,signInParams:{strategy:'email_code',identifier:emails[role]}});}
test('production connections keep intake pending, expose approved signing and isolate Operations',async({browser})=>{
 test.setTimeout(120000);const contexts=await Promise.all([browser.newContext({viewport:{width:390,height:844}}),browser.newContext()]);
 try{const client=await contexts[0].newPage(),ops=await contexts[1].newPage();await login(client,'client');await login(ops,'owner');
 const r=await client.request.post('/api/enquiries',{data:{organisationName:'Production Connection Fixture',contactName:'Test Client',email:emails.client,mobile:'0821234567',siteArea:'Sandton',siteType:'commercial_property',requiredStart:'planning',message:'Isolated browser test; no production contract or service.',advanceFundingAcknowledged:true,privacyConsent:true}});expect(r.status()).toBe(202);const id=(await r.json()).reference;
 expect((await client.request.post('/api/signup?scope=client',{data:{kind:'client',id,action:'link',expectedVersion:0}})).status()).toBe(200);
 expect((await ops.request.post('/api/signup?scope=operations&kind=client',{data:{kind:'client',id,action:'review',expectedVersion:1,status:'reviewed',note:'Isolated intake fixture independently reviewed.'}})).status()).toBe(200);
 const prepared=await ops.request.post('/api/agreements/production?kind=client&scope=operations',{data:{action:'prepare_entity',kind:'client',caseId:id,caseVersion:2}});expect(prepared.status()).toBe(200);expect((await prepared.json()).result.grantsAccess).toBe(false);
 await ops.goto('/ops/agreements');await ops.getByText('Prepare a legal document for approval',{exact:true}).click();await ops.getByLabel('Document version',{exact:true}).fill('browser-test-v1');await ops.getByLabel('Contracting or employing entity ID',{exact:true}).fill('TEST-ENTITY');await ops.getByLabel('Exact legal wording',{exact:true}).fill('TEST AGREEMENT — Browser fixture only. Not approved for production signing or work eligibility.');await ops.getByRole('button',{name:'Save immutable draft',exact:true}).click();await expect(ops.getByRole('heading',{name:'CLIENT_MSA · browser-test-v1'})).toBeVisible();
 const endpoint='/api/agreements/production?kind=client&scope=operations',d=await(await ops.request.get(endpoint)).json(),doc=d.documents[0];
 const rejected=await ops.request.post(endpoint,{data:{action:'approve',documentId:doc.id,contentHash:doc.content_hash,legalApprovalConfirmed:true,effectiveFrom:'2026-01-01T00:00:00Z'}});expect(rejected.status()).toBe(409);
 expect((await client.request.get(endpoint)).status()).toBe(403);expect((await client.request.post('/api/production-operations?kind=client',{data:{action:'grant_operator',email:emails.client,role:'operations_owner',limitCents:100000}})).status()).toBe(403);
 await client.goto('/client/agreements');await expect(client.getByText('No approved agreements have been delivered to this account.')).toBeVisible();expect(await client.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await client.goto('/client/service');await expect(client.getByText('No production roster records are available for this account.')).toBeVisible();
 await ops.goto('/ops/service');await expect(ops.getByRole('button',{name:'Prepare for independent approval'})).toBeVisible();await expect(ops.getByText('No production roster records are available for this account.')).toBeVisible();
 }finally{await Promise.all(contexts.map(c=>c.close()));}
});
