import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {env} from 'cloudflare:workers';
import {GET,POST} from '../app/api/signup/route.ts';
import {POST as apply} from '../app/api/applications/route.ts';
import {POST as enquire} from '../app/api/enquiries/route.ts';
import {readSignupRecords,writeSignup} from '../app/lib/signup-server.ts';
import {liveSurfaceResponse} from '../app/lib/live-surface.ts';
class D1 {
 constructor(){this.sql=new DatabaseSync(':memory:');for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())this.sql.exec(fs.readFileSync(`drizzle/${f}`,'utf8').replaceAll('--> statement-breakpoint',''));}
 prepare(sql){const database=this.sql;const make=(values=[])=>({bind:(...v)=>make(v),first:async()=>database.prepare(sql).get(...values)??null,all:async()=>({results:database.prepare(sql).all(...values)}),run:async()=>({meta:{changes:Number(database.prepare(sql).run(...values).changes)}})});return make();}
 async batch(statements){this.sql.exec('BEGIN');try{const results=[];for(const stmt of statements)results.push(await stmt.run());this.sql.exec('COMMIT');return results;}catch(e){this.sql.exec('ROLLBACK');throw e;}}
}
const actor={userId:'user_applicant',email:'applicant@example.test',operations:false};
const ops={userId:'user_operations',email:'ops@example.test',operations:true};
const body={pathway:'qualified',fullName:'Synthetic Officer',mobile:'0821234567',email:actor.email,city:'Johannesburg',province:'Gauteng',psiraStatus:'active',psiraNumber:'1234567',psiraGrade:'Grade A',services:['Unarmed'],purposes:['Commercial access'],training:[],over18Confirmed:true,eligibilityAcknowledged:true,contactConsent:true};
function publicRequest(path,body){return new Request(`https://lokd.co.za/api/${path}`,{method:'POST',headers:{'content-type':'application/json',origin:'https://lokd.co.za'},body:JSON.stringify(body)});}
async function seed(db,kind='officer') {env.DB=db;const r=kind==='officer'?await apply(publicRequest('applications',body)):await enquire(publicRequest('enquiries',{organisationName:'Synthetic Client',contactName:'Test Contact',email:actor.email,mobile:'0821234567',siteArea:'Midrand',siteType:'commercial_property',requiredStart:'planning',message:'Synthetic site enquiry used only in tests.',advanceFundingAcknowledged:true,privacyConsent:true}));assert.equal(r.status,202);return(await r.json()).reference;}
const current=async(db,kind='officer',user=actor)=>(await readSignupRecords(db,user,kind)).records[0];
test('real client and officer signup links, review requests, corrections and withdrawal preserve evidence and eligibility boundaries',async()=>{
 for(const kind of ['officer','client']) {
  const db=new D1();const baselineOfficers=db.sql.prepare('SELECT count(*) AS n FROM officers').get().n;const id=await seed(db,kind);
  let r=await current(db,kind);assert.equal(r.accountLinked,false);assert.equal(r.status,'received');
  await writeSignup(db,ops,{kind,id,expectedVersion:0,action:'review',status:'needs_information',note:'Please correct your mobile number before review.'});
  await writeSignup(db,actor,{kind,id,expectedVersion:1,action:'link'});r=await current(db,kind);assert.equal(r.version,2);assert.equal(r.accountLinked,true);assert.match(r.note,/correct your mobile/);
  const linked=await readSignupRecords(db,{...actor,email:'changed@example.test'},kind);assert.equal(linked.records.length,1,'stable Clerk user owns link after email change');
  const different=await readSignupRecords(db,{...actor,userId:'other'},kind);assert.equal(different.records.length,0,'email reuse cannot take existing binding');
  await assert.rejects(()=>writeSignup(db,{...actor,userId:'other'}, {kind,id,expectedVersion:2,action:'correct',changes:{mobile:'0821234568'}}),/not found/);
  await writeSignup(db,actor,{kind,id,expectedVersion:2,action:'correct',changes:{mobile:'0821234568'}});r=await current(db,kind);assert.equal(r.status,'awaiting_review');assert.equal(r.details.mobile,'+27821234568');
  await assert.rejects(()=>writeSignup(db,ops,{kind,id,expectedVersion:2,action:'review',status:'reviewed',note:'This stale review should be refused.'}),/changed/);
  await writeSignup(db,ops,{kind,id,expectedVersion:3,action:'review',status:'reviewed',note:'Intake reviewed. Provider checks remain pending.'});
  await writeSignup(db,actor,{kind,id,expectedVersion:4,action:'withdraw'});r=await current(db,kind);assert.equal(r.status,'withdrawn');assert.equal(r.events.length,5);
  await assert.rejects(()=>writeSignup(db,ops,{kind,id,expectedVersion:5,action:'review',status:'reviewed',note:'Must not restore a withdrawn application.'}),/withdrawn/);
  assert.equal(db.sql.prepare('SELECT count(*) AS n FROM officers').get().n,baselineOfficers);assert.equal(db.sql.prepare('SELECT count(*) AS n FROM agreement_acceptance_receipts').get().n,0);
  assert.throws(()=>db.sql.exec('DELETE FROM signup_events'),/immutable/);
  assert.throws(()=>db.sql.exec("UPDATE signup_cases SET owner_user_id='other'"),/reassigned/);
  db.sql.close();
 }
});
test('signup review cannot promote roles, self-approve, accept malformed registration or silently overwrite a concurrent correction',async()=>{
 const db=new D1();const id=await seed(db);await writeSignup(db,actor,{kind:'officer',id,expectedVersion:0,action:'link'});
 await assert.rejects(()=>writeSignup(db,actor,{kind:'officer',id,expectedVersion:1,action:'review',status:'reviewed',note:'Attempt to approve myself.'}),/Only Operations/);
 await assert.rejects(()=>writeSignup(db,{...actor,operations:true},{kind:'officer',id,expectedVersion:1,action:'review',status:'reviewed',note:'Attempt to approve myself.'}),/Another Operations/);
 for(const changes of [{roles:'operations'},{email:'other@example.test'},{psiraNumber:'bad'},{fullName:'X'},{mobile:'123'}]) await assert.rejects(()=>writeSignup(db,actor,{kind:'officer',id,expectedVersion:1,action:'correct',changes}));
 await writeSignup(db,actor,{kind:'officer',id,expectedVersion:1,action:'correct',changes:{pathway:'training',psiraStatus:'not_registered'}});
 let r=await current(db);assert.equal(r.details.psiraNumber,'');assert.equal(r.status,'awaiting_review');
 await assert.rejects(()=>writeSignup(db,actor,{kind:'officer',id,expectedVersion:2,action:'correct',changes:{pathway:'qualified',psiraStatus:'active'}}),/numeric PSiRA/);
 await writeSignup(db,actor,{kind:'officer',id,expectedVersion:2,action:'correct',changes:{pathway:'qualified',psiraStatus:'active',psiraNumber:'7654321'}});
 assert.equal((await current(db)).details.psiraNumber,'7654321');assert.equal(db.sql.prepare('SELECT count(*) AS n FROM psira_verification_events').get().n,0);
 db.sql.close();
});
test('signup API has no public-demo bypass; verified identity, host scope, role and origin remain mandatory',async()=>{
 const db=new D1();await seed(db);env.LOKD_APP_STAGE='demo';env.LOKD_PILOT_ACCESS_JSON=JSON.stringify({operations:[ops.email]});
 const request=(scope,user,method='GET',body)=>new Request(`https://${scope==='operations'?'operations':scope==='officer'?'officers':'portal'}.lokd.co.za/api/signup?scope=${scope}&kind=officer`,{method,headers:{...(user?{'x-lokd-verified-user-id':user.userId,'x-lokd-verified-email':user.email}:{}),'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal((await GET(request('officer'))).status,401);assert.equal((await GET(request('operations',actor))).status,403);
 const own=await GET(request('officer',actor));assert.equal(own.status,200);assert.equal((await own.json()).records.length,1);
 const other=await GET(request('officer',{...actor,userId:'other',email:'other@example.test'}));assert.equal((await other.json()).records.length,0);
 const cross=request('officer',actor,'POST',{kind:'officer'});cross.headers.set('origin','https://evil.example');assert.equal((await POST(cross)).status,403);
 assert.equal((await GET(new Request('https://portal.lokd.co.za/api/signup?scope=operations&kind=officer',{headers:{'x-lokd-verified-user-id':ops.userId,'x-lokd-verified-email':ops.email}}))).status,403);
 db.sql.close();
});
test('live surface cannot expose rehearsal APIs and real signup stays available',()=>{
 for(const path of ['/api/pilot','/api/platform','/api/onboarding','/api/operations','/api/specialist','/api/passport'])assert.equal(liveSurfaceResponse(path,'production',true).status,423);
 assert.equal(liveSurfaceResponse('/api/platform','production',false).status,401);
 assert.equal(liveSurfaceResponse('/api/platform','demo',true),null);
 assert.equal(liveSurfaceResponse('/api/applications','production',true,'GET').status,423);
 for(const path of ['/api/signup','/api/psira','/api/enquiries','/api/operations/security'])assert.equal(liveSurfaceResponse(path,'production',true),null);
 assert.equal(liveSurfaceResponse('/api/applications','production',false,'POST'),null);
});
