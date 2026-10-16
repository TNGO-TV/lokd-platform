import {test as base, expect} from '@playwright/test';

const origin = 'http://127.0.0.1:4173';
const applicationReference = 'APP-12345678-1234-4123-8123-123456789ABC';
const enquiryReference = 'ENQ-12345678-1234-4123-8123-123456789ABC';
const test = base.extend({
  intakeNetwork: [async ({context, page}, use, testInfo) => {
    const state = {applications: [], enquiries: [], blockedExternal: [], unexpectedApi: [], pageErrors: []};
    state.applicationResponse = {status: 202, json: {reference: applicationReference}};
    state.enquiryResponse = {status: 202, json: {reference: enquiryReference}};
    page.on('pageerror', error => state.pageErrors.push(error.message));
    await context.routeWebSocket('**/*', socket => socket.close());
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== origin) { state.blockedExternal.push(url.origin); await route.abort(); return; }
      if (url.pathname === '/api/presence' && request.method() === 'GET') {
        await route.fulfill({json: {areas: [], checkedAt: '2026-10-16T00:00:00.000Z'}}); return;
      }
      if (request.method() === 'POST' && url.pathname === '/api/applications') {
        state.applications.push(request.postDataJSON()); await route.fulfill(state.applicationResponse); return;
      }
      if (request.method() === 'POST' && url.pathname === '/api/enquiries') {
        state.enquiries.push(request.postDataJSON()); await route.fulfill(state.enquiryResponse); return;
      }
      if (url.pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(request.method())) {
        state.unexpectedApi.push(request.method() + ' ' + url.pathname); await route.abort(); return;
      }
      await route.continue();
    });
    await use(state);
    await testInfo.attach('offline-network-receipt', {contentType: 'application/json', body: Buffer.from(JSON.stringify({
      applicationPostsMocked: state.applications.length, enquiryPostsMocked: state.enquiries.length,
      blockedExternalOrigins: state.blockedExternal, unexpectedApi: state.unexpectedApi,
      pageErrors: state.pageErrors, databaseBindings: false, providerCalls: false,
    }, null, 2))});
    expect(state.unexpectedApi).toEqual([]);
    expect(state.pageErrors).toEqual([]);
  }, {auto: true}],
});

async function fitsViewport(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}

test('homepage offers real intake paths, responsive service navigation and privacy', async ({page}) => {
  await page.goto('/');
  await expect(page).toHaveTitle('LOKD Security | Guarding, Armed Security and VIP Protection');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://lokd.co.za/');
  await expect(page.getByRole('link', {name: /^Request security/})).toHaveAttribute('href', '/contact');
  await expect(page.getByRole('link', {name: /^Apply as an officer/})).toHaveAttribute('href', '/join');
  await expect(page.getByRole('link', {name: 'Client sign in', exact: true})).toHaveAttribute('href', 'https://portal.lokd.co.za');
  await expect(page.getByRole('link', {name: 'Officer sign in', exact: true})).toHaveAttribute('href', 'https://officers.lokd.co.za');
  await expect(page.getByText('An application does not guarantee work.', {exact: false})).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('No current consented officer presence to display.');
  await fitsViewport(page);
  const mobile = page.viewportSize().width < 1100;
  if (mobile) await page.getByText('Menu', {exact: true}).click();
  const navigation = page.getByRole('navigation', {name: mobile ? 'Mobile navigation' : 'Main navigation', exact: true});
  await expect(navigation).toBeVisible();
  await navigation.getByRole('link', {name: 'Armed security', exact: true}).click();
  await expect(page).toHaveURL(origin + '/armed-security');
  await expect(page.locator('h1')).toBeVisible();
  await page.locator('footer').getByRole('link', {name: 'Privacy notice', exact: true}).click();
  await expect(page).toHaveURL(origin + '/privacy');
  await expect(page.getByRole('heading', {name: 'Privacy notice.', exact: true})).toBeVisible();
  await fitsViewport(page);
});

async function applicantDetails(page, {training = false} = {}) {
  await page.getByRole('button', {name: /^Continue/}).click();
  await expect(page.getByRole('heading', {name: 'Tell us about yourself.'})).toBeVisible();
  await page.getByRole('button', {name: /^Continue/}).click();
  await expect(page.locator('input[name="fullName"]')).toBeFocused();
  await page.getByLabel(/^Full name/).fill('Offline Applicant');
  await page.getByLabel(/^Mobile number/).fill('123');
  await page.getByLabel(/^Email address/).fill('offline.applicant@example.test');
  await page.getByLabel(/^City or nearest town/).fill('Pretoria');
  if (!training) await page.getByLabel(/^PSiRA number/).fill('1234567');
  await page.getByRole('button', {name: /^Continue/}).click();
  await expect(page.getByRole('alert')).toContainText('Enter a South African mobile number');
  await page.getByLabel(/^Mobile number/).fill('082 123 4567');
  await page.getByRole('button', {name: /^Continue/}).click();
  await expect(page.getByRole('heading', {name: 'Choose your direction.'})).toBeVisible();
}

async function applicantConsents(page) {
  for (const name of ['over18Confirmed', 'eligibilityAcknowledged', 'contactConsent']) await page.locator(`input[name="${name}"]`).check();
}

test('officer application validates locally, preserves rejection and displays full UUID receipt', async ({page, intakeNetwork: offline}) => {
  await page.goto('/');
  await page.getByRole('link', {name: /^Apply as an officer/}).click();
  await expect(page).toHaveURL(origin + '/join');
  await applicantDetails(page);
  await page.getByRole('button', {name: /^Submit officer application/}).click();
  expect(offline.applications).toHaveLength(0);
  await expect(page.locator('input[name="over18Confirmed"]')).toBeFocused();
  await applicantConsents(page);
  offline.applicationResponse = {status: 422, json: {error: 'Offline validation rejection: review your application.'}};
  await page.getByRole('button', {name: /^Submit officer application/}).click();
  await expect(page.getByRole('alert')).toHaveText('Offline validation rejection: review your application.');
  expect(offline.applications).toHaveLength(1);
  expect(offline.applications[0]).toMatchObject({
    pathway: 'qualified', email: 'offline.applicant@example.test', mobile: '082 123 4567',
    over18Confirmed: true, eligibilityAcknowledged: true, contactConsent: true, psiraNumber: '1234567',
  });
  offline.applicationResponse = {status: 202, json: {reference: applicationReference}};
  await page.getByRole('button', {name: /^Submit officer application/}).click();
  await expect(page.getByRole('heading', {name: 'Your LOKD journey has started.'})).toBeFocused();
  await expect(page.locator('dd')).toHaveText(applicationReference);
  await expect(page.getByRole('link', {name: 'Track my application'})).toHaveAttribute('href', 'https://officers.lokd.co.za');
  await expect(page.getByText('Account linking does not grant work approval.', {exact: false})).toBeVisible();
  expect(offline.applications).toHaveLength(2);
  expect(offline.applications[1]).toEqual(offline.applications[0]);
  await fitsViewport(page);
});

test('training deep link requires training selection and keeps unregistered intake distinct', async ({page, intakeNetwork: offline}) => {
  await page.goto('/join?path=training');
  await expect(page.getByRole('button', {name: /I need training/})).toHaveClass(/selected/);
  await applicantDetails(page, {training: true});
  await applicantConsents(page);
  await page.getByRole('button', {name: /^Find my training pathway/}).click();
  await expect(page.getByRole('alert')).toHaveText('Choose at least one training area.');
  expect(offline.applications).toHaveLength(0);
  await page.getByLabel(/^Entry-level security training/).check();
  await page.getByRole('button', {name: /^Find my training pathway/}).click();
  await expect(page.locator('dd')).toHaveText(applicationReference);
  expect(offline.applications).toHaveLength(1);
  expect(offline.applications[0]).toMatchObject({pathway: 'training', psiraStatus: 'not_registered', psiraNumber: '', training: ['Entry-level security training']});
  await expect(page.getByText('Your training or registration-guidance intake will not be sent for a PSiRA registration lookup.', {exact: false})).toBeVisible();
  await fitsViewport(page);
});

test('security enquiry enforces fields and consent, shows server rejection and links its receipt', async ({page, intakeNetwork: offline}) => {
  await page.goto('/');
  await page.getByRole('link', {name: /^Request security/}).click();
  await expect(page).toHaveURL(origin + '/contact');
  const form = page.locator('form.enquiry-form');
  await form.getByRole('button', {name: /^Submit site enquiry/}).click();
  await expect(form.getByLabel('Organisation', {exact: true})).toBeFocused();
  expect(offline.enquiries).toHaveLength(0);
  await form.getByLabel('Organisation', {exact: true}).fill('Offline Example Organisation');
  await form.getByLabel('Contact name', {exact: true}).fill('Offline Contact');
  await form.getByLabel('Email', {exact: true}).fill('offline.contact@example.test');
  await form.getByLabel('Site area', {exact: true}).fill('Pretoria');
  await form.getByLabel('Site type', {exact: true}).selectOption('commercial_property');
  await form.getByLabel('Planning window', {exact: true}).selectOption('planning');
  await form.getByLabel('What must the post achieve?', {exact: true}).fill('Synthetic browser test for weekday entry and reception security.');
  await form.locator('input[name="advanceFundingAcknowledged"]').check();
  await expect(form.getByRole('link', {name: 'privacy notice', exact: true})).toHaveAttribute('href', '/privacy');
  await form.getByRole('button', {name: /^Submit site enquiry/}).click();
  await expect(form.locator('input[name="privacyConsent"]')).toBeFocused();
  expect(offline.enquiries).toHaveLength(0);
  await form.locator('input[name="privacyConsent"]').check();
  offline.enquiryResponse = {status: 422, json: {error: 'Offline validation rejection: review your enquiry.'}};
  await form.getByRole('button', {name: /^Submit site enquiry/}).click();
  await expect(page.getByRole('alert')).toHaveText('Offline validation rejection: review your enquiry.');
  await expect(form.getByLabel('Organisation', {exact: true})).toHaveValue('Offline Example Organisation');
  expect(offline.enquiries).toHaveLength(1);
  expect(offline.enquiries[0]).toMatchObject({privacyConsent: true, advanceFundingAcknowledged: true, serviceType: 'scheduled_unarmed_fixed_site', email: 'offline.contact@example.test'});
  offline.enquiryResponse = {status: 202, json: {reference: enquiryReference}};
  await form.getByRole('button', {name: /^Submit site enquiry/}).click();
  await expect(page.getByRole('heading', {name: 'We have your operating brief.'})).toBeFocused();
  await expect(page.locator('dd')).toHaveText(enquiryReference);
  await expect(page.getByRole('link', {name: /^Track my enquiry/})).toHaveAttribute('href', 'https://portal.lokd.co.za');
  await expect(page.getByText('Do not pay against this enquiry reference.', {exact: false})).toBeVisible();
  expect(offline.enquiries).toHaveLength(2);
  expect(offline.enquiries[1]).toEqual(offline.enquiries[0]);
  await fitsViewport(page);
});
