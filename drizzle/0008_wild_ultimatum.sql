ALTER TABLE `booking_funding_reconciliations` ADD `integrity_state` text DEFAULT 'synthetic' NOT NULL;--> statement-breakpoint
ALTER TABLE `compliance_records` ADD `environment` text DEFAULT 'demo' NOT NULL;--> statement-breakpoint
ALTER TABLE `compliance_records` ADD `integrity_state` text DEFAULT 'synthetic' NOT NULL;--> statement-breakpoint
ALTER TABLE `compliance_records` ADD `evidence_reference` text;--> statement-breakpoint
ALTER TABLE `employer_compliance_evidence` ADD `environment` text DEFAULT 'demo' NOT NULL;--> statement-breakpoint
ALTER TABLE `employer_compliance_evidence` ADD `integrity_state` text DEFAULT 'synthetic' NOT NULL;--> statement-breakpoint
ALTER TABLE `officer_availability_windows` ADD `environment` text DEFAULT 'demo' NOT NULL;--> statement-breakpoint
ALTER TABLE `officer_availability_windows` ADD `integrity_state` text DEFAULT 'synthetic' NOT NULL;--> statement-breakpoint
ALTER TABLE `officer_availability_windows` ADD `evidence_reference` text;--> statement-breakpoint
ALTER TABLE `officer_endorsements` ADD `environment` text DEFAULT 'demo' NOT NULL;--> statement-breakpoint
ALTER TABLE `officer_endorsements` ADD `integrity_state` text DEFAULT 'synthetic' NOT NULL;--> statement-breakpoint
ALTER TABLE `officer_endorsements` ADD `evidence_reference` text;--> statement-breakpoint
ALTER TABLE `officer_passports` ADD `environment` text DEFAULT 'demo' NOT NULL;--> statement-breakpoint
ALTER TABLE `officer_passports` ADD `integrity_state` text DEFAULT 'synthetic' NOT NULL;--> statement-breakpoint
ALTER TABLE `officer_passports` ADD `evidence_reference` text;--> statement-breakpoint
ALTER TABLE `officer_site_inductions` ADD `environment` text DEFAULT 'demo' NOT NULL;--> statement-breakpoint
ALTER TABLE `officer_site_inductions` ADD `integrity_state` text DEFAULT 'synthetic' NOT NULL;--> statement-breakpoint
ALTER TABLE `officer_travel_assessments` ADD `environment` text DEFAULT 'demo' NOT NULL;--> statement-breakpoint
ALTER TABLE `officer_travel_assessments` ADD `integrity_state` text DEFAULT 'synthetic' NOT NULL;--> statement-breakpoint
ALTER TABLE `post_order_approvals` ADD `environment` text DEFAULT 'demo' NOT NULL;--> statement-breakpoint
ALTER TABLE `post_order_approvals` ADD `integrity_state` text DEFAULT 'synthetic' NOT NULL;--> statement-breakpoint
ALTER TABLE `site_risk_assessments` ADD `environment` text DEFAULT 'demo' NOT NULL;--> statement-breakpoint
ALTER TABLE `site_risk_assessments` ADD `integrity_state` text DEFAULT 'synthetic' NOT NULL;--> statement-breakpoint
ALTER TABLE `workforce_terms_acceptances` ADD `environment` text DEFAULT 'demo' NOT NULL;--> statement-breakpoint
ALTER TABLE `workforce_terms_acceptances` ADD `integrity_state` text DEFAULT 'synthetic' NOT NULL;--> statement-breakpoint
ALTER TABLE `officer_work_commitments` ADD `environment` text DEFAULT 'demo' NOT NULL;--> statement-breakpoint
ALTER TABLE `officer_work_commitments` ADD `integrity_state` text DEFAULT 'synthetic' NOT NULL;--> statement-breakpoint
ALTER TABLE `officer_work_commitments` ADD `verified_at` text;--> statement-breakpoint
ALTER TABLE `officer_work_commitments` ADD `expires_at` text;--> statement-breakpoint
ALTER TABLE `relief_dispatches` ADD `environment` text DEFAULT 'demo' NOT NULL;--> statement-breakpoint
ALTER TABLE `relief_dispatches` ADD `integrity_state` text DEFAULT 'synthetic' NOT NULL;--> statement-breakpoint
ALTER TABLE `roster_assignments` ADD `environment` text DEFAULT 'demo' NOT NULL;--> statement-breakpoint
ALTER TABLE `roster_assignments` ADD `integrity_state` text DEFAULT 'synthetic' NOT NULL;--> statement-breakpoint
ALTER TABLE `shifts` ADD `environment` text DEFAULT 'demo' NOT NULL;--> statement-breakpoint
ALTER TABLE `shifts` ADD `integrity_state` text DEFAULT 'synthetic' NOT NULL;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `activation_commands_identity_immutable`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `activation_commands_terminal_immutable`;
--> statement-breakpoint
CREATE TRIGGER `activation_commands_identity_immutable_v2`
BEFORE UPDATE ON `assignment_activation_commands`
WHEN NEW.`activation_key` <> OLD.`activation_key`
	OR NEW.`request_hash` <> OLD.`request_hash`
	OR NEW.`roster_slot_id` <> OLD.`roster_slot_id`
	OR NEW.`officer_id` <> OLD.`officer_id`
	OR NEW.`expected_slot_version` <> OLD.`expected_slot_version`
	OR NEW.`environment` <> OLD.`environment`
	OR NEW.`requested_by` <> OLD.`requested_by`
	OR NEW.`requested_at` <> OLD.`requested_at`
BEGIN
	SELECT RAISE(ABORT, 'activation_command_identity_immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `activation_commands_transition_v2`
BEFORE UPDATE ON `assignment_activation_commands`
WHEN NOT (
	(OLD.`state` = 'ready' AND NEW.`state` = 'reserved'
		AND OLD.`environment` = 'production'
		AND OLD.`integrity_state` = 'production_candidate'
		AND NEW.`integrity_state` = 'production_verified'
		AND OLD.`roster_assignment_id` IS NULL AND OLD.`shift_id` IS NULL
		AND NEW.`roster_assignment_id` IS NOT NULL AND NEW.`shift_id` IS NOT NULL
		AND NEW.`completed_at` IS NULL AND NEW.`version` = OLD.`version` + 1)
	OR (OLD.`state` = 'reserved' AND NEW.`state` = 'activated'
		AND OLD.`integrity_state` = 'production_verified'
		AND NEW.`integrity_state` = 'production_verified'
		AND NEW.`roster_assignment_id` IS OLD.`roster_assignment_id`
		AND NEW.`shift_id` IS OLD.`shift_id`
		AND NEW.`completed_at` IS NOT NULL AND NEW.`version` = OLD.`version` + 1)
	OR (OLD.`state` = 'ready' AND NEW.`state` = 'blocked'
		AND NEW.`integrity_state` = OLD.`integrity_state`
		AND NEW.`roster_assignment_id` IS NULL AND NEW.`shift_id` IS NULL
		AND NEW.`completed_at` IS NOT NULL AND NEW.`version` = OLD.`version` + 1)
)
BEGIN
	SELECT RAISE(ABORT, 'activation_command_transition_invalid');
END;
--> statement-breakpoint
CREATE TRIGGER `activation_commands_insert_shape_v2`
BEFORE INSERT ON `assignment_activation_commands`
WHEN NOT (
	(NEW.`environment` = 'production' AND NEW.`integrity_state` = 'production_candidate'
		AND NEW.`state` IN ('ready','blocked') AND NEW.`roster_assignment_id` IS NULL
		AND NEW.`shift_id` IS NULL AND NEW.`completed_at` IS NOT NULL)
	OR (NEW.`environment` = 'production' AND NEW.`integrity_state` = 'production_verified'
		AND NEW.`state` = 'reserved' AND NEW.`roster_assignment_id` IS NOT NULL
		AND NEW.`shift_id` IS NOT NULL AND NEW.`completed_at` IS NULL)
	OR (NEW.`environment` = 'demo_synthetic' AND NEW.`integrity_state` = 'synthetic_demo_only'
		AND NEW.`state` IN ('ready','blocked') AND NEW.`roster_assignment_id` IS NULL
		AND NEW.`shift_id` IS NULL AND NEW.`completed_at` IS NOT NULL)
)
BEGIN
	SELECT RAISE(ABORT, 'activation_command_insert_shape_invalid');
END;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `hour_reservation_insert_guard`;
--> statement-breakpoint
CREATE TRIGGER `hour_reservation_shape_v2`
BEFORE INSERT ON `workforce_hour_reservations`
WHEN NEW.`status` = 'active'
BEGIN
	SELECT (CASE WHEN julianday(NEW.`segment_starts_at`) IS NULL
		OR julianday(NEW.`segment_ends_at`) IS NULL
		OR strftime('%S', NEW.`segment_starts_at`) <> '00'
		OR strftime('%S', NEW.`segment_ends_at`) <> '00'
		OR typeof(NEW.`reserved_minutes`) <> 'integer'
		OR CAST(ROUND((julianday(NEW.`segment_ends_at`) - julianday(NEW.`segment_starts_at`)) * 1440) AS INTEGER) <> NEW.`reserved_minutes`
		OR NEW.`iso_week_start` <> date(NEW.`segment_starts_at`, '+2 hours', printf('-%d days', (CAST(strftime('%w', NEW.`segment_starts_at`, '+2 hours') AS INTEGER) + 6) % 7))
		OR NEW.`iso_week_end` <> date(NEW.`iso_week_start`, '+6 days')
		OR julianday(NEW.`segment_starts_at`) < julianday(NEW.`iso_week_start` || 'T00:00:00+02:00')
		OR julianday(NEW.`segment_ends_at`) > julianday(date(NEW.`iso_week_start`, '+7 days') || 'T00:00:00+02:00')
		OR NEW.`active_key` <> NEW.`officer_id` || ':' || NEW.`iso_week_start` || ':' || NEW.`source_id`
	THEN RAISE(ABORT, 'hour_interval_or_iso_week_invalid') END);
	SELECT (CASE WHEN NOT (
		(NEW.`source_type` = 'assignment' AND NEW.`source_id` = NEW.`roster_assignment_id`
			AND NEW.`command_id` IS NOT NULL AND NEW.`roster_assignment_id` IS NOT NULL
			AND NEW.`relief_dispatch_id` IS NULL AND EXISTS (
				SELECT 1 FROM `roster_assignments` ra
				JOIN `roster_slots` rs ON rs.`id` = ra.`roster_slot_id`
				JOIN `assignment_activation_commands` c ON c.`id` = NEW.`command_id` AND c.`roster_assignment_id` = ra.`id`
				WHERE ra.`id` = NEW.`roster_assignment_id` AND ra.`officer_id` = NEW.`officer_id`
					AND ra.`status` = 'reserved' AND ra.`active_key` IS NULL
					AND c.`officer_id` = NEW.`officer_id` AND c.`state` = 'reserved'
					AND julianday(NEW.`segment_starts_at`) >= julianday(rs.`starts_at`)
					AND julianday(NEW.`segment_ends_at`) <= julianday(rs.`ends_at`)))
		OR (NEW.`source_type` = 'relief' AND NEW.`source_id` = NEW.`relief_dispatch_id`
			AND NEW.`command_id` IS NULL AND NEW.`roster_assignment_id` IS NULL
			AND NEW.`relief_dispatch_id` IS NOT NULL AND EXISTS (
				SELECT 1 FROM `relief_dispatches` rd
				JOIN `roster_slots` rs ON rs.`id` = rd.`roster_slot_id`
				WHERE rd.`id` = NEW.`relief_dispatch_id` AND rd.`replacement_officer_id` = NEW.`officer_id`
					AND rd.`active_key` = rd.`roster_slot_id`
					AND rd.`status` NOT IN ('cancelled','replaced','closed')
					AND julianday(NEW.`segment_starts_at`) >= julianday(rs.`starts_at`)
					AND julianday(NEW.`segment_ends_at`) <= julianday(rs.`ends_at`)))
	) THEN RAISE(ABORT, 'hour_source_binding_invalid') END);
	SELECT (CASE WHEN EXISTS (
		SELECT 1 FROM `workforce_hour_reservations` r
		JOIN `workforce_engagements` rwe ON rwe.`id` = r.`workforce_engagement_id`
		JOIN `workforce_engagements` nwe ON nwe.`id` = NEW.`workforce_engagement_id`
		WHERE r.`officer_id` = NEW.`officer_id` AND r.`status` = 'active'
			AND rwe.`environment` = nwe.`environment`
			AND r.`source_type` = NEW.`source_type` AND r.`source_id` = NEW.`source_id`
			AND julianday(r.`segment_starts_at`) < julianday(NEW.`segment_ends_at`)
			AND julianday(r.`segment_ends_at`) > julianday(NEW.`segment_starts_at`)
	) THEN RAISE(ABORT, 'same_source_hour_overlap') END);
	SELECT (CASE WHEN EXISTS (
		SELECT 1 FROM `workforce_hour_reservations` r
		JOIN `workforce_engagements` rwe ON rwe.`id` = r.`workforce_engagement_id`
		JOIN `workforce_engagements` nwe ON nwe.`id` = NEW.`workforce_engagement_id`
		WHERE r.`officer_id` = NEW.`officer_id` AND r.`status` = 'active'
			AND rwe.`environment` = nwe.`environment`
			AND NOT (r.`source_type` = NEW.`source_type` AND r.`source_id` = NEW.`source_id`)
			AND julianday(r.`segment_starts_at`) < julianday(NEW.`segment_ends_at`, '+8 hours')
			AND julianday(r.`segment_ends_at`) > julianday(NEW.`segment_starts_at`, '-8 hours')
	) THEN RAISE(ABORT, 'officer_work_rest_conflict') END);
END;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `relief_dispatch_release_hours`;
--> statement-breakpoint
CREATE TRIGGER `relief_dispatch_release_hours_v2`
AFTER UPDATE OF `status`, `active_key` ON `relief_dispatches`
WHEN NEW.`status` IN ('cancelled','replaced') AND OLD.`status` NOT IN ('cancelled','replaced')
BEGIN
	UPDATE `workforce_hour_reservations`
	SET `status` = 'released', `active_key` = NULL, `released_at` = CURRENT_TIMESTAMP,
		`release_reason` = 'relief_' || NEW.`status`
	WHERE `relief_dispatch_id` = NEW.`id` AND `status` = 'active';
END;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `roster_assignment_release_hours`;
--> statement-breakpoint
CREATE TRIGGER `roster_assignment_release_hours_v2`
AFTER UPDATE OF `status`, `active_key` ON `roster_assignments`
WHEN NEW.`status` IN ('cancelled','replaced','released') AND OLD.`status` NOT IN ('cancelled','replaced','released')
BEGIN
	UPDATE `workforce_hour_reservations`
	SET `status` = 'released', `active_key` = NULL, `released_at` = CURRENT_TIMESTAMP,
		`release_reason` = 'assignment_' || NEW.`status`
	WHERE `roster_assignment_id` = NEW.`id` AND `status` = 'active';
	UPDATE `shifts` SET `status` = 'cancelled'
	WHERE `id` = NEW.`shift_id` AND `status` IN ('reserved','confirmed');
END;
--> statement-breakpoint
CREATE TRIGGER `activation_snapshot_binding_v2`
BEFORE INSERT ON `assignment_activation_snapshots`
BEGIN
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `assignment_activation_commands` c
		JOIN `roster_slots` rs ON rs.`id` = c.`roster_slot_id`
		JOIN `bookings` b ON b.`id` = rs.`booking_id`
		JOIN `operational_sites` os ON os.`id` = rs.`site_id` AND os.`client_id` = b.`client_id`
		JOIN `site_posts` sp ON sp.`id` = rs.`post_id` AND sp.`site_id` = os.`id` AND sp.`booking_id` = b.`id`
		JOIN `roster_assignments` ra ON ra.`id` = c.`roster_assignment_id`
			AND ra.`roster_slot_id` = rs.`id` AND ra.`officer_id` = c.`officer_id` AND ra.`shift_id` = c.`shift_id`
		JOIN `shifts` sh ON sh.`id` = c.`shift_id` AND sh.`booking_id` = b.`id` AND sh.`officer_id` = c.`officer_id`
		JOIN `booking_funding_reconciliations` fr ON fr.`id` = NEW.`funding_reconciliation_id`
			AND fr.`booking_id` = b.`id` AND fr.`active_key` = b.`id`
		JOIN `site_risk_assessments` sra ON sra.`id` = NEW.`risk_assessment_id`
			AND sra.`site_id` = os.`id` AND sra.`active_key` = os.`id`
		JOIN `post_order_approvals` poa ON poa.`id` = NEW.`post_order_approval_id`
			AND poa.`post_id` = sp.`id` AND poa.`active_key` = sp.`id`
		JOIN `officer_site_inductions` osi ON osi.`id` = NEW.`induction_id`
			AND osi.`officer_id` = c.`officer_id` AND osi.`site_id` = os.`id`
			AND osi.`active_key` = c.`officer_id` || ':' || os.`id`
		JOIN `workforce_engagements` we ON we.`id` = NEW.`workforce_engagement_id`
			AND we.`officer_id` = c.`officer_id` AND we.`active_key` = we.`officer_id`
		JOIN `workforce_employers` emp ON emp.`id` = we.`employer_id`
		JOIN `workforce_terms_acceptances` wta ON wta.`id` = NEW.`terms_acceptance_id`
			AND wta.`workforce_engagement_id` = we.`id` AND wta.`officer_id` = c.`officer_id`
			AND wta.`active_key` = we.`id`
		WHERE c.`id` = NEW.`command_id` AND c.`state` = 'reserved'
			AND c.`environment` = 'production' AND c.`integrity_state` = 'production_verified'
			AND c.`roster_assignment_id` = NEW.`roster_assignment_id` AND c.`shift_id` = NEW.`shift_id`
			AND c.`officer_id` = NEW.`officer_id` AND rs.`booking_id` = NEW.`booking_id`
			AND b.`client_id` = NEW.`client_id` AND rs.`site_id` = NEW.`site_id`
			AND os.`version` = NEW.`site_version` AND rs.`post_id` = NEW.`post_id`
			AND we.`model` = NEW.`workforce_model` AND emp.`id` = NEW.`employer_id`
			AND emp.`legal_name` = NEW.`employer_legal_name` AND emp.`version` = NEW.`employer_version`
			AND wta.`terms_version` = NEW.`terms_version` AND b.`pricing_version` = NEW.`pricing_version`
			AND b.`calendar_category` = NEW.`calendar_category`
			AND b.`officer_rate_cents` = NEW.`funded_offer_cents`
			AND sh.`earnings_cents` = NEW.`funded_offer_cents`
			AND NEW.`ordinary_wage_cents` + NEW.`holiday_premium_cents` = NEW.`funded_offer_cents`
			AND NEW.`statutory_cost_cents` >= 0
			AND NEW.`reserved_minutes` = CAST(ROUND((julianday(rs.`ends_at`) - julianday(rs.`starts_at`)) * 1440) AS INTEGER)
			AND NEW.`evidence_valid_through` = rs.`ends_at`
	) THEN RAISE(ABORT, 'activation_snapshot_source_binding_invalid') END);
END;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `activated_shift_check_in_guard`;
--> statement-breakpoint
CREATE TRIGGER `check_in_revalidation_transition_v2`
BEFORE UPDATE OF `status`, `decision_id`, `evaluated_at` ON `assignment_revalidations`
WHEN OLD.`checkpoint` = 'check_in' AND NOT (
	(OLD.`status` = 'pending' AND NEW.`status` = 'failed' AND EXISTS (
		SELECT 1 FROM `assignment_activation_decisions` d
		WHERE d.`id` = NEW.`decision_id` AND d.`checkpoint` = 'check_in' AND d.`decision` = 'failed'))
	OR (OLD.`status` = 'pending' AND NEW.`status` = 'transitioning' AND EXISTS (
		SELECT 1 FROM `assignment_activation_decisions` d
		WHERE d.`id` = NEW.`decision_id` AND d.`checkpoint` = 'check_in' AND d.`decision` = 'passed'
			AND julianday(OLD.`scheduled_at`) <= julianday(CURRENT_TIMESTAMP)
			AND julianday(d.`evaluated_at`) BETWEEN julianday(CURRENT_TIMESTAMP, '-5 minutes') AND julianday(CURRENT_TIMESTAMP, '+1 minute')))
	OR (OLD.`status` = 'transitioning' AND NEW.`status` = 'passed'
		AND NEW.`decision_id` IS OLD.`decision_id` AND NEW.`evaluated_at` IS OLD.`evaluated_at`
		AND EXISTS (
			SELECT 1 FROM `assignment_activation_snapshots` snap
			JOIN `shifts` sh ON sh.`id` = snap.`shift_id`
			WHERE snap.`id` = OLD.`snapshot_id` AND sh.`status` = 'on_post' AND sh.`check_in_at` IS NOT NULL))
)
BEGIN
	SELECT RAISE(ABORT, 'check_in_revalidation_transition_invalid');
END;
--> statement-breakpoint
CREATE TRIGGER `scheduled_revalidation_transition_v2`
BEFORE UPDATE OF `status`, `decision_id`, `evaluated_at` ON `assignment_revalidations`
WHEN OLD.`checkpoint` IN ('t_minus_24','t_minus_2') AND NOT (
	OLD.`status` = 'pending' AND NEW.`status` IN ('passed','failed')
	AND julianday(OLD.`scheduled_at`) <= julianday(CURRENT_TIMESTAMP)
	AND EXISTS (
		SELECT 1 FROM `assignment_activation_decisions` d
		WHERE d.`id` = NEW.`decision_id` AND d.`checkpoint` = OLD.`checkpoint`
			AND d.`decision` = NEW.`status`
			AND julianday(d.`evaluated_at`) >= julianday(OLD.`scheduled_at`)
			AND julianday(d.`evaluated_at`) <= julianday(CURRENT_TIMESTAMP, '+1 minute'))
)
BEGIN
	SELECT RAISE(ABORT, 'scheduled_revalidation_transition_invalid');
END;
--> statement-breakpoint
CREATE TRIGGER `assignment_revalidations_no_delete_v2`
BEFORE DELETE ON `assignment_revalidations`
BEGIN
	SELECT RAISE(ABORT, 'assignment_revalidations_audit_history');
END;
--> statement-breakpoint
CREATE TRIGGER `activated_shift_check_in_guard_v2`
BEFORE UPDATE OF `status`, `check_in_at` ON `shifts`
WHEN NEW.`status` = 'on_post' AND EXISTS (
	SELECT 1 FROM `assignment_activation_snapshots` snap
	WHERE snap.`shift_id` = NEW.`id` AND snap.`environment` = 'production' AND snap.`final` = 1)
BEGIN
	SELECT (CASE WHEN OLD.`status` <> 'confirmed' OR OLD.`check_in_at` IS NOT NULL OR NEW.`check_in_at` IS NULL
		THEN RAISE(ABORT, 'activated_shift_transition_invalid') END);
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `assignment_activation_snapshots` snap
		JOIN `assignment_revalidations` rv ON rv.`snapshot_id` = snap.`id`
			AND rv.`checkpoint` = 'check_in' AND rv.`status` = 'transitioning'
		JOIN `assignment_activation_decisions` d ON d.`id` = rv.`decision_id`
		WHERE snap.`shift_id` = NEW.`id` AND d.`checkpoint` = 'check_in' AND d.`decision` = 'passed'
			AND julianday(d.`evaluated_at`) BETWEEN julianday(CURRENT_TIMESTAMP, '-5 minutes') AND julianday(CURRENT_TIMESTAMP, '+1 minute')
	) THEN RAISE(ABORT, 'fresh_check_in_revalidation_required') END);
END;
--> statement-breakpoint
CREATE TRIGGER `assignment_revalidation_identity_v2`
BEFORE UPDATE ON `assignment_revalidations`
WHEN NEW.`id` <> OLD.`id` OR NEW.`snapshot_id` <> OLD.`snapshot_id`
	OR NEW.`checkpoint` <> OLD.`checkpoint` OR NEW.`scheduled_at` <> OLD.`scheduled_at`
	OR NEW.`created_at` <> OLD.`created_at`
BEGIN
	SELECT RAISE(ABORT, 'assignment_revalidation_identity_immutable');
END;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `activation_command_final_guard`;
--> statement-breakpoint
CREATE TRIGGER `activation_command_final_hardening_v2`
BEFORE UPDATE OF `state` ON `assignment_activation_commands`
WHEN NEW.`state` = 'activated'
BEGIN
	SELECT (CASE WHEN EXISTS (
		SELECT 1 FROM `launch_controls` lc
		JOIN `roster_slots` rs ON rs.`id` = NEW.`roster_slot_id`
		WHERE lc.`code` IN ('G0_PHASE1_SCOPE','G1_PSIRA_PAPERWORK','G2_CONTROL_ROOM_INSPECTION','G3_PSIRA_CERTIFICATE','G4_WORKFORCE_ENGINE','G5_WORKFORCE_TERMS','G6_IDENTITY_PROVIDER','G7_CLIENT_FUNDS','G8_PAYROLL_INSURANCE','G9_PRODUCTION_CONTROLS')
			AND (lc.`verified_at` IS NULL OR julianday(lc.`verified_at`) > julianday(CURRENT_TIMESTAMP)
				OR lc.`expires_at` IS NULL OR julianday(lc.`expires_at`) < julianday(rs.`ends_at`))
	) THEN RAISE(ABORT, 'required_launch_gate_evidence_not_current') END);

	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `assignment_activation_snapshots` snap
		JOIN `roster_slots` rs ON rs.`id` = NEW.`roster_slot_id`
		JOIN `bookings` b ON b.`id` = snap.`booking_id` AND b.`id` = rs.`booking_id`
		JOIN `booking_funding_reconciliations` fr ON fr.`id` = snap.`funding_reconciliation_id`
		JOIN `site_risk_assessments` sra ON sra.`id` = snap.`risk_assessment_id`
		JOIN `post_order_approvals` poa ON poa.`id` = snap.`post_order_approval_id`
		JOIN `officer_site_inductions` osi ON osi.`id` = snap.`induction_id`
		WHERE snap.`command_id` = NEW.`id` AND snap.`environment` = 'production'
			AND snap.`integrity_state` = 'production_verified' AND snap.`evidence_valid_through` = rs.`ends_at`
			AND fr.`booking_id` = snap.`booking_id` AND fr.`active_key` = snap.`booking_id`
			AND fr.`environment` = 'production' AND fr.`integrity_state` = 'verified'
			AND fr.`status` = 'cleared_reconciled' AND fr.`provider` <> 'demo_manual'
			AND length(trim(fr.`provider_reference`)) > 0 AND fr.`currency` = 'ZAR'
			AND fr.`expected_amount_cents` = b.`client_price_cents`
			AND fr.`cleared_amount_cents` >= fr.`expected_amount_cents`
			AND length(trim(fr.`evidence_reference`)) > 0
			AND julianday(fr.`cleared_at`) <= julianday(CURRENT_TIMESTAMP)
			AND julianday(fr.`reconciled_at`) <= julianday(CURRENT_TIMESTAMP)
			AND julianday(fr.`evidence_verified_at`) <= julianday(CURRENT_TIMESTAMP)
			AND fr.`evidence_expires_at` IS NOT NULL AND julianday(fr.`evidence_expires_at`) >= julianday(rs.`ends_at`)
			AND sra.`site_id` = snap.`site_id` AND sra.`active_key` = snap.`site_id`
			AND sra.`status` = 'approved' AND sra.`environment` = 'production' AND sra.`integrity_state` = 'verified'
			AND length(trim(sra.`evidence_reference`)) > 0
			AND julianday(sra.`approved_at`) <= julianday(CURRENT_TIMESTAMP)
			AND julianday(sra.`valid_from`) <= julianday(rs.`starts_at`)
			AND sra.`expires_at` IS NOT NULL AND julianday(sra.`expires_at`) >= julianday(rs.`ends_at`)
			AND poa.`post_id` = snap.`post_id` AND poa.`active_key` = snap.`post_id`
			AND poa.`status` = 'approved' AND poa.`environment` = 'production' AND poa.`integrity_state` = 'verified'
			AND poa.`post_orders_version` = (SELECT sp.`post_orders_version` FROM `site_posts` sp WHERE sp.`id` = snap.`post_id`)
			AND length(trim(poa.`evidence_reference`)) > 0
			AND julianday(poa.`approved_at`) <= julianday(CURRENT_TIMESTAMP)
			AND julianday(poa.`valid_from`) <= julianday(rs.`starts_at`)
			AND poa.`expires_at` IS NOT NULL AND julianday(poa.`expires_at`) >= julianday(rs.`ends_at`)
			AND osi.`officer_id` = snap.`officer_id` AND osi.`site_id` = snap.`site_id`
			AND osi.`active_key` = snap.`officer_id` || ':' || snap.`site_id`
			AND osi.`status` = 'completed' AND osi.`environment` = 'production' AND osi.`integrity_state` = 'verified'
			AND length(trim(osi.`evidence_reference`)) > 0
			AND julianday(osi.`completed_at`) <= julianday(CURRENT_TIMESTAMP)
			AND osi.`expires_at` IS NOT NULL AND julianday(osi.`expires_at`) >= julianday(rs.`ends_at`)
	) THEN RAISE(ABORT, 'production_funding_site_evidence_invalid') END);

	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `assignment_activation_snapshots` snap
		JOIN `roster_slots` rs ON rs.`id` = NEW.`roster_slot_id`
		JOIN `site_posts` sp ON sp.`id` = snap.`post_id`
		JOIN `officers` o ON o.`id` = snap.`officer_id`
		JOIN `officer_passports` op ON op.`officer_id` = o.`id`
		JOIN `officer_services` svc ON svc.`officer_id` = o.`id` AND svc.`service_type` = sp.`service_type`
		WHERE snap.`command_id` = NEW.`id` AND o.`approval_status` = 'approved'
			AND o.`external_work_acknowledged` = 1 AND o.`rest_window_confirmed` = 1
			AND date(o.`psira_expiry`) >= date(rs.`ends_at`, '+2 hours')
			AND (CASE replace(upper(trim(o.`psira_grade`)), 'GRADE ', '')
				WHEN 'A' THEN 5 WHEN 'B' THEN 4 WHEN 'C' THEN 3 WHEN 'D' THEN 2 WHEN 'E' THEN 1 ELSE 0 END)
				>= (CASE replace(upper(trim(sp.`minimum_grade`)), 'GRADE ', '')
				WHEN 'A' THEN 5 WHEN 'B' THEN 4 WHEN 'C' THEN 3 WHEN 'D' THEN 2 WHEN 'E' THEN 1 ELSE 99 END)
			AND op.`status` IN ('active','expiring') AND op.`environment` = 'production' AND op.`integrity_state` = 'verified'
			AND length(trim(op.`evidence_reference`)) > 0
			AND julianday(op.`last_reviewed_at`) <= julianday(CURRENT_TIMESTAMP)
			AND op.`next_review_at` IS NOT NULL AND julianday(op.`next_review_at`) >= julianday(rs.`ends_at`)
			AND svc.`qualified` = 1 AND svc.`opted_in` = 1
			AND date(svc.`qualification_expiry`) >= date(rs.`ends_at`, '+2 hours')
			AND EXISTS (SELECT 1 FROM `compliance_records` cr
				WHERE cr.`officer_id` = o.`id` AND cr.`record_type` = 'identity' AND cr.`status` = 'current'
					AND cr.`environment` = 'production' AND cr.`integrity_state` = 'verified'
					AND length(trim(cr.`evidence_reference`)) > 0
					AND julianday(cr.`verified_at`) <= julianday(CURRENT_TIMESTAMP)
					AND cr.`expires_at` IS NOT NULL AND julianday(cr.`expires_at`) >= julianday(rs.`ends_at`))
			AND EXISTS (SELECT 1 FROM `compliance_records` cr
				WHERE cr.`officer_id` = o.`id` AND cr.`record_type` = 'psira' AND cr.`status` = 'current'
					AND cr.`environment` = 'production' AND cr.`integrity_state` = 'verified'
					AND length(trim(cr.`evidence_reference`)) > 0
					AND julianday(cr.`verified_at`) <= julianday(CURRENT_TIMESTAMP)
					AND cr.`expires_at` IS NOT NULL AND julianday(cr.`expires_at`) >= julianday(rs.`ends_at`))
			AND EXISTS (SELECT 1 FROM `officer_endorsements` oe
				WHERE oe.`officer_id` = o.`id` AND oe.`code` = 'core_ready' AND oe.`status` = 'current'
					AND oe.`environment` = 'production' AND oe.`integrity_state` = 'verified'
					AND length(trim(oe.`evidence_reference`)) > 0
					AND julianday(oe.`assessed_at`) <= julianday(CURRENT_TIMESTAMP)
					AND date(oe.`expires_at`) >= date(rs.`ends_at`, '+2 hours'))
			AND EXISTS (SELECT 1 FROM `officer_endorsements` oe
				WHERE oe.`officer_id` = o.`id` AND oe.`category` = 'service' AND oe.`service_type` = sp.`service_type`
					AND oe.`status` = 'current' AND oe.`environment` = 'production' AND oe.`integrity_state` = 'verified'
					AND length(trim(oe.`evidence_reference`)) > 0
					AND julianday(oe.`assessed_at`) <= julianday(CURRENT_TIMESTAMP)
					AND date(oe.`expires_at`) >= date(rs.`ends_at`, '+2 hours'))
			AND EXISTS (SELECT 1 FROM `officer_endorsements` oe
				WHERE oe.`officer_id` = o.`id` AND oe.`category` = 'purpose' AND oe.`purpose_code` = sp.`purpose_code`
					AND oe.`status` = 'current' AND oe.`environment` = 'production' AND oe.`integrity_state` = 'verified'
					AND length(trim(oe.`evidence_reference`)) > 0
					AND julianday(oe.`assessed_at`) <= julianday(CURRENT_TIMESTAMP)
					AND date(oe.`expires_at`) >= date(rs.`ends_at`, '+2 hours'))
	) THEN RAISE(ABORT, 'production_officer_evidence_invalid') END);

	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `assignment_activation_snapshots` snap
		JOIN `roster_slots` rs ON rs.`id` = NEW.`roster_slot_id`
		JOIN `workforce_engagements` we ON we.`id` = snap.`workforce_engagement_id`
		JOIN `workforce_employers` emp ON emp.`id` = snap.`employer_id` AND emp.`id` = we.`employer_id`
		JOIN `workforce_terms_acceptances` wta ON wta.`id` = snap.`terms_acceptance_id`
		WHERE snap.`command_id` = NEW.`id` AND we.`officer_id` = snap.`officer_id`
			AND we.`status` = 'active' AND we.`active_key` = we.`officer_id` AND we.`environment` = 'production'
			AND we.`model` = snap.`workforce_model` AND we.`terms_version` = snap.`terms_version`
			AND we.`review_due_at` IS NOT NULL AND julianday(we.`review_due_at`) >= julianday(rs.`ends_at`)
			AND emp.`status` = 'current' AND emp.`environment` = 'production'
			AND emp.`version` = snap.`employer_version` AND emp.`legal_name` = snap.`employer_legal_name`
			AND emp.`review_due_at` IS NOT NULL AND julianday(emp.`review_due_at`) >= julianday(rs.`ends_at`)
			AND ((we.`model` IN ('direct_flex','managed') AND emp.`employer_type` = 'lokd_employer'
				AND we.`payroll_status` = 'ready' AND we.`benefits_status` = 'ready')
				OR (we.`model` = 'partner' AND emp.`employer_type` = 'partner_company'
				AND we.`payroll_status` = 'partner_confirmed' AND we.`benefits_status` = 'partner_confirmed'))
			AND wta.`workforce_engagement_id` = we.`id` AND wta.`officer_id` = snap.`officer_id`
			AND wta.`active_key` = we.`id` AND wta.`terms_version` = we.`terms_version`
			AND wta.`environment` = 'production' AND wta.`integrity_state` = 'verified'
			AND length(trim(wta.`evidence_reference`)) > 0
			AND julianday(wta.`accepted_at`) <= julianday(CURRENT_TIMESTAMP)
			AND wta.`expires_at` IS NOT NULL AND julianday(wta.`expires_at`) >= julianday(rs.`ends_at`)
	) THEN RAISE(ABORT, 'production_workforce_route_invalid') END);

	SELECT (CASE WHEN (
		SELECT COUNT(DISTINCT ece.`control_code`) FROM `assignment_activation_snapshots` snap
		JOIN `roster_slots` rs ON rs.`id` = NEW.`roster_slot_id`
		JOIN `employer_compliance_evidence` ece ON ece.`employer_id` = snap.`employer_id`
		WHERE snap.`command_id` = NEW.`id`
			AND ece.`control_code` IN ('psira','nbcpss','psspf','uif','coida','insurance','service_agreement')
			AND ece.`active_key` = ece.`employer_id` || ':' || ece.`control_code`
			AND ece.`status` = 'current' AND ece.`environment` = 'production' AND ece.`integrity_state` = 'verified'
			AND length(trim(ece.`evidence_reference`)) > 0
			AND julianday(ece.`verified_at`) <= julianday(CURRENT_TIMESTAMP)
			AND ece.`expires_at` IS NOT NULL AND julianday(ece.`expires_at`) >= julianday(rs.`ends_at`)
	) <> 7 THEN RAISE(ABORT, 'production_employer_evidence_invalid') END);

	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `assignment_activation_snapshots` snap
		JOIN `roster_slots` rs ON rs.`id` = NEW.`roster_slot_id`
		JOIN `officer_availability_windows` av ON av.`officer_id` = snap.`officer_id`
		JOIN `officer_travel_assessments` ota ON ota.`officer_id` = snap.`officer_id` AND ota.`site_id` = snap.`site_id`
		WHERE snap.`command_id` = NEW.`id`
			AND av.`status` = 'available' AND av.`environment` = 'production' AND av.`integrity_state` = 'verified'
			AND length(trim(av.`evidence_reference`)) > 0 AND julianday(av.`rest_confirmed_at`) <= julianday(CURRENT_TIMESTAMP)
			AND julianday(av.`starts_at`) <= julianday(rs.`starts_at`) AND julianday(av.`ends_at`) >= julianday(rs.`ends_at`)
			AND ota.`status` = 'feasible' AND ota.`active_key` = snap.`officer_id` || ':' || snap.`site_id`
			AND ota.`environment` = 'production' AND ota.`integrity_state` = 'verified'
			AND length(trim(ota.`evidence_reference`)) > 0 AND julianday(ota.`assessed_at`) <= julianday(CURRENT_TIMESTAMP)
			AND ota.`valid_until` IS NOT NULL AND julianday(ota.`valid_until`) >= julianday(rs.`ends_at`)
	) THEN RAISE(ABORT, 'production_availability_travel_invalid') END);

	SELECT (CASE WHEN EXISTS (
		SELECT 1 FROM `roster_assignments` other
		JOIN `roster_slots` other_slot ON other_slot.`id` = other.`roster_slot_id`
		JOIN `roster_slots` candidate ON candidate.`id` = NEW.`roster_slot_id`
		WHERE other.`officer_id` = NEW.`officer_id` AND other.`id` <> NEW.`roster_assignment_id`
			AND other.`environment` = 'production' AND other.`integrity_state` = 'production_verified'
			AND other.`status` NOT IN ('cancelled','replaced','released')
			AND julianday(other_slot.`starts_at`) < julianday(candidate.`ends_at`, '+8 hours')
			AND julianday(other_slot.`ends_at`) > julianday(candidate.`starts_at`, '-8 hours')
	) OR EXISTS (
		SELECT 1 FROM `relief_dispatches` rd
		JOIN `roster_slots` relief_slot ON relief_slot.`id` = rd.`roster_slot_id`
		JOIN `roster_slots` candidate ON candidate.`id` = NEW.`roster_slot_id`
		WHERE rd.`replacement_officer_id` = NEW.`officer_id`
			AND rd.`environment` = 'production' AND rd.`integrity_state` = 'production_verified'
			AND rd.`status` NOT IN ('cancelled','replaced')
			AND julianday(relief_slot.`starts_at`) < julianday(candidate.`ends_at`, '+8 hours')
			AND julianday(relief_slot.`ends_at`) > julianday(candidate.`starts_at`, '-8 hours')
	) OR EXISTS (
		SELECT 1 FROM `officer_work_commitments` owc
		JOIN `roster_slots` candidate ON candidate.`id` = NEW.`roster_slot_id`
		WHERE owc.`officer_id` = NEW.`officer_id`
			AND owc.`environment` = 'production' AND owc.`integrity_state` = 'verified'
			AND owc.`status` <> 'cancelled'
			AND julianday(owc.`starts_at`) < julianday(candidate.`ends_at`, '+8 hours')
			AND julianday(owc.`ends_at`) > julianday(candidate.`starts_at`, '-8 hours')
	) THEN RAISE(ABORT, 'officer_work_rest_conflict') END);

	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `assignment_activation_snapshots` snap
		JOIN `roster_slots` rs ON rs.`id` = NEW.`roster_slot_id`
		JOIN `bookings` b ON b.`id` = snap.`booking_id`
		JOIN `shifts` sh ON sh.`id` = snap.`shift_id`
		WHERE snap.`command_id` = NEW.`id` AND snap.`pricing_version` = b.`pricing_version`
			AND snap.`calendar_category` = b.`calendar_category`
			AND b.`calendar_category` IN ('ordinary','sunday','public_holiday','easter','christmas')
			AND snap.`funded_offer_cents` = b.`officer_rate_cents`
			AND snap.`ordinary_wage_cents` = CAST(ROUND(b.`officer_rate_cents` / (CASE b.`calendar_category`
				WHEN 'ordinary' THEN 1.0 WHEN 'sunday' THEN CASE b.`engagement_model` WHEN 'flex' THEN 2.0 ELSE 1.5 END
				WHEN 'public_holiday' THEN 2.0 WHEN 'easter' THEN 2.25 WHEN 'christmas' THEN 2.5 END)) AS INTEGER)
			AND snap.`holiday_premium_cents` = snap.`funded_offer_cents` - snap.`ordinary_wage_cents`
			AND snap.`statutory_cost_cents` = CASE WHEN snap.`workforce_model` = 'partner' THEN 0 ELSE CAST(ROUND(snap.`funded_offer_cents` * 0.15) AS INTEGER) END
			AND sh.`booking_id` = snap.`booking_id` AND sh.`officer_id` = snap.`officer_id`
			AND sh.`earnings_cents` = snap.`funded_offer_cents`
			AND snap.`reserved_minutes` = CAST(ROUND((julianday(rs.`ends_at`) - julianday(rs.`starts_at`)) * 1440) AS INTEGER)
	) THEN RAISE(ABORT, 'production_frozen_economics_invalid') END);

	SELECT (CASE WHEN EXISTS (
		SELECT 1 FROM `assignment_activation_snapshots` snap
		JOIN `roster_slots` rs ON rs.`id` = NEW.`roster_slot_id`
		WHERE snap.`command_id` = NEW.`id` AND snap.`workforce_model` = 'direct_flex'
			AND NOT EXISTS (
				SELECT 1 FROM `workforce_hour_reservations` h
				WHERE h.`command_id` = NEW.`id` AND h.`roster_assignment_id` = NEW.`roster_assignment_id`
					AND h.`officer_id` = NEW.`officer_id` AND h.`source_type` = 'assignment' AND h.`status` = 'active'
				GROUP BY h.`command_id`
				HAVING SUM(h.`reserved_minutes`) = snap.`reserved_minutes`
					AND julianday(MIN(h.`segment_starts_at`)) = julianday(rs.`starts_at`)
					AND julianday(MAX(h.`segment_ends_at`)) = julianday(rs.`ends_at`))
	) THEN RAISE(ABORT, 'direct_flex_hour_coverage_invalid') END);
	SELECT (CASE WHEN EXISTS (
		SELECT 1 FROM `assignment_activation_snapshots` snap
		WHERE snap.`command_id` = NEW.`id` AND snap.`workforce_model` <> 'direct_flex'
			AND EXISTS (SELECT 1 FROM `workforce_hour_reservations` h WHERE h.`command_id` = NEW.`id` AND h.`status` = 'active')
	) THEN RAISE(ABORT, 'non_flex_hour_reservation_invalid') END);
END;
