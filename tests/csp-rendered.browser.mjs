import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from '@playwright/test';
import {default as worker} from '../dist/server/index.js';
const assetsRoot=path.resolve('dist/client');
const assets={async fetch(request){const pathname=new URL(request.url).pathname,filename=path.resolve(assetsRoot,'.'+pathname);if(!filename.startsWith(assetsRoot+path.sep))return new Response('not found',{status:404});try{const bytes=await fs.readFile(filename);const type={'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'}[path.extname(filename)]??'application/octet-stream';return new Response(bytes,{headers:{'content-type':type}});}catch{return new Response('not found',{status:404});}}};
const server=http.createServer(async(req,res)=>{try{const request=new Request('http://127.0.0.1:'+server.address().port+req.url,{headers:req.headers});const asset=await assets.fetch(request);const response=asset.status===200?asset:await worker.fetch(request,{ASSETS:assets},{waitUntil(){},passThroughOnException(){}});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch(error){res.writeHead(500);res.end(String(error));}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({headless:true,ignoreDefaultArgs:['--disable-dev-shm-usage']});
 for(const width of [360,1280])for(const input of ['pointer','keyboard']){
  const page=await browser.newPage({viewport:{width,height:900}});const failures=[];page.on('pageerror',error=>failures.push(error.message));
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.addInitScript(()=>{window.__cspViolations=[];document.addEventListener('securitypolicyviolation',event=>window.__cspViolations.push({directive:event.effectiveDirective,blocked:event.blockedURI}));});
  const response=await page.goto('http://127.0.0.1:'+server.address().port+'/');assert.equal(response.status(),200);
  await page.waitForFunction(()=>typeof window.__VINEXT_RSC_PARAMS__==='object');
  await page.evaluate(()=>{window.__navigationSentinel='hydrated';});
  const about=page.getByRole('navigation',{name:'Main navigation',exact:true}).getByRole('link',{name:'About',exact:true});
  if(input==='pointer')await about.click();else{await about.focus();await page.keyboard.press('Enter');}
  await page.waitForURL('**/about');
  assert.equal(await page.evaluate(()=>window.__navigationSentinel),'hydrated','client navigation must hydrate without document reload');
  assert.deepEqual(await page.evaluate(()=>window.__cspViolations),[],'normal bootstrap/navigation must not violate CSP');assert.deepEqual(failures,[]);
  await page.evaluate(()=>{const script=document.createElement('script');script.textContent='window.__untrustedInlineRan=true';document.body.append(script);});
  await page.waitForFunction(()=>window.__cspViolations.some(event=>event.directive==='script-src-elem'));
  assert.equal(await page.evaluate(()=>window.__untrustedInlineRan),undefined);
  console.log(JSON.stringify({width,input,hydration:'passed',clientNavigation:'passed',normalCspViolations:0,untrustedInline:'blocked'}));
  await page.close();
 }
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
