import {test,expect} from '@playwright/test';
import {clerk,clerkSetup,setupClerkTestingToken} from '@clerk/testing/playwright';
const emails=JSON.parse(process.env.LOKD_TEST_EMAILS);
test.beforeAll(async()=>{await clerkSetup({dotenv:false});});
async function login(page,role){await setupClerkTestingToken({page});await page.goto('/sign-in');await clerk.loaded({page});await clerk.signIn({page,signInParams:{strategy:'email_code',identifier:emails[role]}});}
for(const kind of ['officer','client'])test(`${kind}: real persisted signup, account link, Operations correction request and resubmission`,async({browser})=>{
 const applicantContext=await browser.newContext({viewport:{width:390,height:844}}),opsContext=await browser.newContext();
 try{
  const page=await applicantContext.newPage();page.setDefaultTimeout(10000);await login(page,'unassigned');
  const mobile=`0${String(Date.now()).slice(-9)}`;
  const data=kind==='officer'?{pathway:'qualified',fullName:'Synthetic Signup Officer',mobile,email:emails.unassigned,city:'Johannesburg',province:'Gauteng',psiraStatus:'active',psiraNumber:'1234567',psiraGrade:'Grade A',services:['Unarmed'],purposes:['Commercial access'],training:[],over18Confirmed:true,eligibilityAcknowledged:true,contactConsent:true}:{organisationName:'Synthetic Signup Client',contactName:'Test Contact',email:emails.unassigned,mobile,siteArea:'Midrand',siteType:'commercial_property',requiredStart:'planning',message:'Synthetic browser site enquiry for a controlled test.',advanceFundingAcknowledged:true,privacyConsent:true};
  const response=await page.request.post(`/api/${kind==='officer'?'applications':'enquiries'}`,{data});expect(response.status()).toBe(202);const id=(await response.json()).reference;expect(id).not.toBe('LOKD-RECEIVED');
  await page.goto(process.env.LOKD_ACCOUNT_TEST_STAGE==='production'?`/${kind}`:`/signup?kind=${kind}`);const card=page.locator('article').filter({hasText:id});
  await card.getByRole('button',{name:'Link to my account'}).click();await expect(card.getByText('Awaiting Operations review',{exact:true})).toBeVisible();
  expect((await page.request.get('/api/operations')).status()).toBe(process.env.LOKD_ACCOUNT_TEST_STAGE==='production'?423:403);
  const ops=await opsContext.newPage();ops.setDefaultTimeout(10000);await login(ops,'owner');await ops.goto(process.env.LOKD_ACCOUNT_TEST_STAGE==='production'?'/ops':'/ops/intake');
  if(kind==='client'){await expect(ops.getByText(`Signed in as ${emails.owner}`,{exact:true})).toBeVisible();await ops.getByRole('link',{name:'Client enquiries',exact:true}).click();await expect(ops.getByRole('link',{name:'Client enquiries',exact:true})).toHaveAttribute('aria-current','page');}
  const review=ops.locator('article').filter({hasText:id});await expect(review).toBeVisible();await review.getByLabel('Message visible to the applicant').fill('Please correct your location to Sandton for intake review.');await review.getByRole('button',{name:'Save intake review'}).click();await expect(review.getByText('Information needed',{exact:true})).toBeVisible();
  await page.reload();await expect(card.getByText('Information needed',{exact:true})).toBeVisible();await card.getByRole('button',{name:'Correct my details'}).click();
  await card.getByLabel(kind==='officer'?'City or town':'Site area',{exact:true}).fill('Sandton');await card.getByRole('button',{name:'Save and resubmit for review'}).click();await expect(card.getByText('Awaiting Operations review',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await ops.reload();if(kind==='client'){await expect(ops.getByText(`Signed in as ${emails.owner}`,{exact:true})).toBeVisible();await ops.getByRole('link',{name:'Client enquiries',exact:true}).click();await expect(ops.getByRole('link',{name:'Client enquiries',exact:true})).toHaveAttribute('aria-current','page');}await review.getByLabel('Review outcome').selectOption('reviewed');await review.getByLabel('Message visible to the applicant').fill('Intake reviewed. Verification and agreements still pending.');await review.getByRole('button',{name:'Save intake review'}).click();await expect(review.locator('strong').filter({hasText:'Intake reviewed · further checks pending'})).toBeVisible();
  await page.reload();await expect(card.getByText('Intake reviewed · further checks pending',{exact:true})).toBeVisible();
  if(kind==='officer'){
   await card.getByRole('link',{name:'Open my PSiRA verification'}).click();await expect(page.getByRole('heading',{name:'PSiRA verification',exact:true})).toBeVisible();await clerk.loaded({page});await page.getByRole('combobox',{name:'Registration pathway',exact:true}).selectOption('registered');await expect(page.getByRole('combobox',{name:'Registration pathway',exact:true})).toHaveValue('registered');await page.getByLabel('PSiRA number',{exact:true}).fill('1234567');await page.getByRole('button',{name:'Submit for review'}).click();await expect(page.getByRole('status')).toHaveText('Verification record saved.');
   const psira=await(await page.request.get('/api/psira?scope=officer')).json();expect(psira.cases[0].verified).toBe(false);
  }
 }finally{await applicantContext.close();await opsContext.close();}
});
