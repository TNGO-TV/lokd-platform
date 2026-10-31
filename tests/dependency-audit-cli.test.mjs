import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

test('CLI rejects actionable and malformed reports even when npm exits zero',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'lokd-audit-cli-'));
 const gate=fileURLToPath(new URL('../scripts/check-dependency-audit.mjs',import.meta.url));
 const npm=path.join(root,'npm-fixture.cjs');
 const clean={auditReportVersion:2,metadata:{vulnerabilities:{info:0,low:0,moderate:0,high:0,critical:0,total:0}},vulnerabilities:{}};
 const high=structuredClone(clean);high.metadata.vulnerabilities.high=1;high.metadata.vulnerabilities.total=1;
 high.vulnerabilities.unknown={name:'unknown',severity:'high',nodes:['node_modules/unknown'],via:[{name:'unknown',severity:'high',url:'https://example.test/new-advisory'}]};
 try {
  fs.writeFileSync(path.join(root,'package-lock.json'),JSON.stringify({packages:{}}));
  for(const [output,npmExit,expected] of [[JSON.stringify(high),0,1],['invalid-json',0,1],[JSON.stringify(clean),2,1],[JSON.stringify(clean),0,0]]){
   fs.writeFileSync(npm,`process.stdout.write(${JSON.stringify(output)});process.exitCode=${npmExit};`);
   const result=spawnSync(process.execPath,[gate],{cwd:root,env:{...process.env,npm_execpath:npm},encoding:'utf8',timeout:15000});
   assert.equal(result.status,expected,result.stderr);
  }
  const malformed=structuredClone(high);malformed.vulnerabilities.unknown.via=['missing'];
  fs.writeFileSync(npm,`process.stdout.write(${JSON.stringify(JSON.stringify(malformed))});`);
  const failed=spawnSync(process.execPath,[gate],{cwd:root,env:{...process.env,npm_execpath:npm},encoding:'utf8',timeout:15000});
  assert.equal(failed.status,1);
  const evidence=JSON.parse(fs.readFileSync(path.join(root,'test-results/dependency-audit.json'),'utf8'));
  assert.deepEqual(evidence.report,malformed);assert.equal(evidence.assessment,null);
  assert.match(evidence.assessmentError,/Incomplete transitive advisory graph/);
 } finally {fs.rmSync(root,{recursive:true,force:true});}
});
