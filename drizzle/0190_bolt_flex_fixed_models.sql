-- Booking product definitions; historical pricing snapshots remain unchanged.
ALTER TABLE bookings ADD COLUMN model_version TEXT NOT NULL DEFAULT 'legacy';
--> statement-breakpoint
ALTER TABLE bookings ADD COLUMN requested_at TEXT;
--> statement-breakpoint
ALTER TABLE bookings ADD COLUMN duration_weeks INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE client_enquiries ADD COLUMN booking_model TEXT CHECK(booking_model IS NULL OR booking_model IN ('bolt','flex','fixed'));
--> statement-breakpoint
ALTER TABLE client_enquiries ADD COLUMN booking_model_version TEXT;
--> statement-breakpoint
DROP TRIGGER client_enquiry_booking_immutable;
--> statement-breakpoint
CREATE TRIGGER client_enquiry_booking_immutable BEFORE UPDATE ON client_enquiries
WHEN NEW.engagement_model IS NOT OLD.engagement_model OR NEW.notice_window IS NOT OLD.notice_window
 OR NEW.calendar_type IS NOT OLD.calendar_type OR NEW.risk_band IS NOT OLD.risk_band
 OR NEW.booking_details IS NOT OLD.booking_details OR NEW.internal_draft_price IS NOT OLD.internal_draft_price
 OR NEW.booking_model IS NOT OLD.booking_model OR NEW.booking_model_version IS NOT OLD.booking_model_version
BEGIN SELECT RAISE(ABORT,'enquiry_booking_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER booking_product_model_insert BEFORE INSERT ON bookings WHEN NEW.environment='production' AND NEW.model_version='LOKD-MODELS-2026.11' BEGIN SELECT (CASE WHEN NOT (NEW.engagement_model IN ('bolt','flex','fixed') AND NEW.requested_at IS NOT NULL
 AND julianday(NEW.requested_at)<=julianday('now','+10 seconds')
 AND julianday(NEW.start_date||'T'||NEW.shift_start||':00','-2 hours')>julianday(NEW.requested_at)
 AND ((NEW.engagement_model='bolt' AND NEW.contract_months=0 AND NEW.duration_weeks=0 AND NEW.start_date=NEW.end_date AND CAST(ROUND((julianday(NEW.start_date||'T'||NEW.shift_start||':00','-2 hours')-julianday(NEW.requested_at))*86400000) AS INTEGER)< 259200000)
 OR (NEW.engagement_model='flex' AND NEW.contract_months=0 AND typeof(NEW.duration_weeks)='integer' AND NEW.duration_weeks BETWEEN 1 AND 52 AND NEW.end_date=date(NEW.start_date,'+'||(NEW.duration_weeks*7-1)||' days') AND CAST(ROUND((julianday(NEW.start_date||'T'||NEW.shift_start||':00','-2 hours')-julianday(NEW.requested_at))*86400000) AS INTEGER)>= 259200000)
 OR (NEW.engagement_model='fixed' AND NEW.duration_weeks=0 AND NEW.contract_months IN (3,6,12) AND NEW.end_date=date(NEW.start_date,'+'||NEW.contract_months||' months','-1 day')))) THEN RAISE(ABORT,'booking_product_model_invalid') END); END;
--> statement-breakpoint
CREATE TRIGGER booking_product_model_immutable BEFORE UPDATE OF model_version,requested_at,duration_weeks ON bookings WHEN NEW.model_version IS NOT OLD.model_version OR NEW.requested_at IS NOT OLD.requested_at OR NEW.duration_weeks IS NOT OLD.duration_weeks BEGIN SELECT RAISE(ABORT,'booking_product_model_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER enquiry_product_model_insert BEFORE INSERT ON client_enquiries WHEN NEW.booking_model IS NOT NULL BEGIN
 SELECT (CASE WHEN NEW.booking_model_version IS NOT 'LOKD-MODELS-2026.11' OR json_extract(NEW.booking_details,'$.coverType') IS NOT NEW.booking_model OR json_extract(NEW.booking_details,'$.startDate') IS NOT NEW.start_date OR NEW.engagement_model IS NOT CASE NEW.booking_model WHEN 'fixed' THEN 'fixed' ELSE 'flex' END
 OR NOT ((NEW.booking_model='bolt' AND json_extract(NEW.booking_details,'$.term')='single' AND NEW.start_date=NEW.end_date AND CAST(ROUND((julianday(NEW.start_date||'T'||NEW.start_time||':00','-2 hours')-julianday(NEW.created_at))*86400000) AS INTEGER)< 259200000 AND julianday(NEW.start_date||'T'||NEW.start_time||':00','-2 hours','+12 hours')>julianday(NEW.created_at))
 OR (NEW.booking_model='flex' AND json_extract(NEW.booking_details,'$.term')='week' AND json_type(NEW.booking_details,'$.durationWeeks')='integer' AND json_extract(NEW.booking_details,'$.durationWeeks') BETWEEN 1 AND 52 AND NEW.end_date=date(NEW.start_date,'+'||(json_extract(NEW.booking_details,'$.durationWeeks')*7-1)||' days') AND CAST(ROUND((julianday(NEW.start_date||'T'||NEW.start_time||':00','-2 hours')-julianday(NEW.created_at))*86400000) AS INTEGER)>= 259200000)
 OR (NEW.booking_model='fixed' AND json_extract(NEW.booking_details,'$.term') IN ('3','6','12') AND NEW.end_date=date(NEW.start_date,'+'||json_extract(NEW.booking_details,'$.term')||' months','-1 day')))
 THEN RAISE(ABORT,'enquiry_product_model_invalid') END);
END;
--> statement-breakpoint
DROP TRIGGER activation_snapshot_authoritative_calendar_wage_v1;
--> statement-breakpoint
CREATE TRIGGER `activation_snapshot_authoritative_calendar_wage_v1`
BEFORE INSERT ON `assignment_activation_snapshots`
WHEN NEW.`environment` = 'production'
BEGIN
	SELECT (CASE WHEN NOT EXISTS (
		WITH source AS (
			SELECT rs.`service_date`, date(rs.`starts_at`, '+2 hours') AS derived_service_date,
				CAST(strftime('%Y', date(rs.`starts_at`, '+2 hours')) AS INTEGER) AS y,
				b.`pricing_version`, rs.`calendar_category` AS stored_calendar_category,
				rs.`officer_offer_cents` AS stored_officer_offer_cents, b.`service_type`, b.specialist_service_code, price.valid AS specialist_price_valid,
				b.`engagement_model`, sra.`risk_band`
			FROM `assignment_activation_commands` command
			JOIN `roster_slots` rs ON rs.`id` = command.`roster_slot_id`
			JOIN `bookings` b ON b.`id` = rs.`booking_id`
			LEFT JOIN specialist_pricing_validation_v33 price ON price.id=b.id
			JOIN `site_risk_assessments` sra ON sra.`id` = NEW.`risk_assessment_id`
				AND sra.`site_id` = rs.`site_id` AND sra.`active_key` = rs.`site_id`
			WHERE command.`id` = NEW.`command_id`
		), easter_1 AS (
			SELECT *, y % 19 AS a, CAST(y / 100 AS INTEGER) AS b, y % 100 AS c FROM source
		), easter_2 AS (
			SELECT *, CAST(b / 4 AS INTEGER) AS d, b % 4 AS e,
				CAST((b + 8) / 25 AS INTEGER) AS f FROM easter_1
		), easter_3 AS (
			SELECT *, CAST((b - f + 1) / 3 AS INTEGER) AS g,
				(19 * a + b - d - CAST((b - f + 1) / 3 AS INTEGER) + 15) % 30 AS h,
				CAST(c / 4 AS INTEGER) AS i, c % 4 AS k FROM easter_2
		), easter_4 AS (
			SELECT *, (32 + 2 * e + 2 * i - h - k) % 7 AS l FROM easter_3
		), easter_5 AS (
			SELECT *, CAST((a + 11 * h + 22 * ((32 + 2 * e + 2 * i - h - k) % 7)) / 451 AS INTEGER) AS m
			FROM easter_4
		), easter_day AS (
			SELECT *, printf('%04d-%02d-%02d', y,
				CAST((h + l - 7 * m + 114) / 31 AS INTEGER),
				((h + l - 7 * m + 114) % 31) + 1) AS easter_sunday
			FROM easter_5
		), classified AS (
			SELECT *, CASE
				WHEN strftime('%m-%d', derived_service_date) IN ('12-25','12-26') THEN 'christmas'
				WHEN derived_service_date IN (date(easter_sunday, '-2 days'), easter_sunday, date(easter_sunday, '+1 day')) THEN 'easter'
				WHEN strftime('%m-%d', derived_service_date) IN ('01-01','03-21','04-27','05-01','06-16','08-09','09-24','12-16')
					OR (strftime('%w', derived_service_date) = '1' AND strftime('%m-%d', date(derived_service_date, '-1 day'))
						IN ('01-01','03-21','04-27','05-01','06-16','08-09','09-24','12-16','12-25','12-26'))
					THEN 'public_holiday'
				WHEN strftime('%w', derived_service_date) = '0' THEN 'sunday'
				ELSE 'ordinary'
			END AS authoritative_calendar_category
			FROM easter_day
		), priced AS (
			SELECT *,
				CASE WHEN pricing_version='LOKD-PREMIUM-2026.09' AND service_type='Unarmed' THEN 80000
                WHEN pricing_version IN ('LOKD-SPECIALIST-2026.09-v1','LOKD-SPECIALIST-2026.09-v2-no-vat') THEN CASE specialist_service_code
                 WHEN 'standard_unarmed' THEN 80000 WHEN 'armed_static' THEN 200000 WHEN 'armed_movement' THEN 220000
                 WHEN 'vip_unarmed' THEN 450000 WHEN 'vip_armed' THEN 550000 WHEN 'vip_protective_driver' THEN 500000 WHEN 'vip_team' THEN 480000 END END AS base_wage_cents,
				CASE risk_band WHEN 'Standard' THEN 1.0 WHEN 'Enhanced' THEN 1.0 WHEN 'Elevated' THEN 1.05
					WHEN 'High' THEN 1.1 WHEN 'Critical' THEN 1.2 END AS risk_multiplier,
				CASE authoritative_calendar_category
					WHEN 'ordinary' THEN 1.0
					WHEN 'sunday' THEN CASE engagement_model WHEN 'bolt' THEN 2.0 WHEN 'flex' THEN 2.0 WHEN 'fixed' THEN 1.5 END
					WHEN 'public_holiday' THEN 2.0 WHEN 'easter' THEN 2.25 WHEN 'christmas' THEN 2.5
				END AS calendar_multiplier
			FROM classified
		)
		SELECT 1 FROM priced
		WHERE service_date = derived_service_date
			AND ((pricing_version='LOKD-PREMIUM-2026.09' AND service_type='Unarmed') OR (pricing_version IN ('LOKD-SPECIALIST-2026.09-v1','LOKD-SPECIALIST-2026.09-v2-no-vat') AND specialist_price_valid=1))
			AND engagement_model IN ('bolt','fixed','flex')
			AND base_wage_cents IS NOT NULL AND risk_multiplier IS NOT NULL AND calendar_multiplier IS NOT NULL
			AND stored_calendar_category = authoritative_calendar_category
			AND NEW.`calendar_category` = authoritative_calendar_category
			AND NEW.`pricing_version` = pricing_version
			AND NEW.`ordinary_wage_cents` = CAST(ROUND(base_wage_cents * risk_multiplier) AS INTEGER)
			AND NEW.`funded_offer_cents` = CAST(ROUND(base_wage_cents * risk_multiplier * calendar_multiplier) AS INTEGER)
			AND stored_officer_offer_cents = NEW.`funded_offer_cents`
			AND NEW.`holiday_premium_cents` = NEW.`funded_offer_cents` - NEW.`ordinary_wage_cents`
			AND NEW.`statutory_cost_cents` = CASE WHEN NEW.`workforce_model` = 'partner' THEN 0
				ELSE CAST(ROUND(NEW.`funded_offer_cents` * 0.15) AS INTEGER) END
	) THEN RAISE(ABORT, 'activation_authoritative_calendar_wage_invalid') END);
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
				WHEN 'ordinary' THEN 1.0 WHEN 'sunday' THEN CASE b.`engagement_model` WHEN 'bolt' THEN 2.0 WHEN 'flex' THEN 2.0 ELSE 1.5 END
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
          AND json_extract(booking.`specialist_configuration`,'$.vehicleClass') IN ('client_vehicle','standard_suv','armoured_partner'))
      OR (booking.`specialist_service_code` IN ('vip_unarmed','vip_armed','vip_team')
          AND json_extract(booking.`specialist_configuration`,'$.vehicleClass') IN ('none','client_vehicle','standard_suv','armoured_partner')))
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
        WHEN 'standard_suv' THEN 220000 WHEN 'armoured_partner' THEN 1500000 ELSE 0 END
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
      + json_extract(booking.`pricing_breakdown`,'$.vehicleAndPartnerCents')
      + json_extract(booking.`pricing_breakdown`,'$.overnightCents')
      + booking.`officer_total_cents` = booking.`cost_floor_cents`
    ELSE 0 END
THEN 1 ELSE 0 END AS `valid`
FROM `bookings` booking
WHERE booking.`pricing_version`  IN ('LOKD-SPECIALIST-2026.09-v1','LOKD-SPECIALIST-2026.09-v2-no-vat');
--> statement-breakpoint
DROP VIEW client_quote_sources;
--> statement-breakpoint
CREATE VIEW client_quote_sources AS WITH original AS (SELECT b.id AS order_id,b.client_id,l.owner_user_id,b.contracting_entity_id AS entity_id,l.case_version,b.agreement_version AS order_version,
 json_patch(json_patch(json_object('orderId',b.id,'orderVersion',b.agreement_version,'clientId',c.id,'clientName',c.organisation_name,
 'contactName',c.contact_name,'contactEmail',c.contact_email,'ownerUserId',l.owner_user_id,'caseVersion',l.case_version,
 'contractingEntityId',b.contracting_entity_id,'siteName',b.site_name,'siteArea',b.site_area,'address',s.address_label,
 'postName',b.post_name,'instructions',post.post_orders_content
 ),json_object('serviceType',b.service_type,'purposeLabel',b.purpose_label,'purposeCode',b.purpose_code,
 'startDate',b.start_date,'endDate',b.end_date,'shiftStart',b.shift_start,'shiftEnd',b.shift_end,
 'headcount',b.headcount,'rosterPattern',b.roster_pattern,'shiftCount',b.shift_count,'serviceDayCount',b.service_day_count,
 'contractMonths',b.contract_months,'engagementModel',b.engagement_model,'riskBand',b.risk_band
 )),json_object('minimumGrade',b.minimum_grade,'specialistServiceCode',b.specialist_service_code,'declaredSiteRisk',json_extract(p.request_json,'$.quoteRequest.riskInput'),'specialistConfiguration',b.specialist_configuration,'subtotalCents',b.quote_subtotal_cents,'vatCents',b.vat_cents,
 'totalCents',b.client_price_cents,'currency','ZAR','pricingVersion',b.pricing_version,
 'fundingModel',b.funding_model,'creditTermsDays',b.credit_terms_days,'releaseCadence',b.release_cadence)) AS source_json
FROM bookings b JOIN production_order_setups p ON p.id=b.id
JOIN clients c ON c.id=b.client_id
JOIN production_entity_links l ON l.kind='client' AND l.entity_id=c.id AND l.case_version=p.case_version
JOIN signup_cases a ON a.kind='client' AND a.source_id=l.case_id AND a.version=l.case_version AND a.owner_user_id=l.owner_user_id AND a.status='reviewed'
JOIN operational_sites s ON s.booking_id=b.id AND s.id='SITE-'||b.id
JOIN site_posts post ON post.booking_id=b.id AND post.id='POST-'||b.id
WHERE b.environment='production' AND b.integrity_state='production_verified' AND b.status NOT IN ('cancelled','completed')
AND c.environment='production' AND c.integrity_state='production_verified' AND c.approval_status='approved') SELECT z.order_id,z.client_id,z.owner_user_id,z.entity_id,z.case_version,z.order_version,CASE WHEN b.model_version='LOKD-MODELS-2026.11' THEN json_set(z.source_json,'$.bookingModelVersion',b.model_version,'$.durationWeeks',b.duration_weeks,'$.requestedAt',b.requested_at) ELSE z.source_json END AS source_json FROM original z JOIN bookings b ON b.id=z.order_id;
