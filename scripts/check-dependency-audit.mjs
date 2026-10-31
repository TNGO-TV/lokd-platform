import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const actionable=new Set(['moderate','high','critical']);
const severities=['info','low','moderate','high','critical'];
export function assessAudit(report) {
 if(report?.auditReportVersion!==2||report.error||!report.metadata?.vulnerabilities||!report.vulnerabilities||typeof report.vulnerabilities!=='object'||Array.isArray(report.vulnerabilities))throw Error('Missing or invalid npm audit evidence');
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
 // npm reports package-level metavulnerabilities, whose severity can differ
 // from an underlying advisory. Its dependency graph can also contain cycles.
 // Validate every node first, then collect reachable roots without recursion.
 for(const [name,finding] of Object.entries(report.vulnerabilities)){
  if(finding.name!==name||!Array.isArray(finding.nodes)||!finding.nodes.length
   ||finding.nodes.some(node=>typeof node!=='string'||!node)
   ||!Array.isArray(finding.via)||!finding.via.length)throw Error('Incomplete advisory graph');
  for(const via of finding.via){
   if(typeof via==='string'){
    if(!Object.hasOwn(report.vulnerabilities,via))throw Error('Incomplete transitive advisory graph');
   }else if(!via||typeof via.url!=='string'||!via.url||!severities.includes(via.severity))throw Error('Invalid advisory record');
  }
 }
 const severityDifferences=[];
 for(const finding of findings){
  const pending=[finding.name],seen=new Set(),roots=new Map();
  while(pending.length){
   const name=pending.pop();if(seen.has(name))continue;seen.add(name);
   for(const via of report.vulnerabilities[name].via){
    if(typeof via==='string')pending.push(via);
    else roots.set(via.url+'\0'+via.severity,via);
   }
  }
  if(!roots.size)throw Error('Missing advisory roots');
  const rootSeverity=severities[Math.max(...[...roots.values()].map(via=>severities.indexOf(via.severity)))];
  if(finding.severity!==rootSeverity)severityDifferences.push({package:finding.name,reported:finding.severity,root:rootSeverity});
  for(const via of roots.values()){
   // Neither a lower package severity nor a lower root severity can hide an
   // actionable finding. No development-only or advisory exceptions apply.
   const severity=severities[Math.max(severities.indexOf(finding.severity),severities.indexOf(via.severity))];
   if(actionable.has(severity))blocked.push({package:finding.name,advisory:via.url,severity});
  }
 }
 return {ok:blocked.length===0,blocked,dispositions,raw:reported,severityDifferences};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try {
  if(!process.env.npm_execpath)throw Error('Run through npm run check:security so the accepted npm executable is explicit');
  const result=spawnSync(process.execPath,[process.env.npm_execpath,'audit','--json','--audit=true','--package-lock-only','--audit-level=moderate'],{encoding:'utf8',timeout:120000,maxBuffer:10_000_000});
  if(result.error||![0,1].includes(result.status))throw Error('npm audit did not produce a valid completed result');
  const report=JSON.parse(result.stdout);
  fs.mkdirSync('test-results',{recursive:true});
  let assessed;
  try {assessed=assessAudit(report);}catch(error){
   fs.writeFileSync('test-results/dependency-audit.json',JSON.stringify({npmExit:result.status,report,assessment:null,assessmentError:error.message},null,2)+'\n');
   throw error;
  }
  fs.writeFileSync('test-results/dependency-audit.json',JSON.stringify({npmExit:result.status,report,assessment:assessed},null,2)+'\n');
  console.log(JSON.stringify(assessed));
  if(!assessed.ok)process.exitCode=1;
 }catch(error){console.error('Dependency gate failed: '+error.message);process.exitCode=1;}
}
