import {installRehearsal} from './fixtures/isolated-rehearsal.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {presenceFixture as fixture} from './fixtures/presence.mjs';
import {env} from 'cloudflare:workers';
import {POST} from '../app/api/presence/route.ts';
import {publicPresence,writePresence} from '../app/lib/officer-presence.ts';


const share={action:'share',mode:'live',consent:true,sessionId:'11111111-1111-4111-8111-111111111111',consentRevision:1,latitude:-26.176,longitude:28.045};
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const request=(body,host='officers.lokd.co.za')=>new Request('https://'+host+'/api/presence',{method:'POST',headers:{origin:'https://'+host,'content-type':'application/json','x-lokd-verified-user-id':'user','x-lokd-verified-email':'officer@example.test'},body:JSON.stringify(body)});

test('presence resolves reviewed production identity without configured pilot mapping and ignores supplied IDs',async()=>{
 const {db,sql}=fixture(),oldDb=env.DB,oldAccess=env.LOKD_PILOT_ACCESS_JSON;env.DB=db;env.LOKD_PILOT_ACCESS_JSON=JSON.stringify({officers:{'officer@example.test':'OFF-OTHER'}});
 try{const response=await POST(request({...share,officerId:'OFF-ATTACKER'}));assert.equal(response.status,200);const saved=sql.prepare('SELECT * FROM public_officer_presence').get();assert.equal(saved.officer_id,'OFF-CURRENT');assert.equal(saved.latitude,-26.2);assert.equal(saved.longitude,28);assert.equal(Date.parse(saved.expires_at)-Date.parse(saved.updated_at),180000);assert.equal((await publicPresence(db)).areas.length,1);assert.equal('user_id' in (await publicPresence(db)).areas[0],false);}
 finally{if(oldDb===undefined)delete env.DB;else env.DB=oldDb;if(oldAccess===undefined)delete env.LOKD_PILOT_ACCESS_JSON;else env.LOKD_PILOT_ACCESS_JSON=oldAccess;sql.close();}
});

test('stale, withdrawn, unreviewed and reassigned links suppress existing locations and new sharing',async()=>{
 for(const change of ["UPDATE signup_cases SET version=2","UPDATE signup_cases SET status='withdrawn'","UPDATE signup_cases SET status='submitted'","UPDATE signup_cases SET owner_user_id='other'","UPDATE production_entity_links SET owner_user_id='other'"]){const {db,sql}=fixture();try{await writePresence(db,'user','OFF-UNTRUSTED',share);sql.exec(change);assert.deepEqual((await publicPresence(db)).areas,[]);await assert.rejects(()=>writePresence(db,'user','OFF-CURRENT',share),/current reviewed/);await writePresence(db,'user',null,{mode:'live',action:'stop'});assert.equal(sql.prepare('SELECT count(*) n FROM public_officer_presence').get().n,0);}finally{sql.close();}}
});

test('atomic live write rechecks account linkage after the eligibility read',async()=>{
 const {db,sql}=fixture();try{db.beforeWrite=()=>sql.exec("UPDATE signup_cases SET status='withdrawn'");await assert.rejects(()=>writePresence(db,'user',null,share),/changed/);assert.equal(sql.prepare('SELECT count(*) n FROM public_officer_presence').get().n,0);}finally{sql.close();}
});

test('test sharing remains private and stopping remains owner-scoped after withdrawal',async()=>{
 const {db,sql}=fixture();const isolated=installRehearsal(db,{stage:'prelaunch'});
 const testSession=await writePresence(db,'user',null,{action:'start',mode:'test',consent:true,expectedRevision:0});
 const otherSession=await writePresence(db,'other',null,{action:'start',mode:'test',consent:true,expectedRevision:0});
 try{assert.equal((await POST(request({...share,...testSession,mode:'test'}))).status,404);assert.equal((await POST(request({...share,...testSession,mode:'test'},'demo.lokd.co.za'))).status,200);assert.deepEqual((await publicPresence(db)).areas,[]);await writePresence(db,'other',null,{...share,...otherSession,mode:'test'});sql.exec("UPDATE signup_cases SET status='withdrawn'");assert.equal((await POST(request({action:'stop',mode:'test'},'demo.lokd.co.za'))).status,200);assert.equal(sql.prepare('SELECT user_id FROM public_officer_presence').get().user_id,'other');assert.equal((await POST(request({...share,...testSession,mode:'test'},'demo.lokd.co.za'))).status,403);}finally{isolated.close();sql.close();}
});

test('expired presence and off-post assignments cannot appear publicly',async()=>{
 const {db,sql}=fixture();try{await writePresence(db,'user',null,share);sql.exec("UPDATE public_officer_presence SET expires_at='2000-01-01T00:00:00.000Z'");assert.deepEqual((await publicPresence(db)).areas,[]);await writePresence(db,'user',null,share);sql.exec("UPDATE shifts SET check_out_at='2026-09-14T00:00:00.000Z'");assert.deepEqual((await publicPresence(db)).areas,[]);await assert.rejects(()=>writePresence(db,'user',null,share),/checked in/);}finally{sql.close();}
});

test('confirmed Stop revokes an in-flight share before its atomic write',async()=>{
 const {db,sql}=fixture(),entered=deferred(),release=deferred();
 try{
  db.beforeWrite=async()=>{entered.resolve();await release.promise;};
  const pending=writePresence(db,'user',null,share);
  await entered.promise;
  assert.deepEqual(await writePresence(db,'user',null,{action:'stop',mode:'live'}),{sharing:false,mode:'live'});
  release.resolve();
  await assert.rejects(pending,e=>e.status===409);
  assert.equal(sql.prepare('SELECT count(*) n FROM public_officer_presence').get().n,0);
  assert.deepEqual((await publicPresence(db)).areas,[]);
 }finally{release.resolve();sql.close();}
});

test('Stop invalidates delayed consent starts and old sessions; explicit fresh consent can resume',async()=>{
 const {db,sql}=fixture();try{
  const before=await writePresence(db,'user',null,{action:'state',mode:'live'});
  await writePresence(db,'user',null,share);
  for(let i=0;i<2;i++)await writePresence(db,'user',null,{action:'stop',mode:'live'});
  await assert.rejects(()=>writePresence(db,'user',null,{action:'start',mode:'live',consent:true,expectedRevision:before.revision}),e=>e.status===409);
  await assert.rejects(()=>writePresence(db,'user',null,share),e=>e.status===409);
  const state=await writePresence(db,'user',null,{action:'state',mode:'live'});
  assert.equal(state.revision,before.revision+2);
  const session=await writePresence(db,'user',null,{action:'start',mode:'live',consent:true,expectedRevision:state.revision});
  await writePresence(db,'user',null,{...share,...session});
  assert.equal((await publicPresence(db)).areas.length,1);
  await assert.rejects(()=>writePresence(db,'user',null,share),e=>e.status===409);
 }finally{sql.close();}
});

test('failed Stop rolls back both revocation and deletion and never reports success',async()=>{
 const {db,sql}=fixture();try{
  await writePresence(db,'user',null,share);
  sql.exec("CREATE TRIGGER simulate_delete_failure BEFORE DELETE ON public_officer_presence BEGIN SELECT RAISE(ABORT,'synthetic delete failure'); END");
  await assert.rejects(()=>writePresence(db,'user',null,{action:'stop',mode:'live'}),/synthetic delete failure/);
  assert.equal(sql.prepare('SELECT active FROM officer_presence_consents').get().active,1);
  assert.equal((await publicPresence(db)).areas.length,1);
  sql.exec('DROP TRIGGER simulate_delete_failure');
  await writePresence(db,'user',null,{action:'stop',mode:'live'});
  assert.deepEqual((await publicPresence(db)).areas,[]);
 }finally{sql.close();}
});

test('database guards reject stale direct writes after revocation and hide superseded sessions',async()=>{
 const {db,sql}=fixture();try{
  await writePresence(db,'user',null,share);
  const row=sql.prepare('SELECT * FROM public_officer_presence').get();
  await writePresence(db,'user',null,{action:'start',mode:'live',consent:true,expectedRevision:1});
  assert.deepEqual((await publicPresence(db)).areas,[]);
  assert.throws(()=>sql.prepare('UPDATE public_officer_presence SET expires_at=?').run(new Date(Date.now()+180000).toISOString()),/consent/);
  await writePresence(db,'user',null,{action:'stop',mode:'live'});
  assert.throws(()=>sql.prepare('INSERT INTO public_officer_presence('+Object.keys(row).join(',')+') VALUES('+Object.keys(row).map(()=>'?').join(',')+')').run(...Object.values(row)),/consent/);
 }finally{sql.close();}
});
