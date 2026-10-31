import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const packages={'drizzle-kit':'drizzle-kit','next-eslint-plugin-next':'@next/eslint-plugin-next','vite-plugin-dynamic-import':'vite-plugin-dynamic-import','eslint-plugin-react-compat':'@lokd/eslint-plugin-react-compat','eslint-plugin-import-x':'eslint-plugin-import-x'};
function files(root,relative=''){return fs.readdirSync(path.join(root,relative),{withFileTypes:true}).flatMap(entry=>entry.name==='node_modules'?[]:entry.isDirectory()?files(root,path.join(relative,entry.name)):[path.join(relative,entry.name)]);}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),results=[];
for(const [folder,name] of Object.entries(packages)){
 const source=path.resolve('vendor',folder),installed=path.resolve('node_modules',name),seen=new Set();
 for(const file of files(installed)){
  if(file==='LOKD-PROVENANCE.json')continue;
  assert.equal(fs.existsSync(path.join(source,file)),true,name+' has unexpected installed file '+file);
  assert.equal(hash(fs.readFileSync(path.join(installed,file))),hash(fs.readFileSync(path.join(source,file))),name+'/'+file);
  seen.add(file);
 }
 for(const file of files(source).filter(file=>/\.(?:[cm]?js|json|map|ts)$/.test(file)&&file!=='LOKD-PROVENANCE.json'))assert.equal(seen.has(file),true,name+' missing installed file '+file);
 results.push({name,version:JSON.parse(fs.readFileSync(path.join(source,'package.json'),'utf8')).version,verifiedFiles:seen.size});
}
console.log(JSON.stringify({packages:results}));
