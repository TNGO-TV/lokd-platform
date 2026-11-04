import {operationsDatabase,addOperator} from './fixtures/operations-db.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { env } from 'cloudflare:workers';
import { operationsMfaStatus } from '../app/lib/operations-mfa.ts';
import { requireApiRole } from '../app/lib/platform-runtime.ts';
import { GET } from '../app/api/operations/security/route.ts';
const now = Date.now();
const proof = () => new Headers({'x-lokd-verified-user-id':'user_ops','x-lokd-verified-email':'ops@example.test','x-lokd-verified-mfa-enrolled':'true','x-lokd-verified-second-factor-at':new Date(now-60_000).toISOString()});
test('second-factor proof rejects missing, unenrolled, malformed and expired assertions',()=>{
 const headers=proof();assert.equal(operationsMfaStatus(headers,now).fresh,true);
 for(const timestamp of [new Date(now+1000).toISOString(),new Date(now-300_000).toISOString(),'invalid']){
  headers.set('x-lokd-verified-second-factor-at',timestamp);assert.equal(operationsMfaStatus(headers,now).fresh,false);
 }
});
test('live Operations mutations need request proof; demo rehearsal and read access do not confer it',()=>{
 env.LOKD_ROLE_ACCESS_JSON=JSON.stringify({operations:['ops@example.test']});
 const request=(headers,method='POST')=>new Request('https://operations.lokd.co.za/api/specialist',{method,headers});
 const headers=proof();
 for(const stage of ['production','pilot','prelaunch']){
  env.LOKD_APP_STAGE=stage;
  assert.equal(requireApiRole(request(headers),'operations').email,'ops@example.test');
  const stale=new Headers(headers);stale.delete('x-lokd-verified-second-factor-at');
  assert.throws(()=>requireApiRole(request(stale),'operations'),/second factor/);
  assert.equal(requireApiRole(request(stale,'GET'),'operations').email,'ops@example.test');
 }
 env.LOKD_APP_STAGE='demo';const demo=new Headers(headers);demo.delete('x-lokd-verified-second-factor-at');
 assert.throws(()=>requireApiRole(request(demo),'operations'),/second factor/);
});
test('security endpoint uses named operators and distinguishes enrollment from reverification',async()=>{
 const {sqlite,db}=operationsDatabase(),saved=env.DB;env.DB=db;
 try{
  const headers=addOperator(sqlite,'ops',['operations_controller']);
  const request=h=>new Request('https://operations.lokd.co.za/api/operations/security?verify=1',{headers:h});
  assert.equal((await GET(request({}))).status,401);
  assert.equal((await GET(request(headers))).status,200);
  headers.delete('x-lokd-verified-second-factor-at');assert.equal((await GET(request(headers))).status,403);
  headers.set('x-lokd-verified-mfa-enrolled','false');assert.match((await (await GET(request(headers))).json()).error,/Enrol/);
  headers.set('x-lokd-verified-email','unassigned@example.test');assert.equal((await GET(request(headers))).status,403);
 }finally{env.DB=saved;sqlite.close();}
});
test('server configuration and request inputs cannot waive Operations MFA',async()=>{
 const {sqlite,db}=operationsDatabase(),saved=env.DB;env.DB=db;
 try{
  const headers=addOperator(sqlite,'ops',['operations_owner']);headers.delete('x-lokd-verified-second-factor-at');
  for(const value of [undefined,'false','true','FALSE','0','']){
   env.LOKD_OPERATIONS_MFA_REQUIRED=value;headers.set('x-lokd-operations-mfa-required','false');
   assert.equal((await GET(new Request('https://operations.lokd.co.za/api/operations/security?verify=1',{headers}))).status,403);
  }
 }finally{delete env.LOKD_OPERATIONS_MFA_REQUIRED;env.DB=saved;sqlite.close();}
});
