CREATE TABLE `billing_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_type` text NOT NULL,
	`owner_id` text NOT NULL,
	`legal_name` text NOT NULL,
	`registration_number` text,
	`vat_number` text,
	`tax_status` text DEFAULT 'pending_configuration' NOT NULL,
	`billing_address` text NOT NULL,
	`billing_email` text NOT NULL,
	`payment_terms_days` integer DEFAULT 0 NOT NULL,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`active_key` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `billing_profiles_active_idx` ON `billing_profiles` (`active_key`);--> statement-breakpoint
CREATE INDEX `billing_profiles_owner_idx` ON `billing_profiles` (`owner_type`,`owner_id`,`version`);--> statement-breakpoint
CREATE TABLE `client_invoice_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`booking_id` text NOT NULL,
	`roster_slot_id` text,
	`timesheet_id` text,
	`description` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`net_cents` integer NOT NULL,
	`tax_cents` integer,
	`gross_cents` integer,
	`tax_code` text DEFAULT 'pending_configuration' NOT NULL,
	`tax_rate_basis_points` integer,
	`pricing_version` text NOT NULL,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `client_invoices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`roster_slot_id`) REFERENCES `roster_slots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`timesheet_id`) REFERENCES `shift_timesheets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `client_invoice_lines_invoice_idx` ON `client_invoice_lines` (`invoice_id`);--> statement-breakpoint
CREATE TABLE `client_invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`client_id` text NOT NULL,
	`issuer_billing_profile_id` text,
	`client_billing_profile_id` text,
	`artifact_id` text,
	`original_invoice_id` text,
	`document_type` text DEFAULT 'invoice' NOT NULL,
	`invoice_number` text,
	`currency` text DEFAULT 'ZAR' NOT NULL,
	`service_period_start` text NOT NULL,
	`service_period_end` text NOT NULL,
	`subtotal_cents` integer NOT NULL,
	`tax_cents` integer,
	`total_cents` integer,
	`balance_cents` integer,
	`tax_treatment` text DEFAULT 'pending_configuration' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`funding_status` text DEFAULT 'not_started' NOT NULL,
	`pricing_version` text NOT NULL,
	`issuer_snapshot` text,
	`client_snapshot` text,
	`issue_reference` text,
	`payment_reference` text,
	`due_at` text,
	`issued_at` text,
	`settled_at` text,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`issuer_billing_profile_id`) REFERENCES `billing_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_billing_profile_id`) REFERENCES `billing_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`artifact_id`) REFERENCES `document_artifacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `client_invoices_number_idx` ON `client_invoices` (`invoice_number`);--> statement-breakpoint
CREATE INDEX `client_invoices_booking_idx` ON `client_invoices` (`booking_id`,`status`);--> statement-breakpoint
CREATE INDEX `client_invoices_status_idx` ON `client_invoices` (`environment`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `client_invoices_client_idx` ON `client_invoices` (`client_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `disbursement_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`employer_id` text NOT NULL,
	`rail` text DEFAULT 'eft' NOT NULL,
	`currency` text DEFAULT 'ZAR' NOT NULL,
	`item_count` integer NOT NULL,
	`total_cents` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`provider_reference` text,
	`evidence_reference` text,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`created_by` text NOT NULL,
	`approved_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`settled_at` text,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`employer_id`) REFERENCES `workforce_employers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `disbursement_batches_status_idx` ON `disbursement_batches` (`environment`,`status`);--> statement-breakpoint
CREATE TABLE `disbursement_items` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`payroll_item_id` text,
	`partner_payable_id` text,
	`destination_token` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`provider_reference` text,
	`clearing_evidence_reference` text,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`settled_at` text,
	FOREIGN KEY (`batch_id`) REFERENCES `disbursement_batches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payroll_item_id`) REFERENCES `payroll_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `disbursement_items_payroll_idx` ON `disbursement_items` (`payroll_item_id`);--> statement-breakpoint
CREATE INDEX `disbursement_items_batch_idx` ON `disbursement_items` (`batch_id`,`status`);--> statement-breakpoint
CREATE TABLE `document_artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`storage_reference` text NOT NULL,
	`content_hash` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`retention_class` text NOT NULL,
	`access_class` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`created_at` text NOT NULL,
	`verified_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `document_artifacts_storage_idx` ON `document_artifacts` (`environment`,`storage_reference`);--> statement-breakpoint
CREATE INDEX `document_artifacts_kind_idx` ON `document_artifacts` (`environment`,`kind`,`status`);--> statement-breakpoint
CREATE TABLE `invoice_receipt_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`payment_order_id` text NOT NULL,
	`funding_reconciliation_id` text NOT NULL,
	`reverses_allocation_id` text,
	`amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'ZAR' NOT NULL,
	`status` text DEFAULT 'allocated' NOT NULL,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`allocated_at` text NOT NULL,
	`reversed_at` text,
	FOREIGN KEY (`invoice_id`) REFERENCES `client_invoices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payment_order_id`) REFERENCES `payment_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`funding_reconciliation_id`) REFERENCES `booking_funding_reconciliations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `invoice_allocations_invoice_idx` ON `invoice_receipt_allocations` (`invoice_id`,`status`);--> statement-breakpoint
CREATE INDEX `invoice_allocations_payment_idx` ON `invoice_receipt_allocations` (`payment_order_id`);--> statement-breakpoint
CREATE TABLE `partner_payables` (
	`id` text PRIMARY KEY NOT NULL,
	`timesheet_id` text NOT NULL,
	`employer_id` text NOT NULL,
	`service_agreement_version` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'ZAR' NOT NULL,
	`status` text DEFAULT 'approved' NOT NULL,
	`remittance_reference` text,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`timesheet_id`) REFERENCES `shift_timesheets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employer_id`) REFERENCES `workforce_employers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `partner_payables_timesheet_idx` ON `partner_payables` (`timesheet_id`);--> statement-breakpoint
CREATE INDEX `partner_payables_employer_idx` ON `partner_payables` (`employer_id`,`status`);--> statement-breakpoint
CREATE TABLE `pay_item_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`payroll_item_id` text NOT NULL,
	`line_type` text NOT NULL,
	`code` text NOT NULL,
	`description` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`quantity_minutes` integer,
	`rate_cents` integer,
	`rate_basis_points` integer,
	`statutory_code` text,
	`rule_version` text NOT NULL,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`payroll_item_id`) REFERENCES `payroll_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pay_item_lines_item_idx` ON `pay_item_lines` (`payroll_item_id`,`line_type`);--> statement-breakpoint
CREATE TABLE `pay_item_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`payroll_item_id` text NOT NULL,
	`timesheet_id` text NOT NULL,
	`timesheet_version` integer NOT NULL,
	`payable_minutes` integer NOT NULL,
	`gross_wage_cents` integer NOT NULL,
	`active_key` text,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`payroll_item_id`) REFERENCES `payroll_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`timesheet_id`) REFERENCES `shift_timesheets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pay_item_sources_active_idx` ON `pay_item_sources` (`active_key`);--> statement-breakpoint
CREATE INDEX `pay_item_sources_item_idx` ON `pay_item_sources` (`payroll_item_id`);--> statement-breakpoint
CREATE TABLE `payroll_items` (
	`id` text PRIMARY KEY NOT NULL,
	`payroll_run_id` text NOT NULL,
	`officer_id` text NOT NULL,
	`payroll_profile_id` text,
	`workforce_engagement_id` text NOT NULL,
	`employer_id` text NOT NULL,
	`workforce_model` text NOT NULL,
	`gross_wage_cents` integer NOT NULL,
	`employee_deduction_cents` integer,
	`net_pay_cents` integer,
	`employer_cost_cents` integer,
	`status` text DEFAULT 'awaiting_backend_calculation' NOT NULL,
	`policy_version` text,
	`payslip_reference` text,
	`settlement_reference` text,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`payroll_run_id`) REFERENCES `payroll_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`officer_id`) REFERENCES `officers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payroll_profile_id`) REFERENCES `payroll_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workforce_engagement_id`) REFERENCES `workforce_engagements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employer_id`) REFERENCES `workforce_employers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payroll_items_run_officer_idx` ON `payroll_items` (`payroll_run_id`,`officer_id`);--> statement-breakpoint
CREATE INDEX `payroll_items_run_idx` ON `payroll_items` (`payroll_run_id`);--> statement-breakpoint
CREATE INDEX `payroll_items_officer_idx` ON `payroll_items` (`officer_id`,`status`);--> statement-breakpoint
CREATE TABLE `payroll_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`officer_id` text NOT NULL,
	`workforce_engagement_id` text NOT NULL,
	`employer_id` text NOT NULL,
	`tax_reference_token` text,
	`uif_reference_token` text,
	`provident_reference_token` text,
	`payment_destination_token` text,
	`status` text DEFAULT 'pending_verification' NOT NULL,
	`evidence_reference` text,
	`evidence_verified_at` text,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`active_key` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`officer_id`) REFERENCES `officers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workforce_engagement_id`) REFERENCES `workforce_engagements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employer_id`) REFERENCES `workforce_employers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payroll_profiles_active_idx` ON `payroll_profiles` (`active_key`);--> statement-breakpoint
CREATE INDEX `payroll_profiles_officer_idx` ON `payroll_profiles` (`officer_id`,`status`);--> statement-breakpoint
CREATE TABLE `payroll_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_key` text NOT NULL,
	`employer_id` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`pay_date` text NOT NULL,
	`run_type` text DEFAULT 'regular' NOT NULL,
	`currency` text DEFAULT 'ZAR' NOT NULL,
	`status` text DEFAULT 'awaiting_backend_calculation' NOT NULL,
	`gross_cents` integer NOT NULL,
	`employee_deduction_cents` integer,
	`net_pay_cents` integer,
	`employer_cost_cents` integer,
	`item_count` integer NOT NULL,
	`policy_version` text,
	`calculation_version` text,
	`export_reference` text,
	`payslip_bundle_reference` text,
	`settlement_reference` text,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`created_by` text NOT NULL,
	`approved_by` text,
	`second_approved_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`approved_at` text,
	`exported_at` text,
	`settled_at` text,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`employer_id`) REFERENCES `workforce_employers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payroll_runs_batch_idx` ON `payroll_runs` (`environment`,`integrity_state`,`batch_key`);--> statement-breakpoint
CREATE INDEX `payroll_runs_period_idx` ON `payroll_runs` (`environment`,`status`,`period_start`,`period_end`);--> statement-breakpoint
CREATE TABLE `payslips` (
	`id` text PRIMARY KEY NOT NULL,
	`payroll_item_id` text NOT NULL,
	`artifact_id` text NOT NULL,
	`document_version` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'generated' NOT NULL,
	`supersedes_id` text,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`generated_at` text NOT NULL,
	`issued_at` text,
	FOREIGN KEY (`payroll_item_id`) REFERENCES `payroll_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`artifact_id`) REFERENCES `document_artifacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payslips_item_version_idx` ON `payslips` (`payroll_item_id`,`document_version`);--> statement-breakpoint
CREATE INDEX `payslips_issue_idx` ON `payslips` (`environment`,`status`);--> statement-breakpoint
CREATE TABLE `shift_timesheets` (
	`id` text PRIMARY KEY NOT NULL,
	`shift_id` text NOT NULL,
	`booking_id` text NOT NULL,
	`roster_assignment_id` text,
	`activation_snapshot_id` text,
	`officer_id` text NOT NULL,
	`workforce_engagement_id` text,
	`employer_id` text,
	`workforce_model` text,
	`service_date` text NOT NULL,
	`scheduled_starts_at` text NOT NULL,
	`scheduled_ends_at` text NOT NULL,
	`check_in_at` text,
	`check_out_at` text,
	`scheduled_minutes` integer NOT NULL,
	`recorded_minutes` integer NOT NULL,
	`payable_minutes` integer,
	`gross_wage_cents` integer NOT NULL,
	`calendar_category` text NOT NULL,
	`policy_version` text NOT NULL,
	`client_evidence_status` text DEFAULT 'pending' NOT NULL,
	`operations_status` text DEFAULT 'awaiting_review' NOT NULL,
	`evidence_reference` text,
	`evidence_hash` text,
	`exception_reason` text,
	`supersedes_id` text,
	`active_key` text,
	`approved_by` text,
	`approved_at` text,
	`submitted_at` text NOT NULL,
	`locked_at` text,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`roster_assignment_id`) REFERENCES `roster_assignments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`activation_snapshot_id`) REFERENCES `assignment_activation_snapshots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`officer_id`) REFERENCES `officers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workforce_engagement_id`) REFERENCES `workforce_engagements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employer_id`) REFERENCES `workforce_employers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shift_timesheets_active_idx` ON `shift_timesheets` (`active_key`);--> statement-breakpoint
CREATE INDEX `shift_timesheets_shift_idx` ON `shift_timesheets` (`shift_id`,`version`);--> statement-breakpoint
CREATE INDEX `shift_timesheets_review_idx` ON `shift_timesheets` (`environment`,`operations_status`,`service_date`);--> statement-breakpoint
CREATE INDEX `shift_timesheets_officer_idx` ON `shift_timesheets` (`officer_id`,`service_date`);--> statement-breakpoint
ALTER TABLE `domain_outbox_events` ADD `payload_json` text;--> statement-breakpoint
ALTER TABLE `domain_outbox_events` ADD `payload_artifact_id` text REFERENCES document_artifacts(id);--> statement-breakpoint
ALTER TABLE `domain_outbox_events` ADD `correlation_key` text;--> statement-breakpoint
ALTER TABLE `domain_outbox_events` ADD `idempotency_key` text;--> statement-breakpoint
ALTER TABLE `domain_outbox_events` ADD `next_attempt_at` text;--> statement-breakpoint
ALTER TABLE `domain_outbox_events` ADD `lease_owner` text;--> statement-breakpoint
ALTER TABLE `domain_outbox_events` ADD `lease_expires_at` text;--> statement-breakpoint
ALTER TABLE `domain_outbox_events` ADD `dead_lettered_at` text;--> statement-breakpoint
ALTER TABLE `provider_webhook_inbox` ADD `raw_body_artifact_id` text REFERENCES document_artifacts(id);--> statement-breakpoint
ALTER TABLE `provider_webhook_inbox` ADD `payload_schema` text DEFAULT 'provider-event-v1' NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_webhook_inbox` ADD `correlation_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `roster_slots_booking_post_date_position_idx` ON `roster_slots` (`booking_id`,`post_id`,`service_date`,`position_index`);
