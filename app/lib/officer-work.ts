import {SignupError} from './signup-server';
import {revalidateAssignment} from './assignment-activation-server';
import {recordProductionService} from './production-service';
import {enqueueOfficerEmail} from './officer-email';
import type {SigningActor} from './production-signing';

export type OfficerWorkActor={userId:string;email:string};
const link=`JOIN production_entity_links l ON l.kind='officer' AND l.entity_id=o.id JOIN signup_cases c ON c.kind=l.kind AND c.source_id=l.case_id AND c.version=l.case_version AND c.owner_user_id=l.owner_user_id AND c.status='reviewed'`;
async function officer(db:D1Database,a:OfficerWorkActor){
 const rows=await db.prepare(`SELECT o.id,o.full_name AS fullName,o.mobile,o.email,o.city,o.psira_number AS psiraNumber,o.psira_grade AS psiraGrade,o.psira_expiry AS psiraExpiry,o.approval_status AS approvalStatus FROM officers o ${link} WHERE l.owner_user_id=?`).bind(a.userId).all<Record<string,string>>();
 if(rows.results.length>1)throw new SignupError('Your account has more than one officer record. Contact LOKD Operations.',409);
 return rows.results[0]??null;
}
const ref=(value:unknown)=>{if(typeof value!=='string'||!value.trim()||value.length>200)throw new SignupError('Choose a valid record.');return value.trim();};
export function validateAttendanceLocation(input:Record<string,unknown>,site:{latitude_e6:number;longitude_e6:number;geofence_radius_meters:number},now=Date.now()){
 const {latitude,longitude,accuracy,capturedAt}=input;
 if(typeof latitude!=='number'||typeof longitude!=='number'||!Number.isFinite(latitude)||!Number.isFinite(longitude)||latitude< -90||latitude>90||longitude< -180||longitude>180||typeof accuracy!=='number'||!Number.isFinite(accuracy)||accuracy<=0||accuracy>150)throw new SignupError('Allow precise location and try again. Accuracy must be within 150 metres.');
 const stamp=typeof capturedAt==='string'?Date.parse(capturedAt):NaN;
 if(!Number.isFinite(stamp)||stamp<now-120000||stamp>now+10000)throw new SignupError('Your location has expired. Capture a new location and try again.');
 const rad=(n:number)=>n*Math.PI/180,dLat=rad(latitude-site.latitude_e6/1e6),dLon=rad(longitude-site.longitude_e6/1e6);
 const hav=Math.sin(dLat/2)**2+Math.cos(rad(latitude))*Math.cos(rad(site.latitude_e6/1e6))*Math.sin(dLon/2)**2;
 const distance=6371000*2*Math.atan2(Math.sqrt(hav),Math.sqrt(Math.max(0,1-hav)));
 if(!Number.isFinite(site.geofence_radius_meters)||site.geofence_radius_meters<=0||distance+accuracy>site.geofence_radius_meters)throw new SignupError('Move inside the site check-in area and try again. Contact Operations if the location is incorrect.',409);
 return {latitude,longitude,accuracy,capturedAt:new Date(stamp).toISOString(),distance};
}
export async function readOfficerWork(db:D1Database,a:OfficerWorkActor){
 const o=await officer(db,a);
 const applications=(await db.prepare("SELECT a.id,a.status,a.full_name AS fullName,c.version FROM officer_applications a JOIN signup_cases c ON c.kind='officer' AND c.source_id=a.id AND c.owner_user_id=? WHERE c.status!='withdrawn' AND a.integrity_state='user_submitted' ORDER BY a.created_at DESC LIMIT 20").bind(a.userId).all()).results;
 const preference=await db.prepare('SELECT email_enabled FROM officer_notification_preferences WHERE user_id=?').bind(a.userId).first<{email_enabled:number}>();
 const notifications=(await db.prepare('SELECT id,message,created_at AS createdAt FROM officer_work_notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 20').bind(a.userId).all()).results;
 if(!o)return {officer:null,applications,offers:[],shifts:[],timesheets:[],statements:[],notifications,emailEnabled:preference?.email_enabled!==0};
 const offers=(await db.prepare(`SELECT f.id,f.amount_cents AS amountCents,f.status,f.expires_at AS expiresAt,b.site_name AS siteName,b.site_area AS siteArea,b.post_name AS postName,b.service_type AS serviceType,b.start_date AS startDate,b.end_date AS endDate,b.shift_start AS shiftStart,b.shift_end AS shiftEnd FROM offers f JOIN bookings b ON b.id=f.booking_id WHERE f.officer_id=? AND b.environment='production' AND b.integrity_state='production_verified' AND f.status='open' AND f.expires_at>? ORDER BY f.expires_at LIMIT 100`).bind(o.id,new Date().toISOString()).all()).results;
 const shifts=(await db.prepare(`SELECT s.id,s.status,s.scheduled_date AS scheduledDate,s.check_in_at AS checkInAt,s.check_out_at AS checkOutAt,s.earnings_cents AS earningsCents,b.site_name AS siteName,b.site_area AS siteArea,b.post_name AS postName,rs.starts_at AS startsAt,rs.ends_at AS endsAt,os.address_label AS address FROM shifts s JOIN bookings b ON b.id=s.booking_id JOIN roster_assignments ra ON ra.shift_id=s.id JOIN roster_slots rs ON rs.id=ra.roster_slot_id JOIN operational_sites os ON os.id=rs.site_id WHERE s.officer_id=? AND s.environment='production' AND s.integrity_state='production_verified' AND b.environment='production' ORDER BY rs.starts_at DESC LIMIT 100`).bind(o.id).all()).results;
 const timesheets=(await db.prepare("SELECT id,shift_id AS shiftId,service_date AS serviceDate,recorded_minutes AS recordedMinutes,payable_minutes AS payableMinutes,operations_status AS status,client_evidence_status AS clientStatus FROM shift_timesheets WHERE officer_id=? AND environment='production' ORDER BY service_date DESC LIMIT 100").bind(o.id).all()).results;
 const statements=(await db.prepare(`SELECT i.id,i.gross_wage_cents AS grossCents,i.employee_deduction_cents AS deductionCents,i.net_pay_cents AS netCents,r.period_start AS periodStart,r.period_end AS periodEnd,r.pay_date AS payDate,json_extract(j.value,'$.calculation') AS calculation FROM payroll_items i JOIN payroll_runs r ON r.id=i.payroll_run_id JOIN production_payroll_snapshots p ON p.run_id=r.id JOIN json_each(p.payload_json,'$.items') j ON json_extract(j.value,'$.id')=i.id WHERE i.officer_id=? AND i.environment='production' AND r.environment='production' AND r.status IN ('approved_for_export','exported') ORDER BY r.created_at DESC LIMIT 100`).bind(o.id).all()).results;
 return {officer:o,applications,offers,shifts,timesheets,statements:statements.map(s=>({...s,calculation:JSON.parse(String(s.calculation??'{}'))})),notifications,emailEnabled:preference?.email_enabled!==0};
}
async function notificationEmail(db:D1Database,a:OfficerWorkActor,id:string,message:string){
 const preference=await db.prepare('SELECT email_enabled FROM officer_notification_preferences WHERE user_id=?').bind(a.userId).first<{email_enabled:number}>();
 if(preference?.email_enabled===0)return {};
 const emailId='officer-work-'+id;
 await enqueueOfficerEmail(db,{id:emailId,recipient:a.email,subject:'Your LOKD shift update',text:`${message}\n\nSign in to review your shifts and hours.\nhttps://officers.lokd.co.za/officer\n\nLOKD Security`});
 return {emailId};
}
export async function writeOfficerWork(db:D1Database,a:OfficerWorkActor,input:Record<string,unknown>){
 const now=new Date().toISOString();
 if(input.action==='email_preference'){
  if(typeof input.enabled!=='boolean')throw new SignupError('Choose your email preference.');
  await db.batch([db.prepare('INSERT INTO officer_notification_preferences(user_id,email_enabled,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET email_enabled=excluded.email_enabled,updated_at=excluded.updated_at').bind(a.userId,input.enabled?1:0,now),db.prepare("INSERT INTO audit_events VALUES(?,'officer',?,'email_preference_updated','account',?,?,?)").bind(crypto.randomUUID(),a.userId,a.userId,JSON.stringify({emailEnabled:input.enabled}),now)]);
  return {message:'Email preference saved.'};
 }
 const o=await officer(db,a);if(!o)throw new SignupError('Your officer account is awaiting approval.',409);
 if(input.action==='accept_offer'||input.action==='decline_offer'){
  const offerId=ref(input.offerId),response=input.action==='accept_offer'?'accepted':'declined';
  const previous=await db.prepare('SELECT id,response FROM officer_offer_responses WHERE offer_id=? AND user_id=?').bind(offerId,a.userId).first<{id:string;response:string}>();
  if(previous){if(previous.response!==response)throw new SignupError('This offer already has a different response. Contact Operations.',409);const message=response==='accepted'?'Offer accepted.':'Offer declined.';return {message,...await notificationEmail(db,a,previous.id,message)};}
  const responseId=crypto.randomUUID();
  try{await db.prepare('INSERT INTO officer_offer_responses(id,offer_id,user_id,response,created_at) VALUES(?,?,?,?,?)').bind(responseId,offerId,a.userId,response,now).run();}catch{throw new SignupError('This offer is no longer available, or your approval changed. Refresh your offers.',409);}
  const message=response==='accepted'?'Offer accepted. Your confirmed assignment will appear in My shifts.':'Offer declined.';return {message,...await notificationEmail(db,a,responseId,message)};
 }
 if(input.action!=='check_in'&&input.action!=='check_out')throw new SignupError('Choose a supported officer action.');
 const shiftId=ref(input.shiftId);
 const shift=await db.prepare(`SELECT s.status,s.check_in_at,s.check_out_at,os.id AS siteId,os.version AS siteVersion,os.latitude_e6,os.longitude_e6,os.geofence_radius_meters FROM shifts s JOIN roster_assignments ra ON ra.shift_id=s.id AND ra.officer_id=s.officer_id JOIN roster_slots rs ON rs.id=ra.roster_slot_id JOIN operational_sites os ON os.id=rs.site_id JOIN bookings b ON b.id=s.booking_id WHERE s.id=? AND s.officer_id=? AND s.environment='production' AND s.integrity_state='production_verified' AND b.environment='production'`).bind(shiftId,o.id).first<{status:string;check_in_at:string|null;check_out_at:string|null;siteId:string;siteVersion:number;latitude_e6:number;longitude_e6:number;geofence_radius_meters:number}>();
 if(!shift)throw new SignupError('Your assigned shift could not be found.',404);
 const existing=await db.prepare('SELECT id,status FROM officer_attendance_locations WHERE shift_id=? AND checkpoint=? AND user_id=?').bind(shiftId,input.action,a.userId).first<{id:string;status:string}>();
 if(existing?.status==='recorded'){const message=input.action==='check_in'?'You are checked in.':'You are checked out.';return {message,...await notificationEmail(db,a,existing.id,message)};}
 if(!existing||input.action==='check_in'&&shift.status==='confirmed'||input.action==='check_out'&&shift.status==='on_post'){
  if(input.locationConsent!==true)throw new SignupError('Allow your location to be saved with this attendance record.');
  if(input.action==='check_in'&&shift.status!=='confirmed'||input.action==='check_out'&&(shift.status!=='on_post'||!shift.check_in_at))throw new SignupError('This shift is not ready for that attendance action. Refresh your shifts.',409);
  const location=validateAttendanceLocation(input,shift);
  await db.prepare('INSERT OR IGNORE INTO officer_attendance_locations(id,shift_id,user_id,checkpoint,latitude,longitude,accuracy_meters,captured_at,site_id,site_version,distance_meters,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(shift_id,checkpoint) DO UPDATE SET latitude=excluded.latitude,longitude=excluded.longitude,accuracy_meters=excluded.accuracy_meters,captured_at=excluded.captured_at,site_id=excluded.site_id,site_version=excluded.site_version,distance_meters=excluded.distance_meters WHERE officer_attendance_locations.status=\'received\'').bind(crypto.randomUUID(),shiftId,a.userId,input.action,location.latitude,location.longitude,location.accuracy,location.capturedAt,shift.siteId,shift.siteVersion,location.distance,now).run();
 }
 if(input.action==='check_in'){
  const result=await revalidateAssignment(db,shiftId,'check_in',a.userId,true);
  if(!result.ready)throw new SignupError('Your shift needs Operations review before you can check in.',409);
 }else{
  const actor:SigningActor={...a,operations:false,owner:false};
  await recordProductionService(db,actor,{action:'complete_service',shiftId,note:'Officer checked out using a consented on-site location.'});
 }
 await db.prepare("UPDATE officer_attendance_locations SET status='recorded' WHERE shift_id=? AND checkpoint=? AND user_id=? AND status='received'").bind(shiftId,input.action,a.userId).run();
 const saved=await db.prepare('SELECT id FROM officer_attendance_locations WHERE shift_id=? AND checkpoint=? AND user_id=?').bind(shiftId,input.action,a.userId).first<{id:string}>();
 const message=input.action==='check_in'?'You are checked in.':'You are checked out. Your hours are awaiting review.';return {message,...(saved?await notificationEmail(db,a,saved.id,message):{})};
}
