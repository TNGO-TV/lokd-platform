import assert from 'node:assert/strict';
import test from 'node:test';
import { env } from 'cloudflare:workers';
import { clerkSecondFactorVerifiedAt, operationsMfaStatus } from '../app/lib/operations-mfa.ts';
import { requirePilotApiRole } from '../app/lib/pilot-runtime.ts';
import { GET } from '../app/api/operations/security/route.ts';
const now = Date.now();
const proof = () => new Headers({'x-lokd-verified-user-id':'user_ops','x-lokd-verified-email':'ops@example.test','x-lokd-verified-mfa-enrolled':'true','x-lokd-verified-second-factor-at':new Date(now-60_000).toISOString()});
test('second-factor proof rejects missing, unenrolled, malformed and expired assertions',()=>{
 for(const age of [undefined,null,[0,-1],[0,'0'],[0,NaN],[0,-3],[0,0,0]]) assert.equal(clerkSecondFactorVerifiedAt(age,now/1000,true,now),null);
 assert.equal(clerkSecondFactorVerifiedAt([0,0],now/1000,false,now),null);
 assert.equal(clerkSecondFactorVerifiedAt([0,0],now/1000+100,true,now),null);
 const headers=proof();assert.equal(operationsMfaStatus(headers,now).fresh,true);
 for(const timestamp of [new Date(now+1000).toISOString(),new Date(now-300_000).toISOString(),'invalid']){
  headers.set('x-lokd-verified-second-factor-at',timestamp);assert.equal(operationsMfaStatus(headers,now).fresh,false);
 }
});
test('live Operations mutations need request proof; demo rehearsal and read access do not confer it',()=>{
 env.LOKD_PILOT_ACCESS_JSON=JSON.stringify({operations:['ops@example.test']});
 const request=(headers,method='POST')=>new Request('https://operations.lokd.co.za/api/specialist',{method,headers});
 const headers=proof();
 for(const stage of ['production','pilot','prelaunch']){
  env.LOKD_APP_STAGE=stage;
  assert.equal(requirePilotApiRole(request(headers),'operations').email,'ops@example.test');
  const stale=new Headers(headers);stale.delete('x-lokd-verified-second-factor-at');
  assert.throws(()=>requirePilotApiRole(request(stale),'operations'),/second factor/);
  assert.equal(requirePilotApiRole(request(stale,'GET'),'operations').email,'ops@example.test');
 }
 env.LOKD_APP_STAGE='demo';const demo=new Headers(headers);demo.delete('x-lokd-verified-second-factor-at');
 assert.equal(requirePilotApiRole(request(demo),'operations').email,'ops@example.test');
});
test('security endpoint never uses demo fallback and gives enrollment/reverification separately',async()=>{
 env.LOKD_APP_STAGE='demo';env.LOKD_PILOT_ACCESS_JSON=JSON.stringify({operations:['ops@example.test']});
 const request=headers=>new Request('https://operations.lokd.co.za/api/operations/security?verify=1',{headers});
 assert.equal((await GET(request({}))).status,401);
 const headers=proof();assert.equal((await GET(request(headers))).status,200);
 headers.delete('x-lokd-verified-second-factor-at');
 assert.equal((await GET(request(headers))).status,403);
 headers.set('x-lokd-verified-mfa-enrolled','false');
 assert.match((await (await GET(request(headers))).json()).error,/Enrol/);
 headers.set('x-lokd-verified-email','unassigned@example.test');assert.equal((await GET(request(headers))).status,403);
});
