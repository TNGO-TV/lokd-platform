-- EFT receipts retain the bank evidence and an independent, immutable decision.
CREATE TABLE production_eft_receipts (
 id TEXT PRIMARY KEY, booking_id TEXT NOT NULL REFERENCES bookings(id),
 bank_reference TEXT NOT NULL UNIQUE, amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
 artifact_id TEXT NOT NULL REFERENCES document_artifacts(id), artifact_hash TEXT NOT NULL,
 cleared_at TEXT NOT NULL, prepared_by TEXT NOT NULL REFERENCES operator_accounts(id),
 prepared_user TEXT NOT NULL, note TEXT NOT NULL CHECK(length(trim(note))>=3), created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE production_eft_decisions (
 receipt_id TEXT PRIMARY KEY REFERENCES production_eft_receipts(id),
 decision TEXT NOT NULL CHECK(decision IN ('approved','rejected')),
 decided_by TEXT NOT NULL REFERENCES operator_accounts(id), decided_user TEXT NOT NULL,
 note TEXT NOT NULL CHECK(length(trim(note))>=3), decided_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER production_eft_prepare_guard BEFORE INSERT ON production_eft_receipts BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM bookings b WHERE b.id=NEW.booking_id AND b.environment='production'
  AND b.integrity_state='production_verified' AND b.client_price_cents=NEW.amount_cents AND b.funding_status='unfunded')
  OR NOT EXISTS(SELECT 1 FROM document_artifacts a WHERE a.id=NEW.artifact_id AND a.environment='production' AND a.status='verified' AND a.content_hash=NEW.artifact_hash AND a.access_class='finance')
  OR julianday(NEW.cleared_at) IS NULL OR julianday(NEW.cleared_at)>julianday('now')
  THEN RAISE(ABORT,'EFT booking or bank evidence changed') END);
END;
--> statement-breakpoint
CREATE TRIGGER production_eft_decision_guard BEFORE INSERT ON production_eft_decisions BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM production_eft_receipts r JOIN operator_accounts a ON a.id=NEW.decided_by
  JOIN operator_role_assignments role ON role.operator_id=a.id AND role.role='finance_approver' AND role.status='active' AND role.environment='production'
  WHERE r.id=NEW.receipt_id AND r.prepared_by<>NEW.decided_by AND r.prepared_user<>NEW.decided_user AND a.status='active' AND a.environment='production' AND a.approval_limit_cents>=r.amount_cents)
 THEN RAISE(ABORT,'Independent finance approval is required') END);
 SELECT (CASE WHEN NEW.decision='approved' AND NOT EXISTS(SELECT 1 FROM production_eft_receipts r JOIN bookings b ON b.id=r.booking_id
 JOIN document_artifacts a ON a.id=r.artifact_id WHERE r.id=NEW.receipt_id AND b.environment='production' AND b.funding_status='unfunded'
 AND b.client_price_cents=r.amount_cents AND a.status='verified' AND a.content_hash=r.artifact_hash
 AND NOT EXISTS(SELECT 1 FROM booking_funding_reconciliations f WHERE f.active_key=b.id))
 THEN RAISE(ABORT,'EFT evidence or booking changed before approval') END);
END;
--> statement-breakpoint
CREATE TRIGGER production_eft_funding AFTER INSERT ON production_eft_decisions WHEN NEW.decision='approved' BEGIN
 INSERT INTO booking_funding_reconciliations(id,booking_id,environment,integrity_state,provider,provider_reference,currency,expected_amount_cents,cleared_amount_cents,status,cleared_at,reconciled_at,evidence_reference,evidence_verified_at,evidence_expires_at,version,active_key,created_at)
 SELECT 'EFT-'||r.id,r.booking_id,'production','production_verified','eft',r.bank_reference,'ZAR',r.amount_cents,r.amount_cents,'cleared_reconciled',r.cleared_at,NEW.decided_at,'eft-review:'||r.id,NEW.decided_at,strftime('%Y-%m-%dT%H:%M:%fZ',b.end_date,'+1 day'),1,r.booking_id,NEW.decided_at
 FROM production_eft_receipts r JOIN bookings b ON b.id=r.booking_id WHERE r.id=NEW.receipt_id;
END;
--> statement-breakpoint
CREATE TRIGGER production_eft_receipts_immutable BEFORE UPDATE ON production_eft_receipts BEGIN SELECT RAISE(ABORT,'EFT receipt history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER production_eft_receipts_retain BEFORE DELETE ON production_eft_receipts BEGIN SELECT RAISE(ABORT,'EFT receipt history is required'); END;
--> statement-breakpoint
CREATE TRIGGER production_eft_decisions_immutable BEFORE UPDATE ON production_eft_decisions BEGIN SELECT RAISE(ABORT,'EFT decisions are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER production_eft_decisions_retain BEFORE DELETE ON production_eft_decisions BEGIN SELECT RAISE(ABORT,'EFT decision history is required'); END;
-- Accounting jobs use the existing provider and operation ledger.
--> statement-breakpoint
ALTER TABLE integration_operations ADD COLUMN request_json TEXT;
--> statement-breakpoint
ALTER TABLE integration_operations ADD COLUMN lease_token TEXT;
--> statement-breakpoint
ALTER TABLE integration_operations ADD COLUMN lease_expires_at TEXT;
--> statement-breakpoint
CREATE TRIGGER operations_accounting_payload_immutable BEFORE UPDATE OF request_json ON integration_operations
 WHEN OLD.request_json IS NOT NULL AND NEW.request_json IS NOT OLD.request_json
 BEGIN SELECT RAISE(ABORT,'Accounting payload is immutable'); END;
