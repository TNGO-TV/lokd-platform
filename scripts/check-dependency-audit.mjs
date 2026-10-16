import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const actionable=new Set(['moderate','high','critical']);
const severities=['info','low','moderate','high','critical'];
export function assessAudit(report) {
 if(report?.auditReportVersion!==2||report.error||!report.metadata?.vulnerabilities||!report.vulnerabilities||typeof report.vulnerabilities!=='object')throw Error('Missing or invalid npm audit evidence');
 const findings=Object.values(report.vulnerabilities),blocked=[],dispositions=[];
 const reported=report.metadata.vulnerabilities;
 if(!Number.isSafeInteger(reported.total)||reported.total<0||severities.some(s=>!Number.isSafeInteger(reported[s])||reported[s]<0)
  ||severities.reduce((sum,s)=>sum+reported[s],0)!==reported.total||reported.total!==findings.length)throw Error('Inconsistent advisory totals');
 const counted=Object.fromEntries(severities.map(s=>[s,0]));
 for(const finding of findings){
  if(!severities.includes(finding.severity))throw Error('Invalid finding severity');
  counted[finding.severity]++;
 }
 if(severities.some(s=>counted[s]!==reported[s]))throw Error('Inconsistent advisory severity counts');
 const roots=new Set();
 const visit=(name,parents=new Set())=>{
  if(parents.has(name))throw Error('Cyclic advisory graph');
  const finding=report.vulnerabilities[name];
  if(!finding||finding.name!==name||!Array.isArray(finding.via)||!finding.via.length)throw Error('Incomplete advisory graph');
  const chain=new Set([...parents,name]);
  const rootLevels=finding.via.map(via=>{
   if(typeof via==='string')return visit(via,chain);
   if(!via?.url||!severities.includes(via.severity))throw Error('Invalid advisory record');
   return severities.indexOf(via.severity);
  });
  const highest=Math.max(...rootLevels);
  if(severities.indexOf(finding.severity)!==highest)throw Error('Inconsistent finding and root advisory severity');
  return highest;
 };
 for(const name of Object.keys(report.vulnerabilities))visit(name);
 for(const finding of findings){
  if(!Array.isArray(finding.via)||!Array.isArray(finding.nodes)||!finding.nodes.length||!finding.via.length)throw Error('Incomplete advisory graph');
  for(const via of finding.via){
   if(typeof via==='string'){if(!report.vulnerabilities[via])throw Error('Incomplete transitive advisory graph');continue;}
   if(!via?.url||!severities.includes(via.severity))throw Error('Invalid advisory record');
   roots.add(via.url);
   if(!actionable.has(via.severity))continue;
   blocked.push({package:finding.name,advisory:via.url,severity:via.severity});
  }
 }
 if(findings.length&&!roots.size)throw Error('Missing advisory roots');
 return {ok:blocked.length===0,blocked,dispositions,raw:reported};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try {
  if(!process.env.npm_execpath)throw Error('Run through npm run check:security so the accepted npm executable is explicit');
  const result=spawnSync(process.execPath,[process.env.npm_execpath,'audit','--json','--audit=true','--package-lock-only','--audit-level=moderate'],{encoding:'utf8',timeout:120000,maxBuffer:10_000_000});
  if(result.error||![0,1].includes(result.status))throw Error('npm audit did not produce a valid completed result');
  const report=JSON.parse(result.stdout);
  const assessed=assessAudit(report);
  fs.mkdirSync('test-results',{recursive:true});
  fs.writeFileSync('test-results/dependency-audit.json',JSON.stringify({npmExit:result.status,report,assessment:assessed},null,2)+'\n');
  console.log(JSON.stringify(assessed));
  if(!assessed.ok)process.exitCode=1;
 }catch(error){console.error('Dependency gate failed: '+error.message);process.exitCode=1;}
}
