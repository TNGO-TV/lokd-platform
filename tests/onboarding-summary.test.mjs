import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

async function render(scope, checklist) {
  let source=fs.readFileSync(new URL('../app/components/portal-onboarding-summary.tsx',import.meta.url),'utf8');
  const state={state:{cases:[{checklist}]},loading:false,error:'',refresh:()=>{}};
  source=source.replace('import { useOnboarding } from "../lib/use-onboarding";', `const useOnboarding = () => (${JSON.stringify(state)});`);
  let code=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  code=code.replaceAll('"react/jsx-runtime"',JSON.stringify(import.meta.resolve('react/jsx-runtime')));
  const componentModule=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
  return renderToStaticMarkup(createElement(componentModule.PortalOnboardingSummary,{scope}));
}
test('incomplete onboarding has no success tick and agreement preparation never implies a live signature', async()=>{
  for (const scope of ['client','officer']) {
    const html=await render(scope,[{id:'1',label:'Identity',status:'verified_demo'},{id:'2',label:'Agreement',status:'manual_review'}]);
    assert.match(html,/50%/);
    assert.equal((html.match(/>✓</g)||[]).length,1);
    assert.match(html,/Not complete · manual review/);
    assert.match(html,/Live agreement signing is not open/);
    assert.match(html,/Draft documents and completed demo checks do not count as signed agreements/);
    assert.match(html,/Simulation only/);
  }
});
