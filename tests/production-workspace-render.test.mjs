import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import * as React from 'react';
import * as jsx from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
import * as signup from '../app/lib/signup-types.ts';
import * as psira from '../app/lib/psira-pathway.ts';

const link=({children,prefetch: _prefetch,...props})=>React.createElement('a',props,children);
const image=({unoptimized: _unoptimized,...props})=>React.createElement('img',props);
function load(name,modules,extra='') {
 const source=fs.readFileSync(new URL('../app/components/'+name,import.meta.url),'utf8')+extra;
 const code=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};
 vm.runInNewContext(code,{exports,Intl,URLSearchParams,require:key=>{
  if(key.endsWith('.module.css'))return {default:{}};
  assert.ok(key in modules,key);return modules[key];
 }});
 return exports;
}
const modules={react:React,'react/jsx-runtime':jsx,'next/link':{default:link},'next/image':{default:image},'next/navigation':{usePathname:()=>'/officer',useSearchParams:()=>new URLSearchParams()},'../lib/signup-types':signup,'../lib/psira-pathway':psira};
modules['./test-surface-context']=load('test-surface-context.tsx',modules);
modules['./test-agreement-panel']={default:()=>React.createElement('div',{'data-rehearsal-agreement':'true'},'Test agreement fixture')};
modules['./officer-presence-panel']=load('officer-presence-panel.tsx',modules);
const Shell=load('workspace-shell.tsx',modules).default;
const Card=load('signup-portal.tsx',modules,'\nexport {RecordCard};').RecordCard;

test('rendered production workspaces and populated intake cards expose real actions without rehearsal controls',()=>{
 for(const role of ['client','officer','operations'])for(const kind of role==='operations'?['client','officer']:[role]){
  const record={kind,id:'APP-render-fixture',version:2,updatedAt:'2026-10-16T00:00:00Z',details:{fullName:'Officer fixture',organisationName:'Client fixture',pathway:'qualified',psiraStatus:'active'},email:'isolated@example.test',accountLinked:true,status:'reviewed',events:[]};
  const card=React.createElement(Card,{record,operations:role==='operations',busy:false,run:async()=>true,refresh:async()=>true});
  const children=React.createElement(React.Fragment,null,card,role==='officer'?React.createElement(modules['./officer-presence-panel'].default):null);
  const render=testTools=>renderToStaticMarkup(React.createElement(Shell,{role,testTools},children));
  const production=render(false);
  assert.match(production,/Agreements/);assert.match(production,/Service &amp; payments/);
  assert.match(production,/APP-render-fixture/);
  assert.doesNotMatch(production,/Testing tools|Sandbox workflows|test-cycle|payment-test|data-rehearsal-agreement|synthetic test signal|identity\?caseId/);
  if(kind==='officer')assert.match(production,/readiness\?applicantId=APP-render-fixture/);
  if(role==='operations')assert.match(production,/Prepare operational record/);
  const isolated=render(true);
  assert.match(isolated,/Testing tools/);assert.match(isolated,/data-rehearsal-agreement/);
  if(role==='officer'){assert.match(production,/Stop public sharing/);assert.match(isolated,/synthetic test signal/);}
 }
});
