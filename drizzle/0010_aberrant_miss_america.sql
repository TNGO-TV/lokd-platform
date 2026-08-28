DROP TRIGGER IF EXISTS `hour_reservation_total_week_cap_v3`;
--> statement-breakpoint
CREATE TRIGGER `hour_reservation_exact_source_segment_v4`
BEFORE INSERT ON `workforce_hour_reservations`
WHEN NEW.`status` = 'active'
BEGIN
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1 FROM `workforce_engagements` we
		WHERE we.`id` = NEW.`workforce_engagement_id` AND we.`officer_id` = NEW.`officer_id`
			AND we.`model` = 'direct_flex' AND we.`status` = 'active' AND we.`active_key` = we.`officer_id`
			AND ((we.`environment` = 'production' AND (
				(NEW.`source_type` = 'assignment' AND EXISTS (
					SELECT 1 FROM `roster_assignments` ra JOIN `roster_slots` rs ON rs.`id` = ra.`roster_slot_id`
					WHERE ra.`id` = NEW.`source_id` AND ra.`id` = NEW.`roster_assignment_id`
						AND ra.`officer_id` = NEW.`officer_id`
						AND ra.`environment` = 'production' AND ra.`integrity_state` = 'production_verified'
						AND julianday(NEW.`segment_starts_at`) = MAX(julianday(rs.`starts_at`), julianday(NEW.`iso_week_start`||'T00:00:00+02:00'))
						AND julianday(NEW.`segment_ends_at`) = MIN(julianday(rs.`ends_at`), julianday(date(NEW.`iso_week_start`,'+7 days')||'T00:00:00+02:00'))))
				OR (NEW.`source_type` = 'relief' AND EXISTS (
					SELECT 1 FROM `relief_dispatches` rd JOIN `roster_slots` rs ON rs.`id` = rd.`roster_slot_id`
					WHERE rd.`id` = NEW.`source_id` AND rd.`id` = NEW.`relief_dispatch_id`
						AND rd.`replacement_officer_id` = NEW.`officer_id`
						AND rd.`environment` = 'production' AND rd.`integrity_state` = 'production_verified'
						AND julianday(NEW.`segment_starts_at`) = MAX(julianday(rs.`starts_at`), julianday(NEW.`iso_week_start`||'T00:00:00+02:00'))
						AND julianday(NEW.`segment_ends_at`) = MIN(julianday(rs.`ends_at`), julianday(date(NEW.`iso_week_start`,'+7 days')||'T00:00:00+02:00'))))))
			OR (we.`environment` = 'demo' AND (
				(NEW.`source_type` = 'assignment' AND EXISTS (
					SELECT 1 FROM `roster_assignments` ra JOIN `roster_slots` rs ON rs.`id` = ra.`roster_slot_id`
					WHERE ra.`id` = NEW.`source_id` AND ra.`id` = NEW.`roster_assignment_id`
						AND ra.`officer_id` = NEW.`officer_id`
						AND ra.`environment` = 'demo' AND ra.`integrity_state` = 'synthetic'
						AND julianday(NEW.`segment_starts_at`) = MAX(julianday(rs.`starts_at`), julianday(NEW.`iso_week_start`||'T00:00:00+02:00'))
						AND julianday(NEW.`segment_ends_at`) = MIN(julianday(rs.`ends_at`), julianday(date(NEW.`iso_week_start`,'+7 days')||'T00:00:00+02:00'))))
				OR (NEW.`source_type` = 'relief' AND EXISTS (
					SELECT 1 FROM `relief_dispatches` rd JOIN `roster_slots` rs ON rs.`id` = rd.`roster_slot_id`
					WHERE rd.`id` = NEW.`source_id` AND rd.`id` = NEW.`relief_dispatch_id`
						AND rd.`replacement_officer_id` = NEW.`officer_id`
						AND rd.`environment` = 'demo' AND rd.`integrity_state` = 'synthetic'
						AND julianday(NEW.`segment_starts_at`) = MAX(julianday(rs.`starts_at`), julianday(NEW.`iso_week_start`||'T00:00:00+02:00'))
						AND julianday(NEW.`segment_ends_at`) = MIN(julianday(rs.`ends_at`), julianday(date(NEW.`iso_week_start`,'+7 days')||'T00:00:00+02:00')))))))
	) THEN RAISE(ABORT, 'hour_source_segment_or_environment_invalid') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_production_source_binding_v4`
BEFORE UPDATE OF `state` ON `assignment_activation_commands`
WHEN NEW.`state` = 'activated'
BEGIN
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1 FROM `assignment_activation_snapshots` snap
		JOIN `roster_assignments` ra ON ra.`id` = snap.`roster_assignment_id`
		JOIN `shifts` sh ON sh.`id` = snap.`shift_id`
		WHERE snap.`command_id` = NEW.`id` AND snap.`final` = 1
			AND snap.`environment` = 'production' AND snap.`integrity_state` = 'production_verified'
			AND ra.`id` = NEW.`roster_assignment_id` AND ra.`roster_slot_id` = NEW.`roster_slot_id`
			AND ra.`officer_id` = NEW.`officer_id` AND ra.`shift_id` = NEW.`shift_id`
			AND ra.`environment` = 'production' AND ra.`integrity_state` = 'production_verified'
			AND sh.`id` = NEW.`shift_id` AND sh.`booking_id` = snap.`booking_id`
			AND sh.`officer_id` = NEW.`officer_id`
			AND sh.`environment` = 'production' AND sh.`integrity_state` = 'production_verified'
	) THEN RAISE(ABORT, 'activation_production_source_binding_invalid') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activated_assignment_source_immutable_v4`
BEFORE UPDATE OF `environment`,`integrity_state` ON `roster_assignments`
WHEN (NEW.`environment` IS NOT OLD.`environment` OR NEW.`integrity_state` IS NOT OLD.`integrity_state`)
	AND EXISTS (SELECT 1 FROM `assignment_activation_snapshots` snap
		WHERE snap.`roster_assignment_id` = OLD.`id` AND snap.`final` = 1)
BEGIN
	SELECT RAISE(ABORT, 'activated_assignment_source_immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `activated_shift_source_immutable_v4`
BEFORE UPDATE OF `environment`,`integrity_state` ON `shifts`
WHEN (NEW.`environment` IS NOT OLD.`environment` OR NEW.`integrity_state` IS NOT OLD.`integrity_state`)
	AND EXISTS (SELECT 1 FROM `assignment_activation_snapshots` snap
		WHERE snap.`shift_id` = OLD.`id` AND snap.`final` = 1)
BEGIN
	SELECT RAISE(ABORT, 'activated_shift_source_immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `activated_assignment_lifecycle_v4`
BEFORE UPDATE OF `status`,`active_key`,`confirmed_at`,`released_at` ON `roster_assignments`
WHEN EXISTS (SELECT 1 FROM `assignment_activation_snapshots` snap
	WHERE snap.`roster_assignment_id` = OLD.`id` AND snap.`final` = 1)
	AND (NEW.`status` IS NOT OLD.`status` OR NEW.`active_key` IS NOT OLD.`active_key`
		OR NEW.`confirmed_at` IS NOT OLD.`confirmed_at` OR NEW.`released_at` IS NOT OLD.`released_at`)
BEGIN
	SELECT CASE WHEN NOT (
		(OLD.`status` = 'reserved' AND NEW.`status` = 'confirmed'
			AND OLD.`active_key` IS NULL AND NEW.`active_key` = NEW.`roster_slot_id`
			AND OLD.`confirmed_at` IS NULL AND NEW.`confirmed_at` IS NOT NULL
			AND NEW.`released_at` IS NULL
			AND EXISTS (SELECT 1 FROM `assignment_activation_commands` c
				WHERE c.`roster_assignment_id` = OLD.`id` AND c.`state` = 'reserved'))
		OR (OLD.`status` = 'confirmed' AND NEW.`status` IN ('cancelled','replaced','released')
			AND OLD.`active_key` = OLD.`roster_slot_id` AND NEW.`active_key` IS NULL
			AND NEW.`confirmed_at` IS OLD.`confirmed_at` AND NEW.`released_at` IS NOT NULL
			AND EXISTS (
				SELECT 1 FROM `assignment_activation_snapshots` snap
				JOIN `assignment_activation_commands` c ON c.`id` = snap.`command_id`
				JOIN `shifts` sh ON sh.`id` = snap.`shift_id`
				WHERE snap.`roster_assignment_id` = OLD.`id` AND c.`state` = 'activated'
					AND sh.`status` = 'confirmed' AND sh.`check_in_at` IS NULL AND sh.`check_out_at` IS NULL))
	) THEN RAISE(ABORT, 'activated_assignment_lifecycle_invalid') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activated_shift_lifecycle_v4`
BEFORE UPDATE OF `status`,`check_in_at`,`check_out_at`,`client_signoff_status`,`signed_off_at` ON `shifts`
WHEN (NEW.`status` IS NOT OLD.`status` OR NEW.`check_in_at` IS NOT OLD.`check_in_at`
		OR NEW.`check_out_at` IS NOT OLD.`check_out_at`
		OR NEW.`client_signoff_status` IS NOT OLD.`client_signoff_status`
		OR NEW.`signed_off_at` IS NOT OLD.`signed_off_at`)
	AND EXISTS (SELECT 1 FROM `assignment_activation_snapshots` snap
		WHERE snap.`shift_id` = OLD.`id` AND snap.`final` = 1)
BEGIN
	SELECT CASE WHEN NOT (
		(OLD.`status` = 'reserved' AND NEW.`status` = 'confirmed'
			AND OLD.`check_in_at` IS NEW.`check_in_at` AND NEW.`check_in_at` IS NULL
			AND OLD.`check_out_at` IS NEW.`check_out_at` AND NEW.`check_out_at` IS NULL
			AND OLD.`client_signoff_status` IS NEW.`client_signoff_status`
			AND OLD.`signed_off_at` IS NEW.`signed_off_at` AND NEW.`signed_off_at` IS NULL
			AND EXISTS (SELECT 1 FROM `assignment_activation_snapshots` snap
				JOIN `assignment_activation_commands` c ON c.`id` = snap.`command_id`
				WHERE snap.`shift_id` = OLD.`id` AND c.`state` = 'reserved'))
		OR (OLD.`status` = 'confirmed' AND NEW.`status` = 'on_post'
			AND OLD.`check_in_at` IS NULL AND NEW.`check_in_at` IS NOT NULL
			AND OLD.`check_out_at` IS NEW.`check_out_at` AND NEW.`check_out_at` IS NULL
			AND OLD.`client_signoff_status` IS NEW.`client_signoff_status`
			AND OLD.`signed_off_at` IS NEW.`signed_off_at` AND NEW.`signed_off_at` IS NULL)
		OR (OLD.`status` = 'confirmed' AND NEW.`status` = 'cancelled'
			AND OLD.`check_in_at` IS NEW.`check_in_at` AND NEW.`check_in_at` IS NULL
			AND OLD.`check_out_at` IS NEW.`check_out_at` AND NEW.`check_out_at` IS NULL
			AND OLD.`client_signoff_status` IS NEW.`client_signoff_status`
			AND OLD.`signed_off_at` IS NEW.`signed_off_at`
			AND EXISTS (SELECT 1 FROM `assignment_activation_snapshots` snap
				JOIN `roster_assignments` ra ON ra.`id` = snap.`roster_assignment_id`
				WHERE snap.`shift_id` = OLD.`id` AND ra.`status` IN ('cancelled','replaced','released')
					AND ra.`active_key` IS NULL AND ra.`released_at` IS NOT NULL))
		OR (OLD.`status` = 'on_post' AND NEW.`status` = 'completed'
			AND OLD.`check_in_at` IS NOT NULL AND NEW.`check_in_at` IS OLD.`check_in_at`
			AND OLD.`check_out_at` IS NULL AND NEW.`check_out_at` IS NOT NULL
			AND NEW.`client_signoff_status` = 'pending' AND NEW.`signed_off_at` IS NULL)
		OR (OLD.`status` = 'completed' AND NEW.`status` = 'verified'
			AND OLD.`check_in_at` IS NOT NULL AND OLD.`check_out_at` IS NOT NULL
			AND NEW.`check_in_at` IS OLD.`check_in_at` AND NEW.`check_out_at` IS OLD.`check_out_at`
			AND NEW.`client_signoff_status` = 'approved' AND NEW.`signed_off_at` IS NOT NULL)
	) THEN RAISE(ABORT, 'activated_shift_lifecycle_invalid') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activated_shift_timestamp_lifecycle_v5`
BEFORE UPDATE OF `check_in_at`,`check_out_at` ON `shifts`
WHEN (NEW.`check_in_at` IS NOT OLD.`check_in_at` OR NEW.`check_out_at` IS NOT OLD.`check_out_at`)
	AND EXISTS (SELECT 1 FROM `assignment_activation_snapshots` snap
		WHERE snap.`shift_id` = OLD.`id` AND snap.`final` = 1)
BEGIN
	SELECT CASE WHEN NOT (
		(OLD.`status` = 'confirmed' AND NEW.`status` = 'on_post'
			AND OLD.`check_in_at` IS NULL AND NEW.`check_in_at` IS NOT NULL
			AND OLD.`check_out_at` IS NEW.`check_out_at`)
		OR (OLD.`status` = 'on_post' AND NEW.`status` = 'completed'
			AND OLD.`check_in_at` IS NEW.`check_in_at`
			AND OLD.`check_out_at` IS NULL AND NEW.`check_out_at` IS NOT NULL)
	) THEN RAISE(ABORT, 'activated_shift_timestamp_lifecycle_invalid') END;
END;
--> statement-breakpoint
CREATE TRIGGER `check_in_revalidation_final_state_v5`
BEFORE UPDATE OF `status` ON `assignment_revalidations`
WHEN OLD.`checkpoint` = 'check_in' AND OLD.`status` = 'transitioning' AND NEW.`status` = 'passed'
BEGIN
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1 FROM `assignment_activation_snapshots` snap
		JOIN `shifts` sh ON sh.`id` = snap.`shift_id`
		WHERE snap.`id` = OLD.`snapshot_id` AND sh.`status` = 'on_post'
			AND sh.`check_in_at` IS NOT NULL
			AND julianday(sh.`check_in_at`) = julianday(OLD.`evaluated_at`)
	) THEN RAISE(ABORT, 'check_in_revalidation_final_state_invalid') END;
END;
--> statement-breakpoint
CREATE TRIGGER `hour_reservation_release_source_v4`
BEFORE UPDATE OF `status` ON `workforce_hour_reservations`
WHEN OLD.`status` = 'active' AND NEW.`status` = 'released'
BEGIN
	SELECT CASE WHEN NOT (
		(OLD.`source_type` = 'assignment'
			AND NEW.`release_reason` IN ('assignment_cancelled','assignment_replaced','assignment_released')
			AND EXISTS (SELECT 1 FROM `roster_assignments` ra
				WHERE ra.`id` = OLD.`source_id` AND ra.`id` = OLD.`roster_assignment_id`
					AND ra.`status` IN ('cancelled','replaced','released')
					AND NEW.`release_reason` = 'assignment_' || ra.`status`))
		OR (OLD.`source_type` = 'relief'
			AND NEW.`release_reason` IN ('relief_cancelled','relief_replaced')
			AND EXISTS (SELECT 1 FROM `relief_dispatches` rd
				WHERE rd.`id` = OLD.`source_id` AND rd.`id` = OLD.`relief_dispatch_id`
					AND rd.`status` IN ('cancelled','replaced')
					AND NEW.`release_reason` = 'relief_' || rd.`status`))
	) THEN RAISE(ABORT, 'hour_reservation_release_source_invalid') END;
END;
--> statement-breakpoint
CREATE TRIGGER `hour_reservation_total_week_cap_v4`
BEFORE INSERT ON `workforce_hour_reservations`
WHEN NEW.`status` = 'active'
BEGIN
	SELECT CASE WHEN EXISTS (
		SELECT 1 FROM `roster_assignments` ra JOIN `roster_slots` rs ON rs.`id` = ra.`roster_slot_id`
		JOIN `workforce_engagements` nwe ON nwe.`id` = NEW.`workforce_engagement_id`
		WHERE ra.`officer_id` = NEW.`officer_id` AND ra.`environment` = nwe.`environment`
			AND ra.`integrity_state` = CASE nwe.`environment` WHEN 'production' THEN 'production_verified' ELSE 'synthetic' END
			AND ra.`status` NOT IN ('cancelled','replaced','released')
			AND NOT (NEW.`source_type` = 'assignment' AND ra.`id` = NEW.`source_id`)
			AND (julianday(rs.`starts_at`) IS NULL OR julianday(rs.`ends_at`) IS NULL
				OR julianday(rs.`ends_at`) <= julianday(rs.`starts_at`)
				OR strftime('%S',rs.`starts_at`) <> '00' OR strftime('%S',rs.`ends_at`) <> '00')
		UNION ALL
		SELECT 1 FROM `relief_dispatches` rd JOIN `roster_slots` rs ON rs.`id` = rd.`roster_slot_id`
		JOIN `workforce_engagements` nwe ON nwe.`id` = NEW.`workforce_engagement_id`
		WHERE rd.`replacement_officer_id` = NEW.`officer_id` AND rd.`environment` = nwe.`environment`
			AND rd.`integrity_state` = CASE nwe.`environment` WHEN 'production' THEN 'production_verified' ELSE 'synthetic' END
			AND rd.`status` NOT IN ('cancelled','replaced')
			AND NOT (NEW.`source_type` = 'relief' AND rd.`id` = NEW.`source_id`)
			AND (julianday(rs.`starts_at`) IS NULL OR julianday(rs.`ends_at`) IS NULL
				OR julianday(rs.`ends_at`) <= julianday(rs.`starts_at`)
				OR strftime('%S',rs.`starts_at`) <> '00' OR strftime('%S',rs.`ends_at`) <> '00')
		UNION ALL
		SELECT 1 FROM `officer_work_commitments` owc
		JOIN `workforce_engagements` nwe ON nwe.`id` = NEW.`workforce_engagement_id`
		WHERE owc.`officer_id` = NEW.`officer_id` AND owc.`environment` = nwe.`environment`
			AND owc.`integrity_state` = CASE nwe.`environment` WHEN 'production' THEN 'verified' ELSE 'synthetic' END
			AND owc.`status` <> 'cancelled'
			AND (julianday(owc.`starts_at`) IS NULL OR julianday(owc.`ends_at`) IS NULL
				OR julianday(owc.`ends_at`) <= julianday(owc.`starts_at`)
				OR strftime('%S',owc.`starts_at`) <> '00' OR strftime('%S',owc.`ends_at`) <> '00')
	) THEN RAISE(ABORT, 'existing_work_interval_invalid') END;
	SELECT CASE WHEN NEW.`reserved_minutes` + COALESCE((
		SELECT SUM(`work_minutes`) FROM (
			SELECT r.`reserved_minutes` AS `work_minutes`
			FROM `workforce_hour_reservations` r
			JOIN `workforce_engagements` rwe ON rwe.`id` = r.`workforce_engagement_id`
			JOIN `workforce_engagements` nwe ON nwe.`id` = NEW.`workforce_engagement_id`
			WHERE r.`officer_id` = NEW.`officer_id` AND r.`iso_week_start` = NEW.`iso_week_start`
				AND r.`status` = 'active' AND rwe.`environment` = nwe.`environment`
				AND NOT (r.`source_type` = NEW.`source_type` AND r.`source_id` = NEW.`source_id`)
			UNION ALL
			SELECT CAST(ROUND((MIN(julianday(rs.`ends_at`),julianday(date(NEW.`iso_week_start`,'+7 days')||'T00:00:00+02:00'))-
				MAX(julianday(rs.`starts_at`),julianday(NEW.`iso_week_start`||'T00:00:00+02:00')))*1440) AS INTEGER)
			FROM `roster_assignments` ra JOIN `roster_slots` rs ON rs.`id` = ra.`roster_slot_id`
			JOIN `workforce_engagements` nwe ON nwe.`id` = NEW.`workforce_engagement_id`
			WHERE ra.`officer_id` = NEW.`officer_id` AND ra.`environment` = nwe.`environment`
				AND ra.`integrity_state` = CASE nwe.`environment` WHEN 'production' THEN 'production_verified' ELSE 'synthetic' END
				AND ra.`status` NOT IN ('cancelled','replaced','released')
				AND NOT (NEW.`source_type` = 'assignment' AND ra.`id` = NEW.`source_id`)
				AND julianday(rs.`starts_at`) < julianday(date(NEW.`iso_week_start`,'+7 days')||'T00:00:00+02:00')
				AND julianday(rs.`ends_at`) > julianday(NEW.`iso_week_start`||'T00:00:00+02:00')
				AND NOT EXISTS (SELECT 1 FROM `workforce_hour_reservations` covered
					WHERE covered.`officer_id` = NEW.`officer_id` AND covered.`status` = 'active'
						AND covered.`source_type` = 'assignment' AND covered.`source_id` = ra.`id`
						AND covered.`iso_week_start` = NEW.`iso_week_start`)
			UNION ALL
			SELECT CAST(ROUND((MIN(julianday(rs.`ends_at`),julianday(date(NEW.`iso_week_start`,'+7 days')||'T00:00:00+02:00'))-
				MAX(julianday(rs.`starts_at`),julianday(NEW.`iso_week_start`||'T00:00:00+02:00')))*1440) AS INTEGER)
			FROM `relief_dispatches` rd JOIN `roster_slots` rs ON rs.`id` = rd.`roster_slot_id`
			JOIN `workforce_engagements` nwe ON nwe.`id` = NEW.`workforce_engagement_id`
			WHERE rd.`replacement_officer_id` = NEW.`officer_id` AND rd.`environment` = nwe.`environment`
				AND rd.`integrity_state` = CASE nwe.`environment` WHEN 'production' THEN 'production_verified' ELSE 'synthetic' END
				AND rd.`status` NOT IN ('cancelled','replaced')
				AND NOT (NEW.`source_type` = 'relief' AND rd.`id` = NEW.`source_id`)
				AND julianday(rs.`starts_at`) < julianday(date(NEW.`iso_week_start`,'+7 days')||'T00:00:00+02:00')
				AND julianday(rs.`ends_at`) > julianday(NEW.`iso_week_start`||'T00:00:00+02:00')
				AND NOT EXISTS (SELECT 1 FROM `workforce_hour_reservations` covered
					WHERE covered.`officer_id` = NEW.`officer_id` AND covered.`status` = 'active'
						AND covered.`source_type` = 'relief' AND covered.`source_id` = rd.`id`
						AND covered.`iso_week_start` = NEW.`iso_week_start`)
			UNION ALL
			SELECT CAST(ROUND((MIN(julianday(owc.`ends_at`),julianday(date(NEW.`iso_week_start`,'+7 days')||'T00:00:00+02:00'))-
				MAX(julianday(owc.`starts_at`),julianday(NEW.`iso_week_start`||'T00:00:00+02:00')))*1440) AS INTEGER)
			FROM `officer_work_commitments` owc
			JOIN `workforce_engagements` nwe ON nwe.`id` = NEW.`workforce_engagement_id`
			WHERE owc.`officer_id` = NEW.`officer_id` AND owc.`environment` = nwe.`environment`
				AND owc.`integrity_state` = CASE nwe.`environment` WHEN 'production' THEN 'verified' ELSE 'synthetic' END
				AND owc.`status` <> 'cancelled'
				AND julianday(owc.`starts_at`) < julianday(date(NEW.`iso_week_start`,'+7 days')||'T00:00:00+02:00')
				AND julianday(owc.`ends_at`) > julianday(NEW.`iso_week_start`||'T00:00:00+02:00')
		) `weekly_work`
	),0) > NEW.`weekly_cap_minutes`
	THEN RAISE(ABORT,'direct_flex_weekly_cap_exceeded') END;
END;
