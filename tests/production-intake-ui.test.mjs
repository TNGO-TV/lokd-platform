import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import * as contracts from '../app/lib/workspace-response-contracts.ts';
import * as receipts from '../app/lib/workspace-command-receipt.ts';

const record={kind:'officer',id:'APP-fixture',version:2,updatedAt:'2026-10-16T00:00:00Z',details:{fullName:'Isolated fixture'},email:'fixture@example.test',accountLinked:true,status:'reviewed',events:[]};
const submitted={action:'prepare_entity',kind:record.kind,caseId:record.id,caseVersion:record.version};
const receipt={documents:[],envelopes:[],owner:false,commandReceipt:await receipts.workspaceCommandReceipt('production-signing',submitted),result:{entityId:'OFFICER-fixture',grantsAccess:false,workEligible:false},entities:[{kind:'officer',case_id:record.id,case_version:record.version,entity_id:'OFFICER-fixture'}]};
const flush=async()=>{for(let i=0;i<6;i++)await new Promise(setImmediate);};
function setup(fetch,refresh=async()=>true){
 const writes=[],jsx=(type,props)=>({type,props});
 const modules={'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'fragment'},react:{useState:v=>[v,x=>writes.push(x)],useRef:v=>({current:v}),useEffect:()=>{},useCallback:f=>f},'next/link':{default:'a'},'next/navigation':{useSearchParams:()=>new URLSearchParams()},'../lib/signup-types':{signupNextStep:()=>'',signupStatusLabels:{reviewed:'Reviewed'}},'../lib/psira-pathway':{applicationPsiraDeclaration:()=> 'registered'},'./signup-portal.module.css':{default:{}},'./officer-presence-panel':{default:()=>null},'./test-agreement-panel':{default:()=>null},'./test-surface-context':{useTestSurface:()=>false}};
 modules['../lib/workspace-response-contracts']=contracts;modules['../lib/workspace-command-receipt']=receipts;
 const helper={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../app/components/workspace-request.tsx',import.meta.url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}}).outputText,{exports:helper,Error,require:key=>modules[key]});modules['./workspace-request']=helper;
 const source=fs.readFileSync(new URL('../app/components/signup-portal.tsx',import.meta.url),'utf8')+'\nexport {RecordCard};';
 const code=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,exports={};
 vm.runInNewContext(code,{exports,require:key=>{assert.ok(key in modules,key);return modules[key];},fetch,Intl,URLSearchParams,Error});
 const tree=exports.RecordCard({record,operations:true,busy:false,run:async()=>true,refresh,onUnconfirmed:message=>writes.push(message)});
 function find(n){if(!n||typeof n!=='object')return null;if(n.type==='button'&&n.props.children==='Prepare operational record')return n;for(const c of [n.props?.children].flat(Infinity)){const found=find(c);if(found)return found;}return null;}
 const button=find(tree);assert.ok(button);return {click:button.props.onClick,writes};
}

test('operational preparation rejects missing, mismatched and unsafe success receipts',async()=>{
 for(const body of [{},{result:{entityId:'OFFICER-fixture'}},{...receipt,entities:[]},{...receipt,entities:[{...receipt.entities[0],case_version:1}]},{...receipt,result:{...receipt.result,workEligible:true}}]){
  let refreshes=0;const ui=setup(async()=>Response.json(body),async()=>{refreshes++;return true;});
  ui.click();for(let i=0;i<200&&!ui.writes.some(v=>typeof v==='string'&&/not confirmed|unconfirmed/.test(v));i++)await new Promise(resolve=>setTimeout(resolve,10));assert.equal(refreshes,0);assert.ok(ui.writes.some(v=>typeof v==='string'&&/not confirmed|unconfirmed/.test(v)));assert.ok(!ui.writes.some(v=>typeof v==='string'&&v.startsWith('Prepared ')));
 }
});

test('operational preparation holds a synchronous duplicate-submit lock through readback',async()=>{
 let calls=0,releaseWrite,releaseRefresh;const ui=setup(()=>{calls++;return new Promise(resolve=>{releaseWrite=resolve;});},()=>new Promise(resolve=>{releaseRefresh=resolve;}));
 ui.click();ui.click();assert.equal(calls,1);
 releaseWrite(Response.json(receipt));await flush();ui.click();assert.equal(calls,1);
 releaseRefresh(true);await flush();assert.ok(ui.writes.includes('Prepared OFFICER-fixture. Verification and approvals remain pending.'));
});

test('preparation distinguishes a rejected write from a verified receipt with failed refresh',async()=>{
 const rejected=setup(async()=>Response.json({error:'Record changed'},{status:409}));rejected.click();await flush();assert.ok(rejected.writes.some(v=>typeof v==='string'&&v.includes('Record changed')));assert.ok(!rejected.writes.some(v=>typeof v==='string'&&v.startsWith('Prepared ')));
 const saved=setup(async()=>Response.json(receipt),async()=>false);saved.click();await flush();assert.ok(saved.writes.some(v=>typeof v==='string'&&v.startsWith('Prepared OFFICER-fixture.')&&v.includes('could not be refreshed')));
});
