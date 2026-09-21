CREATE TABLE `booking_refund_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`request_key` text NOT NULL,
	`reference` text NOT NULL,
	`payload_json` text NOT NULL,
	`payload_hash` text NOT NULL,
	`operator_id` text NOT NULL,
	`user_id` text NOT NULL,
	`note` text NOT NULL,
	`auth_context` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`reference`) REFERENCES `booking_collection_requests`(`reference`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operator_id`) REFERENCES `operator_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "booking_refund_cases_check_0" CHECK(json_valid(payload_json)),
	CONSTRAINT "booking_refund_cases_check_1" CHECK(length(payload_hash)=64),
	CONSTRAINT "booking_refund_cases_check_2" CHECK(length(trim(note))>=3),
	CONSTRAINT "booking_refund_cases_check_3" CHECK(auth_context IN('mfa_verified','owner_mfa_exception'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `booking_refund_cases_request_key_idx` ON `booking_refund_cases` (`request_key`);--> statement-breakpoint
CREATE TABLE `booking_refund_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`reference` text NOT NULL,
	`operator_id` text NOT NULL,
	`user_id` text NOT NULL,
	`auth_context` text NOT NULL,
	`created_at` text NOT NULL,
	`hold_watermark` integer NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `booking_refund_cases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reference`) REFERENCES `booking_collection_requests`(`reference`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operator_id`) REFERENCES `operator_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "booking_refund_claims_check_0" CHECK(auth_context IN('mfa_verified','owner_mfa_exception')),
	CONSTRAINT "booking_refund_claims_check_1" CHECK(hold_watermark>=0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `booking_refund_claims_case_id_idx` ON `booking_refund_claims` (`case_id`);--> statement-breakpoint
CREATE TABLE `booking_refund_control` (
	`id` integer PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "booking_refund_control_check_0" CHECK(id=1),
	CONSTRAINT "booking_refund_control_check_1" CHECK(enabled IN(0,1))
);
--> statement-breakpoint
CREATE TABLE `booking_refund_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`payload_hash` text NOT NULL,
	`decision` text NOT NULL,
	`operator_id` text NOT NULL,
	`user_id` text NOT NULL,
	`note` text NOT NULL,
	`auth_context` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `booking_refund_cases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operator_id`) REFERENCES `operator_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "booking_refund_decisions_check_0" CHECK(decision IN('approved','rejected')),
	CONSTRAINT "booking_refund_decisions_check_1" CHECK(length(trim(note))>=3),
	CONSTRAINT "booking_refund_decisions_check_2" CHECK(auth_context IN('mfa_verified','owner_mfa_exception'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `booking_refund_decisions_case_id_idx` ON `booking_refund_decisions` (`case_id`);--> statement-breakpoint
CREATE TABLE `booking_refund_observations` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`source` text NOT NULL,
	`evidence_json` text NOT NULL,
	`hold_watermark` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `booking_refund_cases`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "booking_refund_observations_check_0" CHECK(source IN('initiate','verify')),
	CONSTRAINT "booking_refund_observations_check_1" CHECK(json_valid(evidence_json)),
	CONSTRAINT "booking_refund_observations_check_2" CHECK(typeof(hold_watermark)='integer' AND hold_watermark>=0)
);
--> statement-breakpoint
CREATE TABLE `booking_refund_receipt_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_id` text NOT NULL,
	`decision` text NOT NULL,
	`operator_id` text NOT NULL,
	`user_id` text NOT NULL,
	`note` text NOT NULL,
	`auth_context` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`receipt_id`) REFERENCES `booking_refund_receipts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operator_id`) REFERENCES `operator_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "booking_refund_receipt_decisions_check_0" CHECK(decision IN('approved','rejected')),
	CONSTRAINT "booking_refund_receipt_decisions_check_1" CHECK(length(trim(note))>=3),
	CONSTRAINT "booking_refund_receipt_decisions_check_2" CHECK(auth_context IN('mfa_verified','owner_mfa_exception'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `booking_refund_receipt_decisions_receipt_id_idx` ON `booking_refund_receipt_decisions` (`receipt_id`);--> statement-breakpoint
CREATE TABLE `booking_refund_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`observation_id` text NOT NULL,
	`bank_reference` text NOT NULL,
	`bank_hash` text NOT NULL,
	`bank_amount_minor` integer NOT NULL,
	`payload_json` text NOT NULL,
	`payload_hash` text NOT NULL,
	`operator_id` text NOT NULL,
	`user_id` text NOT NULL,
	`note` text NOT NULL,
	`auth_context` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `booking_refund_cases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`observation_id`) REFERENCES `booking_refund_observations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operator_id`) REFERENCES `operator_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "booking_refund_receipts_check_0" CHECK(length(bank_hash)=64),
	CONSTRAINT "booking_refund_receipts_check_1" CHECK(typeof(bank_amount_minor)='integer' AND bank_amount_minor>0),
	CONSTRAINT "booking_refund_receipts_check_2" CHECK(json_valid(payload_json)),
	CONSTRAINT "booking_refund_receipts_check_3" CHECK(length(payload_hash)=64),
	CONSTRAINT "booking_refund_receipts_check_4" CHECK(length(trim(note))>=3),
	CONSTRAINT "booking_refund_receipts_check_5" CHECK(auth_context IN('mfa_verified','owner_mfa_exception'))
);

--> statement-breakpoint
INSERT INTO booking_refund_control VALUES(1,0);
--> statement-breakpoint
CREATE VIEW booking_refund_sources AS SELECT r.reference,r.order_id,r.mode,r.amount_minor,r.provider_id,r.applicant_id,
 json_object('reference',r.reference,'providerId',r.provider_id,'mode',r.mode,'amountMinor',r.amount_minor,'sourceHash',r.source_hash,'revision',r.revision,'state',r.state,
 'bookingStatus',b.status,'fundingStatus',b.funding_status,
 'holds',json((SELECT json_group_array(json_object('id',id,'hash',payload_hash)) FROM (SELECT * FROM booking_collection_recoveries WHERE reference=r.reference ORDER BY rowid))),
 'funding',json((SELECT json_group_array(json_object('id',id,'version',version,'status',status,'amount',cleared_amount_cents)) FROM (SELECT * FROM booking_funding_reconciliations WHERE booking_id=r.order_id ORDER BY id))),
 'payroll',json((SELECT json_group_array(json_object('id',id,'run',payroll_run_id,'status',status,'gross',gross_wage_cents,'net',net_pay_cents,'updated',updated_at)) FROM (SELECT * FROM payroll_items WHERE officer_id IN(SELECT officer_id FROM shifts WHERE booking_id=r.order_id) ORDER BY id))),
 'payrollRuns',json((SELECT json_group_array(json_object('id',id,'status',status,'version',version,'net',net_pay_cents)) FROM (SELECT * FROM payroll_runs WHERE id IN(SELECT payroll_run_id FROM payroll_items WHERE officer_id IN(SELECT officer_id FROM shifts WHERE booking_id=r.order_id)) ORDER BY id))),
 'partnerLiabilities',json((SELECT json_group_array(json_object('id',id,'status',status,'amount',amount_cents,'updated',updated_at)) FROM (SELECT * FROM partner_payables WHERE timesheet_id IN(SELECT id FROM shift_timesheets WHERE booking_id=r.order_id) ORDER BY id))),
 'timesheets',json((SELECT json_group_array(json_object('id',id,'evidence',evidence_hash,'status',operations_status,'payable',payable_minutes,'active',active_key)) FROM (SELECT * FROM shift_timesheets WHERE booking_id=r.order_id ORDER BY id))),
 'shifts',json((SELECT json_group_array(json_object('id',id,'status',status,'in',check_in_at,'out',check_out_at,'signoff',client_signoff_status,'earnings',earnings_cents)) FROM (SELECT * FROM shifts WHERE booking_id=r.order_id ORDER BY id)))) AS source_json
 FROM booking_collection_requests r JOIN bookings b ON b.id=r.order_id;
--> statement-breakpoint
CREATE TRIGGER booking_refund_case_guard BEFORE INSERT ON booking_refund_cases BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM booking_refund_sources s WHERE s.reference=NEW.reference AND s.provider_id IS NOT NULL AND json_extract(NEW.payload_json,'$.source')=s.source_json AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=NEW.operator_id AND a.status='active' AND a.environment='production' AND a.integrity_state='production_verified' AND a.approval_limit_cents>=s.amount_minor AND g.role='funding_reconciler' AND g.status='active' AND g.environment='production' AND g.integrity_state='production_verified') AND NEW.user_id<>s.applicant_id AND EXISTS(SELECT 1 FROM booking_collection_recoveries WHERE reference=s.reference) AND NEW.expires_at>NEW.created_at AND julianday(NEW.expires_at)-julianday(NEW.created_at)<=0.021 AND NEW.created_at>=strftime('%Y-%m-%dT%H:%M:%fZ','now','-5 minutes') AND NEW.created_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now','+1 seconds') AND json_extract(NEW.payload_json,'$.amountMinor') BETWEEN 1 AND s.amount_minor AND typeof(json_extract(NEW.payload_json,'$.amountMinor'))='integer' AND json_extract(NEW.payload_json,'$.mode')=s.mode AND json_extract(NEW.payload_json,'$.reference')=s.reference AND json_extract(NEW.payload_json,'$.providerId')=s.provider_id AND (json_extract(NEW.payload_json,'$.intent')='investigate' OR EXISTS(SELECT 1 FROM credit_notes cr JOIN credit_note_issues ci ON ci.credit_id=cr.id JOIN credit_note_sources cs ON cs.invoice_id=cr.invoice_id WHERE cr.id=json_extract(NEW.payload_json,'$.creditNoteId') AND cs.booking_id=s.order_id AND cr.direction=1 AND cr.net_cents+cr.tax_cents=json_extract(NEW.payload_json,'$.amountMinor') AND NOT EXISTS(SELECT 1 FROM credit_notes v JOIN credit_note_issues vi ON vi.credit_id=v.id WHERE v.reverses_id=cr.id)))) THEN RAISE(ABORT,'Refund source, hold or authority changed') END);
END;
--> statement-breakpoint
CREATE TRIGGER booking_refund_decision_guard BEFORE INSERT ON booking_refund_decisions BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM booking_refund_cases c JOIN booking_refund_sources s ON s.reference=c.reference WHERE c.id=NEW.case_id AND c.operator_id<>NEW.operator_id AND c.user_id<>NEW.user_id AND c.payload_hash=NEW.payload_hash AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=NEW.operator_id AND a.status='active' AND a.environment='production' AND a.integrity_state='production_verified' AND a.approval_limit_cents>=s.amount_minor AND g.role='funding_reconciler' AND g.status='active' AND g.environment='production' AND g.integrity_state='production_verified') AND NEW.user_id<>s.applicant_id AND (NEW.decision='rejected' OR (c.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now') AND json_extract(c.payload_json,'$.source')=s.source_json AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=c.operator_id AND a.status='active' AND a.environment='production' AND a.integrity_state='production_verified' AND a.approval_limit_cents>=s.amount_minor AND g.role='funding_reconciler' AND g.status='active' AND g.environment='production' AND g.integrity_state='production_verified') AND c.user_id<>s.applicant_id))) THEN RAISE(ABORT,'Independent current refund approval required') END);
END;
--> statement-breakpoint
CREATE VIEW booking_refund_authorized AS SELECT c.* FROM booking_refund_cases c JOIN booking_refund_sources s ON s.reference=c.reference JOIN booking_refund_decisions d ON d.case_id=c.id AND d.decision='approved'
 WHERE c.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now') AND json_extract(c.payload_json,'$.source')=s.source_json AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=c.operator_id AND a.status='active' AND a.environment='production' AND a.integrity_state='production_verified' AND a.approval_limit_cents>=s.amount_minor AND g.role='funding_reconciler' AND g.status='active' AND g.environment='production' AND g.integrity_state='production_verified') AND c.user_id<>s.applicant_id AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=d.operator_id AND a.status='active' AND a.environment='production' AND a.integrity_state='production_verified' AND a.approval_limit_cents>=s.amount_minor AND g.role='funding_reconciler' AND g.status='active' AND g.environment='production' AND g.integrity_state='production_verified') AND d.user_id<>s.applicant_id;
--> statement-breakpoint
CREATE TRIGGER booking_refund_claim_guard BEFORE INSERT ON booking_refund_claims BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM booking_refund_authorized c JOIN booking_refund_sources s ON s.reference=c.reference WHERE c.id=NEW.case_id AND c.reference=NEW.reference AND c.operator_id<>NEW.operator_id AND c.user_id<>NEW.user_id AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=NEW.operator_id AND a.status='active' AND a.environment='production' AND a.integrity_state='production_verified' AND a.approval_limit_cents>=s.amount_minor AND g.role='funding_reconciler' AND g.status='active' AND g.environment='production' AND g.integrity_state='production_verified') AND NEW.user_id<>s.applicant_id AND (json_extract(c.payload_json,'$.externalRefundId') IS NOT NULL OR s.mode='test' OR ((SELECT enabled FROM booking_refund_control WHERE id=1)=1 AND (SELECT enabled FROM payment_live_control WHERE id=1)=1)) AND json_extract(c.payload_json,'$.intent')='refund' AND NEW.hold_watermark= CASE WHEN json_extract(c.payload_json,'$.externalRefundId') IS NOT NULL THEN 0 ELSE (SELECT count(*) FROM booking_collection_recoveries WHERE reference=s.reference) END AND NOT EXISTS(SELECT 1 FROM credit_notes v JOIN credit_note_issues vi ON vi.credit_id=v.id WHERE v.reverses_id=json_extract(c.payload_json,'$.creditNoteId'))
 AND NOT EXISTS(SELECT 1 FROM booking_refund_claims k JOIN booking_refund_cases old ON old.id=k.case_id WHERE json_extract(old.payload_json,'$.creditNoteId')=json_extract(c.payload_json,'$.creditNoteId'))
 AND NOT EXISTS(SELECT 1 FROM booking_refund_claims k JOIN booking_refund_cases old ON old.id=k.case_id WHERE json_extract(c.payload_json,'$.externalRefundId') IS NOT NULL AND json_extract(old.payload_json,'$.externalRefundId')=json_extract(c.payload_json,'$.externalRefundId') AND json_extract(old.payload_json,'$.mode')=s.mode)
 AND json_extract(c.payload_json,'$.amountMinor')+coalesce((SELECT sum(json_extract(old.payload_json,'$.amountMinor')) FROM booking_refund_claims k JOIN booking_refund_cases old ON old.id=k.case_id WHERE k.reference=s.reference),0)<=s.amount_minor
 AND NOT EXISTS(SELECT 1 FROM booking_refund_claims k WHERE k.reference=s.reference AND NOT EXISTS(SELECT 1 FROM booking_refund_receipts r JOIN booking_refund_receipt_decisions d ON d.receipt_id=r.id AND d.decision='approved' WHERE r.case_id=k.case_id))
 AND (json_extract(c.payload_json,'$.externalRefundId') IS NOT NULL OR NOT EXISTS(SELECT 1 FROM booking_collection_recoveries h WHERE h.reference=s.reference AND h.source='webhook' AND NOT EXISTS(SELECT 1 FROM booking_refund_receipts r JOIN booking_refund_cases old ON old.id=r.case_id JOIN booking_refund_receipt_decisions d ON d.receipt_id=r.id AND d.decision='approved' JOIN booking_refund_observations o ON o.id=r.observation_id WHERE old.reference=s.reference AND h.rowid<=(SELECT max(rowid) FROM booking_collection_recoveries x WHERE x.reference=s.reference AND (SELECT count(*) FROM booking_collection_recoveries z WHERE z.reference=s.reference AND z.rowid<=x.rowid)<=o.hold_watermark))))) THEN RAISE(ABORT,'Refund dispatch is locked or approval changed') END);
END;
--> statement-breakpoint
CREATE TRIGGER booking_refund_observation_guard BEFORE INSERT ON booking_refund_observations BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM booking_refund_claims WHERE case_id=NEW.case_id) THEN RAISE(ABORT,'Original refund claim required') END);
END;
--> statement-breakpoint
CREATE VIEW booking_refund_final_evidence AS SELECT o.*,c.reference,c.operator_id AS maker_operator,c.user_id AS maker_user,
 s.mode,json_extract(c.payload_json,'$.amountMinor') AS amount_minor,json_extract(o.evidence_json,'$.id') AS provider_refund_id,(SELECT e.signed_event_id FROM booking_refund_matching_events e WHERE e.observation_id=o.id ORDER BY e.event_order LIMIT 1) AS signed_event_id,(SELECT e.signed_event_hash FROM booking_refund_matching_events e WHERE e.observation_id=o.id ORDER BY e.event_order LIMIT 1) AS signed_event_hash
 FROM booking_refund_observations o JOIN booking_refund_cases c ON c.id=o.case_id JOIN booking_refund_sources s ON s.reference=c.reference JOIN booking_refund_claims k ON k.case_id=c.id
 WHERE (SELECT count(*) FROM booking_refund_observations WHERE case_id=c.id)<=500 AND o.source='verify' AND o.rowid=(SELECT max(rowid) FROM booking_refund_observations WHERE case_id=c.id)
 AND o.created_at>=strftime('%Y-%m-%dT%H:%M:%fZ','now','-5 minutes') AND o.created_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now','+1 seconds')
 AND o.hold_watermark=(SELECT count(*) FROM booking_collection_recoveries WHERE reference=c.reference)
 AND json_extract(o.evidence_json,'$.status')='processed' AND json_extract(o.evidence_json,'$.fullyDeducted')=1 AND json_extract(o.evidence_json,'$.deductedAmount')=json_extract(c.payload_json,'$.amountMinor')
 AND json_extract(o.evidence_json,'$.transactionId')=s.provider_id AND json_extract(o.evidence_json,'$.mode')=s.mode AND json_extract(o.evidence_json,'$.amountMinor')=json_extract(c.payload_json,'$.amountMinor') AND json_extract(o.evidence_json,'$.currency')='ZAR'
 AND (json_extract(o.evidence_json,'$.merchantNote')=c.id OR json_extract(c.payload_json,'$.externalRefundId')=json_extract(o.evidence_json,'$.id'))
 AND (SELECT count(*) FROM booking_refund_matching_events e WHERE e.observation_id=o.id)=1

 AND NOT EXISTS(SELECT 1 FROM booking_refund_observations old WHERE old.case_id=c.id AND (json_type(old.evidence_json)='null' OR json_extract(old.evidence_json,'$.id') IS NOT json_extract(o.evidence_json,'$.id') OR json_extract(old.evidence_json,'$.integrationId') IS NOT json_extract(o.evidence_json,'$.integrationId') OR json_extract(old.evidence_json,'$.transactionId') IS NOT s.provider_id OR json_extract(old.evidence_json,'$.amountMinor') IS NOT json_extract(c.payload_json,'$.amountMinor') OR json_extract(old.evidence_json,'$.mode') IS NOT s.mode OR json_extract(old.evidence_json,'$.currency') IS NOT 'ZAR' OR (json_extract(old.evidence_json,'$.merchantNote') IS NOT c.id AND json_extract(c.payload_json,'$.externalRefundId') IS NOT json_extract(o.evidence_json,'$.id')) OR json_extract(old.evidence_json,'$.status') NOT IN('pending','processing','processed')))
 AND NOT EXISTS(SELECT 1 FROM booking_collection_recoveries terminal JOIN booking_collection_recoveries later ON later.reference=terminal.reference AND later.rowid>terminal.rowid WHERE terminal.reference=c.reference AND terminal.source='webhook' AND terminal.event='refund.processed' AND (SELECT count(*) FROM booking_collection_recoveries prev WHERE prev.reference=c.reference AND prev.rowid<=terminal.rowid)>k.hold_watermark AND later.source='webhook' AND later.event<>'refund.processed')
 AND NOT EXISTS(SELECT 1 FROM booking_refund_observations terminal JOIN booking_refund_observations later ON later.case_id=terminal.case_id AND later.rowid>terminal.rowid WHERE terminal.case_id=c.id AND json_extract(terminal.evidence_json,'$.status')='processed' AND json_extract(later.evidence_json,'$.status')<>'processed')
 AND NOT EXISTS(SELECT 1 FROM booking_collection_recoveries h WHERE h.reference=c.reference AND (SELECT count(*) FROM booking_collection_recoveries prev WHERE prev.reference=c.reference AND prev.rowid<=h.rowid)>k.hold_watermark AND h.source='webhook' AND NOT (h.event IN('refund.pending','refund.processing','refund.processed') AND coalesce(
 (json_extract(h.detail,'$.refund.id')=json_extract(o.evidence_json,'$.id') AND json_extract(h.detail,'$.refund.transactionId')=s.provider_id AND json_extract(h.detail,'$.refund.integrationId')=json_extract(o.evidence_json,'$.integrationId') AND json_extract(h.detail,'$.refund.amountMinor')=json_extract(c.payload_json,'$.amountMinor') AND json_extract(h.detail,'$.refund.mode')=s.mode AND json_extract(h.detail,'$.refund.currency')='ZAR' AND h.event='refund.'||json_extract(h.detail,'$.refund.status')) OR
 (json_extract(h.detail,'$.refundEvent.transactionReference')=s.reference AND json_extract(h.detail,'$.refundEvent.integrationId')=json_extract(o.evidence_json,'$.integrationId') AND json_extract(h.detail,'$.refundEvent.amountMinor')=json_extract(c.payload_json,'$.amountMinor') AND json_extract(h.detail,'$.refundEvent.mode')=s.mode AND h.event='refund.'||json_extract(h.detail,'$.refundEvent.status')),0)));
--> statement-breakpoint
CREATE TRIGGER booking_refund_receipt_guard BEFORE INSERT ON booking_refund_receipts BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM booking_refund_final_evidence e JOIN booking_refund_sources s ON s.reference=e.reference WHERE e.case_id=NEW.case_id AND e.id=NEW.observation_id AND NEW.bank_amount_minor=e.amount_minor AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=NEW.operator_id AND a.status='active' AND a.environment='production' AND a.integrity_state='production_verified' AND a.approval_limit_cents>=s.amount_minor AND g.role='funding_reconciler' AND g.status='active' AND g.environment='production' AND g.integrity_state='production_verified') AND NEW.user_id<>s.applicant_id AND json_extract(NEW.payload_json,'$.source')=s.source_json AND json_extract(NEW.payload_json,'$.observationId')=NEW.observation_id AND json_extract(NEW.payload_json,'$.bankReference')=NEW.bank_reference AND json_extract(NEW.payload_json,'$.bankHash')=NEW.bank_hash AND json_extract(NEW.payload_json,'$.bankAmountMinor')=NEW.bank_amount_minor) THEN RAISE(ABORT,'Refund final evidence is missing stale or contradictory') END);
END;
--> statement-breakpoint
CREATE TRIGGER booking_refund_receipt_decision_guard BEFORE INSERT ON booking_refund_receipt_decisions BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM booking_refund_receipts r JOIN booking_refund_cases c ON c.id=r.case_id JOIN booking_refund_sources s ON s.reference=c.reference WHERE r.id=NEW.receipt_id AND r.operator_id<>NEW.operator_id AND r.user_id<>NEW.user_id AND c.operator_id<>NEW.operator_id AND c.user_id<>NEW.user_id AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=NEW.operator_id AND a.status='active' AND a.environment='production' AND a.integrity_state='production_verified' AND a.approval_limit_cents>=s.amount_minor AND g.role='funding_reconciler' AND g.status='active' AND g.environment='production' AND g.integrity_state='production_verified') AND NEW.user_id<>s.applicant_id AND (NEW.decision='rejected' OR (EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=r.operator_id AND a.status='active' AND a.environment='production' AND a.integrity_state='production_verified' AND a.approval_limit_cents>=s.amount_minor AND g.role='funding_reconciler' AND g.status='active' AND g.environment='production' AND g.integrity_state='production_verified') AND r.user_id<>s.applicant_id AND json_extract(r.payload_json,'$.source')=s.source_json AND EXISTS(SELECT 1 FROM booking_refund_final_evidence WHERE id=r.observation_id)))) THEN RAISE(ABORT,'Independent current refund receipt approval required') END);
 SELECT (CASE WHEN NEW.decision='approved' AND EXISTS(SELECT 1 FROM booking_refund_receipts r JOIN booking_refund_observations o ON o.id=r.observation_id JOIN booking_refund_observations prior ON json_extract(prior.evidence_json,'$.id')=json_extract(o.evidence_json,'$.id') AND json_extract(prior.evidence_json,'$.integrationId')=json_extract(o.evidence_json,'$.integrationId') AND json_extract(prior.evidence_json,'$.mode')=json_extract(o.evidence_json,'$.mode') JOIN booking_refund_receipts old ON old.observation_id=prior.id JOIN booking_refund_receipt_decisions d ON d.receipt_id=old.id AND d.decision='approved' WHERE r.id=NEW.receipt_id) THEN RAISE(ABORT,'Provider refund already reconciled') END);
 SELECT (CASE WHEN NEW.decision='approved' AND EXISTS(SELECT 1 FROM booking_refund_receipts r JOIN booking_refund_receipts old ON old.case_id=r.case_id OR old.bank_reference=r.bank_reference OR old.bank_hash=r.bank_hash JOIN booking_refund_receipt_decisions d ON d.receipt_id=old.id AND d.decision='approved' WHERE r.id=NEW.receipt_id) THEN RAISE(ABORT,'Refund or bank proof already reconciled') END);
END;
--> statement-breakpoint
CREATE VIEW booking_refund_accounting AS SELECT s.reference,s.order_id,s.mode,s.amount_minor,
 coalesce((SELECT sum(r.bank_amount_minor) FROM booking_refund_receipts r JOIN booking_refund_cases c ON c.id=r.case_id JOIN booking_refund_receipt_decisions d ON d.receipt_id=r.id AND d.decision='approved' WHERE c.reference=s.reference),0) AS reconciled_minor,
 CASE WHEN EXISTS(SELECT 1 FROM booking_refund_claims k WHERE k.reference=s.reference AND NOT EXISTS(SELECT 1 FROM booking_refund_receipts r JOIN booking_refund_receipt_decisions d ON d.receipt_id=r.id AND d.decision='approved' WHERE r.case_id=k.case_id))
 OR EXISTS(SELECT 1 FROM booking_refund_receipts r JOIN booking_refund_cases c ON c.id=r.case_id JOIN booking_refund_receipt_decisions d ON d.receipt_id=r.id AND d.decision='approved' JOIN booking_refund_observations o ON o.id=r.observation_id JOIN booking_refund_observations later ON later.case_id=c.id AND later.rowid>o.rowid WHERE c.reference=s.reference AND later.evidence_json<>o.evidence_json)
 OR EXISTS(SELECT 1 FROM booking_collection_recoveries h WHERE h.reference=s.reference AND (h.source='webhook' OR h.event<>'refund_investigation') AND NOT EXISTS(SELECT 1 FROM booking_refund_receipts r JOIN booking_refund_cases c ON c.id=r.case_id JOIN booking_refund_receipt_decisions d ON d.receipt_id=r.id AND d.decision='approved' JOIN booking_refund_observations o ON o.id=r.observation_id WHERE c.reference=s.reference AND (SELECT count(*) FROM booking_collection_recoveries prev WHERE prev.reference=s.reference AND prev.rowid<=h.rowid)<=o.hold_watermark)) THEN 1 ELSE 0 END AS currently_held
 FROM booking_refund_sources s;
--> statement-breakpoint
CREATE VIEW booking_refund_state AS SELECT a.*,CASE WHEN currently_held=1 THEN CASE WHEN reconciled_minor>0 THEN 'reconciled_history_currently_held' ELSE 'refund_claimed_held' END WHEN reconciled_minor=0 THEN 'investigation_held' WHEN mode='test' THEN 'test_refund_confirmed' WHEN reconciled_minor=amount_minor THEN 'refunded_funding_held' ELSE 'partially_refunded_funding_held' END AS state,0 AS funding_available,0 AS liabilities_cancelled FROM booking_refund_accounting a WHERE EXISTS(SELECT 1 FROM booking_collection_recoveries WHERE reference=a.reference);
--> statement-breakpoint
CREATE TRIGGER booking_refund_current_claim BEFORE INSERT ON booking_refund_claims BEGIN SELECT (CASE WHEN EXISTS(SELECT 1 FROM booking_refund_accounting WHERE reference=NEW.reference AND currently_held=1 AND (EXISTS(SELECT 1 FROM booking_refund_claims WHERE reference=NEW.reference) OR NOT EXISTS(SELECT 1 FROM booking_refund_cases WHERE id=NEW.case_id AND json_extract(payload_json,'$.externalRefundId') IS NOT NULL))) THEN RAISE(ABORT,'Prior refund or dispute remains held') END); END;
--> statement-breakpoint
DROP VIEW document_invoice_payment_states;
--> statement-breakpoint
CREATE VIEW document_invoice_payment_states AS SELECT i.id AS source_id,r.reference,r.mode,r.state AS status,r.reference AS active_key,
 CASE WHEN r.mode='live' AND EXISTS(SELECT 1 FROM booking_refund_accounting a WHERE a.reference=r.reference AND a.reconciled_minor=a.amount_minor AND a.currently_held=0) THEN 'reversed' WHEN EXISTS(SELECT 1 FROM booking_collection_recoveries WHERE reference=r.reference) OR EXISTS(SELECT 1 FROM booking_funding_reconciliations WHERE provider_reference=r.reference AND status='held') THEN 'held'
 WHEN r.mode='live' AND EXISTS(SELECT 1 FROM booking_funding_reconciliations f JOIN booking_settlement_reviews s ON f.evidence_reference='settlement-review:'||s.id JOIN booking_settlement_decisions d ON d.review_id=s.id AND d.decision='cleared_live' WHERE f.provider_reference=r.reference AND f.booking_id=i.booking_id AND f.status='cleared_reconciled' AND f.cleared_amount_cents=i.total_cents) THEN 'paid'
 WHEN r.mode='live' AND r.state NOT IN('prepared','approved') THEN 'pending' ELSE 'unpaid' END AS state
 FROM client_invoices i JOIN booking_collection_requests r ON r.order_id=i.booking_id;
--> statement-breakpoint
CREATE TRIGGER credit_refund_claim_guard BEFORE INSERT ON credit_note_decisions WHEN NEW.decision='approved' BEGIN SELECT (CASE WHEN EXISTS(SELECT 1 FROM credit_notes c JOIN booking_refund_cases r ON json_extract(r.payload_json,'$.creditNoteId')=c.reverses_id JOIN booking_refund_claims k ON k.case_id=r.id WHERE c.id=NEW.credit_id) THEN RAISE(ABORT,'Claimed refund credit cannot be reversed or reused') END); END;
--> statement-breakpoint
CREATE TRIGGER booking_refund_cases_no_update BEFORE UPDATE ON booking_refund_cases BEGIN SELECT RAISE(ABORT,'Refund history is immutable and required'); END;
--> statement-breakpoint
CREATE TRIGGER booking_refund_cases_no_delete BEFORE DELETE ON booking_refund_cases BEGIN SELECT RAISE(ABORT,'Refund history is immutable and required'); END;
--> statement-breakpoint
CREATE TRIGGER booking_refund_decisions_no_update BEFORE UPDATE ON booking_refund_decisions BEGIN SELECT RAISE(ABORT,'Refund history is immutable and required'); END;
--> statement-breakpoint
CREATE TRIGGER booking_refund_decisions_no_delete BEFORE DELETE ON booking_refund_decisions BEGIN SELECT RAISE(ABORT,'Refund history is immutable and required'); END;
--> statement-breakpoint
CREATE TRIGGER booking_refund_claims_no_update BEFORE UPDATE ON booking_refund_claims BEGIN SELECT RAISE(ABORT,'Refund history is immutable and required'); END;
--> statement-breakpoint
CREATE TRIGGER booking_refund_claims_no_delete BEFORE DELETE ON booking_refund_claims BEGIN SELECT RAISE(ABORT,'Refund history is immutable and required'); END;
--> statement-breakpoint
CREATE TRIGGER booking_refund_observations_no_update BEFORE UPDATE ON booking_refund_observations BEGIN SELECT RAISE(ABORT,'Refund history is immutable and required'); END;
--> statement-breakpoint
CREATE TRIGGER booking_refund_observations_no_delete BEFORE DELETE ON booking_refund_observations BEGIN SELECT RAISE(ABORT,'Refund history is immutable and required'); END;
--> statement-breakpoint
CREATE TRIGGER booking_refund_receipts_no_update BEFORE UPDATE ON booking_refund_receipts BEGIN SELECT RAISE(ABORT,'Refund history is immutable and required'); END;
--> statement-breakpoint
CREATE TRIGGER booking_refund_receipts_no_delete BEFORE DELETE ON booking_refund_receipts BEGIN SELECT RAISE(ABORT,'Refund history is immutable and required'); END;
--> statement-breakpoint
CREATE TRIGGER booking_refund_receipt_decisions_no_update BEFORE UPDATE ON booking_refund_receipt_decisions BEGIN SELECT RAISE(ABORT,'Refund history is immutable and required'); END;
--> statement-breakpoint
CREATE TRIGGER booking_refund_receipt_decisions_no_delete BEFORE DELETE ON booking_refund_receipt_decisions BEGIN SELECT RAISE(ABORT,'Refund history is immutable and required'); END;
--> statement-breakpoint
CREATE VIEW booking_refund_matching_events AS SELECT o.id AS observation_id,h.id AS signed_event_id,h.payload_hash AS signed_event_hash,h.rowid AS event_order
 FROM booking_refund_observations o JOIN booking_refund_cases c ON c.id=o.case_id JOIN booking_refund_sources s ON s.reference=c.reference JOIN booking_refund_claims k ON k.case_id=c.id JOIN booking_collection_recoveries h ON h.reference=c.reference
 WHERE h.reference=c.reference AND h.source='webhook' AND h.event='refund.processed' AND (SELECT count(*) FROM booking_collection_recoveries prev WHERE prev.reference=c.reference AND prev.rowid<=h.rowid)>k.hold_watermark AND (
 (json_extract(h.detail,'$.refund.id')=json_extract(o.evidence_json,'$.id') AND json_extract(h.detail,'$.refund.transactionId')=s.provider_id AND json_extract(h.detail,'$.refund.integrationId')=json_extract(o.evidence_json,'$.integrationId') AND json_extract(h.detail,'$.refund.mode')=s.mode AND json_extract(h.detail,'$.refund.amountMinor')=json_extract(c.payload_json,'$.amountMinor') AND json_extract(h.detail,'$.refund.currency')='ZAR' AND (json_extract(h.detail,'$.refund.merchantNote')=c.id OR json_extract(c.payload_json,'$.externalRefundId')=json_extract(o.evidence_json,'$.id')) AND json_extract(h.detail,'$.refund.status')='processed')
 OR (json_extract(h.detail,'$.refundEvent.transactionReference')=s.reference AND json_extract(h.detail,'$.refundEvent.integrationId')=json_extract(o.evidence_json,'$.integrationId') AND json_extract(h.detail,'$.refundEvent.mode')=s.mode AND json_extract(h.detail,'$.refundEvent.amountMinor')=json_extract(c.payload_json,'$.amountMinor') AND json_extract(h.detail,'$.refundEvent.status')='processed')) AND NOT EXISTS(SELECT 1 FROM booking_refund_receipts used JOIN booking_refund_receipt_decisions decision ON decision.receipt_id=used.id AND decision.decision='approved' WHERE json_extract(used.payload_json,'$.signedEventId')=h.id AND used.case_id<>c.id);
--> statement-breakpoint
CREATE TRIGGER booking_refund_receipt_event_guard BEFORE INSERT ON booking_refund_receipts WHEN NOT EXISTS(SELECT 1 FROM booking_refund_final_evidence e WHERE e.id=NEW.observation_id AND e.case_id=NEW.case_id AND e.signed_event_id=json_extract(NEW.payload_json,'$.signedEventId') AND e.signed_event_hash=json_extract(NEW.payload_json,'$.signedEventHash')) BEGIN SELECT RAISE(ABORT,'Exact unconsumed signed refund event required'); END;
--> statement-breakpoint
CREATE TRIGGER booking_refund_receipt_event_decision BEFORE INSERT ON booking_refund_receipt_decisions WHEN NEW.decision='approved' BEGIN
 SELECT (CASE WHEN EXISTS(SELECT 1 FROM booking_refund_receipts r JOIN booking_refund_receipts prior ON json_extract(prior.payload_json,'$.signedEventId')=json_extract(r.payload_json,'$.signedEventId') JOIN booking_refund_receipt_decisions d ON d.receipt_id=prior.id AND d.decision='approved' WHERE r.id=NEW.receipt_id) THEN RAISE(ABORT,'Signed refund event already reconciled') END);
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM booking_refund_receipts r JOIN booking_refund_final_evidence e ON e.id=r.observation_id AND e.signed_event_id=json_extract(r.payload_json,'$.signedEventId') AND e.signed_event_hash=json_extract(r.payload_json,'$.signedEventHash') WHERE r.id=NEW.receipt_id) THEN RAISE(ABORT,'Signed refund event changed or consumed') END);
END;
--> statement-breakpoint
CREATE TRIGGER booking_refund_cases_no_replace BEFORE INSERT ON booking_refund_cases WHEN EXISTS(SELECT 1 FROM booking_refund_cases WHERE id=NEW.id OR request_key=NEW.request_key) BEGIN SELECT RAISE(ABORT,'Refund history is immutable and required'); END;
--> statement-breakpoint
CREATE TRIGGER booking_refund_decisions_no_replace BEFORE INSERT ON booking_refund_decisions WHEN EXISTS(SELECT 1 FROM booking_refund_decisions WHERE id=NEW.id OR case_id=NEW.case_id) BEGIN SELECT RAISE(ABORT,'Refund history is immutable and required'); END;
--> statement-breakpoint
CREATE TRIGGER booking_refund_claims_no_replace BEFORE INSERT ON booking_refund_claims WHEN EXISTS(SELECT 1 FROM booking_refund_claims WHERE id=NEW.id OR case_id=NEW.case_id) BEGIN SELECT RAISE(ABORT,'Refund history is immutable and required'); END;
--> statement-breakpoint
CREATE TRIGGER booking_refund_observations_no_replace BEFORE INSERT ON booking_refund_observations WHEN EXISTS(SELECT 1 FROM booking_refund_observations WHERE id=NEW.id) BEGIN SELECT RAISE(ABORT,'Refund history is immutable and required'); END;
--> statement-breakpoint
CREATE TRIGGER booking_refund_receipts_no_replace BEFORE INSERT ON booking_refund_receipts WHEN EXISTS(SELECT 1 FROM booking_refund_receipts WHERE id=NEW.id) BEGIN SELECT RAISE(ABORT,'Refund history is immutable and required'); END;
--> statement-breakpoint
CREATE TRIGGER booking_refund_receipt_decisions_no_replace BEFORE INSERT ON booking_refund_receipt_decisions WHEN EXISTS(SELECT 1 FROM booking_refund_receipt_decisions WHERE id=NEW.id OR receipt_id=NEW.receipt_id) BEGIN SELECT RAISE(ABORT,'Refund history is immutable and required'); END;

--> statement-breakpoint
CREATE TRIGGER booking_collection_recoveries_preserve_identity BEFORE INSERT ON booking_collection_recoveries WHEN EXISTS(SELECT 1 FROM booking_collection_recoveries WHERE id=NEW.id OR (reference=NEW.reference AND source=NEW.source AND payload_hash=NEW.payload_hash)) BEGIN
 SELECT (CASE WHEN EXISTS(SELECT 1 FROM booking_collection_recoveries WHERE (id=NEW.id OR (reference=NEW.reference AND source=NEW.source AND payload_hash=NEW.payload_hash)) AND NOT (reference IS NEW.reference AND source IS NEW.source AND event IS NEW.event AND payload_hash IS NEW.payload_hash AND detail IS NEW.detail AND actor_id IS NEW.actor_id)) THEN RAISE(ABORT,'Recovery event history is immutable') END);
 SELECT RAISE(IGNORE);
END;
--> statement-breakpoint
CREATE TRIGGER booking_provider_recovery_inbox_preserve_identity BEFORE INSERT ON booking_provider_recovery_inbox WHEN EXISTS(SELECT 1 FROM booking_provider_recovery_inbox WHERE id=NEW.id OR (mode=NEW.mode AND payload_hash=NEW.payload_hash)) BEGIN
 SELECT (CASE WHEN EXISTS(SELECT 1 FROM booking_provider_recovery_inbox WHERE (id=NEW.id OR (mode=NEW.mode AND payload_hash=NEW.payload_hash)) AND NOT (mode IS NEW.mode AND provider_id IS NEW.provider_id AND transaction_reference IS NEW.transaction_reference AND event IS NEW.event AND payload_hash IS NEW.payload_hash AND detail IS NEW.detail)) THEN RAISE(ABORT,'Recovery event history is immutable') END);
 SELECT RAISE(IGNORE);
END;
