CREATE TABLE `credit_note_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`credit_id` text NOT NULL,
	`decision` text NOT NULL,
	`payload_hash` text NOT NULL,
	`operator_id` text NOT NULL,
	`user_id` text NOT NULL,
	`note` text NOT NULL,
	`auth_context` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`credit_id`) REFERENCES `credit_notes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operator_id`) REFERENCES `operator_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "credit_note_decisions_check_0" CHECK(decision IN('approved','rejected')),
	CONSTRAINT "credit_note_decisions_check_1" CHECK(length(trim(note))>=3),
	CONSTRAINT "credit_note_decisions_check_2" CHECK(auth_context IN('mfa_verified','owner_mfa_exception'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `credit_note_decisions_credit_id_idx` ON `credit_note_decisions` (`credit_id`);--> statement-breakpoint
CREATE TABLE `credit_note_issues` (
	`credit_id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`issued_at` text NOT NULL,
	FOREIGN KEY (`credit_id`) REFERENCES `credit_notes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `credit_note_issues_number_idx` ON `credit_note_issues` (`number`);--> statement-breakpoint
CREATE TABLE `credit_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`request_key` text NOT NULL,
	`invoice_id` text NOT NULL,
	`reverses_id` text,
	`direction` integer NOT NULL,
	`net_cents` integer NOT NULL,
	`tax_cents` integer NOT NULL,
	`source_json` text NOT NULL,
	`payload_json` text NOT NULL,
	`payload_hash` text NOT NULL,
	`operator_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `client_invoices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reverses_id`) REFERENCES `credit_notes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operator_id`) REFERENCES `operator_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "credit_notes_check_0" CHECK(direction IN(1,-1)),
	CONSTRAINT "credit_notes_check_1" CHECK(typeof(net_cents)='integer' AND net_cents>=0),
	CONSTRAINT "credit_notes_check_2" CHECK(typeof(tax_cents)='integer' AND tax_cents>=0),
	CONSTRAINT "credit_notes_check_3" CHECK(json_valid(source_json)),
	CONSTRAINT "credit_notes_check_4" CHECK(json_valid(payload_json)),
	CONSTRAINT "credit_notes_check_5" CHECK(length(payload_hash)=64),
	CONSTRAINT "credit_notes_check_6" CHECK(net_cents+tax_cents>0),
	CONSTRAINT "credit_notes_check_7" CHECK((direction=1 AND reverses_id IS NULL) OR (direction=-1 AND reverses_id IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `credit_notes_request_key_idx` ON `credit_notes` (`request_key`);
--> statement-breakpoint
CREATE VIEW credit_note_sources AS SELECT i.id AS invoice_id,i.booking_id,i.client_id,i.total_cents,i.subtotal_cents,i.tax_cents,v.recipient_user,v.source_json FROM client_invoices i JOIN finance_document_versions v ON v.id=(SELECT x.id FROM finance_document_versions x JOIN finance_document_issues n ON n.document_id=x.id WHERE x.kind='invoice' AND x.source_id=i.id ORDER BY x.version LIMIT 1) WHERE i.document_type='invoice' AND i.environment='production' AND i.integrity_state='production_verified';
--> statement-breakpoint
CREATE TRIGGER credit_note_prepare_guard BEFORE INSERT ON credit_notes BEGIN SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM credit_note_sources s WHERE s.invoice_id=NEW.invoice_id AND s.source_json=NEW.source_json AND json_extract(NEW.payload_json,'$.invoiceId')=NEW.invoice_id AND json_extract(NEW.payload_json,'$.netCents')=NEW.net_cents AND json_extract(NEW.payload_json,'$.taxCents')=NEW.tax_cents AND json_extract(NEW.payload_json,'$.reversesId') IS NEW.reverses_id AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=NEW.operator_id AND a.status='active' AND a.environment='production' AND a.integrity_state='production_verified' AND a.approval_limit_cents>=s.total_cents AND g.role='finance_approver' AND g.status='active' AND g.environment='production' AND g.integrity_state='production_verified') AND NEW.user_id<>s.recipient_user AND NEW.net_cents<=s.subtotal_cents AND NEW.tax_cents<=s.tax_cents AND (NEW.direction=1 OR EXISTS(SELECT 1 FROM credit_notes p JOIN credit_note_issues n ON n.credit_id=p.id WHERE p.id=NEW.reverses_id AND p.invoice_id=NEW.invoice_id AND p.direction=1 AND p.net_cents=NEW.net_cents AND p.tax_cents=NEW.tax_cents))) THEN RAISE(ABORT,'Credit source or authority invalid') END); END;
--> statement-breakpoint
CREATE TRIGGER credit_note_decision_guard BEFORE INSERT ON credit_note_decisions BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM credit_notes c JOIN credit_note_sources s ON s.invoice_id=c.invoice_id WHERE c.id=NEW.credit_id AND c.payload_hash=NEW.payload_hash AND c.operator_id<>NEW.operator_id AND c.user_id<>NEW.user_id AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=NEW.operator_id AND a.status='active' AND a.environment='production' AND a.integrity_state='production_verified' AND a.approval_limit_cents>=s.total_cents AND g.role='finance_approver' AND g.status='active' AND g.environment='production' AND g.integrity_state='production_verified') AND NEW.user_id<>s.recipient_user AND (NEW.decision='rejected' OR (EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=c.operator_id AND a.status='active' AND a.environment='production' AND a.integrity_state='production_verified' AND a.approval_limit_cents>=s.total_cents AND g.role='finance_approver' AND g.status='active' AND g.environment='production' AND g.integrity_state='production_verified') AND c.user_id<>s.recipient_user AND s.source_json=c.source_json))) THEN RAISE(ABORT,'Independent current credit approval required') END);
 SELECT (CASE WHEN NEW.decision='approved' AND EXISTS(SELECT 1 FROM credit_notes c JOIN credit_note_sources s ON s.invoice_id=c.invoice_id WHERE c.id=NEW.credit_id AND (c.direction*c.net_cents+coalesce((SELECT sum(p.direction*p.net_cents) FROM credit_notes p JOIN credit_note_issues n ON n.credit_id=p.id WHERE p.invoice_id=c.invoice_id),0) NOT BETWEEN 0 AND s.subtotal_cents OR c.direction*c.tax_cents+coalesce((SELECT sum(p.direction*p.tax_cents) FROM credit_notes p JOIN credit_note_issues n ON n.credit_id=p.id WHERE p.invoice_id=c.invoice_id),0) NOT BETWEEN 0 AND s.tax_cents OR (c.direction=-1 AND EXISTS(SELECT 1 FROM credit_notes p JOIN credit_note_issues n ON n.credit_id=p.id WHERE p.reverses_id=c.reverses_id)))) THEN RAISE(ABORT,'Credit capacity or correction already consumed') END);
END;
--> statement-breakpoint
CREATE TRIGGER credit_note_issue_guard BEFORE INSERT ON credit_note_issues BEGIN SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM credit_note_decisions d WHERE d.credit_id=NEW.credit_id AND d.decision='approved' AND d.created_at=NEW.issued_at AND NEW.number='LOKD-CN-'||upper(NEW.credit_id)) THEN RAISE(ABORT,'Approved credit number required') END); END;
--> statement-breakpoint
CREATE TRIGGER credit_note_issue_capacity BEFORE INSERT ON credit_note_issues BEGIN SELECT (CASE WHEN EXISTS(SELECT 1 FROM credit_notes c JOIN credit_note_sources s ON s.invoice_id=c.invoice_id WHERE c.id=NEW.credit_id AND (c.direction*c.net_cents+coalesce((SELECT sum(p.direction*p.net_cents) FROM credit_notes p JOIN credit_note_issues n ON n.credit_id=p.id WHERE p.invoice_id=c.invoice_id),0) NOT BETWEEN 0 AND s.subtotal_cents OR c.direction*c.tax_cents+coalesce((SELECT sum(p.direction*p.tax_cents) FROM credit_notes p JOIN credit_note_issues n ON n.credit_id=p.id WHERE p.invoice_id=c.invoice_id),0) NOT BETWEEN 0 AND s.tax_cents)) THEN RAISE(ABORT,'Credit capacity already consumed') END); END;
--> statement-breakpoint
CREATE VIEW credit_note_balances AS SELECT s.*,coalesce((SELECT sum(c.direction*(c.net_cents+c.tax_cents)) FROM credit_notes c JOIN credit_note_issues n ON n.credit_id=c.id WHERE c.invoice_id=s.invoice_id),0) AS credited_cents FROM credit_note_sources s;
--> statement-breakpoint
CREATE TRIGGER credit_notes_no_update BEFORE UPDATE ON credit_notes BEGIN SELECT RAISE(ABORT,'Credit history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER credit_notes_no_delete BEFORE DELETE ON credit_notes BEGIN SELECT RAISE(ABORT,'Credit history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER credit_note_decisions_no_update BEFORE UPDATE ON credit_note_decisions BEGIN SELECT RAISE(ABORT,'Credit history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER credit_note_decisions_no_delete BEFORE DELETE ON credit_note_decisions BEGIN SELECT RAISE(ABORT,'Credit history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER credit_note_issues_no_update BEFORE UPDATE ON credit_note_issues BEGIN SELECT RAISE(ABORT,'Credit history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER credit_note_issues_no_delete BEFORE DELETE ON credit_note_issues BEGIN SELECT RAISE(ABORT,'Credit history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER credit_notes_no_replace BEFORE INSERT ON credit_notes WHEN EXISTS(SELECT 1 FROM credit_notes WHERE id=NEW.id OR request_key=NEW.request_key) BEGIN SELECT RAISE(ABORT,'Credit history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER credit_note_decisions_no_replace BEFORE INSERT ON credit_note_decisions WHEN EXISTS(SELECT 1 FROM credit_note_decisions WHERE id=NEW.id OR credit_id=NEW.credit_id) BEGIN SELECT RAISE(ABORT,'Credit history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER credit_note_issues_no_replace BEFORE INSERT ON credit_note_issues WHEN EXISTS(SELECT 1 FROM credit_note_issues WHERE credit_id=NEW.credit_id OR number=NEW.number) BEGIN SELECT RAISE(ABORT,'Credit history is immutable'); END;
