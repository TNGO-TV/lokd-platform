import {SignupError} from './signup-server';
import {agreementHash} from './agreement-acceptance';
import {productionOperatorControl} from './production-operator-control';
import {operationsMfaRequired} from './operations-mfa-policy';
import {accountFingerprint,destinationKey,fetchRecipient,type DestinationMode,type DestinationRuntime} from './destination-evidence';
import type {SigningActor} from './production-signing';
const text=(v:unknown,label:string,max=200)=>{if(typeof v!=='string'||v.trim().length<3||v.length>max)throw new SignupError(`Provide ${label}.`);return v.trim();};
const digest=(v:unknown)=>{if(typeof v!=='string'||!/^[a-f0-9]{64}$/.test(v))throw new SignupError('Provide the SHA-256 digest of the exact source document.');return v;};
const reference=(v:unknown,label:string)=>{const s=text(v,label);if(!/^(vault|document|evidence):[A-Za-z0-9_./:-]{3,180}$/.test(s))throw new SignupError('Use a secure document reference, not bank details or a public link.');return s;};
const account=(v:unknown)=>{if(typeof v!=='string'||!/^\d{6,20}$/.test(v))throw new SignupError('Enter the account number from the ownership evidence for this check.');return v;};
type Source={employer_id:string;source_json:string};
type Payload={sourceJson:string;provider:NonNullable<Awaited<ReturnType<typeof fetchRecipient>>>;providerHash:string;ownershipReference:string;ownershipHash:string;mandateReference:string;mandateHash:string;capabilityReference:string;capabilityHash:string;supersedesId:string;note:string;representativeUserId:string;representativeReference:string;representativeHash:string;companyReference:string;companyHash:string};
type Review={id:string;employer_id:string;mode:DestinationMode;revision:number;request_hash:string;payload_json:string;payload_hash:string;prepared_by:string;prepared_user:string;status:string};
async function role(db:D1Database,actor:SigningActor){
 if(!actor.operations)return false;
 return !!await db.prepare("SELECT a.id FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE lower(a.email)=? AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active' AND g.role IN ('operations_controller','finance_approver') LIMIT 1").bind(actor.email.toLowerCase()).first();
}
export async function readPartnerDestinations(db:D1Database,actor:SigningActor){
 const allowed=await role(db,actor);if(!allowed)return {partnerDestinationAccess:false,partnerDestinationReviews:[],partnerDestinationCandidates:[]};
 return {partnerDestinationAccess:true,partnerDestinationReviews:(await db.prepare('SELECT * FROM partner_destination_current ORDER BY prepared_at DESC LIMIT 100').all()).results,partnerDestinationCandidates:(await db.prepare('SELECT employer_id,source_json FROM partner_destination_sources ORDER BY employer_id LIMIT 500').all()).results};
}
export async function operatePartnerDestination(db:D1Database,actor:SigningActor,input:Record<string,unknown>,headers:Headers,runtime:DestinationRuntime={},transport:typeof fetch=fetch){
 const preparing=input.action==='prepare_partner_destination',reviewing=['approve_partner_destination','reject_partner_destination','recheck_partner_destination'].includes(String(input.action));
 if(!preparing&&!reviewing&&input.action!=='hold_partner_destination')throw new SignupError('Choose a supported destination action.');
 const op=await productionOperatorControl(db,actor,headers,preparing?'partner.prepare':'partner.approve',0),now=new Date().toISOString();
 if(preparing){
  if(input.mode!=='test'&&input.mode!=='live')throw new SignupError('Choose an explicit provider mode.');const mode=input.mode;
  if(input.documentsReviewed!==true||input.capabilityReviewed!==true)throw new SignupError('Review ownership, the company payment mandate and this provider account’s South African transfer capability.');
  const secret=destinationKey(runtime,mode),requestKey=text(input.requestKey,'a unique destination request reference');
  const employerId=text(input.employerId,'the legal partner company'),code=text(input.recipientCode,'the existing recipient code'),accountNumber=account(input.accountNumber);
  const ownershipReference=reference(input.ownershipReference,'the ownership document reference'),ownershipHash=digest(input.ownershipHash),mandateReference=reference(input.mandateReference,'the company payment mandate reference'),mandateHash=digest(input.mandateHash),capabilityReference=reference(input.capabilityReference,'the provider capability source'),capabilityHash=digest(input.capabilityHash),supersedesId=typeof input.supersedesId==='string'?input.supersedesId:'',note=text(input.note,'the ownership and mandate findings',1200);
  const representativeUserId=text(input.representativeUserId,'the authorized representative’s sign-in user ID'),representativeReference=reference(input.representativeReference,'the representative identity and authority evidence'),representativeHash=digest(input.representativeHash),companyReference=reference(input.companyReference,'the company registration evidence'),companyHash=digest(input.companyHash);
  if(representativeUserId===actor.userId)throw new SignupError('A company representative cannot prepare their own company destination.',403);
  const integrationId=text(input.integrationId,'the provider integration ID');if(!/^[1-9][0-9]{0,19}$/.test(integrationId))throw new SignupError('Use the provider integration ID from the capability evidence.');
  const expiry=typeof input.expiresAt==='string'?Date.parse(input.expiresAt):NaN;if(!Number.isFinite(expiry)||expiry<=Date.now()||expiry>Date.now()+30*86400000)throw new SignupError('Use an evidence expiry within 30 days.');
  const requestHash=await agreementHash(JSON.stringify({employerId,mode,code,accountHash:await accountFingerprint(secret,'input',accountNumber),ownershipReference,ownershipHash,mandateReference,mandateHash,capabilityReference,capabilityHash,integrationId,supersedesId,note,representativeUserId,representativeReference,representativeHash,companyReference,companyHash,expiry}));
  const existing=await db.prepare('SELECT id,request_hash FROM partner_destination_reviews WHERE request_key=?').bind(requestKey).first<Review>();
  if(existing){if(existing.request_hash!==requestHash)throw new SignupError('This request reference belongs to different evidence.',409);return {destinationId:existing.id,alreadyPrepared:true,moneyMoved:false};}
  const source=await db.prepare('SELECT * FROM partner_destination_sources WHERE employer_id=?').bind(employerId).first<Source>();if(!source)throw new SignupError('Choose a current, independently reviewed partner company.',409);
  if(expiry>Date.parse(JSON.parse(source.source_json).expiresAt))throw new SignupError('Destination evidence cannot outlive its company compliance evidence.',409);
  const provider=await fetchRecipient(secret,code,mode,transport);
  if(!provider||provider.integration!==integrationId||provider.accountHash!==await accountFingerprint(secret,provider.bankCode,accountNumber))throw new SignupError('The active ZAR bank recipient, integration and ownership account must agree.',409);
  const last=await db.prepare("SELECT r.id FROM partner_destination_reviews r JOIN partner_destination_decisions d ON d.review_id=r.id AND d.decision IN ('verified_live','confirmed_test') WHERE r.employer_id=? AND r.mode=? ORDER BY r.revision DESC LIMIT 1").bind(source.employer_id,mode).first<{id:string}>();if((last?.id??'')!==supersedesId)throw new SignupError('Explicitly select the last approved destination being replaced.',409);
  const revision=(await db.prepare('SELECT coalesce(max(revision),0)+1 AS revision FROM partner_destination_reviews WHERE employer_id=? AND mode=?').bind(source.employer_id,mode).first<{revision:number}>())!.revision;
  const payload:Payload={sourceJson:source.source_json,provider,providerHash:await agreementHash(JSON.stringify(provider)),ownershipReference,ownershipHash,mandateReference,mandateHash,capabilityReference,capabilityHash,supersedesId,note,representativeUserId,representativeReference,representativeHash,companyReference,companyHash};
  const json=JSON.stringify(payload),id='PDEST-'+crypto.randomUUID();
  await db.prepare('INSERT INTO partner_destination_reviews VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,employerId,mode,revision,requestKey,requestHash,json,await agreementHash(json),op.id,actor.userId,now,new Date(Date.now()+30*60000).toISOString(),new Date(expiry).toISOString()).run();
  return {destinationId:id,pendingIndependentReview:true,moneyMoved:false};
 }
 const id=text(input.destinationId,'the destination review'),r=await db.prepare('SELECT * FROM partner_destination_current WHERE id=?').bind(id).first<Review>();if(!r)throw new SignupError('Destination review not found.',404);
 if(input.payloadHash!==r.payload_hash||await agreementHash(r.payload_json)!==r.payload_hash)throw new SignupError('Refresh and review the exact destination evidence.',409);
 const p=JSON.parse(r.payload_json) as Payload;
 if(p.representativeUserId===actor.userId)throw new SignupError('A company representative cannot review their own company destination.',403);
 const hold=async(reason:string)=>{await db.prepare('INSERT OR IGNORE INTO partner_destination_holds VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),id,op.id,actor.userId,reason,new Date().toISOString()).run();return {held:true,moneyMoved:false};};
 if(input.action==='hold_partner_destination')return hold(text(input.note,'the suspension findings',1200));
 if(input.action==='recheck_partner_destination'){
  try{const current=await fetchRecipient(destinationKey(runtime,r.mode),p.provider.code,r.mode,transport);if(!current||await agreementHash(JSON.stringify(current))!==p.providerHash)return hold('Provider recipient changed or became inactive. Prepare new evidence and independent review.');}
  catch{return hold('Provider recipient could not be revalidated. Prepare a fresh independent review after recovery.');}
  return {recipientUnchanged:true,status:r.status,moneyMoved:false};
 }
 await productionOperatorControl(db,actor,headers,'partner.approve',0,r.prepared_by);
 if(r.prepared_user===actor.userId)throw new SignupError('The preparer cannot approve their own destination.',403);
 const approving=input.action==='approve_partner_destination',decision=approving?r.mode==='live'?'verified_live':'confirmed_test':'rejected';
 const existing=await db.prepare('SELECT decision FROM partner_destination_decisions WHERE review_id=?').bind(id).first<{decision:string}>();
 if(existing){if(existing.decision!==decision)throw new SignupError('This destination decision is final. Prepare a new review.',409);return {alreadyDecided:true,status:r.status,moneyMoved:false};}
 const note=text(input.note,'the independent findings',1200);let providerHash:string|null=null;
 if(approving){
  if(r.status!=='pending'||input.evidenceReviewed!==true)throw new SignupError('Review current ownership, mandate and provider capability evidence within 30 minutes.',409);
  const secret=destinationKey(runtime,r.mode),expected=account(input.accountNumber);
  if(await accountFingerprint(secret,p.provider.bankCode,expected)!==p.provider.accountHash)throw new SignupError('The independently checked ownership account does not match.',409);
  const current=await fetchRecipient(secret,p.provider.code,r.mode,transport);providerHash=current?await agreementHash(JSON.stringify(current)):null;
  if(providerHash!==p.providerHash)return hold('Provider recipient changed during independent review. Prepare fresh evidence.');
 }
 await db.prepare('INSERT INTO partner_destination_decisions VALUES(?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),id,decision,op.id,actor.userId,r.payload_hash,providerHash,note,operationsMfaRequired()?'mfa_verified':'owner_mfa_exception',new Date().toISOString()).run();
 return {decision,moneyMoved:false,paymentReleased:false};
}
