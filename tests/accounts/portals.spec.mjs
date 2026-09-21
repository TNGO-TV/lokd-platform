import { test, expect } from '@playwright/test';
import { clerk, clerkSetup, setupClerkTestingToken } from '@clerk/testing/playwright';

const emails = JSON.parse(process.env.LOKD_TEST_EMAILS);
const paths = { client: '/client', officer: '/officer', operations: '/ops' };

test.beforeAll(async () => { await clerkSetup({ dotenv: false }); });

async function signIn(page, role) {
  page.on("requestfailed", request => console.error("Request failed:", new URL(request.url()).hostname, request.failure()?.errorText));
  await setupClerkTestingToken({ page });
  await page.goto(`/sign-in?return_to=${paths[role] || '/client'}`);
  await clerk.loaded({ page });
  await expect(page.getByRole("textbox", { name: /email address/i })).toBeVisible();
  // Test the email-code strategy, not the helper's ticket shortcut that skips MFA.
  await clerk.signIn({ page, signInParams: { strategy: 'email_code', identifier: emails[role] } });
}

for (const role of Object.keys(paths)) {
  test(`${role}: email-code sign-in, own portal, other roles denied, sign-out`, async ({ page }) => {
    await signIn(page, role);
    await page.goto(`/sign-in?return_to=${paths[role]}`);
    await expect(page).toHaveURL(new RegExp(`${paths[role]}$`));
    await expect(page.locator('main')).toBeVisible();
    await expect(page.getByText('access is not assigned.', { exact: false })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /sign in/i })).toHaveCount(0);
    for (const other of Object.keys(paths).filter(value => value !== role)) {
      await page.goto(paths[other]);
      await expect(page.getByRole('heading', { name: /access is not assigned/ })).toBeVisible();
      const denied = await page.request.get(`/api/pilot?scope=${other}`);
      expect(denied.status()).toBe(403);
    }
    await clerk.signOut({ page });
    await page.goto(paths[role]);
    await expect(page).toHaveURL(/\/sign-in\?/);
  });
}

test('unassigned verified account cannot enter any portal', async ({ page }) => {
  await signIn(page, 'unassigned');
  for (const path of Object.values(paths)) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: /access is not assigned/ })).toBeVisible();
  }
});

test('owner role follows the explicitly configured cross-portal policy', async ({ page }) => {
  await signIn(page, 'owner');
  for (const path of Object.values(paths)) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByText('access is not assigned.', { exact: false })).toHaveCount(0);
  }
});

test('anonymous requests and forged identity headers cannot enter Operations', async ({ request }) => {
  const result = await request.get('/api/operations', { headers: { 'x-lokd-verified-email': emails.owner, 'oai-authenticated-user-email': emails.owner } });
  expect(result.status()).toBe(401);
});
