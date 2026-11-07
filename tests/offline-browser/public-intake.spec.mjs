import {test as base, expect} from '@playwright/test';

const origin = 'http://127.0.0.1:4173';
const applicationReference = 'APP-12345678-1234-4123-8123-123456789ABC';
const enquiryReference = 'ENQ-12345678-1234-4123-8123-123456789ABC';
const test = base.extend({
  intakeNetwork: [async ({context, page}, use, testInfo) => {
    const state = {applications: [], enquiries: [], blockedExternal: [], unexpectedApi: [], pageErrors: []};
    state.applicationResponse = {status: 202, json: {saved:true,reference: applicationReference}};
    state.enquiryResponse = {status: 202, json: {saved:true,reference: enquiryReference}};
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

// Labels wrap their controls, so a select's accessible name also carries its
// chosen option and a filled input its value: match on the label prefix.
const label = text => new RegExp('^' + text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

async function fitsViewport(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}

async function readableContrast(locator) {
  const contrast = await locator.evaluate(element => {
    const colour = value => {
      const channels = value.match(/[\d.]+/g).map(Number);
      const scale = value.startsWith('color(srgb') ? 1 : 255;
      return [...channels.slice(0, 3).map(channel => channel / scale), channels[3] ?? 1];
    };
    const blend = (foreground, background) => foreground.slice(0, 3).map((channel, index) => channel * foreground[3] + background[index] * (1 - foreground[3]));
    const ancestors = [];
    for (let node = element; node; node = node.parentElement) ancestors.unshift(node);
    const background = ancestors.reduce((paint, node) => blend(colour(getComputedStyle(node).backgroundColor), paint), [1, 1, 1]);
    const foreground = blend(colour(getComputedStyle(element).color), background);
    const luminance = paint => paint.map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4)
      .reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0);
    const light = Math.max(luminance(foreground), luminance(background));
    const dark = Math.min(luminance(foreground), luminance(background));
    return (light + .05) / (dark + .05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
}

test('homepage offers real intake paths, responsive service navigation and privacy', async ({page}) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Security on your terms | LOKD');
  // Vinext may serialize an origin-only canonical without its implicit slash.
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /^https:\/\/lokd\.co\.za\/?$/);
  const main = page.locator('main');
  await expect(main.getByRole('heading', {level: 1})).toHaveText('Book officers.On your terms.');
  await expect(main.getByRole('link', {name: 'Book officers', exact: true}).first()).toHaveAttribute('href', '/book');
  await expect(main.getByRole('link', {name: /^PSIRA Registered or renewal/})).toHaveAttribute('href', '/officers');
  await expect(main.getByRole('heading', {name: 'LOKD Bolt', exact: true})).toBeVisible();
  await expect(main.getByRole('heading', {name: 'LOKD Flex', exact: true})).toBeVisible();
  await expect(main.getByRole('heading', {name: 'LOKD Fixed', exact: true})).toBeVisible();
  await readableContrast(main.locator('.home-pillars small').first());
  await readableContrast(main.locator('.site-section-head > p').first());
  const footer = page.locator('footer');
  await expect(footer.getByRole('link', {name: 'Client Zone', exact: true})).toHaveAttribute('href', '/sign-in?return_to=%2Fclient');
  await expect(footer.getByRole('link', {name: 'Officer Zone', exact: true})).toHaveAttribute('href', '/sign-in?return_to=%2Fofficer');
  await expect(footer.getByRole('link', {name: 'Training', exact: true})).toHaveAttribute('href', '/training');
  await fitsViewport(page);
  const header = page.locator('header');
  const mobile = page.viewportSize().width < 900;
  if (mobile) {
    await expect(page.getByRole('navigation', {name: 'Main navigation', exact: true})).toBeHidden();
    await header.getByText('Menu', {exact: true}).click();
  } else {
    await expect(header.getByRole('link', {name: 'Book officers', exact: true})).toHaveAttribute('href', '/book');
    await expect(header.getByRole('link', {name: 'Zone', exact: true})).toHaveAttribute('href', '/sign-in');
    await expect(header.getByText('Menu', {exact: true})).toBeHidden();
  }
  const navigation = page.getByRole('navigation', {name: mobile ? 'Mobile navigation' : 'Main navigation', exact: true});
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole('link', {name: 'Book', exact: true})).toHaveAttribute('href', '/book');
  if (mobile) await expect(navigation.getByRole('link', {name: 'Zone', exact: true})).toHaveAttribute('href', '/sign-in');
  await navigation.getByRole('link', {name: 'Security services', exact: true}).click();
  await expect(page).toHaveURL(origin + '/security-services');
  await expect(page.locator('h1')).toBeVisible();
  await fitsViewport(page);
  await page.locator('footer').getByRole('link', {name: 'Privacy', exact: true}).click();
  await expect(page).toHaveURL(origin + '/privacy');
  await expect(page.getByRole('heading', {level: 1, name: 'Privacy notice', exact: true})).toBeVisible();
  await fitsViewport(page);
});

async function applicantDetails(page, {training = false} = {}) {
  const submit = page.getByRole('button', {name: 'Submit application', exact: true});
  await submit.click();
  await expect(page.locator('input[name="fullName"]')).toBeFocused();
  await page.getByLabel(label('Full name')).fill('Offline Applicant');
  await page.getByLabel(label('Mobile number')).fill('123');
  await page.getByLabel(label('Email address')).fill('offline.applicant@example.test');
  await page.getByLabel(label('City or town')).fill('Pretoria');
  if (training) await expect(page.locator('input[name="psiraNumber"]')).toHaveCount(0);
  else {
    await page.getByLabel(label('PSIRA number')).fill('1234567');
    await page.getByLabel(label('Highest grade')).selectOption('Grade C');
    await page.getByLabel('Weekdays', {exact:true}).check();
  }
  await submit.click();
  await expect(page.locator('input[name="over18Confirmed"]')).toBeFocused();
  for (const name of ['over18Confirmed', 'eligibilityAcknowledged', 'contactConsent']) await page.locator(`input[name="${name}"]`).check();
  await submit.click();
  await expect(page.getByRole('alert')).toHaveText('Enter a South African mobile number, starting with 0 or +27.');
  await page.getByLabel(label('Mobile number')).fill('082 123 4567');
  await submit.click();
  await expect(page.getByRole('alert')).toHaveText('Choose at least one work interest and one work environment.');
  await page.locator('input[name="services"][value="Unarmed"]').check();
  await page.locator('input[name="purposes"][value="Retail"]').check();
}

test('officer application validates locally, preserves rejection and displays full UUID receipt', async ({page, intakeNetwork: offline}) => {
  await page.goto('/join');
  await expect(page).toHaveURL(origin + '/join');
  await expect(page).toHaveTitle('Apply as a security officer | LOKD');
  await expect(page.getByRole('heading', {level: 1})).toHaveText('Apply as an officer.');
  await expect(page.getByLabel(label('Application pathway'))).toHaveValue('qualified');
  const submit = page.getByRole('button', {name: 'Submit application', exact: true});
  await applicantDetails(page);
  expect(offline.applications).toHaveLength(0);
  await expect(page.locator('form').getByRole('link', {name: 'privacy notice', exact: true})).toHaveAttribute('href', '/privacy');
  offline.applicationResponse = {status: 422, json: {error: 'Offline validation rejection: review your application.'}};
  await submit.click();
  await expect(page.getByRole('alert')).toHaveText('Offline validation rejection: review your application.');
  await expect(page.getByLabel(label('Full name'))).toHaveValue('Offline Applicant');
  await expect(page.getByLabel(label('Full name'))).toBeEnabled();
  expect(offline.applications).toHaveLength(1);
  expect(offline.applications[0]).toMatchObject({
    pathway: 'qualified', email: 'offline.applicant@example.test', mobile: '082 123 4567', city: 'Pretoria', province: 'Gauteng',
    psiraStatus: 'active', psiraNumber: '1234567', services: ['Unarmed'], purposes: ['Retail'], training: [],
    over18Confirmed: true, eligibilityAcknowledged: true, contactConsent: true, company: '',
  });
  expect(offline.applications[0].requestKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  offline.applicationResponse = {status: 202, json: {received: true}};
  await submit.click();
  await expect(page.getByRole('heading', {name: 'Your application is with LOKD.'})).toHaveCount(0);
  await expect(page.locator('input[name="contactConsent"]')).toBeDisabled();
  await expect(submit).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('We could not confirm your application.');
  const retry = page.getByRole('button', {name: 'Retry original application', exact: true});
  offline.applicationResponse = {status: 200, json: {}};
  await retry.click();
  await expect(page.getByRole('alert')).toContainText('We could not confirm your application.');
  offline.applicationResponse = {status: 202, json: {saved: true, reference: applicationReference}};
  await retry.click();
  await expect(page.getByRole('heading', {name: 'Your application is with LOKD.'})).toBeFocused();
  await expect(page.locator('dd')).toHaveText(applicationReference);
  await expect(page.getByRole('link', {name: 'Track your application', exact: true})).toHaveAttribute('href', '/sign-in?return_to=%2Fofficer');
  await expect(page.getByText('Registration, identity and role checks are completed before you can start work.', {exact: false})).toBeVisible();
  expect(offline.applications).toHaveLength(4);
  for (const request of offline.applications.slice(1)) expect(request).toEqual(offline.applications[0]);
  await fitsViewport(page);
});

test('training deep link requires training selection and keeps unregistered intake distinct', async ({page, intakeNetwork: offline}) => {
  await page.goto('/training');
  await expect(page.getByRole('heading', {level: 1})).toHaveText('Security training at LOKD.');
  await expect(page.locator('main').getByRole('link', {name: /^Apply as an officer/})).toHaveAttribute('href', '/join?path=new');
  await page.goto('/join?path=training');
  await expect(page.getByLabel(label('Application pathway'))).toHaveValue('training');
  await expect(page.getByLabel(label('PSIRA registration status'))).toHaveValue('not_registered');
  await expect(page.getByRole('group', {name: 'Training interests — choose at least one'})).toBeVisible();
  await applicantDetails(page, {training: true});
  const submit = page.getByRole('button', {name: 'Submit application', exact: true});
  await submit.click();
  await expect(page.getByRole('alert')).toHaveText('Choose at least one training interest.');
  expect(offline.applications).toHaveLength(0);
  await page.getByLabel(label('Entry-level security training')).check();
  await submit.click();
  await expect(page.getByRole('heading', {name: 'Your application is with LOKD.'})).toBeFocused();
  await expect(page.locator('dd')).toHaveText(applicationReference);
  expect(offline.applications).toHaveLength(1);
  expect(offline.applications[0]).toMatchObject({pathway: 'training', psiraStatus: 'not_registered', psiraNumber: '', psiraGrade: '', training: ['Entry-level security training']});
  await fitsViewport(page);
});

function isoDate(daysAhead) {
  return new Date(Date.now() + 7200000 + daysAhead * 86400000).toISOString().slice(0, 10);
}

test('security enquiry enforces fields and consent, shows server rejection and links its receipt', async ({page, intakeNetwork: offline}) => {
  await page.goto('/book');
  await expect(page).toHaveURL(origin + '/book');
  await expect(page).toHaveTitle('Request security cover | LOKD');
  const form = page.locator('form.public-form');
  const next = form.getByRole('button', {name: 'Continue', exact: true});
  await next.click();
  await expect(form.getByRole('radio', {name: /Urgent cover/})).toBeFocused();
  expect(offline.enquiries).toHaveLength(0);
  await form.getByRole('radio', {name: /Full-time cover/}).check();
  await form.getByLabel(label('Start date')).fill(isoDate(200));
  await form.getByLabel(label('Contract term')).selectOption('3');
  await form.getByLabel(label('Roster')).selectOption('weekdays');
  await next.click();
  await expect(form.getByRole('heading', {name: 'Service and site', exact: true})).toBeFocused();
  await next.click();
  await expect(form.getByLabel(label('Security service'))).toBeFocused();
  await form.getByLabel(label('Security service')).selectOption('scheduled_unarmed_fixed_site');
  await form.getByLabel(label('Site type')).selectOption('commercial_property');
  await form.getByLabel(label('Suburb or area')).fill('Pretoria');
  await form.getByLabel(label('Site or venue address')).fill('1 Offline Street, Pretoria');
  await form.getByLabel(label('Shift')).selectOption('day');
  await form.getByLabel(label('Number of officers')).fill('2');
  await form.getByLabel(label('Site instructions')).fill('Weekday entry control and reception security for an office building.');
  await next.click();
  const submit = form.getByRole('button', {name: 'Request cover', exact: true});
  await form.getByLabel(label('Organisation or household name')).fill('Offline Example Organisation');
  await form.getByLabel(label('Contact name')).fill('Offline Contact');
  await form.getByLabel(label('Email address')).fill('offline.contact@example.test');
  await form.getByLabel(label('Phone number')).fill('082 123 4567');
  await form.locator('input[name="advanceFundingAcknowledged"]').check();
  await expect(form.getByRole('link', {name: 'privacy notice', exact: true})).toHaveAttribute('href', '/privacy');
  await submit.click();
  await expect(form.locator('input[name="privacyConsent"]')).toBeFocused();
  expect(offline.enquiries).toHaveLength(0);
  await form.locator('input[name="privacyConsent"]').check();
  offline.enquiryResponse = {status: 422, json: {error: 'Offline validation rejection: review your enquiry.'}};
  await submit.click();
  await expect(page.getByRole('alert')).toHaveText('Offline validation rejection: review your enquiry.');
  await expect(form.getByLabel(label('Organisation or household name'))).toHaveValue('Offline Example Organisation');
  expect(offline.enquiries).toHaveLength(1);
  expect(offline.enquiries[0]).toMatchObject({
    privacyConsent: true, advanceFundingAcknowledged: true, serviceType: 'scheduled_unarmed_fixed_site', siteType: 'commercial_property',
    booking: {coverType: 'fixed', startDate: isoDate(200), term: '3', rosterPattern: 'weekdays', shift: 'day', officers: 2}, email: 'offline.contact@example.test', company: '',
  });
  offline.enquiryResponse = {status: 202, json: {reference: 'LOKD-RECEIVED'}};
  await submit.click();
  await expect(page.getByRole('alert')).toContainText('We could not confirm your enquiry.');
  await expect(page.getByRole('heading', {name: 'Your enquiry is with LOKD.'})).toHaveCount(0);
  await expect(form.getByLabel(label('Organisation or household name'))).toBeDisabled();
  const retry = form.getByRole('button', {name: 'Retry original enquiry', exact: true});
  offline.enquiryResponse = {status: 200, json: {}};
  await retry.click();
  await expect(page.getByRole('alert')).toContainText('We could not confirm your enquiry.');
  offline.enquiryResponse = {status: 202, json: {saved: true, reference: enquiryReference, confirmationEmailSent: true}};
  await retry.click();
  await expect(page.getByRole('heading', {name: 'Your enquiry is with LOKD.'})).toBeFocused();
  await expect(page.locator('dd')).toHaveText(enquiryReference);
  await expect(page.getByText('A confirmation has been sent to your email address.')).toBeVisible();
  await expect(page.getByRole('link', {name: 'Track your enquiry', exact: true})).toHaveAttribute('href', '/sign-in?return_to=%2Fclient');
  await expect(page.getByText('LOKD Operations will confirm the officers and the price with you.', {exact: false})).toBeVisible();
  expect(offline.enquiries).toHaveLength(4);
  for (const enquiry of offline.enquiries.slice(1)) expect(enquiry).toEqual(offline.enquiries[0]);
  await fitsViewport(page);
});

for (const when of ['today', 'tomorrow']) test('legacy homepage booking prefill survives the redirect: ' + when, async ({page}) => {
  await page.goto('/quote?service=armed_static&when=' + when + '#quote-form');
  await expect(page).toHaveURL(new RegExp('/book\\?service=armed_static&when=' + when + '#quote-form$'));
  await expect(page.getByRole('radio', {name: /Urgent cover/})).toBeChecked();
  await expect(page.getByLabel(/^Start date/)).toHaveValue(isoDate(when === 'tomorrow' ? 1 : 0));
  await page.getByRole('button', {name: 'Continue', exact: true}).click();
  await expect(page.locator('form.booking-flow').getByLabel(/^Security service/)).toHaveValue('armed_static');
  await expect(page.getByRole('heading', {name: 'Service and site', exact: true})).toBeFocused();
  await fitsViewport(page);
});

test('ongoing cover links prefill the Fixed model and expose every term and roster', async ({page}) => {
  await page.goto('/book?when=ongoing&service=armed_static');
  const form = page.locator('form.booking-flow');
  await expect(form.getByRole('radio', {name: /Full-time cover/})).toBeChecked();
  await expect(form.getByLabel(/^Contract term/).locator('option:not([disabled])')).toHaveText(['3 months', '6 months', '12 months']);
  await expect(form.getByLabel(/^Roster/).locator('option:not([disabled])')).toHaveText(['Weekdays (Monday–Friday)', 'Mon–Sat', 'Daily']);
  await fitsViewport(page);
});

test('Flex request keeps the weekly cover intent and retains details across Back', async ({page, intakeNetwork: offline}) => {
  await page.goto('/book?service=vip_unarmed');
  const form = page.locator('form.booking-flow');
  await expect(form.getByRole('heading', {name: 'How you need cover', exact: true})).not.toBeFocused();
  await form.getByRole('radio', {name: /Weekly cover/}).check();
  await form.getByLabel(/^Start date/).fill(isoDate(5));
  await form.getByLabel(/^Cover duration/).fill('2');
  await form.getByLabel(/^Roster/).selectOption('daily');
  await form.getByRole('button', {name: 'Continue', exact: true}).click();
  await expect(form.getByLabel(/^Security service/)).toHaveValue('vip_unarmed');
  await form.getByLabel(/^Shift/).selectOption('night');
  await form.getByLabel(/^Number of officers/).fill('2');
  await form.getByLabel(/^Site type/).selectOption('commercial_property');
  await form.getByLabel(/^Suburb or area/).fill('Sandton');
  await form.getByLabel(/^Site or venue address/).fill('24 Rivonia Road, Sandton');
  await form.getByRole('button', {name: 'Continue', exact: true}).click();
  await form.getByRole('button', {name: 'Back', exact: true}).click();
  await expect(form.getByRole('heading', {name: 'Service and site', exact: true})).toBeFocused();
  await expect(form.getByLabel(/^Shift/)).toHaveValue('night');
  await expect(form.getByLabel(/^Site or venue address/)).toHaveValue('24 Rivonia Road, Sandton');
  await form.getByRole('button', {name: 'Back', exact: true}).click();
  await expect(form.getByRole('heading', {name: 'How you need cover', exact: true})).toBeFocused();
  await expect(form.getByRole('radio', {name: /Weekly cover/})).toBeChecked();
  await expect(form.getByLabel(/^Start date/)).toHaveValue(isoDate(5));
  await form.getByRole('button', {name: 'Continue', exact: true}).click();
  await expect(form.getByRole('heading', {name: 'Service and site', exact: true})).toBeFocused();
  await expect(form.getByLabel(/^Security service/)).toHaveValue('vip_unarmed');
  await expect(form.getByLabel(/^Number of officers/)).toHaveValue('2');
  await expect(form.getByLabel(/^Site or venue address/)).toHaveValue('24 Rivonia Road, Sandton');
  await form.getByRole('button', {name: 'Continue', exact: true}).click();
  await expect(form.getByRole('heading', {name: 'Your details', exact: true})).toBeFocused();
  await form.getByLabel(/^Organisation or household name/).fill('Private household');
  await form.getByLabel(/^Contact name/).fill('Booking Contact');
  await form.getByLabel(/^Email address/).fill('booking@example.test');
  await form.getByLabel(/^Phone number/).fill('0821234567');
  await form.locator('input[name="advanceFundingAcknowledged"]').check();
  await form.locator('input[name="privacyConsent"]').check();
  await form.getByRole('button', {name: 'Back', exact: true}).click();
  await expect(form.getByRole('heading', {name: 'Service and site', exact: true})).toBeFocused();
  await form.getByRole('button', {name: 'Continue', exact: true}).click();
  await expect(form.getByRole('heading', {name: 'Your details', exact: true})).toBeFocused();
  await expect(form.getByLabel(/^Email address/)).toHaveValue('booking@example.test');
  await expect(form.locator('input[name="privacyConsent"]')).toBeChecked();
  expect(offline.enquiries).toHaveLength(0);
  await form.getByRole('button', {name: 'Request cover', exact: true}).click();
  expect(offline.enquiries).toHaveLength(1);
  expect(offline.enquiries[0].booking).toEqual({coverType:'flex',startDate:isoDate(5),shift:'night',officers:2,term:'week',durationWeeks:2,rosterPattern:'daily'});
  await expect(page.getByRole('heading', {name: 'Your enquiry is with LOKD.'})).toBeVisible();
  await expect(page.getByText(/Operations will confirm the officers and the price/)).toBeVisible();
  await fitsViewport(page);
});
