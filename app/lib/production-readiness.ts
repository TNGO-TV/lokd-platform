import {SignupError} from './signup-server';
import {agreementHash} from './agreement-acceptance';
import {tokenHash} from './passport-server';
import type {SigningActor} from './production-signing';

type Kind='rule'|'review'|'passport';
export type ReadinessRuleInput={code:string;label:string;category:'core'|'service'|'purpose';serviceType?:string;purposeCode?:string;requirements:string[];maxDays:number;evidenceReference:string;expiresAt:string};
export type ReadinessEvidence={requirement:string;ownerUserId:string;reference:string;sha256:string;checkedAt:string;expiresAt:string};
const text=(v:unknown)=>{if(typeof v!=='string'||!v.trim()||v.length>1200)throw new SignupError('Provide a valid reference or finding.');return v.trim();};
const time=(v:string)=>{const n=Date.parse(v);if(!Number.isFinite(n))throw new SignupError('Provide an exact evidence date.');return n;};
const ops=(a:SigningActor)=>{if(!a.operations)throw new SignupError('Operations access required.',403);};
const iso=(n:number)=>new Date(n).toISOString();
async function owned(db:D1Database,a:SigningActor,id:string){
 const l=await db.prepare("SELECT owner_user_id FROM production_entity_links WHERE kind='officer' AND entity_id=?").bind(text(id)).first<{owner_user_id:string}>();
 if(!l||(!a.operations&&l.owner_user_id!==a.userId))throw new SignupError('Officer record not found.',404);return l;
}
async function bridge(db:D1Database,id:string,reviewId:string){
 const r=await db.prepare("SELECT a.source_json,a.expires_at FROM current_production_officer_approvals a JOIN officers o ON o.id=a.officer_id AND o.approval_status='approved' WHERE a.officer_id=? AND a.id=?").bind(id,reviewId).first<{source_json:string;expires_at:string}>();
 if(!r)throw new SignupError('Current exact officer approval required.',409);
 return {...r,owner:JSON.parse(r.source_json).owner_user_id as string};
}
export async function prepareReadinessRule(db:D1Database,a:SigningActor,input:ReadinessRuleInput){
 ops(a);
 const category=input.category,service=input.serviceType??null,purpose=input.purposeCode??null;
 if(!(['core','service','purpose'].includes(category))||!Number.isSafeInteger(input.maxDays)||input.maxDays<1||input.maxDays>3650||!Array.isArray(input.requirements)||input.requirements.length<1||input.requirements.length>30)throw new SignupError('Explicit versioned evidence requirements and validity limit are required.');
 const requirements=input.requirements.map(text);if(new Set(requirements).size!==requirements.length)throw new SignupError('Evidence requirements must be distinct.');
 if(category==='core'&&(input.code!=='core_ready'||service||purpose)||category==='service'&&(!['Unarmed','Armed','VIP'].includes(service??'')||input.code!=='service_'+service?.toLowerCase()||purpose)||category==='purpose'&&(!purpose||!/^[a-z][a-z0-9_]{1,79}$/.test(purpose)||input.code!=='purpose_'+purpose||service))throw new SignupError('Use an exact core, service or purpose rule scope.');
 const expiry=time(input.expiresAt);if(expiry<=Date.now())throw new SignupError('Policy expiry must be in the future.');
 const id=crypto.randomUUID();await db.prepare('INSERT INTO production_readiness_rules VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,text(input.code),text(input.label),category,service,purpose,JSON.stringify(requirements),input.maxDays,text(input.evidenceReference),iso(expiry),a.userId,iso(Date.now())).run();
 return {id,pendingIndependentApproval:true};
}
export async function prepareReadinessReview(db:D1Database,a:SigningActor,input:{officerId:string;officerReviewId:string;ruleId:string;evidence:ReadinessEvidence[];sourcesActuallyInspected:boolean}){
 ops(a);if(!input.sourcesActuallyInspected)throw new SignupError('Inspect the actual applicant evidence first.');
 const b=await bridge(db,text(input.officerId),text(input.officerReviewId));if(b.owner===a.userId)throw new SignupError('Another assessor must inspect your evidence.',403);
 const rule=await db.prepare('SELECT * FROM current_production_readiness_rules WHERE id=?').bind(text(input.ruleId)).first<{requirements_json:string;max_days:number;expires_at:string}>();if(!rule)throw new SignupError('Approved current evidence policy required; none is inferred.',409);
 const requirements=JSON.parse(rule.requirements_json) as string[];
 if(!Array.isArray(input.evidence)||input.evidence.length!==requirements.length)throw new SignupError('Supply every policy evidence requirement exactly once.');
 let expires=Math.min(time(rule.expires_at),time(b.expires_at));
 const evidence=input.evidence.map(e=>{
  if(!e||!requirements.includes(e.requirement)||e.ownerUserId!==b.owner||!(/^[a-f0-9]{64}$/.test(e.sha256)))throw new SignupError('Evidence must bind this exact owner and policy requirement.');
  const checked=time(e.checkedAt),until=time(e.expiresAt);if(checked>Date.now()||until<=Date.now()||until<=checked)throw new SignupError('Evidence is future-dated or expired.');
  expires=Math.min(expires,until,checked+rule.max_days*86400000);
  return {requirement:e.requirement,ownerUserId:b.owner,reference:text(e.reference),sha256:e.sha256,checkedAt:iso(checked),expiresAt:iso(until)};
 });
 if(new Set(evidence.map(e=>e.requirement)).size!==requirements.length||expires<=Date.now())throw new SignupError('Evidence is incomplete, duplicated or stale.');
 evidence.sort((x,y)=>x.requirement.localeCompare(y.requirement));
 const id=crypto.randomUUID();await db.prepare('INSERT INTO production_readiness_reviews VALUES(?,?,?,?,?,?,?,?)').bind(id,input.officerId,input.officerReviewId,input.ruleId,JSON.stringify(evidence),iso(expires),a.userId,iso(Date.now())).run();
 return {id,expiresAt:iso(expires),pendingIndependentApproval:true,workEligible:false};
}
export async function decideReadiness(db:D1Database,a:SigningActor,input:{kind:Kind;id:string;decision:'approve'|'reject';independentlyInspected:boolean;reason:string}){
 ops(a);if(!a.owner)throw new SignupError('Assigned independent Operations owner required.',403);
 if(!['rule','review','passport'].includes(input.kind)||!['approve','reject'].includes(input.decision)||!input.independentlyInspected)throw new SignupError('Independently inspect the exact policy and source evidence before deciding.');
 // Immutable target + fresh SQL views enforce source version, expiry, separation
 // and atomic projection even if evidence changes after the request was read.
 await db.prepare('INSERT INTO production_readiness_decisions VALUES(?,?,?,?,?,?)').bind(input.kind,text(input.id),input.decision,a.userId,text(input.reason),iso(Date.now())).run();
 return {id:input.id,decision:input.decision,workEligible:false};
}
export async function setReadinessOptIn(db:D1Database,a:SigningActor,input:{officerId:string;serviceType:string;expectedRevision:number;optedIn:boolean}){
 const l=await owned(db,a,input.officerId);if(l.owner_user_id!==a.userId)throw new SignupError('Only the officer may choose service opt-in.',403);
 if(!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0||typeof input.optedIn!=='boolean'||!['Unarmed','Armed','VIP'].includes(input.serviceType))throw new SignupError('Choose a valid service and current revision.');
 const id=crypto.randomUUID();await db.prepare('INSERT INTO production_readiness_optins VALUES(?,?,?,?,?,?,?)').bind(id,input.officerId,input.serviceType,input.expectedRevision+1,input.optedIn?1:0,a.userId,iso(Date.now())).run();
 return {id,revision:input.expectedRevision+1,optedIn:input.optedIn,workEligible:false};
}
export async function prepareReadinessPassport(db:D1Database,a:SigningActor,input:{officerId:string;officerReviewId:string;reviewIds:string[];expectedSequence:number;deliveryId?:string}){
 ops(a);const b=await bridge(db,text(input.officerId),text(input.officerReviewId));if(b.owner===a.userId)throw new SignupError('Independent passport preparer required.',403);
 if(!Number.isSafeInteger(input.expectedSequence)||input.expectedSequence<0||!Array.isArray(input.reviewIds)||input.reviewIds.length<3||input.reviewIds.length>30||new Set(input.reviewIds).size!==input.reviewIds.length)throw new SignupError('Select the exact current core, service and purpose reviews.');
 const ids=input.reviewIds.map(text).sort(),categories=new Set<string>(),optins:string[]=[];let expires=time(b.expires_at);
 for(const id of ids){
  const r=await db.prepare('SELECT category,service_type,expires_at FROM current_production_readiness_reviews WHERE id=? AND officer_id=? AND officer_review_id=?').bind(id,input.officerId,input.officerReviewId).first<{category:string;service_type:string|null;expires_at:string}>();
  if(!r)throw new SignupError('Selected readiness review changed or expired.',409);categories.add(r.category);expires=Math.min(expires,time(r.expires_at));
  if(r.category==='service'){
   const opt=await db.prepare('SELECT id FROM current_production_readiness_optins WHERE officer_id=? AND service_type=? AND opted_in=1').bind(input.officerId,r.service_type).first<{id:string}>();
   if(!opt)throw new SignupError('The officer must opt in to each selected service.',409);optins.push(opt.id);
  }
 }
 if(categories.size!==3)throw new SignupError('Current core, service and purpose reviews are all required.');
 const id=crypto.randomUUID();
 let delivery:{id:string;token_hash:string}|null=null;
 if(input.deliveryId){
  delivery=await db.prepare('SELECT id,token_hash FROM current_production_passport_deliveries WHERE id=? AND officer_id=? AND owner_user_id=?').bind(text(input.deliveryId),input.officerId,b.owner).first<{id:string;token_hash:string}>();
  if(!delivery)throw new SignupError('Current owner-bound private delivery required.',409);
 }
 // Legacy internal callers retain the one-time token return. HTTP callers must
 // supply the officer's delivery request and never receive token material.
 const token=delivery?null:'lokd_live_'+crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
 const insert=db.prepare('INSERT INTO production_readiness_passports VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,input.officerId,input.expectedSequence+1,input.officerReviewId,JSON.stringify(ids),JSON.stringify(optins.sort()),delivery?.token_hash??await tokenHash(token!),iso(expires),a.userId,iso(Date.now()));
 if(delivery)await db.batch([insert,db.prepare('INSERT INTO production_passport_delivery_bindings VALUES(?,?,?)').bind(delivery.id,id,iso(Date.now()))]);else await insert.run();
 return {id,sequence:input.expectedSequence+1,...(token?{token}:{}),...(delivery?{deliveryId:delivery.id}:{}),expiresAt:iso(expires),pendingIndependentApproval:true,workEligible:false};
}
export async function holdReadiness(db:D1Database,a:SigningActor,input:{kind:Kind;id:string;disposition:'suspend'|'revoke';reason:string}){
 ops(a);if(!['rule','review','passport'].includes(input.kind)||!['suspend','revoke'].includes(input.disposition))throw new SignupError('Choose a readiness suspension or revocation.');
 await db.prepare('INSERT INTO production_readiness_holds VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),input.kind,text(input.id),input.disposition,a.userId,text(input.reason),iso(Date.now())).run();
 return {held:true,workEligible:false};
}
export async function readProductionReadiness(db:D1Database,a:SigningActor,officerId:string){
 await owned(db,a,officerId);
 const reviews=await db.prepare('SELECT id,code,label,category,service_type AS serviceType,purpose_code AS purposeCode,expires_at AS expiresAt FROM current_production_readiness_reviews WHERE officer_id=?').bind(officerId).all();
 const optins=await db.prepare('SELECT service_type AS serviceType,revision,opted_in AS optedIn FROM current_production_readiness_optins WHERE officer_id=?').bind(officerId).all();
 const passport=await db.prepare('SELECT id,sequence,expires_at AS expiresAt FROM usable_production_readiness_passports WHERE officer_id=?').bind(officerId).first();
 const latest=await db.prepare('SELECT max(sequence) AS sequence FROM production_readiness_passports WHERE officer_id=?').bind(officerId).first<{sequence:number|null}>();
 return {officerId,reviews:reviews.results,optins:optins.results,passport,latestSequence:latest?.sequence??0,workEligible:false};
}
export async function readinessContract(db:D1Database,officerId:string,deadline:string,service:string,purpose:string){
 if(time(deadline)<Date.now())throw new SignupError('Future assignment deadline required.');
 const p=await db.prepare(`SELECT p.* FROM usable_production_readiness_passports p WHERE p.officer_id=? AND julianday(p.expires_at)>=julianday(?)
 AND EXISTS(SELECT 1 FROM json_each(p.items_json) j JOIN current_production_readiness_reviews r ON r.id=j.value WHERE r.service_type=?)
 AND EXISTS(SELECT 1 FROM json_each(p.items_json) j JOIN current_production_readiness_reviews r ON r.id=j.value WHERE r.purpose_code=?)`).bind(officerId,deadline,service,purpose).first<Record<string,unknown>>();
 if(!p)return null;
 // A source commitment for internal consumers, not an activation authorization.
 const {token_hash:tokenHashValue,...evidence}=p;void tokenHashValue;
 return {contract:'lokd.production-readiness.v1',...evidence,hash:await agreementHash(JSON.stringify(evidence)),workEligible:false};
}
