CREATE TABLE `api_idempotency_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`principal_type` text NOT NULL,
	`principal_id` text NOT NULL,
	`operation` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`request_hash` text NOT NULL,
	`aggregate_type` text NOT NULL,
	`aggregate_id` text NOT NULL,
	`response_status` integer,
	`response_reference` text,
	`environment` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_idempotency_principal_key_idx` ON `api_idempotency_keys` (`principal_type`,`principal_id`,`operation`,`environment`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `api_idempotency_expiry_idx` ON `api_idempotency_keys` (`expires_at`);--> statement-breakpoint
CREATE TABLE `domain_outbox_events` (
	`id` text PRIMARY KEY NOT NULL,
	`aggregate_type` text NOT NULL,
	`aggregate_id` text NOT NULL,
	`event_type` text NOT NULL,
	`payload_hash` text NOT NULL,
	`payload_version` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`available_at` text NOT NULL,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`created_at` text NOT NULL,
	`dispatched_at` text,
	`last_error_code` text
);
--> statement-breakpoint
CREATE INDEX `domain_outbox_dispatch_idx` ON `domain_outbox_events` (`environment`,`status`,`available_at`);--> statement-breakpoint
CREATE INDEX `domain_outbox_aggregate_idx` ON `domain_outbox_events` (`aggregate_type`,`aggregate_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `identity_verification_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text,
	`officer_id` text,
	`provider_key` text NOT NULL,
	`provider_reference` text,
	`status` text DEFAULT 'created' NOT NULL,
	`decision` text,
	`consent_version` text NOT NULL,
	`consented_at` text NOT NULL,
	`checks` text DEFAULT '[]' NOT NULL,
	`reason_codes` text DEFAULT '[]' NOT NULL,
	`evidence_reference` text,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`expires_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`application_id`) REFERENCES `officer_applications`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`officer_id`) REFERENCES `officers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`provider_key`) REFERENCES `integration_provider_configs`(`key`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `identity_cases_application_idx` ON `identity_verification_cases` (`application_id`,`status`);--> statement-breakpoint
CREATE INDEX `identity_cases_officer_idx` ON `identity_verification_cases` (`officer_id`,`status`);--> statement-breakpoint
CREATE INDEX `identity_cases_provider_ref_idx` ON `identity_verification_cases` (`provider_key`,`provider_reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `identity_cases_provider_ref_unique_v21` ON `identity_verification_cases` (`provider_key`,`environment`,`provider_reference`) WHERE `provider_reference` IS NOT NULL;--> statement-breakpoint
CREATE TABLE `integration_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_key` text NOT NULL,
	`capability` text NOT NULL,
	`operation_type` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`request_hash` text NOT NULL,
	`provider_reference` text,
	`state` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` text,
	`last_error_code` text,
	`last_error_detail` text,
	`environment` text DEFAULT 'demo' NOT NULL,
	`integrity_state` text DEFAULT 'synthetic' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`provider_key`) REFERENCES `integration_provider_configs`(`key`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `integration_operations_idempotency_idx` ON `integration_operations` (`provider_key`,`environment`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `integration_operations_state_idx` ON `integration_operations` (`environment`,`state`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `integration_operations_entity_idx` ON `integration_operations` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `integration_provider_configs` (
	`key` text PRIMARY KEY NOT NULL,
	`capability` text NOT NULL,
	`provider` text NOT NULL,
	`mode` text DEFAULT 'disabled' NOT NULL,
	`status` text DEFAULT 'not_connected' NOT NULL,
	`required_for_pilot` integer DEFAULT 1 NOT NULL,
	`configuration_version` text DEFAULT 'unconfigured' NOT NULL,
	`capabilities` text DEFAULT '[]' NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`environment` text DEFAULT 'demo' NOT NULL,
	`integrity_state` text DEFAULT 'synthetic' NOT NULL,
	`last_health_state` text DEFAULT 'unknown' NOT NULL,
	`last_health_checked_at` text,
	`last_event_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `integration_provider_capability_env_idx` ON `integration_provider_configs` (`capability`,`environment`);--> statement-breakpoint
CREATE INDEX `integration_provider_status_idx` ON `integration_provider_configs` (`environment`,`status`);--> statement-breakpoint
CREATE TABLE `payment_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`client_id` text NOT NULL,
	`provider_key` text NOT NULL,
	`provider_reference` text,
	`currency` text DEFAULT 'ZAR' NOT NULL,
	`amount_cents` integer NOT NULL,
	`status` text DEFAULT 'created' NOT NULL,
	`idempotency_key` text NOT NULL,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`authorised_at` text,
	`cleared_at` text,
	`reconciled_at` text,
	`expires_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`provider_key`) REFERENCES `integration_provider_configs`(`key`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_orders_idempotency_idx` ON `payment_orders` (`provider_key`,`environment`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `payment_orders_booking_idx` ON `payment_orders` (`booking_id`,`status`);--> statement-breakpoint
CREATE INDEX `payment_orders_client_idx` ON `payment_orders` (`client_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `payment_orders_provider_ref_unique_v21` ON `payment_orders` (`provider_key`,`environment`,`provider_reference`) WHERE `provider_reference` IS NOT NULL;--> statement-breakpoint
CREATE TABLE `provider_webhook_inbox` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_key` text NOT NULL,
	`provider_event_id` text NOT NULL,
	`event_type` text NOT NULL,
	`raw_body_hash` text NOT NULL,
	`signature_state` text DEFAULT 'unverified' NOT NULL,
	`processing_state` text DEFAULT 'received' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`operation_id` text,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`received_at` text NOT NULL,
	`processed_at` text,
	`last_error_code` text,
	FOREIGN KEY (`provider_key`) REFERENCES `integration_provider_configs`(`key`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operation_id`) REFERENCES `integration_operations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_webhook_event_idx` ON `provider_webhook_inbox` (`provider_key`,`environment`,`provider_event_id`);--> statement-breakpoint
CREATE INDEX `provider_webhook_processing_idx` ON `provider_webhook_inbox` (`environment`,`processing_state`,`received_at`);--> statement-breakpoint
CREATE TABLE `service_heartbeats` (
	`key` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`environment` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`checked_at` text NOT NULL,
	`last_success_at` text,
	`consecutive_failures` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `service_heartbeats_status_idx` ON `service_heartbeats` (`environment`,`status`);--> statement-breakpoint
CREATE TABLE `service_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text,
	`officer_id` text,
	`booking_id` text,
	`shift_id` text,
	`requested_by_role` text NOT NULL,
	`requested_by_id` text NOT NULL,
	`category` text NOT NULL,
	`summary` text NOT NULL,
	`detail` text NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`owner_id` text,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`resolved_at` text,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`officer_id`) REFERENCES `officers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `service_requests_status_idx` ON `service_requests` (`environment`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `service_requests_client_idx` ON `service_requests` (`client_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `service_requests_officer_idx` ON `service_requests` (`officer_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `officer_applications` ADD `identity_consent_version` text;--> statement-breakpoint
ALTER TABLE `officer_applications` ADD `identity_consented_at` text;--> statement-breakpoint
ALTER TABLE `officer_applications` ADD `officer_id` text REFERENCES `officers`(`id`) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `officer_applications` ADD `environment` text DEFAULT 'prelaunch' NOT NULL;--> statement-breakpoint
ALTER TABLE `officer_applications` ADD `integrity_state` text DEFAULT 'user_submitted' NOT NULL;--> statement-breakpoint
UPDATE `officer_applications` SET `environment` = 'demo', `integrity_state` = 'synthetic',
	`identity_consent_version` = 'demo-identity-consent-v1', `identity_consented_at` = `privacy_acknowledged_at`
	WHERE `source` = 'demo_seed';--> statement-breakpoint
ALTER TABLE `bookings` ADD `headcount` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `service_day_count` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `offers` ADD `position_index` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS `offers_one_accepted_per_booking_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `offers_one_accepted_per_booking_position_idx`
ON `offers` (`booking_id`, `position_index`) WHERE `status` = 'accepted';--> statement-breakpoint
ALTER TABLE `roster_slots` ADD `position_index` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `roster_slots` ADD `calendar_category` text DEFAULT 'ordinary' NOT NULL;--> statement-breakpoint
ALTER TABLE `roster_slots` ADD `officer_offer_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `roster_slots` SET
	`calendar_category` = COALESCE((SELECT booking.`calendar_category` FROM `bookings` booking
		WHERE booking.`id` = `roster_slots`.`booking_id`), `calendar_category`),
	`officer_offer_cents` = COALESCE((SELECT booking.`officer_rate_cents` FROM `bookings` booking
		WHERE booking.`id` = `roster_slots`.`booking_id`), `officer_offer_cents`);--> statement-breakpoint
ALTER TABLE `site_posts` ADD `post_orders_content` text DEFAULT '' NOT NULL;--> statement-breakpoint

CREATE TRIGGER `officer_application_provenance_immutable_v21`
BEFORE UPDATE OF `environment`,`integrity_state` ON `officer_applications`
WHEN NEW.`environment` IS NOT OLD.`environment` OR NEW.`integrity_state` IS NOT OLD.`integrity_state`
BEGIN
	SELECT RAISE(ABORT, 'officer_application_provenance_immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `officer_application_provenance_insert_v21`
BEFORE INSERT ON `officer_applications`
WHEN NOT (
	(NEW.`environment` = 'demo' AND NEW.`integrity_state` = 'synthetic')
	OR (NEW.`environment` = 'prelaunch' AND NEW.`integrity_state` = 'user_submitted')
	OR (NEW.`environment` = 'production' AND NEW.`integrity_state` IN ('verified','production_verified'))
)
BEGIN
	SELECT RAISE(ABORT, 'officer_application_provenance_invalid');
END;
--> statement-breakpoint
CREATE TRIGGER `officer_application_officer_binding_v21`
BEFORE UPDATE OF `officer_id` ON `officer_applications`
WHEN (OLD.`officer_id` IS NOT NULL AND NEW.`officer_id` IS NOT OLD.`officer_id`)
	OR (OLD.`officer_id` IS NULL AND NEW.`officer_id` IS NOT NULL AND NOT EXISTS (
		SELECT 1 FROM `officer_passports` passport WHERE passport.`officer_id` = NEW.`officer_id`
			AND passport.`environment` = NEW.`environment` AND passport.`integrity_state` = NEW.`integrity_state`
	))
BEGIN
	SELECT RAISE(ABORT, 'officer_application_officer_binding_invalid');
END;
--> statement-breakpoint
CREATE TRIGGER `integration_provider_provenance_insert_v21`
BEFORE INSERT ON `integration_provider_configs`
WHEN NOT (
	(NEW.`environment` = 'demo' AND NEW.`integrity_state` = 'synthetic')
	OR (NEW.`environment` = 'prelaunch' AND NEW.`integrity_state` = 'user_submitted')
	OR (NEW.`environment` = 'production' AND NEW.`integrity_state` IN ('verified','production_verified'))
)
BEGIN
	SELECT RAISE(ABORT, 'integration_provider_provenance_invalid');
END;
--> statement-breakpoint
CREATE TRIGGER `identity_case_parent_provenance_v21`
BEFORE INSERT ON `identity_verification_cases`
BEGIN
	SELECT (CASE WHEN NOT (
		(NEW.`environment` = 'demo' AND NEW.`integrity_state` = 'synthetic')
		OR (NEW.`environment` = 'prelaunch' AND NEW.`integrity_state` = 'user_submitted')
		OR (NEW.`environment` = 'production' AND NEW.`integrity_state` IN ('verified','production_verified'))
	) OR NOT EXISTS (
		SELECT 1 FROM `integration_provider_configs` config
		WHERE config.`key` = NEW.`provider_key` AND config.`environment` = NEW.`environment`
			AND config.`integrity_state` = NEW.`integrity_state`
	) OR (NEW.`application_id` IS NOT NULL AND NOT EXISTS (
		SELECT 1 FROM `officer_applications` application WHERE application.`id` = NEW.`application_id`
			AND application.`environment` = NEW.`environment` AND application.`integrity_state` = NEW.`integrity_state`
	)) OR (NEW.`officer_id` IS NOT NULL AND NOT EXISTS (
		SELECT 1 FROM `officer_passports` passport WHERE passport.`officer_id` = NEW.`officer_id`
			AND passport.`environment` = NEW.`environment` AND passport.`integrity_state` = NEW.`integrity_state`
	)) OR (NEW.`application_id` IS NULL AND NEW.`officer_id` IS NULL)
	OR (NEW.`application_id` IS NOT NULL AND NEW.`officer_id` IS NOT NULL AND NOT EXISTS (
		SELECT 1 FROM `officer_applications` application WHERE application.`id` = NEW.`application_id`
			AND application.`officer_id` = NEW.`officer_id`
	)) OR NEW.`status` NOT IN ('created','consent_pending','submitted','processing','manual_review')
	OR NEW.`consent_version` = '' OR NEW.`consented_at` IS NULL
	THEN RAISE(ABORT, 'identity_case_parent_provenance_mismatch') END);
END;
--> statement-breakpoint
CREATE TRIGGER `identity_case_identity_immutable_v21`
BEFORE UPDATE OF `application_id`,`officer_id`,`provider_key`,`provider_reference`,`consent_version`,`consented_at`,`environment`,`integrity_state`,`created_at` ON `identity_verification_cases`
WHEN NEW.`application_id` IS NOT OLD.`application_id`
	OR (OLD.`officer_id` IS NOT NULL AND NEW.`officer_id` IS NOT OLD.`officer_id`)
	OR (OLD.`officer_id` IS NULL AND NEW.`officer_id` IS NOT NULL AND NOT EXISTS (
		SELECT 1 FROM `officer_passports` passport
		LEFT JOIN `officer_applications` application ON application.`id` = OLD.`application_id`
		WHERE passport.`officer_id` = NEW.`officer_id`
			AND passport.`environment` = OLD.`environment` AND passport.`integrity_state` = OLD.`integrity_state`
			AND (OLD.`application_id` IS NULL OR application.`officer_id` = NEW.`officer_id`)
	))
	OR NEW.`provider_key` IS NOT OLD.`provider_key`
	OR (OLD.`provider_reference` IS NOT NULL AND NEW.`provider_reference` IS NOT OLD.`provider_reference`)
	OR NEW.`consent_version` IS NOT OLD.`consent_version` OR NEW.`consented_at` IS NOT OLD.`consented_at`
	OR NEW.`environment` IS NOT OLD.`environment` OR NEW.`integrity_state` IS NOT OLD.`integrity_state`
	OR NEW.`created_at` IS NOT OLD.`created_at`
BEGIN
	SELECT RAISE(ABORT, 'identity_case_identity_immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `identity_case_transition_guard_v21`
BEFORE UPDATE OF `status` ON `identity_verification_cases`
WHEN NEW.`status` IS NOT OLD.`status`
BEGIN
	SELECT (CASE WHEN NOT (
		(OLD.`status` = 'created' AND NEW.`status` IN ('consent_pending','submitted','cancelled'))
		OR (OLD.`status` = 'consent_pending' AND NEW.`status` IN ('submitted','cancelled','expired'))
		OR (OLD.`status` = 'submitted' AND NEW.`status` IN ('processing','manual_review','cancelled','expired'))
		OR (OLD.`status` = 'processing' AND NEW.`status` IN ('verified','rejected','manual_review','expired'))
		OR (OLD.`status` = 'rejected' AND NEW.`status` = 'manual_review')
		OR (OLD.`status` = 'manual_review' AND NEW.`status` IN ('verified','rejected','cancelled','expired'))
	) THEN RAISE(ABORT, 'identity_case_transition_invalid') END);
	SELECT (CASE WHEN NEW.`status` = 'verified' AND
		(NEW.`decision` IS NULL OR NEW.`evidence_reference` IS NULL OR NEW.`completed_at` IS NULL)
		THEN RAISE(ABORT, 'identity_verification_evidence_missing') END);
	SELECT (CASE WHEN NEW.`status` = 'rejected' AND (NEW.`decision` IS NULL OR NEW.`completed_at` IS NULL)
		THEN RAISE(ABORT, 'identity_rejection_evidence_missing') END);
END;
--> statement-breakpoint
CREATE TRIGGER `identity_case_terminal_guard_v21`
BEFORE UPDATE ON `identity_verification_cases`
WHEN OLD.`status` IN ('verified','expired','cancelled')
	AND (NEW.`status` IS NOT OLD.`status` OR NEW.`decision` IS NOT OLD.`decision`
		OR NEW.`checks` IS NOT OLD.`checks` OR NEW.`reason_codes` IS NOT OLD.`reason_codes`
		OR NEW.`evidence_reference` IS NOT OLD.`evidence_reference` OR NEW.`completed_at` IS NOT OLD.`completed_at`)
BEGIN
	SELECT RAISE(ABORT, 'identity_case_terminal');
END;
--> statement-breakpoint
CREATE TRIGGER `identity_case_no_delete_v21`
BEFORE DELETE ON `identity_verification_cases`
BEGIN
	SELECT RAISE(ABORT, 'identity_case_append_only');
END;
--> statement-breakpoint
CREATE TRIGGER `payment_order_parent_provenance_v21`
BEFORE INSERT ON `payment_orders`
BEGIN
	SELECT (CASE WHEN NEW.`amount_cents` <= 0 OR NEW.`currency` <> 'ZAR' OR NOT (
		(NEW.`environment` = 'demo' AND NEW.`integrity_state` = 'synthetic')
		OR (NEW.`environment` = 'production' AND NEW.`integrity_state` = 'production_verified')
	) OR NOT EXISTS (
		SELECT 1 FROM `bookings` booking JOIN `clients` client ON client.`id` = booking.`client_id`
		WHERE booking.`id` = NEW.`booking_id` AND client.`id` = NEW.`client_id`
			AND booking.`environment` = NEW.`environment` AND booking.`integrity_state` = NEW.`integrity_state`
			AND client.`environment` = NEW.`environment` AND client.`integrity_state` = NEW.`integrity_state`
	) OR NOT EXISTS (
		SELECT 1 FROM `integration_provider_configs` config WHERE config.`key` = NEW.`provider_key`
			AND config.`environment` = NEW.`environment` AND config.`integrity_state` = NEW.`integrity_state`
	) OR NEW.`status` NOT IN ('created','requires_action')
	THEN RAISE(ABORT, 'payment_order_parent_provenance_mismatch') END);
END;
--> statement-breakpoint
CREATE TRIGGER `payment_order_identity_immutable_v21`
BEFORE UPDATE OF `booking_id`,`client_id`,`provider_key`,`provider_reference`,`currency`,`amount_cents`,`idempotency_key`,`environment`,`integrity_state`,`created_at` ON `payment_orders`
WHEN NEW.`booking_id` IS NOT OLD.`booking_id` OR NEW.`client_id` IS NOT OLD.`client_id`
	OR NEW.`provider_key` IS NOT OLD.`provider_key`
	OR (OLD.`provider_reference` IS NOT NULL AND NEW.`provider_reference` IS NOT OLD.`provider_reference`)
	OR NEW.`currency` IS NOT OLD.`currency` OR NEW.`amount_cents` IS NOT OLD.`amount_cents`
	OR NEW.`idempotency_key` IS NOT OLD.`idempotency_key` OR NEW.`environment` IS NOT OLD.`environment`
	OR NEW.`integrity_state` IS NOT OLD.`integrity_state` OR NEW.`created_at` IS NOT OLD.`created_at`
BEGIN
	SELECT RAISE(ABORT, 'payment_order_identity_immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `payment_order_evidence_guard_v21`
BEFORE UPDATE OF `authorised_at`,`cleared_at`,`reconciled_at` ON `payment_orders`
WHEN (OLD.`authorised_at` IS NOT NULL AND NEW.`authorised_at` IS NOT OLD.`authorised_at`)
	OR (OLD.`cleared_at` IS NOT NULL AND NEW.`cleared_at` IS NOT OLD.`cleared_at`)
	OR (OLD.`reconciled_at` IS NOT NULL AND NEW.`reconciled_at` IS NOT OLD.`reconciled_at`)
	OR (NEW.`status` IN ('authorised','captured','cleared','reconciled') AND NEW.`authorised_at` IS NULL)
	OR (NEW.`status` IN ('cleared','reconciled') AND NEW.`cleared_at` IS NULL)
	OR (NEW.`status` = 'reconciled' AND NEW.`reconciled_at` IS NULL)
BEGIN
	SELECT RAISE(ABORT, 'payment_order_evidence_invalid');
END;
--> statement-breakpoint
CREATE TRIGGER `payment_order_transition_guard_v21`
BEFORE UPDATE OF `status` ON `payment_orders`
WHEN NEW.`status` IS NOT OLD.`status`
BEGIN
	SELECT (CASE WHEN NOT (
		(OLD.`status` = 'created' AND NEW.`status` IN ('requires_action','pending','cancelled'))
		OR (OLD.`status` = 'requires_action' AND NEW.`status` IN ('pending','cancelled','failed'))
		OR (OLD.`status` = 'pending' AND NEW.`status` IN ('authorised','failed','cancelled'))
		OR (OLD.`status` = 'authorised' AND NEW.`status` IN ('captured','cancelled','failed'))
		OR (OLD.`status` = 'captured' AND NEW.`status` IN ('cleared','refunded','disputed'))
		OR (OLD.`status` = 'cleared' AND NEW.`status` IN ('reconciled','refunded','disputed'))
		OR (OLD.`status` = 'reconciled' AND NEW.`status` IN ('refunded','disputed'))
	) THEN RAISE(ABORT, 'payment_order_transition_invalid') END);
	SELECT (CASE WHEN NEW.`status` = 'authorised' AND NEW.`authorised_at` IS NULL
		THEN RAISE(ABORT, 'payment_authorisation_evidence_missing') END);
	SELECT (CASE WHEN NEW.`status` = 'cleared' AND NEW.`cleared_at` IS NULL
		THEN RAISE(ABORT, 'payment_clearing_evidence_missing') END);
	SELECT (CASE WHEN NEW.`status` = 'reconciled' AND (NEW.`cleared_at` IS NULL OR NEW.`reconciled_at` IS NULL)
		THEN RAISE(ABORT, 'payment_reconciliation_evidence_missing') END);
END;
--> statement-breakpoint
CREATE TRIGGER `payment_order_terminal_guard_v21`
BEFORE UPDATE ON `payment_orders`
WHEN OLD.`status` IN ('failed','cancelled','refunded','disputed') AND NEW.`status` IS NOT OLD.`status`
BEGIN
	SELECT RAISE(ABORT, 'payment_order_terminal');
END;
--> statement-breakpoint
CREATE TRIGGER `payment_order_no_delete_v21`
BEFORE DELETE ON `payment_orders`
BEGIN
	SELECT RAISE(ABORT, 'payment_order_append_only');
END;
--> statement-breakpoint
CREATE TRIGGER `integration_operation_parent_provenance_v21`
BEFORE INSERT ON `integration_operations`
BEGIN
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `integration_provider_configs` config WHERE config.`key` = NEW.`provider_key`
			AND config.`capability` = NEW.`capability` AND config.`environment` = NEW.`environment`
			AND config.`integrity_state` = NEW.`integrity_state`
	) OR NEW.`entity_type` NOT IN ('officer_application','booking','service_request','identity_case','payment_order')
	OR (NEW.`entity_type` = 'officer_application' AND NOT EXISTS (
		SELECT 1 FROM `officer_applications` entity WHERE entity.`id` = NEW.`entity_id`
			AND entity.`environment` = NEW.`environment` AND entity.`integrity_state` = NEW.`integrity_state`
	)) OR (NEW.`entity_type` = 'booking' AND NOT EXISTS (
		SELECT 1 FROM `bookings` entity WHERE entity.`id` = NEW.`entity_id`
			AND entity.`environment` = NEW.`environment` AND entity.`integrity_state` = NEW.`integrity_state`
	)) OR (NEW.`entity_type` = 'service_request' AND NOT EXISTS (
		SELECT 1 FROM `service_requests` entity WHERE entity.`id` = NEW.`entity_id`
			AND entity.`environment` = NEW.`environment` AND entity.`integrity_state` = NEW.`integrity_state`
	)) OR (NEW.`entity_type` = 'identity_case' AND NOT EXISTS (
		SELECT 1 FROM `identity_verification_cases` entity WHERE entity.`id` = NEW.`entity_id`
			AND entity.`environment` = NEW.`environment` AND entity.`integrity_state` = NEW.`integrity_state`
	)) OR (NEW.`entity_type` = 'payment_order' AND NOT EXISTS (
		SELECT 1 FROM `payment_orders` entity WHERE entity.`id` = NEW.`entity_id`
			AND entity.`environment` = NEW.`environment` AND entity.`integrity_state` = NEW.`integrity_state`
	)) OR NEW.`state` NOT IN ('pending','awaiting_webhook')
	THEN RAISE(ABORT, 'integration_operation_provider_mismatch') END);
END;
--> statement-breakpoint
CREATE TRIGGER `integration_operation_identity_immutable_v21`
BEFORE UPDATE OF `provider_key`,`capability`,`operation_type`,`entity_type`,`entity_id`,`idempotency_key`,`request_hash`,`environment`,`integrity_state`,`created_at` ON `integration_operations`
WHEN NEW.`provider_key` IS NOT OLD.`provider_key` OR NEW.`capability` IS NOT OLD.`capability`
	OR NEW.`operation_type` IS NOT OLD.`operation_type` OR NEW.`entity_type` IS NOT OLD.`entity_type`
	OR NEW.`entity_id` IS NOT OLD.`entity_id` OR NEW.`idempotency_key` IS NOT OLD.`idempotency_key`
	OR NEW.`request_hash` IS NOT OLD.`request_hash` OR NEW.`environment` IS NOT OLD.`environment`
	OR NEW.`integrity_state` IS NOT OLD.`integrity_state` OR NEW.`created_at` IS NOT OLD.`created_at`
BEGIN
	SELECT RAISE(ABORT, 'integration_operation_identity_immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `integration_operation_transition_guard_v21`
BEFORE UPDATE OF `state` ON `integration_operations`
WHEN NEW.`state` IS NOT OLD.`state`
BEGIN
	SELECT (CASE WHEN NOT (
		(OLD.`state` = 'pending' AND NEW.`state` IN ('dispatching','cancelled'))
		OR (OLD.`state` = 'dispatching' AND NEW.`state` IN ('provider_accepted','awaiting_webhook','succeeded','retryable_failed','terminal_failed','cancelled'))
		OR (OLD.`state` = 'provider_accepted' AND NEW.`state` IN ('awaiting_webhook','succeeded','retryable_failed','terminal_failed'))
		OR (OLD.`state` = 'awaiting_webhook' AND NEW.`state` IN ('succeeded','retryable_failed','terminal_failed','cancelled'))
		OR (OLD.`state` = 'retryable_failed' AND NEW.`state` IN ('dispatching','terminal_failed','cancelled'))
	) THEN RAISE(ABORT, 'integration_operation_transition_invalid') END);
END;
--> statement-breakpoint
CREATE TRIGGER `webhook_inbox_parent_provenance_v21`
BEFORE INSERT ON `provider_webhook_inbox`
BEGIN
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `integration_provider_configs` config WHERE config.`key` = NEW.`provider_key`
			AND config.`environment` = NEW.`environment` AND config.`integrity_state` = NEW.`integrity_state`
	) OR (NEW.`operation_id` IS NOT NULL AND NOT EXISTS (
		SELECT 1 FROM `integration_operations` operation WHERE operation.`id` = NEW.`operation_id`
			AND operation.`provider_key` = NEW.`provider_key` AND operation.`environment` = NEW.`environment`
			AND operation.`integrity_state` = NEW.`integrity_state`
	)) OR NEW.`signature_state` NOT IN ('unverified','verified','sandbox_verified','rejected')
	OR NEW.`processing_state` NOT IN ('received','processing','processed','failed')
	OR (NEW.`environment` <> 'demo' AND NEW.`signature_state` = 'sandbox_verified')
	OR (NEW.`processing_state` = 'processed' AND NOT (
		NEW.`signature_state` = 'verified' OR
		(NEW.`environment` = 'demo' AND NEW.`integrity_state` = 'synthetic' AND NEW.`signature_state` = 'sandbox_verified')
	))
	THEN RAISE(ABORT, 'webhook_inbox_provenance_or_signature_invalid') END);
END;
--> statement-breakpoint
CREATE TRIGGER `webhook_inbox_identity_immutable_v21`
BEFORE UPDATE OF `provider_key`,`provider_event_id`,`event_type`,`raw_body_hash`,`operation_id`,`environment`,`integrity_state`,`received_at` ON `provider_webhook_inbox`
BEGIN
	SELECT RAISE(ABORT, 'webhook_inbox_identity_immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `webhook_inbox_state_guard_v21`
BEFORE UPDATE OF `signature_state`,`processing_state`,`attempts`,`processed_at`,`last_error_code` ON `provider_webhook_inbox`
BEGIN
	SELECT (CASE WHEN OLD.`processing_state` = 'processed' AND (
		NEW.`signature_state` IS NOT OLD.`signature_state` OR NEW.`processing_state` IS NOT OLD.`processing_state`
		OR NEW.`processed_at` IS NOT OLD.`processed_at` OR NEW.`last_error_code` IS NOT OLD.`last_error_code`
	) THEN RAISE(ABORT, 'webhook_inbox_processed_terminal') END);
	SELECT (CASE WHEN OLD.`signature_state` IN ('verified','sandbox_verified','rejected')
		AND NEW.`signature_state` IS NOT OLD.`signature_state`
		THEN RAISE(ABORT, 'webhook_signature_terminal') END);
	SELECT (CASE WHEN NEW.`processing_state` = 'processed' AND (
		NEW.`processed_at` IS NULL OR NOT (
			NEW.`signature_state` = 'verified' OR
			(NEW.`environment` = 'demo' AND NEW.`integrity_state` = 'synthetic' AND NEW.`signature_state` = 'sandbox_verified')
		)
	) THEN RAISE(ABORT, 'webhook_signature_required') END);
END;
--> statement-breakpoint
CREATE TRIGGER `webhook_inbox_no_delete_v21`
BEFORE DELETE ON `provider_webhook_inbox`
BEGIN
	SELECT RAISE(ABORT, 'webhook_inbox_append_only');
END;
--> statement-breakpoint
CREATE TRIGGER `outbox_identity_immutable_v21`
BEFORE UPDATE OF `aggregate_type`,`aggregate_id`,`event_type`,`payload_hash`,`payload_version`,`environment`,`integrity_state`,`created_at` ON `domain_outbox_events`
BEGIN
	SELECT RAISE(ABORT, 'outbox_identity_immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `outbox_parent_provenance_v21`
BEFORE INSERT ON `domain_outbox_events`
BEGIN
	SELECT (CASE WHEN NOT (
		(NEW.`environment` = 'demo' AND NEW.`integrity_state` = 'synthetic')
		OR (NEW.`environment` = 'prelaunch' AND NEW.`integrity_state` = 'user_submitted')
		OR (NEW.`environment` = 'production' AND NEW.`integrity_state` IN ('verified','production_verified'))
	) OR NEW.`aggregate_type` NOT IN ('officer_application','booking','service_request','identity_case','payment_order')
	OR (NEW.`aggregate_type` = 'officer_application' AND NOT EXISTS (
		SELECT 1 FROM `officer_applications` entity WHERE entity.`id` = NEW.`aggregate_id`
			AND entity.`environment` = NEW.`environment` AND entity.`integrity_state` = NEW.`integrity_state`
	)) OR (NEW.`aggregate_type` = 'booking' AND NOT EXISTS (
		SELECT 1 FROM `bookings` entity WHERE entity.`id` = NEW.`aggregate_id`
			AND entity.`environment` = NEW.`environment` AND entity.`integrity_state` = NEW.`integrity_state`
	)) OR (NEW.`aggregate_type` = 'service_request' AND NOT EXISTS (
		SELECT 1 FROM `service_requests` entity WHERE entity.`id` = NEW.`aggregate_id`
			AND entity.`environment` = NEW.`environment` AND entity.`integrity_state` = NEW.`integrity_state`
	)) OR (NEW.`aggregate_type` = 'identity_case' AND NOT EXISTS (
		SELECT 1 FROM `identity_verification_cases` entity WHERE entity.`id` = NEW.`aggregate_id`
			AND entity.`environment` = NEW.`environment` AND entity.`integrity_state` = NEW.`integrity_state`
	)) OR (NEW.`aggregate_type` = 'payment_order' AND NOT EXISTS (
		SELECT 1 FROM `payment_orders` entity WHERE entity.`id` = NEW.`aggregate_id`
			AND entity.`environment` = NEW.`environment` AND entity.`integrity_state` = NEW.`integrity_state`
	)) OR NEW.`status` <> 'pending'
	THEN RAISE(ABORT, 'outbox_parent_provenance_mismatch') END);
END;
--> statement-breakpoint
CREATE TRIGGER `outbox_transition_guard_v21`
BEFORE UPDATE OF `status` ON `domain_outbox_events`
WHEN NEW.`status` IS NOT OLD.`status`
BEGIN
	SELECT (CASE WHEN NOT (
		(OLD.`status` = 'pending' AND NEW.`status` IN ('dispatching','cancelled'))
		OR (OLD.`status` = 'dispatching' AND NEW.`status` IN ('dispatched','retryable_failed','dead_letter'))
		OR (OLD.`status` = 'retryable_failed' AND NEW.`status` IN ('pending','dead_letter'))
	) THEN RAISE(ABORT, 'outbox_transition_invalid') END);
END;
--> statement-breakpoint
CREATE TRIGGER `outbox_no_delete_v21`
BEFORE DELETE ON `domain_outbox_events`
BEGIN
	SELECT RAISE(ABORT, 'outbox_append_only');
END;
--> statement-breakpoint
CREATE TRIGGER `service_request_parent_provenance_v21`
BEFORE INSERT ON `service_requests`
BEGIN
	SELECT (CASE WHEN NOT (
		(NEW.`environment` = 'demo' AND NEW.`integrity_state` = 'synthetic')
		OR (NEW.`environment` = 'prelaunch' AND NEW.`integrity_state` = 'user_submitted')
		OR (NEW.`environment` = 'production' AND NEW.`integrity_state` IN ('verified','production_verified'))
	) OR (NEW.`client_id` IS NOT NULL AND NOT EXISTS (
		SELECT 1 FROM `clients` client WHERE client.`id` = NEW.`client_id`
			AND client.`environment` = NEW.`environment` AND client.`integrity_state` = NEW.`integrity_state`
	)) OR (NEW.`officer_id` IS NOT NULL AND NOT EXISTS (
		SELECT 1 FROM `officer_passports` passport WHERE passport.`officer_id` = NEW.`officer_id`
			AND passport.`environment` = NEW.`environment` AND passport.`integrity_state` = NEW.`integrity_state`
	)) OR (NEW.`booking_id` IS NOT NULL AND NOT EXISTS (
		SELECT 1 FROM `bookings` booking WHERE booking.`id` = NEW.`booking_id`
			AND booking.`environment` = NEW.`environment` AND booking.`integrity_state` = NEW.`integrity_state`
			AND (NEW.`client_id` IS NULL OR booking.`client_id` = NEW.`client_id`)
	)) OR (NEW.`shift_id` IS NOT NULL AND NOT EXISTS (
		SELECT 1 FROM `shifts` shift JOIN `bookings` booking ON booking.`id` = shift.`booking_id`
		WHERE shift.`id` = NEW.`shift_id` AND shift.`environment` = NEW.`environment`
			AND shift.`integrity_state` = NEW.`integrity_state`
			AND (NEW.`booking_id` IS NULL OR shift.`booking_id` = NEW.`booking_id`)
			AND (NEW.`client_id` IS NULL OR booking.`client_id` = NEW.`client_id`)
			AND (NEW.`officer_id` IS NULL OR shift.`officer_id` = NEW.`officer_id`)
	)) THEN RAISE(ABORT, 'service_request_parent_provenance_mismatch') END);
END;
--> statement-breakpoint
CREATE TRIGGER `service_request_identity_immutable_v21`
BEFORE UPDATE OF `client_id`,`officer_id`,`booking_id`,`shift_id`,`requested_by_role`,`requested_by_id`,`category`,`summary`,`environment`,`integrity_state`,`created_at` ON `service_requests`
BEGIN
	SELECT RAISE(ABORT, 'service_request_identity_immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `integration_provider_provenance_immutable_v21`
BEFORE UPDATE OF `capability`,`environment`,`integrity_state` ON `integration_provider_configs`
WHEN NEW.`capability` IS NOT OLD.`capability` OR NEW.`environment` IS NOT OLD.`environment`
	OR NEW.`integrity_state` IS NOT OLD.`integrity_state`
BEGIN
	SELECT RAISE(ABORT, 'integration_provider_provenance_immutable');
END;
