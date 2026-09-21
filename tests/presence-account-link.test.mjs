import assert from 'node:assert/strict';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {env} from 'cloudflare:workers';
import {POST} from '../app/api/presence/route.ts';
import {publicPresence,writePresence} from '../app/lib/officer-presence.ts';

function fixture(){
 const sql=new DatabaseSync(':memory:');
 sql.exec(`CREATE TABLE signup_cases(kind TEXT,source_id TEXT,owner_user_id TEXT,version INTEGER,status TEXT);
 CREATE TABLE production_entity_links(kind TEXT,case_id TEXT,owner_user_id TEXT,case_version INTEGER,entity_id TEXT);
 CREATE TABLE public_officer_presence(id TEXT PRIMARY KEY,user_id TEXT,officer_id TEXT,mode TEXT,latitude REAL,longitude REAL,consented_at TEXT,updated_at TEXT,expires_at TEXT,UNIQUE(user_id,mode));
 CREATE TABLE assignment_activation_snapshots(id TEXT,officer_id TEXT,shift_id TEXT,roster_assignment_id TEXT,command_id TEXT,environment TEXT,integrity_state TEXT,final INTEGER,shift_starts_at TEXT,shift_ends_at TEXT,evidence_valid_through TEXT);
 CREATE TABLE shifts(id TEXT,environment TEXT,integrity_state TEXT,status TEXT,check_out_at TEXT);
 CREATE TABLE roster_assignments(id TEXT,status TEXT,active_key TEXT);
 CREATE TABLE assignment_activation_commands(id TEXT,state TEXT);
 CREATE TABLE assignment_revalidations(snapshot_id TEXT,status TEXT);
 INSERT INTO signup_cases VALUES('officer','case','user',1,'reviewed');
 INSERT INTO production_entity_links VALUES('officer','case','user',1,'OFF-CURRENT');
 INSERT INTO shifts VALUES('shift','production','production_verified','on_post',NULL);
 INSERT INTO roster_assignments VALUES('roster','confirmed','shift');
 INSERT INTO assignment_activation_commands VALUES('command','activated');`);
 const now=Date.now();sql.prepare('INSERT INTO assignment_activation_snapshots VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('snapshot','OFF-CURRENT','shift','roster','command','production','production_verified',1,new Date(now-60000).toISOString(),new Date(now+3600000).toISOString(),new Date(now+3600000).toISOString());
 const db={prepare(query){return {bind(...values){return {async first(){return sql.prepare(query).get(...values)??null;},async all(){return {results:sql.prepare(query).all(...values)};},async run(){if(query.startsWith('INSERT INTO public_officer_presence'))db.beforeWrite?.();const r=sql.prepare(query).run(...values);return {meta:{changes:Number(r.changes)}};}};}};}};
 return {sql,db};
}
const share={action:'share',mode:'live',consent:true,latitude:-26.176,longitude:28.045};
const request=body=>new Request('https://officers.lokd.co.za/api/presence',{method:'POST',headers:{origin:'https://officers.lokd.co.za','content-type':'application/json','x-lokd-verified-user-id':'user','x-lokd-verified-email':'officer@example.test'},body:JSON.stringify(body)});

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
 const {db,sql}=fixture(),oldDb=env.DB;env.DB=db;
 try{assert.equal((await POST(request({...share,mode:'test'}))).status,200);assert.deepEqual((await publicPresence(db)).areas,[]);await writePresence(db,'other',null,{...share,mode:'test'});sql.exec("UPDATE signup_cases SET status='withdrawn'");assert.equal((await POST(request({action:'stop',mode:'test'}))).status,200);assert.equal(sql.prepare('SELECT user_id FROM public_officer_presence').get().user_id,'other');assert.equal((await POST(request({...share,mode:'test'}))).status,403);}finally{if(oldDb===undefined)delete env.DB;else env.DB=oldDb;sql.close();}
});

test('expired presence and off-post assignments cannot appear publicly',async()=>{
 const {db,sql}=fixture();try{await writePresence(db,'user',null,share);sql.exec("UPDATE public_officer_presence SET expires_at='2000-01-01T00:00:00.000Z'");assert.deepEqual((await publicPresence(db)).areas,[]);await writePresence(db,'user',null,share);sql.exec("UPDATE shifts SET check_out_at='2026-09-14T00:00:00.000Z'");assert.deepEqual((await publicPresence(db)).areas,[]);await assert.rejects(()=>writePresence(db,'user',null,share),/checked in/);}finally{sql.close();}
});
