import {SignupError} from './signup-server';
import {agreementHash} from './agreement-acceptance';
import type {SigningActor} from './production-signing';
import {productionEvidenceKinds,type ProductionEvidenceKind} from './production-evidence-catalogue';
import {RISK_RULES_VERSION} from './pilot-pricing';
const text=(v:unknown,label:string)=>{if(typeof v!=='string'||v.trim().length<2||v.length>1200)throw new SignupError(`Provide ${label}.`);return v.trim();};
const insert=(db:D1Database,table:string,row:Record<string,string|number|null>)=>db.prepare(`INSERT INTO ${table} (${Object.keys(row).join(',')}) VALUES(${Object.keys(row).map(()=>'?').join(',')})`).bind(...Object.values(row));
async function revision(db:D1Database){return (await db.prepare('SELECT revision FROM activation_evidence_epoch WHERE singleton=1').first<{revision:number}>())!.revision;}
async function plan(db:D1Database,kind:ProductionEvidenceKind,p:Record<string,string>,id:string,actor:string,now:string,expires:string){
 const out:D1PreparedStatement[]=[];
 if(kind==='site'){
  const row=await db.prepare("SELECT s.id,s.risk_band,p.id AS post_id FROM operational_sites s JOIN site_posts p ON p.site_id=s.id WHERE s.id=? AND p.id=? AND s.environment='production' AND s.integrity_state='production_verified' AND p.environment='production' AND p.integrity_state='production_verified'").bind(p.siteId,p.postId).first<{id:string;risk_band:string;post_id:string}>();if(!row)throw new SignupError('Choose the production site and its post.',409);
  out.push(db.prepare('UPDATE site_risk_assessments SET active_key=NULL WHERE active_key=?').bind(p.siteId),db.prepare('UPDATE post_order_approvals SET active_key=NULL WHERE active_key=?').bind(p.postId),
   insert(db,'site_risk_assessments',{id:'RISK-'+id,site_id:p.siteId,risk_rules_version:RISK_RULES_VERSION,risk_band:row.risk_band,status:'approved',environment:'production',integrity_state:'verified',evidence_reference:p.riskReference,approved_by:actor,approved_at:now,valid_from:now,expires_at:expires,active_key:p.siteId}),
   insert(db,'post_order_approvals',{id:'POST-'+id,post_id:p.postId,post_orders_version:p.postOrdersVersion,status:'approved',environment:'production',integrity_state:'verified',evidence_reference:p.ordersReference,approved_by:actor,approved_at:now,valid_from:now,expires_at:expires,active_key:p.postId}),
   db.prepare("UPDATE operational_sites SET status='active',version=version+1,updated_by=?,updated_at=? WHERE id=?").bind(actor,now,p.siteId),db.prepare("UPDATE site_posts SET status='active',post_orders_version=?,updated_at=? WHERE id=?").bind(p.postOrdersVersion,now,p.postId));
 }else if(kind==='employer'){
  if(!['lokd_employer','partner_company'].includes(p.employerType))throw new SignupError('Choose the actual employer type.');
  const old=await db.prepare('SELECT * FROM workforce_employers WHERE id=?').bind(p.employerId).first<{environment:string;legal_name:string;employer_type:string}>();if(old&&(old.environment!=='production'||old.legal_name!==p.legalName||old.employer_type!==p.employerType))throw new SignupError('Employer identity cannot be replaced by a compliance renewal.',409);
  if(!old)out.push(insert(db,'workforce_employers',{id:p.employerId,legal_name:p.legalName,employer_type:p.employerType,environment:'production',status:'pending'}));
  out.push(db.prepare("UPDATE workforce_employers SET status='current',psira_status='current',nbcpss_status='current',psspf_status='current',uif_status='current',coida_status='current',insurance_status='current',service_agreement_status='current',last_reviewed_at=?,review_due_at=?,version=version+1,updated_at=? WHERE id=?").bind(now,expires,now,p.employerId));
  for(const control of ['psira','nbcpss','psspf','uif','coida','insurance','service_agreement'])out.push(db.prepare('UPDATE employer_compliance_evidence SET active_key=NULL WHERE active_key=?').bind(p.employerId+':'+control),insert(db,'employer_compliance_evidence',{id:id+'-'+control,employer_id:p.employerId,control_code:control,status:'current',environment:'production',integrity_state:'verified',evidence_reference:p[control],verified_at:now,expires_at:expires,active_key:p.employerId+':'+control}));
 }else if(kind==='engagement'){
  const employer=await db.prepare("SELECT employer_type FROM workforce_employers WHERE id=? AND environment='production' AND status='current' AND review_due_at>=?").bind(p.employerId,expires).first<{employer_type:string}>();
  if(!employer||!['direct_flex','managed','partner'].includes(p.model)||(p.model==='partner'?employer.employer_type!=='partner_company':employer.employer_type!=='lokd_employer'))throw new SignupError('Use the current employer of record for this workforce route.',409);
  const officer=await db.prepare("SELECT o.id,l.owner_user_id FROM officers o JOIN production_entity_links l ON l.kind='officer' AND l.entity_id=o.id JOIN signup_cases c ON c.kind=l.kind AND c.source_id=l.case_id AND c.version=l.case_version AND c.status='reviewed' WHERE o.id=?").bind(p.officerId).first<{id:string;owner_user_id:string}>();if(!officer||officer.owner_user_id===actor)throw new SignupError('A different reviewer must approve the current officer intake.',403);
  const cap=Number(p.weeklyHourCap);if(!Number.isSafeInteger(cap)||cap<1||cap>60)throw new SignupError('Enter an approved hour cap from 1 to 60.');
  if(await db.prepare('SELECT id FROM workforce_engagements WHERE id=? OR (officer_id=? AND active_key=officer_id)').bind(p.engagementId,p.officerId).first())throw new SignupError('An engagement already exists. Suspend/review it before preparing a replacement with a new reference.',409);
  out.push(insert(db,'workforce_engagements',{id:p.engagementId,officer_id:p.officerId,employer_id:p.employerId,model:p.model,environment:'production',status:'active',active_key:p.officerId,engagement_reference:p.engagementReference,terms_version:p.termsVersion,payroll_status:'ready',benefits_status:'ready',weekly_hour_cap:cap,activated_at:now,review_due_at:expires}));
  // This creates a reviewed workforce route, not the officer's acceptance. The
  // bound officer must separately accept the actual terms through their account.
 }else{
  if(!await db.prepare("SELECT id FROM operational_sites WHERE id=? AND environment='production' AND status='active'").bind(p.siteId).first()||!await db.prepare("SELECT entity_id FROM production_entity_links WHERE kind='officer' AND entity_id=? AND owner_user_id!=?").bind(p.officerId,actor).first())throw new SignupError('Use an active production site and independently reviewed officer.',409);
  const minutes=Number(p.travelMinutes);if(!Number.isSafeInteger(minutes)||minutes<0||minutes>1440)throw new SignupError('Provide valid assessed travel minutes.');const key=p.officerId+':'+p.siteId;
  out.push(db.prepare('UPDATE officer_site_inductions SET active_key=NULL WHERE active_key=?').bind(key),db.prepare('UPDATE officer_travel_assessments SET active_key=NULL WHERE active_key=?').bind(key),
   insert(db,'officer_site_inductions',{id:'IND-'+id,officer_id:p.officerId,site_id:p.siteId,induction_version:p.inductionVersion,status:'completed',environment:'production',integrity_state:'verified',evidence_reference:p.inductionReference,completed_at:now,expires_at:expires,active_key:key}),
   insert(db,'officer_travel_assessments',{id:'TRAVEL-'+id,officer_id:p.officerId,site_id:p.siteId,status:'feasible',environment:'production',integrity_state:'verified',estimated_minutes:minutes,source:'independent_review',evidence_reference:p.travelReference,assessed_at:now,valid_until:expires,active_key:key}));
 }
 return out;
}
export async function readProductionEvidence(db:D1Database,actor:SigningActor){return {evidenceReviews:actor.operations?(await db.prepare('SELECT * FROM production_evidence_reviews ORDER BY prepared_at DESC LIMIT 100').all()).results:[]};}
export async function manageProductionEvidence(db:D1Database,actor:SigningActor,input:Record<string,unknown>){
 if(!actor.operations)throw new SignupError('Operations access required.',403);const now=new Date().toISOString();
 if(input.action==='suspend_evidence'){
  const reviewId=text(input.reviewId,'approved review reference'),reason=text(input.reason,'suspension findings');
  const r=await db.prepare("SELECT kind,payload_json FROM production_evidence_reviews WHERE id=? AND state='approved'").bind(reviewId).first<{kind:ProductionEvidenceKind;payload_json:string}>();if(!r)throw new SignupError('Approved review not found.',404);
  const p=JSON.parse(r.payload_json) as Record<string,string>,statements:D1PreparedStatement[]=[];
  if(r.kind==='site')statements.push(db.prepare("UPDATE operational_sites SET status='suspended',version=version+1,updated_at=? WHERE id=? AND environment='production'").bind(now,p.siteId),db.prepare("UPDATE site_posts SET status='suspended',updated_at=? WHERE id=? AND environment='production'").bind(now,p.postId));
  if(r.kind==='employer')statements.push(db.prepare("UPDATE workforce_employers SET status='suspended',version=version+1,updated_at=? WHERE id=? AND environment='production'").bind(now,p.employerId));
  if(r.kind==='engagement')statements.push(db.prepare("UPDATE workforce_engagements SET status='suspended',active_key=NULL,version=version+1,updated_at=? WHERE id=? AND environment='production'").bind(now,p.engagementId));
  if(r.kind==='induction')statements.push(db.prepare("UPDATE officer_site_inductions SET active_key=NULL WHERE id=? AND environment='production'").bind('IND-'+reviewId),db.prepare("UPDATE officer_travel_assessments SET active_key=NULL WHERE id=? AND environment='production'").bind('TRAVEL-'+reviewId));
  statements.push(db.prepare("INSERT INTO audit_events VALUES(?,'operations',?,'production_evidence_suspended','evidence_review',?,?,?)").bind(crypto.randomUUID(),actor.userId,reviewId,reason,now));await db.batch(statements);return {suspended:true,workEligible:false};
 }
 if(input.action==='prepare_evidence'){
  if(!Object.hasOwn(productionEvidenceKinds,String(input.kind)))throw new SignupError('Choose an evidence review type.');const kind=input.kind as ProductionEvidenceKind,p:Record<string,string>={};
  for(const [key,label] of Object.entries(productionEvidenceKinds[kind].fields)){const value=(input.fields as Record<string,unknown>)?.[key];p[key]=['weeklyHourCap','travelMinutes'].includes(key)&&typeof value==='string'&&/^\d{1,4}$/.test(value)?value:text(value,label);}
  if(input.sourceDocumentsReviewed!==true)throw new SignupError('Confirm that you reviewed the actual source records, including the quoted site risk and instructions where applicable.');
  const expiry=Date.parse(text(input.expiresAt,'a future review expiry'));if(!Number.isFinite(expiry))throw new SignupError('Provide a valid evidence expiry.');const expires=new Date(expiry).toISOString();if(Date.parse(expires)<=Date.now()||Date.parse(expires)>Date.now()+366*86400000)throw new SignupError('Review expiry must be within one year.');
  const rev=await revision(db),id='EVID-'+crypto.randomUUID();await plan(db,kind,p,id,actor.userId,now,expires);if(await revision(db)!==rev)throw new SignupError('Evidence changed during preparation. Refresh.',409);
  const json=JSON.stringify(p);await db.prepare("INSERT INTO production_evidence_reviews(id,kind,payload_json,payload_hash,source_revision,prepared_by,prepared_at,expires_at,state) VALUES(?,?,?,?,?,?,?,?,'pending')").bind(id,kind,json,await agreementHash(json),rev,actor.userId,now,expires).run();return {reviewId:id,pendingIndependentApproval:true,workEligible:false};
 }
 if(!actor.owner)throw new SignupError('An independent Operations owner must decide evidence reviews.',403);
 const id=text(input.reviewId,'review reference'),r=await db.prepare('SELECT * FROM production_evidence_reviews WHERE id=?').bind(id).first<{kind:ProductionEvidenceKind;payload_json:string;payload_hash:string;source_revision:number;prepared_by:string;expires_at:string;state:string}>();if(!r)throw new SignupError('Review not found.',404);
 if(r.prepared_by===actor.userId)throw new SignupError('The preparer cannot approve their own evidence review.',403);
 if(input.action!=='decide_evidence'||!['approve','reject'].includes(String(input.decision)))throw new SignupError('Choose an independent evidence decision.');
 const state=input.decision==='approve'?'approved':'rejected';if(r.state!=='pending'){if(r.state===state)return {alreadyRecorded:true,workEligible:false};throw new SignupError('The decision is already final. Prepare fresh evidence.',409);}
 const reason=text(input.reason,'independent findings');let statements:D1PreparedStatement[]=[];
 if(state==='approved'){
  if(input.evidenceIndependentlyChecked!==true||Date.parse(r.expires_at)<=Date.now()||await agreementHash(r.payload_json)!==r.payload_hash)throw new SignupError('Current, independently checked source evidence is required.',409);
  if(await revision(db)!==r.source_revision)throw new SignupError('Production evidence changed after preparation. Review and prepare a fresh submission.',409);
  statements=await plan(db,r.kind,JSON.parse(r.payload_json),id,actor.userId,now,r.expires_at);
 }
 await db.batch([db.prepare("UPDATE production_evidence_reviews SET state=?,decided_by=?,decided_at=?,reason=? WHERE id=? AND state='pending'").bind(state,actor.userId,now,reason,id),...statements]);return {state,workEligible:false};
}
