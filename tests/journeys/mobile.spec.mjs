import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
});
async function start(page, path = '') {
  await page.goto(`/join${path}`);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Tell us about yourself.' })).toBeFocused();
}
async function details(page) {
  await page.locator('[name=fullName]').fill('Synthetic Test Officer');
  await page.locator('[name=mobile]').fill('0821234567');
  await page.locator('[name=email]').fill('officer@example.test');
  await page.locator('[name=city]').fill('Johannesburg');
}
async function consents(page) {
  for (const name of ['over18Confirmed', 'eligibilityAcknowledged', 'contactConsent']) await page.locator(`[name=${name}]`).check();
}
async function fits(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
}
test('registered officer: early validation, Enter advances, pending evidence and recoverable submission', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/applications', async route => {
    calls++;
    const data = route.request().postDataJSON();
    expect(data.psiraNumber).toBe('1234567');
    await route.fulfill({ status: calls === 1 ? 503 : 200, json: calls === 1 ? {error: 'Temporarily unavailable. Please try again.'} : {reference:'APP-TEST-MOBILE'} });
  });
  await start(page); await details(page);
  await page.locator('[name=psiraNumber]').fill('1234567');
  await page.locator('[name=mobile]').fill('123');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('alert')).toContainText('South African');
  expect(calls).toBe(0);
  await page.locator('[name=mobile]').fill('0821234567');
  await page.locator('[name=email]').fill('officer@example');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('alert')).toContainText('complete email');
  await page.locator('[name=email]').fill('officer@example.test');
  await page.locator('[name=email]').press('Enter');
  await expect(page.getByRole('heading', { name: 'Choose your direction.' })).toBeFocused();
  expect(calls).toBe(0); await fits(page); await consents(page);
  await page.getByRole('button', {name:'Submit officer application'}).click();
  await expect(page.getByRole('alert')).toContainText('Temporarily unavailable');
  await page.getByRole('button', {name:'Submit officer application'}).click();
  await expect(page.getByRole('heading', {name:'Your LOKD journey has started.'})).toBeFocused();
  await expect(page.getByText('Verification pending', {exact:true})).toBeVisible();
  await expect(page.getByText(/separately confirm it belongs to you/)).toBeVisible();
  await expect(page.getByText(/link this application/)).toBeVisible(); await fits(page);
});
for (const path of ['training','not_registered']) test(`${path}: no registration lookup requirement or rejection`, async ({page}) => {
  await page.route('**/api/applications', route => route.fulfill({json:{reference:'APP-TEST-EXEMPT'}}));
  await start(page, path === 'training' ? '?path=training' : ''); await details(page);
  if (path === 'not_registered') await page.locator('[name=psiraStatus]').selectOption('not_registered');
  await expect(page.locator('[name=psiraNumber]')).toHaveCount(0);
  await page.getByRole('button', {name:'Continue'}).click();
  if (path === 'training') await page.getByLabel('Entry-level security training').check();
  await consents(page); await page.getByRole('button', {name: path === 'training' ? 'Find my training pathway' : 'Submit officer application'}).click();
  await expect(page.getByText(path === 'training' ? 'Training interest recorded' : 'Registration guidance requested', {exact:true})).toBeVisible();
  await expect(page.getByText(/This intake does not require a PSiRA lookup/)).toBeVisible(); await fits(page);
});
test('client: failed submission preserves details; receipt explains account, agreement and funding gates', async ({page}) => {
  let calls=0;
  await page.route('**/api/enquiries', route => { calls++; return route.fulfill({status:calls===1?503:200,json:calls===1?{error:'Please try again shortly.'}:{reference:'ENQ-TEST-MOBILE'}}); });
  await page.goto('/contact');
  for (const [name,value] of Object.entries({organisationName:'Synthetic Test Client',contactName:'Synthetic Contact',email:'client@example.test',siteArea:'Midrand',message:'Synthetic mobile acceptance test of access control.'})) await page.locator(`[name=${name}]`).fill(value);
  await page.locator('[name=siteType]').selectOption('commercial_property');
  await page.locator('[name=requiredStart]').selectOption('planning');
  for (const name of ['advanceFundingAcknowledged','privacyConsent']) await page.locator(`[name=${name}]`).check();
  await fits(page); await page.getByRole('button',{name:'Submit site enquiry'}).click();
  await expect(page.getByRole('alert')).toContainText('try again');
  await expect(page.locator('[name=organisationName]')).toHaveValue('Synthetic Test Client');
  await page.getByRole('button',{name:'Submit site enquiry'}).click();
  await expect(page.getByRole('heading',{name:'We have your operating brief.'})).toBeFocused();
  await expect(page.getByText(/link this enquiry/)).toBeVisible();
  await expect(page.getByText(/Submitting this form signs no service agreement/)).toBeVisible();
  await expect(page.getByText(/Do not pay against this enquiry reference/)).toBeVisible(); await fits(page);
  await page.getByRole('link',{name:'Read the client guide'}).click();
  await expect(page).toHaveURL(/\/clients$/);
});
