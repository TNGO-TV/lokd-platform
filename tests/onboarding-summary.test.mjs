import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
async function render(state){
 let source=fs.readFileSync(new URL('../app/components/portal-onboarding-summary.tsx',import.meta.url),'utf8');
 globalThis.__lokdOnboardingState=state;
 source=source.replace('import { useOnboarding } from "../lib/use-onboarding";','const useOnboarding=()=>globalThis.__lokdOnboardingState;');
 let code=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 code=code.replaceAll('"react/jsx-runtime"',JSON.stringify(import.meta.resolve('react/jsx-runtime')));
 const componentModule=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 return renderToStaticMarkup(createElement(componentModule.PortalOnboardingSummary,{scope:'officer'}));
}
test('real progress labels incomplete requirements and exposes signed agreement route',async()=>{
 const html=await render({loading:false,error:'',state:{cases:[{id:'APP-1',displayName:'Officer',checklist:[{id:'identity',label:'Identity check',status:'complete',href:'/officer/identity'},{id:'agreement',label:'Workforce agreement',status:'required',href:'/officer/agreements'}]}]}});
 assert.match(html,/50% complete/);assert.equal((html.match(/>✓<\/span>/g)||[]).length,1);assert.match(html,/Required/);assert.match(html,/href="\/officer\/agreements"/);
});
test('missing linked application is a real empty state',async()=>{const html=await render({loading:false,error:'',state:{cases:[]}});assert.match(html,/No linked application yet/);assert.match(html,/href="\/join"/);});
test('failed refresh hides stale progress and offers a retry',async()=>{const html=await render({loading:false,error:'Request failed',state:null});assert.match(html,/role="alert"/);assert.match(html,/Request failed/);assert.match(html,/Try again/);});
