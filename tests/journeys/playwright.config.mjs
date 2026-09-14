import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'.',outputDir:process.cwd()+'/test-results/intake-run',testMatch:'mobile.spec.mjs',workers:1,retries:0,timeout:45000,
 reporter:[['list'],['json',{outputFile:`${process.cwd()}/test-results/mobile-journeys.json`}]],
 use:{baseURL:process.env.LOKD_PUBLIC_BASE_URL??'http://127.0.0.1:4178',headless:true,launchOptions:process.env.LOKD_BROWSER_NATIVE_SHM==='true'?{ignoreDefaultArgs:['--disable-dev-shm-usage']}:{},trace:'off',screenshot:'off',video:'off'},
 projects:[{name:'mobile-360',use:{viewport:{width:360,height:800},isMobile:true,hasTouch:true}},{name:'desktop',use:{viewport:{width:1280,height:900}}}]
});
