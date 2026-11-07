-- Retire external-firm work without destroying historical financial evidence.
INSERT INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at) SELECT 'LOKD-ONLY-'+id,'system','system:workforce-policy','workforce_route_retired','workforce_employers',id,'LOKD supplies officers directly. Existing evidence is retained for the audit record.',strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM workforce_employers WHERE environment='production' AND employer_type!='lokd_employer' AND status!='suspended';
--> statement-breakpoint
UPDATE workforce_employers SET status='suspended',version=version+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE environment='production' AND employer_type!='lokd_employer' AND status!='suspended';
--> statement-breakpoint
INSERT INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at) SELECT 'LOKD-ONLY-'+id,'system','system:workforce-policy','workforce_route_retired','workforce_engagements',id,'LOKD supplies officers directly. Existing evidence is retained for the audit record.',strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM workforce_engagements WHERE environment='production' AND model NOT IN ('direct_flex','managed') AND status!='suspended';
--> statement-breakpoint
UPDATE workforce_engagements SET status='suspended',version=version+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),active_key=NULL WHERE environment='production' AND model NOT IN ('direct_flex','managed') AND status!='suspended';
--> statement-breakpoint
CREATE TRIGGER lokd_employer_only_insert BEFORE INSERT ON workforce_employers WHEN NEW.environment='production' AND NEW.employer_type!='lokd_employer' BEGIN SELECT RAISE(ABORT,'lokd_employer_required'); END;
--> statement-breakpoint
CREATE TRIGGER lokd_employer_only_active BEFORE UPDATE ON workforce_employers WHEN NEW.environment='production' AND NEW.status='current' AND NEW.employer_type!='lokd_employer' BEGIN SELECT RAISE(ABORT,'lokd_employer_required'); END;
--> statement-breakpoint
CREATE TRIGGER lokd_workforce_only_insert BEFORE INSERT ON workforce_engagements WHEN NEW.environment='production' AND (NEW.model NOT IN ('direct_flex','managed') OR NOT EXISTS(SELECT 1 FROM workforce_employers e WHERE e.id=NEW.employer_id AND e.employer_type='lokd_employer' AND e.environment='production' AND e.status='current')) BEGIN SELECT RAISE(ABORT,'lokd_employer_required'); END;
--> statement-breakpoint
CREATE TRIGGER lokd_workforce_only_active BEFORE UPDATE ON workforce_engagements WHEN NEW.environment='production' AND NEW.status='active' AND (NEW.model NOT IN ('direct_flex','managed') OR NOT EXISTS(SELECT 1 FROM workforce_employers e WHERE e.id=NEW.employer_id AND e.employer_type='lokd_employer' AND e.environment='production' AND e.status='current')) BEGIN SELECT RAISE(ABORT,'lokd_employer_required'); END;
--> statement-breakpoint
DROP TRIGGER assignment_booking_workforce_route_guard;
--> statement-breakpoint
CREATE TRIGGER assignment_booking_workforce_route_guard
BEFORE INSERT ON assignment_workforce_snapshots
WHEN NEW.environment = 'production'
BEGIN
  SELECT (CASE WHEN NOT EXISTS (
    SELECT 1 FROM roster_assignments assignment
    JOIN roster_slots slot ON slot.id = assignment.roster_slot_id
    JOIN bookings booking ON booking.id = slot.booking_id
    WHERE assignment.id = NEW.roster_assignment_id
      AND ((booking.engagement_model = 'bolt' AND NEW.workforce_model = 'direct_flex')
        OR (booking.engagement_model IN ('flex','fixed') AND NEW.workforce_model = 'managed'))
  ) THEN RAISE(ABORT, 'booking_workforce_route_mismatch') END);
END;
--> statement-breakpoint
DROP TRIGGER activation_booking_workforce_route_guard;
--> statement-breakpoint
CREATE TRIGGER activation_booking_workforce_route_guard
BEFORE INSERT ON assignment_activation_snapshots
WHEN NEW.environment = 'production'
BEGIN
  SELECT (CASE WHEN NOT EXISTS (
    SELECT 1 FROM bookings booking WHERE booking.id = NEW.booking_id
      AND json_extract(NEW.site_evidence, '$.bookingModel') IS booking.engagement_model
      AND ((booking.engagement_model = 'bolt' AND NEW.workforce_model = 'direct_flex')
        OR (booking.engagement_model IN ('flex','fixed') AND NEW.workforce_model = 'managed'))
  ) THEN RAISE(ABORT, 'booking_workforce_route_mismatch') END);
END;
--> statement-breakpoint
DROP TRIGGER activation_command_final_hardening_v2;
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
				AND we.`payroll_status` = 'ready' AND we.`benefits_status` = 'ready'))
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
				WHEN 'ordinary' THEN 1.0 WHEN 'sunday' THEN CASE b.`engagement_model` WHEN 'bolt' THEN 2.0 WHEN 'flex' THEN 2.0 ELSE 1.5 END
				WHEN 'public_holiday' THEN 2.0 WHEN 'easter' THEN 2.25 WHEN 'christmas' THEN 2.5 END)) AS INTEGER)
			AND snap.`holiday_premium_cents` = snap.`funded_offer_cents` - snap.`ordinary_wage_cents`
			AND snap.`statutory_cost_cents` = CAST(ROUND(snap.`funded_offer_cents` * 0.15) AS INTEGER)
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
CREATE TRIGGER retired_partner_payables_insert BEFORE INSERT ON partner_payables BEGIN SELECT RAISE(ABORT,'external_firm_work_retired'); END;
--> statement-breakpoint
CREATE TRIGGER retired_specialist_partners_insert BEFORE INSERT ON specialist_partners BEGIN SELECT RAISE(ABORT,'external_firm_work_retired'); END;
--> statement-breakpoint
CREATE TRIGGER retired_production_partner_payable_decisions_insert BEFORE INSERT ON production_partner_payable_decisions BEGIN SELECT RAISE(ABORT,'external_firm_work_retired'); END;
--> statement-breakpoint
CREATE TRIGGER retired_production_partner_payable_exports_insert BEFORE INSERT ON production_partner_payable_exports BEGIN SELECT RAISE(ABORT,'external_firm_work_retired'); END;
--> statement-breakpoint
CREATE TRIGGER retired_production_partner_payable_holds_insert BEFORE INSERT ON production_partner_payable_holds BEGIN SELECT RAISE(ABORT,'external_firm_work_retired'); END;
--> statement-breakpoint
CREATE TRIGGER retired_production_partner_payable_reviews_insert BEFORE INSERT ON production_partner_payable_reviews BEGIN SELECT RAISE(ABORT,'external_firm_work_retired'); END;
--> statement-breakpoint
CREATE TRIGGER retired_partner_destination_decisions_insert BEFORE INSERT ON partner_destination_decisions BEGIN SELECT RAISE(ABORT,'external_firm_work_retired'); END;
--> statement-breakpoint
CREATE TRIGGER retired_partner_destination_holds_insert BEFORE INSERT ON partner_destination_holds BEGIN SELECT RAISE(ABORT,'external_firm_work_retired'); END;
--> statement-breakpoint
CREATE TRIGGER retired_partner_destination_reviews_insert BEFORE INSERT ON partner_destination_reviews BEGIN SELECT RAISE(ABORT,'external_firm_work_retired'); END;
--> statement-breakpoint
CREATE TRIGGER retired_partner_payment_commands_insert BEFORE INSERT ON partner_payment_commands BEGIN SELECT RAISE(ABORT,'external_firm_work_retired'); END;
--> statement-breakpoint
CREATE TRIGGER retired_partner_payment_instructions_insert BEFORE INSERT ON partner_payment_instructions BEGIN SELECT RAISE(ABORT,'external_firm_work_retired'); END;
--> statement-breakpoint
CREATE TRIGGER retired_partner_transfer_observations_insert BEFORE INSERT ON partner_transfer_observations BEGIN SELECT RAISE(ABORT,'external_firm_work_retired'); END;
--> statement-breakpoint
CREATE TRIGGER retired_partner_recovery_approvals_insert BEFORE INSERT ON partner_recovery_approvals BEGIN SELECT RAISE(ABORT,'external_firm_work_retired'); END;
--> statement-breakpoint
CREATE TRIGGER retired_partner_recovery_proposals_insert BEFORE INSERT ON partner_recovery_proposals BEGIN SELECT RAISE(ABORT,'external_firm_work_retired'); END;
--> statement-breakpoint
CREATE TRIGGER retired_partner_recovery_replacements_insert BEFORE INSERT ON partner_recovery_replacements BEGIN SELECT RAISE(ABORT,'external_firm_work_retired'); END;
--> statement-breakpoint
CREATE TRIGGER lokd_payment_live_releases_kind BEFORE INSERT ON payment_live_releases WHEN NEW.kind!='employee' BEGIN SELECT RAISE(ABORT,'employee_payment_required'); END;
--> statement-breakpoint
CREATE TRIGGER lokd_payment_live_claims_kind BEFORE INSERT ON payment_live_claims WHEN NEW.kind!='employee' BEGIN SELECT RAISE(ABORT,'employee_payment_required'); END;
--> statement-breakpoint
CREATE TRIGGER lokd_payment_live_reconciliation_reviews_kind BEFORE INSERT ON payment_live_reconciliation_reviews WHEN NEW.kind!='employee' BEGIN SELECT RAISE(ABORT,'employee_payment_required'); END;
--> statement-breakpoint
CREATE TRIGGER lokd_payment_unsent_replacements_kind BEFORE INSERT ON payment_unsent_replacements WHEN NEW.kind!='employee' BEGIN SELECT RAISE(ABORT,'employee_payment_required'); END;
--> statement-breakpoint
CREATE TRIGGER lokd_specialist_pack_insert BEFORE INSERT ON specialist_deployment_packs WHEN NEW.partner_id IS NOT NULL OR coalesce(json_extract(NEW.content,'$.partnerId'),'')!='' BEGIN SELECT RAISE(ABORT,'external_firm_work_retired'); END;
--> statement-breakpoint
CREATE TRIGGER lokd_specialist_pack_update BEFORE UPDATE ON specialist_deployment_packs WHEN NEW.partner_id IS NOT NULL OR coalesce(json_extract(NEW.content,'$.partnerId'),'')!='' BEGIN SELECT RAISE(ABORT,'external_firm_work_retired'); END;
--> statement-breakpoint
DROP VIEW specialist_pack_validation_v34;
--> statement-breakpoint
CREATE VIEW specialist_pack_validation_v34 AS
SELECT p.id,p.booking_id,p.environment,CASE WHEN
 p.environment='production' AND p.environment=b.environment AND p.integrity_state='recorded'
 AND b.specialist_service_code<>'standard_unarmed' AND price.valid=1 AND b.pricing_status='authoritative'
 AND control.assignment_plan_current=1 AND control.specialist_authority_current=1 AND control.funding_current=1
 AND cr.status='approved' AND cr.environment=p.environment AND cr.version=p.commercial_review_version
 AND cr.pricing_version=b.pricing_version AND cr.terms_version='LOKD-SPECIALIST-TERMS-2026.09-v1'
 AND julianday(cr.expires_at)>julianday(CURRENT_TIMESTAMP) AND julianday(cr.expires_at)>=julianday((SELECT MAX(ends_at) FROM roster_slots WHERE booking_id=b.id))
 AND julianday((SELECT MAX(ends_at) FROM roster_slots WHERE booking_id=b.id))>julianday(CURRENT_TIMESTAMP)
 AND p.quote_snapshot=json_array(b.id,b.client_id,b.specialist_service_code,b.specialist_configuration,b.pricing_version,
 b.quote_subtotal_cents,b.vat_cents,b.client_price_cents,b.cost_floor_cents,b.margin_basis_points,b.headcount,
 (SELECT MIN(starts_at) FROM roster_slots WHERE booking_id=b.id),(SELECT MAX(ends_at) FROM roster_slots WHERE booking_id=b.id),'LOKD-SPECIALIST-TERMS-2026.09-v1')
 AND json_type(p.content,'$.officerIds')='array' AND json_array_length(p.content,'$.officerIds')>=b.headcount
 AND json_array_length(p.content,'$.officerIds')=(SELECT COUNT(DISTINCT value) FROM json_each(p.content,'$.officerIds'))
 AND NOT EXISTS(SELECT 1 FROM json_each(p.content,'$.officerIds') o WHERE NOT EXISTS(
 SELECT 1 FROM officers officer JOIN workforce_engagements w ON w.officer_id=officer.id
 WHERE officer.id=o.value AND w.environment=p.environment AND officer.approval_status='approved'
 AND julianday(officer.psira_expiry)>=julianday((SELECT MAX(ends_at) FROM roster_slots WHERE booking_id=b.id))))
 AND length(trim(json_extract(p.content,'$.commandOwner')))>0
 AND length(trim(json_extract(p.content,'$.clientBrief')))>0 AND length(trim(json_extract(p.content,'$.officerBrief')))>0
 AND p.partner_id IS NULL
 AND (json_extract(b.specialist_configuration,'$.vehicleClass')!='standard_suv' OR EXISTS(SELECT 1 FROM json_each(p.content,'$.checks') e WHERE json_extract(e.value,'$.code')='lokd_vehicle_authority' AND length(trim(json_extract(e.value,'$.reference')))>0 AND julianday(json_extract(e.value,'$.validFrom'))<=julianday(CURRENT_TIMESTAMP) AND julianday(json_extract(e.value,'$.expiresAt'))>=julianday((SELECT MAX(ends_at) FROM roster_slots WHERE booking_id=b.id))))
 AND NOT EXISTS(SELECT 1 FROM specialist_required_checks_v34 r WHERE r.pack_id=p.id AND NOT EXISTS(
 SELECT 1 FROM json_each(p.content,'$.checks') e WHERE json_extract(e.value,'$.code')=r.code
 AND json_type(e.value,'$.reference')='text' AND length(trim(json_extract(e.value,'$.reference')))>0
 AND julianday(json_extract(e.value,'$.validFrom'))<=julianday(CURRENT_TIMESTAMP)
 AND julianday(json_extract(e.value,'$.validFrom'))<=julianday((SELECT MIN(starts_at) FROM roster_slots WHERE booking_id=b.id))
 AND julianday(json_extract(e.value,'$.expiresAt'))>=julianday((SELECT MAX(ends_at) FROM roster_slots WHERE booking_id=b.id))
 AND julianday(json_extract(e.value,'$.expiresAt'))>julianday(CURRENT_TIMESTAMP)
 AND (p.environment='demo' OR (lower(json_extract(e.value,'$.reference')) NOT LIKE '%demo:%'
 AND lower(json_extract(e.value,'$.reference')) NOT LIKE '%synthetic%'
 AND lower(json_extract(e.value,'$.reference')) NOT LIKE '%.invalid%'
 AND lower(json_extract(e.value,'$.reference')) NOT LIKE '%.example%'))))
 THEN 1 ELSE 0 END AS valid
FROM specialist_deployment_packs p JOIN bookings b ON b.id=p.booking_id
LEFT JOIN specialist_pricing_validation_v33 price ON price.id=b.id
LEFT JOIN specialist_booking_control_validation_v33 control ON control.id=b.id
LEFT JOIN specialist_commercial_reviews cr ON cr.id=p.commercial_review_id;
--> statement-breakpoint
DROP VIEW specialist_pricing_validation_v33;
--> statement-breakpoint
CREATE VIEW `specialist_pricing_validation_v33` AS
SELECT booking.`id`,
CASE WHEN
  booking.`pricing_version`  IN ('LOKD-SPECIALIST-2026.09-v1','LOKD-SPECIALIST-2026.09-v2-no-vat')
  AND booking.`service_day_count` >= 1
  AND booking.`headcount` >= 1
  AND booking.`shift_count` = booking.`service_day_count` * booking.`headcount`
  AND booking.`officer_total_cents` > 0
  AND booking.`quote_subtotal_cents` > 0
  AND booking.`vat_rate_basis_points` = CASE WHEN booking.`pricing_version` = 'LOKD-SPECIALIST-2026.09-v2-no-vat' THEN 0 ELSE 1500 END
  AND booking.`vat_cents` = CAST((booking.`quote_subtotal_cents` * booking.`vat_rate_basis_points` + 5000) / 10000 AS INTEGER)
  AND booking.`client_price_cents` = booking.`quote_subtotal_cents` + booking.`vat_cents`
  AND booking.`cost_floor_cents` > 0
  AND booking.`margin_cents` = booking.`quote_subtotal_cents` - booking.`cost_floor_cents`
  AND booking.`gross_platform_contribution_cents` = booking.`quote_subtotal_cents` - booking.`officer_total_cents`
  AND booking.`margin_basis_points` = CAST(booking.`margin_cents` * 10000 / booking.`quote_subtotal_cents` AS INTEGER)
  AND booking.`margin_basis_points` >= booking.`minimum_margin_basis_points`
  AND booking.`minimum_margin_basis_points` = CASE booking.`specialist_service_code`
    WHEN 'standard_unarmed' THEN 2500 WHEN 'armed_static' THEN 3000 WHEN 'armed_movement' THEN 3200
    WHEN 'vip_unarmed' THEN 3500 WHEN 'vip_armed' THEN 3700 WHEN 'vip_protective_driver' THEN 3600
    WHEN 'vip_team' THEN 3800 ELSE -1 END
  AND booking.`service_type` = CASE booking.`specialist_service_code`
    WHEN 'standard_unarmed' THEN 'Unarmed'
    WHEN 'armed_static' THEN 'Armed' WHEN 'armed_movement' THEN 'Armed'
    WHEN 'vip_unarmed' THEN 'VIP' WHEN 'vip_armed' THEN 'VIP'
    WHEN 'vip_protective_driver' THEN 'VIP' WHEN 'vip_team' THEN 'VIP' ELSE '' END
  AND json_valid(booking.`specialist_configuration`) = 1
  AND json_type(booking.`specialist_configuration`) = 'object'
  AND json_valid(booking.`pricing_breakdown`) = 1
  AND json_type(booking.`pricing_breakdown`) = 'object'
  AND CASE WHEN json_valid(booking.`specialist_configuration`) = 1 THEN
    json_type(booking.`specialist_configuration`,'$.serviceCode') = 'text'
    AND json_extract(booking.`specialist_configuration`,'$.serviceCode') = booking.`specialist_service_code`
    AND json_type(booking.`specialist_configuration`,'$.teamSize') = 'integer'
    AND json_extract(booking.`specialist_configuration`,'$.teamSize') = booking.`headcount`
    AND json_type(booking.`specialist_configuration`,'$.travelKmPerServiceDay') = 'integer'
    AND json_extract(booking.`specialist_configuration`,'$.travelKmPerServiceDay') BETWEEN 0 AND 1500
    AND json_type(booking.`specialist_configuration`,'$.planningHours') = 'integer'
    AND json_extract(booking.`specialist_configuration`,'$.planningHours') BETWEEN
      CASE booking.`specialist_service_code` WHEN 'standard_unarmed' THEN 0 WHEN 'armed_static' THEN 1
        WHEN 'armed_movement' THEN 2 WHEN 'vip_unarmed' THEN 2 WHEN 'vip_armed' THEN 3
        WHEN 'vip_protective_driver' THEN 2 WHEN 'vip_team' THEN 4 ELSE 999 END AND 80
    AND json_type(booking.`specialist_configuration`,'$.overnightDays') = 'integer'
    AND json_extract(booking.`specialist_configuration`,'$.overnightDays') BETWEEN 0 AND 60
    AND json_type(booking.`specialist_configuration`,'$.vehicleClass') = 'text'
    AND ((booking.`specialist_service_code` IN ('standard_unarmed','armed_static')
          AND json_extract(booking.`specialist_configuration`,'$.vehicleClass') = 'none')
      OR (booking.`specialist_service_code` IN ('armed_movement','vip_protective_driver')
          AND json_extract(booking.`specialist_configuration`,'$.vehicleClass') IN ('client_vehicle','standard_suv'))
      OR (booking.`specialist_service_code` IN ('vip_unarmed','vip_armed','vip_team')
          AND json_extract(booking.`specialist_configuration`,'$.vehicleClass') IN ('none','client_vehicle','standard_suv')))
    AND booking.`headcount` BETWEEN
      CASE booking.`specialist_service_code` WHEN 'vip_team' THEN 2 ELSE 1 END
      AND CASE booking.`specialist_service_code` WHEN 'standard_unarmed' THEN 6 WHEN 'armed_static' THEN 6
        WHEN 'armed_movement' THEN 4 WHEN 'vip_unarmed' THEN 4 WHEN 'vip_armed' THEN 4
        WHEN 'vip_protective_driver' THEN 2 WHEN 'vip_team' THEN 6 ELSE 0 END
    AND booking.`pricing_status` = CASE
      WHEN json_extract(booking.`specialist_configuration`,'$.vehicleClass') = 'armoured_partner'
        THEN 'partner_review_required' ELSE 'authoritative' END
    AND booking.`cost_floor_cents` = booking.`officer_total_cents`
      + CAST((booking.`officer_total_cents` * 1150 + 9999) / 10000 AS INTEGER)
      + booking.`shift_count` * CASE booking.`specialist_service_code`
        WHEN 'standard_unarmed' THEN 12000 WHEN 'armed_static' THEN 55000 WHEN 'armed_movement' THEN 75000
        WHEN 'vip_unarmed' THEN 70000 WHEN 'vip_armed' THEN 120000
        WHEN 'vip_protective_driver' THEN 90000 WHEN 'vip_team' THEN 80000 ELSE -999999999 END
      + booking.`service_day_count` * CASE booking.`specialist_service_code`
        WHEN 'standard_unarmed' THEN 14000 WHEN 'armed_static' THEN 55000 WHEN 'armed_movement' THEN 85000
        WHEN 'vip_unarmed' THEN 120000 WHEN 'vip_armed' THEN 150000
        WHEN 'vip_protective_driver' THEN 130000 WHEN 'vip_team' THEN 180000 ELSE -999999999 END
      + json_extract(booking.`specialist_configuration`,'$.planningHours') * CASE booking.`specialist_service_code`
        WHEN 'standard_unarmed' THEN 0 WHEN 'armed_static' THEN 65000 WHEN 'armed_movement' THEN 75000
        ELSE 95000 END
      + json_extract(booking.`specialist_configuration`,'$.travelKmPerServiceDay') * booking.`service_day_count` * 900
      + booking.`service_day_count` * CASE json_extract(booking.`specialist_configuration`,'$.vehicleClass')
        WHEN 'standard_suv' THEN 220000 ELSE 0 END
      + json_extract(booking.`specialist_configuration`,'$.overnightDays') * booking.`headcount` * 180000
    ELSE 0 END
  AND CASE WHEN json_valid(booking.`pricing_breakdown`) = 1 THEN
    json_type(booking.`pricing_breakdown`,'$.baseClientCents') = 'integer'
    AND json_type(booking.`pricing_breakdown`,'$.calendarPremiumCents') = 'integer'
    AND json_type(booking.`pricing_breakdown`,'$.dispatchPremiumCents') = 'integer'
    AND json_type(booking.`pricing_breakdown`,'$.riskPremiumCents') = 'integer'
    AND json_type(booking.`pricing_breakdown`,'$.marginFloorAdjustmentCents') = 'integer'
    AND json_extract(booking.`pricing_breakdown`,'$.baseClientCents') >= 0
    AND json_extract(booking.`pricing_breakdown`,'$.calendarPremiumCents') >= 0
    AND json_extract(booking.`pricing_breakdown`,'$.dispatchPremiumCents') >= 0
    AND json_extract(booking.`pricing_breakdown`,'$.riskPremiumCents') >= 0
    AND json_extract(booking.`pricing_breakdown`,'$.marginFloorAdjustmentCents') >= 0
    AND json_extract(booking.`pricing_breakdown`,'$.baseClientCents')
      + json_extract(booking.`pricing_breakdown`,'$.calendarPremiumCents')
      + json_extract(booking.`pricing_breakdown`,'$.dispatchPremiumCents')
      + json_extract(booking.`pricing_breakdown`,'$.riskPremiumCents')
      + json_extract(booking.`pricing_breakdown`,'$.marginFloorAdjustmentCents') = booking.`quote_subtotal_cents`
    AND json_extract(booking.`pricing_breakdown`,'$.subtotalCents') = booking.`quote_subtotal_cents`
    AND json_extract(booking.`pricing_breakdown`,'$.vatCents') = booking.`vat_cents`
    AND json_extract(booking.`pricing_breakdown`,'$.payrollBurdenCents')
      + json_extract(booking.`pricing_breakdown`,'$.readinessAndEquipmentCents')
      + json_extract(booking.`pricing_breakdown`,'$.commandAndSupervisionCents')
      + json_extract(booking.`pricing_breakdown`,'$.planningCents')
      + json_extract(booking.`pricing_breakdown`,'$.travelCents')
      + coalesce(json_extract(booking.`pricing_breakdown`,'$.vehicleCents'),json_extract(booking.`pricing_breakdown`,'$.vehicleAndPartnerCents'))
      + json_extract(booking.`pricing_breakdown`,'$.overnightCents')
      + booking.`officer_total_cents` = booking.`cost_floor_cents`
    ELSE 0 END
THEN 1 ELSE 0 END AS `valid`
FROM `bookings` booking
WHERE booking.`pricing_version`  IN ('LOKD-SPECIALIST-2026.09-v1','LOKD-SPECIALIST-2026.09-v2-no-vat');

--> statement-breakpoint
CREATE TRIGGER finance_document_lokd_only BEFORE INSERT ON finance_document_versions WHEN NEW.kind='remittance' BEGIN SELECT RAISE(ABORT,'external_firm_work_retired'); END;
--> statement-breakpoint
CREATE TRIGGER finance_document_decision_lokd_only BEFORE INSERT ON finance_document_decisions WHEN EXISTS(SELECT 1 FROM finance_document_versions WHERE id=NEW.document_id AND kind='remittance') BEGIN SELECT RAISE(ABORT,'external_firm_work_retired'); END;
--> statement-breakpoint
CREATE TRIGGER finance_document_issue_lokd_only BEFORE INSERT ON finance_document_issues WHEN EXISTS(SELECT 1 FROM finance_document_versions WHERE id=NEW.document_id AND kind='remittance') BEGIN SELECT RAISE(ABORT,'external_firm_work_retired'); END;
