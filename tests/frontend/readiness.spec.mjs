import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {readinessFixtures} from './preview-data';
const query='?applicantId=APP-PREVIEW&officerId=OFF-PREVIEW&identityId=ID-PREVIEW';
let data,calls;
test.beforeEach(async({page})=>{
 data=structuredClone(readinessFixtures);calls=[];
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.route('**/api/production-identity*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(req.method()==='POST'){const body=req.postDataJSON();calls.push(body);if(body.action==='set_opt_in'){data.readiness.optins=[{serviceType:body.serviceType,optedIn:body.optedIn?1:0,revision:body.expectedRevision+1}];}return route.fulfill({json:{id:'SYNTHETIC-SAVED',workEligible:false,restoresApproval:false}});}
  return route.fulfill({json:data[url.searchParams.get('kind')]});
 });
});
async function open(page,role='ops'){await page.goto('/'+role+'/readiness'+query);await expect(page.getByText('Application version 3 ·',{exact:false})).toBeVisible();}
async function screenshot(page,name,info){await mkdir('test-results/frontend/screenshots',{recursive:true});await page.screenshot({path:`test-results/frontend/screenshots/${info.project.name}-${name}.png`,fullPage:false});}
test('Operations reads explicit readiness, hold limits and guarded private delivery',async({page},info)=>{
 await open(page);await expect(page.getByRole('navigation',{name:'Operations navigation'}).getByRole('link',{name:'Identity & readiness'})).toHaveAttribute('aria-current','page');
 await expect(page.getByText('Manual provider review needed',{exact:true})).toBeVisible();await expect(page.getByText('Workforce engagement held',{exact:true})).toBeVisible();
 await page.getByText('Hold reference and audit limits',{exact:true}).first().click();await expect(page.getByText(/summary does not include the full audit/).first()).toBeVisible();
 await expect(page.locator('summary').filter({hasText:/^Prepare private passport$/})).toBeVisible();
 await expect(page.getByRole('button',{name:'Request private passport delivery',exact:true})).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await screenshot(page,'readiness-operations',info);
});
test('Officer changes only own service choice with the saved revision',async({page},info)=>{
 await open(page,'officer');await expect(page.getByText('Record identity review',{exact:true})).toHaveCount(0);await expect(page.getByText('Record an independent disposition',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Withdraw Unarmed opt-in'}).click();await expect(page.getByRole('button',{name:'Opt in to Unarmed'})).toBeVisible();
 expect(calls).toEqual([{action:'set_opt_in',officerId:'OFF-PREVIEW',serviceType:'Unarmed',expectedRevision:2,optedIn:false}]);
 await screenshot(page,'readiness-officer',info);
});
test('failed refresh and uncertain write preserve correction draft without automatic resubmission',async({page},info)=>{
 await open(page);await page.getByText('Request corrected information',{exact:true}).click();const draft=page.getByLabel('Message visible to the applicant',{exact:true});await draft.fill('Please retain this exact correction message.');
 await page.route('**/api/production-identity*',r=>r.fulfill({status:503,json:{error:'Synthetic provider unavailable.'}}));
 await page.getByRole('button',{name:'Save correction request',exact:true}).click();await expect(page.getByText(/must not be repeated from this draft/)).toBeVisible();await expect(draft).toHaveValue('Please retain this exact correction message.');
 await page.getByRole('button',{name:'Refresh saved status',exact:true}).click();await expect(page.getByText(/Any status still shown/)).toBeVisible();await expect(draft).toHaveValue('Please retain this exact correction message.');await expect(page.getByRole('button',{name:'Save correction request',exact:true})).toBeDisabled();
 await screenshot(page,'readiness-draft-retained',info);
});
test('changed source requires deliberate re-review without losing notes',async({page})=>{
 await open(page);await page.getByText('Record identity review',{exact:true}).click();const form=page.locator('details').filter({has:page.getByText('Record identity review',{exact:true})});
 await form.getByLabel('Decision',{exact:true}).selectOption('approve');await form.getByLabel('Review findings',{exact:true}).fill('Independent saved notes.');await form.getByRole('checkbox').check();
 data.identity.outcomeId='NEW-OUTCOME';await page.getByRole('button',{name:'Refresh saved status',exact:true}).click();await expect(page.getByText(/The saved source changed/)).toBeVisible();await expect(form.getByLabel('Review findings',{exact:true})).toHaveValue('Independent saved notes.');await expect(form.getByRole('button',{name:'Record identity decision'})).toBeDisabled();
 await form.getByRole('button',{name:'Keep notes and review refreshed record'}).click();await expect(form.getByRole('checkbox')).not.toBeChecked();expect(calls).toHaveLength(0);
});
test('switching records requires explicit draft discard',async({page})=>{
 await open(page);await page.getByText('Request corrected information',{exact:true}).click();await page.getByLabel('Message visible to the applicant',{exact:true}).fill('Unsent message');await page.getByLabel('Application reference',{exact:true}).fill('ANOTHER-APP');await page.getByRole('button',{name:'Open records',exact:true}).click();await expect(page.getByText(/Opening different records would discard/)).toBeVisible();await page.getByRole('button',{name:'Keep editing',exact:true}).click();await expect(page.getByLabel('Message visible to the applicant',{exact:true})).toHaveValue('Unsent message');expect(calls).toHaveLength(0);
});
test('private passport metadata never exposes a returned credential or fabricates delivery',async({page})=>{
 data.readiness.passport={id:'PASSPORT-PREVIEW',sequence:2,expiresAt:new Date(Date.now()-1000).toISOString(),token:'SECRET-NOT-FOR-DOM',token_hash:'HASH-NOT-FOR-DOM'};
 await open(page,'officer');await expect(page.getByText('Expired passport record · version 2',{exact:true})).toBeVisible();await expect(page.getByText('SECRET-NOT-FOR-DOM')).toHaveCount(0);await expect(page.getByText('HASH-NOT-FOR-DOM')).toHaveCount(0);expect(await page.locator('a[href*="token"]').count()).toBe(0);expect(calls).toHaveLength(0);
});
test('owner decision controls are absent for ordinary Operations',async({page})=>{
 await page.goto('/ops/readiness'+query+'&owner=false');await expect(page.getByText('Application version 3 ·',{exact:false})).toBeVisible();await expect(page.getByText('Record an independent disposition',{exact:true})).toHaveCount(0);await expect(page.getByText('Decide officer review',{exact:true})).toHaveCount(0);
});

test('keyboard navigation keeps drafts when leaving is cancelled',async({page})=>{
 await open(page);const summary=page.getByText('Request corrected information',{exact:true});await summary.focus();await page.keyboard.press('Enter');const draft=page.getByLabel('Message visible to the applicant',{exact:true});await draft.fill('Keyboard review draft');
 page.once('dialog',dialog=>dialog.dismiss());const link=page.getByRole('navigation',{name:'Operations navigation'}).getByRole('link',{name:'Agreements',exact:true});await link.focus();await page.keyboard.press('Enter');await expect(draft).toHaveValue('Keyboard review draft');await expect(page).toHaveURL(/readiness/);
});

test('section links track direct hashes and browser back',async({page})=>{
 await page.goto('/ops/readiness'+query+'#passport');const nav=page.getByRole('navigation',{name:'Readiness sections'});await expect(nav.getByRole('link',{name:'Private passport',exact:true})).toHaveAttribute('aria-current','location');await nav.getByRole('link',{name:'Corrections & holds',exact:true}).click();await expect(nav.getByRole('link',{name:'Corrections & holds',exact:true})).toHaveAttribute('aria-current','location');await page.goBack();await expect(nav.getByRole('link',{name:'Private passport',exact:true})).toHaveAttribute('aria-current','location');
});
