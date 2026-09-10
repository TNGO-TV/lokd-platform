import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'mobile.spec.mjs',workers:1,retries:0,timeout:45000,
 reporter:[['list'],['json',{outputFile:`${process.cwd()}/test-results/mobile-journeys.json`}]],
 use:{baseURL:'http://127.0.0.1:4178',headless:true,trace:'off',screenshot:'off',video:'off'},
 projects:[{name:'mobile-360',use:{viewport:{width:360,height:800},isMobile:true,hasTouch:true}},{name:'desktop',use:{viewport:{width:1280,height:900}}}]
});
