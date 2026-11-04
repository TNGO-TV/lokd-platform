import {operationsAccess,requireOperationsRole} from './operations-access';
import {SignupError} from './signup-server';
import {calendarCategoryForDate,officerShiftEconomicsForRoster} from './production-pricing';
import type {ServiceType} from './production-service-types';
export async function changeProductionAssignment(db:D1Database,headers:Headers,input:Record<string,unknown>){
 const actor=await operationsAccess(db,headers);
 if(typeof input.assignmentId!=='string'||!Number.isSafeInteger(input.assignmentVersion)||!['swap','no_show','cancel'].includes(String(input.reasonCode))||typeof input.note!=='string'||input.note.trim().length<3||input.note.length>1200)throw new SignupError('Choose the current assignment and provide the reason.');
 const source=await db.prepare(`SELECT r.starts_at,r.ends_at,b.client_price_cents,b.service_type,b.engagement_model,b.risk_band,b.specialist_service_code FROM roster_assignments a JOIN roster_slots r ON r.id=a.roster_slot_id JOIN bookings b ON b.id=r.booking_id WHERE a.id=? AND a.environment='production' AND a.status='confirmed'`)
 .bind(input.assignmentId).first<{starts_at:string;ends_at:string;client_price_cents:number;service_type:ServiceType;engagement_model:'fixed'|'flex';risk_band:'Standard'|'Enhanced'|'Elevated'|'High'|'Critical';specialist_service_code:Parameters<typeof officerShiftEconomicsForRoster>[0]['specialistServiceCode']}>();
 if(!source)throw new SignupError('The active assignment was not found. Refresh the roster.',404);
 requireOperationsRole(actor,['operations_controller'],source.client_price_cents);
 const id=crypto.randomUUID();let starts:string|null=null,serviceDate:string|null=null,category:string|null=null,offer:number|null=null;
 if(input.replacementStartsAt){
  if(typeof input.replacementStartsAt!=='string'||!Number.isFinite(Date.parse(input.replacementStartsAt)))throw new SignupError('Provide the replacement shift start.');
  starts=new Date(input.replacementStartsAt).toISOString();
  if(Date.parse(starts)<=Date.now()||Date.parse(starts)>=Date.parse(source.ends_at)||Date.parse(starts)%60000!==0)throw new SignupError('The replacement must start at a future whole minute before the original shift ends.');
  serviceDate=new Date(Date.parse(starts)+7200000).toISOString().slice(0,10);category=calendarCategoryForDate(serviceDate);
  const economics=officerShiftEconomicsForRoster({startsAt:starts,serviceDate,serviceType:source.service_type,engagementModel:source.engagement_model,riskBand:source.risk_band,specialistServiceCode:source.specialist_service_code});
  if(!economics)throw new SignupError('The replacement shift could not be priced.',409);offer=economics.officerOfferCents;
 }
 await db.prepare('INSERT INTO production_schedule_changes VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,input.assignmentId,input.assignmentVersion,input.reasonCode,input.note.trim(),starts?'REPLACE-'+id:null,starts,serviceDate,category,offer,actor.operatorId,actor.userId,new Date().toISOString()).run();
 return {changeId:id,replacementSlotId:starts?'REPLACE-'+id:null,status:'assignment_released'};
}
export async function readRosterCandidates(db:D1Database){
 return (await db.prepare(`SELECT o.id,o.full_name,o.city,o.psira_grade,a.starts_at,a.ends_at FROM officers o JOIN officer_availability_windows a ON a.officer_id=o.id WHERE o.approval_status='approved' AND a.environment='production' AND a.status='available' AND a.ends_at>? AND EXISTS(SELECT 1 FROM current_production_officer_approvals c WHERE c.officer_id=o.id) ORDER BY o.full_name,a.starts_at LIMIT 500`).bind(new Date().toISOString()).all()).results;
}
