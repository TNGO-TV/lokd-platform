import test from 'node:test';
import assert from 'node:assert/strict';
import {env} from 'cloudflare:workers';
import {GET,POST} from '../app/api/production-identity/route.ts';

test('production identity HTTP boundary rejects unauthenticated, cross-host, cross-origin and forged-authority actions',async()=>{
 const previous=env.LOKD_PILOT_ACCESS_JSON,db=env.DB;
 env.LOKD_PILOT_ACCESS_JSON=JSON.stringify({owners:['ops@example.test'],operations:[],clients:{}});
 const request=(body={},email='officer@example.test',url='https://officers.lokd.co.za/api/production-identity',origin=new URL(url).origin)=>new Request(url,{method:'POST',headers:{origin,'content-type':'application/json',...(email?{'x-lokd-verified-user-id':'fixture-user','x-lokd-verified-email':email,'x-lokd-verified-mfa-enrolled':'true','x-lokd-verified-second-factor-at':new Date().toISOString()}:{})},body:JSON.stringify(body)});
 try{
  delete env.DB;
  assert.equal((await POST(request({},null))).status,401);
  assert.equal((await POST(request({},undefined,undefined,'https://attacker.example'))).status,403);
  assert.equal((await POST(request({},'ops@example.test','https://officers.lokd.co.za/api/production-identity?scope=operations'))).status,403);
  assert.equal((await POST(request({action:'decide_identity',operations:true}))).status,400);
  assert.equal((await POST(request({action:'decide_identity'}))).status,403);
  assert.equal((await POST(request({action:'start_identity',provider:{key:'fake'}}))).status,400);
  assert.equal((await POST(request({action:'start_identity'}))).status,503);
  assert.equal((await POST(request({action:'start_identity',padding:'x'.repeat(64000)}))).status,413);
  // A missing trusted adapter must fail before any persistent access, even for valid input.
  env.DB={prepare(){throw new Error('Unexpected database access');}};
  const missing=await POST(request({action:'start_identity',applicantId:'fixture',applicantVersion:1,captureReference:'private:fixture',consentVersion:'fixture'}));
  assert.equal(missing.status,503);assert.match((await missing.json()).error,/provider acceptance is not configured/);
  assert.equal(missing.headers.get('cache-control'),'private, no-store');
  // Participants cannot learn another owner's private identity evidence through a status read.
  env.DB={prepare(){return {bind(){return {first:async()=>({id:'other',owner_user_id:'other-user'})};}};}};
  const denied=await GET(new Request('https://officers.lokd.co.za/api/production-identity?kind=identity&id=other',{headers:{'x-lokd-verified-user-id':'fixture-user','x-lokd-verified-email':'officer@example.test'}}));
  assert.equal(denied.status,404);assert.equal(denied.headers.get('cache-control'),'private, no-store');
 }finally{if(previous===undefined)delete env.LOKD_PILOT_ACCESS_JSON;else env.LOKD_PILOT_ACCESS_JSON=previous;if(db===undefined)delete env.DB;else env.DB=db;}
});
