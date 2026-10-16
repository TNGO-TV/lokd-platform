import assert from 'node:assert/strict';
import test from 'node:test';
import {env} from 'cloudflare:workers';
import {testSurfacesEnabled,isTestApi,testSurfaceResponse} from '../app/lib/test-surface-policy.ts';
import {isolatedRehearsalStorage} from '../app/lib/test-surface-storage.ts';
import {secureRequest} from '../app/lib/security-headers.ts';
import {D1} from './fixtures/production-identity-journey.mjs';
import {installRehearsal} from './fixtures/isolated-rehearsal.mjs';

test('production hosts and stage cannot expose rehearsal endpoints, including exports and descendants',()=>{
 const paths=['/api/pilot','/api/platform/export','/api/platform/export/file','/api/sandbox/discovery','/api/test-cycle','/api/agreements/test','/api/identity','/api/enrolment','/api/provider-test','/api/paystack/test/webhook'];
 for(const host of ['lokd.co.za','www.lokd.co.za','portal.lokd.co.za','officers.lokd.co.za','operations.lokd.co.za','lokd-security.zenas-capetown.workers.dev','demo.lokd.co.za.attacker.test']){
  for(const stage of ['production','prelaunch','demo']){
   const runtime={LOKD_APP_STAGE:stage,LOKD_TEST_SURFACES_ENABLED:'true'};
   assert.equal(testSurfacesEnabled(runtime,host),false);
   for(const path of paths)assert.equal(testSurfaceResponse(new Request('https://'+host+path),runtime)?.status,404);
  }
 }
 assert.equal(testSurfacesEnabled({LOKD_APP_STAGE:'production',LOKD_TEST_SURFACES_ENABLED:'true'},'demo.lokd.co.za'),false);
 assert.equal(testSurfacesEnabled({LOKD_APP_STAGE:'prelaunch'},'demo.lokd.co.za'),false);
 assert.equal(testSurfacesEnabled({LOKD_APP_STAGE:'prelaunch',LOKD_TEST_SURFACES_ENABLED:'true'},'demo.lokd.co.za'),true);
 for(const path of ['/api/operations/security','/api/passport/verify','/api/signup','/api/production-operations','/api/production-identity','/api/agreements/production','/api/paystack/booking/webhook'])assert.equal(isTestApi(path),false,path);
 assert.equal(isTestApi('/api/applications','POST'),false);
 assert.equal(isTestApi('/api/applications','GET'),true);
});

test('edge URL controls SSR host despite forged Host and forwarding headers',()=>{
 const {request}=secureRequest(new Request('https://officers.lokd.co.za/officer/test-cycle',{headers:{host:'demo.lokd.co.za','x-forwarded-host':'demo.lokd.co.za',forwarded:'host=demo.lokd.co.za'}}));
 assert.equal(request.headers.get('host'),'officers.lokd.co.za');
 assert.equal(request.headers.get('x-forwarded-host'),null);
 assert.equal(request.headers.get('forwarded'),null);
 assert.equal(testSurfacesEnabled({LOKD_APP_STAGE:'demo',LOKD_TEST_SURFACES_ENABLED:'true'},request.headers.get('host')),false);
});

test('rehearsal requires separately marked storage; seeding touches only TEST_DB',async()=>{
 const db=new D1(),fixture=installRehearsal(db);
 try {
  assert.equal(await isolatedRehearsalStorage(env),true);
  assert.equal(await isolatedRehearsalStorage({DB:env.DB}),false);
  assert.equal(await isolatedRehearsalStorage({DB:db,TEST_DB:db}),false);
  // Different objects aliased to one physical marked DB are also rejected.
  assert.equal(await isolatedRehearsalStorage({DB:{prepare:s=>db.prepare(s)},TEST_DB:db}),false);
  const {GET}=await import('../app/api/pilot/route.ts');
  const response=await GET(new Request('https://demo.lokd.co.za/api/pilot?scope=operations'));
  assert.equal(response.status,200,await response.clone().text());
  assert.ok(db.sql.prepare('SELECT count(*) AS n FROM officers').get().n>0);
  assert.equal(fixture.primary.prepare('SELECT count(*) AS n FROM sqlite_master').get().n,0);
  db.sql.exec('DROP TABLE lokd_rehearsal_instance');
  assert.equal(await isolatedRehearsalStorage(env),false);
  assert.equal((await GET(new Request('https://demo.lokd.co.za/api/pilot'))).status,404);
 }finally{fixture.close();db.sql.close();}
});

test('direct rehearsal handlers reject production before database, auth fallback or provider dispatch',async()=>{
 const prior={...env};let touches=0;
 Object.assign(env,{LOKD_APP_STAGE:'demo',LOKD_TEST_SURFACES_ENABLED:'true',DB:{prepare(){touches++;throw Error('No production database access allowed');}}});
 const paths=['pilot','operations','platform','platform/export','onboarding','specialist','passport','evidence','service-record','feedback','sandbox/identity','sandbox/discovery','sandbox/application','test-cycle','identity','enrolment','agreements/test','provider-test','paystack/test/webhook','applications','finance-workflows','finance-workflows/webhook'];
 try{
  for(const path of paths){
   const route=await import('../app/api/'+path+'/route.ts');
   for(const method of ['GET','POST','PATCH']){
    if(!route[method]||(path==='applications'&&method==='POST'))continue;
    const request=new Request('https://operations.lokd.co.za/api/'+path,{method,headers:{'content-type':'application/json','x-lokd-verified-user-id':'fixture','x-lokd-verified-email':'fixture@example.test'},...(method==='GET'?{}:{body:'{}'})});
    const response=await route[method](request);
    assert.equal(response.status,404,path+' '+method);
   }
  }
  assert.equal(touches,0);
 }finally{for(const key of Object.keys(env))delete env[key];Object.assign(env,prior);}
});
