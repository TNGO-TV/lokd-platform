CREATE TABLE `production_partner_payable_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL,
	`decision` text NOT NULL,
	`operator_id` text NOT NULL,
	`user_id` text NOT NULL,
	`payload_hash` text NOT NULL,
	`note` text NOT NULL,
	`auth_method` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`review_id`) REFERENCES `production_partner_payable_reviews`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `partner_payable_decision_idx` ON `production_partner_payable_decisions` (`review_id`);--> statement-breakpoint
CREATE TABLE `production_partner_payable_exports` (
	`review_id` text PRIMARY KEY NOT NULL,
	`operator_id` text NOT NULL,
	`user_id` text NOT NULL,
	`payload_hash` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`review_id`) REFERENCES `production_partner_payable_reviews`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `production_partner_payable_holds` (
	`review_id` text PRIMARY KEY NOT NULL,
	`operator_id` text NOT NULL,
	`user_id` text NOT NULL,
	`note` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`review_id`) REFERENCES `production_partner_payable_reviews`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `production_partner_payable_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`timesheet_id` text NOT NULL,
	`employer_id` text NOT NULL,
	`request_key` text NOT NULL,
	`request_hash` text NOT NULL,
	`source_json` text NOT NULL,
	`payload_json` text NOT NULL,
	`payload_hash` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`prepared_by` text NOT NULL,
	`prepared_user` text NOT NULL,
	`prepared_at` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`timesheet_id`) REFERENCES `shift_timesheets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employer_id`) REFERENCES `workforce_employers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `partner_review_request_idx` ON `production_partner_payable_reviews` (`request_key`);--> statement-breakpoint
CREATE INDEX `partner_review_timesheet_idx` ON `production_partner_payable_reviews` (`timesheet_id`);--> statement-breakpoint
CREATE VIEW production_partner_payable_sources AS
SELECT t.id AS timesheet_id,t.employer_id,
 json_object('timesheetId',t.id,'timesheetVersion',t.version,'officerId',t.officer_id,'employerId',e.id,'employerName',e.legal_name,'employerVersion',e.version,'engagementId',w.id,'engagementVersion',w.version,'serviceDate',t.service_date,'payableMinutes',t.payable_minutes,'agreementEvidenceId',ec.id,'agreementEvidence',ec.evidence_reference,'officerUser',lo.owner_user_id,'clientUser',lc.owner_user_id,'expiresAt',min(e.review_due_at,w.review_due_at,ec.expires_at)) AS source_json
FROM shift_timesheets t JOIN shifts shift ON shift.id=t.shift_id AND shift.status IN ('completed','verified')
JOIN bookings b ON b.id=t.booking_id
JOIN workforce_engagements w ON w.id=t.workforce_engagement_id AND w.officer_id=t.officer_id AND w.employer_id=t.employer_id
JOIN workforce_employers e ON e.id=t.employer_id
JOIN employer_compliance_evidence ec ON ec.employer_id=e.id AND ec.control_code='service_agreement' AND ec.active_key=e.id||':service_agreement' AND ec.environment='production' AND ec.integrity_state='verified' AND ec.status='current'
JOIN production_entity_links lo ON lo.kind='officer' AND lo.entity_id=t.officer_id
JOIN production_entity_links lc ON lc.kind='client' AND lc.entity_id=b.client_id
WHERE t.environment='production' AND t.integrity_state='production_verified' AND t.workforce_model='partner' AND t.active_key=t.shift_id AND t.client_evidence_status='confirmed' AND t.operations_status='approved_for_backend' AND t.payable_minutes IS NOT NULL
AND w.environment='production' AND w.model='partner' AND w.status='active' AND w.active_key=w.officer_id AND e.environment='production' AND e.employer_type='partner_company' AND e.status='current' AND e.service_agreement_status='current'
AND min(e.review_due_at,w.review_due_at,ec.expires_at)>strftime('%Y-%m-%dT%H:%M:%fZ','now')
AND NOT EXISTS(SELECT 1 FROM pay_item_sources p WHERE p.timesheet_id=t.id AND p.active_key IS NOT NULL);
--> statement-breakpoint
CREATE VIEW production_partner_payable_current AS
SELECT r.*,d.decision,ex.created_at AS exported_at,h.note AS hold_note,
 CASE WHEN h.review_id IS NOT NULL THEN 'held' WHEN d.decision='rejected' THEN 'rejected'
 WHEN EXISTS(SELECT 1 FROM partner_payables p WHERE p.timesheet_id=r.timesheet_id AND p.id!='PP-'||r.id) THEN 'allocated_elsewhere'
 WHEN s.source_json IS NULL OR s.source_json!=r.source_json THEN 'source_changed'
 WHEN r.expires_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now') THEN 'expired'
 WHEN NOT EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=r.prepared_by AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=r.amount_cents AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active' AND g.role='operations_controller') THEN 'authority_changed'
 WHEN d.decision='approved' AND NOT EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=d.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=r.amount_cents AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active' AND g.role='finance_approver') THEN 'authority_changed'
 WHEN d.decision='approved' AND NOT EXISTS(SELECT 1 FROM partner_payables p WHERE p.id='PP-'||r.id) THEN 'allocation_incomplete'
 ELSE coalesce(d.decision,'pending') END AS status
FROM production_partner_payable_reviews r LEFT JOIN production_partner_payable_sources s ON s.timesheet_id=r.timesheet_id
LEFT JOIN production_partner_payable_decisions d ON d.review_id=r.id LEFT JOIN production_partner_payable_holds h ON h.review_id=r.id LEFT JOIN production_partner_payable_exports ex ON ex.review_id=r.id;
--> statement-breakpoint
CREATE TRIGGER partner_payable_review_insert BEFORE INSERT ON production_partner_payable_reviews BEGIN
 SELECT (CASE WHEN NEW.amount_cents<1 OR NEW.amount_cents>25000000 OR NEW.amount_cents IS NOT json_extract(NEW.payload_json,'$.totalCents') OR NEW.amount_cents IS NOT json_extract(NEW.payload_json,'$.netCents')+json_extract(NEW.payload_json,'$.taxCents')
 OR NEW.expires_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now') OR NEW.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now','+30 days')
 OR NOT EXISTS(SELECT 1 FROM production_partner_payable_sources s WHERE s.timesheet_id=NEW.timesheet_id AND s.employer_id=NEW.employer_id AND s.source_json=NEW.source_json AND NEW.prepared_user NOT IN (json_extract(s.source_json,'$.officerUser'),json_extract(s.source_json,'$.clientUser')) AND NEW.expires_at<=json_extract(s.source_json,'$.expiresAt'))
 OR EXISTS(SELECT 1 FROM partner_payables WHERE timesheet_id=NEW.timesheet_id)
 OR NOT EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=NEW.prepared_by AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=NEW.amount_cents AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active' AND g.role='operations_controller')
 THEN RAISE(ABORT,'Partner service, invoice or preparer authority changed') END);
END;
--> statement-breakpoint
CREATE TRIGGER partner_payable_decision_insert BEFORE INSERT ON production_partner_payable_decisions BEGIN
 SELECT (CASE WHEN NEW.decision NOT IN ('approved','rejected') OR NEW.auth_method NOT IN ('mfa_verified','owner_mfa_exception')
 OR NOT EXISTS(SELECT 1 FROM production_partner_payable_reviews r JOIN operator_accounts a ON a.id=NEW.operator_id JOIN operator_role_assignments g ON g.operator_id=a.id WHERE r.id=NEW.review_id AND r.payload_hash=NEW.payload_hash AND r.prepared_by!=NEW.operator_id AND r.prepared_user!=NEW.user_id AND NEW.user_id NOT IN (json_extract(r.source_json,'$.officerUser'),json_extract(r.source_json,'$.clientUser')) AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=r.amount_cents AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active' AND g.role='finance_approver')
 THEN RAISE(ABORT,'Independent partner finance review required') END);
 SELECT (CASE WHEN NEW.decision='approved' AND NOT EXISTS(SELECT 1 FROM production_partner_payable_current r WHERE r.id=NEW.review_id AND r.status='pending'
 AND NOT EXISTS(SELECT 1 FROM production_partner_payable_reviews other JOIN production_partner_payable_decisions od ON od.review_id=other.id AND od.decision='approved' WHERE other.employer_id=r.employer_id AND json_extract(other.payload_json,'$.invoiceNumber')=json_extract(r.payload_json,'$.invoiceNumber') AND json_extract(other.payload_json,'$.invoiceLine')=json_extract(r.payload_json,'$.invoiceLine')))
 THEN RAISE(ABORT,'Partner source, invoice allocation, expiry or hold changed') END);
END;
--> statement-breakpoint
CREATE TRIGGER partner_canonical_insert BEFORE INSERT ON partner_payables WHEN NEW.environment='production' BEGIN
 SELECT (CASE WHEN NEW.integrity_state!='production_verified' OR NEW.status!='approved_unpaid' OR NEW.remittance_reference IS NOT NULL
 OR NOT EXISTS(SELECT 1 FROM production_partner_payable_reviews r JOIN production_partner_payable_decisions d ON d.review_id=r.id AND d.decision='approved' WHERE NEW.id='PP-'||r.id AND NEW.timesheet_id=r.timesheet_id AND NEW.employer_id=r.employer_id AND NEW.amount_cents=r.amount_cents AND NEW.currency='ZAR' AND NEW.service_agreement_version=json_extract(r.payload_json,'$.agreementVersion'))
 THEN RAISE(ABORT,'Approved partner invoice evidence is required; release stays locked') END);
END;
--> statement-breakpoint
CREATE TRIGGER partner_canonical_update BEFORE UPDATE ON partner_payables WHEN OLD.environment='production' OR NEW.environment='production' BEGIN SELECT RAISE(ABORT,'Partner payable history and payment lock are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER partner_canonical_delete BEFORE DELETE ON partner_payables WHEN OLD.environment='production' BEGIN SELECT RAISE(ABORT,'Partner payable history is required'); END;

--> statement-breakpoint
CREATE TRIGGER production_partner_payable_holds_insert BEFORE INSERT ON production_partner_payable_holds BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM production_partner_payable_current r JOIN operator_accounts a ON a.id=NEW.operator_id JOIN operator_role_assignments g ON g.operator_id=a.id WHERE r.id=NEW.review_id AND NEW.user_id NOT IN (json_extract(r.source_json,'$.officerUser'),json_extract(r.source_json,'$.clientUser')) AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=r.amount_cents AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active' AND g.role='finance_approver' ) THEN RAISE(ABORT,'Partner payable or finance authority changed') END);
END;

--> statement-breakpoint
CREATE TRIGGER production_partner_payable_exports_insert BEFORE INSERT ON production_partner_payable_exports BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM production_partner_payable_current r JOIN operator_accounts a ON a.id=NEW.operator_id JOIN operator_role_assignments g ON g.operator_id=a.id WHERE r.id=NEW.review_id AND NEW.user_id NOT IN (json_extract(r.source_json,'$.officerUser'),json_extract(r.source_json,'$.clientUser')) AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=r.amount_cents AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active' AND g.role='finance_approver' AND r.status='approved' AND r.payload_hash=NEW.payload_hash) THEN RAISE(ABORT,'Partner payable or finance authority changed') END);
END;

--> statement-breakpoint
CREATE TRIGGER production_partner_payable_reviews_update BEFORE UPDATE ON production_partner_payable_reviews BEGIN SELECT RAISE(ABORT,'Partner review history is immutable'); END;

--> statement-breakpoint
CREATE TRIGGER production_partner_payable_reviews_delete BEFORE DELETE ON production_partner_payable_reviews BEGIN SELECT RAISE(ABORT,'Partner review history is immutable'); END;

--> statement-breakpoint
CREATE TRIGGER production_partner_payable_decisions_update BEFORE UPDATE ON production_partner_payable_decisions BEGIN SELECT RAISE(ABORT,'Partner review history is immutable'); END;

--> statement-breakpoint
CREATE TRIGGER production_partner_payable_decisions_delete BEFORE DELETE ON production_partner_payable_decisions BEGIN SELECT RAISE(ABORT,'Partner review history is immutable'); END;

--> statement-breakpoint
CREATE TRIGGER production_partner_payable_holds_update BEFORE UPDATE ON production_partner_payable_holds BEGIN SELECT RAISE(ABORT,'Partner review history is immutable'); END;

--> statement-breakpoint
CREATE TRIGGER production_partner_payable_holds_delete BEFORE DELETE ON production_partner_payable_holds BEGIN SELECT RAISE(ABORT,'Partner review history is immutable'); END;

--> statement-breakpoint
CREATE TRIGGER production_partner_payable_exports_update BEFORE UPDATE ON production_partner_payable_exports BEGIN SELECT RAISE(ABORT,'Partner review history is immutable'); END;

--> statement-breakpoint
CREATE TRIGGER production_partner_payable_exports_delete BEFORE DELETE ON production_partner_payable_exports BEGIN SELECT RAISE(ABORT,'Partner review history is immutable'); END;
