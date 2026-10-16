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
});

test('audit enforcement fails malformed results, missing graph evidence and new findings independently of npm exit code',()=>{
 for(const r of [{},{...report(),error:{}},{...report(),metadata:{vulnerabilities:{total:0}}}])assert.throws(()=>assessAudit(r,lock(),now));
 const r=report();r.vulnerabilities.braces.via.push({name:'braces',url:'https://example.test/new',severity:'moderate'});
 assert.equal(assessAudit(r,lock(),now).ok,false);
 const missing=report();missing.vulnerabilities.braces.via=['missing'];assert.throws(()=>assessAudit(missing,lock(),now));
 for(const alter of [r=>{r.vulnerabilities={};r.metadata.vulnerabilities={total:0,info:0,low:0,moderate:0,high:0,critical:1};},
  r=>r.metadata.vulnerabilities.high=-1,r=>r.metadata.vulnerabilities.high=0.5,
  r=>r.vulnerabilities.braces.severity='unknown',r=>r.vulnerabilities.braces.severity='critical']){
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

test('finding severity must agree with direct and transitive advisory roots',()=>{
 for(const severity of ['info','low','moderate','critical']){
  const r=report();r.vulnerabilities.braces.via[0].severity=severity;
  assert.throws(()=>assessAudit(r,lock(),now),/root advisory severity/);
 }
 const r=report();r.vulnerabilities.parent={name:'parent',severity:'high',nodes:['node_modules/parent'],via:['braces']};
 r.metadata.vulnerabilities.total=2;r.metadata.vulnerabilities.high=2;
 assert.equal(assessAudit(r,lock(),now).ok,false);
 r.vulnerabilities.parent.severity='critical';r.metadata.vulnerabilities.high=1;r.metadata.vulnerabilities.critical=1;
 assert.throws(()=>assessAudit(r,lock(),now),/root advisory severity/);
});
