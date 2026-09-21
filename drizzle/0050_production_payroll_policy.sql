CREATE UNIQUE INDEX production_payroll_policy_version ON payroll_policy_versions(json_extract(rules_json,'$.version')) WHERE environment='production';
--> statement-breakpoint
CREATE TRIGGER production_payroll_policy_insert_guard BEFORE INSERT ON payroll_policy_versions
WHEN NEW.environment='production' BEGIN
 SELECT (CASE WHEN NEW.status<>'draft' OR NEW.active_key IS NOT NULL OR NEW.reviewed_by IS NOT NULL
 OR NEW.approved_by IS NOT NULL OR NEW.reviewed_at IS NOT NULL OR NEW.activated_at IS NOT NULL
 OR NEW.integrity_state<>'production_verified' OR NEW.version<>1
 OR NOT json_valid(NEW.rules_json) OR length(NEW.policy_hash)<>64
 THEN RAISE(ABORT,'Production payroll policy must begin as an unapproved draft') END);
END;
--> statement-breakpoint
CREATE TRIGGER production_payroll_policy_update_guard BEFORE UPDATE ON payroll_policy_versions
WHEN OLD.environment='production' BEGIN
 SELECT (CASE WHEN NEW.id IS NOT OLD.id OR NEW.jurisdiction IS NOT OLD.jurisdiction
 OR NEW.currency IS NOT OLD.currency OR NEW.effective_from IS NOT OLD.effective_from
 OR NEW.effective_to IS NOT OLD.effective_to OR NEW.rules_json IS NOT OLD.rules_json
 OR NEW.policy_hash IS NOT OLD.policy_hash OR NEW.source_reference IS NOT OLD.source_reference
 OR NEW.environment IS NOT OLD.environment OR NEW.integrity_state IS NOT OLD.integrity_state
 OR NEW.created_by IS NOT OLD.created_by OR NEW.created_at IS NOT OLD.created_at
 OR NEW.version<>OLD.version+1 THEN RAISE(ABORT,'Production payroll policy content is immutable') END);
 SELECT (CASE WHEN NOT (
 (OLD.status='draft' AND NEW.status='reviewed' AND NEW.reviewed_by IS NOT NULL AND NEW.reviewed_by<>OLD.created_by AND NEW.reviewed_at IS NOT NULL AND NEW.approved_by IS NULL AND NEW.active_key IS NULL)
 OR (OLD.status='reviewed' AND NEW.status='active' AND NEW.reviewed_by=OLD.reviewed_by AND NEW.reviewed_at=OLD.reviewed_at AND NEW.active_key='production:ZA')
 OR (OLD.status IN ('draft','reviewed','active') AND NEW.status='withdrawn' AND NEW.active_key IS NULL AND NEW.reviewed_by IS OLD.reviewed_by AND NEW.approved_by IS OLD.approved_by)
 ) THEN RAISE(ABORT,'Production payroll policy transition is invalid') END);
END;
--> statement-breakpoint
CREATE TRIGGER production_payroll_policy_no_delete BEFORE DELETE ON payroll_policy_versions
WHEN OLD.environment='production' BEGIN SELECT RAISE(ABORT,'Production payroll policy history is required'); END;
--> statement-breakpoint
CREATE TRIGGER production_payroll_policy_decision_guard BEFORE INSERT ON audit_events
WHEN NEW.event_type='production_payroll_policy_decided' BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM payroll_policy_versions p WHERE p.id=NEW.entity_id AND p.environment='production' AND p.version=json_extract(NEW.detail,'$.expectedVersion') AND p.policy_hash=json_extract(NEW.detail,'$.hash')) THEN RAISE(ABORT,'Payroll policy changed before decision') END);
END;
