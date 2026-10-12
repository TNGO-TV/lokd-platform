-- Owner decides when LOKD is live. The launch gate register (launch_controls) no longer blocks any
-- database action: activation, specialist bookings and officer-conversion fees are decided by the
-- owner and Operations through the existing approval records, not by gate rows.
--
-- What stays: every evidence check on the booking itself (approved client, funded booking, risk
-- assessment, post orders, induction, officer PSiRA and passport currency, workforce route, rest
-- windows, frozen economics, maker/checker decisions). Only the launch_controls clauses are removed.
--
-- Trigger bodies below are the 0007 and 0066 versions with the launch_controls checks deleted.

DROP TRIGGER IF EXISTS `activation_all_hard_gates_v3`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `activation_command_final_guard`;
--> statement-breakpoint
CREATE TRIGGER `activation_command_final_guard`
BEFORE UPDATE OF `state` ON `assignment_activation_commands`
WHEN NEW.`state` = 'activated'
BEGIN
	SELECT (CASE WHEN OLD.`state` <> 'reserved'
		OR NEW.`environment` <> 'production'
		OR NEW.`integrity_state` <> 'production_verified'
		THEN RAISE(ABORT, 'production_activation_required') END);
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `assignment_activation_snapshots` snap
		JOIN `booking_funding_reconciliations` fr ON fr.`id` = snap.`funding_reconciliation_id`
		JOIN `bookings` b ON b.`id` = snap.`booking_id`
		WHERE snap.`command_id` = NEW.`id`
			AND snap.`final` = 1
			AND fr.`status` = 'cleared_reconciled'
			AND fr.`environment` = 'production'
			AND fr.`provider` <> 'demo_manual'
			AND fr.`currency` = 'ZAR'
			AND fr.`cleared_amount_cents` >= b.`client_price_cents`
			AND fr.`evidence_reference` IS NOT NULL
			AND fr.`evidence_verified_at` IS NOT NULL
			AND (fr.`evidence_expires_at` IS NULL OR julianday(fr.`evidence_expires_at`) >= julianday(snap.`evidence_valid_through`))
	) THEN RAISE(ABORT, 'cleared_reconciled_funding_required') END);
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `assignment_activation_snapshots` snap
		JOIN `clients` c ON c.`id` = snap.`client_id`
		JOIN `operational_sites` os ON os.`id` = snap.`site_id`
		JOIN `site_posts` sp ON sp.`id` = snap.`post_id`
		JOIN `site_risk_assessments` sra ON sra.`id` = snap.`risk_assessment_id`
		JOIN `post_order_approvals` poa ON poa.`id` = snap.`post_order_approval_id`
		JOIN `officer_site_inductions` osi ON osi.`id` = snap.`induction_id`
		WHERE snap.`command_id` = NEW.`id`
			AND c.`approval_status` = 'approved'
			AND os.`status` = 'active' AND os.`version` = snap.`site_version`
			AND sp.`status` = 'active'
			AND sra.`status` = 'approved' AND sra.`evidence_reference` IS NOT NULL
			AND sra.`active_key` = os.`id`
			AND (sra.`expires_at` IS NULL OR julianday(sra.`expires_at`) >= julianday(snap.`evidence_valid_through`))
			AND poa.`status` = 'approved' AND poa.`evidence_reference` IS NOT NULL
			AND poa.`active_key` = sp.`id` AND poa.`post_orders_version` = sp.`post_orders_version`
			AND (poa.`expires_at` IS NULL OR julianday(poa.`expires_at`) >= julianday(snap.`evidence_valid_through`))
			AND osi.`status` = 'completed' AND osi.`evidence_reference` IS NOT NULL
			AND osi.`active_key` = snap.`officer_id` || ':' || snap.`site_id`
			AND (osi.`expires_at` IS NULL OR julianday(osi.`expires_at`) >= julianday(snap.`evidence_valid_through`))
	) THEN RAISE(ABORT, 'site_post_risk_induction_invalid') END);
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `assignment_activation_snapshots` snap
		JOIN `officers` o ON o.`id` = snap.`officer_id`
		JOIN `officer_passports` op ON op.`officer_id` = o.`id`
		JOIN `site_posts` sp ON sp.`id` = snap.`post_id`
		JOIN `officer_services` svc ON svc.`officer_id` = o.`id` AND svc.`service_type` = sp.`service_type`
		WHERE snap.`command_id` = NEW.`id`
			AND o.`approval_status` = 'approved'
			AND julianday(o.`psira_expiry` || 'T23:59:59Z') >= julianday(snap.`evidence_valid_through`)
			AND op.`status` IN ('active','expiring')
			AND op.`next_review_at` IS NOT NULL AND julianday(op.`next_review_at`) >= julianday(snap.`evidence_valid_through`)
			AND svc.`qualified` = 1 AND svc.`opted_in` = 1
			AND svc.`qualification_expiry` IS NOT NULL
			AND julianday(svc.`qualification_expiry` || 'T23:59:59Z') >= julianday(snap.`evidence_valid_through`)
			AND EXISTS (SELECT 1 FROM `compliance_records` cr WHERE cr.`officer_id` = o.`id` AND cr.`record_type` = 'identity' AND cr.`status` = 'current' AND cr.`verified_at` IS NOT NULL AND (cr.`expires_at` IS NULL OR julianday(cr.`expires_at`) >= julianday(snap.`evidence_valid_through`)))
			AND EXISTS (SELECT 1 FROM `compliance_records` cr WHERE cr.`officer_id` = o.`id` AND cr.`record_type` = 'psira' AND cr.`status` = 'current' AND cr.`verified_at` IS NOT NULL AND cr.`expires_at` IS NOT NULL AND julianday(cr.`expires_at`) >= julianday(snap.`evidence_valid_through`))
			AND EXISTS (SELECT 1 FROM `officer_endorsements` oe WHERE oe.`officer_id` = o.`id` AND oe.`code` = 'core_ready' AND oe.`status` = 'current' AND oe.`expires_at` IS NOT NULL AND julianday(oe.`expires_at` || 'T23:59:59Z') >= julianday(snap.`evidence_valid_through`))
			AND EXISTS (SELECT 1 FROM `officer_endorsements` oe WHERE oe.`officer_id` = o.`id` AND oe.`category` = 'purpose' AND oe.`purpose_code` = sp.`purpose_code` AND oe.`status` = 'current' AND oe.`expires_at` IS NOT NULL AND julianday(oe.`expires_at` || 'T23:59:59Z') >= julianday(snap.`evidence_valid_through`))
	) THEN RAISE(ABORT, 'officer_readiness_invalid') END);
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `assignment_activation_snapshots` snap
		JOIN `workforce_engagements` we ON we.`id` = snap.`workforce_engagement_id`
		JOIN `workforce_employers` emp ON emp.`id` = snap.`employer_id`
		JOIN `workforce_terms_acceptances` wta ON wta.`id` = snap.`terms_acceptance_id`
		WHERE snap.`command_id` = NEW.`id`
			AND we.`officer_id` = snap.`officer_id`
			AND we.`status` = 'active' AND we.`active_key` = we.`officer_id`
			AND we.`model` = snap.`workforce_model`
			AND we.`terms_version` = snap.`terms_version`
			AND (we.`review_due_at` IS NULL OR julianday(we.`review_due_at`) >= julianday(snap.`evidence_valid_through`))
			AND emp.`status` = 'current' AND emp.`version` = snap.`employer_version`
			AND emp.`environment` = 'production'
			AND (emp.`review_due_at` IS NULL OR julianday(emp.`review_due_at`) >= julianday(snap.`evidence_valid_through`))
			AND wta.`workforce_engagement_id` = we.`id` AND wta.`officer_id` = snap.`officer_id`
			AND wta.`terms_version` = we.`terms_version` AND wta.`active_key` = we.`id`
			AND (wta.`expires_at` IS NULL OR julianday(wta.`expires_at`) >= julianday(snap.`evidence_valid_through`))
			AND ((we.`model` IN ('direct_flex','managed') AND we.`payroll_status` = 'ready' AND we.`benefits_status` = 'ready')
				OR (we.`model` = 'partner' AND we.`payroll_status` = 'partner_confirmed' AND we.`benefits_status` = 'partner_confirmed'))
	) THEN RAISE(ABORT, 'workforce_route_invalid') END);
	SELECT (CASE WHEN (
		SELECT COUNT(DISTINCT ece.`control_code`)
		FROM `assignment_activation_snapshots` snap
		JOIN `employer_compliance_evidence` ece ON ece.`employer_id` = snap.`employer_id`
		WHERE snap.`command_id` = NEW.`id`
			AND ece.`control_code` IN ('psira','nbcpss','psspf','uif','coida','insurance','service_agreement')
			AND ece.`status` = 'current' AND ece.`evidence_reference` IS NOT NULL
			AND ece.`verified_at` IS NOT NULL AND ece.`active_key` = ece.`employer_id` || ':' || ece.`control_code`
			AND (ece.`expires_at` IS NULL OR julianday(ece.`expires_at`) >= julianday(snap.`evidence_valid_through`))
	) <> 7 THEN RAISE(ABORT, 'employer_compliance_evidence_invalid') END);
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `assignment_activation_snapshots` snap
		JOIN `roster_slots` rs ON rs.`id` = NEW.`roster_slot_id`
		JOIN `officer_availability_windows` av ON av.`officer_id` = snap.`officer_id`
		JOIN `officer_travel_assessments` ota ON ota.`officer_id` = snap.`officer_id` AND ota.`site_id` = snap.`site_id`
		WHERE snap.`command_id` = NEW.`id`
			AND av.`status` = 'available' AND av.`starts_at` <= rs.`starts_at` AND av.`ends_at` >= rs.`ends_at`
			AND ota.`status` = 'feasible' AND ota.`active_key` = snap.`officer_id` || ':' || snap.`site_id`
			AND ota.`evidence_reference` IS NOT NULL AND ota.`assessed_at` IS NOT NULL
			AND ota.`valid_until` IS NOT NULL AND julianday(ota.`valid_until`) >= julianday(rs.`ends_at`)
	) THEN RAISE(ABORT, 'availability_or_travel_invalid') END);
	SELECT (CASE WHEN EXISTS (
		SELECT 1 FROM `officer_work_commitments` owc
		JOIN `roster_slots` rs ON rs.`id` = NEW.`roster_slot_id`
		WHERE owc.`officer_id` = NEW.`officer_id` AND owc.`status` <> 'cancelled'
			AND julianday(owc.`starts_at`) < julianday(rs.`ends_at`, '+8 hours')
			AND julianday(owc.`ends_at`) > julianday(rs.`starts_at`, '-8 hours')
	) THEN RAISE(ABORT, 'external_work_rest_conflict') END);
	SELECT (CASE WHEN EXISTS (
		SELECT 1 FROM `assignment_activation_snapshots` snap
		WHERE snap.`command_id` = NEW.`id` AND snap.`workforce_model` = 'direct_flex'
			AND COALESCE((SELECT SUM(whr.`reserved_minutes`) FROM `workforce_hour_reservations` whr
				WHERE whr.`command_id` = NEW.`id` AND whr.`status` = 'active'), 0) <> snap.`reserved_minutes`
	) THEN RAISE(ABORT, 'direct_flex_hour_snapshot_mismatch') END);
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `roster_assignments` ra
		JOIN `roster_slots` rs ON rs.`id` = ra.`roster_slot_id`
		WHERE ra.`id` = NEW.`roster_assignment_id` AND ra.`roster_slot_id` = NEW.`roster_slot_id`
			AND ra.`officer_id` = NEW.`officer_id` AND ra.`active_key` = NEW.`roster_slot_id`
			AND ra.`status` = 'confirmed'
			AND rs.`version` = NEW.`expected_slot_version` + 1 AND rs.`status` = 'scheduled'
	) THEN RAISE(ABORT, 'active_assignment_missing') END);
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `shifts` sh
		WHERE sh.`id` = NEW.`shift_id` AND sh.`officer_id` = NEW.`officer_id` AND sh.`status` = 'confirmed'
	) THEN RAISE(ABORT, 'active_shift_missing') END);
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `assignment_activation_decisions` d
		WHERE d.`command_id` = NEW.`id` AND d.`checkpoint` = 'activation' AND d.`decision` = 'activated'
			AND NOT EXISTS (SELECT 1 FROM `assignment_activation_blockers` b WHERE b.`decision_id` = d.`id`)
	) THEN RAISE(ABORT, 'final_activation_decision_missing') END);
END;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `activation_command_final_hardening_v2`;
--> statement-breakpoint
CREATE TRIGGER `activation_command_final_hardening_v2`
BEFORE UPDATE OF `state` ON `assignment_activation_commands`
WHEN NEW.`state` = 'activated'
BEGIN
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
--> statement-breakpoint
-- Specialist (Armed / VIP) authority is an owner decision, recorded through specialist_commercial_reviews
-- and the booking's pricing_status, not through S1-S4 gate rows.
DROP VIEW IF EXISTS `specialist_booking_control_validation_v33`;
--> statement-breakpoint
CREATE VIEW `specialist_booking_control_validation_v33` AS
SELECT booking.`id`,
  CASE WHEN EXISTS (
    SELECT 1 FROM `operational_sites` site
    JOIN `site_posts` post ON post.`site_id` = site.`id` AND post.`booking_id` = booking.`id`
    JOIN `site_risk_assessments` risk ON risk.`site_id` = site.`id`
    JOIN `post_order_approvals` orders ON orders.`post_id` = post.`id`
    WHERE site.`booking_id` = booking.`id` AND site.`client_id` = booking.`client_id`
      AND site.`status` = 'active' AND post.`status` = 'active'
      AND site.`environment` = booking.`environment` AND site.`integrity_state` = booking.`integrity_state`
      AND post.`environment` = booking.`environment` AND post.`integrity_state` = booking.`integrity_state`
      AND risk.`environment` = booking.`environment` AND (risk.`integrity_state` = booking.`integrity_state` OR (booking.`environment`='production' AND risk.`integrity_state`='verified' AND EXISTS(SELECT 1 FROM production_evidence_reviews review WHERE review.kind='site' AND review.state='approved' AND risk.`id` = 'RISK-' || review.id AND json_extract(review.payload_json,'$.siteId')=site.id AND json_extract(review.payload_json,'$.postId')=post.id)))
      AND orders.`environment` = booking.`environment` AND (orders.`integrity_state` = booking.`integrity_state` OR (booking.`environment`='production' AND orders.`integrity_state`='verified' AND EXISTS(SELECT 1 FROM production_evidence_reviews review WHERE review.kind='site' AND review.state='approved' AND orders.`id` = 'POST-' || review.id AND json_extract(review.payload_json,'$.siteId')=site.id AND json_extract(review.payload_json,'$.postId')=post.id)))
      AND risk.`status` = 'approved' AND risk.`active_key` = site.`id`
      AND risk.`evidence_reference` IS NOT NULL AND length(trim(risk.`evidence_reference`)) >= 8
      AND risk.`approved_at` IS NOT NULL AND julianday(risk.`approved_at`) <= julianday(strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      AND risk.`valid_from` IS NOT NULL
      AND julianday(risk.`valid_from`) <= julianday((SELECT MIN(slot.`starts_at`) FROM `roster_slots` slot WHERE slot.`booking_id` = booking.`id`))
      AND risk.`expires_at` IS NOT NULL
      AND julianday(risk.`expires_at`) >= julianday((SELECT MAX(slot.`ends_at`) FROM `roster_slots` slot WHERE slot.`booking_id` = booking.`id`))
      AND orders.`status` = 'approved' AND orders.`active_key` = post.`id`
      AND orders.`post_orders_version` = post.`post_orders_version`
      AND orders.`evidence_reference` IS NOT NULL AND length(trim(orders.`evidence_reference`)) >= 8
      AND orders.`approved_at` IS NOT NULL AND julianday(orders.`approved_at`) <= julianday(strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      AND orders.`valid_from` IS NOT NULL
      AND julianday(orders.`valid_from`) <= julianday((SELECT MIN(slot.`starts_at`) FROM `roster_slots` slot WHERE slot.`booking_id` = booking.`id`))
      AND orders.`expires_at` IS NOT NULL
      AND julianday(orders.`expires_at`) >= julianday((SELECT MAX(slot.`ends_at`) FROM `roster_slots` slot WHERE slot.`booking_id` = booking.`id`))
      AND EXISTS (SELECT 1 FROM `roster_slots` slot WHERE slot.`booking_id` = booking.`id`)
  ) THEN 1 ELSE 0 END AS `assignment_plan_current`,
  1 AS `specialist_authority_current`,
  CASE WHEN EXISTS (
    SELECT 1 FROM `booking_funding_reconciliations` funding
    WHERE funding.`booking_id` = booking.`id` AND funding.`active_key` = booking.`id`
      AND funding.`environment` = booking.`environment` AND funding.`integrity_state` = booking.`integrity_state`
      AND funding.`currency` = 'ZAR' AND funding.`status` = 'cleared_reconciled'
      AND funding.`expected_amount_cents` = booking.`client_price_cents`
      AND funding.`cleared_amount_cents` = booking.`client_price_cents`
      AND funding.`cleared_at` IS NOT NULL AND funding.`reconciled_at` IS NOT NULL
      AND funding.`evidence_reference` IS NOT NULL AND length(trim(funding.`evidence_reference`)) >= 8
      AND funding.`evidence_verified_at` IS NOT NULL
      AND julianday(funding.`evidence_verified_at`) <= julianday(strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      AND funding.`evidence_expires_at` IS NOT NULL
      AND julianday(funding.`evidence_expires_at`) >= julianday((SELECT MAX(slot.`ends_at`) FROM `roster_slots` slot WHERE slot.`booking_id` = booking.`id`))
  ) THEN 1 ELSE 0 END AS `funding_current`
FROM `bookings` booking
WHERE booking.`pricing_version`  IN ('LOKD-SPECIALIST-2026.09-v1','LOKD-SPECIALIST-2026.09-v2-no-vat');
--> statement-breakpoint
-- Officer conversion (placement) fees: PEA registration is the owner's call, not a gate row.
DROP TRIGGER IF EXISTS `officer_conversion_fee_insert_guard`;
--> statement-breakpoint
CREATE TRIGGER `officer_conversion_fee_insert_guard`
BEFORE INSERT ON `officer_conversion_cases`
FOR EACH ROW
BEGIN
	SELECT (CASE WHEN NEW.`fee_status` NOT IN ('quoted','payable_prefund_required','paid','cancelled')
		THEN RAISE(ABORT, 'unsupported officer conversion fee state') END);
END;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `officer_conversion_fee_update_guard`;
--> statement-breakpoint
CREATE TRIGGER `officer_conversion_fee_update_guard`
BEFORE UPDATE OF `fee_status` ON `officer_conversion_cases`
FOR EACH ROW
BEGIN
	SELECT (CASE WHEN NEW.`fee_status` NOT IN ('quoted','payable_prefund_required','paid','cancelled')
		THEN RAISE(ABORT, 'unsupported officer conversion fee state') END);
	SELECT (CASE WHEN NEW.`fee_status` = 'paid' AND (
		NEW.`offer_accepted_at` IS NULL OR NEW.`clause_status` <> 'acknowledged'
	) THEN RAISE(ABORT, 'accepted offer and client clause required before fee clearance') END);
END;
--> statement-breakpoint
-- The gate register stays as an owner checklist; it decides nothing.
UPDATE `launch_controls` SET `hard_gate` = 0, `updated_at` = CURRENT_TIMESTAMP;
