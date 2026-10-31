import {defineConfig} from '@playwright/test';
import {fileURLToPath} from 'node:url';
import base from './playwright.config.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const results=fileURLToPath(new URL('../../test-results/integrated-browser/',import.meta.url));

// Local actual-handler regressions; never reuse another process's fixtures.
export default defineConfig(base,{
 testMatch:'*.spec.mjs',
 outputDir:results+'run',
 reporter:[['list'],['json',{outputFile:results+'browser.json'}]],
 use:{...base.use,baseURL:'http://127.0.0.1:4405'},
 webServer:[
  {cwd:root,command:'node --import ./tests/register-cloudflare.mjs tests/integrated-browser/server.mjs',
   env:{LOKD_LOCAL_HANDLER_FIXTURE:'enabled',LOKD_MERGED_HANDLER_FIXTURE:'enabled',LOKD_HANDLER_PORT:'4406'},
   url:'http://127.0.0.1:4406/__fixture/state',reuseExistingServer:false,timeout:30000},
  {cwd:root,command:'node node_modules/vite/bin/vite.js --config tests/integrated-browser/vite.config.mjs --host 127.0.0.1 --strictPort',
   env:{LOKD_UI_PORT:'4405',LOKD_HANDLER_PORT:'4406'},
   url:'http://127.0.0.1:4405',reuseExistingServer:false,timeout:30000},
 ],
});
