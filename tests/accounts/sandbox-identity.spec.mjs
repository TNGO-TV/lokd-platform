import {test,expect} from '@playwright/test';
import {clerk,clerkSetup,setupClerkTestingToken} from '@clerk/testing/playwright';
const emails=JSON.parse(process.env.LOKD_TEST_EMAILS);
test.beforeAll(async()=>clerkSetup({dotenv:false}));
async function login(browser,role){const c=await browser.newContext(),page=await c.newPage();await setupClerkTestingToken({page});await page.goto('/sign-in');await clerk.loaded({page});await clerk.signIn({page,signInParams:{strategy:'email_code',identifier:emails[role]}});return {c,page};}
test('hosted development identities use guarded sandbox intake, capture, independent review and private download',async({browser})=>{
 const sessions=[];try{
 for(const role of ['officer','operations','owner'])sessions.push(await login(browser,role));const [officer,reviewer,owner]=sessions.map(s=>s.page);
 const app=(page,service,input)=>page.request.post('/api/sandbox/application',{data:{service,input}}),id=(page,action,input)=>page.request.post('/api/sandbox/identity',{data:{action,input}});
 const applied=await app(officer,'officer_application',{pathway:'qualified',fullName:'Sandbox Development Officer',mobile:'099'+Date.now().toString().slice(-7),email:emails.officer,city:'Johannesburg',province:'Gauteng',psiraStatus:'active',psiraNumber:'1234567',psiraGrade:'Grade A',services:['Unarmed'],purposes:['Commercial access'],training:[],over18Confirmed:true,eligibilityAcknowledged:true,contactConsent:true});expect(applied.status()).toBe(200);const application=(await applied.json()).data.reference;
 expect((await app(officer,'intake',{action:'link',kind:'officer',id:application,expectedVersion:0})).status()).toBe(200);
 const captured=await id(officer,'capture',{applicantId:application,applicantVersion:1,consented:true,consentVersion:'lokd-sandbox-consent-v1',scenario:'lost_response'});expect(captured.status()).toBe(200);const capture=(await captured.json()).data;
 const submitted=await id(officer,'start',{applicantId:application,applicantVersion:1,captureReference:capture.captureReference,consentVersion:capture.consentVersion});expect(submitted.status()).toBe(200);const pending=(await submitted.json()).data;expect(pending.outcome).toBe('delivery_unknown');
 const recovered=await id(reviewer,'recover',{id:pending.id,expectedOutcomeId:pending.outcomeId});expect(recovered.status()).toBe(200);const result=(await recovered.json()).data;expect(result.outcome).toBe('verified');
 const decision={id:pending.id,outcomeId:result.outcomeId,decision:'approve',reason:'Independent inspection of fictional captured case',independentlyChecked:true};expect((await id(officer,'decide',decision)).status()).toBe(403);expect((await id(reviewer,'decide',decision)).status()).toBe(409);expect((await id(owner,'decide',decision)).status()).toBe(200);
 expect((await id(reviewer,'download',{id:pending.id})).status()).toBe(403);
 const readerUserId=await reviewer.evaluate(()=>window.Clerk.user.id);const grant=await id(owner,'grant_evidence',{caseId:pending.id,readerUserId});expect(grant.status()).toBe(200);
 const downloaded=await id(reviewer,'download',{id:pending.id});expect(downloaded.status()).toBe(200);expect(downloaded.headers()['cache-control']).toContain('no-store');expect((await downloaded.json()).simulated).toBe(true);
 expect((await id(owner,'download',{id:pending.id})).status()).toBe(403);
 expect((await id(officer,'withdraw_capture',{captureReference:capture.captureReference})).status()).toBe(200);expect((await id(reviewer,'download',{id:pending.id})).status()).toBe(409);
 const read=await id(officer,'read',{id:pending.id});expect((await read.json()).data.identityVerified).toBe(false);
 }finally{await Promise.allSettled(sessions.map(s=>s.c.close()));}
});
test('real hosted development bearer respects workspace host routing through the local server',async({browser,request})=>{
 const s=await login(browser,'owner');try{const token=await s.page.evaluate(()=>window.Clerk.session.getToken({skipCache:true}));
 for(const [host,status] of [['operations.lokd.co.za',404],['officers.lokd.co.za',403],['portal.lokd.co.za',403]]){
 const response=await request.post('/api/sandbox/identity',{headers:{host,origin:'http://'+host,authorization:`Bearer ${token}`},data:{action:'read',input:{id:'deliberately-missing-case'}}});expect(response.status(),host).toBe(status);
 }
 }finally{await s.c.close();}
});
