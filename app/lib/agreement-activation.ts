import { agreementHash, canonicalAgreementContext, type AgreementContext } from './agreement-acceptance';
import type { AssignmentActivationFacts } from './assignment-activation-core';
export type ActivationAgreementRole = 'CLIENT_MSA' | 'SERVICE_ORDER' | 'OFFICER_EMPLOYMENT' | 'PARTNER_SERVICE';
export function requiredActivationAgreements(facts: AssignmentActivationFacts): ActivationAgreementRole[] {
  return ['CLIENT_MSA','SERVICE_ORDER',facts.workforce.model==='partner'?'PARTNER_SERVICE':'OFFICER_EMPLOYMENT'];
}
export function activationAgreementContext(facts: AssignmentActivationFacts, role: ActivationAgreementRole): AgreementContext {
  const client = role==='CLIENT_MSA' || role==='SERVICE_ORDER';
  return {subjectId:client?facts.client.id:facts.officer.id,transactionId:facts.shift.rosterSlotId,
    transactionVersion:String(facts.client.orderVersion??0),scope:{
      documentRole:role,orderDetails:facts.client.orderDetails??null,bookingId:facts.shift.bookingId,clientId:facts.client.id,
      contractingEntityId:facts.client.contractingEntityId??null,
      siteId:facts.site.id,siteVersion:facts.site.version,postId:facts.post.id,
      postOrdersVersion:facts.post.postOrdersVersion,riskId:facts.site.risk.id,riskVersion:facts.site.risk.version??null,
      serviceType:facts.post.serviceType??null,purposeCode:facts.post.purposeCode??null,
      minimumGrade:facts.post.minimumGrade??null,startsAt:facts.shift.startsAt,endsAt:facts.shift.endsAt,
      currency:facts.funding.currency,clientPriceCents:facts.funding.bookingAmountCents,
      pricingVersion:facts.compensation.pricingVersion,workforceModel:facts.workforce.model,
      employerId:facts.workforce.employer.id,employerName:facts.workforce.employer.legalName,
      ...(client?{}:{officerId:facts.officer.id,engagementId:facts.workforce.engagementId,
        termsVersion:facts.workforce.termsVersion,officerOfferCents:facts.compensation.officerOfferCents}),
    }};
}
export async function readActivationAgreements(db: D1Database, facts: AssignmentActivationFacts) {
  const receipts: Array<{id:string;hash:string;documentId:string;documentVersion:string;contextHash:string}> = [];
  const missing: string[] = [];
  for(const role of requiredActivationAgreements(facts)) {
    const context=activationAgreementContext(facts,role),contextHash=await agreementHash(canonicalAgreementContext(context));
    const candidates=await db.prepare(`SELECT r.id,r.receipt_json,r.receipt_hash FROM agreement_acceptance_receipts r
      WHERE r.context_hash=? AND NOT EXISTS(SELECT 1 FROM agreement_receipt_revocations v WHERE v.receipt_id=r.id)
      ORDER BY r.id`).bind(contextHash).all<{id:string;receipt_json:string;receipt_hash:string}>();
    let matched=false;
    for(const row of candidates.results) {
      try {
        if(await agreementHash(row.receipt_json)!==row.receipt_hash)continue;
        const receipt=JSON.parse(row.receipt_json);
        const client=role==='CLIENT_MSA'||role==='SERVICE_ORDER';
        const expectedEntity=client?facts.client.contractingEntityId:facts.workforce.employer.id;
        const expectedPurpose=client?'client_service':role==='PARTNER_SERVICE'?'partner_service':'officer_employment';
        if(!expectedEntity || receipt.entityId!==expectedEntity || receipt.purpose!==expectedPurpose
          || receipt.action!=='agree' || !receipt.actorUserId || !receipt.identityEvidence
          || (client||role==='PARTNER_SERVICE')&&!receipt.authorityEvidence
          || receipt.contextHash!==contextHash || canonicalAgreementContext(receipt.context)!==canonicalAgreementContext(context)
          || !receipt.locale || !receipt.wording || await agreementHash(receipt.wording)!==receipt.contentHash
          || !Number.isFinite(Date.parse(receipt.acceptedAt)) || Date.parse(receipt.acceptedAt)>Date.parse(facts.evaluatedAt))continue;
        const template=await db.prepare(`SELECT document_version AS template_version,content_hash AS template_hash,approved_at,effective_from,effective_to,entity_id,locale,document_reference
          FROM agreement_document_versions WHERE id=? AND document_code=? AND status='approved'
          AND environment='production' AND integrity_state='production_verified' AND length(trim(approved_by))>0`)
          .bind(receipt.documentId,role).first<{template_version:string;template_hash:string;approved_at:string;effective_from:string;effective_to:string|null;entity_id:string;locale:string;document_reference:string}>();
        if(!template || template.entity_id!==receipt.entityId || template.locale!==receipt.locale || !template.document_reference.trim() || template.document_reference.startsWith('demo:') || template.template_version!==receipt.documentVersion || template.template_hash!==receipt.contentHash)continue;
        const signedAt=Date.parse(receipt.acceptedAt);
        if(!Number.isFinite(Date.parse(template.approved_at)) || Date.parse(template.approved_at)>signedAt
          || !Number.isFinite(Date.parse(template.effective_from)) || Date.parse(template.effective_from)>signedAt
          || template.effective_to!==null && (!Number.isFinite(Date.parse(template.effective_to)) || Date.parse(template.effective_to)<=signedAt))continue;
        receipts.push({id:row.id,hash:row.receipt_hash,documentId:receipt.documentId,documentVersion:receipt.documentVersion,contextHash});
        matched=true;break;
      }catch{ /* Malformed evidence is unverified, never an approval. */ }
    }
    if(!matched)missing.push(role);
  }
  return {ready:missing.length===0,missing,receipts};
}
