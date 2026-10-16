import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import * as contracts from '../app/lib/workspace-response-contracts.ts';
import * as receipts from '../app/lib/workspace-command-receipt.ts';

const row={id:'ENQ-fixture',organisationName:'Private organisation',contactName:'Fixture contact',email:'fixture@example.test',mobile:null,siteArea:'Pretoria',siteType:'other',requiredStart:'planning',serviceType:'scheduled_unarmed_fixed_site',message:'Fixture brief',status:'new',ownerId:null,resolution:null,createdAt:'2026-10-16T00:00:00Z',updatedAt:'2026-10-16T00:00:00Z',version:1};
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(setImmediate);};
function setup(respond){
 const slots=[],effects=[],timers=[],calls=[],flashes=[];let index=0,tree;
 const jsx=(type,props)=>({type,props});
 const modules={'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'fragment'},react:{useState:initial=>{const key=index++;if(!(key in slots))slots[key]=initial;return [slots[key],value=>{slots[key]=value;}];},useRef:initial=>slots[index++]??={current:initial},useCallback:f=>f,useMemo:f=>f(),useEffect:f=>{const key=index++;if(!(key in slots)){slots[key]=true;effects.push(f);}}},'next/navigation':{usePathname:()=>'/ops',useSearchParams:()=>new URLSearchParams()},'./signup-portal.module.css':{default:{}},'../lib/workspace-response-contracts':contracts,'../lib/workspace-command-receipt':receipts};
 const load=file=>{const exports={};const code=ts.transpileModule(fs.readFileSync(new URL('../app/components/'+file,import.meta.url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(code,{exports,Error,TypeError,Intl,URLSearchParams,setTimeout:f=>{timers.push(f);return timers.length;},clearTimeout:()=>{},fetch:async(url,options)=>{calls.push({url,options});return respond(url,options);},require:key=>{assert.ok(key in modules,key);return modules[key];}});return exports;};
 modules['./workspace-request']=load('workspace-request.tsx');const Component=load('client-enquiries-view.tsx').default;
 const render=()=>{index=0;tree=Component({flash:message=>flashes.push(message)});};render();effects.forEach(f=>f());timers.forEach(f=>f());
 function find(node,label){if(!node||typeof node!=='object')return null;if(node.type==='button'&&node.props.children===label)return node;for(const child of [node.props?.children].flat(Infinity)){const result=find(child,label);if(result)return result;}return null;}
 return {calls,flashes,render,button(label){render();return find(tree,label);},text(){render();return JSON.stringify(tree);}};
}

test('failed queue refresh retains inert records and access loss clears private data',async()=>{
 let response=()=>Response.json({enquiries:[row]});const ui=setup(()=>response());await flush();assert.equal(ui.button('Take ownership').props.disabled,false);
 response=()=>Response.json({enquiries:[{...row,createdAt:'invalid'}]});await ui.button('↻ Refresh queue').props.onClick();await flush();assert.match(ui.text(),/Private organisation/);assert.equal(ui.button('Take ownership').props.disabled,true);
 response=()=>Response.json({error:'Session expired'},{status:401});ui.button('↻ Refresh queue').props.onClick();await flush();assert.doesNotMatch(ui.text(),/Private organisation|fixture@example.test/);
});

test('queue rejects truthy, missing and mismatched acknowledgements and blocks repeated actions',async()=>{
 for(const body of [{ok:'true'},{ok:true},{ok:true,commandReceipt:await receipts.workspaceCommandReceipt('client-enquiries',{id:'another',action:'triage',version:1})}]){
  let release;const ui=setup((_url,options)=>options.method==='PATCH'?new Promise(resolve=>{release=resolve;}):Response.json({enquiries:[row]}));await flush();const click=ui.button('Take ownership').props.onClick;click();click();assert.equal(ui.calls.filter(c=>c.options.method==='PATCH').length,1);release(Response.json(body));await flush();assert.equal(ui.flashes.length,0);assert.equal(ui.button('Take ownership').props.disabled,true);ui.button('Take ownership').props.onClick();assert.equal(ui.calls.filter(c=>c.options.method==='PATCH').length,1);
 }
});

test('queue acknowledges only the exact completed command and refreshes its version',async()=>{
 let current=row;const ui=setup(async(_url,options)=>{if(options.method==='PATCH'){const command=JSON.parse(options.body);current={...row,status:'triaged',version:2};return Response.json({ok:true,commandReceipt:await receipts.workspaceCommandReceipt('client-enquiries',command)});}return Response.json({enquiries:[current]});});await flush();ui.button('Take ownership').props.onClick();for(let i=0;i<200&&ui.flashes.length===0;i++)await new Promise(resolve=>setTimeout(resolve,10));assert.equal(ui.flashes.length,1,ui.text());assert.equal(ui.button('Take ownership'),null);assert.match(ui.text(),/triaged/);
});
