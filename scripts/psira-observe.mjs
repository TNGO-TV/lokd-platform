// Read-only official-site observation; produces evidence, never grants LOKD approval.
import { chromium } from '@playwright/test';
import { mkdir, writeFile, access, chmod } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const number=process.argv[2];
if(!/^\d{1,12}$/.test(number||''))throw new Error('Usage: node scripts/psira-observe.mjs PSIRA_NUMBER');
const source='https://digitalservices.psira.co.za/verify-user/4';
const startedAt=new Date().toISOString();
const folder=`work/psira/${number}/${startedAt.replaceAll(':','-')}`;
await mkdir(folder,{recursive:true,mode:0o700});
const libraries=`${process.cwd()}/.sites-runtime/browser-libs/usr/lib/x86_64-linux-gnu`;
let localLibraries=false;try{await access(libraries);localLibraries=true;}catch{}
const browser=await chromium.launch({env:{...process.env,...(localLibraries?{LD_LIBRARY_PATH:[libraries,process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')}:{})}});
const page=await browser.newPage();
const observation={source,psiraNumber:number,startedAt,checkedAt:null,outcome:'unavailable',identityMatch:'unchecked',rows:[],failure:null};
try {
  await page.goto(source,{waitUntil:'domcontentloaded',timeout:30000});
  await page.getByPlaceholder('PSIRA No',{exact:true}).fill(number,{timeout:45000});
  await page.getByRole('button',{name:'Search',exact:true}).click();
  // A visible result row must contain the submitted number. Empty/error pages never pass.
  await page.locator('tr').filter({has:page.getByRole('cell',{name:number,exact:true})}).first().waitFor({timeout:30000});
  const rows=await page.locator('tr').filter({has:page.getByRole('cell',{name:number,exact:true})}).evaluateAll(rows=>rows.map(row=>Array.from(row.querySelectorAll('td')).map(cell=>cell.textContent.trim())));
  observation.rows=rows;
  observation.outcome=rows.length===1?'lookup_returned':'ambiguous';
} catch(error) {
  observation.failure=error instanceof Error?error.message.split('\n')[0]:'Official lookup could not be completed';
} finally {
  observation.checkedAt=new Date().toISOString();
  const evidence=await page.locator('body').innerText().catch(()=>'');
  const headers=await page.locator('th').allTextContents().catch(()=>[]);
  const record={...observation,headers,evidence};
  const raw=JSON.stringify(record,null,2);
  await writeFile(`${folder}/observation.json`,raw,{mode:0o600});
  await writeFile(`${folder}/sha256.txt`,createHash('sha256').update(raw).digest('hex')+'\n',{mode:0o600});
  await page.screenshot({path:`${folder}/official-result.png`,fullPage:true}).then(()=>chmod(`${folder}/official-result.png`,0o600)).catch(()=>{});
  await browser.close();
  console.log(JSON.stringify({source,checkedAt:observation.checkedAt,outcome:observation.outcome,identityMatch:'unchecked',privateEvidence:folder}));
  if(observation.outcome!=='lookup_returned')process.exitCode=1;
}
