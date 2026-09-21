import {test,expect} from '@playwright/test';
import {clerk,clerkSetup,setupClerkTestingToken} from '@clerk/testing/playwright';
const emails=JSON.parse(process.env.LOKD_TEST_EMAILS);
test.use({actionTimeout:15000});
test.beforeAll(async()=>clerkSetup({dotenv:false}));
async function login(page,role){await setupClerkTestingToken({page});await page.goto('/sign-in');await clerk.loaded({page});await clerk.signIn({page,signInParams:{strategy:'email_code',identifier:emails[role]}});}
test('partner invoice browser requires independent finance and blocks suspended CSV',async({browser})=>{
 test.skip(process.env.LOKD_ACCOUNT_TEST_PARTNER_PAYABLES!=='true','Requires isolated partner invoice fixture.');test.setTimeout(180000);
 const contexts=await Promise.all(Array.from({length:4},()=>browser.newContext()));
 try{
  const [maker,finance,client,officer]=await Promise.all(contexts.map(c=>c.newPage()));
  await login(maker,'operations');await login(finance,'owner');await login(client,'client');await login(officer,'officer');
  const endpoint='/api/production-operations?kind=client&scope=operations';await maker.goto('/ops/service');await expect(maker.getByRole('heading',{name:'Partner company payables',exact:true})).toBeVisible();
  const state=await(await maker.request.get(endpoint)).json(),review=state.partnerPayableReviews.find(i=>i.status==='pending');expect(review).toBeTruthy();
  const self=await maker.request.post(endpoint,{data:{action:'approve_partner_payable',reviewId:review.id,payloadHash:review.payload_hash,note:'Self approval must fail.',sourcesReviewed:true}});expect(self.status()).toBe(403);
  await finance.goto('/ops/service');const card=finance.getByRole('heading',{name:'Partner payable INV-001 / 01',exact:true}).locator('..');await card.getByText('Review partner invoice evidence',{exact:true}).click();await expect(card.getByText(/Current employer agreement evidence/)).toBeVisible();
  await card.getByLabel('Partner finance findings',{exact:true}).fill('Independent finance browser review of company invoice, tax, agreement and service.');await card.getByLabel('I independently checked this exact invoice line, company, service, agreement and tax evidence.').check();await card.getByRole('button',{name:'Approve partner payable',exact:true}).click();await expect(card.getByRole('status')).toContainText('approved');
  await card.getByRole('button',{name:'Record partner CSV export',exact:true}).click();const link=card.getByRole('link',{name:'Download unpaid partner payable CSV'});await expect(link).toBeVisible();const url=await link.getAttribute('href'),csv=await finance.request.get(url);expect(csv.status()).toBe(200);expect(await csv.text()).toContain('NOT_PAID');expect(await csv.text()).not.toContain('vault:');
  await card.getByRole('button',{name:'Suspend partner payable',exact:true}).click();await expect(card.getByRole('status')).toContainText('held');expect((await finance.request.get(url)).status()).toBe(409);
  for(const [page,kind] of [[client,'client'],[officer,'officer']]){expect((await page.request.get(endpoint)).status()).toBe(403);const own=await(await page.request.get('/api/production-operations?kind='+kind)).json();expect(own.partnerPayableAccess).toBe(false);expect(own.partnerPayableReviews).toEqual([]);expect(own.partnerPayableCandidates).toEqual([]);await page.goto('/'+kind+'/service');await expect(page.getByRole('heading',{name:'Partner company payables',exact:true})).toHaveCount(0);}
 }finally{await Promise.allSettled(contexts.map(c=>c.close()));}
});
