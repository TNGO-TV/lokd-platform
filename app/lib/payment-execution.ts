import {fetchWithoutRedirect} from './provider-fetch';
import {readFinanceWebhookBytes,readFinanceProviderJson} from './finance-body';
import {SignupError} from './signup-server';
import {agreementHash} from './agreement-acceptance';
import {productionOperatorControl} from './production-operator-control';
import {operationsMfaRequired} from './operations-mfa-policy';
import {destinationKey,fetchRecipient,type DestinationRuntime} from './destination-evidence';
import {employeeTransfer,type EmployeeTransferBinding} from './employee-transfer-evidence';
import {assessPaymentEvidence,paymentEvidenceSnapshotHash,type ReconciliationObservation} from './payment-reconciliation-evidence';
import type {SigningActor} from './production-signing';
import type {PaymentKind} from './payment-recovery';
export type PaymentExecutionRuntime=DestinationRuntime&{LOKD_LIVE_PAYMENTS_ENABLED?:string};
type Instruction={kind:PaymentKind;reference:string;liability_id:string;mode:'test'|'live';amount_cents:number;source_json:string;source_hash:string;status:string;version:number;destination_id:string;prepared_by:string;prepared_user:string;approved_by:string|null};
const text=(v:unknown,label:string,max=1200)=>{if(typeof v!=='string'||v.trim().length<3||v.length>max)throw new SignupError(`Provide ${label}.`);return v.trim();};
const hash=(v:unknown,label:string)=>{if(typeof v!=='string'||!/^[a-f0-9]{64}$/.test(v))throw new SignupError(`Provide the SHA-256 digest for ${label}.`);return v;};
const integer=(v:unknown,label:string,min=1,max=25000000)=>{if(!Number.isSafeInteger(v)||Number(v)<min||Number(v)>max)throw new SignupError(`Provide ${label} in cents.`);return Number(v);};
const auth=()=>operationsMfaRequired()?'mfa_verified':'owner_mfa_exception';
const expiry=(now:string,minutes=30)=>new Date(Date.parse(now)+minutes*60000).toISOString();
const binding=(i:Instruction):EmployeeTransferBinding=>{const s=JSON.parse(i.source_json);return {reference:i.reference,mode:i.mode,amount:i.amount_cents,currency:'ZAR',recipientId:s.recipient.id,integration:s.recipient.integration};};
const participants=(i:Instruction)=>{const s=JSON.parse(i.source_json);return [s.ownerUser,s.representativeUser,s.officerUser,s.clientUser];};
async function provider(secret:string,path:string,transport:typeof fetch,body?:unknown){
 try{const res=await fetchWithoutRedirect(transport,'https://api.paystack.co'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+secret,'content-type':'application/json'},signal:AbortSignal.timeout(20000),...(body?{body:JSON.stringify(body)}:{})});const p=await readFinanceProviderJson(res);if(!res.ok||p.status!==true)throw Error('unavailable');return p.data;}
 catch{throw new SignupError(body?'Provider delivery is uncertain. Keep the saved claim and verify its original reference; do not resubmit.':'Provider verification is unavailable. Keep the saved reference; this read did not submit a transfer.',503);}
}
async function observation(db:D1Database,i:Instruction,source:string,event:string,raw:unknown,webhooks:number|null=null){
 const json=JSON.stringify(employeeTransfer(raw,i.kind)),payloadHash=await agreementHash(JSON.stringify([event,json,webhooks,...(source==='verify'?[crypto.randomUUID()]:[])]));
 await db.prepare(`INSERT OR IGNORE INTO ${i.kind}_transfer_observations VALUES(?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),i.reference,source,event,payloadHash,json,webhooks,new Date().toISOString()).run();
}
async function records(db:D1Database,i:Instruction){
 return (await db.prepare(`SELECT id,rowid AS sequence,source,event,transfer_json,webhook_count,created_at FROM ${i.kind}_transfer_observations WHERE reference=? ORDER BY rowid LIMIT 501`).bind(i.reference).all<{id:string;sequence:number;source:ReconciliationObservation['source'];event:string;transfer_json:string;webhook_count:number|null;created_at:string}>()).results.map(r=>({id:r.id,sequence:r.sequence,source:r.source,event:r.event,transfer:JSON.parse(r.transfer_json),webhookCount:r.webhook_count,observedAt:r.created_at}));
}
async function instruction(db:D1Database,input:Record<string,unknown>){
 if(input.kind!=='employee'&&input.kind!=='partner')throw new SignupError('Choose employee or partner payments.');
 const i=await db.prepare('SELECT * FROM payment_instruction_records WHERE kind=? AND reference=?').bind(input.kind,text(input.reference,'the original reference')).first<Instruction>();
 if(!i)throw new SignupError('Payment instruction not found.',404);
 if(i.mode!=='live')throw new SignupError('Test evidence cannot enter live execution or reconciliation.',409);
 if(input.sourceHash!==i.source_hash||await agreementHash(i.source_json)!==i.source_hash)throw new SignupError('Refresh the exact saved instruction.',409);
 return i;
}
async function finance(db:D1Database,a:SigningActor,h:Headers,amount:number,maker?:string,kind:PaymentKind='employee'){return productionOperatorControl(db,a,h,kind==='partner'?'partner_payment.approve':'payment.approve',amount,maker);}
export async function operatePaymentExecution(db:D1Database,actor:SigningActor,input:Record<string,unknown>,headers:Headers,runtime:PaymentExecutionRuntime={},transport:typeof fetch=fetch){
 if(!actor.operations)throw new SignupError('Operations access required.',403);
 const action=String(input.action),now=new Date().toISOString(),note=action==='verify_live_payment'?'Same-reference provider verification.':text(input.note,'the independent finance findings');
 if(action!=='verify_live_payment'&&input.evidenceReviewed!==true)throw new SignupError('Review the exact funds, mandate and provider evidence.');
 if(action==='prepare_payment_reserve'){
  const amount=integer(input.amountCents,'the separately allocated funds'),op=await finance(db,actor,headers,amount);
  const integration=text(input.integrationId,'the provider integration',20);if(!/^[1-9][0-9]*$/.test(integration))throw new SignupError('Use the exact numeric provider integration.');
  const fundingReference=text(input.fundingReference,'the unique bank or returned-funds allocation reference',200);
  const payload=JSON.stringify({integration,currency:'ZAR',mode:'live',amountCents:amount,fundingReference,fundingHash:hash(input.fundingHash,'funds evidence'),capabilityReference:text(input.capabilityReference,'the genuine provider capability acceptance',200),capabilityHash:hash(input.capabilityHash,'provider capability'),note});
  const payloadHash=await agreementHash(payload),key=text(input.requestKey,'a unique request key',200);
  const prior=await db.prepare('SELECT id,payload_hash FROM payment_live_reserves WHERE request_key=?').bind(key).first<{id:string;payload_hash:string}>();
  if(prior){if(prior.payload_hash!==payloadHash)throw new SignupError('Request key belongs to different funds evidence.',409);return {reserveId:prior.id,alreadyPrepared:true,paymentReleased:false};}
  const id=crypto.randomUUID();await db.prepare('INSERT INTO payment_live_reserves VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,key,integration,amount,fundingReference,payload,payloadHash,expiry(now),op.id,actor.userId,note,auth(),now).run();return {reserveId:id,paymentReleased:false};
 }
 if(action==='approve_payment_reserve'||action==='reject_payment_reserve'){
  const r=await db.prepare('SELECT * FROM payment_live_reserves WHERE id=?').bind(text(input.reserveId,'the reviewed reserve')).first<{id:string;amount_cents:number;operator_id:string;user_id:string;payload_hash:string;payload_json:string}>();if(!r)throw new SignupError('Reserve not found.',404);
  const op=await finance(db,actor,headers,r.amount_cents,r.operator_id);if(actor.userId===r.user_id)throw new SignupError('Independent reserve approval is required.',403);
  if(input.payloadHash!==r.payload_hash||await agreementHash(r.payload_json)!==r.payload_hash)throw new SignupError('Refresh the exact funds evidence.',409);
  await db.prepare('INSERT INTO payment_live_reserve_decisions VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),r.id,r.payload_hash,action==='approve_payment_reserve'?'approved':'rejected',op.id,actor.userId,note,auth(),now).run();return {paymentReleased:false};
 }
 const i=await instruction(db,input);if(participants(i).includes(actor.userId))throw new SignupError('Payment participants cannot authorize or reconcile their own payment.',403);
 const op=await finance(db,actor,headers,i.amount_cents,action==='prepare_live_release'||action==='prepare_live_reconciliation'?undefined:i.prepared_by,i.kind);
 if(action==='prepare_live_release'){
  const fee=integer(input.feeCeilingCents,'the reviewed maximum provider fee',0,100000);await finance(db,actor,headers,i.amount_cents+fee,undefined,i.kind);
  const mandate=await db.prepare(`SELECT payload_json FROM ${i.kind==='employee'?'payment':'partner'}_destination_reviews WHERE id=?`).bind(i.destination_id).first<{payload_json:string}>();if(!mandate)throw new SignupError('Current destination mandate not found.',409);
  const reserveId=text(input.reserveId,'the independently approved funds reserve'),payload=JSON.stringify({kind:i.kind,reference:i.reference,sourceHash:i.source_hash,reserveId,feeCeilingCents:fee,mandateHash:hash(JSON.parse(mandate.payload_json).mandateHash,'the accepted payout mandate'),acceptanceReference:text(input.acceptanceReference,'the finance release acceptance',200),note});
  const payloadHash=await agreementHash(payload),key=text(input.requestKey,'a unique request key',200),prior=await db.prepare('SELECT id,payload_hash FROM payment_live_releases WHERE request_key=?').bind(key).first<{id:string;payload_hash:string}>();
  if(prior){if(prior.payload_hash!==payloadHash)throw new SignupError('Request key belongs to different release evidence.',409);return {releaseId:prior.id,alreadyPrepared:true,paymentReleased:false};}
  const id=crypto.randomUUID();await db.prepare('INSERT INTO payment_live_releases VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,key,i.kind,i.reference,reserveId,i.source_hash,fee,payload,payloadHash,expiry(now),op.id,actor.userId,note,auth(),now).run();return {releaseId:id,paymentReleased:false};
 }
 if(action==='approve_live_release'||action==='reject_live_release'){
  const r=await db.prepare('SELECT * FROM payment_live_releases WHERE id=? AND kind=? AND reference=?').bind(text(input.releaseId,'the saved release review'),i.kind,i.reference).first<{id:string;operator_id:string;user_id:string;payload_hash:string;payload_json:string;fee_ceiling_cents:number}>();if(!r)throw new SignupError('Release not found.',404);
  await finance(db,actor,headers,i.amount_cents+r.fee_ceiling_cents,r.operator_id,i.kind);if(actor.userId===r.user_id||actor.userId===i.prepared_user)throw new SignupError('Independent live release approval is required.',403);
  if(input.payloadHash!==r.payload_hash||await agreementHash(r.payload_json)!==r.payload_hash)throw new SignupError('Refresh the exact release evidence.',409);
  await db.prepare('INSERT INTO payment_live_release_decisions VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),r.id,r.payload_hash,action==='approve_live_release'?'approved':'rejected',op.id,actor.userId,note,auth(),now).run();return {paymentReleased:false};
 }
 if(action==='dispatch_live_payment'){
  if(runtime.LOKD_LIVE_PAYMENTS_ENABLED!=='true'||!await db.prepare('SELECT id FROM payment_live_control WHERE id=1 AND enabled=1').first())throw new SignupError('Live payment dispatch remains locked. Build and local tests do not enable it.',423);
  if(i.version!==input.version||i.status!=='approved')throw new SignupError('A claimed or changed instruction cannot be resubmitted.',409);
  const releaseId=text(input.releaseId,'the independent live release'),r=await db.prepare('SELECT fee_ceiling_cents FROM payment_live_release_available WHERE id=? AND kind=? AND reference=?').bind(releaseId,i.kind,i.reference).first<{fee_ceiling_cents:number}>();if(!r)throw new SignupError('Current independent release and reserved funds are required.',409);
  await finance(db,actor,headers,i.amount_cents+r.fee_ceiling_cents,i.prepared_by,i.kind);
  const secret=destinationKey(runtime,'live'),snapshot=JSON.parse(i.source_json),recipient=await fetchRecipient(secret,snapshot.recipient.code,'live',transport),destination=await db.prepare(`SELECT payload_json FROM ${i.kind==='employee'?'payment':'partner'}_destination_reviews WHERE id=?`).bind(i.destination_id).first<{payload_json:string}>();
  const recipientHash=recipient?await agreementHash(JSON.stringify(recipient)):null;
  if(!recipientHash||!destination||recipientHash!==JSON.parse(destination.payload_json).providerHash)throw new SignupError('Current recipient and approved destination disagree. Submission remains blocked.',409);
  const balances=await provider(secret,'/balance',transport),zar=Array.isArray(balances)?balances.filter(b=>b?.currency==='ZAR'):[];
  if(zar.length!==1||!Number.isSafeInteger(zar[0].balance)||zar[0].balance<i.amount_cents+r.fee_ceiling_cents)throw new SignupError('Verified available ZAR balance does not cover the payment and approved fee ceiling.',409);
  const at=new Date().toISOString();
  await db.batch([
   db.prepare('INSERT INTO payment_live_claims VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(i.kind,i.reference,releaseId,i.version,i.source_hash,recipientHash,zar[0].balance,op.id,actor.userId,note,auth(),at),
   db.prepare(`INSERT INTO ${i.kind}_payment_commands VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),i.reference,i.version,'dispatch_live',op.id,actor.userId,i.source_hash,recipientHash,note,auth(),at),
   db.prepare(`UPDATE ${i.kind}_payment_instructions SET status='dispatch_claimed',version=version+1,updated_at=? WHERE reference=? AND version=?`).bind(at,i.reference,i.version),
  ]);
  const raw=await provider(secret,'/transfer',transport,{source:'balance',amount:i.amount_cents,currency:'ZAR',recipient:snapshot.recipient.code,reference:i.reference,reason:i.kind==='employee'?'LOKD employee payment':'LOKD partner invoice payment'});
  await observation(db,i,'initiate','transfer.initiate',raw);return {reference:i.reference,status:'dispatch_claimed',submissionClaimed:true,liabilityPaid:false,reconciliationRequired:true};
 }
 if(action==='verify_live_payment'){
  if(i.status!=='dispatch_claimed')throw new SignupError('Only the original claimed reference can be verified.',409);
  const before=await records(db,i);if(before.length>500)throw new SignupError('Evidence limit reached. Keep this payment held.',409);
  const raw=await provider(destinationKey(runtime,'live'),'/transfer/verify/'+i.reference,transport);await observation(db,i,'verify','transfer.verify',raw,before.filter(o=>o.source==='webhook').length);return {paymentReleased:false,reconciliationRequired:true};
 }
 if(action==='prepare_live_reconciliation'){
  const claim=await db.prepare(`SELECT id,created_at FROM ${i.kind}_payment_commands WHERE reference=? AND action='dispatch_live'`).bind(i.reference).first<{id:string;created_at:string}>();
  const assessed=assessPaymentEvidence({binding:{...binding(i),kind:i.kind,liabilityId:i.liability_id,sourceHash:i.source_hash},claim:claim?{commandId:claim.id,reference:i.reference,mode:'live',sourceHash:i.source_hash,claimedAt:claim.created_at}:null,observations:await records(db,i)},new Date());
  if(!assessed.snapshot||!['provider_success','provider_reversed'].includes(assessed.state))throw new SignupError('Fresh matching signed and API evidence is required. Keep the liability held.',409);
  const bankReference=text(input.bankReference,'the unique bank debit or reversal credit reference',200),bankHash=hash(input.bankHash,'the bank debit or reversal credit evidence'),bankAmount=integer(input.bankAmountCents,'the actual debit or returned amount');
  const payload=JSON.stringify({snapshot:assessed.snapshot,evidenceHash:await paymentEvidenceSnapshotHash(assessed.snapshot),bankReference,bankHash,bankAmount,note}),payloadHash=await agreementHash(payload),key=text(input.requestKey,'a unique reconciliation request key',200),prior=await db.prepare('SELECT id,payload_hash FROM payment_live_reconciliation_reviews WHERE request_key=?').bind(key).first<{id:string;payload_hash:string}>();
  if(prior){if(prior.payload_hash!==payloadHash)throw new SignupError('Request key belongs to different reconciliation evidence.',409);return {reviewId:prior.id,alreadyPrepared:true,paymentReleased:false};}
  const id=crypto.randomUUID();await db.prepare('INSERT INTO payment_live_reconciliation_reviews VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,key,i.kind,i.reference,i.source_hash,assessed.snapshot.verifiedObservationId,assessed.snapshot.transfer.status,bankReference,bankHash,bankAmount,payload,payloadHash,expiry(now,5),op.id,actor.userId,note,auth(),now).run();return {reviewId:id,paymentReleased:false};
 }
 if(action==='approve_live_reconciliation'||action==='reject_live_reconciliation'){
  const r=await db.prepare('SELECT * FROM payment_live_reconciliation_reviews WHERE id=? AND kind=? AND reference=?').bind(text(input.reviewId,'the saved reconciliation review'),i.kind,i.reference).first<{id:string;operator_id:string;user_id:string;payload_hash:string;payload_json:string;disposition:string;bank_reference:string}>();if(!r)throw new SignupError('Reconciliation review not found.',404);
  await finance(db,actor,headers,i.amount_cents,r.operator_id,i.kind);if(actor.userId===r.user_id||actor.userId===i.prepared_user)throw new SignupError('Independent reconciliation approval is required.',403);
  if(input.payloadHash!==r.payload_hash||await agreementHash(r.payload_json)!==r.payload_hash)throw new SignupError('Refresh the exact reconciliation evidence.',409);
  await db.prepare('INSERT INTO payment_live_reconciliation_decisions VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),r.id,i.kind,i.reference,r.disposition,r.bank_reference,r.payload_hash,action==='approve_live_reconciliation'?'approved':'rejected',op.id,actor.userId,note,auth(),now).run();return {paymentReleased:false,reconciled:action==='approve_live_reconciliation'};
 }
 throw new SignupError('Choose a supported payment execution action.');
}
export async function receiveLiveTransferWebhook(request:Request,db:D1Database,runtime:PaymentExecutionRuntime){
 const secret=destinationKey(runtime,'live'),signature=request.headers.get('x-paystack-signature')??'';
 if(!/^[a-f0-9]{128}$/i.test(signature))throw new SignupError('Invalid webhook signature.',401);
 const raw=await readFinanceWebhookBytes(request);
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-512'},false,['verify']);
 if(!await crypto.subtle.verify('HMAC',key,Uint8Array.from(signature.match(/../g)!,v=>parseInt(v,16)),raw))throw new SignupError('Invalid webhook signature.',401);
 let p;try{p=JSON.parse(new TextDecoder().decode(raw));}catch{throw new SignupError('Invalid event.');}
 if(p?.data?.domain!=='live'||typeof p.event!=='string'||!p.event.startsWith('transfer.')||p.event.length>100||typeof p.data.reference!=='string')throw new SignupError('Only explicit live transfer events are accepted.',422);
 const kind=p.data.reference.startsWith('lokd-partner-pay-')?'partner':'employee';
 const i=await db.prepare("SELECT * FROM payment_instruction_records WHERE kind=? AND reference=? AND mode='live'").bind(kind,p.data.reference).first<Instruction>();if(!i)return {received:true,matched:false};
 await observation(db,i,'webhook',p.event,p.data);return {received:true,matched:true};
}
export async function readPaymentExecution(db:D1Database,actor:SigningActor,headers:Headers,runtime:PaymentExecutionRuntime={}){
 await finance(db,actor,headers,0);
 return {liveDispatchEnabled:runtime.LOKD_LIVE_PAYMENTS_ENABLED==='true'&&!!await db.prepare('SELECT id FROM payment_live_control WHERE id=1 AND enabled=1').first(),
 reserves:(await db.prepare('SELECT r.*,d.decision,c.remaining_cents FROM payment_live_reserves r LEFT JOIN payment_live_reserve_decisions d ON d.reserve_id=r.id LEFT JOIN payment_live_reserve_current c ON c.id=r.id ORDER BY r.created_at DESC LIMIT 100').all()).results,
 releases:(await db.prepare('SELECT r.*,d.decision,EXISTS(SELECT 1 FROM payment_live_release_reviewable c WHERE c.id=r.id) AS current FROM payment_live_releases r LEFT JOIN payment_live_release_decisions d ON d.release_id=r.id ORDER BY r.created_at DESC LIMIT 100').all()).results,
 reconciliations:(await db.prepare('SELECT r.*,d.decision,EXISTS(SELECT 1 FROM payment_live_reconciliation_reviewable c WHERE c.id=r.id) AS current FROM payment_live_reconciliation_reviews r LEFT JOIN payment_live_reconciliation_decisions d ON d.review_id=r.id ORDER BY r.created_at DESC LIMIT 100').all()).results};
}

export async function readPaymentEvidenceAssessment(db:D1Database,kind:PaymentKind,reference:string){
 const i=await db.prepare('SELECT * FROM payment_instruction_records WHERE kind=? AND reference=?').bind(kind,reference).first<Instruction>();
 if(!i)throw new SignupError('Payment instruction not found.',404);
 const c=await db.prepare(`SELECT id,created_at FROM ${kind}_payment_commands WHERE reference=? AND action=?`).bind(reference,i.mode==='live'?'dispatch_live':'dispatch_test').first<{id:string;created_at:string}>();
 return assessPaymentEvidence({binding:{...binding(i),kind,liabilityId:i.liability_id,sourceHash:i.source_hash},claim:c?{commandId:c.id,reference,mode:i.mode,sourceHash:i.source_hash,claimedAt:c.created_at}:null,observations:await records(db,i)},new Date());
}
