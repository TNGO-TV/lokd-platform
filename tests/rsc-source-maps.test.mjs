import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import {TraceMap,originalPositionFor} from '@jridgewell/trace-mapping';
import {mapRscTransform,rscSourceMaps} from '../build/rsc-source-maps.ts';

// Extract the installed upstream handlers, without importing the build runtime or
// rewriting their predicates. This fails if the package changes the hook shapes.
const require=createRequire(import.meta.url);
const entry=require.resolve('@vitejs/plugin-rsc');
const directory=path.dirname(entry);
const sources=fs.readdirSync(directory).filter(name=>name.endsWith('.js')).map(name=>{
 const text=fs.readFileSync(path.join(directory,name),'utf8');
 return ts.createSourceFile(name,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
});
const vinextRoot=path.dirname(path.dirname(fileURLToPath(import.meta.resolve('vinext'))));
sources.push(ts.createSourceFile('action-owner-manifest.js',fs.readFileSync(path.join(vinextRoot,'dist/plugins/action-owner-manifest.js'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS));
function property(node,name){return node.properties.find(p=>p.name&&(p.name.text??p.name.getText())===name);}
function hook(pluginName,hookName,globals={}){
 let found;
 for(const source of sources){
  function visit(node){
   if(ts.isObjectLiteralExpression(node)&&property(node,'name')?.initializer?.text===pluginName){
    const member=property(node,hookName);
    const method=ts.isMethodDeclaration(member)?member:property(member.initializer,'handler');
    found=vm.runInNewContext('({'+method.getText(source)+'})',{assert,path,...globals})[method.name.text];
   }
   ts.forEachChild(node,visit);
  }
  visit(source);
 }
 assert.equal(typeof found,'function',pluginName);
 return found;
}
function locate(code,needle){const index=code.indexOf(needle);assert.ok(index>=0);const before=code.slice(0,index).split('\n');return {line:before.length,column:before.at(-1).length};}
function assertPosition(result,input,needle){
 const position=originalPositionFor(new TraceMap(result.map),locate(result.code,needle));
 assert.deepEqual({line:position.line,column:position.column},locate(input,needle));
 assert.equal(result.map.sourcesContent[0],input);
}
test('actual upstream AsyncLocalStorage edits retain their predicates and map unchanged source',async()=>{
 const input='const storage = typeof AsyncLocalStorage === "function" ? new AsyncLocalStorage() : null;\nexport {storage};';
 for(const isRolldownVite of [false,true]){
  const handler=hook('rsc:inject-async-local-storage','transform',{isRolldownVite});
  for(const name of ['client','ssr','rsc'])for(const mode of ['dev','build']){
   const output=await handler.call({environment:{name,mode}},input);
   const mapped=mapRscTransform(input,output,'fixture.js','prefix');
   if(name==='client'){assert.equal(mapped,undefined);continue;}
   assert.equal(mapped.code,output);
   assert.match(mapped.code,isRolldownVite||mode==='dev'?/^import \* as/:/^const __viteRscAsyncHooks = require/);
   assertPosition(mapped,input,'const storage');assertPosition(mapped,input,'export {storage}');
  }
  assert.equal(handler.call({environment:{name:'rsc',mode:'build'}},'const untouched = 1;'),undefined);
 }
});
test('actual manifest replacement maps multiple edits and preserves surrounding positions',()=>{
 const handler=hook('rsc:virtual:vite-rsc/assets-manifest','renderChunk',{
  BUILD_ASSETS_MANIFEST_NAME:'__vite_rsc_assets_manifest.js',
  normalizeRelativePath:value=>value.startsWith('.')?value:'./'+value,
 });
 const input='import manifest from "virtual:vite-rsc/assets-manifest"; const first = 1;\nconst second = import("virtual:vite-rsc/assets-manifest"); export {first};';
 for(const fileName of ['entry.js','chunks/nested/entry.js']){
  const output=handler.call({environment:{name:'rsc'}},input,{fileName});
  const mapped=mapRscTransform(input,output,fileName,'manifest');
  assert.equal(mapped.code,output.code);
  assertPosition(mapped,input,'const first');assertPosition(mapped,input,'const second');assertPosition(mapped,input,'export {first}');
 }
 assert.equal(handler.call({environment:{name:'rsc'}},'const untouched = 1;',{fileName:'entry.js'}),undefined);
 assert.throws(()=>handler.call({environment:{name:'client'}},input,{fileName:'entry.js'}));
});
test('adapter preserves hook filters/context and fails closed on changed transform semantics',async()=>{
 const context={environment:{name:'rsc',mode:'build'}};
 const transform={filter:{code:'typeof AsyncLocalStorage'},handler:hook('rsc:inject-async-local-storage','transform',{isRolldownVite:true})};
 const plugins=[{name:'rsc:inject-async-local-storage',transform},{name:'rsc:virtual:vite-rsc/assets-manifest',renderChunk:()=>undefined},{name:'vinext:action-owner-manifest',renderChunk:()=>undefined}];
 rscSourceMaps().configResolved({plugins});
 assert.equal(plugins[0].transform.filter,transform.filter);
 const input='typeof AsyncLocalStorage; new AsyncLocalStorage();';
 const result=await plugins[0].transform.handler.call(context,input,'fixture.js');
 assertPosition(result,input,'typeof AsyncLocalStorage');
 assert.throws(()=>mapRscTransform('abc','abc modified','fixture.js','prefix'),/changed/);
 assert.throws(()=>mapRscTransform('abc',{code:'different'},'fixture.js','manifest'),/changed/);
 assert.throws(()=>rscSourceMaps().configResolved({plugins:[]}),/exactly three/);
 const mapped={code:'different',map:{version:3}};
 assert.equal(mapRscTransform('abc',mapped,'fixture.js','prefix'),mapped);
});

test('actual Vinext action-owner manifest edits preserve token positions and source content',()=>{
 const handler=hook('vinext:action-owner-manifest','renderChunk',{ACTION_OWNER_MANIFEST_ID:'virtual:vinext-action-owner-manifest',ACTION_OWNER_MANIFEST_FILE:'__vinext_action_owner_manifest.js'});
 const input='import owners from "virtual:vinext-action-owner-manifest"; const first = 1;\nconst second = import("virtual:vinext-action-owner-manifest"); export {first};';
 for(const fileName of ['entry.js','chunks/nested/entry.js']){
  const output=handler.call({},input,{fileName}),mapped=mapRscTransform(input,output,fileName,'action-manifest');
  assert.equal(mapped.code,output.code);assertPosition(mapped,input,'const first');assertPosition(mapped,input,'const second');assertPosition(mapped,input,'export {first}');
 }
 assert.equal(handler.call({},'const untouched = 1;',{fileName:'entry.js'}),undefined);
});
