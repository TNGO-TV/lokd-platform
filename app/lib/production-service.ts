import {productionOperatorControl} from './production-operator-control';
import {SignupError} from './signup-server';
import type {SigningActor} from './production-signing';
import {agreementHash} from './agreement-acceptance';
const field=(v:unknown,label:string)=>{if(typeof v!=='string'||v.trim().length<3||v.length>1200)throw new SignupError(`Provide ${label}.`);return v.trim();};
export async function readProductionService(db:D1Database,actor:SigningActor){
 const own=actor.operations?'':"AND (EXISTS(SELECT 1 FROM production_entity_links l WHERE l.kind='client' AND l.entity_id=b.client_id AND l.owner_user_id=?) OR EXISTS(SELECT 1 FROM production_entity_links l WHERE l.kind='officer' AND l.entity_id=t.officer_id AND l.owner_user_id=?))";
 const timesheets=await db.prepare(`SELECT t.id,t.shift_id,t.service_date,t.recorded_minutes,t.scheduled_minutes,t.gross_wage_cents,t.payable_minutes,t.client_evidence_status,t.operations_status,t.version,t.exception_reason,t.check_in_at,t.check_out_at FROM shift_timesheets t JOIN bookings b ON b.id=t.booking_id WHERE t.environment='production' ${own} ORDER BY t.service_date DESC LIMIT 100`).bind(...(actor.operations?[]:[actor.userId,actor.userId])).all();const ids=timesheets.results.map(t=>t.shift_id);const events=ids.length?(await db.prepare(`SELECT id,shift_id,action,detail,created_at FROM production_service_events WHERE shift_id IN (${ids.map(()=>'?').join(',')}) ORDER BY created_at DESC LIMIT 500`).bind(...ids).all()).results:[];return {timesheets:timesheets.results,serviceEvents:events};
}
export async function recordProductionService(db:D1Database,actor:SigningActor,input:Record<string,unknown>,headers=new Headers()){
 const shiftId=field(input.shiftId,'shift reference'),now=new Date().toISOString(),note=field(input.note,'service findings');
 const s=await db.prepare(`SELECT s.*,b.client_id,ra.id AS assignment_id,rs.service_date,rs.starts_at,rs.ends_at,rs.calendar_category,snap.id AS snapshot_id,w.workforce_engagement_id,w.employer_id,w.workforce_model FROM shifts s JOIN bookings b ON b.id=s.booking_id JOIN roster_assignments ra ON ra.shift_id=s.id JOIN roster_slots rs ON rs.id=ra.roster_slot_id JOIN assignment_activation_snapshots snap ON snap.roster_assignment_id=ra.id AND snap.environment='production' JOIN assignment_workforce_snapshots w ON w.roster_assignment_id=ra.id AND w.environment='production' WHERE s.id=? AND s.environment='production' AND b.environment='production'`).bind(shiftId).first<Record<string,string|number|null>>();if(!s)throw new SignupError('Production assignment evidence not found.',404);
 const owner=async(kind:string,entity:unknown)=>Boolean(await db.prepare('SELECT entity_id FROM production_entity_links WHERE kind=? AND entity_id=? AND owner_user_id=?').bind(kind,entity,actor.userId).first());
 const eventId=crypto.randomUUID(),event=(action:string,expectedVersion?:number)=>db.prepare('INSERT INTO production_service_events VALUES(?,?,?,?,?,?)').bind(eventId,shiftId,action,actor.userId,JSON.stringify({note,expectedVersion}),now);
 if(input.action==='complete_service'){
  if(actor.operations||!await owner('officer',s.officer_id))throw new SignupError('Only the assigned officer may record service completion.',403);
  if(['completed','verified'].includes(String(s.status)))return {alreadyRecorded:true};
  if(s.status!=='on_post'||!s.check_in_at)throw new SignupError('Record completion only after an authorised check-in.',409);
  const minutes=Math.floor((Date.now()-Date.parse(String(s.check_in_at)))/60000),scheduled=Math.floor((Date.parse(String(s.ends_at))-Date.parse(String(s.starts_at)))/60000);if(minutes<0||minutes>7*24*60)throw new SignupError('The recorded service interval needs Operations investigation.',409);
  const details=JSON.stringify({shiftId,checkIn:s.check_in_at,checkOut:now,recordedMinutes:minutes,scheduledMinutes:scheduled,note,officerUserId:actor.userId}),hash=await agreementHash(details);
  const result=await db.batch([event('officer_completed'),
   db.prepare("UPDATE shifts SET status='completed',check_out_at=?,client_signoff_status='pending' WHERE id=? AND status='on_post'").bind(now,shiftId),
   db.prepare(`INSERT INTO shift_timesheets(id,shift_id,booking_id,roster_assignment_id,activation_snapshot_id,officer_id,workforce_engagement_id,employer_id,workforce_model,service_date,scheduled_starts_at,scheduled_ends_at,check_in_at,check_out_at,scheduled_minutes,recorded_minutes,gross_wage_cents,calendar_category,policy_version,client_evidence_status,operations_status,evidence_reference,evidence_hash,exception_reason,active_key,submitted_at,environment,integrity_state,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending','awaiting_review',?,?,?,?,?,'production','production_verified',?,?)`).bind('TS-'+shiftId,shiftId,s.booking_id,s.assignment_id,s.snapshot_id,s.officer_id,s.workforce_engagement_id,s.employer_id,s.workforce_model,s.service_date,s.starts_at,s.ends_at,s.check_in_at,now,scheduled,minutes,s.earnings_cents,s.calendar_category,'LOKD-SERVICE-EVIDENCE-v1','service-event:'+eventId,hash,minutes===scheduled?null:'Actual service differs from scheduled time. Pay requires explicit review.',shiftId,now,now,now)]);
  if(!result[1].meta.changes)throw new SignupError('The shift changed while completion was recorded. Refresh.',409);return {recorded:true,paymentApproved:false};
 }
 const t=await db.prepare("SELECT * FROM shift_timesheets WHERE shift_id=? AND active_key=shift_id AND environment='production'").bind(shiftId).first<{id:string;version:number;client_evidence_status:string;operations_status:string}>();if(!t)throw new SignupError('Officer completion evidence is required.',409);
 if(input.version!==t.version)throw new SignupError('Service evidence changed. Refresh and review it again.',409);
 if(input.action==='reopen_service_pay'){
  await productionOperatorControl(db,actor,headers,'payroll.first_approve',Number(s.earnings_cents));
  if(t.operations_status!=='approved_for_backend')throw new SignupError('Only a reviewed timesheet can be reopened.',409);
  await db.batch([event('pay_reopened',t.version),db.prepare("UPDATE shift_timesheets SET payable_minutes=NULL,operations_status='awaiting_review',approved_by=NULL,approved_at=NULL,locked_at=NULL,version=version+1,updated_at=? WHERE id=? AND version=? AND operations_status='approved_for_backend'").bind(now,t.id,t.version)]);return {reopened:true,paymentApproved:false};
 }
 if(input.action==='review_service_pay'){
  const amount=Number(input.grossCents),minutes=Number(input.payableMinutes);
  if(!Number.isSafeInteger(amount)||amount<0||!Number.isSafeInteger(minutes)||minutes<0||minutes>7*1440)throw new SignupError('Provide reviewed payable minutes and gross cents.');
  if(t.operations_status!=='awaiting_review'||t.client_evidence_status!=='confirmed')throw new SignupError('Only client-confirmed service can enter payroll review.',409);
  if(input.payEvidenceReviewed!==true)throw new SignupError('Review the contracted pay, attendance differences and lawful pay treatment.');
  const reviewer=await productionOperatorControl(db,actor,headers,'payroll.first_approve',amount);
  if(await owner('officer',s.officer_id)||await owner('client',s.client_id))throw new SignupError('A service participant cannot approve its pay evidence.',403);
  await db.batch([db.prepare('INSERT INTO production_service_events VALUES(?,?,?,?,?,?)').bind(eventId,shiftId,'pay_reviewed',actor.userId,JSON.stringify({note,expectedVersion:t.version,payableMinutes:minutes,grossCents:amount,operatorId:reviewer.id}),now),db.prepare("UPDATE shift_timesheets SET payable_minutes=?,gross_wage_cents=?,operations_status='approved_for_backend',approved_by=?,approved_at=?,locked_at=?,version=version+1,updated_at=? WHERE id=? AND version=? AND operations_status='awaiting_review' AND client_evidence_status='confirmed'").bind(minutes,amount,reviewer.id,now,now,now,t.id,t.version)]);
  return {servicePayReviewed:true,paymentApproved:false};
 }
 let clientStatus:string,action:string;
 if(input.action==='client_signoff'||input.action==='client_dispute'){
  if(actor.operations||!await owner('client',s.client_id))throw new SignupError('Only the linked client may confirm or dispute this service.',403);
  if(t.client_evidence_status!=='pending')throw new SignupError('This service already has a client decision. Operations must review any correction.',409);
  if(input.serviceEvidenceReviewed!==true)throw new SignupError('Read the recorded service evidence before deciding.');clientStatus=input.action==='client_signoff'?'confirmed':'disputed';action=input.action;
 }else if(input.action==='resolve_service_dispute'){
  if(!actor.operations||!actor.owner||await owner('officer',s.officer_id)||await owner('client',s.client_id))throw new SignupError('Independent Operations owner review is required for a disputed service.',403);
  if(t.client_evidence_status!=='disputed'||!['confirmed','rejected'].includes(String(input.outcome)))throw new SignupError('Choose the evidenced dispute outcome.');clientStatus=String(input.outcome);action='dispute_resolved';
 }else throw new SignupError('Choose a supported service-evidence action.');
 if(t.operations_status!=='awaiting_review')throw new SignupError('This timesheet is locked for payroll. Record an adjustment through payroll review.',409);
 const r=await db.batch([event(action,t.version),db.prepare("UPDATE shift_timesheets SET client_evidence_status=?,version=version+1,updated_at=? WHERE id=? AND version=? AND operations_status='awaiting_review'").bind(clientStatus,now,t.id,t.version),db.prepare("UPDATE shifts SET status='verified',client_signoff_status='approved',signed_off_at=? WHERE id=? AND status='completed' AND ?='confirmed'").bind(now,shiftId,clientStatus)]);if(!r[1].meta.changes)throw new SignupError('The timesheet changed before the decision. Refresh.',409);return {recorded:true,paymentApproved:false};
}
