import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {env} from 'cloudflare:workers';
import {POST as apply} from '../app/api/applications/route.ts';
import {writeSignup} from '../app/lib/signup-server.ts';
import {readOnboardingState} from '../app/lib/onboarding-server.ts';
class D1{
 constructor(){this.sql=new DatabaseSync(':memory:');this.sql.exec('PRAGMA foreign_keys=ON');for(const file of fs.readdirSync('drizzle').filter(file=>file.endsWith('.sql')).sort())this.sql.exec(fs.readFileSync('drizzle/'+file,'utf8').replaceAll('--> statement-breakpoint',''));}
 prepare(sql){const db=this.sql;const make=(args=[])=>({bind:(...values)=>make(values),first:async()=>db.prepare(sql).get(...args)??null,all:async()=>({results:db.prepare(sql).all(...args)}),run:async()=>({meta:{changes:Number(db.prepare(sql).run(...args).changes)}})});return make();}
 async batch(statements){this.sql.exec('BEGIN');try{const results=[];for(const stmt of statements)results.push(await stmt.run());this.sql.exec('COMMIT');return results;}catch(error){this.sql.exec('ROLLBACK');throw error;}}
}
const actor={userId:'onboarding-officer',email:'onboarding@example.test',operations:false};
async function setup(){
 const db=new D1();env.DB=db;delete env.RESEND_API_KEY;
 const result=await apply(new Request('https://lokd.co.za/api/applications',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({pathway:'qualified',fullName:'Onboarding Officer',email:actor.email,mobile:'0821234567',city:'Pretoria',province:'Gauteng',psiraStatus:'active',psiraNumber:'1234567',psiraGrade:'Grade C',services:['Unarmed'],purposes:['Retail'],training:[],over18Confirmed:true,eligibilityAcknowledged:true,contactConsent:true})}));
 assert.equal(result.status,202,await result.clone().text());return {db,id:(await result.json()).reference};
}
test('production progress is account scoped and does not seed records',async()=>{
 const db=new D1();assert.equal((await readOnboardingState(db,'officer',actor)).cases.length,0);
 assert.equal(db.sql.prepare('SELECT count(*) n FROM officer_applications').get().n,0);
 const x=await setup();
 assert.equal((await readOnboardingState(x.db,'officer',{...actor,userId:'other',email:'other@example.test'})).cases.length,0);
 const received=await readOnboardingState(x.db,'officer',actor);assert.equal(received.cases.length,1);assert.equal(received.summary.passedChecks,0);
 await writeSignup(x.db,actor,{kind:'officer',id:x.id,action:'link',expectedVersion:0});
 const linked=await readOnboardingState(x.db,'officer',actor);assert.equal(linked.summary.passedChecks,1);assert.equal(linked.cases[0].checklist.find(c=>c.id==='account').status,'complete');
 assert.equal(linked.cases[0].checklist.find(c=>c.id==='identity').status,'required');
 await writeSignup(x.db,actor,{kind:'officer',id:x.id,action:'withdraw',expectedVersion:1});
 assert.equal((await readOnboardingState(x.db,'officer',actor)).cases.length,0);
});
test('operations progress does not silently expose another account intake',async()=>{
 const db=new D1();await assert.rejects(readOnboardingState(db,'operations',{...actor,operations:true}),/intake queue/);
});
