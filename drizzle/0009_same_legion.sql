ALTER TABLE `assignment_activation_snapshots` ADD `shift_starts_at` text NOT NULL;--> statement-breakpoint
ALTER TABLE `assignment_activation_snapshots` ADD `shift_ends_at` text NOT NULL;--> statement-breakpoint
ALTER TABLE `assignment_activation_snapshots` ADD `funding_evidence` text NOT NULL;--> statement-breakpoint
ALTER TABLE `assignment_activation_snapshots` ADD `site_evidence` text NOT NULL;
--> statement-breakpoint
CREATE TRIGGER `activation_snapshot_evidence_payload_v3`
BEFORE INSERT ON `assignment_activation_snapshots`
BEGIN
	SELECT CASE WHEN NEW.`shift_starts_at` <> (SELECT rs.`starts_at` FROM `roster_assignments` ra
		JOIN `roster_slots` rs ON rs.`id` = ra.`roster_slot_id` WHERE ra.`id` = NEW.`roster_assignment_id`)
		OR NEW.`shift_ends_at` <> (SELECT rs.`ends_at` FROM `roster_assignments` ra
		JOIN `roster_slots` rs ON rs.`id` = ra.`roster_slot_id` WHERE ra.`id` = NEW.`roster_assignment_id`)
		OR json_valid(NEW.`funding_evidence`) <> 1 OR json_valid(NEW.`site_evidence`) <> 1
	THEN RAISE(ABORT, 'activation_snapshot_evidence_payload_invalid') END;
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1 FROM `booking_funding_reconciliations` fr
		JOIN `bookings` b ON b.`id` = fr.`booking_id`
		WHERE fr.`id` = NEW.`funding_reconciliation_id` AND b.`id` = NEW.`booking_id`
			AND json_extract(NEW.`funding_evidence`, '$.reconciliationId') = fr.`id`
			AND json_extract(NEW.`funding_evidence`, '$.environment') = fr.`environment`
			AND json_extract(NEW.`funding_evidence`, '$.integrityState') = fr.`integrity_state`
			AND json_extract(NEW.`funding_evidence`, '$.provider') = fr.`provider`
			AND json_extract(NEW.`funding_evidence`, '$.providerReference') = fr.`provider_reference`
			AND json_extract(NEW.`funding_evidence`, '$.status') = fr.`status`
			AND json_extract(NEW.`funding_evidence`, '$.currency') = fr.`currency`
			AND json_extract(NEW.`funding_evidence`, '$.bookingAmountCents') = b.`client_price_cents`
			AND json_extract(NEW.`funding_evidence`, '$.expectedAmountCents') = fr.`expected_amount_cents`
			AND json_extract(NEW.`funding_evidence`, '$.clearedAmountCents') = fr.`cleared_amount_cents`
			AND json_extract(NEW.`funding_evidence`, '$.evidenceReference') = fr.`evidence_reference`
			AND julianday(json_extract(NEW.`funding_evidence`, '$.clearedAt')) = julianday(fr.`cleared_at`)
			AND julianday(json_extract(NEW.`funding_evidence`, '$.reconciledAt')) = julianday(fr.`reconciled_at`)
			AND julianday(json_extract(NEW.`funding_evidence`, '$.verifiedAt')) = julianday(fr.`evidence_verified_at`)
			AND julianday(json_extract(NEW.`funding_evidence`, '$.expiresAt')) = julianday(fr.`evidence_expires_at`)
	) THEN RAISE(ABORT, 'activation_snapshot_funding_payload_invalid') END;
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1 FROM `clients` c JOIN `operational_sites` os ON os.`client_id` = c.`id`
		JOIN `site_posts` sp ON sp.`site_id` = os.`id`
		JOIN `site_risk_assessments` sra ON sra.`id` = NEW.`risk_assessment_id` AND sra.`site_id` = os.`id`
		JOIN `post_order_approvals` poa ON poa.`id` = NEW.`post_order_approval_id` AND poa.`post_id` = sp.`id`
		JOIN `officer_site_inductions` osi ON osi.`id` = NEW.`induction_id`
		WHERE c.`id` = NEW.`client_id` AND os.`id` = NEW.`site_id` AND sp.`id` = NEW.`post_id`
			AND osi.`officer_id` = NEW.`officer_id` AND osi.`site_id` = NEW.`site_id`
			AND json_extract(NEW.`site_evidence`, '$.client.id') = c.`id`
			AND json_extract(NEW.`site_evidence`, '$.client.approvalStatus') = c.`approval_status`
			AND json_extract(NEW.`site_evidence`, '$.site.id') = os.`id`
			AND json_extract(NEW.`site_evidence`, '$.site.status') = os.`status`
			AND json_extract(NEW.`site_evidence`, '$.site.version') = os.`version`
			AND json_extract(NEW.`site_evidence`, '$.site.risk.id') = sra.`id`
			AND CAST(json_extract(NEW.`site_evidence`, '$.site.risk.version') AS TEXT) = CAST(sra.`risk_rules_version` AS TEXT)
			AND json_extract(NEW.`site_evidence`, '$.site.risk.environment') = sra.`environment`
			AND json_extract(NEW.`site_evidence`, '$.site.risk.integrityState') = sra.`integrity_state`
			AND json_extract(NEW.`site_evidence`, '$.site.risk.evidenceReference') = sra.`evidence_reference`
			AND julianday(json_extract(NEW.`site_evidence`, '$.site.risk.verifiedAt')) = julianday(sra.`approved_at`)
			AND julianday(json_extract(NEW.`site_evidence`, '$.site.risk.validFrom')) = julianday(sra.`valid_from`)
			AND julianday(json_extract(NEW.`site_evidence`, '$.site.risk.expiresAt')) = julianday(sra.`expires_at`)
			AND json_extract(NEW.`site_evidence`, '$.post.id') = sp.`id`
			AND json_extract(NEW.`site_evidence`, '$.post.status') = sp.`status`
			AND json_extract(NEW.`site_evidence`, '$.post.postOrdersVersion') = sp.`post_orders_version`
			AND json_extract(NEW.`site_evidence`, '$.post.orders.id') = poa.`id`
			AND CAST(json_extract(NEW.`site_evidence`, '$.post.orders.version') AS TEXT) = CAST(poa.`post_orders_version` AS TEXT)
			AND json_extract(NEW.`site_evidence`, '$.post.orders.environment') = poa.`environment`
			AND json_extract(NEW.`site_evidence`, '$.post.orders.integrityState') = poa.`integrity_state`
			AND json_extract(NEW.`site_evidence`, '$.post.orders.evidenceReference') = poa.`evidence_reference`
			AND julianday(json_extract(NEW.`site_evidence`, '$.post.orders.verifiedAt')) = julianday(poa.`approved_at`)
			AND julianday(json_extract(NEW.`site_evidence`, '$.post.orders.validFrom')) = julianday(poa.`valid_from`)
			AND julianday(json_extract(NEW.`site_evidence`, '$.post.orders.expiresAt')) = julianday(poa.`expires_at`)
			AND json_extract(NEW.`site_evidence`, '$.induction.id') = osi.`id`
			AND CAST(json_extract(NEW.`site_evidence`, '$.induction.version') AS TEXT) = CAST(osi.`induction_version` AS TEXT)
			AND json_extract(NEW.`site_evidence`, '$.induction.environment') = osi.`environment`
			AND json_extract(NEW.`site_evidence`, '$.induction.integrityState') = osi.`integrity_state`
			AND json_extract(NEW.`site_evidence`, '$.induction.evidenceReference') = osi.`evidence_reference`
			AND julianday(json_extract(NEW.`site_evidence`, '$.induction.verifiedAt')) = julianday(osi.`completed_at`)
			AND julianday(json_extract(NEW.`site_evidence`, '$.induction.expiresAt')) = julianday(osi.`expires_at`)
	) THEN RAISE(ABORT, 'activation_snapshot_site_payload_invalid') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activated_roster_slot_binding_immutable_v3`
BEFORE UPDATE OF `site_id`,`post_id`,`booking_id`,`service_date`,`starts_at`,`ends_at`,`arrival_due_at`,`check_in_due_at` ON `roster_slots`
WHEN (NEW.`site_id` IS NOT OLD.`site_id` OR NEW.`post_id` IS NOT OLD.`post_id`
	OR NEW.`booking_id` IS NOT OLD.`booking_id` OR NEW.`service_date` IS NOT OLD.`service_date`
	OR NEW.`starts_at` IS NOT OLD.`starts_at` OR NEW.`ends_at` IS NOT OLD.`ends_at`
	OR NEW.`arrival_due_at` IS NOT OLD.`arrival_due_at` OR NEW.`check_in_due_at` IS NOT OLD.`check_in_due_at`)
	AND EXISTS (SELECT 1 FROM `assignment_activation_commands` c
		JOIN `assignment_activation_snapshots` snap ON snap.`command_id` = c.`id`
		WHERE c.`roster_slot_id` = OLD.`id` AND c.`state` = 'activated' AND snap.`final` = 1)
BEGIN
	SELECT RAISE(ABORT, 'activated_roster_slot_binding_immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `activated_assignment_binding_immutable_v3`
BEFORE UPDATE OF `roster_slot_id`,`officer_id`,`shift_id`,`assignment_kind`,`assigned_by`,`assigned_at` ON `roster_assignments`
WHEN (NEW.`roster_slot_id` IS NOT OLD.`roster_slot_id` OR NEW.`officer_id` IS NOT OLD.`officer_id`
	OR NEW.`shift_id` IS NOT OLD.`shift_id` OR NEW.`assignment_kind` IS NOT OLD.`assignment_kind`
	OR NEW.`assigned_by` IS NOT OLD.`assigned_by` OR NEW.`assigned_at` IS NOT OLD.`assigned_at`)
	AND EXISTS (SELECT 1 FROM `assignment_activation_snapshots` snap WHERE snap.`roster_assignment_id` = OLD.`id` AND snap.`final` = 1)
BEGIN
	SELECT RAISE(ABORT, 'activated_assignment_binding_immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `activated_shift_binding_immutable_v3`
BEFORE UPDATE OF `booking_id`,`officer_id`,`scheduled_date`,`earnings_cents` ON `shifts`
WHEN (NEW.`booking_id` IS NOT OLD.`booking_id` OR NEW.`officer_id` IS NOT OLD.`officer_id`
	OR NEW.`scheduled_date` IS NOT OLD.`scheduled_date` OR NEW.`earnings_cents` IS NOT OLD.`earnings_cents`)
	AND EXISTS (SELECT 1 FROM `assignment_activation_snapshots` snap WHERE snap.`shift_id` = OLD.`id` AND snap.`final` = 1)
BEGIN
	SELECT RAISE(ABORT, 'activated_shift_binding_immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `activated_booking_economics_immutable_v3`
BEFORE UPDATE OF `client_id`,`service_type`,`purpose_code`,`engagement_model`,`calendar_category`,`minimum_grade`,`client_price_cents`,`officer_rate_cents`,`pricing_version` ON `bookings`
WHEN (NEW.`client_id` IS NOT OLD.`client_id` OR NEW.`service_type` IS NOT OLD.`service_type`
	OR NEW.`purpose_code` IS NOT OLD.`purpose_code` OR NEW.`engagement_model` IS NOT OLD.`engagement_model`
	OR NEW.`calendar_category` IS NOT OLD.`calendar_category` OR NEW.`minimum_grade` IS NOT OLD.`minimum_grade`
	OR NEW.`client_price_cents` IS NOT OLD.`client_price_cents` OR NEW.`officer_rate_cents` IS NOT OLD.`officer_rate_cents`
	OR NEW.`pricing_version` IS NOT OLD.`pricing_version`)
	AND EXISTS (SELECT 1 FROM `assignment_activation_snapshots` snap WHERE snap.`booking_id` = OLD.`id` AND snap.`final` = 1)
BEGIN
	SELECT RAISE(ABORT, 'activated_booking_economics_immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `activation_all_hard_gates_v3`
BEFORE UPDATE OF `state` ON `assignment_activation_commands`
WHEN NEW.`state` = 'activated'
BEGIN
	SELECT CASE WHEN EXISTS (
		SELECT 1 FROM `launch_controls` lc JOIN `roster_slots` rs ON rs.`id` = NEW.`roster_slot_id`
		WHERE (lc.`hard_gate` = 1 OR lc.`code` IN ('G0_PHASE1_SCOPE','G1_PSIRA_PAPERWORK','G2_CONTROL_ROOM_INSPECTION','G3_PSIRA_CERTIFICATE','G4_WORKFORCE_ENGINE','G5_WORKFORCE_TERMS','G6_IDENTITY_PROVIDER','G7_CLIENT_FUNDS','G8_PAYROLL_INSURANCE','G9_PRODUCTION_CONTROLS'))
			AND ((lc.`code` IN ('G0_PHASE1_SCOPE','G1_PSIRA_PAPERWORK','G2_CONTROL_ROOM_INSPECTION','G3_PSIRA_CERTIFICATE','G4_WORKFORCE_ENGINE','G5_WORKFORCE_TERMS','G6_IDENTITY_PROVIDER','G7_CLIENT_FUNDS','G8_PAYROLL_INSURANCE','G9_PRODUCTION_CONTROLS') AND lc.`hard_gate` <> 1)
				OR lc.`status` <> 'passed' OR lc.`evidence_level` NOT IN ('system_verified','independently_verified')
				OR lc.`evidence_reference` IS NULL OR length(trim(lc.`evidence_reference`)) = 0
				OR lc.`verified_at` IS NULL OR julianday(lc.`verified_at`) IS NULL
				OR julianday(lc.`verified_at`) > julianday(CURRENT_TIMESTAMP)
				OR lc.`expires_at` IS NULL OR julianday(lc.`expires_at`) IS NULL
				OR julianday(lc.`expires_at`) < julianday(rs.`ends_at`))
	) THEN RAISE(ABORT, 'all_hard_launch_gates_invalid') END;
END;
--> statement-breakpoint
CREATE TRIGGER `assignment_revalidation_insert_shape_v3`
BEFORE INSERT ON `assignment_revalidations`
BEGIN
	SELECT CASE WHEN NEW.`checkpoint` NOT IN ('t_minus_24','t_minus_2','check_in')
		OR NEW.`status` <> 'pending' OR NEW.`decision_id` IS NOT NULL OR NEW.`evaluated_at` IS NOT NULL
		OR NOT EXISTS (
			SELECT 1 FROM `assignment_activation_snapshots` snap
			JOIN `assignment_activation_commands` c ON c.`id` = snap.`command_id`
			WHERE snap.`id` = NEW.`snapshot_id` AND snap.`environment` = 'production'
				AND snap.`integrity_state` = 'production_verified' AND snap.`final` = 1
				AND c.`state` = 'reserved' AND c.`environment` = 'production' AND c.`integrity_state` = 'production_verified'
				AND abs(julianday(NEW.`scheduled_at`) - julianday(snap.`shift_starts_at`,
					CASE NEW.`checkpoint` WHEN 't_minus_24' THEN '-24 hours' WHEN 't_minus_2' THEN '-2 hours' ELSE '-30 minutes' END)) < 0.000001)
	THEN RAISE(ABORT, 'assignment_revalidation_insert_invalid') END;
END;
--> statement-breakpoint
CREATE TRIGGER `assignment_revalidation_decision_binding_v3`
BEFORE UPDATE OF `status`,`decision_id`,`evaluated_at` ON `assignment_revalidations`
WHEN NEW.`status` IS NOT OLD.`status` OR NEW.`decision_id` IS NOT OLD.`decision_id` OR NEW.`evaluated_at` IS NOT OLD.`evaluated_at`
BEGIN
	SELECT CASE WHEN NEW.`decision_id` IS NULL OR NEW.`evaluated_at` IS NULL
		OR (OLD.`status` = 'pending' AND julianday(OLD.`scheduled_at`) > julianday(CURRENT_TIMESTAMP))
		OR NOT EXISTS (
			SELECT 1 FROM `assignment_activation_snapshots` snap
			JOIN `assignment_activation_commands` c ON c.`id` = snap.`command_id`
			JOIN `assignment_activation_decisions` d ON d.`id` = NEW.`decision_id`
			WHERE snap.`id` = OLD.`snapshot_id` AND snap.`final` = 1
				AND snap.`environment` = 'production' AND snap.`integrity_state` = 'production_verified'
				AND c.`state` = 'activated' AND d.`command_id` = snap.`command_id`
				AND d.`checkpoint` = OLD.`checkpoint` AND d.`environment` = 'production'
				AND length(trim(d.`evaluation_hash`)) > 0
				AND d.`decision` = CASE WHEN NEW.`status` = 'failed' THEN 'failed' ELSE 'passed' END
				AND julianday(NEW.`evaluated_at`) = julianday(d.`evaluated_at`)
				AND ((d.`decision` = 'passed' AND NOT EXISTS (
					SELECT 1 FROM `assignment_activation_blockers` b WHERE b.`decision_id` = d.`id`))
					OR (d.`decision` = 'failed' AND EXISTS (
						SELECT 1 FROM `assignment_activation_blockers` b WHERE b.`decision_id` = d.`id`))))
	THEN RAISE(ABORT, 'assignment_revalidation_decision_binding_invalid') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activated_shift_check_in_binding_v3`
BEFORE UPDATE OF `status`,`check_in_at` ON `shifts`
WHEN NEW.`status` = 'on_post' AND EXISTS (
	SELECT 1 FROM `assignment_activation_snapshots` snap WHERE snap.`shift_id` = NEW.`id` AND snap.`environment` = 'production' AND snap.`final` = 1)
BEGIN
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1 FROM `assignment_activation_snapshots` snap
		JOIN `assignment_revalidations` rv ON rv.`snapshot_id` = snap.`id` AND rv.`checkpoint` = 'check_in' AND rv.`status` = 'transitioning'
		JOIN `assignment_activation_decisions` d ON d.`id` = rv.`decision_id`
		WHERE snap.`shift_id` = NEW.`id` AND d.`command_id` = snap.`command_id` AND d.`environment` = 'production'
			AND d.`decision` = 'passed' AND julianday(rv.`evaluated_at`) = julianday(d.`evaluated_at`)
	) THEN RAISE(ABORT, 'check_in_decision_binding_invalid') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_revalidation_set_complete_v3`
BEFORE UPDATE OF `state` ON `assignment_activation_commands`
WHEN NEW.`state` = 'activated'
BEGIN
	SELECT CASE WHEN (
		SELECT COUNT(*) FROM `assignment_activation_snapshots` snap
		JOIN `assignment_revalidations` rv ON rv.`snapshot_id` = snap.`id`
		WHERE snap.`command_id` = NEW.`id` AND rv.`status` = 'pending' AND rv.`decision_id` IS NULL AND rv.`evaluated_at` IS NULL
			AND ((rv.`checkpoint` = 't_minus_24' AND abs(julianday(rv.`scheduled_at`) - julianday(snap.`shift_starts_at`, '-24 hours')) < 0.000001)
				OR (rv.`checkpoint` = 't_minus_2' AND abs(julianday(rv.`scheduled_at`) - julianday(snap.`shift_starts_at`, '-2 hours')) < 0.000001)
				OR (rv.`checkpoint` = 'check_in' AND abs(julianday(rv.`scheduled_at`) - julianday(snap.`shift_starts_at`, '-30 minutes')) < 0.000001))
	) <> 3 OR (
		SELECT COUNT(DISTINCT rv.`checkpoint`) FROM `assignment_activation_snapshots` snap
		JOIN `assignment_revalidations` rv ON rv.`snapshot_id` = snap.`id` WHERE snap.`command_id` = NEW.`id`
	) <> 3 THEN RAISE(ABORT, 'activation_revalidation_set_incomplete') END;
END;
--> statement-breakpoint
CREATE TRIGGER `hour_reservation_total_week_cap_v3`
BEFORE INSERT ON `workforce_hour_reservations`
WHEN NEW.`status` = 'active'
BEGIN
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1 FROM `workforce_engagements` we
		WHERE we.`id` = NEW.`workforce_engagement_id` AND we.`officer_id` = NEW.`officer_id`
			AND we.`model` = 'direct_flex' AND we.`status` = 'active' AND we.`active_key` = we.`officer_id`
			AND we.`weekly_hour_cap` IS NOT NULL AND we.`weekly_hour_cap` > 0
			AND NEW.`weekly_cap_minutes` = we.`weekly_hour_cap` * 60
	) THEN RAISE(ABORT, 'invalid_direct_flex_engagement') END;
	SELECT CASE WHEN EXISTS (
		SELECT 1 FROM `roster_assignments` ra JOIN `roster_slots` rs ON rs.`id` = ra.`roster_slot_id`
		WHERE ra.`officer_id` = NEW.`officer_id` AND ra.`status` NOT IN ('cancelled','replaced','released')
			AND NOT (NEW.`source_type` = 'assignment' AND ra.`id` = NEW.`source_id`)
			AND (julianday(rs.`starts_at`) IS NULL OR julianday(rs.`ends_at`) IS NULL
				OR julianday(rs.`ends_at`) <= julianday(rs.`starts_at`)
				OR strftime('%S',rs.`starts_at`) <> '00' OR strftime('%S',rs.`ends_at`) <> '00')
		UNION ALL
		SELECT 1 FROM `relief_dispatches` rd JOIN `roster_slots` rs ON rs.`id` = rd.`roster_slot_id`
		WHERE rd.`replacement_officer_id` = NEW.`officer_id` AND rd.`status` NOT IN ('cancelled','replaced')
			AND NOT (NEW.`source_type` = 'relief' AND rd.`id` = NEW.`source_id`)
			AND (julianday(rs.`starts_at`) IS NULL OR julianday(rs.`ends_at`) IS NULL
				OR julianday(rs.`ends_at`) <= julianday(rs.`starts_at`)
				OR strftime('%S',rs.`starts_at`) <> '00' OR strftime('%S',rs.`ends_at`) <> '00')
		UNION ALL
		SELECT 1 FROM `officer_work_commitments` owc
		WHERE owc.`officer_id` = NEW.`officer_id` AND owc.`status` <> 'cancelled'
			AND (julianday(owc.`starts_at`) IS NULL OR julianday(owc.`ends_at`) IS NULL
				OR julianday(owc.`ends_at`) <= julianday(owc.`starts_at`)
				OR strftime('%S',owc.`starts_at`) <> '00' OR strftime('%S',owc.`ends_at`) <> '00')
	) THEN RAISE(ABORT, 'existing_work_interval_invalid') END;
	SELECT CASE WHEN NEW.`reserved_minutes` + COALESCE((
		SELECT SUM(`work_minutes`) FROM (
			SELECT r.`reserved_minutes` AS `work_minutes`
			FROM `workforce_hour_reservations` r
			WHERE r.`officer_id` = NEW.`officer_id` AND r.`iso_week_start` = NEW.`iso_week_start`
				AND r.`status` = 'active'
				AND NOT (r.`source_type` = NEW.`source_type` AND r.`source_id` = NEW.`source_id`)
			UNION ALL
			SELECT CAST(ROUND((
				MIN(julianday(rs.`ends_at`),julianday(date(NEW.`iso_week_start`,'+7 days')||'T00:00:00+02:00'))-
				MAX(julianday(rs.`starts_at`),julianday(NEW.`iso_week_start`||'T00:00:00+02:00'))
			)*1440) AS INTEGER)
			FROM `roster_assignments` ra JOIN `roster_slots` rs ON rs.`id` = ra.`roster_slot_id`
			WHERE ra.`officer_id` = NEW.`officer_id` AND ra.`status` NOT IN ('cancelled','replaced','released')
				AND NOT (NEW.`source_type` = 'assignment' AND ra.`id` = NEW.`source_id`)
				AND julianday(rs.`starts_at`) < julianday(date(NEW.`iso_week_start`,'+7 days')||'T00:00:00+02:00')
				AND julianday(rs.`ends_at`) > julianday(NEW.`iso_week_start`||'T00:00:00+02:00')
				AND NOT EXISTS (SELECT 1 FROM `workforce_hour_reservations` covered
					WHERE covered.`officer_id` = NEW.`officer_id` AND covered.`status` = 'active'
						AND covered.`source_type` = 'assignment' AND covered.`source_id` = ra.`id`
						AND covered.`iso_week_start` = NEW.`iso_week_start`)
			UNION ALL
			SELECT CAST(ROUND((
				MIN(julianday(rs.`ends_at`),julianday(date(NEW.`iso_week_start`,'+7 days')||'T00:00:00+02:00'))-
				MAX(julianday(rs.`starts_at`),julianday(NEW.`iso_week_start`||'T00:00:00+02:00'))
			)*1440) AS INTEGER)
			FROM `relief_dispatches` rd JOIN `roster_slots` rs ON rs.`id` = rd.`roster_slot_id`
			WHERE rd.`replacement_officer_id` = NEW.`officer_id` AND rd.`status` NOT IN ('cancelled','replaced')
				AND NOT (NEW.`source_type` = 'relief' AND rd.`id` = NEW.`source_id`)
				AND julianday(rs.`starts_at`) < julianday(date(NEW.`iso_week_start`,'+7 days')||'T00:00:00+02:00')
				AND julianday(rs.`ends_at`) > julianday(NEW.`iso_week_start`||'T00:00:00+02:00')
				AND NOT EXISTS (SELECT 1 FROM `workforce_hour_reservations` covered
					WHERE covered.`officer_id` = NEW.`officer_id` AND covered.`status` = 'active'
						AND covered.`source_type` = 'relief' AND covered.`source_id` = rd.`id`
						AND covered.`iso_week_start` = NEW.`iso_week_start`)
			UNION ALL
			SELECT CAST(ROUND((
				MIN(julianday(owc.`ends_at`),julianday(date(NEW.`iso_week_start`,'+7 days')||'T00:00:00+02:00'))-
				MAX(julianday(owc.`starts_at`),julianday(NEW.`iso_week_start`||'T00:00:00+02:00'))
			)*1440) AS INTEGER)
			FROM `officer_work_commitments` owc
			WHERE owc.`officer_id` = NEW.`officer_id` AND owc.`status` <> 'cancelled'
				AND julianday(owc.`starts_at`) < julianday(date(NEW.`iso_week_start`,'+7 days')||'T00:00:00+02:00')
				AND julianday(owc.`ends_at`) > julianday(NEW.`iso_week_start`||'T00:00:00+02:00')
		) `weekly_work`
	),0) > NEW.`weekly_cap_minutes`
	THEN RAISE(ABORT,'direct_flex_weekly_cap_exceeded') END;
END;
