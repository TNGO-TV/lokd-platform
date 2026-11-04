-- One-off removal of records confirmed in the production D1 inventory on
-- 2026-11-04. Exact IDs, dates and descriptions prevent matching real enquiries.
-- Run through D1 migrations as one transaction, after an encrypted export.
DROP TRIGGER IF EXISTS client_enquiry_delete_guard_v30;
--> statement-breakpoint
DROP TRIGGER IF EXISTS client_enquiry_receipts_immutable_delete;
--> statement-breakpoint
DROP TRIGGER IF EXISTS operational_delivery_history;
--> statement-breakpoint
DELETE FROM operational_delivery_jobs WHERE kind IN ('enquiry_crm','enquiry_email') AND source_id IN (
 SELECT id FROM client_enquiries WHERE
 (id='ENQ-E8E621DB' AND created_at='2026-09-27T00:14:26.046Z' AND organisation_name='LOKD SYNTHETIC ZEPTOMAIL ALLOWLIST TEST NOT A CUSTOMER 20260927001425') OR
 (id='ENQ-4FF55726' AND created_at='2026-09-27T01:04:48.761Z' AND organisation_name='SYNTHETIC SMTP WORKER PATH 1790471088 — NOT A CUSTOMER')
);
--> statement-breakpoint
DELETE FROM client_enquiry_receipts WHERE enquiry_id IN (
 SELECT id FROM client_enquiries WHERE
 (id='ENQ-E8E621DB' AND created_at='2026-09-27T00:14:26.046Z' AND organisation_name='LOKD SYNTHETIC ZEPTOMAIL ALLOWLIST TEST NOT A CUSTOMER 20260927001425') OR
 (id='ENQ-4FF55726' AND created_at='2026-09-27T01:04:48.761Z' AND organisation_name='SYNTHETIC SMTP WORKER PATH 1790471088 — NOT A CUSTOMER')
);
--> statement-breakpoint
DELETE FROM audit_events WHERE event_type='public_client_enquiry_submitted' AND entity_type='client_enquiry' AND actor_type='client_enquiry' AND actor_id=entity_id AND entity_id IN (
 SELECT id FROM client_enquiries WHERE
 (id='ENQ-E8E621DB' AND created_at='2026-09-27T00:14:26.046Z' AND organisation_name='LOKD SYNTHETIC ZEPTOMAIL ALLOWLIST TEST NOT A CUSTOMER 20260927001425') OR
 (id='ENQ-4FF55726' AND created_at='2026-09-27T01:04:48.761Z' AND organisation_name='SYNTHETIC SMTP WORKER PATH 1790471088 — NOT A CUSTOMER')
);
--> statement-breakpoint
DELETE FROM client_enquiries WHERE
 (id='ENQ-E8E621DB' AND created_at='2026-09-27T00:14:26.046Z' AND organisation_name='LOKD SYNTHETIC ZEPTOMAIL ALLOWLIST TEST NOT A CUSTOMER 20260927001425') OR
 (id='ENQ-4FF55726' AND created_at='2026-09-27T01:04:48.761Z' AND organisation_name='SYNTHETIC SMTP WORKER PATH 1790471088 — NOT A CUSTOMER');
--> statement-breakpoint
CREATE TRIGGER client_enquiry_delete_guard_v30 BEFORE DELETE ON client_enquiries
BEGIN SELECT RAISE(ABORT,'client_enquiry_history_required'); END;
--> statement-breakpoint
CREATE TRIGGER client_enquiry_receipts_immutable_delete BEFORE DELETE ON client_enquiry_receipts
BEGIN SELECT RAISE(ABORT,'enquiry_receipt_history_required'); END;
--> statement-breakpoint
CREATE TRIGGER operational_delivery_history BEFORE DELETE ON operational_delivery_jobs
BEGIN SELECT RAISE(ABORT,'delivery_history_required'); END;
--> statement-breakpoint
-- Explicit provenance only; never infer a person's authenticity from their name.
DELETE FROM officer_endorsements WHERE environment='demo' AND integrity_state='synthetic';
--> statement-breakpoint
DELETE FROM officer_passports WHERE environment='demo' AND integrity_state='synthetic';
--> statement-breakpoint
-- Exact original seed identity, not a name-only match. Foreign keys and
-- production linkage checks prevent removing an adopted business record.
DELETE FROM officers WHERE id='OFF-001' AND full_name='Lerato Khumalo'
 AND email='lerato@example.co.za' AND psira_number='PSIRA-1842'
 AND created_at='2026-08-01T08:00:00.000Z'
 AND NOT EXISTS(SELECT 1 FROM production_entity_links WHERE entity_id=officers.id);
