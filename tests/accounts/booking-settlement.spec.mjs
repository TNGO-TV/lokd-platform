import {test,expect} from '@playwright/test';
import {clerk,clerkSetup,setupClerkTestingToken} from '@clerk/testing/playwright';
const emails=JSON.parse(process.env.LOKD_TEST_EMAILS);
test.use({actionTimeout:15000});
test.beforeAll(async()=>clerkSetup({dotenv:false}));
async function login(page,role){await setupClerkTestingToken({page});await page.goto('/sign-in');await clerk.loaded({page});await clerk.signIn({page,signInParams:{strategy:'email_code',identifier:emails[role]}});}
test('collection settlement browser separates maker reviewer client and officer and retains recovery holds',async({browser})=>{
 test.skip(process.env.LOKD_ACCOUNT_TEST_COLLECTIONS!=='true','Requires isolated collection fixture.');test.setTimeout(180000);
 const contexts=await Promise.all(Array.from({length:4},()=>browser.newContext()));
 try{
  const [maker,reviewer,client,officer]=await Promise.all(contexts.map(c=>c.newPage()));
  await login(maker,'operations');await login(reviewer,'owner');await login(client,'client');await login(officer,'officer');
  const endpoint='/api/production-operations?kind=client&scope=operations';
  await maker.goto('/ops/service');await expect(maker.getByRole('heading',{name:'Settlement and payment recovery',exact:true})).toBeVisible();
  const state=await(await maker.request.get(endpoint)).json(),review=state.settlementReviews.find(s=>!s.decision);expect(review).toBeTruthy();
  const card=maker.getByRole('heading',{name:'Settlement 901',exact:true}).locator('..');await card.getByText('Review settlement, fees and bank evidence',{exact:true}).click();await expect(card.getByText(/Isolated bank receipt fixture/)).toBeVisible();
  const self=await maker.request.post(endpoint,{data:{action:'approve_settlement',reference:review.reference,reviewId:review.id,payloadHash:review.payload_hash,note:'Self approval must fail.',evidenceReviewed:true}});expect(self.status()).toBe(403);
  await reviewer.goto('/ops/service');const approval=reviewer.getByRole('heading',{name:'Settlement 901',exact:true}).locator('..');await approval.getByText('Review settlement, fees and bank evidence',{exact:true}).click();await expect(approval.getByText(/transactionFeeMinor/)).toBeVisible();await approval.getByLabel('Independent settlement findings',{exact:true}).fill('Independent browser review of fixture bank receipt, fees and exact booking transaction.');await approval.getByLabel('I independently checked the exact bank receipt, provider settlement, fees and booking transaction.').check();await approval.getByRole('button',{name:'Confirm test settlement',exact:true}).click();await expect(approval.getByText(/confirmed test/)).toBeVisible();
  await client.goto('/client/service');await expect(client.getByRole('heading',{name:'Settlement 901',exact:true})).toBeVisible();await expect(client.getByText('Test evidence only. No booking funds or money were released.',{exact:true})).toBeVisible();await expect(client.getByText('Review settlement, fees and bank evidence',{exact:true})).toHaveCount(0);
  expect((await client.request.get(endpoint)).status()).toBe(403);expect((await officer.request.get(endpoint)).status()).toBe(403);
  const officerState=await(await officer.request.get('/api/production-operations?kind=officer')).json();expect(officerState.collections).toHaveLength(0);expect(officerState.settlementReviews).toHaveLength(0);
  await reviewer.getByText('Hold a collection for investigation',{exact:true}).click();await reviewer.getByLabel('Collection to hold',{exact:true}).selectOption(review.reference);await reviewer.getByLabel('Refund, dispute or settlement investigation findings',{exact:true}).fill('Isolated browser dispute requires investigation. No refund dispatch.');await reviewer.getByRole('button',{name:'Place funding on hold',exact:true}).click();await expect(reviewer.getByText(/Funding held:/)).toBeVisible();
  await client.getByRole('button',{name:'Refresh production records',exact:true}).click();await expect(client.getByText(/Funding held:/)).toBeVisible();
  const final=await(await reviewer.request.get(endpoint)).json();expect(final.serviceOrders[0].funding_status).toBe('unfunded');expect(final.collectionRecoveries).toHaveLength(1);
 }finally{await Promise.allSettled(contexts.map(c=>c.close()));}
});
