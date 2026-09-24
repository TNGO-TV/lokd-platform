import {projectSignedWorkforceTerms} from './signed-workforce-terms';
import {SignupError,type SignupActor} from './signup-server';
import {agreementHash,canonicalAgreementContext,prepareAgreementReceipt,storeAgreementReceipt,type AgreementVersion} from './agreement-acceptance';
import {activationAgreementContext,type ActivationAgreementRole} from './agreement-activation';
import {evaluateAssignmentActivation} from './assignment-activation-server';
const roles=['CLIENT_MSA','SERVICE_ORDER','OFFICER_EMPLOYMENT','PARTNER_SERVICE'];
const field=(v:unknown,label:string,min=1,max=200)=>{if(typeof v!=='string'||v.trim().length<min||v.length>max)throw new SignupError(`Provide ${label} (${min}–${max} characters).`);return v.trim();};
export type SigningActor=SignupActor&{owner:boolean};
export async function manageProductionDocument(db:D1Database,actor:SigningActor,input:Record<string,unknown>){
 if(!actor.operations)throw new SignupError('Operations access required.',403);const now=new Date().toISOString();
 if(input.action==='draft'){
  if(!roles.includes(String(input.documentCode)))throw new SignupError('Choose a supported agreement purpose.');
  const wording=field(input.wording,'the document wording',30,100000),id='DOC-'+crypto.randomUUID();
  await db.prepare('INSERT INTO signing_document_bodies(id,document_code,document_version,entity_id,locale,wording,content_hash,prepared_by,prepared_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,input.documentCode,field(input.documentVersion,'version'),field(input.entityId,'contracting entity'),field(input.locale,'locale',2,30),wording,await agreementHash(wording),actor.userId,now).run();return {documentId:id,status:'draft'};
 }
 if(!actor.owner)throw new SignupError('The authorised Operations owner must approve or withdraw legal wording.',403);
 const id=field(input.documentId,'document ID');
 if(input.action==='withdraw_document'){
  const reason=field(input.reason,'withdrawal reason',12,1200);
  await db.prepare('INSERT OR IGNORE INTO signing_document_withdrawals VALUES(?,?,?,?)').bind(id,actor.userId,reason,now).run();return {documentId:id,status:'withdrawn'};
 }
 if(input.action!=='approve'||input.legalApprovalConfirmed!==true)throw new SignupError('Explicit approval of the exact legal wording is required.');
 const d=await db.prepare('SELECT * FROM signing_document_bodies WHERE id=?').bind(id).first<Record<string,string>>();if(!d)throw new SignupError('Document draft not found.',404);
 if(d.content_hash!==input.contentHash||await agreementHash(d.wording)!==d.content_hash||/\[\[|WORKING DRAFT|PRELIMINARY FRAMEWORK|SIMULATION ONLY|NOT A LIVE CONTRACT|TEST AGREEMENT/i.test(d.wording))throw new SignupError('The exact completed legal wording must be approved. Test documents cannot become live contracts.',409);
 const from=field(input.effectiveFrom,'effective date'),to=input.effectiveTo?field(input.effectiveTo,'expiry'):null;
 if(!Number.isFinite(Date.parse(from))||to&&(!Number.isFinite(Date.parse(to))||Date.parse(to)<=Date.parse(from)))throw new SignupError('Choose a valid effective period.');
 await db.prepare("INSERT OR IGNORE INTO agreement_document_versions(id,document_code,document_version,entity_id,locale,content_hash,document_reference,status,approved_by,approved_at,effective_from,effective_to,environment,integrity_state) VALUES(?,?,?,?,?,?,?,'approved',?,?,?,?,'production','production_verified')").bind(d.id,d.document_code,d.document_version,d.entity_id,d.locale,d.content_hash,'lokd:document:'+d.id,actor.userId,now,new Date(from).toISOString(),to?new Date(to).toISOString():null).run();const approved=await db.prepare('SELECT content_hash FROM agreement_document_versions WHERE id=?').bind(id).first<{content_hash:string}>();if(approved?.content_hash!==d.content_hash)throw new SignupError('This version already belongs to another document. Create a distinct version.',409);return {documentId:id,status:'approved'};
}
async function document(db:D1Database,id:string){
 const d=await db.prepare(`SELECT v.*,b.wording FROM agreement_document_versions v JOIN signing_document_bodies b ON b.id=v.id WHERE v.id=? AND v.status='approved' AND v.environment='production' AND v.integrity_state='production_verified' AND NOT EXISTS(SELECT 1 FROM signing_document_withdrawals w WHERE w.document_id=v.id)`).bind(id).first<Record<string,string|null>>();
 if(!d||!d.wording||await agreementHash(d.wording)!==d.content_hash)throw new SignupError('A current approved document is required.',409);
 return {raw:d,version:{id:d.id!,version:d.document_version!,purpose:d.document_code==='OFFICER_EMPLOYMENT'?'officer_employment':d.document_code==='PARTNER_SERVICE'?'partner_service':'client_service',entityId:d.entity_id!,locale:d.locale!,status:'approved',approvedBy:d.approved_by,approvedAt:d.approved_at,effectiveFrom:d.effective_from!,effectiveTo:d.effective_to,wording:d.wording,contentHash:d.content_hash!} as AgreementVersion};
}
export async function issueProductionEnvelope(db:D1Database,actor:SigningActor,input:Record<string,unknown>){
 if(!actor.operations)throw new SignupError('Operations access required.',403);
 const {raw:d,version:doc}=await document(db,field(input.documentId,'document'));
 const evaluation=await evaluateAssignmentActivation(db,{rosterSlotId:field(input.rosterSlotId,'roster slot'),officerId:field(input.officerId,'officer'),expectedSlotVersion:Number(input.slotVersion),activationKey:'signing-read',environment:'production'});
 if(evaluation.facts.environment!=='production')throw new SignupError('Choose a production service order.',409);
 const role=d.document_code as ActivationAgreementRole,context=activationAgreementContext(evaluation.facts,role),contextJson=canonicalAgreementContext(context),contextHash=await agreementHash(contextJson),kind=role==='CLIENT_MSA'||role==='SERVICE_ORDER'?'client':'officer';
 const link=await db.prepare("SELECT l.* FROM production_entity_links l JOIN signup_cases c ON c.kind=l.kind AND c.source_id=l.case_id AND c.version=l.case_version AND c.owner_user_id=l.owner_user_id AND c.status!='withdrawn' WHERE l.kind=? AND l.entity_id=?").bind(kind,context.subjectId).first<{owner_user_id:string;case_id:string;case_version:number}>();
 if(!link||link.owner_user_id===actor.userId)throw new SignupError('An independently reviewed, current signer account must be linked to this entity.',409);
 const identity=field(input.identityEvidence,'independently reviewed identity evidence',12,2000),authority=kind==='client'||role==='PARTNER_SERVICE'?field(input.authorityEvidence,'representative authority evidence',12,2000):null;
 const now=new Date().toISOString();
 // Reuse the same production validator used by activation receipts before delivery.
 await prepareAgreementReceipt({document:doc,context,presentedContentHash:doc.contentHash,presentedContextHash:contextHash,expectedPurpose:doc.purpose,expectedEntityId:kind==='client'?evaluation.facts.client.contractingEntityId!:evaluation.facts.workforce.employer.id??'',expectedLocale:doc.locale,actorUserId:link.owner_user_id,identityEvidence:identity,authorityEvidence:authority??undefined,action:'agree',affirmative:true});
 const previous=await db.prepare('SELECT e.*,EXISTS(SELECT 1 FROM production_envelope_cancellations c WHERE c.envelope_id=e.id) AS cancelled FROM production_signing_envelopes e WHERE owner_user_id=? AND document_id=? AND context_hash=? ORDER BY issuance_number DESC LIMIT 1').bind(link.owner_user_id,doc.id,contextHash).first<{id:string;issuance_number:number;expires_at:string;case_version:number;cancelled:number}>();
 if(previous&&!previous.cancelled&&Date.parse(previous.expires_at)>Date.now()&&previous.case_version===link.case_version)return {issued:true,delivered:false,emailDelivery:"queued_or_previously_attempted",envelopeId:previous.id,reused:true,workEligible:false};
 const issuance=(previous?.issuance_number??0)+1;
 const id='ENV-'+crypto.randomUUID(),expires=new Date(Math.min(Date.now()+7*86400000,doc.effectiveTo?Date.parse(doc.effectiveTo):Infinity)).toISOString();
 await db.prepare(`INSERT OR IGNORE INTO production_signing_envelopes(id,document_id,role,owner_user_id,case_kind,case_id,case_version,roster_slot_id,officer_id,slot_version,context_json,context_hash,content_hash,identity_evidence,authority_evidence,issued_by,issued_at,expires_at,issuance_number) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,doc.id,role,link.owner_user_id,kind,link.case_id,link.case_version,evaluation.facts.shift.rosterSlotId,evaluation.facts.officer.id,evaluation.facts.shift.slotVersion,contextJson,contextHash,doc.contentHash,identity,authority,actor.userId,now,expires,issuance).run();
 const saved=await db.prepare('SELECT id FROM production_signing_envelopes WHERE owner_user_id=? AND document_id=? AND context_hash=? AND issuance_number=?').bind(link.owner_user_id,doc.id,contextHash,issuance).first<{id:string}>();
 if(!saved)throw new SignupError('Agreement issuance could not be confirmed. Refresh before retrying.',409);
 return {issued:true,delivered:false,emailDelivery:'queued',envelopeId:saved.id,workEligible:false};
}
export async function readProductionSigning(db:D1Database,actor:SigningActor){

 const [envelopes,documents,entities]=await Promise.all([
  db.prepare(`SELECT e.*,j.state AS email_delivery_state,b.wording,r.receipt_json,r.receipt_hash,EXISTS(SELECT 1 FROM production_envelope_cancellations x WHERE x.envelope_id=e.id) AS cancelled,EXISTS(SELECT 1 FROM signing_document_withdrawals w WHERE w.document_id=e.document_id) AS document_withdrawn FROM production_signing_envelopes e JOIN signing_document_bodies b ON b.id=e.document_id LEFT JOIN operational_delivery_jobs j ON j.kind='contract_email' AND j.source_id=e.id LEFT JOIN agreement_acceptance_receipts r ON r.id='LIVE-SIGN-'||e.id ${actor.operations?'':'WHERE e.owner_user_id=?'} ORDER BY e.issued_at DESC LIMIT 100`).bind(...(actor.operations?[]:[actor.userId])).all(),
  actor.operations?db.prepare(`SELECT b.*,v.status,EXISTS(SELECT 1 FROM signing_document_withdrawals w WHERE w.document_id=b.id) AS withdrawn FROM signing_document_bodies b LEFT JOIN agreement_document_versions v ON v.id=b.id ORDER BY b.prepared_at DESC LIMIT 100`).all():{results:[]},
  db.prepare(`SELECT * FROM production_entity_links ${actor.operations?'':'WHERE owner_user_id=?'} ORDER BY prepared_at DESC LIMIT 100`).bind(...(actor.operations?[]:[actor.userId])).all(),
 ]);

return {envelopes:envelopes.results,documents:documents.results,entities:entities.results,owner:actor.owner,workEligible:false};
}
export async function signProductionEnvelope(db:D1Database,actor:SigningActor,input:Record<string,unknown>){
 const id=field(input.envelopeId,'envelope');
 const e=await db.prepare(`SELECT e.* FROM production_signing_envelopes e WHERE e.id=? ${actor.operations?'':'AND e.owner_user_id=?'}`).bind(id,...(actor.operations?[]:[actor.userId])).first<Record<string,string>>();if(!e)throw new SignupError('Envelope not found for this account.',404);
 if(input.action==='cancel'){
  const now=new Date().toISOString(),reason=field(input.reason,'cancellation reason',12,1200);
  await db.batch([db.prepare('INSERT OR IGNORE INTO production_envelope_cancellations VALUES(?,?,?,?)').bind(id,actor.userId,reason,now),db.prepare("INSERT OR IGNORE INTO agreement_receipt_revocations(receipt_id,revoked_by,reason,revoked_at) SELECT id,?,?,? FROM agreement_acceptance_receipts WHERE id=?").bind(actor.userId,reason,now,'LIVE-SIGN-'+id)]);return {cancelled:true};
 }
 if(actor.operations||actor.userId!==e.owner_user_id)throw new SignupError('Only the named signer can accept this agreement.',403);
 if(input.affirmative!==true||input.contentHash!==e.content_hash||input.contextHash!==e.context_hash)throw new SignupError('Affirmatively accept the exact presented wording and service scope.');
 if(await db.prepare('SELECT envelope_id FROM production_envelope_cancellations WHERE envelope_id=?').bind(id).first()||await db.prepare('SELECT document_id FROM signing_document_withdrawals WHERE document_id=?').bind(e.document_id).first())throw new SignupError('This envelope or document has been withdrawn. The historical receipt is retained.',409);
 const prior=await db.prepare('SELECT receipt_json,receipt_hash FROM agreement_acceptance_receipts WHERE id=?').bind('LIVE-SIGN-'+id).first<{receipt_json:string;receipt_hash:string}>();
 if(prior){if(await agreementHash(prior.receipt_json)!==prior.receipt_hash)throw new SignupError('Receipt integrity check failed.',409);await projectSignedWorkforceTerms(db,id,actor.userId);return {receiptId:'LIVE-SIGN-'+id,alreadyRecorded:true};}
 if(Date.parse(e.expires_at)<=Date.now()||await db.prepare('SELECT envelope_id FROM production_envelope_cancellations WHERE envelope_id=?').bind(id).first())throw new SignupError('This envelope is cancelled or expired.',409);
 const {version:doc}=await document(db,e.document_id);
 const current=await evaluateAssignmentActivation(db,{rosterSlotId:e.roster_slot_id,officerId:e.officer_id,expectedSlotVersion:Number(e.slot_version),activationKey:'signing-read',environment:'production'});
 const context=activationAgreementContext(current.facts,e.role as ActivationAgreementRole);
 const prepared=await prepareAgreementReceipt({document:doc,context,presentedContentHash:e.content_hash,presentedContextHash:e.context_hash,expectedPurpose:doc.purpose,expectedEntityId:e.case_kind==='client'?current.facts.client.contractingEntityId!:current.facts.workforce.employer.id??'',expectedLocale:doc.locale,actorUserId:actor.userId,identityEvidence:e.identity_evidence,authorityEvidence:e.authority_evidence??undefined,action:'agree',affirmative:true});
 const receiptJson=JSON.stringify({...JSON.parse(prepared.receiptJson),evidenceRevision:current.sourceRevision});
 await storeAgreementReceipt(db,'LIVE-SIGN-'+id,{...prepared,receiptJson,receiptHash:await agreementHash(receiptJson)});
 await projectSignedWorkforceTerms(db,id,actor.userId);
 return {receiptId:'LIVE-SIGN-'+id,workEligible:false};
}
