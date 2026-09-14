import {SignupError} from './signup-server';
import type {SigningActor} from './production-signing';

const reference=(v:unknown)=>{if(typeof v!=='string'||!v.trim()||v.length>300)throw new SignupError('Provide a valid delivery reference.');return v.trim();};
export async function requestPassportDelivery(db:D1Database,a:SigningActor,input:{officerId:string;requestKey:string;tokenHash:string}){
 if(a.operations)throw new SignupError('Use your Officer workspace for private passport delivery.',403);
 const officerId=reference(input.officerId),key=reference(input.requestKey);
 if(!/^[a-f0-9]{64}$/.test(input.tokenHash))throw new SignupError('Supply the SHA-256 digest of your private random token.');
 const link=await db.prepare("SELECT l.case_id,l.case_version FROM production_entity_links l JOIN signup_cases c ON c.kind=l.kind AND c.source_id=l.case_id AND c.owner_user_id=l.owner_user_id AND c.version=l.case_version AND c.status='reviewed' WHERE l.kind='officer' AND l.entity_id=? AND l.owner_user_id=?").bind(officerId,a.userId).first<{case_id:string;case_version:number}>();
 if(!link)throw new SignupError('Current reviewed officer record not found.',404);
 const saved=await db.prepare('SELECT id,officer_id,token_hash,applicant_version FROM production_passport_deliveries WHERE owner_user_id=? AND request_key=?').bind(a.userId,key).first<{id:string;officer_id:string;token_hash:string;applicant_version:number}>();
 if(saved){if(saved.officer_id!==officerId||saved.token_hash!==input.tokenHash||saved.applicant_version!==link.case_version)throw new SignupError('This delivery key belongs to different or stale material.',409);return deliveryStatus(db,a,officerId,saved.id);}
 const id=crypto.randomUUID(),stamp=Date.now(),now=new Date(stamp).toISOString(),expires=new Date(stamp+86400000).toISOString();
 try {await db.prepare('INSERT INTO production_passport_deliveries VALUES(?,?,?,?,?,?,?,?,?)').bind(id,officerId,a.userId,link.case_id,link.case_version,key,input.tokenHash,now,expires).run();}
 catch(error){const winner=await db.prepare('SELECT id,officer_id,token_hash,applicant_version FROM production_passport_deliveries WHERE owner_user_id=? AND request_key=?').bind(a.userId,key).first<{id:string;officer_id:string;token_hash:string;applicant_version:number}>();if(winner&&winner.officer_id===officerId&&winner.token_hash===input.tokenHash&&winner.applicant_version===link.case_version)return deliveryStatus(db,a,officerId,winner.id);throw error;}
 return deliveryStatus(db,a,officerId,id);
}
async function deliveryStatus(db:D1Database,a:SigningActor,officerId:string,id:string){const result=await readPassportDeliveries(db,a,officerId,id);return {...result.deliveries[0],workEligible:false};}
export async function readPassportDeliveries(db:D1Database,a:SigningActor,officerId:string,id?:string){
 const l=await db.prepare("SELECT owner_user_id FROM production_entity_links WHERE kind='officer' AND entity_id=?").bind(reference(officerId)).first<{owner_user_id:string}>();
 if(!l||(!a.operations&&l.owner_user_id!==a.userId))throw new SignupError('Officer record not found.',404);
 const result=await db.prepare(`SELECT d.id AS deliveryId,d.officer_id AS officerId,d.applicant_version AS applicantVersion,d.created_at AS createdAt,d.expires_at AS expiresAt,b.passport_id AS passportId,p.sequence,
 CASE WHEN u.id IS NOT NULL THEN 'available' WHEN b.passport_id IS NOT NULL AND (decision.decision IS NOT NULL OR v.id IS NULL OR c.id IS NULL OR p.sequence<(SELECT max(sequence) FROM production_readiness_passports WHERE officer_id=d.officer_id)) THEN 'unavailable' WHEN b.passport_id IS NOT NULL THEN 'awaiting_approval' WHEN c.id IS NULL THEN 'expired_or_stale' ELSE 'awaiting_preparation' END AS status
 FROM production_passport_deliveries d LEFT JOIN current_production_passport_deliveries c ON c.id=d.id LEFT JOIN production_passport_delivery_bindings b ON b.delivery_id=d.id LEFT JOIN production_readiness_passports p ON p.id=b.passport_id LEFT JOIN valid_production_readiness_passports v ON v.id=p.id LEFT JOIN usable_production_readiness_passports u ON u.id=p.id LEFT JOIN production_readiness_decisions decision ON decision.kind='passport' AND decision.target_id=p.id WHERE d.officer_id=? ${id?'AND d.id=?':''} ORDER BY d.rowid DESC LIMIT 50`).bind(officerId,...(id?[id]:[])).all();
 return {officerId,deliveries:result.results,workEligible:false};
}
