import {releaseAssignmentHourReservations} from './assignment-activation-server';
import {productionOperatorControl} from './production-operator-control';
import {SignupError} from './signup-server';
import type {SigningActor} from './production-signing';
import {requireSandboxCompletion,type SandboxRuntime} from './sandbox-completion-policy';
import {agreementHash} from './agreement-acceptance';
import {operateProduction} from './production-operations';
import {tokenHash,readPublicPassport} from './passport-server';
const text=(v:unknown)=>{if(typeof v!=='string'||!v.trim()||v.length>700)throw new SignupError('Provide a bounded service reference or finding.');return v.trim();};
export async function sandboxScan(runtime:SandboxRuntime,actor:SigningActor,input:Record<string,unknown>,headers:Headers){
 const {db,policy}=await requireSandboxCompletion(runtime),requestKey=text(input.requestKey),shiftId=text(input.shiftId),scenario=String(input.scenario);
 if(actor.operations||!['at_site','outside_geofence','stale_clock','future_clock','gps_unavailable','wrong_passport'].includes(scenario)||input.consent!==true)throw new SignupError('Assigned officer consent and a supported sandbox scan scenario are required.',403);
 const shift=await db.prepare("SELECT s.officer_id,s.booking_id,l.owner_user_id FROM shifts s JOIN production_entity_links l ON l.kind='officer' AND l.entity_id=s.officer_id JOIN signup_cases c ON c.kind=l.kind AND c.source_id=l.case_id AND c.version=l.case_version AND c.owner_user_id=l.owner_user_id AND c.status='reviewed' WHERE s.id=? AND l.owner_user_id=?").bind(shiftId,actor.userId).first<{officer_id:string;booking_id:string;owner_user_id:string}>();if(!shift)throw new SignupError('Your current assignment was not found.',404);
 const rawToken=text(input.passportToken),hash=await agreementHash(JSON.stringify({shiftId,scenario,tokenHash:await tokenHash(rawToken),userId:actor.userId,policy:policy.version}));
 const passport=await readPublicPassport(db,rawToken,shift.booking_id,shiftId);
 const currentPassport=passport&&(passport.status==='active'||passport.status==='expiring');
 const own=await db.prepare('SELECT officer_id FROM officer_passports WHERE public_token_hash=? AND officer_id=?').bind(await tokenHash(rawToken),shift.officer_id).first();
 const prior=await db.prepare('SELECT request_hash,result_json FROM sandbox_scan_receipts WHERE request_key=?').bind(requestKey).first<{request_hash:string;result_json:string}>();if(prior){if(!currentPassport||!own)throw new SignupError('Passport is no longer current.',409);if(prior.request_hash!==hash)throw new SignupError('Scan key belongs to different input.',409);return {...JSON.parse(prior.result_json),replayed:true};}
 let result:unknown;
 if(!currentPassport||!own||scenario==='wrong_passport')result={ready:false,reason:'passport_mismatch_or_unavailable'};
 else {
  const site=await db.prepare("SELECT site.latitude_e6,site.longitude_e6 FROM assignment_activation_snapshots snap JOIN assignment_activation_commands cmd ON cmd.id=snap.command_id JOIN roster_slots r ON r.id=cmd.roster_slot_id JOIN operational_sites site ON site.id=r.site_id WHERE snap.shift_id=? AND snap.final=1").bind(shiftId).first<{latitude_e6:number;longitude_e6:number}>();
  if(!site)throw new SignupError('Current assignment site required.',409);
  // Construct fictional device observations; no physical GPS or person is read.
  const observedAt=Date.now()+(scenario==='stale_clock'?-(policy.scanMaxAgeSeconds+1)*1000:scenario==='future_clock'?1000:0);
  const available=scenario!=='gps_unavailable',lat=site.latitude_e6/1e6+(scenario==='outside_geofence'?0.01:0),lon=site.longitude_e6/1e6;
  const toRadians=(n:number)=>n*Math.PI/180,dLat=toRadians(lat-site.latitude_e6/1e6),dLon=toRadians(lon-site.longitude_e6/1e6);
  const distance=6371000*2*Math.asin(Math.sqrt(Math.sin(dLat/2)**2+Math.cos(toRadians(lat))*Math.cos(toRadians(site.latitude_e6/1e6))*Math.sin(dLon/2)**2));
  const age=Date.now()-observedAt,reason=!available?'gps_unavailable':age<0?'future_clock':age>policy.scanMaxAgeSeconds*1000?'stale_clock':distance>policy.scanRadiusMetres?'outside_geofence':null;
  result=reason?{ready:false,reason,simulatedDevice:true}:await operateProduction(db,actor,{action:'check_in',shiftId},headers,true,{});
 }
 const json=JSON.stringify(result);await db.prepare('INSERT INTO sandbox_scan_receipts VALUES(?,?,?,?,?,?,?,?)').bind(requestKey,hash,shiftId,actor.userId,scenario,policy.version,json,new Date().toISOString()).run();return result;
}
export async function sandboxIncident(runtime:SandboxRuntime,actor:SigningActor,input:Record<string,unknown>){
 const {db,policy}=await requireSandboxCompletion(runtime),now=new Date().toISOString(),key=text(input.requestKey),hash=await agreementHash(JSON.stringify({actor:actor.userId,input,policy:policy.version}));
 const old=await db.prepare('SELECT request_hash,result_json FROM sandbox_incident_commands WHERE request_key=?').bind(key).first<{request_hash:string;result_json:string}>();if(old){if(old.request_hash!==hash)throw new SignupError('Incident request key conflict.',409);return {...JSON.parse(old.result_json),alreadyRecorded:true};}
 let id:string,version:number,status:string;const statements:D1PreparedStatement[]=[];
 if(input.action==='report'){
  const shift=await db.prepare("SELECT s.id,l.owner_user_id,r.site_id FROM shifts s JOIN assignment_activation_snapshots snap ON snap.shift_id=s.id JOIN assignment_activation_commands cmd ON cmd.id=snap.command_id JOIN roster_slots r ON r.id=cmd.roster_slot_id JOIN production_entity_links l ON l.kind='officer' AND l.entity_id=s.officer_id JOIN signup_cases intake ON intake.kind=l.kind AND intake.source_id=l.case_id AND intake.version=l.case_version AND intake.owner_user_id=l.owner_user_id AND intake.status='reviewed' WHERE s.id=? AND s.status IN ('confirmed','on_post','completed','verified')").bind(text(input.shiftId)).first<{id:string;owner_user_id:string;site_id:string}>();
  if(!shift||(!actor.operations&&shift.owner_user_id!==actor.userId))throw new SignupError('Only assigned participants or Operations may report this incident.',403);
  const severity=String(input.severity) as keyof typeof policy.incidentSlaMinutes;if(!Object.hasOwn(policy.incidentSlaMinutes,severity))throw new SignupError('Choose incident severity.');
  id='SIMINC-'+crypto.randomUUID();version=0;status='open';
  statements.push(db.prepare("INSERT INTO site_incidents(id,site_id,shift_id,severity,category,summary,detail,status,visibility,reported_by_type,reported_by_id,occurred_at,reported_at,sla_due_at,retention_review_at,version) VALUES(?,?,?,?,?,?,?,'open','operations',?,?,?,?,?,?,1)").bind(id,shift.site_id,shift.id,severity,text(input.category),text(input.summary),text(input.detail),actor.operations?'operations':'officer',actor.userId,now,now,new Date(Date.now()+policy.incidentSlaMinutes[severity]*60000).toISOString(),new Date(Date.now()+policy.retentionDays*86400000).toISOString()));
 }else{
  if(!actor.operations)throw new SignupError('Operations incident access required.',403);id=text(input.incidentId);const current=await db.prepare("SELECT i.* FROM site_incidents i JOIN operational_sites s ON s.id=i.site_id WHERE i.id=? AND s.environment='production'").bind(id).first<{version:number;status:string;reported_by_id:string;owner_id:string|null;sla_due_at:string;severity:string}>();
  if(!current||current.version!==input.expectedVersion)throw new SignupError('Incident version changed.',409);version=current.version;
  if(input.action==='escalate'){
   if(['resolved','closed'].includes(current.status)||!current.sla_due_at||Date.parse(current.sla_due_at)>Date.now())throw new SignupError('Only an overdue unresolved incident can escalate.',409);
   const reason=text(input.reason),severity=current.severity==='low'?'medium':current.severity==='medium'?'high':'critical';status=current.status;
   statements.push(db.prepare('UPDATE site_incidents SET severity=?,sla_due_at=?,version=version+1 WHERE id=? AND version=?').bind(severity,new Date(Date.now()+policy.incidentSlaMinutes[severity]*60000).toISOString(),id,version));
   void reason;
  }else {
  const next:Record<string,string>={acknowledge:'acknowledged',investigate:'investigating',resolve:'resolved',close:'closed'};status=next[String(input.action)];
  if(!status||({acknowledged:'open',investigating:'acknowledged',resolved:'investigating',closed:'resolved'} as Record<string,string>)[status]!==current.status)throw new SignupError('Out-of-order incident transition.',409);
  if(['resolved','closed'].includes(status)&&(!actor.owner||actor.userId===current.reported_by_id||actor.userId===current.owner_id))throw new SignupError('Separate owner must decide the incident disposition.',403);
  const reason=text(input.reason);statements.push(db.prepare("UPDATE site_incidents SET status=?,version=version+1,owner_id=CASE WHEN ?='acknowledged' THEN ? ELSE owner_id END,acknowledged_at=CASE WHEN ?='acknowledged' THEN ? ELSE acknowledged_at END,acknowledged_by=CASE WHEN ?='acknowledged' THEN ? ELSE acknowledged_by END,resolved_at=CASE WHEN ?='resolved' THEN ? ELSE resolved_at END,resolved_by=CASE WHEN ?='resolved' THEN ? ELSE resolved_by END,resolution_note=CASE WHEN ?='resolved' THEN ? ELSE resolution_note END WHERE id=? AND version=?").bind(status,status,actor.userId,status,now,status,actor.userId,status,now,status,actor.userId,status,reason,id,version));
  }
 }
 const result={incidentId:id,version:version+1,status,policyVersion:policy.version};
 statements.push(db.prepare('INSERT INTO sandbox_incident_commands VALUES(?,?,?,?,?,?,?)').bind(key,hash,id,version,actor.userId,policy.version,JSON.stringify(result)),db.prepare('INSERT INTO incident_events VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),id,String(input.action),actor.operations?'operations':'officer',actor.userId,JSON.stringify({policyVersion:policy.version,requestKey:key,reason:input.reason??'Synthetic incident reported'}),now));
 await db.batch(statements);return result;
}

export async function sandboxReleaseAssignment(runtime:SandboxRuntime,actor:SigningActor,input:Record<string,unknown>,headers:Headers){
 const {db}=await requireSandboxCompletion(runtime);
 if(!actor.operations||!actor.owner||!['cancelled','replaced','released'].includes(String(input.reason)))throw new SignupError('Assigned owner must choose the assignment disposition.',403);
 await productionOperatorControl(db,actor,headers,'deployment.activate',0);
 const row=await db.prepare("SELECT ra.version,l.owner_user_id FROM roster_assignments ra JOIN production_entity_links l ON l.kind='officer' AND l.entity_id=ra.officer_id WHERE ra.id=?").bind(text(input.assignmentId)).first<{version:number;owner_user_id:string}>();
 if(!row||row.version!==input.expectedVersion||row.owner_user_id===actor.userId)throw new SignupError('Current independently managed assignment required.',409);
 await releaseAssignmentHourReservations(db,text(input.assignmentId),input.reason as 'cancelled'|'replaced'|'released',actor.userId);return {released:true,productionActivationGranted:false};
}
