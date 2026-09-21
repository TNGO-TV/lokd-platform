// Server-side preparation for the existing contract envelope flow. No public
// signing endpoint is enabled until legal wording and signer mandates are approved.
export type AgreementPurpose = 'client_service' | 'partner_service' | 'officer_employment' | 'bank_instruction' | 'deduction_authorisation' | 'identity_consent' | 'privacy_acknowledgement' | 'marketing_consent';
export type AgreementVersion = {
  id: string; version: string; purpose: AgreementPurpose; entityId: string; locale: string;
  status: 'draft' | 'approved' | 'withdrawn'; approvedBy: string | null; approvedAt: string | null;
  effectiveFrom: string; effectiveTo: string | null; wording: string; contentHash: string;
};
export type AgreementContext = {
  subjectId: string; transactionId: string; transactionVersion: string;
  // Frozen server-loaded order/employer/price/risk-plan or collection scope.
  scope: Record<string, string | number | boolean | null>;
};
export async function agreementHash(text: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))),v=>v.toString(16).padStart(2,'0')).join('');
}
export function canonicalAgreementContext(context: AgreementContext) {
  if (!context.subjectId || !context.transactionId || !context.transactionVersion || !Object.keys(context.scope).length) throw new Error('An exact subject, transaction version and scope are required.');
  const entries=Object.entries(context.scope).sort(([a],[b])=>a<b?-1:a>b?1:0);
  if(entries.some(([,v])=>v!==null && !['string','number','boolean'].includes(typeof v) || typeof v==='number' && !Number.isFinite(v))) throw new Error('Agreement scope must contain finite, explicit values.');
  return JSON.stringify({subjectId:context.subjectId,transactionId:context.transactionId,transactionVersion:context.transactionVersion,scope:Object.fromEntries(entries)});
}
export async function prepareAgreementReceipt(input: {
  document: AgreementVersion; context: AgreementContext; presentedContentHash: string; presentedContextHash: string;
  expectedPurpose: AgreementPurpose; expectedEntityId: string; expectedLocale: string;
  actorUserId: string; identityEvidence: string; authorityEvidence?: string;
  action: 'agree' | 'acknowledge'; affirmative: boolean; now?: number;
}) {
  const now=input.now ?? Date.now(),doc=input.document;
  if(doc.status!=='approved' || !doc.approvedBy || !doc.approvedAt || !Number.isFinite(Date.parse(doc.approvedAt)) || Date.parse(doc.approvedAt)>now) throw new Error('Approved legal wording is required.');
  if(!doc.id || !doc.version || !doc.wording.trim() || /\[\[|WORKING DRAFT|PRELIMINARY FRAMEWORK|SIMULATION ONLY/i.test(doc.wording)) throw new Error('Unfinished or synthetic wording cannot be accepted.');
  if(!doc.entityId.trim() || !doc.locale.trim() || doc.purpose!==input.expectedPurpose || doc.entityId!==input.expectedEntityId || doc.locale!==input.expectedLocale) throw new Error('Document purpose, entity or locale does not match this step.');
  if(!Number.isFinite(Date.parse(doc.effectiveFrom)) || Date.parse(doc.effectiveFrom)>now || doc.effectiveTo!==null && (!Number.isFinite(Date.parse(doc.effectiveTo)) || Date.parse(doc.effectiveTo)<=now)) throw new Error('The document version is not currently effective.');
  if(!input.affirmative || !input.actorUserId || !input.identityEvidence.trim()) throw new Error('An affirmative action and independently verified actor are required.');
  if((doc.purpose==='client_service'||doc.purpose==='partner_service') && !input.authorityEvidence?.trim()) throw new Error('Client representative authority must be verified separately.');
  if(input.action!==(doc.purpose==='privacy_acknowledgement'?'acknowledge':'agree')) throw new Error('Privacy acknowledgement and affirmative agreement/consent are separate actions.');
  const contextJson=canonicalAgreementContext(input.context);
  const contextHash=await agreementHash(contextJson);
  const contentHash=await agreementHash(doc.wording);
  if(contentHash!==doc.contentHash || contentHash!==input.presentedContentHash || contextHash!==input.presentedContextHash) throw new Error('The presented wording or transaction changed. Present the current version again.');
  const receipt={documentId:doc.id,documentVersion:doc.version,purpose:doc.purpose,entityId:doc.entityId,locale:doc.locale,
    contentHash,wording:doc.wording,context:JSON.parse(contextJson) as AgreementContext,contextHash,
    actorUserId:input.actorUserId,identityEvidence:input.identityEvidence,authorityEvidence:input.authorityEvidence??null,
    action:input.action,acceptedAt:new Date(now).toISOString(),
    // Acknowledgement never creates marketing or biometric consent. Each purpose
    // needs its own approved document and action. None of these activate work.
    grantsWorkEligibility:false,grantsPaymentAuthority:false};
  const receiptJson=JSON.stringify(receipt);
  return {receiptJson,receiptHash:await agreementHash(receiptJson),contextHash};
}

// D1 enforces immutable receipts and replay uniqueness. Callers must load trusted
// documents/context and authenticated actor proof; never pass a request body here.
export async function storeAgreementReceipt(db: D1Database, key: string, prepared: Awaited<ReturnType<typeof prepareAgreementReceipt>>) {
  if(!key || key.length>200) throw new Error('A bounded acceptance key is required.');
  if(await agreementHash(prepared.receiptJson)!==prepared.receiptHash) throw new Error('Receipt integrity check failed.');
  await db.prepare('INSERT OR IGNORE INTO agreement_acceptance_receipts (id,receipt_json,receipt_hash,context_hash) VALUES (?,?,?,?)')
    .bind(key,prepared.receiptJson,prepared.receiptHash,prepared.contextHash).run();
  const saved=await db.prepare('SELECT receipt_hash FROM agreement_acceptance_receipts WHERE id=?').bind(key).first<{receipt_hash:string}>();
  if(saved?.receipt_hash!==prepared.receiptHash) throw new Error('This acceptance key already belongs to different evidence.');
  return key;
}
