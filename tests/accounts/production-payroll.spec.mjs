import {test,expect} from '@playwright/test';
import {clerk,clerkSetup,setupClerkTestingToken} from '@clerk/testing/playwright';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
const emails=JSON.parse(process.env.LOKD_TEST_EMAILS),userIds=JSON.parse(process.env.LOKD_TEST_USER_IDS??'{}');
test.beforeAll(async()=>clerkSetup({dotenv:false}));
async function login(page,role){await setupClerkTestingToken({page});await page.goto('/sign-in');await clerk.loaded({page});await clerk.signIn({page,signInParams:{strategy:'email_code',identifier:emails[role]}});}
test('period payroll browser journey separates preparation review finance and officer access',async({browser})=>{
 test.skip(!process.env.LOKD_PAYROLL_BROWSER_DATABASE||!emails.finance,'Requires the disposable payroll fixture and separate finance identity.');test.setTimeout(180000);
 const path=process.env.LOKD_PAYROLL_BROWSER_DATABASE;expect(path).toContain('/.wrangler/state/v3/d1/');
 const database=new DatabaseSync(path);
 // Relabel only the disposable fixture before starting the journey. Restore the exact
 // identity trigger in the same transaction; all application requests retain it.
 try{
  database.exec('BEGIN IMMEDIATE');
  const guard=database.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND name='production_link_no_update'").get();expect(guard?.sql).toBeTruthy();
  database.exec('DROP TRIGGER production_link_no_update');
  for(const [original,role] of [['period-maker@example.test','operations'],['period-owner@example.test','owner'],['period-finance@example.test','finance']])database.prepare('UPDATE operator_accounts SET email=? WHERE email=?').run(emails[role],original);
  for(const [old,role] of [['period-officer','officer'],['period-client','client']])database.prepare('UPDATE production_entity_links SET owner_user_id=? WHERE owner_user_id=?').run(userIds[role],old);
  database.exec(guard.sql);database.exec('COMMIT');
 }catch(error){database.exec('ROLLBACK');throw error;}finally{database.close();}

 const contexts=await Promise.all(Array.from({length:4},()=>browser.newContext()));
 try{
  const [maker,reviewer,finance,officer]=await Promise.all(contexts.map(c=>c.newPage()));await login(maker,'operations');await login(reviewer,'owner');await login(finance,'finance');await login(officer,'officer');
  const endpoint='/api/production-operations?kind=client&scope=operations',initial=await(await maker.request.get(endpoint)).json(),candidate=initial.payrollCandidates[0];expect(candidate).toBeTruthy();
  await maker.goto('/ops/service');await maker.getByText('Calculate a complete payroll period',{exact:true}).click();await maker.getByLabel('Payroll employer',{exact:true}).selectOption(candidate.employer_id);await maker.getByLabel('Pay period starts',{exact:true}).fill(candidate.service_date);await maker.getByLabel('Pay period ends',{exact:true}).fill(candidate.service_date);await maker.getByLabel('Pay date',{exact:true}).fill(candidate.service_date);await maker.getByLabel('Approved payroll policy',{exact:true}).selectOption(initial.payrollPolicies.find(p=>p.status==='active').id);await maker.getByLabel('Projected annual employer payroll (ZAR cents)',{exact:true}).fill('100000000');
  for(const [label,value] of [['Age at tax-year end','30'],['Medical scheme members','0'],['Deductible retirement contributions (cents)','0'],['Employee health deductions (cents)','0'],['Other lawful deductions (cents)','0'],['Contracted monthly basic remuneration (cents)','2000000']])await maker.getByLabel(candidate.officer_id+' '+label,{exact:true}).fill(value);
  await maker.getByLabel(candidate.officer_id+' Wage area',{exact:true}).selectOption('areas_one_and_two');await maker.getByLabel('Payroll input source reference',{exact:true}).fill('Isolated browser payroll facts');await maker.getByLabel('I reviewed the lawful basis for these deductions and allowances.').check();await maker.getByLabel('All service and payroll inputs for this complete employer pay period have been reviewed.').check();await maker.getByRole('button',{name:'Calculate payroll period',exact:true}).click();await expect(maker.getByRole('button',{name:'Record first payroll approval',exact:true})).toBeVisible();
  const state=await(await maker.request.get(endpoint)).json(),run=state.payrollRuns[0];expect(run.status).toBe('calculated');expect((await maker.request.post(endpoint,{data:{action:'first_approve_payroll',runId:run.id,version:run.version,calculationHash:run.payload_hash,note:'Maker cannot self approve.',calculationReviewed:true}})).status()).toBe(403);
  for(const [page,button] of [[reviewer,'Record first payroll approval'],[finance,'Record independent finance approval'],[maker,'Create controlled payroll export']]){
   await page.goto('/ops/service');const card=page.getByRole('heading',{name:run.id,exact:true}).locator('..');await card.getByText('Review frozen payroll inputs and service evidence',{exact:true}).click();await expect(card.getByText('Reviewed service records',{exact:true})).toBeVisible();await expect(card.getByText(/120 payable minutes, gross R800.00/)).toBeVisible();await card.getByLabel('Payroll decision findings',{exact:true}).fill('Independent browser payroll fixture review.');await card.getByLabel('I reviewed the period, source evidence and complete calculation.').check();await card.getByRole('button',{name:button,exact:true}).click();await expect(card.getByRole('button',{name:button,exact:true})).toHaveCount(0);
  }
  const downloadPromise=maker.waitForEvent('download');await maker.getByRole('link',{name:'Download approved calculation CSV',exact:true}).click();const download=await downloadPromise;expect(download.suggestedFilename()).toBe('lokd-payroll.csv');const csv=await readFile(await download.path(),'utf8');expect(csv).toContain('NOT_RELEASED');expect(csv).toContain('80000');expect(csv).not.toContain('vault:fixture');
  await officer.goto('/officer/service');await expect(officer.getByRole('heading',{name:'Payroll periods',exact:true})).toBeVisible();await officer.getByText('Payroll calculation breakdown',{exact:true}).click();await expect(officer.getByText('Payment has not been released. This calculation is not a payment receipt.',{exact:true})).toBeVisible();expect((await officer.request.get(endpoint)).status()).toBe(403);
 }finally{await Promise.allSettled(contexts.map(c=>c.close()));}
});
