CREATE TABLE `paystack_test_deliveries` (
	`payload_hash` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`provider_id` text,
	`reference` text,
	`provider_status` text,
	`amount_minor` integer,
	`currency` text,
	`received_at` text NOT NULL
);
