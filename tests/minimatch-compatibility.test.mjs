import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {ESLint} from 'eslint';
import react from '@lokd/eslint-plugin-react-compat';
import imports from 'eslint-plugin-import-x';

const require=createRequire(import.meta.url);
const consumers=['eslint','@eslint/config-array','@typescript-eslint/typescript-estree',
 'eslint-plugin-import-x','eslint-plugin-jsx-a11y-x','@lokd/eslint-plugin-react-compat'];

test('scoped patched minimatch consumers preserve lint path and component matching',()=>{
 const cases=[
  ['app/client/page.tsx','**/*.{js,jsx,ts,tsx}',{},true],
  ['app/client/page.css','**/*.{js,jsx,ts,tsx}',{},false],
  ['.config/local.ts','**/*.ts',{},false],
  ['.config/local.ts','**/*.ts',{dot:true},true],
  ['app/page.ts','*.ts',{matchBase:true},true],
  ['app/client/page.ts','app/*/page.ts',{},true],
  ['app/client/deep/page.ts','app/*/page.ts',{},false],
  ['app/client/page.ts','app/**/page.ts',{},true],
  ['app/client/page.ts','app/**/page.ts',{noglobstar:true},true],
  ['app/client/deep/page.ts','app/**/page.ts',{noglobstar:true},false],
  ['HtmlView','@(Html|Raw)*',{},true],
  ['SafeView','@(Html|Raw)*',{},false],
  ['renderCell','render*',{},true],
  ['createCell','render*',{},false],
  ['data-private','data-*',{},true],
  ['className','data-*',{},false],
 ];
 for(const consumer of consumers){
  const from=createRequire(require.resolve(consumer));
  const matcher=from('minimatch');assert.equal(from('minimatch/package.json').version,'11.0.3',consumer);
  for(const [input,pattern,options,expected] of cases){
   assert.equal(matcher.minimatch(input,pattern,options),expected,consumer+' '+input+' '+pattern);
   assert.equal(new matcher.Minimatch(pattern,options).match(input),expected,consumer+' class '+pattern);
  }
 }
});

test('import rule ESM and CJS keep allow/forbid decisions without regex compilation',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'lokd-import-globs-'));
 try{
  for(const directory of ['private','allowed']){fs.mkdirSync(path.join(root,directory));fs.writeFileSync(path.join(root,directory,'entry.js'),'export default 1;');}
  for(const plugin of [imports,require('eslint-plugin-import-x')]){
   for(const options of [{allow:['**/allowed/**']},{forbid:['**/private/**']}]){
    const eslint=new ESLint({cwd:root,overrideConfigFile:true,overrideConfig:{plugins:{import:plugin},rules:{'import/no-internal-modules':['error',options]}}});
    for(const [directory,count] of [['private',1],['allowed',0]]){
     const [result]=await eslint.lintText(`import './${directory}/entry.js';`,{filePath:path.join(root,'entry.js')});
     assert.equal(result.fatalErrorCount,0);assert.equal(result.messages.length,count,JSON.stringify(options)+' '+directory);
     assert.ok(result.messages.every(m=>m.ruleId==='import/no-internal-modules'));
    }
   }
  }
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('all five adapted React rules still apply custom glob options and report violations',async()=>{
 const fixtures=[
  ['no-danger',{customComponentNames:['Html*']},'<HtmlPanel dangerouslySetInnerHTML={html} />;','<SafePanel dangerouslySetInnerHTML={html} />;'],
  ['jsx-pascal-case',{ignore:['Legacy_*']},'<Other_bad />;','<Legacy_bad />;'],
  ['jsx-handler-names',{checkLocalVariables:true,ignoreComponentNames:['Legacy*']},'<Button onClick={bad} />;','<LegacyButton onClick={bad} />;'],
  ['forbid-component-props',{forbid:[{propNamePattern:'data-*',allowedForPatterns:['Safe*']}]},'<Box data-private="x" />;','<SafeBox data-private="x" />;'],
  ['no-unstable-nested-components',{propNamePattern:'draw*'},'function Parent(){return <List createItem={() => <div />} />;}','function Parent(){return <List drawItem={() => <div />} />;}'],
 ];
 for(const [name,options,invalid,valid] of fixtures){
  const eslint=new ESLint({overrideConfigFile:true,overrideConfig:{files:['**/*.jsx'],
   languageOptions:{ecmaVersion:'latest',sourceType:'module',parserOptions:{ecmaFeatures:{jsx:true}}},
   plugins:{react},settings:{react:{version:'19.3.1'}},rules:{['react/'+name]:['error',options]}}});
  const [bad]=await eslint.lintText(invalid,{filePath:'fixture.jsx'});
  const [good]=await eslint.lintText(valid,{filePath:'fixture.jsx'});
  assert.equal(bad.fatalErrorCount,0,name);assert.equal(good.fatalErrorCount,0,name);
  assert.deepEqual(bad.messages.map(m=>m.ruleId),['react/'+name],name+' violation');
  assert.deepEqual(good.messages,[],name+' accepted pattern');
 }
});
