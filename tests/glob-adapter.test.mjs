import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import test from 'node:test';
import dynamicImport from 'vite-plugin-dynamic-import';
const require=createRequire(import.meta.url),{getRootDirs}=require('@next/eslint-plugin-next/dist/utils/get-root-dirs.js');
const normalized=values=>[...new Set(values.map(value=>value.replaceAll('\\','/')))].sort();

test('Next directory adapter preserves reviewed root sets and linked traversal',async()=>{
 const parent=path.resolve('test-results');await fs.mkdir(parent,{recursive:true});const fixture=await fs.mkdtemp(path.join(parent,'glob-roots-'));
 try{
  for(const name of ['web','admin','.hidden'])await fs.mkdir(path.join(fixture,'apps',name,'pages'),{recursive:true});
  await fs.symlink(path.join(fixture,'apps/web'),path.join(fixture,'apps/linked'),process.platform==='win32'?'junction':'dir');
  const base=fixture.replaceAll('\\','/'),p=tail=>base+'/'+tail;
  const cases=[
   ['apps/*',['apps/admin','apps/linked','apps/web']],
   ['apps/**/pages',['apps/admin/pages','apps/linked/pages','apps/web/pages']],
   ['apps/{web,admin}',['apps/admin','apps/web']],
   ['apps/+(web|admin)',['apps/admin','apps/web']],
   ['apps/linked',['apps/linked']],
   ['apps/linked/',['apps/linked/']],
   ['apps/linked/**',['apps/linked/pages']],
   ['apps/**',['apps/admin','apps/admin/pages','apps/linked','apps/linked/pages','apps/web','apps/web/pages']],
   ['apps/.hidden/**',['apps/.hidden/pages']],
  ];
  for(const [pattern,expected] of cases)assert.deepEqual(normalized(getRootDirs({cwd:fixture,settings:{next:{rootDir:p(pattern)}}})),normalized(expected.map(p)),pattern);
  assert.deepEqual(normalized(getRootDirs({cwd:fixture,settings:{next:{rootDir:base+'//apps/*'}}})),normalized(['apps/admin','apps/linked','apps/web'].map(p)));
  assert.deepEqual(normalized(getRootDirs({cwd:fixture,settings:{next:{rootDir:[p('apps/web'),p('apps/admin')]}}})),normalized(['apps/web','apps/admin'].map(p)));
 }finally{assert.equal(path.dirname(path.resolve(fixture)),parent);await fs.rm(fixture,{recursive:true,force:true});}
});

test('dynamic import fork executes generated imports and preserves unknown-module failure',async()=>{
 const parent=path.resolve('test-results');await fs.mkdir(parent,{recursive:true});const fixture=await fs.mkdtemp(path.join(parent,'dynamic-import-'));
 try{
  await fs.writeFile(path.join(fixture,'package.json'),'{"type":"module"}');
  for(const [name,value] of [['a.js','a'],['deep/c.js','c'],['folder/index.js','index']]){const target=path.join(fixture,'modules',name);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,'export default '+JSON.stringify(value)+';');}
  const plugin=dynamicImport({loose:true});plugin.configResolved({createResolver:()=>async()=>undefined,resolve:{alias:[],extensions:['.js','.ts']},optimizeDeps:{}});
  const code="export const load = name => import('./modules/' + name + '.js');";
  const result=await plugin.transform(code,path.join(fixture,'entry.js'));assert.ok(result?.map);
  const output=path.join(fixture,'compiled.mjs');await fs.writeFile(output,result.code);const compiled=await import(pathToFileURL(output).href);
  assert.equal((await compiled.load('a')).default,'a');assert.equal((await compiled.load('deep/c')).default,'c');assert.equal((await compiled.load('folder/index')).default,'index');
  await assert.rejects(()=>compiled.load('missing'),/Unknown variable dynamic import/);
 }finally{assert.equal(path.dirname(path.resolve(fixture)),parent);await fs.rm(fixture,{recursive:true,force:true});}
});
