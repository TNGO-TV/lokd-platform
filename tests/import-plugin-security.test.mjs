import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {ESLint} from 'eslint';
import imports from 'eslint-plugin-import-x';
import {isScopedMain} from '../vendor/eslint-plugin-import-x/lib/utils/import-type.js';
import isWebpackComment from '../vendor/eslint-plugin-import-x/lib/utils/webpack-comment.cjs';

const require=createRequire(import.meta.url);
const valid=[
 'webpackChunkName: "someModule"',
 "webpackChunkName: 'my-chunk.[index]'",
 'webpackChunkName: "[request]", webpackPrefetch: true',
 'webpackPrefetch: -30, webpackChunkName: "someModule",',
 'webpackChunkName: "someModule", webpackPreload: 0',
 'webpackChunkName: "someModule", webpackIgnore: false',
 'webpackChunkName: "someModule", webpackInclude: /\\.json$/',
 'webpackChunkName: "someModule", webpackExclude: /[a-z/]+/',
 'webpackChunkName: "someModule", webpackMode: "lazy-once"',
 'webpackChunkName: "someModule", webpackMode: "weak"',
 'webpackChunkName: "someModule", webpackExports: ["default", "named"]',
 'webpackChunkName: "someModule", webpackExports: "default"',
 'webpackChunkName: "someModule", webpackFetchPriority: "high"',
 'webpackMode: "eager"',
];
const invalid=[
 'webpackChunkName: "someModule", unknown: true',
 'webpackChunkName: "someModule", webpackMode: "invalid"',
 'webpackChunkName: "someModule", webpackPrefetch: "true"',
 'webpackChunkName: "someModule", webpackIgnore: 1',
 'webpackChunkName: "someModule", webpackInclude: "x"',
 'webpackChunkName: "someModule", webpackExports: ["ok", 1]',
 'webpackChunkName: "someModule", webpackExports: [, "ok"]',
 'webpackChunkName: "someModule", ...other',
 'webpackChunkName: "someModule", ["webpackIgnore"]: true',
 'webpackChunkName: "someModule", get webpackIgnore() { return true }',
 'webpackChunkName: "someModule", webpackIgnore: (() => { throw Error("executed") })()',
 'webpackChunkName: "someModule", webpackIgnore: (globalThis.__lokdCommentExecuted = true)',
 'webpackChunkName: "someModule", webpackIgnore: (() => { for (;;) {} })()',
 'webpackChunkName: "someModule", webpackPreload: 1+2',
 'webpackChunkName: "someModule", webpackPreload: 1.5',
 'webpackChunkName:"someModule"',
 'webpackChunkName: "someModule",  webpackIgnore: true',
 'webpackChunkName: "unterminated',
 'webpackChunkName: "someModule"}); globalThis.__lokdCommentExecuted = true; ({',
];

test('magic comments validate syntax and supported literal values without executing source',()=>{
 for(const comment of valid) assert.equal(isWebpackComment(` ${comment} `),true,comment);
 for(const comment of invalid) assert.equal(isWebpackComment(` ${comment} `),false,comment);
 assert.equal(globalThis.__lokdCommentExecuted,undefined);
});

for(const [name,plugin] of [['ESM',imports],['CJS',require('eslint-plugin-import-x')]]){
 test(`${name} chunk-name rule retains accepted comments, violations and suggestions`,async()=>{
  const eslint=new ESLint({overrideConfigFile:true,overrideConfig:{plugins:{import:plugin},rules:{'import/dynamic-import-chunkname':'error'}}});
  for(const comment of valid){
   const [result]=await eslint.lintText(`import(/* ${comment} */ 'test');`);
   assert.deepEqual(result.messages,[],comment);
  }
  for(const comment of invalid){
   const [result]=await eslint.lintText(`import(/* ${comment} */ 'test');`);
   assert.deepEqual(result.messages.map(m=>m.messageId),['webpackComment'],comment);
  }
  const cases=[
   ["import('test');",'leadingComment'],
   ['import(/*webpackChunkName: "name"*/ "test");','paddedSpaces'],
   ['import(/* webpackMode: "lazy" */ "test");','chunknameFormat'],
   ['import(/* webpackMode: "eager", webpackChunkName: "name" */ "test");','webpackEagerModeNoChunkName'],
  ];
  for(const [code,messageId] of cases){
   const [result]=await eslint.lintText(code);
   assert.deepEqual(result.messages.map(m=>m.messageId),[messageId]);
   if(messageId==='webpackEagerModeNoChunkName') assert.equal(result.messages[0].suggestions.length,2);
  }
  const custom=new ESLint({overrideConfigFile:true,overrideConfig:{plugins:{import:plugin},rules:{'import/dynamic-import-chunkname':['error',{importFunctions:['dynamicImport'],webpackChunknameFormat:'[a-z]+'}]}}});
  for(const [chunk,count] of [['name',0],['Name123',1]]){
   const [result]=await custom.lintText(`dynamicImport(/* webpackChunkName: "${chunk}" */ 'test');`);
   assert.equal(result.messages.length,count);
  }
 });
}

test('scoped package classifier preserves the upstream loose matching contract',()=>{
 const cases=[
  ['',false],['@',false],['@a',false],['@ab',true],['@@a',true],
  ['plain',false],['a@b',false],['@a/b',true],['@scope/package',true],
  ['@/package',false],['@scope/',false],['@a/b/c',false],['@a//b',false],
  ['@scope/package\n',true],['@a\r\n',true],['@a/\n',true],['@./.',true],
 ];
 for(const [name,expected] of cases) assert.equal(isScopedMain(name),expected,JSON.stringify(name));
});

test('CodeQL adversarial families complete in a bounded subprocess',()=>{
 // A process timeout can terminate a synchronous regex regression; a test-runner
 // timeout alone cannot interrupt a blocked JavaScript event loop.
 const result=spawnSync(process.execPath,['--input-type=module','-e',`
  import assert from 'node:assert/strict';
  import validate from './vendor/eslint-plugin-import-x/lib/utils/webpack-comment.cjs';
  import {isScopedMain} from './vendor/eslint-plugin-import-x/lib/utils/import-type.js';
  const repeats=100000;
  assert.equal(validate(' webpackChunkName: "'+ 'a webpackChunkName: '.repeat(repeats)+'", unknown: true '),false);
  assert.equal(validate(' webpackInclude: /'+ 'a/ webpackExclude: /'.repeat(repeats)+'! '),false);
  assert.equal(isScopedMain('@.'+'..'.repeat(repeats)+'/'),false);
  assert.equal(isScopedMain('@.'+'..'.repeat(repeats)),true);
 `],{cwd:process.cwd(),encoding:'utf8',timeout:10000,maxBuffer:1024*1024});
 assert.equal(result.error,undefined,String(result.error));
 assert.equal(result.status,0,result.stderr);
});
