import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync(new URL('../app/components/client-enquiry-form.tsx',import.meta.url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const reference='ENQ-11111111-1111-4111-8111-111111111111';
const flush=async()=>{for(let i=0;i<3;i++)await new Promise(setImmediate);};
function fixture(respond){
 const slots=[],calls=[],submitted=[],exports={},jsx=(type,props)=>({type,props});let index=0,tree;
 const values={organisationName:'Fixture organisation',siteArea:'Pretoria',privacyConsent:'on',advanceFundingAcknowledged:'on'};
 const modules={'react/jsx-runtime':{jsx,jsxs:jsx},'next/link':{default:'a'},'./sandbox-command-recovery':{default:'sandbox-recovery'},react:{useEffect:()=>{},useState:initial=>{const key=index++;if(!(key in slots))slots[key]=initial;return [slots[key],value=>{slots[key]=value;}];},useRef:initial=>slots[index++]??=( {current:initial} )}};
 vm.runInNewContext(code,{exports,require:key=>modules[key],crypto,Error,TypeError,SyntaxError,FormData:class{get(key){return values[key]??'';}},fetch:async(_url,options)=>{calls.push(options.body);return respond(options.body);}});
 function find(node,predicate){if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const child of [node.props?.children].flat(Infinity)){const match=find(child,predicate);if(match)return match;}return null;}
 const render=()=>{index=0;tree=exports.default({onSubmitted:id=>submitted.push(id)});};render();
 return {calls,submitted,values,submit(){return tree.props.onSubmit({preventDefault(){},currentTarget:{}});},retry(){render();return find(tree,node=>node.type==='button'&&node.props.children==='Retry original enquiry').props.onClick();},render,locked(){render();return find(tree,node=>node.type==='fieldset')?.props.disabled;},hasSuccess(){render();return Boolean(find(tree,node=>node.type==='h2'&&node.props.children==='We have your operating brief.'));}};
}
test('public enquiry double-clicks share one in-flight request and one saved receipt',async()=>{
 let release;const ui=fixture(()=>new Promise(resolve=>{release=resolve;}));const first=ui.submit();await ui.submit();assert.equal(ui.calls.length,1);
 release(Response.json({saved:true,reference}));await first;assert.deepEqual(ui.submitted,[reference]);assert.equal(ui.hasSuccess(),true);
});
test('generic and malformed success bodies never claim saving and recover with the exact original key and body',async()=>{
 for(const body of [{reference:'LOKD-RECEIVED'},{},null,[],{saved:true,reference:'ENQ-short'},{saved:false,reference},{reference}]){
  let response=body;const ui=fixture(async()=>Response.json(response,{status:202}));await ui.submit();assert.equal(ui.hasSuccess(),false);assert.deepEqual(ui.submitted,[]);assert.equal(ui.locked(),true);
  ui.values.siteArea='An edited form cannot change the recovery request';await ui.submit();assert.equal(ui.calls.length,1);
  response={saved:true,reference};ui.retry();await flush();assert.equal(ui.calls[1],ui.calls[0]);assert.deepEqual(ui.submitted,[reference]);
 }
});
test('network uncertainty preserves the submission for an exact retry',async()=>{
 let fail=true;const ui=fixture(async()=>{if(fail)throw new TypeError('network unavailable');return Response.json({saved:true,reference});});
 await ui.submit();assert.equal(ui.locked(),true);assert.equal(ui.hasSuccess(),false);fail=false;ui.retry();await flush();assert.equal(ui.calls[1],ui.calls[0]);assert.deepEqual(ui.submitted,[reference]);
});
test('rejected identical input reuses its key while a changed brief gets a fresh key',async()=>{
 const ui=fixture(async()=>Response.json({error:'Review the details'},{status:422}));await ui.submit();ui.render();await ui.submit();assert.equal(ui.calls[1],ui.calls[0]);
 ui.values.siteArea='A different site';ui.render();await ui.submit();const old=JSON.parse(ui.calls[0]),changed=JSON.parse(ui.calls[2]);assert.notEqual(old.requestKey,changed.requestKey);assert.equal(changed.siteArea,'A different site');assert.equal(ui.hasSuccess(),false);
});
