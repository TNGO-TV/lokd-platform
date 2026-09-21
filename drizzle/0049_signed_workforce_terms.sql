CREATE TRIGGER signed_workforce_terms_insert_guard BEFORE INSERT ON workforce_terms_acceptances
WHEN NEW.id LIKE 'WTA-LIVE-%' BEGIN
 SELECT (CASE WHEN NOT EXISTS (
  SELECT 1 FROM production_signing_envelopes e
  JOIN agreement_acceptance_receipts r ON r.id='LIVE-SIGN-'||e.id
  JOIN agreement_document_versions d ON d.id=e.document_id
  JOIN workforce_engagements w ON w.id=NEW.workforce_engagement_id
  JOIN signup_cases c ON c.kind='officer' AND c.source_id=e.case_id
  JOIN production_entity_links l ON l.kind=c.kind AND l.case_id=c.source_id
  WHERE NEW.id='WTA-LIVE-'||e.id AND NEW.evidence_reference='agreement:'||r.id
   AND NEW.environment='production' AND NEW.integrity_state='verified'
   AND NEW.acceptance_mode='electronic_signature' AND NEW.officer_id=e.officer_id
   AND NEW.active_key=w.id AND NEW.terms_version=w.terms_version
   AND w.environment='production' AND w.status='active' AND w.active_key=w.officer_id
   AND w.officer_id=NEW.officer_id AND julianday(w.review_due_at)>=julianday(NEW.expires_at)
   AND e.role='OFFICER_EMPLOYMENT' AND e.case_kind='officer'
   AND c.version=e.case_version AND l.case_version=c.version AND c.status!='withdrawn'
   AND c.owner_user_id=e.owner_user_id AND l.owner_user_id=e.owner_user_id AND l.entity_id=e.officer_id
   AND d.document_code='OFFICER_EMPLOYMENT' AND d.status='approved'
   AND d.environment='production' AND d.integrity_state='production_verified'
   AND d.entity_id=w.employer_id AND d.content_hash=e.content_hash
   AND json_extract(r.receipt_json,'$.actorUserId')=e.owner_user_id
   AND json_extract(r.receipt_json,'$.action')='agree'
   AND json_extract(r.receipt_json,'$.documentId')=d.id
   AND json_extract(r.receipt_json,'$.contentHash')=d.content_hash
   AND json_extract(r.receipt_json,'$.context.scope.engagementId')=w.id
   AND json_extract(r.receipt_json,'$.context.scope.termsVersion')=w.terms_version
   AND json_extract(r.receipt_json,'$.context.scope.employerId')=w.employer_id
   AND json_extract(r.receipt_json,'$.context.scope.officerId')=NEW.officer_id
   AND NEW.accepted_at=json_extract(r.receipt_json,'$.acceptedAt')
   AND julianday(NEW.accepted_at)<=julianday('now','+1 minute')
   AND julianday(NEW.expires_at)>julianday('now')
   AND julianday(d.effective_from)<=julianday(NEW.accepted_at)
   AND (d.effective_to IS NULL OR julianday(d.effective_to)>=julianday(NEW.expires_at))
   AND NOT EXISTS(SELECT 1 FROM production_envelope_cancellations x WHERE x.envelope_id=e.id)
   AND NOT EXISTS(SELECT 1 FROM signing_document_withdrawals x WHERE x.document_id=d.id)
   AND NOT EXISTS(SELECT 1 FROM agreement_receipt_revocations x WHERE x.receipt_id=r.id)
 ) THEN RAISE(ABORT,'Current bound officer signature is required for workforce terms') END);
END;
--> statement-breakpoint
CREATE TRIGGER signed_workforce_terms_update_guard BEFORE UPDATE ON workforce_terms_acceptances
WHEN OLD.id LIKE 'WTA-LIVE-%' BEGIN
 SELECT (CASE WHEN NEW.id IS NOT OLD.id OR NEW.workforce_engagement_id IS NOT OLD.workforce_engagement_id
 OR NEW.officer_id IS NOT OLD.officer_id OR NEW.terms_version IS NOT OLD.terms_version
 OR NEW.acceptance_mode IS NOT OLD.acceptance_mode OR NEW.environment IS NOT OLD.environment
 OR NEW.integrity_state IS NOT OLD.integrity_state OR NEW.evidence_reference IS NOT OLD.evidence_reference
 OR NEW.accepted_at IS NOT OLD.accepted_at OR NEW.expires_at IS NOT OLD.expires_at
 OR NEW.created_at IS NOT OLD.created_at OR NEW.version IS NOT OLD.version
 OR NEW.active_key IS NOT NULL THEN RAISE(ABORT,'Signed workforce terms are immutable except withdrawal') END);
END;
--> statement-breakpoint
CREATE TRIGGER signed_workforce_terms_no_delete BEFORE DELETE ON workforce_terms_acceptances
WHEN OLD.id LIKE 'WTA-LIVE-%' BEGIN SELECT RAISE(ABORT,'Signed workforce terms history is required'); END;
--> statement-breakpoint
CREATE TRIGGER signed_workforce_terms_envelope_cancel AFTER INSERT ON production_envelope_cancellations BEGIN
 UPDATE workforce_terms_acceptances SET active_key=NULL WHERE id='WTA-LIVE-'||NEW.envelope_id AND active_key IS NOT NULL;
END;
--> statement-breakpoint
CREATE TRIGGER signed_workforce_terms_document_withdraw AFTER INSERT ON signing_document_withdrawals BEGIN
 UPDATE workforce_terms_acceptances SET active_key=NULL WHERE active_key IS NOT NULL AND id IN (SELECT 'WTA-LIVE-'||id FROM production_signing_envelopes WHERE document_id=NEW.document_id);
END;
--> statement-breakpoint
CREATE TRIGGER signed_workforce_terms_receipt_revoke AFTER INSERT ON agreement_receipt_revocations BEGIN
 UPDATE workforce_terms_acceptances SET active_key=NULL WHERE id LIKE 'WTA-LIVE-%' AND evidence_reference='agreement:'||NEW.receipt_id AND active_key IS NOT NULL;
END;
