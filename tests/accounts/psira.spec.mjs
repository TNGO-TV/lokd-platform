import { test, expect } from '@playwright/test';
import { clerk, clerkSetup, setupClerkTestingToken } from '@clerk/testing/playwright';
const emails=JSON.parse(process.env.LOKD_TEST_EMAILS);
test.beforeAll(async()=>{await clerkSetup({dotenv:false});});
async function signIn(page,role){await setupClerkTestingToken({page});await page.goto('/sign-in');await clerk.loaded({page});await clerk.signIn({page,signInParams:{strategy:'email_code',identifier:emails[role]}});}
test('PSiRA officer submission, Operations evidence and fresh-check reset stay separate from identity approval',async({browser})=>{
 const officerContext=await browser.newContext();const opsContext=await browser.newContext();
 try{
  const officer=await officerContext.newPage();await signIn(officer,'officer');await officer.goto('/officer/psira');
  await officer.getByRole('combobox',{name:'Registration pathway',exact:true}).selectOption('registered');
  await officer.getByLabel('PSiRA number',{exact:true}).fill('1234567');await officer.getByRole('button',{name:'Submit for review'}).click();
  await expect(officer.getByRole('status')).toHaveText('Verification record saved.');
  let record=(await (await officer.request.get('/api/psira?scope=officer')).json()).cases[0];expect(record.verified).toBe(false);
  const ops=await opsContext.newPage();await signIn(ops,'operations');await ops.goto('/ops/psira');
  const card=ops.locator('section').filter({hasText:emails.officer});
  await card.getByText('Record an Operations review',{exact:true}).click();
  await card.getByLabel('Registration outcome').selectOption('registered');
  await card.getByLabel('Source check time (your local time)').fill(new Date().toISOString().slice(0,16));
  await card.getByLabel('Returned PSiRA number').fill('1234567');await card.getByLabel('Returned name').fill('Synthetic Browser Officer');
  await card.getByLabel('Exact registration status').fill('Registered');await card.getByLabel('Grade',{exact:true}).fill('A');
  await card.getByLabel('Dated result excerpt or failure description').fill('Synthetic browser test only. Registered fixture, no real PSiRA lookup.');
  await card.getByLabel('Recheck by (within 30 days of source check)').fill(new Date(Date.now()+86400000).toISOString().slice(0,16));
  await card.getByRole('button',{name:'Save dated review'}).click();await expect(ops.getByRole('status')).toHaveText('Verification record saved.');
  await officer.reload();record=(await(await officer.request.get('/api/psira?scope=officer')).json()).cases[0];expect(record.events[0].registration_status).toBe('registered');expect(record.verified).toBe(false);expect(record.events[0].identity_match).toBe('unchecked');
  await officer.getByRole('button',{name:'Request a fresh check'}).click();await expect(officer.getByRole('status')).toHaveText('Verification record saved.');
  record=(await(await officer.request.get('/api/psira?scope=officer')).json()).cases[0];expect(record.events[0].registration_status).toBe('pending_review');expect(record.events).toHaveLength(3);expect(record.verified).toBe(false);
 }finally{await officerContext.close();await opsContext.close();}
});

test('training and unregistered applicants are not sent to registration review; a later registered declaration is mandatory',async({page})=>{
 await signIn(page,'other' in emails?'other':'unassigned');
 // The unassigned role must remain blocked even for a training declaration.
 await page.goto('/officer/psira');await expect(page.getByRole('heading',{name:/access is not assigned/})).toBeVisible();
 await clerk.signOut({page});await signIn(page,'officer');await page.goto('/officer/psira');
 for(const declaration of ['training','not_registered']){
  await page.getByRole('combobox',{name:'Registration pathway',exact:true}).selectOption(declaration);
  await expect(page.getByLabel('PSiRA number',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Submit for review'}).click();await expect(page.getByRole('status')).toHaveText('Verification record saved.');
  const record=(await(await page.request.get('/api/psira?scope=officer')).json()).cases[0];expect(record.events[0].registration_status).toBe('not_required');expect(record.verified).toBe(false);
  await expect(page.getByRole('button',{name:'Request a fresh check'})).toHaveCount(0);
 }
 await page.getByRole('combobox',{name:'Registration pathway',exact:true}).selectOption('registered');await page.getByLabel('PSiRA number',{exact:true}).fill('1234567');
 await page.getByRole('button',{name:'Submit for review'}).click();await expect(page.getByRole('status')).toHaveText('Verification record saved.');
 const record=(await(await page.request.get('/api/psira?scope=officer')).json()).cases[0];expect(record.events[0].registration_status).toBe('pending_review');expect(record.verified).toBe(false);
});
