CREATE TABLE `employee_payment_commands` (
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
	FOREIGN KEY (`reference`) REFERENCES `employee_payment_instructions`(`reference`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `employee_payment_command_version_idx` ON `employee_payment_commands` (`reference`,`version`);--> statement-breakpoint
CREATE TABLE `employee_payment_instructions` (
	`reference` text PRIMARY KEY NOT NULL,
	`payroll_item_id` text NOT NULL,
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
	FOREIGN KEY (`payroll_item_id`) REFERENCES `payroll_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`destination_id`) REFERENCES `payment_destination_reviews`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `employee_payment_request_idx` ON `employee_payment_instructions` (`request_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `employee_payment_active_idx` ON `employee_payment_instructions` (`active_key`);--> statement-breakpoint
CREATE TABLE `employee_transfer_observations` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`source` text NOT NULL,
	`event` text NOT NULL,
	`payload_hash` text NOT NULL,
	`transfer_json` text NOT NULL,
	`webhook_count` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`reference`) REFERENCES `employee_payment_instructions`(`reference`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `employee_transfer_delivery_idx` ON `employee_transfer_observations` (`reference`,`source`,`payload_hash`);--> statement-breakpoint
CREATE INDEX `employee_transfer_reference_idx` ON `employee_transfer_observations` (`reference`);--> statement-breakpoint
CREATE VIEW employee_payment_sources AS
SELECT i.id AS payroll_item_id,d.id AS destination_id,d.mode,i.net_pay_cents AS amount_cents,
 json_patch(json_object('payrollItemId',i.id,'runId',r.id,'runVersion',r.version,'calculationHash',s.payload_hash,'profileId',i.payroll_profile_id,'profileVersion',json_extract(j.value,'$.profileVersion'),'officerId',i.officer_id,'employerId',i.employer_id,'engagementId',i.workforce_engagement_id,'amountCents',i.net_pay_cents,'currency','ZAR','payDate',r.pay_date,'destinationId',d.id,'destinationHash',d.payload_hash,'recipient',json_extract(d.payload_json,'$.provider'),'ownerUser',json_extract(json_extract(d.payload_json,'$.sourceJson'),'$.ownerUser')),json_object('mode',d.mode)) AS source_json
FROM payroll_items i JOIN payroll_runs r ON r.id=i.payroll_run_id
JOIN production_payroll_snapshots s ON s.run_id=r.id
JOIN json_each(s.payload_json,'$.items') j ON json_extract(j.value,'$.id')=i.id
JOIN payroll_policy_versions p ON p.id=s.policy_id AND p.policy_hash=json_extract(s.payload_json,'$.policyHash') AND p.status='active' AND p.active_key='production:ZA'
JOIN payment_destination_current d ON d.profile_id=i.payroll_profile_id AND d.officer_id=i.officer_id AND d.status=CASE d.mode WHEN 'test' THEN 'confirmed_test' ELSE 'verified_live' END
WHERE r.environment='production' AND r.integrity_state='production_verified' AND r.status='exported' AND r.export_reference='payroll-snapshot:'||s.payload_hash
AND i.environment='production' AND i.integrity_state='production_verified' AND i.status='calculated' AND i.workforce_model IN ('direct_flex','managed') AND i.net_pay_cents>0 AND i.net_pay_cents<=25000000
AND i.net_pay_cents=json_extract(j.value,'$.calculation.netPayCents') AND i.officer_id=json_extract(j.value,'$.officerId') AND i.payroll_profile_id=json_extract(j.value,'$.profileId') AND i.workforce_engagement_id=json_extract(j.value,'$.engagementId') AND i.employer_id=r.employer_id
AND json_extract(j.value,'$.profileVersion')=json_extract(json_extract(d.payload_json,'$.sourceJson'),'$.profileVersion')
AND i.workforce_engagement_id=json_extract(json_extract(d.payload_json,'$.sourceJson'),'$.engagementId') AND i.employer_id=json_extract(json_extract(d.payload_json,'$.sourceJson'),'$.employerId')
AND NOT EXISTS(SELECT 1 FROM json_each(json_array(json_object('id',r.created_by,'role','payroll_preparer'),json_object('id',r.approved_by,'role','payroll_reviewer'),json_object('id',r.second_approved_by,'role','finance_approver'))) required WHERE NOT EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=json_extract(required.value,'$.id') AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=r.net_pay_cents AND g.role=json_extract(required.value,'$.role') AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active'));
--> statement-breakpoint
CREATE TRIGGER employee_payment_insert BEFORE INSERT ON employee_payment_instructions BEGIN
 SELECT (CASE WHEN NEW.status!='prepared' OR NEW.version!=1 OR NEW.approved_by IS NOT NULL OR NEW.active_key IS NOT (NEW.payroll_item_id||':'||NEW.mode)
 OR NOT EXISTS(SELECT 1 FROM employee_payment_sources s WHERE s.payroll_item_id=NEW.payroll_item_id AND s.destination_id=NEW.destination_id AND s.mode=NEW.mode AND s.amount_cents=NEW.amount_cents AND s.source_json=NEW.source_json AND json_extract(s.source_json,'$.ownerUser')!=NEW.prepared_user)
 OR NOT EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=NEW.prepared_by AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=NEW.amount_cents AND g.role='payroll_preparer' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active')
 THEN RAISE(ABORT,'Employee instruction source or authority changed') END);
END;
--> statement-breakpoint
CREATE TRIGGER employee_payment_command_insert BEFORE INSERT ON employee_payment_commands BEGIN
 SELECT (CASE WHEN NEW.auth_method NOT IN ('mfa_verified','owner_mfa_exception') OR julianday(NEW.created_at) IS NULL OR abs(julianday(NEW.created_at)-julianday('now'))>1.0/1440
 OR NOT EXISTS(SELECT 1 FROM employee_payment_instructions i JOIN operator_accounts a ON a.id=NEW.operator_id JOIN operator_role_assignments g ON g.operator_id=a.id WHERE i.reference=NEW.reference AND i.version=NEW.version AND i.source_hash=NEW.source_hash AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=i.amount_cents AND g.role='finance_approver' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active' AND json_extract(i.source_json,'$.ownerUser')!=NEW.user_id
 AND ((NEW.action='cancel' AND i.status IN ('prepared','approved')) OR (NEW.action IN ('approve','dispatch_test') AND i.prepared_by!=NEW.operator_id AND i.prepared_user!=NEW.user_id AND ((NEW.action='approve' AND i.status='prepared') OR (NEW.action='dispatch_test' AND i.status='approved' AND i.mode='test' AND json_extract(i.source_json,'$.payDate')<=date('now'))))))
 THEN RAISE(ABORT,'Employee instruction stage or independent finance authority changed') END);
 SELECT (CASE WHEN NEW.action!='cancel' AND NOT EXISTS(SELECT 1 FROM employee_payment_instructions i JOIN employee_payment_sources s ON s.payroll_item_id=i.payroll_item_id AND s.destination_id=i.destination_id AND s.source_json=i.source_json WHERE i.reference=NEW.reference
 AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=i.prepared_by AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=i.amount_cents AND g.role='payroll_preparer' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active')
 AND (NEW.action!='dispatch_test' OR (NEW.recipient_hash=json_extract((SELECT payload_json FROM payment_destination_reviews WHERE id=i.destination_id),'$.providerHash') AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=i.approved_by AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=i.amount_cents AND g.role='finance_approver' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active')))
 AND NOT EXISTS(SELECT 1 FROM employee_transfer_observations e WHERE e.reference=i.reference)) THEN RAISE(ABORT,'Employee source, destination or provider evidence changed') END);
END;
--> statement-breakpoint
CREATE TRIGGER employee_payment_update BEFORE UPDATE ON employee_payment_instructions BEGIN
 SELECT (CASE WHEN NEW.reference IS NOT OLD.reference OR NEW.payroll_item_id IS NOT OLD.payroll_item_id OR NEW.destination_id IS NOT OLD.destination_id OR NEW.mode IS NOT OLD.mode OR NEW.amount_cents IS NOT OLD.amount_cents OR NEW.source_json IS NOT OLD.source_json OR NEW.source_hash IS NOT OLD.source_hash OR NEW.request_key IS NOT OLD.request_key OR NEW.request_hash IS NOT OLD.request_hash OR NEW.prepared_by IS NOT OLD.prepared_by OR NEW.prepared_user IS NOT OLD.prepared_user OR NEW.created_at IS NOT OLD.created_at OR NEW.version!=OLD.version+1
 OR NOT EXISTS(SELECT 1 FROM employee_payment_commands c WHERE c.reference=OLD.reference AND c.version=OLD.version AND ((c.action='approve' AND NEW.status='approved' AND NEW.approved_by=c.operator_id AND NEW.active_key IS OLD.active_key) OR (c.action='cancel' AND NEW.status='cancelled' AND NEW.active_key IS NULL AND NEW.approved_by IS OLD.approved_by) OR (c.action='dispatch_test' AND NEW.status='dispatch_claimed' AND NEW.active_key IS OLD.active_key AND NEW.approved_by IS OLD.approved_by)))
 THEN RAISE(ABORT,'Employee instruction history or transition is invalid') END);
END;
--> statement-breakpoint
CREATE TRIGGER employee_transfer_observation_insert BEFORE INSERT ON employee_transfer_observations BEGIN
 SELECT (CASE WHEN NEW.source NOT IN ('initiate','verify','webhook','operations') OR NOT EXISTS(SELECT 1 FROM employee_payment_instructions i WHERE i.reference=NEW.reference AND i.mode='test') OR (NEW.source IN ('initiate','verify') AND NOT EXISTS(SELECT 1 FROM employee_payment_instructions i WHERE i.reference=NEW.reference AND i.status='dispatch_claimed'))
 OR (NEW.source='verify' AND NEW.webhook_count IS NOT (SELECT count(*) FROM employee_transfer_observations e WHERE e.reference=NEW.reference AND e.source='webhook'))
 THEN RAISE(ABORT,'Test transfer reference or webhook evidence changed') END);
END;

--> statement-breakpoint
CREATE TRIGGER employee_payment_instructions_delete BEFORE DELETE ON employee_payment_instructions BEGIN SELECT RAISE(ABORT,'Employee payment history is immutable'); END;

--> statement-breakpoint
CREATE TRIGGER employee_payment_commands_update BEFORE UPDATE ON employee_payment_commands BEGIN SELECT RAISE(ABORT,'Employee payment history is immutable'); END;

--> statement-breakpoint
CREATE TRIGGER employee_payment_commands_delete BEFORE DELETE ON employee_payment_commands BEGIN SELECT RAISE(ABORT,'Employee payment history is immutable'); END;

--> statement-breakpoint
CREATE TRIGGER employee_transfer_observations_update BEFORE UPDATE ON employee_transfer_observations BEGIN SELECT RAISE(ABORT,'Employee payment history is immutable'); END;

--> statement-breakpoint
CREATE TRIGGER employee_transfer_observations_delete BEFORE DELETE ON employee_transfer_observations BEGIN SELECT RAISE(ABORT,'Employee payment history is immutable'); END;
