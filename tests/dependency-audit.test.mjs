import assert from 'node:assert/strict';
import test from 'node:test';
import {assessAudit} from '../scripts/check-dependency-audit.mjs';
import {assertDependencyBoundary} from '../build/dependency-boundary.ts';
const url='https://github.com/advisories/GHSA-vfj7-8cjw-p6xm';
const report=()=>({auditReportVersion:2,metadata:{vulnerabilities:{total:1,info:0,low:0,moderate:0,high:1,critical:0}},vulnerabilities:{braces:{name:'braces',severity:'high',nodes:['node_modules/braces'],via:[{name:'braces',url,severity:'high'}]}}});
const lock=()=>({packages:{'node_modules/braces':{version:'3.0.3',dev:true}}});
const now=Date.parse('2026-10-16T00:00:00Z');
test('development-only findings receive no advisory exception',()=>{
 const result=assessAudit(report(),lock(),now);assert.equal(result.ok,false);assert.deepEqual(result.dispositions,[]);
 assert.equal(result.blocked[0].advisory,url);
 const clean=report();clean.vulnerabilities={};clean.metadata.vulnerabilities={total:0,info:0,low:0,moderate:0,high:0,critical:0};
 assert.equal(assessAudit(clean).ok,true);
 assert.throws(()=>assessAudit({...clean,vulnerabilities:[]}));
});

test('audit enforcement fails malformed results, missing graph evidence and new findings independently of npm exit code',()=>{
 for(const r of [{},{...report(),error:{}},{...report(),metadata:{vulnerabilities:{total:0}}}])assert.throws(()=>assessAudit(r,lock(),now));
 const r=report();r.vulnerabilities.braces.via.push({name:'braces',url:'https://example.test/new',severity:'moderate'});
 assert.equal(assessAudit(r,lock(),now).ok,false);
 const missing=report();missing.vulnerabilities.braces.via=['missing'];assert.throws(()=>assessAudit(missing,lock(),now));
 for(const alter of [r=>{r.vulnerabilities={};r.metadata.vulnerabilities={total:0,info:0,low:0,moderate:0,high:0,critical:1};},
  r=>r.metadata.vulnerabilities.high=-1,r=>r.metadata.vulnerabilities.high=0.5,
  r=>r.vulnerabilities.braces.severity='unknown']){
  const malformed=report();alter(malformed);assert.throws(()=>assessAudit(malformed,lock(),now));
 }
});
test('deployed bundle boundary rejects both bundled and external glob parsers',()=>{
 const chunk={type:'chunk',modules:{'/src/app/page.tsx':{}},imports:[],dynamicImports:[]};
 assert.equal(assertDependencyBoundary({app:chunk}).moduleCount,1);
 for(const id of ['/node_modules/braces/index.js','C:\\project\\node_modules\\micromatch\\index.js','fast-glob']){
  assert.throws(()=>assertDependencyBoundary({app:{...chunk,modules:{[id]:{}}}}),/Development-only/);
  assert.throws(()=>assertDependencyBoundary({app:{...chunk,dynamicImports:[id]}}),/Development-only/);
 }
});

test('different package and root severities never suppress actionable advisories',()=>{
 for(const severity of ['info','low','moderate','critical']){
  const r=report();r.vulnerabilities.braces.via[0].severity=severity;
  const result=assessAudit(r);
  assert.equal(result.ok,false);
  assert.equal(result.blocked[0].severity,severity==='critical'?'critical':'high');
  assert.deepEqual(result.severityDifferences,[{package:'braces',reported:'high',root:severity}]);
 }
 const r=report();r.vulnerabilities.parent={name:'parent',severity:'moderate',nodes:['node_modules/parent'],via:['braces']};
 r.metadata.vulnerabilities.total=2;r.metadata.vulnerabilities.moderate=1;
 const result=assessAudit(r);
 assert.equal(result.ok,false);
 assert.deepEqual(result.blocked.find(v=>v.package==='parent'),{package:'parent',advisory:url,severity:'high'});
 assert.deepEqual(result.severityDifferences,[{package:'parent',reported:'moderate',root:'high'}]);
});

test('npm dependency cycles are accepted only when every component reaches an advisory',()=>{
 const r=report();r.vulnerabilities.parent={name:'parent',severity:'high',nodes:['node_modules/parent'],via:['braces']};
 r.vulnerabilities.braces.via.push('parent');r.metadata.vulnerabilities.total=2;r.metadata.vulnerabilities.high=2;
 const result=assessAudit(r);
 assert.equal(result.ok,false);assert.equal(result.blocked.length,2);
 r.vulnerabilities.braces.via=['parent'];
 assert.throws(()=>assessAudit(r),/Missing advisory roots/);
});

test('cyclic lower-severity dependencies cannot launder a critical root',()=>{
 const r=report();r.vulnerabilities.braces.severity='critical';r.vulnerabilities.braces.via[0].severity='critical';
 r.vulnerabilities.parent={name:'parent',severity:'low',nodes:['node_modules/parent'],via:['braces','parent']};
 r.metadata.vulnerabilities={total:2,info:0,low:1,moderate:0,high:0,critical:1};
 const result=assessAudit(r);assert.equal(result.ok,false);
 assert.equal(result.blocked.find(v=>v.package==='parent').severity,'critical');
 for(const mutate of [r=>r.vulnerabilities.parent.via.push('absent'),r=>r.vulnerabilities.parent.nodes=[],r=>r.vulnerabilities.parent.name='other']){
  const malformed=structuredClone(r);mutate(malformed);assert.throws(()=>assessAudit(malformed),/graph/);
 }
});
