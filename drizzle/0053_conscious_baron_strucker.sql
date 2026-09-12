CREATE TABLE `booking_collection_recoveries` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`source` text NOT NULL,
	`event` text NOT NULL,
	`payload_hash` text NOT NULL,
	`detail` text NOT NULL,
	`actor_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`reference`) REFERENCES `booking_collection_requests`(`reference`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `booking_recovery_event_idx` ON `booking_collection_recoveries` (`reference`,`source`,`payload_hash`);--> statement-breakpoint
CREATE TABLE `booking_settlement_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL,
	`decision` text NOT NULL,
	`actor_id` text NOT NULL,
	`operator_id` text NOT NULL,
	`note` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`review_id`) REFERENCES `booking_settlement_reviews`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `booking_settlement_one_decision_idx` ON `booking_settlement_decisions` (`review_id`);--> statement-breakpoint
CREATE TABLE `booking_settlement_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`collection_revision` integer NOT NULL,
	`mode` text NOT NULL,
	`settlement_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`payload_json` text NOT NULL,
	`payload_hash` text NOT NULL,
	`prepared_by` text NOT NULL,
	`prepared_at` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`reference`) REFERENCES `booking_collection_requests`(`reference`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `booking_settlement_reference_revision_idx` ON `booking_settlement_reviews` (`reference`,`collection_revision`);--> statement-breakpoint
CREATE TRIGGER booking_settlement_source_guard BEFORE INSERT ON booking_settlement_reviews BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM booking_collection_requests r JOIN bookings b ON b.id=r.order_id JOIN current_production_client_approvals a ON a.client_id=r.client_id WHERE r.reference=NEW.reference AND r.revision=NEW.collection_revision AND r.mode=NEW.mode AND r.provider_id=NEW.provider_id AND r.source_hash=json_extract(NEW.payload_json,'$.binding.sourceHash') AND r.amount_minor=json_extract(NEW.payload_json,'$.binding.amountMinor') AND r.state=CASE WHEN r.mode='live' THEN 'matched_live_unsettled' ELSE 'matched_test' END AND b.funding_status='unfunded' AND b.status='draft' AND b.client_price_cents=r.amount_minor) OR EXISTS(SELECT 1 FROM booking_collection_recoveries h WHERE h.reference=NEW.reference) THEN RAISE(ABORT,'Settlement collection changed or is held') END);
END;
--> statement-breakpoint
CREATE TRIGGER booking_settlement_decision_guard BEFORE INSERT ON booking_settlement_decisions BEGIN
 SELECT (CASE WHEN NEW.decision NOT IN ('cleared_live','confirmed_test','rejected') OR NOT EXISTS(SELECT 1 FROM booking_settlement_reviews s JOIN booking_collection_requests r ON r.reference=s.reference WHERE s.id=NEW.review_id AND s.prepared_by<>NEW.operator_id AND r.applicant_id<>NEW.actor_id) THEN RAISE(ABORT,'Independent settlement decision required') END);
 SELECT (CASE WHEN NEW.decision IN ('cleared_live','confirmed_test') AND NOT EXISTS(SELECT 1 FROM booking_settlement_reviews s JOIN booking_collection_requests r ON r.reference=s.reference JOIN bookings b ON b.id=r.order_id JOIN current_production_client_approvals a ON a.client_id=r.client_id WHERE s.id=NEW.review_id AND s.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now') AND r.revision=s.collection_revision AND r.provider_id=s.provider_id AND r.state=CASE WHEN NEW.decision='cleared_live' THEN 'matched_live_unsettled' ELSE 'matched_test' END AND r.mode=CASE WHEN NEW.decision='cleared_live' THEN 'live' ELSE 'test' END AND b.funding_status='unfunded' AND b.status='draft' AND b.client_price_cents=r.amount_minor AND NOT EXISTS(SELECT 1 FROM booking_collection_recoveries h WHERE h.reference=r.reference)) THEN RAISE(ABORT,'Settlement evidence is stale or held') END);
END;
--> statement-breakpoint
CREATE TRIGGER booking_settlement_funding_guard BEFORE INSERT ON booking_funding_reconciliations WHEN NEW.provider='paystack' AND NEW.environment='production' BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM booking_settlement_reviews s JOIN booking_settlement_decisions d ON d.review_id=s.id AND d.decision='cleared_live' JOIN booking_collection_requests r ON r.reference=s.reference WHERE NEW.evidence_reference='settlement-review:'||s.id AND NEW.id='FUND-'||s.id AND NEW.booking_id=r.order_id AND NEW.provider_reference=r.reference AND r.mode='live' AND r.revision=s.collection_revision AND NEW.expected_amount_cents=r.amount_minor AND NEW.cleared_amount_cents=r.amount_minor AND NEW.currency='ZAR' AND NEW.active_key=r.order_id AND NEW.status='cleared_reconciled' AND NEW.integrity_state='production_verified') THEN RAISE(ABORT,'Exact approved live settlement required for funding') END);
END;
--> statement-breakpoint
CREATE TRIGGER booking_recovery_hold AFTER INSERT ON booking_collection_recoveries BEGIN
 UPDATE booking_collection_requests SET state='review_required',revision=revision+1,updated_at=NEW.created_at WHERE reference=NEW.reference;
 UPDATE booking_funding_reconciliations SET status='held',evidence_expires_at=NEW.created_at,version=version+1 WHERE provider='paystack' AND provider_reference=NEW.reference AND environment='production' AND status='cleared_reconciled';
END;
--> statement-breakpoint
CREATE TRIGGER booking_collection_funding_invalidated AFTER UPDATE ON booking_collection_requests WHEN NEW.state<>'matched_live_unsettled' BEGIN
 UPDATE booking_funding_reconciliations SET status='held',evidence_expires_at=NEW.updated_at,version=version+1 WHERE provider='paystack' AND provider_reference=NEW.reference AND environment='production' AND status='cleared_reconciled';
END;
--> statement-breakpoint
CREATE TRIGGER booking_settlement_no_update BEFORE UPDATE ON booking_settlement_reviews BEGIN SELECT RAISE(ABORT,'Settlement evidence is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER booking_settlement_no_delete BEFORE DELETE ON booking_settlement_reviews BEGIN SELECT RAISE(ABORT,'Settlement evidence is required'); END;
--> statement-breakpoint
CREATE TRIGGER booking_settlement_decision_no_update BEFORE UPDATE ON booking_settlement_decisions BEGIN SELECT RAISE(ABORT,'Settlement decisions are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER booking_settlement_decision_no_delete BEFORE DELETE ON booking_settlement_decisions BEGIN SELECT RAISE(ABORT,'Settlement decisions are required'); END;
--> statement-breakpoint
CREATE TRIGGER booking_recovery_no_update BEFORE UPDATE ON booking_collection_recoveries BEGIN SELECT RAISE(ABORT,'Recovery history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER booking_recovery_no_delete BEFORE DELETE ON booking_collection_recoveries BEGIN SELECT RAISE(ABORT,'Recovery history is required'); END;
--> statement-breakpoint
CREATE TRIGGER booking_settlement_funding_no_rewrite BEFORE UPDATE ON booking_funding_reconciliations WHEN OLD.provider='paystack' AND OLD.environment='production' AND OLD.evidence_reference LIKE 'settlement-review:%' BEGIN
 SELECT (CASE WHEN NEW.id IS NOT OLD.id OR NEW.booking_id IS NOT OLD.booking_id OR NEW.provider IS NOT OLD.provider OR NEW.provider_reference IS NOT OLD.provider_reference OR NEW.currency IS NOT OLD.currency OR NEW.expected_amount_cents IS NOT OLD.expected_amount_cents OR NEW.cleared_amount_cents IS NOT OLD.cleared_amount_cents OR NEW.evidence_reference IS NOT OLD.evidence_reference OR NEW.environment IS NOT OLD.environment OR NEW.integrity_state IS NOT OLD.integrity_state OR NEW.active_key IS NOT OLD.active_key OR NEW.status<>'held' OR NEW.version<>OLD.version+1 THEN RAISE(ABORT,'Settlement funding may only be held for recovery') END);
END;
--> statement-breakpoint
CREATE TRIGGER booking_settlement_funding_no_delete BEFORE DELETE ON booking_funding_reconciliations WHEN OLD.provider='paystack' AND OLD.environment='production' AND OLD.evidence_reference LIKE 'settlement-review:%' BEGIN SELECT RAISE(ABORT,'Settlement funding history is required'); END;
--> statement-breakpoint
CREATE TRIGGER booking_settlement_current_binding BEFORE INSERT ON booking_settlement_decisions WHEN NEW.decision IN ('cleared_live','confirmed_test') BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM booking_settlement_reviews s JOIN booking_collection_requests r ON r.reference=s.reference JOIN production_order_setups p ON p.id=r.order_id AND p.client_id=r.client_id AND p.case_version=r.case_version AND p.request_hash=r.source_hash JOIN production_entity_links l ON l.kind='client' AND l.entity_id=r.client_id AND l.case_id=r.case_id AND l.case_version=r.case_version AND l.owner_user_id=r.applicant_id JOIN operator_accounts o ON o.id=NEW.operator_id AND o.status='active' AND o.environment='production' AND o.integrity_state='production_verified' AND o.approval_limit_cents>=r.amount_minor JOIN operator_role_assignments a ON a.operator_id=o.id AND a.role='funding_reconciler' AND a.status='active' AND a.environment='production' AND a.integrity_state='production_verified' WHERE s.id=NEW.review_id) THEN RAISE(ABORT,'Settlement source or reviewer authority changed') END);
END;

--> statement-breakpoint
DROP VIEW specialist_booking_control_validation_v33;
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
WHERE booking.`pricing_version` = 'LOKD-SPECIALIST-2026.09-v1';
