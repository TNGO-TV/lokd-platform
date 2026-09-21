import {test,expect} from '@playwright/test';
import {clerk,clerkSetup,setupClerkTestingToken} from '@clerk/testing/playwright';
const emails=JSON.parse(process.env.LOKD_TEST_EMAILS);
test.use({actionTimeout:15000});
test.beforeAll(async()=>clerkSetup({dotenv:false}));
async function login(page,role){await setupClerkTestingToken({page});await page.goto('/sign-in');await clerk.loaded({page});await clerk.signIn({page,signInParams:{strategy:'email_code',identifier:emails[role]}});}
test('partner instruction browser enforces independent finance approval and prevents unconfigured dispatch',async({browser})=>{
 test.skip(process.env.LOKD_ACCOUNT_TEST_PARTNER_PAYMENTS!=='true','Requires isolated employee payment fixture.');test.setTimeout(180000);
 const contexts=await Promise.all(Array.from({length:4},()=>browser.newContext()));
 try{
  const [maker,finance,client,officer]=await Promise.all(contexts.map(c=>c.newPage()));
  await login(maker,'operations');await login(finance,'owner');await login(client,'client');await login(officer,'officer');
  const endpoint='/api/production-operations?kind=client&scope=operations';await maker.goto('/ops/service');await expect(maker.getByRole('heading',{name:'Partner-company payment instructions',exact:true})).toBeVisible();
  const state=await(await maker.request.get(endpoint)).json(),instruction=state.partnerPayments.find(i=>i.status==='prepared');expect(instruction).toBeTruthy();
  const self=await maker.request.post(endpoint,{data:{action:'approve_partner_payment',reference:instruction.reference,version:instruction.version,sourceHash:instruction.source_hash,note:'Self approval must fail.',instructionReviewed:true}});expect(self.status()).toBe(403);
  await finance.goto('/ops/service');const card=finance.getByRole('heading',{name:'Partner instruction '+instruction.reference,exact:true}).locator('..');await card.getByText('Review exact payment instruction',{exact:true}).click();await expect(card.getByText(/Invoice approval SHA-256/)).toBeVisible();await expect(card.getByText(/account ending 7890/)).toBeVisible();
  await card.getByLabel('Finance instruction findings',{exact:true}).fill('Independent finance browser review of approved company invoice and destination.');await card.getByLabel('I independently checked the exact approved invoice and destination for this instruction.').check();await card.getByRole('button',{name:'Approve payment instruction',exact:true}).click();await expect(card.getByRole('status')).toContainText('approved');
  await card.getByRole('button',{name:'Submit approved test transfer',exact:true}).click();await expect(finance.getByRole('alert')).toContainText('not configured');await expect(card.getByRole('status')).toContainText('approved');
  await card.getByRole('button',{name:'Cancel unsent instruction',exact:true}).click();await expect(card.getByRole('status')).toContainText('cancelled');
  for(const [page,kind] of [[client,'client'],[officer,'officer']]){expect((await page.request.get(endpoint)).status()).toBe(403);const own=await(await page.request.get('/api/production-operations?kind='+kind)).json();expect(own.partnerPaymentAccess).toBe(false);expect(own.partnerPayments).toEqual([]);expect(own.partnerPaymentCandidates).toEqual([]);await page.goto('/'+kind+'/service');await expect(page.getByRole('heading',{name:'Partner-company payment instructions',exact:true})).toHaveCount(0);}
  const final=await(await finance.request.get(endpoint)).json();expect(final.partnerPayments.every(i=>i.status==='cancelled')).toBe(true);expect(final.partnerPayableReviews.some(r=>r.status==='approved')).toBe(true);expect(final.payrollRuns).toHaveLength(0);
 }finally{await Promise.allSettled(contexts.map(c=>c.close()));}
});
