import {test,expect} from '@playwright/test';
import {clerk,clerkSetup,setupClerkTestingToken} from '@clerk/testing/playwright';
const emails=JSON.parse(process.env.LOKD_TEST_EMAILS);
test.use({actionTimeout:15000});
test.beforeAll(async()=>clerkSetup({dotenv:false}));
async function login(page,role){await setupClerkTestingToken({page});await page.goto('/sign-in');await clerk.loaded({page});await clerk.signIn({page,signInParams:{strategy:'email_code',identifier:emails[role]}});}
test('destination browser restricts evidence, rejects maker approval and supports independent rejection and suspension',async({browser})=>{
 test.skip(process.env.LOKD_ACCOUNT_TEST_PARTNER_DESTINATIONS!=='true','Requires isolated destination fixture.');test.setTimeout(180000);
 const contexts=await Promise.all(Array.from({length:4},()=>browser.newContext()));
 try{
  const [maker,reviewer,client,officer]=await Promise.all(contexts.map(c=>c.newPage()));
  await login(maker,'operations');await login(reviewer,'owner');await login(client,'client');await login(officer,'officer');
  const endpoint='/api/production-operations?kind=client&scope=operations';
  await maker.goto('/ops/service');await expect(maker.getByRole('heading',{name:'Partner-company payment destinations',exact:true})).toBeVisible();
  const state=await(await maker.request.get(endpoint)).json(),pending=state.partnerDestinationReviews.find(r=>r.status==='pending');expect(pending).toBeTruthy();expect(JSON.stringify(state.partnerDestinationReviews)).not.toContain('1234567890');
  const self=await maker.request.post(endpoint,{data:{action:'approve_partner_destination',destinationId:pending.id,payloadHash:pending.payload_hash,note:'Self approval must fail.',evidenceReviewed:true,accountNumber:'1234567890'}});expect(self.status()).toBe(403);
  await reviewer.goto('/ops/service');const card=reviewer.getByRole('heading',{name:'Destination EMP-1 · test · review 3',exact:true}).locator('..');await card.getByText('Review destination source evidence',{exact:true}).click();await expect(card.getByText(/vault:fixture:ownership-v1/)).toBeVisible();await expect(card.getByText(/account ending 7890/)).toBeVisible();
  await card.getByLabel('Independent ownership account number',{exact:true}).fill('1234567890');await card.getByLabel('Independent destination findings',{exact:true}).fill('Independent browser review; source mandate needs replacement.');await card.getByLabel('I independently checked the exact ownership document, company payment mandate and provider capability.').check();
  // The acceptance server has no payment-provider key. Approval must stay blocked;
  // provider success and mismatch journeys run in the connected database fixture.
  await card.getByRole('button',{name:'Confirm test destination',exact:true}).click();await expect(reviewer.getByRole('alert')).toContainText('not configured');
  await card.getByRole('button',{name:'Reject destination',exact:true}).click();await expect(card.getByRole('status')).toContainText('rejected');
  const confirmed=reviewer.getByRole('heading',{name:'Destination EMP-1 · test · review 2',exact:true}).locator('..');await expect(confirmed.getByRole('status')).toContainText('confirmed test');await confirmed.getByLabel('Destination suspension findings',{exact:true}).fill('Independent browser suspension of fixture mandate.');await confirmed.getByRole('button',{name:'Suspend destination',exact:true}).click();await expect(confirmed.getByRole('status')).toContainText('held');
  for(const [page,kind] of [[client,'client'],[officer,'officer']]){expect((await page.request.get(endpoint)).status()).toBe(403);const own=await(await page.request.get('/api/production-operations?kind='+kind)).json();expect(own.partnerDestinationAccess).toBe(false);expect(own.partnerDestinationReviews).toEqual([]);expect(own.partnerDestinationCandidates).toEqual([]);await page.goto('/'+kind+'/service');await expect(page.getByRole('heading',{name:'Partner-company payment destinations',exact:true})).toHaveCount(0);}
  const final=await(await reviewer.request.get(endpoint)).json();expect(final.partnerDestinationReviews.find(r=>r.revision===1).status).toBe('superseded');expect(final.payrollRuns).toHaveLength(0);
 }finally{await Promise.allSettled(contexts.map(c=>c.close()));}
});
