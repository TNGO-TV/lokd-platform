-- Add after Central canonical history. Preserve every activation condition.
-- Fractional evidence timestamps must use SQLite fractional now, not truncated seconds.
DROP TRIGGER `activation_command_final_hardening_v2`;
CREATE TRIGGER `activation_command_final_hardening_v2`
BEFORE UPDATE OF `state` ON `assignment_activation_commands`
WHEN NEW.`state` = 'activated'
BEGIN
	SELECT (CASE WHEN EXISTS (
		SELECT 1 FROM `launch_controls` lc
		JOIN `roster_slots` rs ON rs.`id` = NEW.`roster_slot_id`
		WHERE lc.`code` IN ('G0_PHASE1_SCOPE','G1_PSIRA_PAPERWORK','G2_CONTROL_ROOM_INSPECTION','G3_PSIRA_CERTIFICATE','G4_WORKFORCE_ENGINE','G5_WORKFORCE_TERMS','G6_IDENTITY_PROVIDER','G7_CLIENT_FUNDS','G8_PAYROLL_INSURANCE','G9_PRODUCTION_CONTROLS')
			AND (lc.`verified_at` IS NULL OR julianday(lc.`verified_at`) > julianday('now')
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
			AND julianday(fr.`cleared_at`) <= julianday('now')
			AND julianday(fr.`reconciled_at`) <= julianday('now')
			AND julianday(fr.`evidence_verified_at`) <= julianday('now')
			AND fr.`evidence_expires_at` IS NOT NULL AND julianday(fr.`evidence_expires_at`) >= julianday(rs.`ends_at`)
			AND sra.`site_id` = snap.`site_id` AND sra.`active_key` = snap.`site_id`
			AND sra.`status` = 'approved' AND sra.`environment` = 'production' AND sra.`integrity_state` = 'verified'
			AND length(trim(sra.`evidence_reference`)) > 0
			AND julianday(sra.`approved_at`) <= julianday('now')
			AND julianday(sra.`valid_from`) <= julianday(rs.`starts_at`)
			AND sra.`expires_at` IS NOT NULL AND julianday(sra.`expires_at`) >= julianday(rs.`ends_at`)
			AND poa.`post_id` = snap.`post_id` AND poa.`active_key` = snap.`post_id`
			AND poa.`status` = 'approved' AND poa.`environment` = 'production' AND poa.`integrity_state` = 'verified'
			AND poa.`post_orders_version` = (SELECT sp.`post_orders_version` FROM `site_posts` sp WHERE sp.`id` = snap.`post_id`)
			AND length(trim(poa.`evidence_reference`)) > 0
			AND julianday(poa.`approved_at`) <= julianday('now')
			AND julianday(poa.`valid_from`) <= julianday(rs.`starts_at`)
			AND poa.`expires_at` IS NOT NULL AND julianday(poa.`expires_at`) >= julianday(rs.`ends_at`)
			AND osi.`officer_id` = snap.`officer_id` AND osi.`site_id` = snap.`site_id`
			AND osi.`active_key` = snap.`officer_id` || ':' || snap.`site_id`
			AND osi.`status` = 'completed' AND osi.`environment` = 'production' AND osi.`integrity_state` = 'verified'
			AND length(trim(osi.`evidence_reference`)) > 0
			AND julianday(osi.`completed_at`) <= julianday('now')
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
			AND julianday(op.`last_reviewed_at`) <= julianday('now')
			AND op.`next_review_at` IS NOT NULL AND julianday(op.`next_review_at`) >= julianday(rs.`ends_at`)
			AND svc.`qualified` = 1 AND svc.`opted_in` = 1
			AND date(svc.`qualification_expiry`) >= date(rs.`ends_at`, '+2 hours')
			AND EXISTS (SELECT 1 FROM `compliance_records` cr
				WHERE cr.`officer_id` = o.`id` AND cr.`record_type` = 'identity' AND cr.`status` = 'current'
					AND cr.`environment` = 'production' AND cr.`integrity_state` = 'verified'
					AND length(trim(cr.`evidence_reference`)) > 0
					AND julianday(cr.`verified_at`) <= julianday('now')
					AND cr.`expires_at` IS NOT NULL AND julianday(cr.`expires_at`) >= julianday(rs.`ends_at`))
			AND EXISTS (SELECT 1 FROM `compliance_records` cr
				WHERE cr.`officer_id` = o.`id` AND cr.`record_type` = 'psira' AND cr.`status` = 'current'
					AND cr.`environment` = 'production' AND cr.`integrity_state` = 'verified'
					AND length(trim(cr.`evidence_reference`)) > 0
					AND julianday(cr.`verified_at`) <= julianday('now')
					AND cr.`expires_at` IS NOT NULL AND julianday(cr.`expires_at`) >= julianday(rs.`ends_at`))
			AND EXISTS (SELECT 1 FROM `officer_endorsements` oe
				WHERE oe.`officer_id` = o.`id` AND oe.`code` = 'core_ready' AND oe.`status` = 'current'
					AND oe.`environment` = 'production' AND oe.`integrity_state` = 'verified'
					AND length(trim(oe.`evidence_reference`)) > 0
					AND julianday(oe.`assessed_at`) <= julianday('now')
					AND date(oe.`expires_at`) >= date(rs.`ends_at`, '+2 hours'))
			AND EXISTS (SELECT 1 FROM `officer_endorsements` oe
				WHERE oe.`officer_id` = o.`id` AND oe.`category` = 'service' AND oe.`service_type` = sp.`service_type`
					AND oe.`status` = 'current' AND oe.`environment` = 'production' AND oe.`integrity_state` = 'verified'
					AND length(trim(oe.`evidence_reference`)) > 0
					AND julianday(oe.`assessed_at`) <= julianday('now')
					AND date(oe.`expires_at`) >= date(rs.`ends_at`, '+2 hours'))
			AND EXISTS (SELECT 1 FROM `officer_endorsements` oe
				WHERE oe.`officer_id` = o.`id` AND oe.`category` = 'purpose' AND oe.`purpose_code` = sp.`purpose_code`
					AND oe.`status` = 'current' AND oe.`environment` = 'production' AND oe.`integrity_state` = 'verified'
					AND length(trim(oe.`evidence_reference`)) > 0
					AND julianday(oe.`assessed_at`) <= julianday('now')
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
			AND julianday(wta.`accepted_at`) <= julianday('now')
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
			AND julianday(ece.`verified_at`) <= julianday('now')
			AND ece.`expires_at` IS NOT NULL AND julianday(ece.`expires_at`) >= julianday(rs.`ends_at`)
	) <> 7 THEN RAISE(ABORT, 'production_employer_evidence_invalid') END);

	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `assignment_activation_snapshots` snap
		JOIN `roster_slots` rs ON rs.`id` = NEW.`roster_slot_id`
		JOIN `officer_availability_windows` av ON av.`officer_id` = snap.`officer_id`
		JOIN `officer_travel_assessments` ota ON ota.`officer_id` = snap.`officer_id` AND ota.`site_id` = snap.`site_id`
		WHERE snap.`command_id` = NEW.`id`
			AND av.`status` = 'available' AND av.`environment` = 'production' AND av.`integrity_state` = 'verified'
			AND length(trim(av.`evidence_reference`)) > 0 AND julianday(av.`rest_confirmed_at`) <= julianday('now')
			AND julianday(av.`starts_at`) <= julianday(rs.`starts_at`) AND julianday(av.`ends_at`) >= julianday(rs.`ends_at`)
			AND ota.`status` = 'feasible' AND ota.`active_key` = snap.`officer_id` || ':' || snap.`site_id`
			AND ota.`environment` = 'production' AND ota.`integrity_state` = 'verified'
			AND length(trim(ota.`evidence_reference`)) > 0 AND julianday(ota.`assessed_at`) <= julianday('now')
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
