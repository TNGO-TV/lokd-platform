import {PilotAccessError} from './pilot-runtime';
import {createClerkClient} from '@clerk/backend';
import {verifiedPrimaryEmail} from './clerk-access';
import {agreementHash,canonicalAgreementContext} from './agreement-acceptance';
import {activationAgreementContext,type ActivationAgreementRole} from './agreement-activation';
import {evaluateAssignmentActivation} from './assignment-activation-server';
import {allowlisted,crmEnquiryBody,DeliveryError,emailValid,configuredEmailProvider,emailReceipt,sendCrm,sendEmail,type OperationalRuntime} from './operational-provider';

type Job={id:string;kind:string;source_id:string;environment:string;state:string;attempts:number;request_json:string|null;recipient:string|null;provider_id:string|null;first_attempt_at:string|null;created_at:string};
type Options={transport?:typeof fetch;verifiedEmail?:(userId:string)=>Promise<string|null>;now?:()=>number};
const iso=(n:number)=>new Date(n).toISOString();
const message=(from:string,to:string,subject:string,text:string)=>({from,to:[to],subject,text});

export async function currentEnvelopeRecipient(db:D1Database,id:string,clock:number):Promise<{owner:string;kind:string}> {
 const e=await db.prepare(`SELECT e.*,b.wording,v.effective_from,v.effective_to FROM production_signing_envelopes e
 JOIN signing_document_bodies b ON b.id=e.document_id
 JOIN agreement_document_versions v ON v.id=e.document_id AND v.status='approved' AND v.content_hash=e.content_hash
 JOIN signup_cases c ON c.kind=e.case_kind AND c.source_id=e.case_id AND c.version=e.case_version AND c.owner_user_id=e.owner_user_id AND c.status!='withdrawn'
 JOIN production_entity_links l ON l.kind=e.case_kind AND l.case_id=e.case_id AND l.case_version=e.case_version AND l.owner_user_id=e.owner_user_id
 WHERE e.id=? AND v.environment='production' AND v.integrity_state='production_verified'
 AND NOT EXISTS(SELECT 1 FROM production_envelope_cancellations x WHERE x.envelope_id=e.id)
 AND NOT EXISTS(SELECT 1 FROM signing_document_withdrawals w WHERE w.document_id=e.document_id)
 AND NOT EXISTS(SELECT 1 FROM agreement_acceptance_receipts r WHERE r.id='LIVE-SIGN-'||e.id)`).bind(id).first<Record<string,string>>();
 if(!e||Date.parse(e.expires_at)<=clock||Date.parse(e.effective_from)>clock||e.effective_to&&Date.parse(e.effective_to)<=clock||await agreementHash(e.wording)!==e.content_hash)throw new DeliveryError('agreement_no_longer_current','cancelled');
 try{
  const current=await evaluateAssignmentActivation(db,{rosterSlotId:e.roster_slot_id,officerId:e.officer_id,expectedSlotVersion:Number(e.slot_version),activationKey:'delivery-read',environment:'production'});
  if(current.facts.environment!=='production'||await agreementHash(canonicalAgreementContext(activationAgreementContext(current.facts,e.role as ActivationAgreementRole)))!==e.context_hash)throw Error();
 }catch{throw new DeliveryError('agreement_scope_changed','cancelled');}
 return {owner:e.owner_user_id,kind:e.case_kind};
}

async function requestFor(db:D1Database,job:Job,runtime:OperationalRuntime,resolveEmail:(id:string)=>Promise<string|null>,clock:number){
 if(!allowlisted(runtime.LOKD_DELIVERY_SOURCE_ALLOWLIST,job.source_id))throw new DeliveryError('source_not_designated_for_test');
 if(job.kind==='enquiry_crm'){
  if(!runtime.LOKD_ZOHO_CRM_OWNER_ID)throw new DeliveryError('crm_assignee_missing');
  const enquiry=await db.prepare(`SELECT id,contact_name,organisation_name,email_normalized FROM client_enquiries e
   WHERE id=? AND environment='prelaunch' AND integrity_state='user_submitted' AND status!='closed'
   AND NOT EXISTS(SELECT 1 FROM signup_cases c WHERE c.source_id=e.id AND c.kind='client' AND c.status='withdrawn')`).bind(job.source_id).first<{id:string;contact_name:string;organisation_name:string;email_normalized:string}>();
  if(!enquiry)throw new DeliveryError('enquiry_closed_or_withdrawn','cancelled');
  if(job.recipient&&job.recipient!==runtime.LOKD_ZOHO_CRM_OWNER_ID)throw new DeliveryError('crm_assignee_changed');
  return {recipient:runtime.LOKD_ZOHO_CRM_OWNER_ID,body:job.request_json?JSON.parse(job.request_json):crmEnquiryBody(enquiry,runtime.LOKD_ZOHO_CRM_OWNER_ID)};
 }
 const provider=configuredEmailProvider(runtime);
 if(!emailValid(runtime.LOKD_EMAIL_FROM))throw new DeliveryError('email_sender_not_configured');
 if(job.request_json&&JSON.parse(job.request_json)._lokdProvider!==provider)throw new DeliveryError('email_provider_changed');
 let recipient:string|null=runtime.LOKD_TEAM_EMAIL??null,subject:string,text:string;
 if(job.kind==='contract_email'){
  const envelope=await currentEnvelopeRecipient(db,job.source_id,clock);
  recipient=await resolveEmail(envelope.owner);
  subject='Your LOKD agreement is ready to review';
  text=`Sign in to your LOKD account to review and accept your agreement. Only its named signer can accept it.\n\nhttps://demo.lokd.co.za/${envelope.kind}/agreements#${encodeURIComponent(job.source_id)}\n\nAgreement reference: ${job.source_id}\nIf the agreement has expired or been withdrawn, contact LOKD Operations.`;
 }else{
  const source=job.kind==='enquiry_email'
   ?await db.prepare("SELECT id FROM client_enquiries e WHERE id=? AND environment='prelaunch' AND integrity_state='user_submitted' AND status!='closed' AND NOT EXISTS(SELECT 1 FROM signup_cases c WHERE c.source_id=e.id AND c.kind='client' AND c.status='withdrawn')").bind(job.source_id).first()
   :await db.prepare("SELECT p.id FROM production_order_setups p JOIN bookings b ON b.id=p.id WHERE p.id=? AND b.environment='production' AND b.integrity_state='production_verified' AND b.status='draft'").bind(job.source_id).first();
  if(!source)throw new DeliveryError('notification_source_no_longer_current','cancelled');
  subject=job.kind==='enquiry_email'?'New LOKD service enquiry':'LOKD service order prepared';
  text=`${subject}. Reference: ${job.source_id}. Sign in to Operations to review and take ownership.\n\nhttps://demo.lokd.co.za/ops${job.kind==='enquiry_email'?'/intake?kind=client':'/service'}\n\nThis notice does not approve a booking, funding or service activation.`;
 }
 if(!emailValid(recipient)||!allowlisted(runtime.LOKD_DELIVERY_EMAIL_ALLOWLIST,recipient))throw new DeliveryError('recipient_not_designated_for_test');
 // Never change the payload/recipient under an existing provider idempotency key.
 if(job.recipient&&job.recipient.toLowerCase()!==recipient.toLowerCase())throw new DeliveryError('trusted_recipient_changed');
 return {recipient,body:job.request_json?JSON.parse(job.request_json):{...message(runtime.LOKD_EMAIL_FROM!,recipient,subject,text),_lokdProvider:provider}};
}

// A human-confirmed non-submission permits one additional attempt, never a
// blanket replay of uncertain outcomes. Immutable payload and attempt history remain.
export async function reconcileUnsubmittedNotice(db:D1Database,runtime:OperationalRuntime,input:Record<string,unknown>,actor:string,clock=Date.now()){
 if(!actor||runtime.LOKD_OPERATIONAL_DELIVERY_ENABLED!=='true')throw new PilotAccessError('Controlled delivery is unavailable.',403);
 if(input.confirmedNotSubmitted!==true||typeof input.evidence!=='string'||input.evidence.trim().length<50||input.evidence.length>2000||typeof input.id!=='string'||typeof input.updatedAt!=='string')throw new PilotAccessError('Record evidence confirming that the provider did not receive this notice.',400);
 const job=await db.prepare("SELECT * FROM operational_delivery_jobs WHERE id=? AND updated_at=? AND state='uncertain' AND kind='enquiry_email' AND environment='prelaunch' AND provider_id IS NULL AND attempts>0 AND attempts<5").bind(input.id,input.updatedAt).first<Job>();
 if(!job||!job.request_json||JSON.parse(job.request_json)._lokdProvider!=='zeptomail'||runtime.LOKD_EMAIL_PROVIDER!=='zeptomail')throw new PilotAccessError('This notice is not eligible, or its status changed. Refresh and review it.',409);
 try{await requestFor(db,job,runtime,async()=>null,clock);}catch{throw new PilotAccessError('The source, recipient or provider is no longer eligible for controlled delivery.',409);}
 const auditId=crypto.randomUUID(),now=iso(clock);
 const results=await db.batch([
  db.prepare(`INSERT INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at)
   SELECT ?,'operations',?,'delivery_non_submission_confirmed','operational_delivery',id,?,? FROM operational_delivery_jobs
   WHERE id=? AND updated_at=? AND state='uncertain' AND attempts=? AND provider_id IS NULL`)
   .bind(auditId,actor,JSON.stringify({attempts:job.attempts,evidence:input.evidence.trim(),confirmedNotSubmitted:true}),now,job.id,input.updatedAt,job.attempts),
  db.prepare(`UPDATE operational_delivery_jobs SET state='retry_wait',last_error='non_submission_reconciled',next_attempt_at=?,updated_at=?
   WHERE id=? AND updated_at=? AND state='uncertain' AND attempts=? AND EXISTS(SELECT 1 FROM audit_events WHERE id=?)`)
   .bind(now,now,job.id,input.updatedAt,job.attempts,auditId)
 ]);
 if(!results[1].meta.changes)throw new PilotAccessError('The notice changed. Refresh and review it.',409);
 return {reconciled:true,queued:true,sent:false};
}

export async function runOperationalDelivery(db:D1Database,runtime:OperationalRuntime,options:Options={}){
 const clock=options.now??Date.now,transport=options.transport??fetch;
 if(runtime.LOKD_OPERATIONAL_DELIVERY_ENABLED!=='true')return {enabled:false,processed:0};
 const resolveEmail=options.verifiedEmail??(async(id:string)=>{
  if(!runtime.CLERK_SECRET_KEY)throw new DeliveryError('signer_directory_unavailable');
  const user=await createClerkClient({secretKey:runtime.CLERK_SECRET_KEY}).users.getUser(id);
  return user.banned||user.locked?null:verifiedPrimaryEmail(user);
 });
 // A lost worker may have submitted successfully. Reuse the SAME claim only
 // inside the provider deduplication window; afterwards require investigation.
 await db.prepare(`UPDATE operational_delivery_jobs SET state=CASE WHEN attempts>=5 OR
  (kind!='enquiry_crm' AND attempts>0 AND json_extract(request_json,'$._lokdProvider')='zeptomail') OR
  (kind!='enquiry_crm' AND first_attempt_at IS NOT NULL AND first_attempt_at<=?) THEN 'uncertain' ELSE 'retry_wait' END,
  lease_token=NULL,lease_expires_at=NULL,last_error='dispatch_lease_expired',updated_at=?
  WHERE state='dispatching' AND lease_expires_at<=?`).bind(iso(clock()-23*3600000),iso(clock()),iso(clock())).run();
 const jobs=await db.prepare(`SELECT * FROM operational_delivery_jobs WHERE state IN ('queued','blocked','retry_wait') AND next_attempt_at<=? ORDER BY next_attempt_at,id LIMIT 5`).bind(iso(clock())).all<Job>();
 let processed=0;
 for(const job of jobs.results){
  const lease=crypto.randomUUID(),now=iso(clock());
  const claimed=await db.prepare(`UPDATE operational_delivery_jobs SET state='dispatching',lease_token=?,lease_expires_at=?,updated_at=? WHERE id=? AND state IN ('queued','blocked','retry_wait') AND next_attempt_at<=?`).bind(lease,iso(clock()+120000),now,job.id,now).run();
  if(!claimed.meta.changes)continue;
  try{
   const reconciled=job.kind==='enquiry_email'&&job.request_json&&JSON.parse(job.request_json)._lokdProvider==='zeptomail'&&await db.prepare(`SELECT id FROM audit_events WHERE entity_type='operational_delivery' AND entity_id=? AND event_type='delivery_non_submission_confirmed' AND json_extract(detail,'$.attempts')=? AND json_extract(detail,'$.confirmedNotSubmitted')=1 LIMIT 1`).bind(job.id,job.attempts).first();
   if(job.attempts>=5||job.kind!=='enquiry_crm'&&job.first_attempt_at&&clock()-Date.parse(job.first_attempt_at)>=23*3600000&&!reconciled){
    await db.prepare("UPDATE operational_delivery_jobs SET state='uncertain',last_error='provider_reconciliation_required',lease_token=NULL,lease_expires_at=NULL,updated_at=? WHERE id=? AND lease_token=?").bind(iso(clock()),job.id,lease).run();continue;
   }
   const prepared=await requestFor(db,job,runtime,resolveEmail,clock());
   await db.prepare(`UPDATE operational_delivery_jobs SET request_json=COALESCE(request_json,?),recipient=COALESCE(recipient,?),attempts=attempts+1,first_attempt_at=COALESCE(first_attempt_at,?),updated_at=? WHERE id=? AND lease_token=?`).bind(JSON.stringify(prepared.body),prepared.recipient,iso(clock()),iso(clock()),job.id,lease).run();
   job.attempts++;
   const providerId=job.kind==='enquiry_crm'?await sendCrm(runtime,prepared.body,transport):await sendEmail(runtime,job.id,prepared.body,transport);
   await db.prepare(`UPDATE operational_delivery_jobs SET state='sent',provider_id=?,last_error=NULL,lease_token=NULL,lease_expires_at=NULL,next_attempt_at=?,updated_at=? WHERE id=? AND lease_token=?`).bind(providerId,iso(clock()+60000),iso(clock()),job.id,lease).run();processed++;
  }catch(cause){
   const error=cause instanceof DeliveryError?cause:new DeliveryError('delivery_check_unavailable','retry_wait');
   const state=error.disposition==='retry_wait'&&(job.attempts>=5||job.kind!=='enquiry_crm'&&job.attempts>0&&runtime.LOKD_EMAIL_PROVIDER==='zeptomail')?'uncertain':error.disposition;
   await db.prepare(`UPDATE operational_delivery_jobs SET state=?,last_error=?,lease_token=NULL,lease_expires_at=NULL,next_attempt_at=?,updated_at=? WHERE id=? AND lease_token=?`).bind(state,error.code,iso(clock()+(state==='blocked'?900000:Math.min(3600000,30000*2**job.attempts))),iso(clock()),job.id,lease).run();
  }
 }
 if(runtime.LOKD_EMAIL_PROVIDER==='resend'&&runtime.RESEND_API_KEY||runtime.LOKD_EMAIL_PROVIDER==='zeptomail'&&runtime.ZEPTOMAIL_SEND_TOKEN){
  const sent=await db.prepare("SELECT * FROM operational_delivery_jobs WHERE state='sent' AND kind!='enquiry_crm' AND next_attempt_at<=? ORDER BY next_attempt_at LIMIT 5").bind(iso(clock())).all<Job>();
  for(const job of sent.results){
   if(!allowlisted(runtime.LOKD_DELIVERY_SOURCE_ALLOWLIST,job.source_id)||!allowlisted(runtime.LOKD_DELIVERY_EMAIL_ALLOWLIST,job.recipient??''))continue;
   try{
    const state=await emailReceipt(runtime,JSON.parse(job.request_json!),job.id,job.provider_id!,job.recipient!,transport);
    await db.prepare("UPDATE operational_delivery_jobs SET state=?,last_error=?,next_attempt_at=?,updated_at=? WHERE id=? AND state='sent'").bind(state,state==='failed'?'email_delivery_failed':null,iso(clock()+3600000),iso(clock()),job.id).run();
   }catch{
    await db.prepare("UPDATE operational_delivery_jobs SET last_error='delivery_confirmation_unavailable',next_attempt_at=?,updated_at=? WHERE id=? AND state='sent'").bind(iso(clock()+3600000),iso(clock()),job.id).run();
   }
  }
 }
 return {enabled:true,processed};
}

export async function readOperationalDelivery(db:D1Database){
 return (await db.prepare(`SELECT id,kind,source_id AS sourceId,state,attempts,recipient,provider_id AS providerId,last_error AS lastError,updated_at AS updatedAt FROM operational_delivery_jobs ORDER BY created_at DESC LIMIT 100`).all()).results;
}
