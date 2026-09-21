import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readIdentityHolds} from '../app/lib/production-identity-review-data.ts';

test('old hold pages retain exact human provenance beyond a thousand newer events',async()=>{
 // Minimal read-model fixture; canonical write/provenance guards are covered by ID-USABLE.
 const sql=new DatabaseSync(':memory:');
 try{
  sql.exec(`CREATE TABLE signup_cases(kind TEXT,source_id TEXT); INSERT INTO signup_cases VALUES('officer','applicant');
   CREATE TABLE production_rereview_targets(kind TEXT,hold_id TEXT,officer_id TEXT,applicant_id TEXT,held_at TEXT,held_by TEXT);
   CREATE TABLE audit_events(id TEXT,actor_id TEXT,detail TEXT,created_at TEXT);
   CREATE TABLE production_hold_provenance(kind TEXT,hold_id TEXT,audit_event_id TEXT);`);
  for(let i=0;i<1105;i++){
   const id=String(i).padStart(4,'0');
   sql.prepare('INSERT INTO production_rereview_targets VALUES(?,?,?,?,?,?)').run('workforce',id,'officer','applicant',id,'system');
   sql.prepare('INSERT INTO audit_events VALUES(?,?,?,?)').run(id,'human-'+id,JSON.stringify({sourceVersion:i+1}),id);
   sql.prepare('INSERT INTO production_hold_provenance VALUES(?,?,?)').run('workforce',id,id);
  }
  const db={prepare(query){return {bind(...values){return {first:async()=>sql.prepare(query).get(...values),all:async()=>({results:sql.prepare(query).all(...values)})};}};}};
  const result=await readIdentityHolds(db,{userId:'ops',operations:true},'applicant',1100);
  assert.equal(result.holds.length,5);assert.equal(result.nextOffset,null);
  for(const hold of result.holds){assert.equal(hold.attribution,'linked_human_action');assert.equal(hold.humanAudit.length,1);assert.equal(hold.humanAudit[0].actorId,'human-'+hold.hold_id);}
  await assert.rejects(readIdentityHolds(db,{userId:'applicant',operations:false},'applicant',1100),/Operations/);
 }finally{sql.close();}
});
