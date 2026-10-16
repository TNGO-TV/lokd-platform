import type {Plugin} from 'vite';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

const toolingPattern=/(?:^|\/)(?:node_modules\/)?(?:braces|micromatch|fast-glob)(?:\/|$)/;
type Bundle=Record<string,{type:string;modules?:Record<string,unknown>;imports?:readonly string[];dynamicImports?:readonly string[]}>;
export function assertDependencyBoundary(bundle:Bundle){
 const modules:string[]=[];
 for(const output of Object.values(bundle))if(output.type==='chunk'){
  const ids=[...Object.keys(output.modules??{}),...output.imports??[],...output.dynamicImports??[]];
  for(const id of ids){
   const normalized=id.replaceAll('\\','/');
   if(toolingPattern.test(normalized))throw new Error('Development-only glob parser reached a deployed bundle: '+normalized);
   modules.push(normalized);
  }
 }
 return {checkedPackages:['braces','micromatch','fast-glob'],moduleCount:modules.length,moduleGraphSha256:createHash('sha256').update(modules.sort().join('\n')).digest('hex')};
}
export function dependencyBoundary():Plugin{
 return {name:'lokd-dependency-boundary',apply:'build',generateBundle(_options,bundle){
  const evidence=assertDependencyBoundary(bundle);
  const folder=resolve('test-results');mkdirSync(folder,{recursive:true});
  writeFileSync(resolve(folder,`dependency-boundary-${this.environment.name}.json`),JSON.stringify(evidence,null,2)+'\n');
 }};
}
