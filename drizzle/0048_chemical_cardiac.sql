CREATE TABLE `production_service_events` (
	`id` text PRIMARY KEY NOT NULL,
	`shift_id` text NOT NULL,
	`action` text NOT NULL,
	`actor_id` text NOT NULL,
	`detail` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE TRIGGER production_service_events_no_update BEFORE UPDATE ON production_service_events BEGIN SELECT RAISE(ABORT,'Service evidence is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER production_service_events_no_delete BEFORE DELETE ON production_service_events BEGIN SELECT RAISE(ABORT,'Service evidence history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER production_service_transition_guard BEFORE INSERT ON production_service_events BEGIN
 SELECT (CASE WHEN NEW.action='officer_completed' AND (NOT EXISTS(SELECT 1 FROM shifts WHERE id=NEW.shift_id AND environment='production' AND status='on_post') OR EXISTS(SELECT 1 FROM shift_timesheets WHERE shift_id=NEW.shift_id AND active_key=shift_id)) THEN RAISE(ABORT,'Service completion already changed') END);
 SELECT (CASE WHEN NEW.action IN ('client_signoff','client_dispute','dispute_resolved','pay_reviewed') AND NOT EXISTS(SELECT 1 FROM shift_timesheets WHERE shift_id=NEW.shift_id AND version=json_extract(NEW.detail,'$.expectedVersion') AND operations_status='awaiting_review' AND active_key=shift_id AND environment='production') THEN RAISE(ABORT,'Service evidence changed before decision') END);
 SELECT (CASE WHEN NEW.action='pay_reopened' AND NOT EXISTS(SELECT 1 FROM shift_timesheets t WHERE t.shift_id=NEW.shift_id AND t.version=json_extract(NEW.detail,'$.expectedVersion') AND t.operations_status='approved_for_backend' AND t.active_key=t.shift_id AND t.environment='production' AND NOT EXISTS(SELECT 1 FROM pay_item_sources p WHERE p.timesheet_id=t.id) AND NOT EXISTS(SELECT 1 FROM partner_payables p WHERE p.timesheet_id=t.id)) THEN RAISE(ABORT,'Payroll already references this evidence or it changed') END);
END;
