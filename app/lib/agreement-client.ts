import {SignupError} from './signup-server';
import {agreementHash} from './agreement-acceptance';
import {signProductionEnvelope,type SigningActor} from './production-signing';

export type ClientAgreement={id:string;role:string;document_id:string;wording:string;context_json:string;content_hash:string;context_hash:string;expires_at:string;cancelled:number;document_withdrawn:number;receipt_json:string|null;receipt_hash:string|null;revoked_at:string|null;email_error:string|null};

export async function readClientAgreements(db:D1Database,actor:SigningActor,agreementId?:string){
 if(actor.operations)throw new SignupError('Open your client account to view these agreements.',403);
 if(agreementId&&(agreementId.length>200||!/^ENV-[A-Za-z0-9-]+$/.test(agreementId)))throw new SignupError('Choose a valid service agreement.');
 const rows=await db.prepare(`SELECT e.id,e.role,e.document_id,b.wording,e.context_json,e.content_hash,e.context_hash,e.expires_at,
  EXISTS(SELECT 1 FROM production_envelope_cancellations c WHERE c.envelope_id=e.id) AS cancelled,
  EXISTS(SELECT 1 FROM signing_document_withdrawals w WHERE w.document_id=e.document_id) AS document_withdrawn,
  r.receipt_json,r.receipt_hash,v.revoked_at,
  (SELECT j.last_error FROM client_notification_jobs j WHERE j.source_id=e.id AND j.recipient_type='client' ORDER BY j.created_at DESC LIMIT 1) AS email_error
  FROM production_signing_envelopes e JOIN signing_document_bodies b ON b.id=e.document_id
  LEFT JOIN agreement_acceptance_receipts r ON r.id='LIVE-SIGN-'||e.id
  LEFT JOIN agreement_receipt_revocations v ON v.receipt_id=r.id
  WHERE e.owner_user_id=? AND e.case_kind='client' AND e.role IN ('CLIENT_MSA','SERVICE_ORDER') ${agreementId?'AND e.id=?':''}
  ORDER BY e.issued_at DESC LIMIT 100`).bind(actor.userId,...agreementId?[agreementId]:[]).all<ClientAgreement>();
 return {agreements:rows.results};
}

export async function acceptClientAgreement(db:D1Database,actor:SigningActor,input:Record<string,unknown>){
 if(actor.operations||typeof input.envelopeId!=='string')throw new SignupError('Choose your client agreement.',403);
 const exists=await db.prepare("SELECT id FROM production_signing_envelopes WHERE id=? AND owner_user_id=? AND case_kind='client' AND role IN ('CLIENT_MSA','SERVICE_ORDER')").bind(input.envelopeId,actor.userId).first();
 if(!exists)throw new SignupError('Agreement not found for this account.',404);
 if(input.action!=='sign')throw new SignupError('Choose a supported agreement action.');
 return signProductionEnvelope(db,actor,input);
}

const html=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export async function clientAgreementCopy(db:D1Database,actor:SigningActor,id:string){
 const row=await db.prepare(`SELECT e.id,r.receipt_json,r.receipt_hash,v.revoked_at FROM production_signing_envelopes e
  JOIN agreement_acceptance_receipts r ON r.id='LIVE-SIGN-'||e.id LEFT JOIN agreement_receipt_revocations v ON v.receipt_id=r.id
  WHERE e.id=? AND e.owner_user_id=? AND e.case_kind='client' AND e.role IN ('CLIENT_MSA','SERVICE_ORDER')`).bind(id,actor.userId).first<{id:string;receipt_json:string;receipt_hash:string;revoked_at:string|null}>();
 if(!row)throw new SignupError('Signed agreement not found for this account.',404);
 if(await agreementHash(row.receipt_json)!==row.receipt_hash)throw new SignupError('The signed copy could not be verified.',409);
 const r=JSON.parse(row.receipt_json);
 if(r.actorUserId!==actor.userId)throw new SignupError('The signed copy could not be verified.',409);
 return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Signed agreement · LOKD Security</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:800px;margin:32px auto;padding:0 20px;color:var(--lokd-slate)}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}dt{font-weight:700}dd{margin:0 0 12px;overflow-wrap:anywhere}small{overflow-wrap:anywhere}</style><body><header>LOKD Security</header><h1>Signed service agreement</h1><p>Version ${html(r.documentVersion)}</p><p>Signed ${html(new Date(r.acceptedAt).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'}))} SAST</p>${row.revoked_at?'<p>This agreement was revoked '+html(new Date(row.revoked_at).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'}))+' SAST.</p>':''}<pre>${html(r.wording)}</pre><h2>Agreed service details</h2><dl>${Object.entries(r.context?.scope??{}).map(([key,value])=>'<dt>'+html(key.replace(/([a-z])([A-Z])/g,'$1 $2').replaceAll('_',' '))+'</dt><dd>'+html(value)+'</dd>').join('')}</dl><small>Agreement reference: ${html(id)}<br>Signed record checksum: ${html(row.receipt_hash)}</small></body></html>`;
}
