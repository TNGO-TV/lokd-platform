import { defineConfig } from '@playwright/test';

if (!process.env.CLERK_SECRET_KEY?.startsWith('sk_test_') || !process.env.LOKD_TEST_EMAILS) {
  throw new Error('Run npm run test:accounts; development provisioning is required.');
}
export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.mjs/,
  workers: 1,
  maxFailures: 1,
  timeout: 60000,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: `${process.cwd()}/test-results/accounts.json` }]],
  use: { baseURL: 'http://localhost:4177', headless: true, trace: 'off', screenshot: 'off', video: 'off' },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4177 --strictPort',
    url: 'http://localhost:4177/sign-in',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
