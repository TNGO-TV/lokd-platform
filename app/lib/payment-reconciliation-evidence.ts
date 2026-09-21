import {agreementHash} from './agreement-acceptance';
import {employeeTransfer,transferMatches,type EmployeeTransfer,type EmployeeTransferBinding} from './employee-transfer-evidence';

/** FI-02 design contract. Consumes server-loaded, append-only records; this is
 * neither an authentication boundary nor a live payment/paid-state command. */
export type ReconciliationBinding = EmployeeTransferBinding & {
 kind: 'employee' | 'partner';
 liabilityId: string;
 sourceHash: string;
};
export type SubmissionClaim = {
 commandId: string;
 reference: string;
 mode: 'test' | 'live';
 sourceHash: string;
 claimedAt: string;
};
export type ReconciliationObservation = {
 id: string;
 sequence: number;
 source: 'initiate' | 'verify' | 'webhook' | 'operations';
 event: string;
 transfer: EmployeeTransfer | null;
 webhookCount: number | null;
 observedAt: string;
};
export type PaymentEvidenceInput = {
 binding: ReconciliationBinding;
 claim: SubmissionClaim | null;
 observations: readonly ReconciliationObservation[];
};
export type PaymentEvidenceState = 'not_submitted' | 'unknown' | 'pending' | 'provider_success' | 'provider_failed' | 'provider_reversed' | 'held';
export type PaymentEvidenceReason = 'invalid_binding' | 'invalid_clock' | 'claim_missing' | 'claim_mismatch' | 'no_evidence' | 'evidence_limit'
 | 'invalid_observation' | 'observation_order' | 'observation_time' | 'operations_hold' | 'transfer_mismatch' | 'identity_conflict'
 | 'invalid_event' | 'webhook_watermark' | 'contradictory_history' | 'unsupported_terminal_status' | 'verification_required'
 | 'verification_stale' | 'signed_confirmation_required' | 'provider_pending';
export type ReviewablePaymentSnapshot = {
 contract: 'lokd-payment-evidence-v1';
 binding: ReconciliationBinding;
 claim: SubmissionClaim;
 evidence: ReconciliationObservation[];
 verifiedObservationId: string;
 signedObservationIds: string[];
 transfer: EmployeeTransfer;
};
export type PaymentEvidenceDecision = {
 state: PaymentEvidenceState;
 mode: 'test' | 'live';
 reasons: PaymentEvidenceReason[];
 reviewableFor: 'test_confirmation' | 'live_reconciliation' | 'terminal_disposition' | null;
 snapshot: ReviewablePaymentSnapshot | null;
 // Neither provider success nor this in-memory assessment authorizes money movement.
 canMarkPaid: false;
 canReplace: false;
};
export const PAYMENT_REVIEW_FRESHNESS_MS = 5 * 60_000;
export const PAYMENT_EVIDENCE_LIMIT = 500;
const text=(v:unknown)=>typeof v==='string'&&v.trim().length>0&&v.length<=200;
const digest=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const timestamp=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
function normalized(t:EmployeeTransfer,kind:'employee'|'partner'){
 // Reuse the provider parser to reject malformed stored shapes and namespaces.
 return employeeTransfer({id:t.id,transfer_code:t.code,reference:t.reference,domain:t.mode,amount:t.amount,currency:t.currency,recipient:t.recipientId,integration:t.integration,source:'balance',status:t.status},kind);
}
function validBinding(b:ReconciliationBinding){
 if(!b||!['employee','partner'].includes(b.kind)||!text(b.liabilityId)||!digest(b.sourceHash)||b.currency!=='ZAR')return false;
 return !!normalized({...b,id:'1',code:'TRF_bindingcheck',status:'pending'},b.kind);
}
function copySnapshot(b:ReconciliationBinding,c:SubmissionClaim,observations:readonly ReconciliationObservation[],last:ReconciliationObservation):ReviewablePaymentSnapshot{
 // Whitelist the durable evidence contract. Unexpected properties (e.g. account
 // numbers or API credentials) must never enter the review digest or snapshot.
 return {
  contract:'lokd-payment-evidence-v1',
  binding:{kind:b.kind,liabilityId:b.liabilityId,sourceHash:b.sourceHash,reference:b.reference,mode:b.mode,amount:b.amount,currency:b.currency,recipientId:b.recipientId,integration:b.integration},
  claim:{commandId:c.commandId,reference:c.reference,mode:c.mode,sourceHash:c.sourceHash,claimedAt:c.claimedAt},
  evidence:observations.map(o=>({id:o.id,sequence:o.sequence,source:o.source,event:o.event,transfer:o.transfer?normalized(o.transfer,b.kind):null,webhookCount:o.webhookCount,observedAt:o.observedAt})),
  verifiedObservationId:last.id,
  signedObservationIds:observations.filter(o=>o.source==='webhook').map(o=>o.id),
  transfer:normalized(last.transfer!,b.kind)!,
 };
}

/** A current evidence assessment for a NEW review. Existing paid receipts must
 * retain their as-of history; ageing this assessment cannot erase a receipt. */
export function assessPaymentEvidence(input:PaymentEvidenceInput,now:Date):PaymentEvidenceDecision{
 const {binding:b,claim:c,observations}=input;
 const result=(state:PaymentEvidenceState,...reasons:PaymentEvidenceReason[]):PaymentEvidenceDecision=>({state,mode:b?.mode,reasons,reviewableFor:null,snapshot:null,canMarkPaid:false,canReplace:false});
 if(!validBinding(b))return result('held','invalid_binding');
 if(!(now instanceof Date)||!Number.isFinite(now.getTime()))return result('held','invalid_clock');
 if(!Array.isArray(observations)||observations.length>PAYMENT_EVIDENCE_LIMIT)return result('held','evidence_limit');
 if(!c)return observations.length?result('held','claim_missing'):result('not_submitted');
 if(!text(c.commandId)||c.reference!==b.reference||c.mode!==b.mode||c.sourceHash!==b.sourceHash||!timestamp(c.claimedAt)||Date.parse(c.claimedAt)>now.getTime())return result('held','claim_mismatch');
 if(!observations.length)return result('unknown','no_evidence');
 const ids=new Set<string>();
 let sequence=0,webhooks=0,identity='',terminal:string|null=null;
 for(const o of observations){
  if(!o||!text(o.id)||!['initiate','verify','webhook','operations'].includes(o.source)||!text(o.event))return result('held','invalid_observation');
  if(!Number.isSafeInteger(o.sequence)||o.sequence<=sequence||ids.has(o.id))return result('held','observation_order');
  ids.add(o.id);sequence=o.sequence;
  if(!timestamp(o.observedAt)||Date.parse(o.observedAt)<Date.parse(c.claimedAt)||Date.parse(o.observedAt)>now.getTime())return result('held','observation_time');
  if(o.source==='operations')return result('held','operations_hold');
  const t=o.transfer&&normalized(o.transfer,b.kind);
  if(!t||!transferMatches(b,t))return result('held','transfer_mismatch');
  const key=t.id+':'+t.code;
  if(identity&&key!==identity)return result('held','identity_conflict');identity=key;
  if(o.source==='webhook'){
   if(!['success','failed','reversed'].includes(t.status)||o.event!==`transfer.${t.status}`||o.webhookCount!==null)return result('held','invalid_event');
   webhooks++;
  }else if(o.source==='verify'){
   if(o.event!=='transfer.verify')return result('held','invalid_event');
   if(o.webhookCount!==webhooks)return result('held','webhook_watermark');
  }else if(o.event!=='transfer.initiate'||o.webhookCount!==null)return result('held','invalid_event');
  if(['abandoned','blocked','rejected'].includes(t.status))return result('held','unsupported_terminal_status');
  if(terminal&&t.status!==terminal&&!(terminal==='success'&&t.status==='reversed'))return result('held','contradictory_history');
  if(['success','failed','reversed'].includes(t.status))terminal=t.status;
 }
 const last=observations.at(-1)!;
 if(last.source!=='verify')return result('held','verification_required');
 if(now.getTime()-Date.parse(last.observedAt)>PAYMENT_REVIEW_FRESHNESS_MS)return result('held','verification_stale');
 const status=last.transfer!.status;
 if(['pending','otp','received'].includes(status))return result('pending','provider_pending');
 if(!observations.some(o=>o.source==='webhook'&&o.event===`transfer.${status}`))return result('held','signed_confirmation_required');
 const decision=result(status==='success'?'provider_success':status==='failed'?'provider_failed':'provider_reversed');
 decision.reviewableFor=status==='success'?(b.mode==='test'?'test_confirmation':'live_reconciliation'):'terminal_disposition';
 decision.snapshot=copySnapshot(b,c,observations,last);
 return decision;
}

/** The server persists this hash with the exact immutable proposal. A hash is
 * not an approval and must never be accepted as proof of authenticated origin. */
export async function paymentEvidenceSnapshotHash(snapshot:ReviewablePaymentSnapshot){
 return agreementHash(JSON.stringify(snapshot));
}
