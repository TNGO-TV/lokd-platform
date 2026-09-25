-- Owner-confirmed no-VAT pricing applies to new v2 orders only.
-- Preserve historical v1 tax, amounts, receipts, and all shared approval guards.
DROP VIEW `specialist_pricing_validation_v33`;
--> statement-breakpoint
DROP TRIGGER `specialist_pricing_insert_guard_v33`;
--> statement-breakpoint
DROP TRIGGER `specialist_pricing_update_guard_v33`;
--> statement-breakpoint
DROP TRIGGER `specialist_pricing_version_immutable_v33`;
--> statement-breakpoint
DROP TRIGGER `specialist_booking_progress_guard_v33`;
--> statement-breakpoint
DROP TRIGGER `specialist_offer_insert_guard_v33`;
--> statement-breakpoint
DROP TRIGGER `specialist_offer_update_guard_v33`;
--> statement-breakpoint
DROP TRIGGER `specialist_activation_guard_v33`;
--> statement-breakpoint
DROP TRIGGER `specialist_activated_booking_immutable_v33`;
--> statement-breakpoint
DROP TRIGGER `specialist_commercial_reviews_insert_shape_v34`;
--> statement-breakpoint
DROP TRIGGER `specialist_commercial_reviews_update_shape_v34`;
--> statement-breakpoint
DROP VIEW `specialist_booking_control_validation_v33`;
--> statement-breakpoint
DROP TRIGGER `activation_snapshot_authoritative_calendar_wage_v1`;
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
CREATE TRIGGER `specialist_pricing_insert_guard_v33`
AFTER INSERT ON `bookings`
FOR EACH ROW WHEN NEW.`pricing_version`  IN ('LOKD-SPECIALIST-2026.09-v1','LOKD-SPECIALIST-2026.09-v2-no-vat')
BEGIN
  SELECT (CASE WHEN COALESCE((SELECT `valid` FROM `specialist_pricing_validation_v33` WHERE `id` = NEW.`id`),0) <> 1
    THEN RAISE(ABORT,'specialist_pricing_floor_invalid') END);
END;
--> statement-breakpoint
CREATE TRIGGER `specialist_pricing_update_guard_v33`
AFTER UPDATE OF `service_type`,`service_day_count`,`headcount`,`shift_count`,`officer_total_cents`,
  `gross_platform_contribution_cents`,`pricing_version`,`pricing_breakdown`,`specialist_service_code`,
  `specialist_configuration`,`quote_subtotal_cents`,`vat_rate_basis_points`,`vat_cents`,`cost_floor_cents`,
  `margin_cents`,`margin_basis_points`,`minimum_margin_basis_points`,`pricing_status`,`client_price_cents`
ON `bookings`
FOR EACH ROW WHEN NEW.`pricing_version`  IN ('LOKD-SPECIALIST-2026.09-v1','LOKD-SPECIALIST-2026.09-v2-no-vat')
BEGIN
  SELECT (CASE WHEN COALESCE((SELECT `valid` FROM `specialist_pricing_validation_v33` WHERE `id` = NEW.`id`),0) <> 1
    THEN RAISE(ABORT,'specialist_pricing_floor_invalid') END);
END;
--> statement-breakpoint
CREATE TRIGGER `specialist_pricing_version_immutable_v33`
BEFORE UPDATE OF `pricing_version` ON `bookings`
FOR EACH ROW WHEN OLD.`pricing_version`  IN ('LOKD-SPECIALIST-2026.09-v1','LOKD-SPECIALIST-2026.09-v2-no-vat') AND NEW.`pricing_version` <> OLD.`pricing_version`
BEGIN
  SELECT RAISE(ABORT,'specialist_pricing_version_immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `specialist_booking_progress_guard_v33`
BEFORE UPDATE OF `status`,`funding_status`,`pricing_status` ON `bookings`
FOR EACH ROW WHEN NEW.`pricing_version`  IN ('LOKD-SPECIALIST-2026.09-v1','LOKD-SPECIALIST-2026.09-v2-no-vat')
  AND (NEW.`status` IN ('awaiting_payment','matching','offered','partially_staffed','staffed','active')
    OR NEW.`funding_status` = 'paid_in_full')
BEGIN
  SELECT (CASE WHEN NEW.`pricing_status` <> 'authoritative'
    THEN RAISE(ABORT,'specialist_partner_or_pricing_review_required') END);
  SELECT (CASE WHEN COALESCE((SELECT `assignment_plan_current` FROM `specialist_booking_control_validation_v33` WHERE `id` = NEW.`id`),0) <> 1
    THEN RAISE(ABORT,'specialist_assignment_plan_not_current') END);
  SELECT (CASE WHEN COALESCE((SELECT `specialist_authority_current` FROM `specialist_booking_control_validation_v33` WHERE `id` = NEW.`id`),0) <> 1
    THEN RAISE(ABORT,'specialist_service_authority_not_current') END);
  SELECT (CASE WHEN (NEW.`status` IN ('matching','offered','partially_staffed','staffed','active') OR NEW.`funding_status` = 'paid_in_full')
    AND COALESCE((SELECT `funding_current` FROM `specialist_booking_control_validation_v33` WHERE `id` = NEW.`id`),0) <> 1
    THEN RAISE(ABORT,'specialist_full_cleared_advance_funding_required') END);
END;
--> statement-breakpoint
CREATE TRIGGER `specialist_offer_insert_guard_v33`
BEFORE INSERT ON `offers`
FOR EACH ROW WHEN NEW.`status` IN ('open','accepted')
  AND EXISTS (SELECT 1 FROM `bookings` booking WHERE booking.`id` = NEW.`booking_id`
    AND booking.`pricing_version`  IN ('LOKD-SPECIALIST-2026.09-v1','LOKD-SPECIALIST-2026.09-v2-no-vat'))
BEGIN
  SELECT (CASE WHEN NOT EXISTS (
    SELECT 1 FROM `bookings` booking
    JOIN `specialist_booking_control_validation_v33` control ON control.`id` = booking.`id`
    WHERE booking.`id` = NEW.`booking_id` AND booking.`pricing_status` = 'authoritative'
      AND booking.`credit_terms_days` = 0 AND booking.`funding_model` = 'advance_only'
      AND booking.`funding_status` = 'paid_in_full'
      AND control.`assignment_plan_current` = 1 AND control.`specialist_authority_current` = 1
      AND control.`funding_current` = 1
  ) THEN RAISE(ABORT,'specialist_offer_controls_not_current') END);
END;
--> statement-breakpoint
CREATE TRIGGER `specialist_offer_update_guard_v33`
BEFORE UPDATE OF `status` ON `offers`
FOR EACH ROW WHEN NEW.`status` IN ('open','accepted')
  AND EXISTS (SELECT 1 FROM `bookings` booking WHERE booking.`id` = NEW.`booking_id`
    AND booking.`pricing_version`  IN ('LOKD-SPECIALIST-2026.09-v1','LOKD-SPECIALIST-2026.09-v2-no-vat'))
BEGIN
  SELECT (CASE WHEN NOT EXISTS (
    SELECT 1 FROM `bookings` booking
    JOIN `specialist_booking_control_validation_v33` control ON control.`id` = booking.`id`
    WHERE booking.`id` = NEW.`booking_id` AND booking.`pricing_status` = 'authoritative'
      AND booking.`credit_terms_days` = 0 AND booking.`funding_model` = 'advance_only'
      AND booking.`funding_status` = 'paid_in_full'
      AND control.`assignment_plan_current` = 1 AND control.`specialist_authority_current` = 1
      AND control.`funding_current` = 1
  ) THEN RAISE(ABORT,'specialist_offer_controls_not_current') END);
END;
--> statement-breakpoint
CREATE TRIGGER `specialist_activation_guard_v33`
BEFORE UPDATE OF `state` ON `assignment_activation_commands`
FOR EACH ROW WHEN NEW.`state` = 'activated' AND EXISTS (
  SELECT 1 FROM `roster_slots` slot JOIN `bookings` booking ON booking.`id` = slot.`booking_id`
  WHERE slot.`id` = NEW.`roster_slot_id` AND booking.`pricing_version`  IN ('LOKD-SPECIALIST-2026.09-v1','LOKD-SPECIALIST-2026.09-v2-no-vat'))
BEGIN
  SELECT (CASE WHEN NOT EXISTS (
    SELECT 1 FROM `roster_slots` slot
    JOIN `bookings` booking ON booking.`id` = slot.`booking_id`
    JOIN `specialist_booking_control_validation_v33` control ON control.`id` = booking.`id`
    WHERE slot.`id` = NEW.`roster_slot_id` AND booking.`pricing_status` = 'authoritative'
      AND booking.`credit_terms_days` = 0 AND booking.`funding_model` = 'advance_only'
      AND booking.`funding_status` = 'paid_in_full'
      AND control.`assignment_plan_current` = 1 AND control.`specialist_authority_current` = 1
      AND control.`funding_current` = 1
  ) THEN RAISE(ABORT,'specialist_activation_controls_not_current') END);
END;
--> statement-breakpoint
CREATE TRIGGER `specialist_activated_booking_immutable_v33`
BEFORE UPDATE OF `service_type`,`service_day_count`,`headcount`,`shift_count`,`officer_total_cents`,
  `gross_platform_contribution_cents`,`pricing_breakdown`,`specialist_service_code`,`specialist_configuration`,
  `quote_subtotal_cents`,`vat_rate_basis_points`,`vat_cents`,`cost_floor_cents`,`margin_cents`,
  `margin_basis_points`,`minimum_margin_basis_points`,`pricing_status`,`client_price_cents`
ON `bookings`
FOR EACH ROW WHEN OLD.`pricing_version`  IN ('LOKD-SPECIALIST-2026.09-v1','LOKD-SPECIALIST-2026.09-v2-no-vat')
  AND EXISTS (SELECT 1 FROM `assignment_activation_snapshots` snapshot WHERE snapshot.`booking_id` = OLD.`id` AND snapshot.`final` = 1)
BEGIN
  SELECT RAISE(ABORT,'specialist_activated_booking_immutable');
END;
--> statement-breakpoint
CREATE TRIGGER specialist_commercial_reviews_insert_shape_v34 BEFORE INSERT ON specialist_commercial_reviews
 BEGIN
 SELECT (CASE WHEN NOT COALESCE(NEW.environment IN ('demo','production') AND NEW.integrity_state=(CASE NEW.environment WHEN 'demo' THEN 'synthetic' ELSE 'recorded' END)
 AND NEW.status IN ('draft','review','approved','revoked') AND length(trim(NEW.prepared_by))>0 AND (NEW.pricing_version IN ('LOKD-SPECIALIST-2026.09-v1','LOKD-SPECIALIST-2026.09-v2-no-vat') AND NEW.terms_version='LOKD-SPECIALIST-TERMS-2026.09-v1' AND julianday(NEW.expires_at) IS NOT NULL AND length(trim(NEW.evidence_reference))>0),0)
 THEN RAISE(ABORT,'specialist_record_shape_invalid') END);
 SELECT (CASE WHEN NEW.status<>'review' OR NEW.approved_by IS NOT NULL OR NEW.version<>1 THEN RAISE(ABORT,'specialist_initial_review_required') END);
 END;
--> statement-breakpoint
CREATE TRIGGER specialist_commercial_reviews_update_shape_v34 BEFORE UPDATE ON specialist_commercial_reviews
 BEGIN
 SELECT (CASE WHEN NOT COALESCE(NEW.environment IN ('demo','production') AND NEW.integrity_state=(CASE NEW.environment WHEN 'demo' THEN 'synthetic' ELSE 'recorded' END)
 AND NEW.status IN ('draft','review','approved','revoked') AND length(trim(NEW.prepared_by))>0 AND (NEW.pricing_version IN ('LOKD-SPECIALIST-2026.09-v1','LOKD-SPECIALIST-2026.09-v2-no-vat') AND NEW.terms_version='LOKD-SPECIALIST-TERMS-2026.09-v1' AND julianday(NEW.expires_at) IS NOT NULL AND length(trim(NEW.evidence_reference))>0),0)
 THEN RAISE(ABORT,'specialist_record_shape_invalid') END);
 SELECT (CASE WHEN NEW.id<>OLD.id OR NEW.environment<>OLD.environment OR NEW.integrity_state<>OLD.integrity_state OR NEW.version<>OLD.version+1
 THEN RAISE(ABORT,'specialist_revision_conflict') END);
 END;
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
  CASE WHEN booking.`specialist_service_code` = 'standard_unarmed' THEN 1
    WHEN (SELECT COUNT(*) FROM `launch_controls` gate
      WHERE gate.`code` IN (
        'S3_SPECIALIST_INSURANCE','S4_SPECIALIST_BOARD_APPROVAL',
        (CASE WHEN booking.`specialist_service_code` IN ('armed_static','armed_movement','vip_armed') THEN 'S1_ARMED_SERVICE_AUTHORITY' ELSE 'S2_VIP_SERVICE_AUTHORITY' END),
        CASE WHEN booking.`specialist_service_code` = 'vip_armed' THEN 'S2_VIP_SERVICE_AUTHORITY' ELSE '' END
      )
      AND gate.`status` = 'passed'
      AND gate.`evidence_level` IN ('system_verified','independently_verified')
      AND gate.`evidence_reference` IS NOT NULL AND length(trim(gate.`evidence_reference`)) >= 8
      AND gate.`verified_at` IS NOT NULL AND julianday(gate.`verified_at`) <= julianday(strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      AND gate.`expires_at` IS NOT NULL
      AND julianday(gate.`expires_at`) >= julianday((SELECT MAX(slot.`ends_at`) FROM `roster_slots` slot WHERE slot.`booking_id` = booking.`id`))
    ) = CASE WHEN booking.`specialist_service_code` = 'vip_armed' THEN 4 ELSE 3 END
    THEN 1 ELSE 0 END AS `specialist_authority_current`,
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
					WHEN 'sunday' THEN CASE engagement_model WHEN 'flex' THEN 2.0 WHEN 'fixed' THEN 1.5 END
					WHEN 'public_holiday' THEN 2.0 WHEN 'easter' THEN 2.25 WHEN 'christmas' THEN 2.5
				END AS calendar_multiplier
			FROM classified
		)
		SELECT 1 FROM priced
		WHERE service_date = derived_service_date
			AND ((pricing_version='LOKD-PREMIUM-2026.09' AND service_type='Unarmed') OR (pricing_version IN ('LOKD-SPECIALIST-2026.09-v1','LOKD-SPECIALIST-2026.09-v2-no-vat') AND specialist_price_valid=1))
			AND engagement_model IN ('fixed','flex')
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
