import {SignupError} from './signup-server';
import type {SigningActor} from './production-signing';
async function officer(db:D1Database,actor:SigningActor){
 if(actor.operations)throw new SignupError('Only the officer can declare their availability.',403);
 const row=await db.prepare("SELECT l.entity_id FROM production_entity_links l JOIN signup_cases c ON c.kind=l.kind AND c.source_id=l.case_id AND c.version=l.case_version AND c.owner_user_id=l.owner_user_id WHERE l.kind='officer' AND l.owner_user_id=? AND c.status!='withdrawn'").bind(actor.userId).first<{entity_id:string}>();if(!row)throw new SignupError('A current officer account must be linked before declaring availability.',409);return row.entity_id;
}
export async function readProductionSchedule(db:D1Database,actor:SigningActor){
 const links=await db.prepare(`SELECT entity_id FROM production_entity_links WHERE kind='officer' ${actor.operations?'':'AND owner_user_id=?'}`).bind(...(actor.operations?[]:[actor.userId])).all<{entity_id:string}>();const ids=links.results.map(l=>l.entity_id);
 if(!ids.length)return {scheduleDeclarations:[],availability:[],outsideWork:[]};const marks=ids.map(()=>'?').join(',');
 return {scheduleDeclarations:(await db.prepare(`SELECT * FROM officer_schedule_declarations WHERE environment='production' AND officer_id IN (${marks}) ORDER BY declared_at DESC LIMIT 100`).bind(...ids).all()).results,availability:(await db.prepare(`SELECT * FROM officer_availability_windows WHERE environment='production' AND officer_id IN (${marks}) ORDER BY starts_at DESC LIMIT 100`).bind(...ids).all()).results,outsideWork:(await db.prepare(`SELECT id,officer_id,starts_at,ends_at,status FROM officer_work_commitments WHERE environment='production' AND source_type='officer_declared' AND officer_id IN (${marks}) ORDER BY starts_at DESC LIMIT 100`).bind(...ids).all()).results};
}
export async function declareProductionSchedule(db:D1Database,actor:SigningActor,input:Record<string,unknown>){
 const officerId=await officer(db,actor),now=new Date().toISOString();
 if(input.action==='withdraw_availability'){
  if(typeof input.availabilityId!=='string')throw new SignupError('Choose an availability window.');
  await db.batch([db.prepare("UPDATE officer_availability_windows SET status='withdrawn',version=version+1 WHERE id=? AND officer_id=? AND environment='production'").bind(input.availabilityId,officerId),db.prepare("INSERT INTO audit_events VALUES(?,'officer',?,'availability_withdrawn','officer',?,?,?)").bind(crypto.randomUUID(),actor.userId,officerId,JSON.stringify({availabilityId:input.availabilityId}),now)]);return {withdrawn:true};
 }
 if(input.action!=='declare_schedule'||input.allWorkDeclared!==true||input.restConfirmed!==true)throw new SignupError('Confirm all outside work and your availability/rest declaration.');
 const previous=await db.prepare("SELECT id,version FROM officer_schedule_declarations WHERE officer_id=? AND environment='production' ORDER BY version DESC LIMIT 1").bind(officerId).first<{id:string;version:number}>();
 if(input.expectedVersion!==(previous?.version??0))throw new SignupError('Your declaration changed. Refresh before replacing it.',409);
 const interval=(value:unknown)=>{const v=value as Record<string,unknown>;if(!v||typeof v.startsAt!=='string'||typeof v.endsAt!=='string')throw new SignupError('Provide each work interval.');const start=Date.parse(v.startsAt),end=Date.parse(v.endsAt);if(start%60000!==0||end%60000!==0)throw new SignupError('Enter work times to the nearest minute.');if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||start<Date.now()-7*86400000||end>Date.now()+31*86400000)throw new SignupError('Intervals must fall within the past 7 and next 31 days.');return {startsAt:new Date(start).toISOString(),endsAt:new Date(end).toISOString()};};
 const available=interval(input.availability);if(Date.parse(available.startsAt)<Date.now())throw new SignupError('Availability must start in the future.');
 if(!Array.isArray(input.outsideWork)||input.outsideWork.length>50)throw new SignupError('Provide up to 50 outside-work intervals.');const work=input.outsideWork.map(interval);
 if(work.some(w=>w.startsAt<available.endsAt&&w.endsAt>available.startsAt))throw new SignupError('Your availability overlaps your declared outside work.');
 const id='SCHED-'+crypto.randomUUID(),expires=available.endsAt,version=(previous?.version??0)+1;
 await db.batch([
  db.prepare("INSERT INTO officer_schedule_declarations(id,officer_id,version,status,environment,integrity_state,evidence_reference,declared_at,expires_at,supersedes_id,created_at) VALUES(?,?,?,'current','production','verified',?,?,?,?,?)").bind(id,officerId,version,'officer-declaration:'+id,now,expires,previous?.id??null,now),
  db.prepare("UPDATE officer_availability_windows SET status='superseded',version=version+1 WHERE officer_id=? AND environment='production' AND source='officer_declared' AND status='available'").bind(officerId),
  db.prepare("UPDATE officer_work_commitments SET status='cancelled' WHERE officer_id=? AND environment='production' AND source_type='officer_declared' AND status!='cancelled'").bind(officerId),
  db.prepare("INSERT INTO officer_availability_windows(id,officer_id,starts_at,ends_at,source,status,environment,integrity_state,evidence_reference,rest_confirmed_at,created_at) VALUES(?,?,?,?,'officer_declared','available','production','verified',?,?,?)").bind('AV-'+id,officerId,available.startsAt,available.endsAt,'officer-declaration:'+id,now,now),
  ...work.map((w,index)=>db.prepare("INSERT INTO officer_work_commitments(id,officer_id,source_type,source_reference,starts_at,ends_at,status,environment,integrity_state,evidence_reference,verified_at,expires_at,created_at) VALUES(?,?,'officer_declared',?,?,?,'declared','production','verified',?,?,?,?)").bind(id+'-'+index,officerId,id,w.startsAt,w.endsAt,'officer-declaration:'+id,now,w.endsAt>expires?w.endsAt:expires,now)),
  db.prepare("INSERT INTO audit_events VALUES(?,'officer',?,'schedule_declared','officer',?,?,?)").bind(crypto.randomUUID(),actor.userId,officerId,JSON.stringify({declarationId:id,version,availability:available,outsideWork:work,allWorkDeclared:true,restConfirmed:true}),now),
 ]);return {declarationId:id,version,workEligible:false};
}
