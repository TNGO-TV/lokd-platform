// Explicit provider TEST execution only. No URL, payload, mode or person arguments.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dispatchVerifyNow} from '../app/lib/verifynow-adapter.ts';
const keyPath=process.env.LOKD_VERIFYNOW_TEST_KEY_FILE;
if(!keyPath)throw Error('Set the server-only test credential file path.');
const key=(await readFile(keyPath,'utf8')).trim();if(!/^vn_live_[a-f0-9]{64}$/i.test(key))throw Error('Invalid test credential file');
const dir='acceptance/sandbox-completion';await mkdir(dir,{recursive:true});
const cases=['id-found','id-no-record','id-unavailable','face-reference','face-upload','liveness','document-ocr','drivers-licence'];
const results=[];
for(const scenario of cases){
 const startedAt=new Date().toISOString();let sent=false;
 try{const result=await dispatchVerifyNow(scenario,key,crypto.randomUUID(),async(url,options)=>{if(!url.startsWith('https://www.verifynow.co.za/api/external/')||JSON.parse(options.body).mode!=='sandbox')throw Error('Sandbox guard');sent=true;return fetch(url,options);});results.push({scenario,mode:'actual-provider-sandbox',startedAt,requestAttempted:sent,...result});}
 catch(e){results.push({scenario,mode:'actual-provider-sandbox',startedAt,requestAttempted:sent,error:e.cause?.code??e.name});}
 await writeFile(dir+'/verifynow-external.json',JSON.stringify({productionRequests:0,simulated:false,results},null,2)+'\n');
 console.log(scenario,results.at(-1).httpStatus??'no-response',results.at(-1).outcome??results.at(-1).error);
 // Respect the shared provider cooldown, without automatically retrying requests.
 await new Promise(resolve=>setTimeout(resolve,2200));
}
process.exitCode=results.some(r=>r.error||r.outcome==='unexpected')?1:0;
