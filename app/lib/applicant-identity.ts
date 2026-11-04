import {SignupError} from './signup-server';
import {enqueueOfficerEmail,deliverOfficerEmail,type OfficerEmailRuntime} from './officer-email';
import {createVerifyNowProductionProvider, type PrivateIdentityCapture} from './verifynow-production';
import {verifyNowD1Receipts} from './verifynow-receipts';
import {readProductionIdentity, startProductionIdentity, recoverProductionIdentity} from './production-identity';

export type OfficerIdentityRuntime=OfficerEmailRuntime&{DB?:D1Database;BUCKET?:R2Bucket;VERIFYNOW_API_KEY?:string;VERIFYNOW_IDENTITY_POLICY_REFERENCE?:string;VERIFYNOW_IDENTITY_VALIDITY_DAYS?:string};
type CaseRow={source_id:string;owner_user_id:string;version:number;status:string;pathway:string;psiraStatus:string;corrections:string};
const consentVersion='lokd-officer-identity-2026-11-v1';
export async function identityCase(db:D1Database,userId:string,id:string){
 const c=await db.prepare(`SELECT c.source_id,c.owner_user_id,c.version,c.status,s.pathway,s.psira_status AS psiraStatus,c.corrections_json AS corrections
 FROM signup_cases c JOIN officer_applications s ON s.id=c.source_id WHERE c.kind='officer' AND c.source_id=? AND c.owner_user_id=? AND s.environment='prelaunch' AND s.integrity_state='user_submitted'`).bind(id,userId).first<CaseRow>();
 if(!c)throw new SignupError('Link your own officer application first.',404);
 if(c.status==='withdrawn')throw new SignupError('This application is withdrawn.',409);
 const changes=JSON.parse(c.corrections);return {...c,pathway:changes.pathway??c.pathway,psiraStatus:changes.psiraStatus??c.psiraStatus};
}
export function officerIdNumber(value:unknown){
 if(typeof value!=='string'||!/^\d{13}$/.test(value))throw new SignupError('Enter your 13-digit South African ID number.');
 let sum=0;for(let i=0;i<13;i++){let digit=Number(value[i]);if(i%2===1){digit*=2;if(digit>9)digit-=9;}sum+=digit;}
 const year=Number(value.slice(0,2)),month=Number(value.slice(2,4)),day=Number(value.slice(4,6));
 const fullYear=year>new Date().getUTCFullYear()%100?1900+year:2000+year;
 const date=new Date(Date.UTC(fullYear,month-1,day));
 if(sum%10!==0||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)throw new SignupError('Check your South African ID number.');
 return value;
}
export function officerIdentityProvider(runtime:OfficerIdentityRuntime,transport:typeof fetch=fetch){
 if(!runtime.DB||!runtime.BUCKET)throw new SignupError('Identity storage is unavailable. Operations must configure DB and BUCKET.',503);
 if(!runtime.VERIFYNOW_API_KEY)throw new SignupError('Identity checking is unavailable. Operations must configure VERIFYNOW_API_KEY.',503);
 const days=Number(runtime.VERIFYNOW_IDENTITY_VALIDITY_DAYS);
 if(!runtime.VERIFYNOW_IDENTITY_POLICY_REFERENCE||!Number.isSafeInteger(days)||days<1||days>365)throw new SignupError('Operations must configure VERIFYNOW_IDENTITY_POLICY_REFERENCE and VERIFYNOW_IDENTITY_VALIDITY_DAYS (1–365).',503);
 const db=runtime.DB,bucket=runtime.BUCKET;
 return createVerifyNowProductionProvider({apiKey:runtime.VERIFYNOW_API_KEY,policyReference:runtime.VERIFYNOW_IDENTITY_POLICY_REFERENCE,evidenceLifetimeMs:days*86400000,transport,
  receipts:verifyNowD1Receipts(db),
  captures:{async read(reference){
   const row=await db.prepare('SELECT * FROM officer_identity_captures WHERE capture_reference=?').bind(reference).first<{object_key:string;applicant_id:string;owner_user_id:string;applicant_version:number}>();
   if(!row)return null;
   const current=await identityCase(db,row.owner_user_id,row.applicant_id);
   if(current.version!==row.applicant_version)return null;
   const object=await bucket.get(row.object_key);if(!object)return null;
   return object.json<PrivateIdentityCapture>();
  }},
  evidence:{async put(caseId,bytes,digest){
   const reference='identity_evidence_'+crypto.randomUUID();
   const objectKey='officer-identity/evidence/'+reference;
   await bucket.put(objectKey,bytes,{httpMetadata:{contentType:'application/json'},customMetadata:{caseId,digest}});
   await db.prepare('INSERT INTO officer_identity_evidence(reference,case_id,object_key,sha256,recorded_at) VALUES(?,?,?,?,?)').bind(reference,caseId,objectKey,digest,new Date().toISOString()).run();
   return reference;
  }},
 });
}
export async function readApplicantIdentity(db:D1Database,userId:string,id:string){
 const c=await identityCase(db,userId,id);
 const row=await db.prepare('SELECT id FROM production_identity_cases WHERE applicant_id=? AND applicant_version=? AND owner_user_id=?').bind(id,c.version,userId).first<{id:string}>();
 const result=row?await readProductionIdentity(db,{userId,email:'',operations:false},row.id):null;
 const history=await db.prepare(`SELECT o.id,o.outcome AS state,o.recorded_at AS recordedAt FROM production_identity_outcomes o JOIN production_identity_cases c ON c.id=o.case_id WHERE c.applicant_id=? AND c.owner_user_id=? ORDER BY o.recorded_at DESC,o.sequence DESC LIMIT 50`).bind(id,userId).all();
 return {caseId:id,caseVersion:c.version,mode:'production',nextStep:'identity_review',consentVersion,identityVerified:result?.identityVerified??false,outcome:result?.outcome??'not_started',identityCaseId:result?.id??null,outcomeId:result?.outcomeId??null,history:history.results};
}
export async function runApplicantIdentity(runtime:OfficerIdentityRuntime,userId:string,input:Record<string,unknown>,transport:typeof fetch=fetch){
 const provider=officerIdentityProvider(runtime,transport),db=runtime.DB!;
 if(typeof input.caseId!=='string'||input.caseId.length>100||Object.keys(input).some(k=>!['caseId','caseVersion','idNumber','consent','consentVersion'].includes(k)))throw new SignupError('Choose your officer application.');
 const c=await identityCase(db,userId,input.caseId);
 if(input.caseVersion!==c.version)throw new SignupError('Your application changed. Refresh before checking.',409);
 const existing=await db.prepare('SELECT id FROM production_identity_cases WHERE applicant_id=? AND applicant_version=?').bind(input.caseId,c.version).first();
 if(existing)return identityNotification(runtime,userId,input.caseId);
 if(input.consent!==true||input.consentVersion!==consentVersion)throw new SignupError('Read and accept the current identity consent.');
 const idNumber=officerIdNumber(input.idNumber);
 let row=await db.prepare('SELECT capture_reference FROM officer_identity_captures WHERE applicant_id=? AND applicant_version=? AND owner_user_id=?').bind(input.caseId,c.version,userId).first<{capture_reference:string}>();
 if(!row){
  const reference='identity_capture_'+crypto.randomUUID(),now=new Date().toISOString();
  const objectKey='officer-identity/captures/'+reference;
  const capture:PrivateIdentityCapture={environment:'production',applicantId:input.caseId,applicantVersion:c.version,ownerUserId:userId,captureReference:reference,consentVersion,idNumber,capturedAt:now,expiresAt:new Date(Date.now()+Number(runtime.VERIFYNOW_IDENTITY_VALIDITY_DAYS)*86400000).toISOString(),consentEvidenceReference:'identity_consent_'+reference};
  await runtime.BUCKET!.put(objectKey,JSON.stringify(capture),{httpMetadata:{contentType:'application/json'}});
  try{await db.batch([
   db.prepare('INSERT INTO officer_identity_captures(capture_reference,applicant_id,applicant_version,owner_user_id,object_key,consent_version,captured_at,expires_at) VALUES(?,?,?,?,?,?,?,?)').bind(reference,input.caseId,c.version,userId,objectKey,consentVersion,now,capture.expiresAt),
   db.prepare("INSERT INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at) VALUES(?,'officer',?,'identity_consent_recorded','officer_application',?,?,?)").bind(crypto.randomUUID(),userId,input.caseId,consentVersion,now),
  ]);row={capture_reference:reference};}
  catch(error){await runtime.BUCKET!.delete(objectKey);row=await db.prepare('SELECT capture_reference FROM officer_identity_captures WHERE applicant_id=? AND applicant_version=? AND owner_user_id=?').bind(input.caseId,c.version,userId).first<{capture_reference:string}>();if(!row)throw error;}
 }
 await startProductionIdentity(db,{userId,email:'',operations:false},{applicantId:input.caseId,applicantVersion:c.version,captureReference:row.capture_reference,consentVersion},provider);
 return identityNotification(runtime,userId,input.caseId);
}
async function identityNotification(runtime:OfficerIdentityRuntime,userId:string,caseId:string){
 const state=await readApplicantIdentity(runtime.DB!,userId,caseId);
 if(!state.outcomeId)return state;
 const row=await runtime.DB!.prepare('SELECT email_normalized AS email FROM officer_applications WHERE id=?').bind(caseId).first<{email:string}>();
 if(!row)return state;
 const id='officer-identity:'+state.outcomeId;
 await enqueueOfficerEmail(runtime.DB!,{id,applicationId:caseId,recipient:row.email,subject:'Your LOKD identity check',text:'Your identity check status has been updated. Sign in to your LOKD account to see your result and next step: https://officers.lokd.co.za/officer/identity?caseId='+encodeURIComponent(caseId)+'\n\nLOKD Security'});
 const notification=await deliverOfficerEmail(runtime.DB!,runtime,id);
 return {...state,notification};
}
export async function recoverApplicantIdentity(runtime:OfficerIdentityRuntime,operator:string,input:Record<string,unknown>,transport:typeof fetch=fetch){
 const provider=officerIdentityProvider(runtime,transport),db=runtime.DB!;
 if(typeof input.caseId!=='string'||typeof input.identityCaseId!=='string'||typeof input.outcomeId!=='string')throw new SignupError('Choose an identity result to refresh.');
 const record=await db.prepare('SELECT owner_user_id,applicant_id FROM production_identity_cases WHERE id=?').bind(input.identityCaseId).first<{owner_user_id:string;applicant_id:string}>();
 if(!record||record.applicant_id!==input.caseId)throw new SignupError('Identity record not found.',404);
 await recoverProductionIdentity(db,{userId:operator,email:'',operations:true},input.identityCaseId,input.outcomeId,provider);
 return readApplicantIdentity(db,record.owner_user_id,record.applicant_id);
}
