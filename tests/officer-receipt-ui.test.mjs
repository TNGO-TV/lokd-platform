import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import * as pathway from '../app/lib/psira-pathway.ts';
const clientSource=fs.readFileSync(new URL('../app/join/page.tsx',import.meta.url),'utf8');
const compile=(source,modules,globals={})=>{const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:k=>{assert.ok(k in modules,k);return modules[k];},crypto,Response,Request,Error,TypeError,SyntaxError,Date,JSON,URLSearchParams,...globals});return exports;};
const reference='APP-11111111-1111-4111-8111-111111111111',flush=async()=>{for(let i=0;i<4;i++)await new Promise(setImmediate);};
function ui(respond,{company=''}={}){
 const slots=[],requests=[],responses=[];let index=0,tree;
 const jsx=(type,props)=>({type,props}),react={useState:initial=>{const key=index++;if(!(key in slots))slots[key]=initial;return[slots[key],value=>{slots[key]=typeof value==='function'?value(slots[key]):value;}];},useRef:initial=>slots[index++]??={current:initial},useSyncExternalStore:()=>true,useMemo:f=>f(),useEffect(){}};
 const Journey=compile(clientSource,{'react/jsx-runtime':{jsx,jsxs:jsx},react,'next/image':{default:'image'},'../components/public-site-shell':{PublicFooter:'footer'},'../lib/psira-pathway':pathway,'../components/sandbox-command-recovery':{default:'recovery'},'next/link':{default:'a'},'../lib/public-site':{OFFICER_PORTAL_URL:'https://officers.lokd.co.za'},'next/navigation':{useSearchParams:()=>new URLSearchParams()}},{FormData:class{get(name){return name==='company'?company:'on';}},fetch:async(_url,options)=>{requests.push(options.body);const response=await respond(options.body);responses.push(await response.clone().json());return response;}}).OfficerApplicationJourney;
 const find=(node,p)=>{if(!node||typeof node!=='object')return null;if(p(node))return node;for(const child of [node.props?.children].flat(Infinity)){const f=find(child,p);if(f)return f;}return null;};
 const render=()=>{index=0;tree=Journey({});const form=find(tree,n=>n.type==='form');if(form?.props.ref)form.props.ref.current={reportValidity:()=>true};};
 const submit=async()=>{const form=find(tree,n=>n.type==='form');await form.props.onSubmit({preventDefault(){},currentTarget:{}});render();};
 render();return{requests,responses,submit,retry(){find(tree,n=>n.type==='button'&&n.props.children==='Retry original application').props.onClick();},render,locked:()=>find(tree,n=>n.type==='fieldset'&&n.props.disabled===true)!==null,async prepare(){await submit();for(const [name,value] of Object.entries({fullName:'Synthetic Officer',mobile:'0821234567',email:'officer@example.test',city:'Pretoria',psiraNumber:'1234567'})){find(tree,n=>n.type==='input'&&n.props.name===name).props.onChange({target:{value}});}render();await submit();},saved:()=>!!find(tree,n=>n.type==='h1'&&n.props.children==='Your LOKD journey has started.'),text:()=>JSON.stringify(tree,(_key,value)=>typeof value==='function'?undefined:value)};
}
test('Officer form requires a genuine saved receipt and preserves the original request for malformed-success recovery',async()=>{
 for(const value of [{received:true},{reference:'LOKD-RECEIVED'},{},null,[],{reference},{saved:true,reference:'APP-short'},{saved:false,reference}]){
  let response=value;const form=ui(async()=>Response.json(response,{status:202}));await form.prepare();await form.submit();assert.equal(form.saved(),false);assert.equal(form.locked(),true);
  await form.submit();assert.equal(form.requests.length,1);response={saved:true,reference};form.retry();await flush();form.render();assert.equal(form.saved(),true);assert.equal(form.requests[1],form.requests[0]);
 }
});
test('Officer submission suppresses same-render double clicks and retries network uncertainty with the same key',async()=>{
 let release;const form=ui(()=>new Promise(resolve=>{release=resolve;}));await form.prepare();const pending=form.submit();await form.submit();assert.equal(form.requests.length,1);release(Response.json({saved:true,reference}));await pending;assert.equal(form.saved(),true);
 let lost=true;const retry=ui(async()=>{if(lost)throw new TypeError('Synthetic acknowledgement lost after commit');return Response.json({saved:true,reference});});await retry.prepare();await retry.submit();assert.equal(retry.saved(),false);assert.equal(retry.locked(),true);lost=false;retry.retry();await flush();retry.render();assert.equal(retry.saved(),true);assert.equal(retry.requests[0],retry.requests[1]);assert.match(JSON.parse(retry.requests[0]).requestKey,/^[0-9a-f-]{36}$/);
});
