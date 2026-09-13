CREATE TABLE `partner_payment_commands` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`version` integer NOT NULL,
	`action` text NOT NULL,
	`operator_id` text NOT NULL,
	`user_id` text NOT NULL,
	`source_hash` text NOT NULL,
	`recipient_hash` text,
	`note` text NOT NULL,
	`auth_method` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`reference`) REFERENCES `partner_payment_instructions`(`reference`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `partner_payment_command_version_idx` ON `partner_payment_commands` (`reference`,`version`);--> statement-breakpoint
CREATE TABLE `partner_payment_instructions` (
	`reference` text PRIMARY KEY NOT NULL,
	`payable_id` text NOT NULL,
	`destination_id` text NOT NULL,
	`mode` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`source_json` text NOT NULL,
	`source_hash` text NOT NULL,
	`request_key` text NOT NULL,
	`request_hash` text NOT NULL,
	`status` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`prepared_by` text NOT NULL,
	`prepared_user` text NOT NULL,
	`approved_by` text,
	`active_key` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`payable_id`) REFERENCES `partner_payables`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`destination_id`) REFERENCES `partner_destination_reviews`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `partner_payment_request_idx` ON `partner_payment_instructions` (`request_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `partner_payment_active_idx` ON `partner_payment_instructions` (`active_key`);--> statement-breakpoint
CREATE TABLE `partner_transfer_observations` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`source` text NOT NULL,
	`event` text NOT NULL,
	`payload_hash` text NOT NULL,
	`transfer_json` text NOT NULL,
	`webhook_count` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`reference`) REFERENCES `partner_payment_instructions`(`reference`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `partner_transfer_delivery_idx` ON `partner_transfer_observations` (`reference`,`source`,`payload_hash`);--> statement-breakpoint
CREATE INDEX `partner_transfer_reference_idx` ON `partner_transfer_observations` (`reference`);
--> statement-breakpoint
CREATE VIEW partner_payment_sources AS
SELECT p.id AS payable_id,d.id AS destination_id,d.mode,p.amount_cents,
 json_patch(json_object('payableId',p.id,'payableReviewId',r.id,'payableHash',r.payload_hash,'payableSource',r.source_json,'employerId',p.employer_id,'employerName',json_extract(r.source_json,'$.employerName'),'amountCents',p.amount_cents,'currency',p.currency,'invoiceNumber',json_extract(r.payload_json,'$.invoiceNumber'),'invoiceLine',json_extract(r.payload_json,'$.invoiceLine'),'dueDate',json_extract(r.payload_json,'$.dueDate'),'destinationId',d.id,'destinationHash',d.payload_hash,'recipient',json_extract(d.payload_json,'$.provider')),
 json_object('mode',d.mode,'representativeUser',json_extract(d.payload_json,'$.representativeUserId'),'officerUser',json_extract(r.source_json,'$.officerUser'),'clientUser',json_extract(r.source_json,'$.clientUser'))) AS source_json
FROM partner_payables p
JOIN production_partner_payable_current r ON p.id='PP-'||r.id AND r.status='approved'
JOIN partner_destination_current d ON d.employer_id=p.employer_id AND d.status=CASE d.mode WHEN 'test' THEN 'confirmed_test' ELSE 'verified_live' END
WHERE p.environment='production' AND p.integrity_state='production_verified' AND p.status='approved_unpaid' AND p.remittance_reference IS NULL
AND p.employer_id=r.employer_id AND p.timesheet_id=r.timesheet_id AND p.amount_cents=r.amount_cents AND p.amount_cents>0 AND p.amount_cents<=25000000 AND p.currency='ZAR'
AND p.service_agreement_version=json_extract(r.payload_json,'$.agreementVersion');
--> statement-breakpoint
CREATE TRIGGER partner_payment_insert BEFORE INSERT ON partner_payment_instructions BEGIN
 SELECT (CASE WHEN NEW.status!='prepared' OR NEW.version!=1 OR NEW.approved_by IS NOT NULL OR NEW.active_key IS NOT (NEW.payable_id||':'||NEW.mode)
 OR NOT EXISTS(SELECT 1 FROM partner_payment_sources s WHERE s.payable_id=NEW.payable_id AND s.destination_id=NEW.destination_id AND s.mode=NEW.mode AND s.amount_cents=NEW.amount_cents AND s.source_json=NEW.source_json AND NEW.prepared_user NOT IN (json_extract(s.source_json,'$.representativeUser'),json_extract(s.source_json,'$.officerUser'),json_extract(s.source_json,'$.clientUser')))
 OR NOT EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=NEW.prepared_by AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=NEW.amount_cents AND g.role='operations_controller' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active')
 THEN RAISE(ABORT,'Partner instruction source or authority changed') END);
END;
--> statement-breakpoint
CREATE TRIGGER partner_payment_command_insert BEFORE INSERT ON partner_payment_commands BEGIN
 SELECT (CASE WHEN NEW.auth_method NOT IN ('mfa_verified','owner_mfa_exception') OR julianday(NEW.created_at) IS NULL OR abs(julianday(NEW.created_at)-julianday('now'))>1.0/1440
 OR NOT EXISTS(SELECT 1 FROM partner_payment_instructions i JOIN operator_accounts a ON a.id=NEW.operator_id JOIN operator_role_assignments g ON g.operator_id=a.id WHERE i.reference=NEW.reference AND i.version=NEW.version AND i.source_hash=NEW.source_hash AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=i.amount_cents AND g.role='finance_approver' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active' AND NEW.user_id NOT IN (json_extract(i.source_json,'$.representativeUser'),json_extract(i.source_json,'$.officerUser'),json_extract(i.source_json,'$.clientUser'))
 AND ((NEW.action='cancel' AND i.status IN ('prepared','approved')) OR (NEW.action IN ('approve','dispatch_test') AND i.prepared_by!=NEW.operator_id AND i.prepared_user!=NEW.user_id AND ((NEW.action='approve' AND i.status='prepared') OR (NEW.action='dispatch_test' AND i.status='approved' AND i.mode='test' AND json_extract(i.source_json,'$.dueDate')<=date('now'))))))
 THEN RAISE(ABORT,'Partner instruction stage or independent finance authority changed') END);
 SELECT (CASE WHEN NEW.action!='cancel' AND NOT EXISTS(SELECT 1 FROM partner_payment_instructions i JOIN partner_payment_sources s ON s.payable_id=i.payable_id AND s.destination_id=i.destination_id AND s.source_json=i.source_json WHERE i.reference=NEW.reference
 AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=i.prepared_by AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=i.amount_cents AND g.role='operations_controller' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active')
 AND (NEW.action!='dispatch_test' OR (NEW.recipient_hash=json_extract((SELECT payload_json FROM partner_destination_reviews WHERE id=i.destination_id),'$.providerHash') AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=i.approved_by AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=i.amount_cents AND g.role='finance_approver' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active')))
 AND NOT EXISTS(SELECT 1 FROM partner_transfer_observations e WHERE e.reference=i.reference)) THEN RAISE(ABORT,'Partner source, destination or provider evidence changed') END);
END;
--> statement-breakpoint
CREATE TRIGGER partner_payment_update BEFORE UPDATE ON partner_payment_instructions BEGIN
 SELECT (CASE WHEN NEW.reference IS NOT OLD.reference OR NEW.payable_id IS NOT OLD.payable_id OR NEW.destination_id IS NOT OLD.destination_id OR NEW.mode IS NOT OLD.mode OR NEW.amount_cents IS NOT OLD.amount_cents OR NEW.source_json IS NOT OLD.source_json OR NEW.source_hash IS NOT OLD.source_hash OR NEW.request_key IS NOT OLD.request_key OR NEW.request_hash IS NOT OLD.request_hash OR NEW.prepared_by IS NOT OLD.prepared_by OR NEW.prepared_user IS NOT OLD.prepared_user OR NEW.created_at IS NOT OLD.created_at OR NEW.version!=OLD.version+1
 OR NOT EXISTS(SELECT 1 FROM partner_payment_commands c WHERE c.reference=OLD.reference AND c.version=OLD.version AND ((c.action='approve' AND NEW.status='approved' AND NEW.approved_by=c.operator_id AND NEW.active_key IS OLD.active_key) OR (c.action='cancel' AND NEW.status='cancelled' AND NEW.active_key IS NULL AND NEW.approved_by IS OLD.approved_by) OR (c.action='dispatch_test' AND NEW.status='dispatch_claimed' AND NEW.active_key IS OLD.active_key AND NEW.approved_by IS OLD.approved_by)))
 THEN RAISE(ABORT,'Partner instruction history or transition is invalid') END);
END;
--> statement-breakpoint
CREATE TRIGGER partner_transfer_observation_insert BEFORE INSERT ON partner_transfer_observations BEGIN
 SELECT (CASE WHEN NEW.source NOT IN ('initiate','verify','webhook','operations') OR NOT EXISTS(SELECT 1 FROM partner_payment_instructions i WHERE i.reference=NEW.reference AND i.mode='test') OR (NEW.source IN ('initiate','verify') AND NOT EXISTS(SELECT 1 FROM partner_payment_instructions i WHERE i.reference=NEW.reference AND i.status='dispatch_claimed'))
 OR (NEW.source='verify' AND NEW.webhook_count IS NOT (SELECT count(*) FROM partner_transfer_observations e WHERE e.reference=NEW.reference AND e.source='webhook'))
 THEN RAISE(ABORT,'Test transfer reference or webhook evidence changed') END);
END;

--> statement-breakpoint
CREATE TRIGGER partner_payment_instructions_delete BEFORE DELETE ON partner_payment_instructions BEGIN SELECT RAISE(ABORT,'Partner payment history is immutable'); END;

--> statement-breakpoint
CREATE TRIGGER partner_payment_commands_update BEFORE UPDATE ON partner_payment_commands BEGIN SELECT RAISE(ABORT,'Partner payment history is immutable'); END;

--> statement-breakpoint
CREATE TRIGGER partner_payment_commands_delete BEFORE DELETE ON partner_payment_commands BEGIN SELECT RAISE(ABORT,'Partner payment history is immutable'); END;

--> statement-breakpoint
CREATE TRIGGER partner_transfer_observations_update BEFORE UPDATE ON partner_transfer_observations BEGIN SELECT RAISE(ABORT,'Partner payment history is immutable'); END;

--> statement-breakpoint
CREATE TRIGGER partner_transfer_observations_delete BEFORE DELETE ON partner_transfer_observations BEGIN SELECT RAISE(ABORT,'Partner payment history is immutable'); END;
