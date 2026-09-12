CREATE TABLE `public_officer_presence` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`officer_id` text,
	`mode` text NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`consented_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `public_presence_user_mode_idx` ON `public_officer_presence` (`user_id`,`mode`);