-- Dedicated SANDBOX_DB only; preserve all existing sandbox evidence predicates.
DROP VIEW `specialist_booking_control_validation_v33`;
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
        CASE WHEN booking.`specialist_service_code` IN ('armed_static','armed_movement','vip_armed') THEN 'S1_ARMED_SERVICE_AUTHORITY' ELSE 'S2_VIP_SERVICE_AUTHORITY' END,
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
      AND funding.`environment` = booking.`environment` AND (funding.`integrity_state` = booking.`integrity_state` OR EXISTS(
 SELECT 1 FROM sandbox_funding_acceptances a JOIN sandbox_funding_decisions d ON d.acceptance_id=a.id AND d.decision='approve'
 WHERE a.reconciliation_id=funding.id AND a.reconciliation_version=funding.version
 AND json_extract(a.source_json,'$.client_price_cents')=booking.client_price_cents
 AND json_extract(a.source_json,'$.provider_reference')=funding.provider_reference
 AND json_extract(a.source_json,'$.mode')='simulator'
 AND json_extract(a.source_json,'$.policyVersion')=(SELECT policy_version FROM sandbox_completion_instance WHERE mode='sandbox')
 AND julianday(a.expires_at)>=julianday((SELECT MAX(slot.ends_at) FROM roster_slots slot WHERE slot.booking_id=booking.id))))
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
