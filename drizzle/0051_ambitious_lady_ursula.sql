CREATE TABLE `production_payroll_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`run_version` integer NOT NULL,
	`action` text NOT NULL,
	`operator_id` text NOT NULL,
	`actor_user_id` text NOT NULL,
	`auth_basis` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`calculation_hash` text NOT NULL,
	`note` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `payroll_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operator_id`) REFERENCES `operator_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `production_payroll_decision_version` ON `production_payroll_decisions` (`run_id`,`run_version`);--> statement-breakpoint
CREATE TABLE `production_payroll_snapshots` (
	`run_id` text PRIMARY KEY NOT NULL,
	`policy_id` text NOT NULL,
	`payload_json` text NOT NULL,
	`payload_hash` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `payroll_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`policy_id`) REFERENCES `payroll_policy_versions`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE TRIGGER production_payroll_period_insert_guard BEFORE INSERT ON payroll_runs WHEN NEW.environment='production' BEGIN
 SELECT (CASE WHEN NEW.status<>'calculated' OR NEW.approved_by IS NOT NULL OR NEW.second_approved_by IS NOT NULL THEN RAISE(ABORT,'Production payroll must begin with an unapproved calculation') END);
 SELECT (CASE WHEN EXISTS(SELECT 1 FROM payroll_runs r WHERE r.environment='production' AND r.employer_id=NEW.employer_id AND r.status<>'voided' AND r.period_start<=NEW.period_end AND r.period_end>=NEW.period_start) THEN RAISE(ABORT,'An active payroll already covers this employer period') END);
END;
--> statement-breakpoint
CREATE TRIGGER production_payroll_snapshot_guard BEFORE INSERT ON production_payroll_snapshots BEGIN
 SELECT (CASE WHEN EXISTS(SELECT 1 FROM shifts s JOIN roster_assignments ra ON ra.shift_id=s.id JOIN assignment_workforce_snapshots w ON w.roster_assignment_id=ra.id WHERE w.employer_id=json_extract(NEW.payload_json,'$.employerId') AND s.environment='production' AND s.scheduled_date BETWEEN json_extract(NEW.payload_json,'$.periodStart') AND json_extract(NEW.payload_json,'$.periodEnd') AND s.status IN ('confirmed','on_post')) THEN RAISE(ABORT,'Unfinished service appeared before payroll commit') END);
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM payroll_runs r JOIN payroll_policy_versions p ON p.id=NEW.policy_id WHERE r.id=NEW.run_id AND r.environment='production' AND r.status='calculated' AND p.status='active' AND p.active_key='production:ZA' AND p.policy_hash=json_extract(NEW.payload_json,'$.policyHash') AND r.employer_id=json_extract(NEW.payload_json,'$.employerId') AND r.period_start=json_extract(NEW.payload_json,'$.periodStart') AND r.period_end=json_extract(NEW.payload_json,'$.periodEnd') AND r.pay_date=json_extract(NEW.payload_json,'$.payDate') AND r.item_count=json_array_length(NEW.payload_json,'$.items') AND r.gross_cents=(SELECT SUM(json_extract(value,'$.calculation.grossCents')) FROM json_each(NEW.payload_json,'$.items')) AND r.net_pay_cents=(SELECT SUM(json_extract(value,'$.calculation.netPayCents')) FROM json_each(NEW.payload_json,'$.items'))) THEN RAISE(ABORT,'Payroll policy or totals changed before calculation commit') END);
 SELECT (CASE WHEN EXISTS(SELECT 1 FROM json_each(NEW.payload_json,'$.items') i WHERE NOT EXISTS(SELECT 1 FROM payroll_profiles p JOIN production_evidence_reviews e ON p.evidence_reference='review:'||e.id WHERE p.id=json_extract(i.value,'$.profileId') AND p.version=json_extract(i.value,'$.profileVersion') AND p.officer_id=json_extract(i.value,'$.officerId') AND p.workforce_engagement_id=json_extract(i.value,'$.engagementId') AND p.employer_id=json_extract(NEW.payload_json,'$.employerId') AND p.active_key=p.officer_id AND p.status='calculation_ready' AND p.environment='production' AND e.state='approved' AND julianday(e.expires_at)>julianday('now'))) THEN RAISE(ABORT,'Payroll profile changed before calculation commit') END);
 SELECT (CASE WHEN EXISTS(SELECT 1 FROM json_each(NEW.payload_json,'$.items') i,json_each(i.value,'$.sources') s WHERE NOT EXISTS(SELECT 1 FROM shift_timesheets t WHERE t.id=json_extract(s.value,'$.id') AND t.version=json_extract(s.value,'$.version') AND t.officer_id=json_extract(i.value,'$.officerId') AND t.employer_id=json_extract(NEW.payload_json,'$.employerId') AND t.workforce_engagement_id=json_extract(i.value,'$.engagementId') AND t.environment='production' AND t.integrity_state='production_verified' AND t.service_date BETWEEN json_extract(NEW.payload_json,'$.periodStart') AND json_extract(NEW.payload_json,'$.periodEnd') AND t.active_key=t.shift_id AND t.gross_wage_cents=json_extract(s.value,'$.gross_wage_cents') AND t.payable_minutes=json_extract(s.value,'$.payable_minutes') AND t.operations_status='approved_for_backend' AND t.client_evidence_status='confirmed' AND NOT EXISTS(SELECT 1 FROM pay_item_sources p WHERE p.active_key=t.id))) THEN RAISE(ABORT,'Service pay evidence changed before calculation commit') END);
 SELECT (CASE WHEN (SELECT count(*) FROM shift_timesheets t WHERE t.environment='production' AND t.active_key=t.shift_id AND t.employer_id=json_extract(NEW.payload_json,'$.employerId') AND t.service_date BETWEEN json_extract(NEW.payload_json,'$.periodStart') AND json_extract(NEW.payload_json,'$.periodEnd'))<>(SELECT count(*) FROM json_each(NEW.payload_json,'$.items') i,json_each(i.value,'$.sources')) THEN RAISE(ABORT,'Payroll period service changed before commit') END);
END;
--> statement-breakpoint
CREATE TRIGGER production_payroll_snapshot_no_update BEFORE UPDATE ON production_payroll_snapshots BEGIN SELECT RAISE(ABORT,'Payroll calculation history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER production_payroll_snapshot_no_delete BEFORE DELETE ON production_payroll_snapshots BEGIN SELECT RAISE(ABORT,'Payroll calculation history is required'); END;
--> statement-breakpoint
CREATE TRIGGER production_payroll_decision_guard BEFORE INSERT ON production_payroll_decisions BEGIN
 SELECT (CASE WHEN NEW.auth_basis NOT IN ('mfa_verified','owner_mfa_exception') OR julianday(NEW.created_at) IS NULL OR julianday(NEW.created_at)<julianday('now','-1 minute') OR julianday(NEW.created_at)>julianday('now','+1 minute') THEN RAISE(ABORT,'Fresh server authorisation is required') END);
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM payroll_runs r JOIN production_payroll_snapshots s ON s.run_id=r.id JOIN operator_accounts a ON a.id=NEW.operator_id JOIN operator_role_assignments role ON role.operator_id=a.id WHERE r.id=NEW.run_id AND r.environment='production' AND r.version=NEW.run_version AND r.net_pay_cents=NEW.amount_cents AND s.payload_hash=NEW.calculation_hash AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=NEW.amount_cents AND role.environment='production' AND role.integrity_state='production_verified' AND role.status='active' AND ((NEW.action='first_approve_payroll' AND r.status='calculated' AND NEW.operator_id<>r.created_by AND role.role='payroll_reviewer') OR (NEW.action='second_approve_payroll' AND r.status='first_approved' AND NEW.operator_id NOT IN (r.created_by,r.approved_by) AND role.role='finance_approver') OR (NEW.action='export_payroll' AND r.status='approved_for_export' AND role.role='payroll_preparer') OR (NEW.action='void_payroll' AND r.status IN ('calculated','first_approved','approved_for_export') AND role.role='finance_approver'))) THEN RAISE(ABORT,'Payroll stage, amount or independent operator authority changed') END);
 SELECT (CASE WHEN NEW.action<>'void_payroll' AND NOT EXISTS(SELECT 1 FROM production_payroll_snapshots s JOIN payroll_policy_versions p ON p.id=s.policy_id WHERE s.run_id=NEW.run_id AND p.status='active' AND p.active_key='production:ZA' AND p.policy_hash=json_extract(s.payload_json,'$.policyHash')) THEN RAISE(ABORT,'Approved payroll policy is no longer current') END);
 SELECT (CASE WHEN NEW.action<>'void_payroll' AND EXISTS(SELECT 1 FROM production_payroll_snapshots s,json_each(s.payload_json,'$.items') i WHERE s.run_id=NEW.run_id AND NOT EXISTS(SELECT 1 FROM payroll_profiles p JOIN production_evidence_reviews e ON p.evidence_reference='review:'||e.id WHERE p.id=json_extract(i.value,'$.profileId') AND p.version=json_extract(i.value,'$.profileVersion') AND p.status='calculation_ready' AND p.active_key=p.officer_id AND e.state='approved' AND julianday(e.expires_at)>julianday('now'))) THEN RAISE(ABORT,'Payroll profile is no longer current') END);
END;
--> statement-breakpoint
CREATE TRIGGER production_payroll_decision_no_update BEFORE UPDATE ON production_payroll_decisions BEGIN SELECT RAISE(ABORT,'Payroll decisions are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER production_payroll_decision_no_delete BEFORE DELETE ON production_payroll_decisions BEGIN SELECT RAISE(ABORT,'Payroll decision history is required'); END;
--> statement-breakpoint
CREATE TRIGGER production_payroll_run_update_guard BEFORE UPDATE ON payroll_runs WHEN OLD.environment='production' BEGIN
 SELECT (CASE WHEN NEW.id IS NOT OLD.id OR NEW.batch_key IS NOT OLD.batch_key OR NEW.employer_id IS NOT OLD.employer_id OR NEW.period_start IS NOT OLD.period_start OR NEW.period_end IS NOT OLD.period_end OR NEW.pay_date IS NOT OLD.pay_date OR NEW.run_type IS NOT OLD.run_type OR NEW.currency IS NOT OLD.currency OR NEW.gross_cents IS NOT OLD.gross_cents OR NEW.employee_deduction_cents IS NOT OLD.employee_deduction_cents OR NEW.net_pay_cents IS NOT OLD.net_pay_cents OR NEW.employer_cost_cents IS NOT OLD.employer_cost_cents OR NEW.item_count IS NOT OLD.item_count OR NEW.policy_version IS NOT OLD.policy_version OR NEW.calculation_version IS NOT OLD.calculation_version OR NEW.environment IS NOT OLD.environment OR NEW.integrity_state IS NOT OLD.integrity_state OR NEW.created_by IS NOT OLD.created_by OR NEW.created_at IS NOT OLD.created_at OR NEW.version<>OLD.version+1 THEN RAISE(ABORT,'Production payroll calculation is immutable') END);
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM production_payroll_decisions d WHERE d.run_id=OLD.id AND d.run_version=OLD.version AND ((d.action='first_approve_payroll' AND NEW.status='first_approved' AND NEW.approved_by=d.operator_id AND NEW.second_approved_by IS OLD.second_approved_by) OR (d.action='second_approve_payroll' AND NEW.status='approved_for_export' AND NEW.second_approved_by=d.operator_id AND NEW.approved_by=OLD.approved_by) OR (d.action='export_payroll' AND NEW.status='exported' AND NEW.approved_by IS OLD.approved_by AND NEW.second_approved_by IS OLD.second_approved_by AND NEW.export_reference='payroll-snapshot:'||d.calculation_hash AND NEW.exported_at IS NOT NULL) OR (d.action='void_payroll' AND NEW.status='voided' AND NEW.approved_by IS OLD.approved_by AND NEW.second_approved_by IS OLD.second_approved_by))) THEN RAISE(ABORT,'Exact payroll decision is required') END);
END;

--> statement-breakpoint
DROP TRIGGER `payroll_run_first_approval_guard_v28`;
--> statement-breakpoint
CREATE TRIGGER `payroll_run_first_approval_guard_v28`
BEFORE UPDATE OF `approved_by`, `status` ON `payroll_runs`
FOR EACH ROW WHEN (NEW.`status` = 'first_approved' AND OLD.`status` <> 'first_approved')
	OR (NEW.`approved_by` IS NOT NULL AND OLD.`approved_by` IS NULL)
BEGIN
	SELECT (CASE WHEN NEW.`approved_by` IS NULL OR NEW.`approved_by` = NEW.`created_by`
		OR NEW.`status` <> 'first_approved'
		THEN RAISE(ABORT, 'payroll_maker_checker_first_approval_invalid') END);
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `operator_accounts` account
		JOIN `operator_role_assignments` role ON role.`operator_id` = account.`id`
		WHERE account.`id` = NEW.`approved_by` AND account.`environment` = NEW.`environment`
			AND account.`integrity_state` = NEW.`integrity_state` AND account.`status` = 'active'
			AND ((account.`mfa_status` = 'verified' AND account.`mfa_verified_at` IS NOT NULL AND datetime(account.`mfa_verified_at`, '+15 minutes') >= datetime('now')) OR (NEW.environment='production' AND EXISTS(SELECT 1 FROM production_payroll_decisions d WHERE d.run_id=NEW.id AND d.run_version=OLD.version AND d.action='first_approve_payroll' AND d.operator_id=NEW.approved_by AND d.amount_cents=NEW.net_pay_cents AND julianday(d.created_at)>=julianday('now','-1 minute'))))
			AND account.`approval_limit_cents` >= COALESCE(NEW.`net_pay_cents`, NEW.`gross_cents`)
			AND role.`role` = 'payroll_reviewer' AND role.`status` = 'active'
			AND role.`environment` = NEW.`environment` AND role.`integrity_state` = NEW.`integrity_state`
	) THEN RAISE(ABORT, 'active_mfa_payroll_reviewer_required') END);
END;

--> statement-breakpoint
DROP TRIGGER `payroll_run_second_approval_guard_v28`;
--> statement-breakpoint
CREATE TRIGGER `payroll_run_second_approval_guard_v28`
BEFORE UPDATE OF `second_approved_by`, `status` ON `payroll_runs`
FOR EACH ROW WHEN (NEW.`status` = 'approved_for_export' AND OLD.`status` <> 'approved_for_export')
	OR (NEW.`second_approved_by` IS NOT NULL AND OLD.`second_approved_by` IS NULL)
BEGIN
	SELECT (CASE WHEN NEW.`approved_by` IS NULL OR NEW.`second_approved_by` IS NULL
		OR NEW.`second_approved_by` IN (NEW.`created_by`, NEW.`approved_by`)
		OR NEW.`status` <> 'approved_for_export'
		THEN RAISE(ABORT, 'payroll_maker_checker_second_approval_invalid') END);
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `operator_accounts` account
		JOIN `operator_role_assignments` role ON role.`operator_id` = account.`id`
		WHERE account.`id` = NEW.`second_approved_by` AND account.`environment` = NEW.`environment`
			AND account.`integrity_state` = NEW.`integrity_state` AND account.`status` = 'active'
			AND ((account.`mfa_status` = 'verified' AND account.`mfa_verified_at` IS NOT NULL AND datetime(account.`mfa_verified_at`, '+15 minutes') >= datetime('now')) OR (NEW.environment='production' AND EXISTS(SELECT 1 FROM production_payroll_decisions d WHERE d.run_id=NEW.id AND d.run_version=OLD.version AND d.action='second_approve_payroll' AND d.operator_id=NEW.second_approved_by AND d.amount_cents=NEW.net_pay_cents AND julianday(d.created_at)>=julianday('now','-1 minute'))))
			AND account.`approval_limit_cents` >= COALESCE(NEW.`net_pay_cents`, NEW.`gross_cents`)
			AND role.`role` = 'finance_approver' AND role.`status` = 'active'
			AND role.`environment` = NEW.`environment` AND role.`integrity_state` = NEW.`integrity_state`
	) THEN RAISE(ABORT, 'active_mfa_finance_approver_required') END);
END;

--> statement-breakpoint
CREATE TRIGGER production_payroll_profile_immutable BEFORE UPDATE ON payroll_profiles WHEN OLD.environment='production' BEGIN
 SELECT (CASE WHEN NEW.id IS NOT OLD.id OR NEW.officer_id IS NOT OLD.officer_id OR NEW.workforce_engagement_id IS NOT OLD.workforce_engagement_id OR NEW.employer_id IS NOT OLD.employer_id OR NEW.tax_reference_token IS NOT OLD.tax_reference_token OR NEW.uif_reference_token IS NOT OLD.uif_reference_token OR NEW.provident_reference_token IS NOT OLD.provident_reference_token OR NEW.evidence_reference IS NOT OLD.evidence_reference OR NEW.evidence_verified_at IS NOT OLD.evidence_verified_at OR NEW.environment IS NOT OLD.environment OR NEW.integrity_state IS NOT OLD.integrity_state OR NEW.created_at IS NOT OLD.created_at THEN RAISE(ABORT,'Prepare a new reviewed payroll profile instead of rewriting identity evidence') END);
END;
--> statement-breakpoint
CREATE TRIGGER production_payroll_sources_immutable BEFORE UPDATE ON pay_item_sources WHEN OLD.environment='production' BEGIN
 SELECT (CASE WHEN NEW.id IS NOT OLD.id OR NEW.payroll_item_id IS NOT OLD.payroll_item_id OR NEW.timesheet_id IS NOT OLD.timesheet_id OR NEW.timesheet_version IS NOT OLD.timesheet_version OR NEW.payable_minutes IS NOT OLD.payable_minutes OR NEW.gross_wage_cents IS NOT OLD.gross_wage_cents OR NEW.environment IS NOT OLD.environment OR NEW.integrity_state IS NOT OLD.integrity_state OR NEW.created_at IS NOT OLD.created_at OR NEW.active_key IS NOT NULL OR NOT EXISTS(SELECT 1 FROM payroll_items i JOIN payroll_runs r ON r.id=i.payroll_run_id WHERE i.id=OLD.payroll_item_id AND r.status='voided') THEN RAISE(ABORT,'Payroll source history may only be released by voiding its run') END);
END;
--> statement-breakpoint
CREATE TRIGGER production_payroll_sources_no_delete BEFORE DELETE ON pay_item_sources WHEN OLD.environment='production' BEGIN SELECT RAISE(ABORT,'Payroll source history is required'); END;
--> statement-breakpoint
CREATE TRIGGER production_payroll_items_immutable BEFORE UPDATE ON payroll_items WHEN OLD.environment='production' BEGIN
 SELECT (CASE WHEN NEW.id IS NOT OLD.id OR NEW.payroll_run_id IS NOT OLD.payroll_run_id OR NEW.officer_id IS NOT OLD.officer_id OR NEW.payroll_profile_id IS NOT OLD.payroll_profile_id OR NEW.workforce_engagement_id IS NOT OLD.workforce_engagement_id OR NEW.employer_id IS NOT OLD.employer_id OR NEW.workforce_model IS NOT OLD.workforce_model OR NEW.gross_wage_cents IS NOT OLD.gross_wage_cents OR NEW.employee_deduction_cents IS NOT OLD.employee_deduction_cents OR NEW.net_pay_cents IS NOT OLD.net_pay_cents OR NEW.employer_cost_cents IS NOT OLD.employer_cost_cents OR NEW.policy_version IS NOT OLD.policy_version OR NEW.environment IS NOT OLD.environment OR NEW.integrity_state IS NOT OLD.integrity_state OR NEW.created_at IS NOT OLD.created_at OR NEW.status<>'voided' OR NOT EXISTS(SELECT 1 FROM payroll_runs r WHERE r.id=NEW.payroll_run_id AND r.status='voided') THEN RAISE(ABORT,'Payroll item calculation history is immutable') END);
END;
--> statement-breakpoint
CREATE TRIGGER production_payroll_run_no_delete BEFORE DELETE ON payroll_runs WHEN OLD.environment='production' BEGIN SELECT RAISE(ABORT,'Payroll run history is required'); END;

--> statement-breakpoint
DROP TRIGGER production_service_transition_guard;
--> statement-breakpoint
CREATE TRIGGER production_service_transition_guard BEFORE INSERT ON production_service_events BEGIN
 SELECT (CASE WHEN NEW.action='officer_completed' AND (NOT EXISTS(SELECT 1 FROM shifts WHERE id=NEW.shift_id AND environment='production' AND status='on_post') OR EXISTS(SELECT 1 FROM shift_timesheets WHERE shift_id=NEW.shift_id AND active_key=shift_id)) THEN RAISE(ABORT,'Service completion already changed') END);
 SELECT (CASE WHEN NEW.action IN ('client_signoff','client_dispute','dispute_resolved','pay_reviewed') AND NOT EXISTS(SELECT 1 FROM shift_timesheets WHERE shift_id=NEW.shift_id AND version=json_extract(NEW.detail,'$.expectedVersion') AND operations_status='awaiting_review' AND active_key=shift_id AND environment='production') THEN RAISE(ABORT,'Service evidence changed before decision') END);
 SELECT (CASE WHEN NEW.action='pay_reopened' AND NOT EXISTS(SELECT 1 FROM shift_timesheets t WHERE t.shift_id=NEW.shift_id AND t.version=json_extract(NEW.detail,'$.expectedVersion') AND t.operations_status='approved_for_backend' AND t.active_key=t.shift_id AND t.environment='production' AND NOT EXISTS(SELECT 1 FROM pay_item_sources p JOIN payroll_items i ON i.id=p.payroll_item_id JOIN payroll_runs r ON r.id=i.payroll_run_id WHERE p.timesheet_id=t.id AND (p.active_key IS NOT NULL OR r.status<>'voided')) AND NOT EXISTS(SELECT 1 FROM partner_payables p WHERE p.timesheet_id=t.id)) THEN RAISE(ABORT,'Payroll already references this evidence or it changed') END);
END;
