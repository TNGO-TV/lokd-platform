import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.mjs',
  outputDir: '../../test-results/offline-browser/run',
  reporter: [['list'], ['json', {outputFile: 'test-results/offline-browser/results.json'}]],
  workers: 1,
  retries: 0,
  timeout: 45000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node --experimental-loader ./tests/cloudflare-loader.mjs tests/offline-browser/server.mjs',
    url: 'http://127.0.0.1:4173/__offline_ready',
    reuseExistingServer: false,
    timeout: 30000,
  },
  projects: [
    {name: 'desktop', use: {viewport: {width: 1280, height: 900}}},
    {name: 'mobile', use: {viewport: {width: 360, height: 800}, isMobile: true, hasTouch: true}},
  ],
});
