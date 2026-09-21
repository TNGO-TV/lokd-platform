CREATE TABLE `booking_provider_recovery_inbox` (
	`id` text PRIMARY KEY NOT NULL,
	`mode` text NOT NULL,
	`provider_id` text,
	`transaction_reference` text,
	`event` text NOT NULL,
	`payload_hash` text NOT NULL,
	`detail` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `booking_provider_recovery_hash_idx` ON `booking_provider_recovery_inbox` (`mode`,`payload_hash`);--> statement-breakpoint
CREATE INDEX `booking_provider_recovery_transaction_idx` ON `booking_provider_recovery_inbox` (`mode`,`provider_id`);--> statement-breakpoint
CREATE INDEX `booking_provider_recovery_reference_idx` ON `booking_provider_recovery_inbox` (`mode`,`transaction_reference`);--> statement-breakpoint
CREATE TRIGGER booking_recovery_inbox_link AFTER INSERT ON booking_provider_recovery_inbox BEGIN
 INSERT OR IGNORE INTO booking_collection_recoveries(id,reference,source,event,payload_hash,detail,actor_id,created_at)
 SELECT lower(hex(randomblob(16))),r.reference,'webhook',NEW.event,NEW.payload_hash,NEW.detail,NULL,NEW.created_at FROM booking_collection_requests r WHERE r.mode=NEW.mode AND (r.provider_id=NEW.provider_id OR r.reference=NEW.transaction_reference);
END;
--> statement-breakpoint
CREATE TRIGGER booking_recovery_late_transaction_link AFTER UPDATE OF provider_id ON booking_collection_requests WHEN NEW.provider_id IS NOT NULL AND OLD.provider_id IS NULL BEGIN
 INSERT OR IGNORE INTO booking_collection_recoveries(id,reference,source,event,payload_hash,detail,actor_id,created_at)
 SELECT lower(hex(randomblob(16))),NEW.reference,'webhook',h.event,h.payload_hash,h.detail,NULL,h.created_at FROM booking_provider_recovery_inbox h WHERE h.mode=NEW.mode AND (h.provider_id=NEW.provider_id OR h.transaction_reference=NEW.reference);
END;
--> statement-breakpoint
CREATE TRIGGER booking_recovery_inbox_no_update BEFORE UPDATE ON booking_provider_recovery_inbox BEGIN SELECT RAISE(ABORT,'Provider recovery inbox is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER booking_recovery_inbox_no_delete BEFORE DELETE ON booking_provider_recovery_inbox BEGIN SELECT RAISE(ABORT,'Provider recovery inbox is required'); END;
--> statement-breakpoint
CREATE TRIGGER booking_settlement_recovery_inbox_guard BEFORE INSERT ON booking_settlement_decisions WHEN NEW.decision IN ('cleared_live','confirmed_test') BEGIN
 SELECT (CASE WHEN EXISTS(SELECT 1 FROM booking_settlement_reviews s JOIN booking_provider_recovery_inbox h ON h.mode=s.mode AND (h.provider_id=s.provider_id OR h.transaction_reference=s.reference) WHERE s.id=NEW.review_id) THEN RAISE(ABORT,'Provider recovery evidence prevents settlement approval') END);
END;
