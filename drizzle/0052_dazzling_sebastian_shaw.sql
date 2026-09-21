CREATE TABLE `booking_collection_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`source` text NOT NULL,
	`event` text NOT NULL,
	`payload_hash` text NOT NULL,
	`transaction_json` text NOT NULL,
	`actor_id` text,
	`recorded_at` text NOT NULL,
	FOREIGN KEY (`reference`) REFERENCES `booking_collection_requests`(`reference`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `booking_collection_evidence_reference_idx` ON `booking_collection_evidence` (`reference`,`source`);--> statement-breakpoint
CREATE UNIQUE INDEX `booking_collection_evidence_delivery_idx` ON `booking_collection_evidence` (`reference`,`source`,`payload_hash`);--> statement-breakpoint
CREATE TABLE `booking_collection_requests` (
	`reference` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`client_id` text NOT NULL,
	`applicant_id` text NOT NULL,
	`case_id` text NOT NULL,
	`case_version` integer NOT NULL,
	`source_hash` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`mode` text NOT NULL,
	`state` text NOT NULL,
	`provider_id` text,
	`checkout_url` text,
	`prepared_by` text NOT NULL,
	`approved_by` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `booking_collection_order_mode_idx` ON `booking_collection_requests` (`order_id`,`mode`);--> statement-breakpoint
CREATE UNIQUE INDEX `booking_collection_transaction_idx` ON `booking_collection_requests` (`mode`,`provider_id`);
--> statement-breakpoint
CREATE TRIGGER booking_collection_insert_guard BEFORE INSERT ON booking_collection_requests BEGIN
 SELECT (CASE WHEN NEW.mode NOT IN ('test','live') OR NEW.currency<>'ZAR' OR NEW.state<>'prepared' OR NEW.revision<>1 OR NEW.amount_minor<=0 OR NEW.approved_by IS NOT NULL OR NEW.provider_id IS NOT NULL OR NEW.checkout_url IS NOT NULL THEN RAISE(ABORT,'Invalid collection preparation') END);
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM production_order_setups p JOIN bookings b ON b.id=p.id JOIN production_entity_links l ON l.kind='client' AND l.entity_id=p.client_id JOIN current_production_client_approvals a ON a.client_id=p.client_id WHERE p.id=NEW.order_id AND p.client_id=NEW.client_id AND p.case_version=NEW.case_version AND p.request_hash=NEW.source_hash AND l.owner_user_id=NEW.applicant_id AND l.case_id=NEW.case_id AND l.case_version=NEW.case_version AND b.client_price_cents=NEW.amount_minor AND b.environment='production' AND b.integrity_state='production_verified' AND b.funding_status='unfunded' AND b.status='draft') THEN RAISE(ABORT,'Collection source changed') END);
END;
--> statement-breakpoint
CREATE TRIGGER booking_collection_update_guard BEFORE UPDATE ON booking_collection_requests BEGIN
 SELECT (CASE WHEN NEW.reference IS NOT OLD.reference OR NEW.order_id IS NOT OLD.order_id OR NEW.client_id IS NOT OLD.client_id OR NEW.applicant_id IS NOT OLD.applicant_id OR NEW.case_id IS NOT OLD.case_id OR NEW.case_version IS NOT OLD.case_version OR NEW.source_hash IS NOT OLD.source_hash OR NEW.amount_minor IS NOT OLD.amount_minor OR NEW.currency IS NOT OLD.currency OR NEW.mode IS NOT OLD.mode OR NEW.prepared_by IS NOT OLD.prepared_by OR NEW.created_at IS NOT OLD.created_at OR NEW.revision<>OLD.revision+1 OR (OLD.provider_id IS NOT NULL AND NEW.provider_id IS NOT OLD.provider_id) OR (OLD.approved_by IS NOT NULL AND NEW.approved_by IS NOT OLD.approved_by) THEN RAISE(ABORT,'Collection binding and history are immutable') END);
 SELECT (CASE WHEN NEW.state NOT IN ('approved','initializing','initialization_unknown','awaiting_checkout','review_required','reversed','failed','abandoned','pending','awaiting_webhook','matched_test','matched_live_unsettled') OR (NEW.state='approved' AND (OLD.state<>'prepared' OR NEW.approved_by IS NULL OR NEW.approved_by=OLD.prepared_by)) OR (NEW.state='initializing' AND (OLD.state<>'approved' OR OLD.approved_by IS NULL)) OR (NEW.state IN ('initialization_unknown','awaiting_checkout') AND OLD.state<>'initializing') OR (NEW.state='matched_test' AND NEW.mode<>'test') OR (NEW.state='matched_live_unsettled' AND NEW.mode<>'live') THEN RAISE(ABORT,'Invalid collection transition') END);
 SELECT (CASE WHEN NEW.state IN ('approved','initializing','matched_test','matched_live_unsettled') AND NOT EXISTS(SELECT 1 FROM production_order_setups p JOIN bookings b ON b.id=p.id JOIN production_entity_links l ON l.kind='client' AND l.entity_id=p.client_id JOIN current_production_client_approvals a ON a.client_id=p.client_id WHERE p.id=NEW.order_id AND p.client_id=NEW.client_id AND p.case_version=NEW.case_version AND p.request_hash=NEW.source_hash AND l.owner_user_id=NEW.applicant_id AND l.case_id=NEW.case_id AND l.case_version=NEW.case_version AND b.client_price_cents=NEW.amount_minor AND b.environment='production' AND b.integrity_state='production_verified' AND b.funding_status='unfunded' AND b.status='draft') THEN RAISE(ABORT,'Collection source changed') END);
END;
--> statement-breakpoint
CREATE TRIGGER booking_collection_no_delete BEFORE DELETE ON booking_collection_requests BEGIN SELECT RAISE(ABORT,'Collection history is required'); END;
--> statement-breakpoint
CREATE TRIGGER booking_collection_evidence_guard BEFORE INSERT ON booking_collection_evidence BEGIN
 SELECT (CASE WHEN NEW.source NOT IN ('api','webhook') OR (NEW.source='api' AND NOT EXISTS(SELECT 1 FROM booking_collection_requests r WHERE r.reference=NEW.reference AND r.revision=json_extract(NEW.transaction_json,'$.expectedRevision'))) THEN RAISE(ABORT,'Collection changed during provider verification') END);
END;
--> statement-breakpoint
CREATE TRIGGER booking_collection_webhook_invalidates AFTER INSERT ON booking_collection_evidence WHEN NEW.source='webhook' BEGIN
 UPDATE booking_collection_requests SET state='review_required',revision=revision+1,updated_at=NEW.recorded_at WHERE reference=NEW.reference;
END;
--> statement-breakpoint
CREATE TRIGGER booking_collection_evidence_no_update BEFORE UPDATE ON booking_collection_evidence BEGIN SELECT RAISE(ABORT,'Collection evidence is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER booking_collection_evidence_no_delete BEFORE DELETE ON booking_collection_evidence BEGIN SELECT RAISE(ABORT,'Collection evidence is required'); END;
--> statement-breakpoint
CREATE TRIGGER booking_collection_dispatch_authority BEFORE UPDATE ON booking_collection_requests WHEN NEW.state='initializing' BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments r ON r.operator_id=a.id WHERE a.id=NEW.approved_by AND a.status='active' AND a.environment='production' AND a.integrity_state='production_verified' AND a.approval_limit_cents>=NEW.amount_minor AND r.role='funding_reconciler' AND r.status='active' AND r.environment='production' AND r.integrity_state='production_verified') THEN RAISE(ABORT,'Collection approver authority changed') END);
END;
--> statement-breakpoint
CREATE TRIGGER booking_collection_audit AFTER UPDATE ON booking_collection_requests BEGIN
 INSERT INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at) VALUES(lower(hex(randomblob(16))),'system','collection-state-guard','booking_collection_transition','booking_collection',NEW.reference,json_object('from',OLD.state,'to',NEW.state,'revision',NEW.revision,'preparedBy',NEW.prepared_by,'approvedBy',NEW.approved_by,'mode',NEW.mode,'funded',0),NEW.updated_at);
END;
