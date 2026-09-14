CREATE TABLE `finance_command_applications` (
	`command_id` text PRIMARY KEY NOT NULL,
	`reviewer_user_id` text NOT NULL,
	`reviewer_version` integer NOT NULL,
	`decision` text NOT NULL,
	`digest` text NOT NULL,
	`findings` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`command_id`) REFERENCES `finance_workflow_commands`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "finance_command_applications_check_0" CHECK(decision IN('approved','rejected')),
	CONSTRAINT "finance_command_applications_check_1" CHECK(length(trim(findings))>=3)
);
--> statement-breakpoint
CREATE TABLE `finance_journals` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`command_id` text NOT NULL,
	`entries_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `finance_workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`command_id`) REFERENCES `finance_workflow_commands`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "finance_journals_check_0" CHECK(json_valid(entries_json))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `finance_journals_unique_0` ON `finance_journals` (`command_id`);--> statement-breakpoint
CREATE TABLE `finance_members` (
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`version` integer NOT NULL,
	`role` text NOT NULL,
	`limit_cents` integer NOT NULL,
	`active` integer NOT NULL,
	PRIMARY KEY(`workspace_id`, `user_id`, `version`),
	FOREIGN KEY (`workspace_id`) REFERENCES `finance_workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "finance_members_check_0" CHECK(version>0),
	CONSTRAINT "finance_members_check_1" CHECK(role IN('preparer','reviewer','client','officer','trainer')),
	CONSTRAINT "finance_members_check_2" CHECK(typeof(limit_cents)='integer' AND limit_cents>=0),
	CONSTRAINT "finance_members_check_3" CHECK(active IN(0,1))
);
--> statement-breakpoint
CREATE TABLE `finance_provider_claims` (
	`workspace_id` text NOT NULL,
	`operation_id` text NOT NULL,
	`attempt` integer NOT NULL,
	`reference` text NOT NULL,
	`provider_mode` text NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`workspace_id`, `operation_id`, `attempt`),
	FOREIGN KEY (`workspace_id`) REFERENCES `finance_workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "finance_provider_claims_check_0" CHECK(attempt>0),
	CONSTRAINT "finance_provider_claims_check_1" CHECK(provider_mode IN('simulator','paystack_test')),
	CONSTRAINT "finance_provider_claims_check_2" CHECK(json_valid(payload_json))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `finance_provider_claims_unique_0` ON `finance_provider_claims` (`workspace_id`,`reference`,`attempt`);--> statement-breakpoint
CREATE TABLE `finance_provider_conflicts` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`operation_id` text NOT NULL,
	`event_key` text NOT NULL,
	`digest` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `finance_workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `finance_provider_evidence` (
	`sequence` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` text NOT NULL,
	`operation_id` text NOT NULL,
	`source` text NOT NULL,
	`event_key` text NOT NULL,
	`body_json` text NOT NULL,
	`digest` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `finance_workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "finance_provider_evidence_check_0" CHECK(source IN('api','webhook','bank')),
	CONSTRAINT "finance_provider_evidence_check_1" CHECK(json_valid(body_json))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `finance_provider_evidence_unique_0` ON `finance_provider_evidence` (`workspace_id`,`source`,`event_key`);--> statement-breakpoint
CREATE TABLE `finance_records` (
	`sequence` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` text NOT NULL,
	`id` text NOT NULL,
	`kind` text NOT NULL,
	`version` integer NOT NULL,
	`owner_user_id` text NOT NULL,
	`policy_version` text NOT NULL,
	`data_json` text NOT NULL,
	`digest` text NOT NULL,
	`command_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `finance_workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`policy_version`) REFERENCES `finance_workflow_policies`(`version`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "finance_records_check_0" CHECK(version>0),
	CONSTRAINT "finance_records_check_1" CHECK(json_valid(data_json))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `finance_records_unique_0` ON `finance_records` (`workspace_id`,`id`,`version`);--> statement-breakpoint
CREATE TABLE `finance_source_claims` (
	`workspace_id` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`source_version` text NOT NULL,
	`consumer_id` text NOT NULL,
	`command_id` text NOT NULL,
	PRIMARY KEY(`workspace_id`, `source_type`, `source_id`),
	FOREIGN KEY (`workspace_id`) REFERENCES `finance_workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`command_id`) REFERENCES `finance_workflow_commands`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `finance_provider_identity_unique` ON `finance_source_claims` (`source_id`) WHERE source_type='provider-identity';--> statement-breakpoint
CREATE TABLE `finance_workflow_commands` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`request_key` text NOT NULL,
	`input_json` text NOT NULL,
	`plan_json` text NOT NULL,
	`digest` text NOT NULL,
	`policy_version` text NOT NULL,
	`maker_user_id` text NOT NULL,
	`maker_version` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `finance_workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`policy_version`) REFERENCES `finance_workflow_policies`(`version`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "finance_workflow_commands_check_0" CHECK(json_valid(input_json)),
	CONSTRAINT "finance_workflow_commands_check_1" CHECK(json_valid(plan_json)),
	CONSTRAINT "finance_workflow_commands_check_2" CHECK(typeof(amount_cents)='integer' AND amount_cents>=0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `finance_workflow_commands_unique_0` ON `finance_workflow_commands` (`workspace_id`,`request_key`);--> statement-breakpoint
CREATE TABLE `finance_workflow_policies` (
	`version` text PRIMARY KEY NOT NULL,
	`environment` text NOT NULL,
	`rules_json` text NOT NULL,
	`digest` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "finance_workflow_policies_check_0" CHECK(environment='sandbox'),
	CONSTRAINT "finance_workflow_policies_check_1" CHECK(json_valid(rules_json) AND json_extract(rules_json,'$.environment')='sandbox' AND json_extract(rules_json,'$.fictional')=1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `finance_workflow_policies_unique_0` ON `finance_workflow_policies` (`digest`);--> statement-breakpoint
CREATE TABLE `finance_workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`environment` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "finance_workspaces_check_0" CHECK(environment='sandbox')
);

--> statement-breakpoint
CREATE VIEW finance_current_members AS SELECT m.* FROM finance_members m WHERE version=(SELECT max(version) FROM finance_members p WHERE p.workspace_id=m.workspace_id AND p.user_id=m.user_id);
--> statement-breakpoint
CREATE VIEW finance_current_records AS SELECT r.* FROM finance_records r WHERE version=(SELECT max(version) FROM finance_records p WHERE p.workspace_id=r.workspace_id AND p.id=r.id);
--> statement-breakpoint
CREATE VIEW finance_balances AS SELECT j.workspace_id,json_extract(e.value,'$.account') AS account,sum(json_extract(e.value,'$.delta')) AS balance FROM finance_journals j,json_each(j.entries_json) e GROUP BY j.workspace_id,json_extract(e.value,'$.account');
--> statement-breakpoint
CREATE TRIGGER finance_apply_guard BEFORE INSERT ON finance_command_applications BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM finance_workflow_commands c JOIN finance_current_members reviewer ON reviewer.workspace_id=c.workspace_id AND reviewer.user_id=NEW.reviewer_user_id WHERE c.id=NEW.command_id AND c.digest=NEW.digest AND c.maker_user_id<>NEW.reviewer_user_id AND reviewer.active=1 AND reviewer.role='reviewer' AND reviewer.version=NEW.reviewer_version AND reviewer.limit_cents>=c.amount_cents AND (NEW.decision='rejected' OR (EXISTS(SELECT 1 FROM finance_current_members maker WHERE maker.workspace_id=c.workspace_id AND maker.user_id=c.maker_user_id AND maker.active=1 AND maker.version=c.maker_version AND maker.limit_cents>=c.amount_cents) AND NOT EXISTS(SELECT 1 FROM json_each(c.plan_json,'$.basis') b WHERE coalesce((SELECT version FROM finance_current_records r WHERE r.workspace_id=c.workspace_id AND r.id=json_extract(b.value,'$.id')),0)<>json_extract(b.value,'$.version'))))) THEN RAISE(ABORT,'Independent current finance approval required') END;
END;
--> statement-breakpoint
CREATE TRIGGER finance_record_guard BEFORE INSERT ON finance_records BEGIN
 SELECT CASE WHEN NEW.version<>coalesce((SELECT max(version)+1 FROM finance_records WHERE workspace_id=NEW.workspace_id AND id=NEW.id),1) OR NOT EXISTS(SELECT 1 FROM finance_workflow_commands c JOIN finance_command_applications a ON a.command_id=c.id AND a.decision='approved' WHERE c.id=NEW.command_id AND c.workspace_id=NEW.workspace_id AND c.policy_version=NEW.policy_version AND EXISTS(SELECT 1 FROM json_each(c.plan_json,'$.records') r WHERE json_extract(r.value,'$.id')=NEW.id AND json_extract(r.value,'$.version')=NEW.version AND json_extract(r.value,'$.kind')=NEW.kind AND json_extract(r.value,'$.owner')=NEW.owner_user_id AND json(json_extract(r.value,'$.data'))=json(NEW.data_json))) THEN RAISE(ABORT,'Approved immutable record version required') END;
END;
--> statement-breakpoint
CREATE TRIGGER finance_journal_guard BEFORE INSERT ON finance_journals BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM finance_workflow_commands c JOIN finance_command_applications a ON a.command_id=c.id AND a.decision='approved' WHERE c.id=NEW.command_id AND c.workspace_id=NEW.workspace_id AND json(json_extract(c.plan_json,'$.entries'))=json(NEW.entries_json)) OR json_type(NEW.entries_json)<>'array' OR coalesce((SELECT sum(json_extract(value,'$.delta')) FROM json_each(NEW.entries_json)),0)<>0 OR EXISTS(SELECT 1 FROM json_each(NEW.entries_json) WHERE typeof(json_extract(value,'$.delta'))<>'integer' OR abs(json_extract(value,'$.delta'))>100000000 OR length(json_extract(value,'$.account'))<3) THEN RAISE(ABORT,'Conserving approved journal required') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM (SELECT json_extract(value,'$.account') AS account,sum(json_extract(value,'$.delta')) AS delta FROM json_each(NEW.entries_json) GROUP BY account) n WHERE (n.account LIKE 'cash:%' OR n.account LIKE 'allocation:%' OR n.account LIKE 'reserve:%' OR n.account LIKE 'hold:%') AND n.delta+coalesce((SELECT balance FROM finance_balances b WHERE b.workspace_id=NEW.workspace_id AND b.account=n.account),0)<0) THEN RAISE(ABORT,'Funds already used or unavailable') END;
END;
--> statement-breakpoint
CREATE TRIGGER finance_source_guard BEFORE INSERT ON finance_source_claims BEGIN SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM finance_workflow_commands c JOIN finance_command_applications a ON a.command_id=c.id AND a.decision='approved' WHERE c.id=NEW.command_id AND c.workspace_id=NEW.workspace_id AND EXISTS(SELECT 1 FROM json_each(c.plan_json,'$.claims') q WHERE json_extract(q.value,'$.type')=NEW.source_type AND json_extract(q.value,'$.id')=NEW.source_id AND json_extract(q.value,'$.version')=NEW.source_version AND json_extract(q.value,'$.consumer')=NEW.consumer_id)) THEN RAISE(ABORT,'Approved source allocation required') END; END;
--> statement-breakpoint
CREATE TRIGGER finance_evidence_basis_guard BEFORE INSERT ON finance_command_applications WHEN NEW.decision='approved' BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM finance_workflow_commands c,json_each(c.plan_json,'$.evidence') e WHERE c.id=NEW.command_id AND coalesce((SELECT max(sequence) FROM finance_provider_evidence p WHERE p.workspace_id=c.workspace_id AND p.operation_id=json_extract(e.value,'$.operation')),0)<>json_extract(e.value,'$.sequence')) THEN RAISE(ABORT,'Payment evidence changed; review again') END;
END;
--> statement-breakpoint
CREATE TRIGGER finance_provider_claim_guard BEFORE INSERT ON finance_provider_claims BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM finance_current_records r WHERE r.workspace_id=NEW.workspace_id AND r.id=NEW.operation_id AND r.kind='operation' AND json_extract(r.data_json,'$.state')='authorized' AND json_extract(r.data_json,'$.attempt')=NEW.attempt AND json_extract(r.data_json,'$.reference')=NEW.reference AND json(r.data_json)=json(NEW.payload_json)
 AND EXISTS(SELECT 1 FROM finance_workflow_commands c JOIN finance_command_applications a ON a.command_id=c.id JOIN finance_current_members m ON m.workspace_id=c.workspace_id AND m.user_id=c.maker_user_id JOIN finance_current_members v ON v.workspace_id=c.workspace_id AND v.user_id=a.reviewer_user_id WHERE c.id=r.command_id AND m.active=1 AND m.version=c.maker_version AND v.active=1 AND v.version=a.reviewer_version)
 AND (json_extract(r.data_json,'$.destinationId') IS NULL OR EXISTS(SELECT 1 FROM finance_current_records d WHERE d.workspace_id=r.workspace_id AND d.id=json_extract(r.data_json,'$.destinationId') AND d.kind='destination' AND d.version=json_extract(r.data_json,'$.destinationVersion')))
 AND (json_extract(r.data_json,'$.kind')='refund' OR EXISTS(SELECT 1 FROM finance_current_records o WHERE o.workspace_id=r.workspace_id AND o.id=json_extract(r.data_json,'$.orderId') AND json_extract(o.data_json,'$.state') NOT IN('disputed','cancelled','charged_back')))) THEN RAISE(ABORT,'Exact independently authorized operation required') END;
END;
--> statement-breakpoint
CREATE TRIGGER finance_source_timesheet_approval_guard BEFORE INSERT ON finance_command_applications WHEN NEW.decision='approved' BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM finance_workflow_commands c,json_each(c.plan_json,'$.checks') q WHERE c.id=NEW.command_id AND json_extract(q.value,'$.kind')='timesheet' AND NOT EXISTS(SELECT 1 FROM shift_timesheets s WHERE s.id=json_extract(q.value,'$.id') AND s.operations_status='approved_for_backend' AND s.client_evidence_status='confirmed' AND s.id IS json_extract(q.value,'$.value.id') AND s.version IS json_extract(q.value,'$.value.version') AND s.shift_id IS json_extract(q.value,'$.value.shift_id') AND s.booking_id IS json_extract(q.value,'$.value.booking_id') AND s.officer_id IS json_extract(q.value,'$.value.officer_id') AND s.employer_id IS json_extract(q.value,'$.value.employer_id') AND s.workforce_engagement_id IS json_extract(q.value,'$.value.workforce_engagement_id') AND s.workforce_model IS json_extract(q.value,'$.value.workforce_model') AND s.gross_wage_cents IS json_extract(q.value,'$.value.gross_wage_cents') AND s.payable_minutes IS json_extract(q.value,'$.value.payable_minutes') AND s.service_date IS json_extract(q.value,'$.value.service_date') AND s.operations_status IS json_extract(q.value,'$.value.operations_status') AND s.client_evidence_status IS json_extract(q.value,'$.value.client_evidence_status'))) THEN RAISE(ABORT,'Canonical source changed before approval') END;
END;
--> statement-breakpoint
CREATE TRIGGER finance_source_booking_approval_guard BEFORE INSERT ON finance_command_applications WHEN NEW.decision='approved' BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM finance_workflow_commands c,json_each(c.plan_json,'$.checks') q WHERE c.id=NEW.command_id AND json_extract(q.value,'$.kind')='booking' AND NOT EXISTS(SELECT 1 FROM bookings s WHERE s.id=json_extract(q.value,'$.id') AND s.id IS json_extract(q.value,'$.value.id') AND s.client_id IS json_extract(q.value,'$.value.client_id') AND s.client_price_cents IS json_extract(q.value,'$.value.client_price_cents') AND s.service_type IS json_extract(q.value,'$.value.service_type') AND s.pricing_version IS json_extract(q.value,'$.value.pricing_version') AND s.start_date IS json_extract(q.value,'$.value.start_date') AND s.end_date IS json_extract(q.value,'$.value.end_date'))) THEN RAISE(ABORT,'Canonical source changed before approval') END;
END;
--> statement-breakpoint
CREATE TRIGGER finance_source_application_approval_guard BEFORE INSERT ON finance_command_applications WHEN NEW.decision='approved' BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM finance_workflow_commands c,json_each(c.plan_json,'$.checks') q WHERE c.id=NEW.command_id AND json_extract(q.value,'$.kind')='application' AND NOT EXISTS(SELECT 1 FROM signup_cases s WHERE s.source_id=json_extract(q.value,'$.id') AND s.kind IS json_extract(q.value,'$.value.kind') AND s.source_id IS json_extract(q.value,'$.value.source_id') AND s.owner_user_id IS json_extract(q.value,'$.value.owner_user_id') AND s.version IS json_extract(q.value,'$.value.version') AND s.status IS json_extract(q.value,'$.value.status'))) THEN RAISE(ABORT,'Canonical source changed before approval') END;
END;
--> statement-breakpoint
CREATE TRIGGER finance_final_approval_guard BEFORE INSERT ON finance_command_applications WHEN NEW.decision='approved' BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM finance_workflow_commands c,json_each(c.plan_json,'$.evidence') e WHERE c.id=NEW.command_id AND (julianday(NEW.created_at)>julianday(json_extract(e.value,'$.expiresAt')) OR NOT EXISTS(SELECT 1 FROM finance_current_members m WHERE m.workspace_id=c.workspace_id AND m.user_id=json_extract(e.value,'$.attester') AND m.version=json_extract(e.value,'$.attesterVersion') AND m.role='reviewer' AND m.active=1 AND m.user_id<>c.maker_user_id) OR EXISTS(SELECT 1 FROM finance_provider_conflicts f WHERE f.workspace_id=c.workspace_id AND f.operation_id=json_extract(e.value,'$.operation')))) THEN RAISE(ABORT,'Fresh uncontradicted evidence required') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM finance_workflow_commands c,json_each(c.plan_json,'$.unsubmitted') u JOIN finance_provider_claims p ON p.workspace_id=c.workspace_id AND p.operation_id=u.value WHERE c.id=NEW.command_id) THEN RAISE(ABORT,'A claimed operation cannot be cancelled') END;
END;
--> statement-breakpoint
CREATE TRIGGER finance_conflicting_funding_guard BEFORE INSERT ON finance_command_applications WHEN NEW.decision='approved' BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM finance_workflow_commands c,json_each(c.plan_json,'$.basis') b JOIN finance_current_records o ON o.workspace_id=c.workspace_id AND o.id=json_extract(b.value,'$.id') AND o.kind='order' JOIN finance_current_records p ON p.workspace_id=o.workspace_id AND p.kind='operation' AND json_extract(p.data_json,'$.orderId')=o.id WHERE c.id=NEW.command_id AND json_extract(c.input_json,'$.action') NOT IN('reconcile_operation','resolve_dispute','cancel_unsubmitted') AND (EXISTS(SELECT 1 FROM finance_provider_conflicts f WHERE f.workspace_id=p.workspace_id AND f.operation_id=p.id) OR (json_extract(p.data_json,'$.state')='paid' AND EXISTS(SELECT 1 FROM finance_provider_evidence e WHERE e.workspace_id=p.workspace_id AND e.operation_id=p.id AND e.sequence>coalesce(json_extract(p.data_json,'$.evidenceThrough'),0) AND json_extract(e.body_json,'$.status')<>'success')))) THEN RAISE(ABORT,'Contradictory evidence holds funding') END;
END;
--> statement-breakpoint
CREATE TRIGGER finance_export_source_guard BEFORE INSERT ON finance_command_applications WHEN NEW.decision='approved' BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM finance_workflow_commands c,json_each(c.plan_json,'$.checks') q WHERE c.id=NEW.command_id AND json_extract(q.value,'$.kind')='payroll' AND NOT EXISTS(SELECT 1 FROM payroll_items i JOIN payroll_runs r ON r.id=i.payroll_run_id JOIN production_payroll_snapshots s ON s.run_id=r.id WHERE i.id=json_extract(q.value,'$.id') AND r.status='exported' AND r.export_reference=json_extract(q.value,'$.value.export_reference') AND s.payload_hash=json_extract(q.value,'$.value.payload_hash') AND i.gross_wage_cents=json_extract(q.value,'$.value.gross_wage_cents') AND i.net_pay_cents=json_extract(q.value,'$.value.net_pay_cents') AND i.employee_deduction_cents=json_extract(q.value,'$.value.employee_deduction_cents') AND i.employer_cost_cents=json_extract(q.value,'$.value.employer_cost_cents'))) THEN RAISE(ABORT,'Original exported payroll changed before adoption') END;
END;
--> statement-breakpoint
CREATE TRIGGER finance_provider_funding_guard BEFORE INSERT ON finance_provider_claims BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM finance_current_records p WHERE p.workspace_id=NEW.workspace_id AND p.kind='operation' AND json_extract(p.data_json,'$.orderId')=json_extract(NEW.payload_json,'$.orderId') AND (EXISTS(SELECT 1 FROM finance_provider_conflicts f WHERE f.workspace_id=p.workspace_id AND f.operation_id=p.id) OR (json_extract(p.data_json,'$.state')='paid' AND EXISTS(SELECT 1 FROM finance_provider_evidence e WHERE e.workspace_id=p.workspace_id AND e.operation_id=p.id AND e.sequence>coalesce(json_extract(p.data_json,'$.evidenceThrough'),0) AND json_extract(e.body_json,'$.status')<>'success')))) THEN RAISE(ABORT,'Payment evidence changed before provider claim') END;
END;
--> statement-breakpoint
CREATE TRIGGER finance_provider_conflicts_no_update BEFORE UPDATE ON finance_provider_conflicts BEGIN SELECT RAISE(ABORT,'Finance workflow history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER finance_provider_conflicts_no_delete BEFORE DELETE ON finance_provider_conflicts BEGIN SELECT RAISE(ABORT,'Finance workflow history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER finance_provider_conflicts_no_replace BEFORE INSERT ON finance_provider_conflicts WHEN EXISTS(SELECT 1 FROM finance_provider_conflicts WHERE id=NEW.id) BEGIN SELECT RAISE(ABORT,'Finance workflow history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER finance_workspaces_no_update BEFORE UPDATE ON finance_workspaces BEGIN SELECT RAISE(ABORT,'Finance workflow history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER finance_workspaces_no_delete BEFORE DELETE ON finance_workspaces BEGIN SELECT RAISE(ABORT,'Finance workflow history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER finance_workspaces_no_replace BEFORE INSERT ON finance_workspaces WHEN EXISTS(SELECT 1 FROM finance_workspaces WHERE id=NEW.id) BEGIN SELECT RAISE(ABORT,'Finance workflow history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER finance_workflow_policies_no_update BEFORE UPDATE ON finance_workflow_policies BEGIN SELECT RAISE(ABORT,'Finance workflow history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER finance_workflow_policies_no_delete BEFORE DELETE ON finance_workflow_policies BEGIN SELECT RAISE(ABORT,'Finance workflow history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER finance_workflow_policies_no_replace BEFORE INSERT ON finance_workflow_policies WHEN EXISTS(SELECT 1 FROM finance_workflow_policies WHERE version=NEW.version OR digest=NEW.digest) BEGIN SELECT RAISE(ABORT,'Finance workflow history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER finance_members_no_update BEFORE UPDATE ON finance_members BEGIN SELECT RAISE(ABORT,'Finance workflow history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER finance_members_no_delete BEFORE DELETE ON finance_members BEGIN SELECT RAISE(ABORT,'Finance workflow history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER finance_members_no_replace BEFORE INSERT ON finance_members WHEN EXISTS(SELECT 1 FROM finance_members WHERE workspace_id=NEW.workspace_id AND user_id=NEW.user_id AND version=NEW.version) BEGIN SELECT RAISE(ABORT,'Finance workflow history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER finance_records_no_update BEFORE UPDATE ON finance_records BEGIN SELECT RAISE(ABORT,'Finance workflow history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER finance_records_no_delete BEFORE DELETE ON finance_records BEGIN SELECT RAISE(ABORT,'Finance workflow history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER finance_records_no_replace BEFORE INSERT ON finance_records WHEN EXISTS(SELECT 1 FROM finance_records WHERE sequence=NEW.sequence OR (workspace_id=NEW.workspace_id AND id=NEW.id AND version=NEW.version)) BEGIN SELECT RAISE(ABORT,'Finance workflow history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER finance_workflow_commands_no_update BEFORE UPDATE ON finance_workflow_commands BEGIN SELECT RAISE(ABORT,'Finance workflow history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER finance_workflow_commands_no_delete BEFORE DELETE ON finance_workflow_commands BEGIN SELECT RAISE(ABORT,'Finance workflow history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER finance_workflow_commands_no_replace BEFORE INSERT ON finance_workflow_commands WHEN EXISTS(SELECT 1 FROM finance_workflow_commands WHERE id=NEW.id OR (workspace_id=NEW.workspace_id AND request_key=NEW.request_key)) BEGIN SELECT RAISE(ABORT,'Finance workflow history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER finance_command_applications_no_update BEFORE UPDATE ON finance_command_applications BEGIN SELECT RAISE(ABORT,'Finance workflow history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER finance_command_applications_no_delete BEFORE DELETE ON finance_command_applications BEGIN SELECT RAISE(ABORT,'Finance workflow history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER finance_command_applications_no_replace BEFORE INSERT ON finance_command_applications WHEN EXISTS(SELECT 1 FROM finance_command_applications WHERE command_id=NEW.command_id) BEGIN SELECT RAISE(ABORT,'Finance workflow history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER finance_journals_no_update BEFORE UPDATE ON finance_journals BEGIN SELECT RAISE(ABORT,'Finance workflow history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER finance_journals_no_delete BEFORE DELETE ON finance_journals BEGIN SELECT RAISE(ABORT,'Finance workflow history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER finance_journals_no_replace BEFORE INSERT ON finance_journals WHEN EXISTS(SELECT 1 FROM finance_journals WHERE id=NEW.id OR command_id=NEW.command_id) BEGIN SELECT RAISE(ABORT,'Finance workflow history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER finance_source_claims_no_update BEFORE UPDATE ON finance_source_claims BEGIN SELECT RAISE(ABORT,'Finance workflow history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER finance_source_claims_no_delete BEFORE DELETE ON finance_source_claims BEGIN SELECT RAISE(ABORT,'Finance workflow history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER finance_source_claims_no_replace BEFORE INSERT ON finance_source_claims WHEN EXISTS(SELECT 1 FROM finance_source_claims WHERE source_type=NEW.source_type AND source_id=NEW.source_id AND (workspace_id=NEW.workspace_id OR source_type='provider-identity')) BEGIN SELECT RAISE(ABORT,'Finance workflow history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER finance_provider_claims_no_update BEFORE UPDATE ON finance_provider_claims BEGIN SELECT RAISE(ABORT,'Finance workflow history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER finance_provider_claims_no_delete BEFORE DELETE ON finance_provider_claims BEGIN SELECT RAISE(ABORT,'Finance workflow history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER finance_provider_claims_no_replace BEFORE INSERT ON finance_provider_claims WHEN EXISTS(SELECT 1 FROM finance_provider_claims WHERE workspace_id=NEW.workspace_id AND attempt=NEW.attempt AND (reference=NEW.reference OR operation_id=NEW.operation_id)) BEGIN SELECT RAISE(ABORT,'Finance workflow history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER finance_provider_evidence_no_update BEFORE UPDATE ON finance_provider_evidence BEGIN SELECT RAISE(ABORT,'Finance workflow history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER finance_provider_evidence_no_delete BEFORE DELETE ON finance_provider_evidence BEGIN SELECT RAISE(ABORT,'Finance workflow history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER finance_provider_evidence_no_replace BEFORE INSERT ON finance_provider_evidence WHEN EXISTS(SELECT 1 FROM finance_provider_evidence WHERE sequence=NEW.sequence OR (workspace_id=NEW.workspace_id AND source=NEW.source AND event_key=NEW.event_key)) BEGIN SELECT RAISE(ABORT,'Finance workflow history is immutable'); END;

--> statement-breakpoint
CREATE TRIGGER finance_allocation_release_guard BEFORE INSERT ON finance_command_applications WHEN NEW.decision='approved' BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM finance_workflow_commands c WHERE c.id=NEW.command_id AND json_extract(c.input_json,'$.action')='release_allocation'
 AND coalesce((SELECT balance FROM finance_balances b WHERE b.workspace_id=c.workspace_id AND b.account='allocation:'||json_extract(c.input_json,'$.orderId')||':'||json_extract(c.input_json,'$.companyId')),0)-json_extract(c.input_json,'$.amount') <
 coalesce((SELECT sum(max(0,coalesce((SELECT balance FROM finance_balances b WHERE b.workspace_id=l.workspace_id AND b.account='liability:'||l.id),0)-coalesce(json_extract(l.data_json,'$.pending'),0))+max(0,coalesce((SELECT balance FROM finance_balances b WHERE b.workspace_id=l.workspace_id AND b.account='tax:'||l.id),0)-coalesce(json_extract(l.data_json,'$.taxPending'),0))) FROM finance_current_records l WHERE l.workspace_id=c.workspace_id AND l.kind='liability' AND json_extract(l.data_json,'$.orderId')=json_extract(c.input_json,'$.orderId') AND json_extract(l.data_json,'$.company')=json_extract(c.input_json,'$.companyId')),0))
 THEN RAISE(ABORT,'Earned liabilities changed before allocation release') END;
END;
