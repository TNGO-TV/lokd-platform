CREATE TABLE `provider_acceptance_tests` (
	`reference` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`email` text NOT NULL,
	`version` text NOT NULL,
	`scenario` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`state` text NOT NULL,
	`checkout_url` text,
	`provider_id` text,
	`provider_status` text,
	`webhook_hash` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`note` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "provider_acceptance_test_amount" CHECK("provider_acceptance_tests"."amount_minor"=100 AND "provider_acceptance_tests"."currency"='ZAR'),
	CONSTRAINT "provider_acceptance_scenario" CHECK("provider_acceptance_tests"."scenario" IN ('success','decline','cancel'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_acceptance_owner_scenario_idx` ON `provider_acceptance_tests` (`owner_user_id`,`version`,`scenario`);