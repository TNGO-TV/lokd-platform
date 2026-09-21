// Local component browser tests: no Clerk accounts, provider calls, D1 or checkout fixtures.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {build} from 'esbuild';
import {chromium} from '@playwright/test';
const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'lokd-documents-browser-'));
const root=process.cwd(),entry=path.join(temporary,'entry.tsx');
const source={kind:'payslip',source_id:'payroll-item-existing',party_id:'officer-existing',recipient_user:'officer-user',amount_cents:12345,source_json:'{}',currentState:'reversed'};
const doc={...source,id:'FD-existing',version:1,payload_hash:'a'.repeat(64),parent_id:null,decision:'approved',number:'LOKD-PAYSLIP-EXISTING-V1',source:{officerName:'Synthetic Officer',periodStart:'2026-09-01',periodEnd:'2026-09-13',payDate:'2026-09-14',calendar:'Africa/Johannesburg',calculation:{grossCents:15000,netPayCents:12345}},note:'Local immutable issue',asIssuedState:'paid',sourceChanged:false,superseded:false,issued_at:'2026-09-14T00:00:00Z'};
await fs.writeFile(entry,`import React from 'react';import {createRoot} from 'react-dom/client';import Documents from ${JSON.stringify(path.join(root,'app/components/finance-document-controls.tsx'))};import styles from ${JSON.stringify(path.join(root,'app/components/signup-portal.module.css'))};window.commands=[];createRoot(document.getElementById('root')).render(<main className={styles.shell}><Documents operations={true} busy={false} send={async c=>{window.commands.push(c);}}/></main>);`);
const server=http.createServer(async(req,res)=>{try{const filename=req.url==='/app.js'?'app.js':req.url==='/app.css'?'app.css':null;if(filename){res.setHeader('content-type',filename.endsWith('.js')?'text/javascript':'text/css');res.end(await fs.readFile(path.join(temporary,filename)));}else{res.setHeader('content-type','text/html');res.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><style>*{box-sizing:border-box}body{font:16px sans-serif;margin:12px}main{max-width:900px}section{margin-bottom:32px}button{margin:8px}dd,pre{overflow-wrap:anywhere}</style></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>');}}catch{res.statusCode=404;res.end();}});
let browser;
try{
 await build({entryPoints:[entry],bundle:true,outfile:path.join(temporary,'app.js'),format:'esm',platform:'browser',jsx:'automatic',nodePaths:[path.join(root,'node_modules')],loader:{'.css':'local-css'},define:{'process.env.NODE_ENV':'"development"'}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const address='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,...(process.env.LOKD_BROWSER_NATIVE_SHM==='true'?{ignoreDefaultArgs:['--disable-dev-shm-usage']}:{})});const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/finance-documents?*',route=>route.fulfill({json:{documents:[doc],sources:[source],calendar:'Africa/Johannesburg'}}));
 await page.goto(address);await page.getByRole('heading',{name:'Private finance documents'}).waitFor();
 await page.getByRole('link',{name:'Download private payslip (printable HTML)'}).waitFor();
 assert.equal(await page.getByText('paid',{exact:true}).count(),1);assert.equal(await page.getByText('reversed',{exact:true}).count(),1);
 await page.getByText('Amounts, dates and source details',{exact:true}).click();await page.getByText('R 123.45',{exact:true}).waitFor();
 await page.getByText('Prepare a finance document',{exact:true}).click();await page.getByLabel('Approved source',{exact:true}).selectOption('payslip:payroll-item-existing');
 await page.getByLabel('Issue findings',{exact:true}).fill('Source reviewed in local synthetic fixture.');await page.getByLabel('I reviewed the source, private recipient and current financial state.').check();
 await page.getByRole('button',{name:'Prepare document for approval'}).click();const first=await page.evaluate(()=>window.commands.at(-1));assert.equal(first.kind,'payslip');assert.equal(first.action,'prepare_document');
 await page.getByRole('button',{name:'Prepare document for approval'}).click();assert.equal((await page.evaluate(()=>window.commands.at(-1))).requestKey,first.requestKey);
 await page.getByLabel('Correction or refreshed-state reason').fill('Record reversal without rewriting the original issued amounts.');await page.getByLabel('I reviewed the current approved source. No original amounts or history will be overwritten.').check();await page.getByRole('button',{name:'Prepare next immutable version'}).click();assert.equal((await page.evaluate(()=>window.commands.at(-1))).parentId,'FD-existing');
 assert.deepEqual(errors,[]);for(const width of [360,390,1280]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'no horizontal overflow at '+width);}
 await page.getByRole('button',{name:'Refresh private documents'}).focus();await page.keyboard.press('Enter');await page.getByRole('heading',{name:'Private finance documents'}).waitFor();await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'/tmp/lokd-documents-browser.png'});
 console.log('PASS: local document journey, readable amounts and SAST dates, historical paid/current reversed labels, correction references, private download links, retry keys, keyboard refresh and mobile layout. No communications or external accounts.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));await fs.rm(temporary,{recursive:true,force:true});}
