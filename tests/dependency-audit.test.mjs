import assert from 'node:assert/strict';
import test from 'node:test';
import {assessAudit} from '../scripts/check-dependency-audit.mjs';
import {assertDependencyBoundary} from '../build/dependency-boundary.ts';
const url='https://github.com/advisories/GHSA-vfj7-8cjw-p6xm';
const report=()=>({auditReportVersion:2,metadata:{vulnerabilities:{total:1,info:0,low:0,moderate:0,high:1,critical:0}},vulnerabilities:{braces:{name:'braces',severity:'high',nodes:['node_modules/braces'],via:[{name:'braces',url,severity:'high'}]}}});
const lock=()=>({packages:{'node_modules/braces':{version:'3.0.3',dev:true}}});
const now=Date.parse('2026-10-16T00:00:00Z');
test('only the exact development-only advisory can receive the documented non-applicability disposition',()=>{
 assert.equal(assessAudit(report(),lock(),now).ok,true);
 for(const alter of [r=>r.vulnerabilities.braces.via[0].url+='new',r=>r.vulnerabilities.braces.nodes.push('node_modules/new/braces')]){
  const r=report();alter(r);assert.equal(assessAudit(r,lock(),now).ok,false);
 }
 for(const alter of [l=>l.packages['node_modules/braces'].dev=false,l=>l.packages['node_modules/braces'].version='3.0.4']){
  const l=lock();alter(l);assert.equal(assessAudit(report(),l,now).ok,false);
 }
 assert.equal(assessAudit(report(),lock(),Date.parse('2026-11-16T00:00:00Z')).ok,false);
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
