import {defineConfig} from '@playwright/test';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const results = fileURLToPath(new URL('../../test-results/offline-browser/', import.meta.url));

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.mjs',
  outputDir: results + 'run',
  reporter: [['list'], ['json', {outputFile: results + 'results.json'}]],
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
    cwd: root,
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
