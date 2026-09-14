CREATE TABLE `payroll_correction_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL,
	`decision` text NOT NULL,
	`payload_hash` text NOT NULL,
	`operator_id` text NOT NULL,
	`user_id` text NOT NULL,
	`findings` text NOT NULL,
	`auth_context` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`review_id`) REFERENCES `payroll_correction_reviews`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operator_id`) REFERENCES `operator_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "payroll_correction_decision_value" CHECK("payroll_correction_decisions"."decision" IN ('evidence_reviewed','rejected')),
	CONSTRAINT "payroll_correction_findings" CHECK(length(trim("payroll_correction_decisions"."findings"))>=3),
	CONSTRAINT "payroll_correction_auth_context" CHECK("payroll_correction_decisions"."auth_context" IN ('mfa_verified','owner_mfa_exception'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payroll_correction_one_decision` ON `payroll_correction_decisions` (`review_id`);--> statement-breakpoint
CREATE TABLE `payroll_correction_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`request_key` text NOT NULL,
	`item_id` text NOT NULL,
	`parent_id` text,
	`source_json` text NOT NULL,
	`financial_json` text NOT NULL,
	`export_reference` text NOT NULL,
	`request_json` text NOT NULL,
	`payload_hash` text NOT NULL,
	`operator_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `payroll_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_id`) REFERENCES `payroll_correction_reviews`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operator_id`) REFERENCES `operator_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "payroll_correction_source_json" CHECK(json_valid("payroll_correction_reviews"."source_json")),
	CONSTRAINT "payroll_correction_financial_json" CHECK(json_valid("payroll_correction_reviews"."financial_json")),
	CONSTRAINT "payroll_correction_request_json" CHECK(json_valid("payroll_correction_reviews"."request_json")),
	CONSTRAINT "payroll_correction_payload_hash" CHECK(length("payroll_correction_reviews"."payload_hash")=64)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payroll_correction_request_key` ON `payroll_correction_reviews` (`request_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `payroll_correction_successor` ON `payroll_correction_reviews` (`parent_id`) WHERE "payroll_correction_reviews"."parent_id" IS NOT NULL;
--> statement-breakpoint
CREATE VIEW payroll_correction_sources AS SELECT s.source_id AS item_id,s.party_id AS officer_id,s.recipient_user,i.gross_wage_cents AS review_amount_cents,r.id AS run_id,r.export_reference,s.source_json,f.financial_json FROM finance_document_sources s JOIN payroll_items i ON i.id=s.source_id JOIN payroll_runs r ON r.id=i.payroll_run_id JOIN finance_document_financial_snapshots f ON f.kind=s.kind AND f.source_id=s.source_id WHERE s.kind='payslip' AND r.status='exported' AND r.export_reference IS NOT NULL;
--> statement-breakpoint
CREATE TRIGGER payroll_correction_prepare_guard BEFORE INSERT ON payroll_correction_reviews BEGIN SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM payroll_correction_sources s WHERE s.item_id=NEW.item_id AND s.source_json=NEW.source_json AND s.financial_json=NEW.financial_json AND s.export_reference=NEW.export_reference AND json_extract(NEW.request_json,'$.itemId')=s.item_id AND json_extract(NEW.request_json,'$.parentId') IS NEW.parent_id AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=NEW.operator_id AND a.status='active' AND a.environment='production' AND a.integrity_state='production_verified' AND a.approval_limit_cents>=s.review_amount_cents AND g.role='payroll_preparer' AND g.status='active' AND g.environment='production' AND g.integrity_state='production_verified') AND NEW.user_id<>s.recipient_user) THEN RAISE(ABORT,'Payroll source or preparer changed') END;
 SELECT CASE WHEN NEW.parent_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM payroll_correction_reviews p JOIN payroll_correction_decisions d ON d.review_id=p.id WHERE p.id=NEW.parent_id AND p.item_id=NEW.item_id) THEN RAISE(ABORT,'Retain the original correction history') END; END;
--> statement-breakpoint
CREATE TRIGGER payroll_correction_decision_guard BEFORE INSERT ON payroll_correction_decisions BEGIN SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM payroll_correction_reviews c JOIN payroll_correction_sources s ON s.item_id=c.item_id WHERE c.id=NEW.review_id AND c.payload_hash=NEW.payload_hash AND c.operator_id<>NEW.operator_id AND c.user_id<>NEW.user_id AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=NEW.operator_id AND a.status='active' AND a.environment='production' AND a.integrity_state='production_verified' AND a.approval_limit_cents>=s.review_amount_cents AND g.role='finance_approver' AND g.status='active' AND g.environment='production' AND g.integrity_state='production_verified') AND NEW.user_id<>s.recipient_user AND (NEW.decision='rejected' OR (c.source_json=s.source_json AND c.financial_json=s.financial_json AND c.export_reference=s.export_reference AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=c.operator_id AND a.status='active' AND a.environment='production' AND a.integrity_state='production_verified' AND a.approval_limit_cents>=s.review_amount_cents AND g.role='payroll_preparer' AND g.status='active' AND g.environment='production' AND g.integrity_state='production_verified') AND c.user_id<>s.recipient_user))) THEN RAISE(ABORT,'Independent current payroll evidence review required') END; END;
--> statement-breakpoint
CREATE TRIGGER payroll_correction_reviews_no_update BEFORE UPDATE ON payroll_correction_reviews BEGIN SELECT RAISE(ABORT,'Payroll correction history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER payroll_correction_reviews_no_delete BEFORE DELETE ON payroll_correction_reviews BEGIN SELECT RAISE(ABORT,'Payroll correction history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER payroll_correction_reviews_no_replace BEFORE INSERT ON payroll_correction_reviews WHEN EXISTS(SELECT 1 FROM payroll_correction_reviews WHERE id=NEW.id OR request_key=NEW.request_key OR (parent_id IS NOT NULL AND parent_id=NEW.parent_id)) BEGIN SELECT RAISE(ABORT,'Payroll correction history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER payroll_correction_decisions_no_update BEFORE UPDATE ON payroll_correction_decisions BEGIN SELECT RAISE(ABORT,'Payroll correction history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER payroll_correction_decisions_no_delete BEFORE DELETE ON payroll_correction_decisions BEGIN SELECT RAISE(ABORT,'Payroll correction history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER payroll_correction_decisions_no_replace BEFORE INSERT ON payroll_correction_decisions WHEN EXISTS(SELECT 1 FROM payroll_correction_decisions WHERE id=NEW.id OR review_id=NEW.review_id) BEGIN SELECT RAISE(ABORT,'Payroll correction history is immutable'); END;
