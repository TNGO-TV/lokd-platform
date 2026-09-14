CREATE TABLE `payment_live_claims` (
	`kind` text NOT NULL,
	`reference` text NOT NULL,
	`release_id` text NOT NULL,
	`version` integer NOT NULL,
	`source_hash` text NOT NULL,
	`recipient_hash` text NOT NULL,
	`balance_cents` integer NOT NULL,
	`operator_id` text NOT NULL,
	`user_id` text NOT NULL,
	`note` text NOT NULL,
	`auth_method` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`kind`, `reference`),
	FOREIGN KEY (`release_id`) REFERENCES `payment_live_releases`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "live_claim_kind" CHECK("payment_live_claims"."kind" IN ('employee','partner')),
	CONSTRAINT "live_claim_balance" CHECK(typeof("payment_live_claims"."balance_cents")='integer' AND "payment_live_claims"."balance_cents">=0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_live_claims_release_id_unique` ON `payment_live_claims` (`release_id`);--> statement-breakpoint
CREATE TABLE `payment_live_control` (
	`id` integer PRIMARY KEY NOT NULL,
	`enabled` integer NOT NULL,
	CONSTRAINT "live_control_id" CHECK("payment_live_control"."id"=1),
	CONSTRAINT "live_control_enabled" CHECK("payment_live_control"."enabled" IN (0,1))
);
--> statement-breakpoint
CREATE TABLE `payment_live_reconciliation_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL,
	`kind` text NOT NULL,
	`reference` text NOT NULL,
	`disposition` text NOT NULL,
	`bank_reference` text NOT NULL,
	`payload_hash` text NOT NULL,
	`decision` text NOT NULL,
	`operator_id` text NOT NULL,
	`user_id` text NOT NULL,
	`note` text NOT NULL,
	`auth_method` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`review_id`) REFERENCES `payment_live_reconciliation_reviews`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "live_reconciliation_decision" CHECK("payment_live_reconciliation_decisions"."decision" IN ('approved','rejected'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_live_reconciliation_decisions_review_id_unique` ON `payment_live_reconciliation_decisions` (`review_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `payment_live_reconciled_once` ON `payment_live_reconciliation_decisions` (`kind`,`reference`,`disposition`) WHERE "payment_live_reconciliation_decisions"."decision"='approved';--> statement-breakpoint
CREATE UNIQUE INDEX `payment_bank_allocation_once` ON `payment_live_reconciliation_decisions` (`bank_reference`) WHERE "payment_live_reconciliation_decisions"."decision"='approved';--> statement-breakpoint
CREATE TABLE `payment_live_reconciliation_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`request_key` text NOT NULL,
	`kind` text NOT NULL,
	`reference` text NOT NULL,
	`source_hash` text NOT NULL,
	`evidence_id` text NOT NULL,
	`disposition` text NOT NULL,
	`bank_reference` text NOT NULL,
	`bank_hash` text NOT NULL,
	`bank_amount_cents` integer NOT NULL,
	`payload_json` text NOT NULL,
	`payload_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`operator_id` text NOT NULL,
	`user_id` text NOT NULL,
	`note` text NOT NULL,
	`auth_method` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "live_reconciliation_kind" CHECK("payment_live_reconciliation_reviews"."kind" IN ('employee','partner')),
	CONSTRAINT "live_reconciliation_disposition" CHECK("payment_live_reconciliation_reviews"."disposition" IN ('success','reversed')),
	CONSTRAINT "live_bank_amount" CHECK(typeof("payment_live_reconciliation_reviews"."bank_amount_cents")='integer' AND "payment_live_reconciliation_reviews"."bank_amount_cents">0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_live_reconciliation_reviews_request_key_unique` ON `payment_live_reconciliation_reviews` (`request_key`);--> statement-breakpoint
CREATE TABLE `payment_live_release_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`release_id` text NOT NULL,
	`payload_hash` text NOT NULL,
	`decision` text NOT NULL,
	`operator_id` text NOT NULL,
	`user_id` text NOT NULL,
	`note` text NOT NULL,
	`auth_method` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`release_id`) REFERENCES `payment_live_releases`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "live_release_decision" CHECK("payment_live_release_decisions"."decision" IN ('approved','rejected'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_live_release_decisions_release_id_unique` ON `payment_live_release_decisions` (`release_id`);--> statement-breakpoint
CREATE TABLE `payment_live_releases` (
	`id` text PRIMARY KEY NOT NULL,
	`request_key` text NOT NULL,
	`kind` text NOT NULL,
	`reference` text NOT NULL,
	`reserve_id` text NOT NULL,
	`source_hash` text NOT NULL,
	`fee_ceiling_cents` integer NOT NULL,
	`payload_json` text NOT NULL,
	`payload_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`operator_id` text NOT NULL,
	`user_id` text NOT NULL,
	`note` text NOT NULL,
	`auth_method` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`reserve_id`) REFERENCES `payment_live_reserves`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "live_release_kind" CHECK("payment_live_releases"."kind" IN ('employee','partner')),
	CONSTRAINT "live_fee_ceiling" CHECK(typeof("payment_live_releases"."fee_ceiling_cents")='integer' AND "payment_live_releases"."fee_ceiling_cents">=0 AND "payment_live_releases"."fee_ceiling_cents"<=100000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_live_releases_request_key_unique` ON `payment_live_releases` (`request_key`);--> statement-breakpoint
CREATE TABLE `payment_live_reserve_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`reserve_id` text NOT NULL,
	`payload_hash` text NOT NULL,
	`decision` text NOT NULL,
	`operator_id` text NOT NULL,
	`user_id` text NOT NULL,
	`note` text NOT NULL,
	`auth_method` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`reserve_id`) REFERENCES `payment_live_reserves`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "live_reserve_decision" CHECK("payment_live_reserve_decisions"."decision" IN ('approved','rejected'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_live_reserve_decisions_reserve_id_unique` ON `payment_live_reserve_decisions` (`reserve_id`);--> statement-breakpoint
CREATE TABLE `payment_live_reserves` (
	`id` text PRIMARY KEY NOT NULL,
	`request_key` text NOT NULL,
	`integration` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`funding_reference` text NOT NULL,
	`payload_json` text NOT NULL,
	`payload_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`operator_id` text NOT NULL,
	`user_id` text NOT NULL,
	`note` text NOT NULL,
	`auth_method` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "live_reserve_amount" CHECK(typeof("payment_live_reserves"."amount_cents")='integer' AND "payment_live_reserves"."amount_cents">0 AND "payment_live_reserves"."amount_cents"<=25000000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_live_reserves_request_key_unique` ON `payment_live_reserves` (`request_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `payment_live_reserves_funding_reference_unique` ON `payment_live_reserves` (`funding_reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `payment_live_funding_evidence_once` ON `payment_live_reserves` (`integration`,json_extract(`payload_json`,'$.fundingHash'));--> statement-breakpoint
CREATE TABLE `payment_unsent_replacements` (
	`kind` text NOT NULL,
	`reference` text NOT NULL,
	`predecessor` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`kind`, `reference`),
	CONSTRAINT "unsent_replacement_kind" CHECK("payment_unsent_replacements"."kind" IN ('employee','partner'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_unsent_predecessor` ON `payment_unsent_replacements` (`kind`,`predecessor`);
--> statement-breakpoint
INSERT INTO payment_live_control VALUES(1,0);
--> statement-breakpoint
CREATE VIEW payment_instruction_records AS SELECT 'employee' AS kind,payroll_item_id AS liability_id,i.* FROM employee_payment_instructions i UNION ALL SELECT 'partner' AS kind,payable_id AS liability_id,i.* FROM partner_payment_instructions i;
--> statement-breakpoint
CREATE VIEW payment_destination_evidence AS SELECT 'employee' AS kind,id,payload_json FROM payment_destination_reviews UNION ALL SELECT 'partner' AS kind,id,payload_json FROM partner_destination_reviews;
--> statement-breakpoint
CREATE VIEW payment_instruction_sources AS SELECT 'employee' AS kind,payroll_item_id AS liability_id,s.* FROM employee_payment_sources s UNION ALL SELECT 'partner' AS kind,payable_id AS liability_id,s.* FROM partner_payment_sources s;
--> statement-breakpoint
CREATE VIEW payment_live_reserve_current AS SELECT r.*,r.amount_cents-coalesce((SELECT sum(i.amount_cents+l.fee_ceiling_cents) FROM payment_live_claims c JOIN payment_live_releases l ON l.id=c.release_id JOIN payment_instruction_records i ON i.kind=c.kind AND i.reference=c.reference WHERE l.reserve_id=r.id),0) AS remaining_cents FROM payment_live_reserves r JOIN payment_live_reserve_decisions d ON d.reserve_id=r.id AND d.decision='approved' WHERE r.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now') AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=r.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=r.amount_cents AND g.role='finance_approver' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active') AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=d.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=r.amount_cents AND g.role='finance_approver' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active');
--> statement-breakpoint
CREATE TRIGGER payment_live_reserve_insert BEFORE INSERT ON payment_live_reserves BEGIN
 SELECT (CASE WHEN NOT (NEW.auth_method IN ('mfa_verified','owner_mfa_exception') AND length(trim(NEW.note))>=3 AND (julianday(NEW.created_at) BETWEEN julianday('now')-1.0/1440 AND julianday('now')+1.0/86400)) OR length(NEW.payload_hash)!=64 OR json_extract(NEW.payload_json,'$.mode') IS NOT 'live' OR json_extract(NEW.payload_json,'$.currency') IS NOT 'ZAR' OR json_extract(NEW.payload_json,'$.integration') IS NOT NEW.integration OR json_extract(NEW.payload_json,'$.amountCents') IS NOT NEW.amount_cents OR json_extract(NEW.payload_json,'$.fundingReference') IS NOT NEW.funding_reference OR length(json_extract(NEW.payload_json,'$.fundingHash')) IS NOT 64 OR length(json_extract(NEW.payload_json,'$.capabilityHash')) IS NOT 64 OR NEW.integration='' OR NEW.funding_reference='' OR NEW.expires_at<=NEW.created_at OR NOT EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=NEW.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=NEW.amount_cents AND g.role='finance_approver' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active') THEN RAISE(ABORT,'Live reserve evidence or finance authority changed') END);
END;
--> statement-breakpoint
CREATE TRIGGER payment_live_reserve_decision_insert BEFORE INSERT ON payment_live_reserve_decisions BEGIN
 SELECT (CASE WHEN NOT (NEW.auth_method IN ('mfa_verified','owner_mfa_exception') AND length(trim(NEW.note))>=3 AND (julianday(NEW.created_at) BETWEEN julianday('now')-1.0/1440 AND julianday('now')+1.0/86400)) OR NOT EXISTS(SELECT 1 FROM payment_live_reserves r WHERE r.id=NEW.reserve_id AND r.payload_hash=NEW.payload_hash AND r.operator_id!=NEW.operator_id AND r.user_id!=NEW.user_id AND r.expires_at>NEW.created_at AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=r.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=r.amount_cents AND g.role='finance_approver' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active') AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=NEW.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=r.amount_cents AND g.role='finance_approver' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active')) THEN RAISE(ABORT,'Independent reserve evidence or authority changed') END);
END;
--> statement-breakpoint
CREATE TRIGGER payment_live_release_insert BEFORE INSERT ON payment_live_releases BEGIN
 SELECT (CASE WHEN NOT (NEW.auth_method IN ('mfa_verified','owner_mfa_exception') AND length(trim(NEW.note))>=3 AND (julianday(NEW.created_at) BETWEEN julianday('now')-1.0/1440 AND julianday('now')+1.0/86400)) OR NEW.expires_at<=NEW.created_at OR NOT EXISTS(SELECT 1 FROM payment_instruction_records i JOIN payment_instruction_sources s ON s.kind=i.kind AND s.liability_id=i.liability_id AND s.destination_id=i.destination_id AND s.source_json=i.source_json JOIN payment_live_reserve_current r ON r.id=NEW.reserve_id AND r.integration=json_extract(i.source_json,'$.recipient.integration') WHERE json_extract(NEW.payload_json,'$.kind') IS NEW.kind AND json_extract(NEW.payload_json,'$.reference') IS NEW.reference AND json_extract(NEW.payload_json,'$.sourceHash') IS NEW.source_hash AND json_extract(NEW.payload_json,'$.reserveId') IS NEW.reserve_id AND json_extract(NEW.payload_json,'$.feeCeilingCents') IS NEW.fee_ceiling_cents AND i.kind=NEW.kind AND i.reference=NEW.reference AND i.mode='live' AND i.status='approved' AND i.source_hash=NEW.source_hash AND EXISTS(SELECT 1 FROM payment_destination_evidence dest WHERE dest.kind=i.kind AND dest.id=i.destination_id AND json_extract(dest.payload_json,'$.mandateHash')=json_extract(NEW.payload_json,'$.mandateHash')) AND r.remaining_cents>=i.amount_cents+NEW.fee_ceiling_cents AND NEW.user_id NOT IN (coalesce(json_extract(i.source_json,'$.ownerUser'),''),coalesce(json_extract(i.source_json,'$.representativeUser'),''),coalesce(json_extract(i.source_json,'$.officerUser'),''),coalesce(json_extract(i.source_json,'$.clientUser'),'')) AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=NEW.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=i.amount_cents+NEW.fee_ceiling_cents AND g.role='finance_approver' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active')) THEN RAISE(ABORT,'Current live instruction, reserve or finance authority changed') END);
END;
--> statement-breakpoint
CREATE VIEW payment_live_release_reviewable AS SELECT l.*,i.amount_cents,i.version,i.source_json,i.prepared_by,i.prepared_user,r.remaining_cents FROM payment_live_releases l JOIN payment_instruction_records i ON i.kind=l.kind AND i.reference=l.reference AND i.source_hash=l.source_hash AND i.mode='live' AND i.status='approved' JOIN payment_instruction_sources s ON s.kind=i.kind AND s.liability_id=i.liability_id AND s.destination_id=i.destination_id AND s.source_json=i.source_json JOIN payment_live_reserve_current r ON r.id=l.reserve_id AND r.integration=json_extract(i.source_json,'$.recipient.integration') WHERE l.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now') AND r.remaining_cents>=i.amount_cents+l.fee_ceiling_cents AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=l.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=i.amount_cents+l.fee_ceiling_cents AND g.role='finance_approver' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active');
--> statement-breakpoint
CREATE TRIGGER payment_live_release_decision_insert BEFORE INSERT ON payment_live_release_decisions BEGIN
 SELECT (CASE WHEN NOT (NEW.auth_method IN ('mfa_verified','owner_mfa_exception') AND length(trim(NEW.note))>=3 AND (julianday(NEW.created_at) BETWEEN julianday('now')-1.0/1440 AND julianday('now')+1.0/86400)) OR NOT EXISTS(SELECT 1 FROM payment_live_release_reviewable l WHERE l.id=NEW.release_id AND l.payload_hash=NEW.payload_hash AND l.operator_id!=NEW.operator_id AND l.user_id!=NEW.user_id AND l.prepared_by!=NEW.operator_id AND l.prepared_user!=NEW.user_id AND NEW.user_id NOT IN (coalesce(json_extract(l.source_json,'$.ownerUser'),''),coalesce(json_extract(l.source_json,'$.representativeUser'),''),coalesce(json_extract(l.source_json,'$.officerUser'),''),coalesce(json_extract(l.source_json,'$.clientUser'),'')) AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=NEW.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=l.amount_cents+l.fee_ceiling_cents AND g.role='finance_approver' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active')) THEN RAISE(ABORT,'Independent live release evidence or authority changed') END);
END;
--> statement-breakpoint
CREATE VIEW payment_live_release_available AS SELECT l.*,d.operator_id AS approved_operator,d.user_id AS approved_user FROM payment_live_release_reviewable l JOIN payment_live_release_decisions d ON d.release_id=l.id AND d.decision='approved' WHERE EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=d.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=l.amount_cents+l.fee_ceiling_cents AND g.role='finance_approver' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active');
--> statement-breakpoint
CREATE TRIGGER payment_live_claim_insert BEFORE INSERT ON payment_live_claims BEGIN
 SELECT (CASE WHEN NOT (NEW.auth_method IN ('mfa_verified','owner_mfa_exception') AND length(trim(NEW.note))>=3 AND (julianday(NEW.created_at) BETWEEN julianday('now')-1.0/1440 AND julianday('now')+1.0/86400)) OR NOT EXISTS(SELECT 1 FROM payment_live_control WHERE id=1 AND enabled=1) OR NOT EXISTS(SELECT 1 FROM payment_live_release_available l WHERE l.id=NEW.release_id AND l.kind=NEW.kind AND l.reference=NEW.reference AND l.version=NEW.version AND l.source_hash=NEW.source_hash AND NEW.balance_cents>=l.amount_cents+l.fee_ceiling_cents AND l.prepared_by!=NEW.operator_id AND l.prepared_user!=NEW.user_id AND NEW.user_id NOT IN (coalesce(json_extract(l.source_json,'$.ownerUser'),''),coalesce(json_extract(l.source_json,'$.representativeUser'),''),coalesce(json_extract(l.source_json,'$.officerUser'),''),coalesce(json_extract(l.source_json,'$.clientUser'),'')) AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=NEW.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=l.amount_cents+l.fee_ceiling_cents AND g.role='finance_approver' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active')) THEN RAISE(ABORT,'Live dispatch is locked or its independent release, funds or authority changed') END);
END;
--> statement-breakpoint
CREATE VIEW employee_payment_final_evidence AS
 SELECT i.reference,e.id AS evidence_id,json_extract(e.transfer_json,'$.status') AS disposition
 FROM employee_payment_instructions i JOIN employee_transfer_observations e ON e.reference=i.reference
 WHERE (SELECT count(*) FROM employee_transfer_observations bounded WHERE bounded.reference=i.reference)<=500
 AND i.mode IN ('test','live') AND i.status='dispatch_claimed' AND e.source='verify' AND e.event='transfer.verify'
 AND e.rowid=(SELECT max(o.rowid) FROM employee_transfer_observations o WHERE o.reference=i.reference)
 AND julianday(e.created_at) IS NOT NULL AND julianday(e.created_at) BETWEEN julianday('now')-5.0/1440 AND julianday('now')+1.0/86400
 AND json_extract(e.transfer_json,'$.status') IN ('success','failed','reversed')
 AND e.webhook_count=(SELECT count(*) FROM employee_transfer_observations o WHERE o.reference=i.reference AND o.source='webhook')
 AND EXISTS(SELECT 1 FROM employee_transfer_observations w WHERE w.reference=i.reference AND w.source='webhook' AND w.event='transfer.'||json_extract(e.transfer_json,'$.status') AND json_extract(w.transfer_json,'$.status')=json_extract(e.transfer_json,'$.status'))
 AND NOT EXISTS(SELECT 1 FROM employee_transfer_observations o WHERE o.reference=i.reference AND (
 o.source NOT IN ('initiate','verify','webhook') OR json_type(o.transfer_json) IS NOT 'object'
 OR json_extract(o.transfer_json,'$.reference') IS NOT i.reference OR json_extract(o.transfer_json,'$.mode') IS NOT i.mode
 OR json_extract(o.transfer_json,'$.amount') IS NOT i.amount_cents OR json_extract(o.transfer_json,'$.currency') IS NOT 'ZAR'
 OR json_extract(o.transfer_json,'$.recipientId') IS NOT json_extract(i.source_json,'$.recipient.id')
 OR json_extract(o.transfer_json,'$.integration') IS NOT json_extract(i.source_json,'$.recipient.integration')
 OR json_extract(o.transfer_json,'$.id') IS NULL OR json_extract(o.transfer_json,'$.code') IS NULL
 OR json_extract(o.transfer_json,'$.id') IS NOT json_extract(e.transfer_json,'$.id') OR json_extract(o.transfer_json,'$.code') IS NOT json_extract(e.transfer_json,'$.code')
 OR (o.source='webhook' AND (o.event NOT IN ('transfer.success','transfer.failed','transfer.reversed') OR o.event IS NOT 'transfer.'||json_extract(o.transfer_json,'$.status')))
 OR json_extract(o.transfer_json,'$.status') NOT IN ('pending','otp','received',json_extract(e.transfer_json,'$.status'),CASE json_extract(e.transfer_json,'$.status') WHEN 'reversed' THEN 'success' ELSE json_extract(e.transfer_json,'$.status') END)
 OR (json_extract(o.transfer_json,'$.status') IS NOT json_extract(e.transfer_json,'$.status') AND EXISTS(SELECT 1 FROM employee_transfer_observations terminal WHERE terminal.reference=i.reference AND terminal.rowid<o.rowid AND json_extract(terminal.transfer_json,'$.status')=json_extract(e.transfer_json,'$.status')))
 ));
--> statement-breakpoint
DROP VIEW employee_recovery_terminal;
--> statement-breakpoint
CREATE VIEW employee_recovery_terminal AS SELECT * FROM employee_payment_final_evidence WHERE disposition IN ('failed','reversed');
--> statement-breakpoint
DROP TRIGGER employee_transfer_observation_insert;
--> statement-breakpoint
CREATE TRIGGER employee_transfer_observation_insert BEFORE INSERT ON employee_transfer_observations BEGIN
 SELECT (CASE WHEN NEW.source NOT IN ('initiate','verify','webhook','operations') OR NOT EXISTS(SELECT 1 FROM employee_payment_instructions i WHERE i.reference=NEW.reference AND i.mode IN ('test','live')) OR (NEW.source IN ('initiate','verify') AND NOT EXISTS(SELECT 1 FROM employee_payment_instructions i WHERE i.reference=NEW.reference AND i.status='dispatch_claimed'))
 OR (NEW.source='verify' AND NEW.webhook_count IS NOT (SELECT count(*) FROM employee_transfer_observations e WHERE e.reference=NEW.reference AND e.source='webhook'))
 THEN RAISE(ABORT,'Test transfer reference or webhook evidence changed') END);
END;
--> statement-breakpoint
DROP TRIGGER employee_payment_command_insert;
--> statement-breakpoint
CREATE TRIGGER employee_payment_command_insert BEFORE INSERT ON employee_payment_commands BEGIN
 SELECT (CASE WHEN NEW.auth_method NOT IN ('mfa_verified','owner_mfa_exception') OR julianday(NEW.created_at) IS NULL OR abs(julianday(NEW.created_at)-julianday('now'))>1.0/1440
 OR NOT EXISTS(SELECT 1 FROM employee_payment_instructions i JOIN operator_accounts a ON a.id=NEW.operator_id JOIN operator_role_assignments g ON g.operator_id=a.id WHERE i.reference=NEW.reference AND i.version=NEW.version AND i.source_hash=NEW.source_hash AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=i.amount_cents AND g.role='finance_approver' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active' AND json_extract(i.source_json,'$.ownerUser')!=NEW.user_id
 AND ((NEW.action='cancel' AND i.status IN ('prepared','approved')) OR (NEW.action IN ('approve','dispatch_test','dispatch_live') AND i.prepared_by!=NEW.operator_id AND i.prepared_user!=NEW.user_id AND ((NEW.action='approve' AND i.status='prepared') OR (NEW.action IN ('dispatch_test','dispatch_live') AND i.status='approved' AND i.mode=CASE NEW.action WHEN 'dispatch_live' THEN 'live' ELSE 'test' END AND json_extract(i.source_json,'$.payDate')<=date('now'))))))
 THEN RAISE(ABORT,'Employee instruction stage or independent finance authority changed') END);
 SELECT (CASE WHEN NEW.action!='cancel' AND NOT EXISTS(SELECT 1 FROM employee_payment_instructions i JOIN employee_payment_sources s ON s.payroll_item_id=i.payroll_item_id AND s.destination_id=i.destination_id AND s.source_json=i.source_json WHERE i.reference=NEW.reference
 AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=i.prepared_by AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=i.amount_cents AND g.role='payroll_preparer' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active')
 AND (NEW.action NOT IN ('dispatch_test','dispatch_live') OR (NEW.recipient_hash=json_extract((SELECT payload_json FROM payment_destination_reviews WHERE id=i.destination_id),'$.providerHash') AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=i.approved_by AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=i.amount_cents AND g.role='finance_approver' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active')))
 AND NOT EXISTS(SELECT 1 FROM employee_transfer_observations e WHERE e.reference=i.reference)) THEN RAISE(ABORT,'Employee source, destination or provider evidence changed') END);
END;
--> statement-breakpoint
CREATE TRIGGER employee_payment_live_command_guard BEFORE INSERT ON employee_payment_commands BEGIN
 SELECT (CASE WHEN NEW.action='dispatch_live' AND NOT EXISTS(SELECT 1 FROM payment_live_claims c WHERE c.kind='employee' AND c.reference=NEW.reference AND c.version=NEW.version AND c.operator_id=NEW.operator_id AND c.user_id=NEW.user_id AND c.source_hash=NEW.source_hash AND c.recipient_hash=NEW.recipient_hash) THEN RAISE(ABORT,'Live submission requires its durable independently authorized claim') END);
 SELECT (CASE WHEN NEW.action!='dispatch_live' AND EXISTS(SELECT 1 FROM payment_live_claims c WHERE c.kind='employee' AND c.reference=NEW.reference) THEN RAISE(ABORT,'Claimed live submission cannot be cancelled or resubmitted') END);
END;
--> statement-breakpoint
DROP TRIGGER employee_payment_update;
--> statement-breakpoint
CREATE TRIGGER employee_payment_update BEFORE UPDATE ON employee_payment_instructions BEGIN
 SELECT (CASE WHEN NEW.reference IS NOT OLD.reference OR NEW.payroll_item_id IS NOT OLD.payroll_item_id OR NEW.destination_id IS NOT OLD.destination_id OR NEW.mode IS NOT OLD.mode OR NEW.amount_cents IS NOT OLD.amount_cents OR NEW.source_json IS NOT OLD.source_json OR NEW.source_hash IS NOT OLD.source_hash OR NEW.request_key IS NOT OLD.request_key OR NEW.request_hash IS NOT OLD.request_hash OR NEW.prepared_by IS NOT OLD.prepared_by OR NEW.prepared_user IS NOT OLD.prepared_user OR NEW.created_at IS NOT OLD.created_at OR NEW.version!=OLD.version+1
 OR NOT ((OLD.status='dispatch_claimed' AND NEW.status=OLD.status AND OLD.active_key IS NOT NULL AND NEW.active_key IS NULL AND NEW.approved_by IS OLD.approved_by AND EXISTS(SELECT 1 FROM employee_recovery_replacements r JOIN employee_recovery_available a ON a.approval_id=r.approval_id WHERE r.predecessor=OLD.reference AND NOT EXISTS(SELECT 1 FROM employee_payment_instructions child WHERE child.reference=r.reference))) OR EXISTS(SELECT 1 FROM employee_payment_commands c WHERE c.reference=OLD.reference AND c.version=OLD.version AND ((c.action='approve' AND NEW.status='approved' AND NEW.approved_by=c.operator_id AND NEW.active_key IS OLD.active_key) OR (c.action='cancel' AND NEW.status='cancelled' AND NEW.active_key IS NULL AND NEW.approved_by IS OLD.approved_by) OR (c.action IN ('dispatch_test','dispatch_live') AND NEW.status='dispatch_claimed' AND NEW.active_key IS OLD.active_key AND NEW.approved_by IS OLD.approved_by))) )
 THEN RAISE(ABORT,'Employee instruction history or transition is invalid') END);
END;
--> statement-breakpoint
DROP TRIGGER employee_recovery_instruction_insert;
--> statement-breakpoint
CREATE TRIGGER employee_recovery_instruction_insert BEFORE INSERT ON employee_payment_instructions BEGIN
 SELECT (CASE WHEN EXISTS(SELECT 1 FROM employee_payment_instructions old WHERE old.payroll_item_id=NEW.payroll_item_id AND old.mode=NEW.mode AND old.status='dispatch_claimed' AND old.active_key IS NULL)
 AND NOT EXISTS(SELECT 1 FROM employee_recovery_replacements WHERE reference=NEW.reference) AND NOT EXISTS(SELECT 1 FROM payment_unsent_replacements WHERE kind='employee' AND reference=NEW.reference)
 THEN RAISE(ABORT,'Claimed replacement history requires an explicit recovery chain') END);
 SELECT (CASE WHEN EXISTS(SELECT 1 FROM employee_recovery_replacements r WHERE r.reference=NEW.reference) AND NOT EXISTS(
 SELECT 1 FROM employee_recovery_replacements r JOIN employee_payment_instructions i ON i.reference=r.predecessor JOIN employee_recovery_available a ON a.approval_id=r.approval_id
 WHERE r.reference=NEW.reference AND i.payroll_item_id=NEW.payroll_item_id AND i.destination_id=NEW.destination_id AND i.source_json=NEW.source_json AND i.source_hash=NEW.source_hash AND i.amount_cents=NEW.amount_cents AND NEW.mode=i.mode
 ) THEN RAISE(ABORT,'Replacement must preserve exact original instruction and current approval') END);
 SELECT (CASE WHEN EXISTS(SELECT 1 FROM payment_unsent_replacements u WHERE u.kind='employee' AND u.reference=NEW.reference) AND NOT EXISTS(SELECT 1 FROM payment_unsent_replacements u JOIN employee_payment_instructions p ON p.reference=u.predecessor WHERE u.kind='employee' AND u.reference=NEW.reference AND p.status='cancelled' AND p.payroll_item_id=NEW.payroll_item_id AND p.source_json=NEW.source_json AND p.source_hash=NEW.source_hash AND p.destination_id=NEW.destination_id AND p.mode=NEW.mode AND p.amount_cents=NEW.amount_cents) THEN RAISE(ABORT,'Cancelled successor replacement must retain exact current instructions') END);
 UPDATE employee_payment_instructions SET active_key=NULL,version=version+1,updated_at=NEW.created_at
 WHERE reference=(SELECT predecessor FROM employee_recovery_replacements WHERE reference=NEW.reference);
END;
--> statement-breakpoint
DROP VIEW employee_recovery_chain_holds;
--> statement-breakpoint
CREATE VIEW employee_recovery_chain_holds AS
 WITH RECURSIVE edges AS (SELECT reference,predecessor,approval_id FROM employee_recovery_replacements UNION ALL SELECT reference,predecessor,NULL AS approval_id FROM payment_unsent_replacements WHERE kind='employee'), chain(reference,predecessor,approval_id) AS (
 SELECT reference,predecessor,approval_id FROM edges
 UNION ALL SELECT c.reference,r.predecessor,r.approval_id FROM chain c JOIN edges r ON r.reference=c.predecessor
 ) SELECT c.reference FROM chain c JOIN employee_recovery_approvals a ON a.id=c.approval_id JOIN employee_recovery_proposals p ON p.id=a.proposal_id
 WHERE NOT EXISTS(SELECT 1 FROM employee_recovery_terminal t WHERE t.reference=c.predecessor AND t.disposition=p.disposition)
 OR NOT (EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=p.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=(SELECT amount_cents FROM employee_payment_instructions WHERE reference=c.predecessor) AND g.role='payroll_preparer' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active'))
 OR NOT (EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=a.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=(SELECT amount_cents FROM employee_payment_instructions WHERE reference=c.predecessor) AND g.role='finance_approver' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active'));
--> statement-breakpoint
CREATE VIEW partner_payment_final_evidence AS
 SELECT i.reference,e.id AS evidence_id,json_extract(e.transfer_json,'$.status') AS disposition
 FROM partner_payment_instructions i JOIN partner_transfer_observations e ON e.reference=i.reference
 WHERE (SELECT count(*) FROM partner_transfer_observations bounded WHERE bounded.reference=i.reference)<=500
 AND i.mode IN ('test','live') AND i.status='dispatch_claimed' AND e.source='verify' AND e.event='transfer.verify'
 AND e.rowid=(SELECT max(o.rowid) FROM partner_transfer_observations o WHERE o.reference=i.reference)
 AND julianday(e.created_at) IS NOT NULL AND julianday(e.created_at) BETWEEN julianday('now')-5.0/1440 AND julianday('now')+1.0/86400
 AND json_extract(e.transfer_json,'$.status') IN ('success','failed','reversed')
 AND e.webhook_count=(SELECT count(*) FROM partner_transfer_observations o WHERE o.reference=i.reference AND o.source='webhook')
 AND EXISTS(SELECT 1 FROM partner_transfer_observations w WHERE w.reference=i.reference AND w.source='webhook' AND w.event='transfer.'||json_extract(e.transfer_json,'$.status') AND json_extract(w.transfer_json,'$.status')=json_extract(e.transfer_json,'$.status'))
 AND NOT EXISTS(SELECT 1 FROM partner_transfer_observations o WHERE o.reference=i.reference AND (
 o.source NOT IN ('initiate','verify','webhook') OR json_type(o.transfer_json) IS NOT 'object'
 OR json_extract(o.transfer_json,'$.reference') IS NOT i.reference OR json_extract(o.transfer_json,'$.mode') IS NOT i.mode
 OR json_extract(o.transfer_json,'$.amount') IS NOT i.amount_cents OR json_extract(o.transfer_json,'$.currency') IS NOT 'ZAR'
 OR json_extract(o.transfer_json,'$.recipientId') IS NOT json_extract(i.source_json,'$.recipient.id')
 OR json_extract(o.transfer_json,'$.integration') IS NOT json_extract(i.source_json,'$.recipient.integration')
 OR json_extract(o.transfer_json,'$.id') IS NULL OR json_extract(o.transfer_json,'$.code') IS NULL
 OR json_extract(o.transfer_json,'$.id') IS NOT json_extract(e.transfer_json,'$.id') OR json_extract(o.transfer_json,'$.code') IS NOT json_extract(e.transfer_json,'$.code')
 OR (o.source='webhook' AND (o.event NOT IN ('transfer.success','transfer.failed','transfer.reversed') OR o.event IS NOT 'transfer.'||json_extract(o.transfer_json,'$.status')))
 OR json_extract(o.transfer_json,'$.status') NOT IN ('pending','otp','received',json_extract(e.transfer_json,'$.status'),CASE json_extract(e.transfer_json,'$.status') WHEN 'reversed' THEN 'success' ELSE json_extract(e.transfer_json,'$.status') END)
 OR (json_extract(o.transfer_json,'$.status') IS NOT json_extract(e.transfer_json,'$.status') AND EXISTS(SELECT 1 FROM partner_transfer_observations terminal WHERE terminal.reference=i.reference AND terminal.rowid<o.rowid AND json_extract(terminal.transfer_json,'$.status')=json_extract(e.transfer_json,'$.status')))
 ));
--> statement-breakpoint
DROP VIEW partner_recovery_terminal;
--> statement-breakpoint
CREATE VIEW partner_recovery_terminal AS SELECT * FROM partner_payment_final_evidence WHERE disposition IN ('failed','reversed');
--> statement-breakpoint
DROP TRIGGER partner_transfer_observation_insert;
--> statement-breakpoint
CREATE TRIGGER partner_transfer_observation_insert BEFORE INSERT ON partner_transfer_observations BEGIN
 SELECT (CASE WHEN NEW.source NOT IN ('initiate','verify','webhook','operations') OR NOT EXISTS(SELECT 1 FROM partner_payment_instructions i WHERE i.reference=NEW.reference AND i.mode IN ('test','live')) OR (NEW.source IN ('initiate','verify') AND NOT EXISTS(SELECT 1 FROM partner_payment_instructions i WHERE i.reference=NEW.reference AND i.status='dispatch_claimed'))
 OR (NEW.source='verify' AND NEW.webhook_count IS NOT (SELECT count(*) FROM partner_transfer_observations e WHERE e.reference=NEW.reference AND e.source='webhook'))
 THEN RAISE(ABORT,'Test transfer reference or webhook evidence changed') END);
END;
--> statement-breakpoint
DROP TRIGGER partner_payment_command_insert;
--> statement-breakpoint
CREATE TRIGGER partner_payment_command_insert BEFORE INSERT ON partner_payment_commands BEGIN
 SELECT (CASE WHEN NEW.auth_method NOT IN ('mfa_verified','owner_mfa_exception') OR julianday(NEW.created_at) IS NULL OR abs(julianday(NEW.created_at)-julianday('now'))>1.0/1440
 OR NOT EXISTS(SELECT 1 FROM partner_payment_instructions i JOIN operator_accounts a ON a.id=NEW.operator_id JOIN operator_role_assignments g ON g.operator_id=a.id WHERE i.reference=NEW.reference AND i.version=NEW.version AND i.source_hash=NEW.source_hash AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=i.amount_cents AND g.role='finance_approver' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active' AND NEW.user_id NOT IN (json_extract(i.source_json,'$.representativeUser'),json_extract(i.source_json,'$.officerUser'),json_extract(i.source_json,'$.clientUser'))
 AND ((NEW.action='cancel' AND i.status IN ('prepared','approved')) OR (NEW.action IN ('approve','dispatch_test','dispatch_live') AND i.prepared_by!=NEW.operator_id AND i.prepared_user!=NEW.user_id AND ((NEW.action='approve' AND i.status='prepared') OR (NEW.action IN ('dispatch_test','dispatch_live') AND i.status='approved' AND i.mode=CASE NEW.action WHEN 'dispatch_live' THEN 'live' ELSE 'test' END AND json_extract(i.source_json,'$.dueDate')<=date('now'))))))
 THEN RAISE(ABORT,'Partner instruction stage or independent finance authority changed') END);
 SELECT (CASE WHEN NEW.action!='cancel' AND NOT EXISTS(SELECT 1 FROM partner_payment_instructions i JOIN partner_payment_sources s ON s.payable_id=i.payable_id AND s.destination_id=i.destination_id AND s.source_json=i.source_json WHERE i.reference=NEW.reference
 AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=i.prepared_by AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=i.amount_cents AND g.role='operations_controller' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active')
 AND (NEW.action NOT IN ('dispatch_test','dispatch_live') OR (NEW.recipient_hash=json_extract((SELECT payload_json FROM partner_destination_reviews WHERE id=i.destination_id),'$.providerHash') AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=i.approved_by AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=i.amount_cents AND g.role='finance_approver' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active')))
 AND NOT EXISTS(SELECT 1 FROM partner_transfer_observations e WHERE e.reference=i.reference)) THEN RAISE(ABORT,'Partner source, destination or provider evidence changed') END);
END;
--> statement-breakpoint
CREATE TRIGGER partner_payment_live_command_guard BEFORE INSERT ON partner_payment_commands BEGIN
 SELECT (CASE WHEN NEW.action='dispatch_live' AND NOT EXISTS(SELECT 1 FROM payment_live_claims c WHERE c.kind='partner' AND c.reference=NEW.reference AND c.version=NEW.version AND c.operator_id=NEW.operator_id AND c.user_id=NEW.user_id AND c.source_hash=NEW.source_hash AND c.recipient_hash=NEW.recipient_hash) THEN RAISE(ABORT,'Live submission requires its durable independently authorized claim') END);
 SELECT (CASE WHEN NEW.action!='dispatch_live' AND EXISTS(SELECT 1 FROM payment_live_claims c WHERE c.kind='partner' AND c.reference=NEW.reference) THEN RAISE(ABORT,'Claimed live submission cannot be cancelled or resubmitted') END);
END;
--> statement-breakpoint
DROP TRIGGER partner_payment_update;
--> statement-breakpoint
CREATE TRIGGER partner_payment_update BEFORE UPDATE ON partner_payment_instructions BEGIN
 SELECT (CASE WHEN NEW.reference IS NOT OLD.reference OR NEW.payable_id IS NOT OLD.payable_id OR NEW.destination_id IS NOT OLD.destination_id OR NEW.mode IS NOT OLD.mode OR NEW.amount_cents IS NOT OLD.amount_cents OR NEW.source_json IS NOT OLD.source_json OR NEW.source_hash IS NOT OLD.source_hash OR NEW.request_key IS NOT OLD.request_key OR NEW.request_hash IS NOT OLD.request_hash OR NEW.prepared_by IS NOT OLD.prepared_by OR NEW.prepared_user IS NOT OLD.prepared_user OR NEW.created_at IS NOT OLD.created_at OR NEW.version!=OLD.version+1
 OR NOT ((OLD.status='dispatch_claimed' AND NEW.status=OLD.status AND OLD.active_key IS NOT NULL AND NEW.active_key IS NULL AND NEW.approved_by IS OLD.approved_by AND EXISTS(SELECT 1 FROM partner_recovery_replacements r JOIN partner_recovery_available a ON a.approval_id=r.approval_id WHERE r.predecessor=OLD.reference AND NOT EXISTS(SELECT 1 FROM partner_payment_instructions child WHERE child.reference=r.reference))) OR EXISTS(SELECT 1 FROM partner_payment_commands c WHERE c.reference=OLD.reference AND c.version=OLD.version AND ((c.action='approve' AND NEW.status='approved' AND NEW.approved_by=c.operator_id AND NEW.active_key IS OLD.active_key) OR (c.action='cancel' AND NEW.status='cancelled' AND NEW.active_key IS NULL AND NEW.approved_by IS OLD.approved_by) OR (c.action IN ('dispatch_test','dispatch_live') AND NEW.status='dispatch_claimed' AND NEW.active_key IS OLD.active_key AND NEW.approved_by IS OLD.approved_by))) )
 THEN RAISE(ABORT,'Partner instruction history or transition is invalid') END);
END;
--> statement-breakpoint
DROP TRIGGER partner_recovery_instruction_insert;
--> statement-breakpoint
CREATE TRIGGER partner_recovery_instruction_insert BEFORE INSERT ON partner_payment_instructions BEGIN
 SELECT (CASE WHEN EXISTS(SELECT 1 FROM partner_payment_instructions old WHERE old.payable_id=NEW.payable_id AND old.mode=NEW.mode AND old.status='dispatch_claimed' AND old.active_key IS NULL)
 AND NOT EXISTS(SELECT 1 FROM partner_recovery_replacements WHERE reference=NEW.reference) AND NOT EXISTS(SELECT 1 FROM payment_unsent_replacements WHERE kind='partner' AND reference=NEW.reference)
 THEN RAISE(ABORT,'Claimed replacement history requires an explicit recovery chain') END);
 SELECT (CASE WHEN EXISTS(SELECT 1 FROM partner_recovery_replacements r WHERE r.reference=NEW.reference) AND NOT EXISTS(
 SELECT 1 FROM partner_recovery_replacements r JOIN partner_payment_instructions i ON i.reference=r.predecessor JOIN partner_recovery_available a ON a.approval_id=r.approval_id
 WHERE r.reference=NEW.reference AND i.payable_id=NEW.payable_id AND i.destination_id=NEW.destination_id AND i.source_json=NEW.source_json AND i.source_hash=NEW.source_hash AND i.amount_cents=NEW.amount_cents AND NEW.mode=i.mode
 ) THEN RAISE(ABORT,'Replacement must preserve exact original instruction and current approval') END);
 SELECT (CASE WHEN EXISTS(SELECT 1 FROM payment_unsent_replacements u WHERE u.kind='partner' AND u.reference=NEW.reference) AND NOT EXISTS(SELECT 1 FROM payment_unsent_replacements u JOIN partner_payment_instructions p ON p.reference=u.predecessor WHERE u.kind='partner' AND u.reference=NEW.reference AND p.status='cancelled' AND p.payable_id=NEW.payable_id AND p.source_json=NEW.source_json AND p.source_hash=NEW.source_hash AND p.destination_id=NEW.destination_id AND p.mode=NEW.mode AND p.amount_cents=NEW.amount_cents) THEN RAISE(ABORT,'Cancelled successor replacement must retain exact current instructions') END);
 UPDATE partner_payment_instructions SET active_key=NULL,version=version+1,updated_at=NEW.created_at
 WHERE reference=(SELECT predecessor FROM partner_recovery_replacements WHERE reference=NEW.reference);
END;
--> statement-breakpoint
DROP VIEW partner_recovery_chain_holds;
--> statement-breakpoint
CREATE VIEW partner_recovery_chain_holds AS
 WITH RECURSIVE edges AS (SELECT reference,predecessor,approval_id FROM partner_recovery_replacements UNION ALL SELECT reference,predecessor,NULL AS approval_id FROM payment_unsent_replacements WHERE kind='partner'), chain(reference,predecessor,approval_id) AS (
 SELECT reference,predecessor,approval_id FROM edges
 UNION ALL SELECT c.reference,r.predecessor,r.approval_id FROM chain c JOIN edges r ON r.reference=c.predecessor
 ) SELECT c.reference FROM chain c JOIN partner_recovery_approvals a ON a.id=c.approval_id JOIN partner_recovery_proposals p ON p.id=a.proposal_id
 WHERE NOT EXISTS(SELECT 1 FROM partner_recovery_terminal t WHERE t.reference=c.predecessor AND t.disposition=p.disposition)
 OR NOT (EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=p.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=(SELECT amount_cents FROM partner_payment_instructions WHERE reference=c.predecessor) AND g.role='operations_controller' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active'))
 OR NOT (EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=a.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=(SELECT amount_cents FROM partner_payment_instructions WHERE reference=c.predecessor) AND g.role='finance_approver' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active'));
--> statement-breakpoint
CREATE VIEW payment_final_evidence AS SELECT 'employee' AS kind,t.* FROM employee_payment_final_evidence t UNION ALL SELECT 'partner' AS kind,t.* FROM partner_payment_final_evidence t;
--> statement-breakpoint
CREATE VIEW payment_recovery_chain_holds AS SELECT 'employee' AS kind,h.* FROM employee_recovery_chain_holds h UNION ALL SELECT 'partner' AS kind,h.* FROM partner_recovery_chain_holds h;
--> statement-breakpoint
CREATE TRIGGER payment_unsent_replacement_insert BEFORE INSERT ON payment_unsent_replacements BEGIN
 SELECT (CASE WHEN NOT (julianday(NEW.created_at) BETWEEN julianday('now')-1.0/1440 AND julianday('now')+1.0/86400) OR NEW.reference=NEW.predecessor OR EXISTS(SELECT 1 FROM payment_instruction_records WHERE kind=NEW.kind AND reference=NEW.reference) OR NOT EXISTS(SELECT 1 FROM payment_instruction_records i WHERE i.kind=NEW.kind AND i.reference=NEW.predecessor AND i.status='cancelled' AND i.active_key IS NULL AND NOT EXISTS(SELECT 1 FROM payment_live_claims c WHERE c.kind=i.kind AND c.reference=i.reference)) OR EXISTS(SELECT 1 FROM payment_recovery_chain_holds h WHERE h.kind=NEW.kind AND h.reference=NEW.predecessor) THEN RAISE(ABORT,'Cancelled successor or its claimed ancestor remains held') END);
END;
--> statement-breakpoint
CREATE VIEW payment_live_reconciliation_reviewable AS SELECT r.*,i.amount_cents,i.source_json,i.prepared_by,i.prepared_user FROM payment_live_reconciliation_reviews r JOIN payment_instruction_records i ON i.kind=r.kind AND i.reference=r.reference AND i.source_hash=r.source_hash AND i.mode='live' JOIN payment_final_evidence t ON t.kind=r.kind AND t.reference=r.reference AND t.evidence_id=r.evidence_id AND t.disposition=r.disposition WHERE r.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now') AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=r.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=i.amount_cents AND g.role='finance_approver' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active');
--> statement-breakpoint
CREATE TRIGGER payment_live_reconciliation_review_insert BEFORE INSERT ON payment_live_reconciliation_reviews BEGIN
 SELECT (CASE WHEN NOT (NEW.auth_method IN ('mfa_verified','owner_mfa_exception') AND length(trim(NEW.note))>=3 AND (julianday(NEW.created_at) BETWEEN julianday('now')-1.0/1440 AND julianday('now')+1.0/86400)) OR NEW.expires_at<=NEW.created_at OR NOT EXISTS(SELECT 1 FROM payment_instruction_records i JOIN payment_final_evidence t ON t.kind=i.kind AND t.reference=i.reference WHERE i.kind=NEW.kind AND i.reference=NEW.reference AND i.mode='live' AND i.source_hash=NEW.source_hash AND t.evidence_id=NEW.evidence_id AND t.disposition=NEW.disposition AND json_extract(NEW.payload_json,'$.bankReference') IS NEW.bank_reference AND json_extract(NEW.payload_json,'$.bankHash') IS NEW.bank_hash AND json_extract(NEW.payload_json,'$.bankAmount') IS NEW.bank_amount_cents AND json_extract(NEW.payload_json,'$.snapshot.verifiedObservationId') IS NEW.evidence_id AND json_extract(NEW.payload_json,'$.snapshot.binding.sourceHash') IS NEW.source_hash AND length(NEW.bank_hash)=64 AND length(NEW.bank_reference)>=3 AND NEW.bank_amount_cents>=i.amount_cents AND NEW.bank_amount_cents<=i.amount_cents+(SELECT l.fee_ceiling_cents FROM payment_live_claims c JOIN payment_live_releases l ON l.id=c.release_id WHERE c.kind=i.kind AND c.reference=i.reference) AND NEW.user_id NOT IN (coalesce(json_extract(i.source_json,'$.ownerUser'),''),coalesce(json_extract(i.source_json,'$.representativeUser'),''),coalesce(json_extract(i.source_json,'$.officerUser'),''),coalesce(json_extract(i.source_json,'$.clientUser'),'')) AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=NEW.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=i.amount_cents AND g.role='finance_approver' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active')) THEN RAISE(ABORT,'Live reconciliation final evidence or finance authority changed') END);
END;
--> statement-breakpoint
CREATE TRIGGER payment_live_reconciliation_decision_insert BEFORE INSERT ON payment_live_reconciliation_decisions BEGIN
 SELECT (CASE WHEN NOT (NEW.auth_method IN ('mfa_verified','owner_mfa_exception') AND length(trim(NEW.note))>=3 AND (julianday(NEW.created_at) BETWEEN julianday('now')-1.0/1440 AND julianday('now')+1.0/86400)) OR NOT EXISTS(SELECT 1 FROM payment_live_reconciliation_reviewable r WHERE r.id=NEW.review_id AND r.kind=NEW.kind AND r.reference=NEW.reference AND r.disposition=NEW.disposition AND r.bank_reference=NEW.bank_reference AND (NEW.decision='rejected' OR NOT EXISTS(SELECT 1 FROM payment_live_reconciliation_reviews prior JOIN payment_live_reconciliation_decisions decided ON decided.review_id=prior.id WHERE prior.bank_hash=r.bank_hash AND decided.decision='approved')) AND r.payload_hash=NEW.payload_hash AND r.operator_id!=NEW.operator_id AND r.user_id!=NEW.user_id AND r.prepared_by!=NEW.operator_id AND r.prepared_user!=NEW.user_id AND NEW.user_id NOT IN (coalesce(json_extract(r.source_json,'$.ownerUser'),''),coalesce(json_extract(r.source_json,'$.representativeUser'),''),coalesce(json_extract(r.source_json,'$.officerUser'),''),coalesce(json_extract(r.source_json,'$.clientUser'),'')) AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=NEW.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=r.amount_cents AND g.role='finance_approver' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active')) THEN RAISE(ABORT,'Independent reconciliation or exact final evidence changed') END);
END;
--> statement-breakpoint
CREATE VIEW employee_payment_financial_state AS SELECT i.reference,
 CASE WHEN i.mode='test' THEN 'not_paid'
 WHEN NOT EXISTS(SELECT 1 FROM employee_payment_commands c WHERE c.reference=i.reference AND c.action='dispatch_live') THEN 'not_paid'
 WHEN (SELECT e.id FROM employee_transfer_observations e JOIN payment_live_reconciliation_reviews r ON r.evidence_id=e.id JOIN payment_live_reconciliation_decisions d ON d.review_id=r.id WHERE d.kind='employee' AND d.reference=i.reference AND d.decision='approved' AND d.disposition='reversed') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM employee_transfer_observations o WHERE o.reference=i.reference AND o.rowid>(SELECT e.rowid FROM employee_transfer_observations e JOIN payment_live_reconciliation_reviews r ON r.evidence_id=e.id JOIN payment_live_reconciliation_decisions d ON d.review_id=r.id WHERE d.kind='employee' AND d.reference=i.reference AND d.decision='approved' AND d.disposition='reversed') AND (o.transfer_json IS NOT (SELECT e.transfer_json FROM employee_transfer_observations e JOIN payment_live_reconciliation_reviews r ON r.evidence_id=e.id JOIN payment_live_reconciliation_decisions d ON d.review_id=r.id WHERE d.kind='employee' AND d.reference=i.reference AND d.decision='approved' AND d.disposition='reversed') OR o.source='operations' OR (o.source='webhook' AND o.event!='transfer.reversed') OR (o.source='verify' AND o.event!='transfer.verify'))) THEN 'reversed'
 WHEN (SELECT e.id FROM employee_transfer_observations e JOIN payment_live_reconciliation_reviews r ON r.evidence_id=e.id JOIN payment_live_reconciliation_decisions d ON d.review_id=r.id WHERE d.kind='employee' AND d.reference=i.reference AND d.decision='approved' AND d.disposition='success') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM employee_transfer_observations o WHERE o.reference=i.reference AND o.rowid>(SELECT e.rowid FROM employee_transfer_observations e JOIN payment_live_reconciliation_reviews r ON r.evidence_id=e.id JOIN payment_live_reconciliation_decisions d ON d.review_id=r.id WHERE d.kind='employee' AND d.reference=i.reference AND d.decision='approved' AND d.disposition='success') AND (o.transfer_json IS NOT (SELECT e.transfer_json FROM employee_transfer_observations e JOIN payment_live_reconciliation_reviews r ON r.evidence_id=e.id JOIN payment_live_reconciliation_decisions d ON d.review_id=r.id WHERE d.kind='employee' AND d.reference=i.reference AND d.decision='approved' AND d.disposition='success') OR o.source='operations' OR (o.source='webhook' AND o.event!='transfer.success') OR (o.source='verify' AND o.event!='transfer.verify'))) THEN 'paid'
 ELSE 'held' END AS financial_state,
 (SELECT count(*) FROM payment_live_reconciliation_decisions d WHERE d.kind='employee' AND d.reference=i.reference AND d.decision='approved' AND d.disposition='success') AS paid_receipts FROM employee_payment_instructions i;
--> statement-breakpoint
CREATE VIEW partner_payment_financial_state AS SELECT i.reference,
 CASE WHEN i.mode='test' THEN 'not_paid'
 WHEN NOT EXISTS(SELECT 1 FROM partner_payment_commands c WHERE c.reference=i.reference AND c.action='dispatch_live') THEN 'not_paid'
 WHEN (SELECT e.id FROM partner_transfer_observations e JOIN payment_live_reconciliation_reviews r ON r.evidence_id=e.id JOIN payment_live_reconciliation_decisions d ON d.review_id=r.id WHERE d.kind='partner' AND d.reference=i.reference AND d.decision='approved' AND d.disposition='reversed') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM partner_transfer_observations o WHERE o.reference=i.reference AND o.rowid>(SELECT e.rowid FROM partner_transfer_observations e JOIN payment_live_reconciliation_reviews r ON r.evidence_id=e.id JOIN payment_live_reconciliation_decisions d ON d.review_id=r.id WHERE d.kind='partner' AND d.reference=i.reference AND d.decision='approved' AND d.disposition='reversed') AND (o.transfer_json IS NOT (SELECT e.transfer_json FROM partner_transfer_observations e JOIN payment_live_reconciliation_reviews r ON r.evidence_id=e.id JOIN payment_live_reconciliation_decisions d ON d.review_id=r.id WHERE d.kind='partner' AND d.reference=i.reference AND d.decision='approved' AND d.disposition='reversed') OR o.source='operations' OR (o.source='webhook' AND o.event!='transfer.reversed') OR (o.source='verify' AND o.event!='transfer.verify'))) THEN 'reversed'
 WHEN (SELECT e.id FROM partner_transfer_observations e JOIN payment_live_reconciliation_reviews r ON r.evidence_id=e.id JOIN payment_live_reconciliation_decisions d ON d.review_id=r.id WHERE d.kind='partner' AND d.reference=i.reference AND d.decision='approved' AND d.disposition='success') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM partner_transfer_observations o WHERE o.reference=i.reference AND o.rowid>(SELECT e.rowid FROM partner_transfer_observations e JOIN payment_live_reconciliation_reviews r ON r.evidence_id=e.id JOIN payment_live_reconciliation_decisions d ON d.review_id=r.id WHERE d.kind='partner' AND d.reference=i.reference AND d.decision='approved' AND d.disposition='success') AND (o.transfer_json IS NOT (SELECT e.transfer_json FROM partner_transfer_observations e JOIN payment_live_reconciliation_reviews r ON r.evidence_id=e.id JOIN payment_live_reconciliation_decisions d ON d.review_id=r.id WHERE d.kind='partner' AND d.reference=i.reference AND d.decision='approved' AND d.disposition='success') OR o.source='operations' OR (o.source='webhook' AND o.event!='transfer.success') OR (o.source='verify' AND o.event!='transfer.verify'))) THEN 'paid'
 ELSE 'held' END AS financial_state,
 (SELECT count(*) FROM payment_live_reconciliation_decisions d WHERE d.kind='partner' AND d.reference=i.reference AND d.decision='approved' AND d.disposition='success') AS paid_receipts FROM partner_payment_instructions i;
--> statement-breakpoint
CREATE TRIGGER payment_live_reserves_update BEFORE UPDATE ON payment_live_reserves BEGIN SELECT RAISE(ABORT,'Payment execution history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER payment_live_reserves_delete BEFORE DELETE ON payment_live_reserves BEGIN SELECT RAISE(ABORT,'Payment execution history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER payment_live_reserve_decisions_update BEFORE UPDATE ON payment_live_reserve_decisions BEGIN SELECT RAISE(ABORT,'Payment execution history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER payment_live_reserve_decisions_delete BEFORE DELETE ON payment_live_reserve_decisions BEGIN SELECT RAISE(ABORT,'Payment execution history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER payment_live_releases_update BEFORE UPDATE ON payment_live_releases BEGIN SELECT RAISE(ABORT,'Payment execution history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER payment_live_releases_delete BEFORE DELETE ON payment_live_releases BEGIN SELECT RAISE(ABORT,'Payment execution history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER payment_live_release_decisions_update BEFORE UPDATE ON payment_live_release_decisions BEGIN SELECT RAISE(ABORT,'Payment execution history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER payment_live_release_decisions_delete BEFORE DELETE ON payment_live_release_decisions BEGIN SELECT RAISE(ABORT,'Payment execution history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER payment_live_claims_update BEFORE UPDATE ON payment_live_claims BEGIN SELECT RAISE(ABORT,'Payment execution history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER payment_live_claims_delete BEFORE DELETE ON payment_live_claims BEGIN SELECT RAISE(ABORT,'Payment execution history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER payment_live_reconciliation_reviews_update BEFORE UPDATE ON payment_live_reconciliation_reviews BEGIN SELECT RAISE(ABORT,'Payment execution history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER payment_live_reconciliation_reviews_delete BEFORE DELETE ON payment_live_reconciliation_reviews BEGIN SELECT RAISE(ABORT,'Payment execution history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER payment_live_reconciliation_decisions_update BEFORE UPDATE ON payment_live_reconciliation_decisions BEGIN SELECT RAISE(ABORT,'Payment execution history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER payment_live_reconciliation_decisions_delete BEFORE DELETE ON payment_live_reconciliation_decisions BEGIN SELECT RAISE(ABORT,'Payment execution history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER payment_unsent_replacements_update BEFORE UPDATE ON payment_unsent_replacements BEGIN SELECT RAISE(ABORT,'Payment execution history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER payment_unsent_replacements_delete BEFORE DELETE ON payment_unsent_replacements BEGIN SELECT RAISE(ABORT,'Payment execution history is immutable'); END;
