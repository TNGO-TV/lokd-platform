CREATE TABLE `production_order_setups` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`case_version` integer NOT NULL,
	`request_hash` text NOT NULL,
	`request_json` text NOT NULL,
	`quote_json` text NOT NULL,
	`prepared_by` text NOT NULL,
	`prepared_at` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE TRIGGER production_order_setup_immutable BEFORE UPDATE ON production_order_setups BEGIN SELECT RAISE(ABORT,'Prepared service order is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER production_order_setup_no_delete BEFORE DELETE ON production_order_setups BEGIN SELECT RAISE(ABORT,'Service order evidence is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER production_order_client_guard BEFORE INSERT ON production_order_setups WHEN NOT EXISTS(
 SELECT 1 FROM clients x JOIN production_entity_links l ON l.kind='client' AND l.entity_id=x.id AND l.case_version=NEW.case_version
 JOIN signup_cases c ON c.kind=l.kind AND c.source_id=l.case_id AND c.version=l.case_version AND c.owner_user_id=l.owner_user_id AND c.status='reviewed'
 JOIN production_client_reviews r ON r.client_id=x.id AND r.case_version=l.case_version JOIN production_client_decisions d ON d.review_id=r.id AND d.decision='approve'
 WHERE x.id=NEW.client_id AND x.environment='production' AND x.integrity_state='production_verified' AND x.approval_status='approved' AND l.owner_user_id!=NEW.prepared_by AND r.expires_at>NEW.prepared_at
 AND NOT EXISTS(SELECT 1 FROM production_client_suspensions s WHERE s.client_id=x.id AND s.created_at>=r.prepared_at))
BEGIN SELECT RAISE(ABORT,'Service order requires current independent client approval'); END;
--> statement-breakpoint
CREATE TRIGGER production_order_roster_guard BEFORE INSERT ON roster_slots WHEN EXISTS(SELECT 1 FROM production_order_setups p WHERE p.id=NEW.booking_id)
AND NOT EXISTS(SELECT 1 FROM production_order_setups p JOIN clients x ON x.id=p.client_id AND x.approval_status='approved' JOIN production_entity_links l ON l.kind='client' AND l.entity_id=x.id AND l.case_version=p.case_version JOIN signup_cases c ON c.kind=l.kind AND c.source_id=l.case_id AND c.version=l.case_version AND c.status='reviewed' JOIN production_client_reviews r ON r.client_id=x.id AND r.case_version=l.case_version JOIN production_client_decisions d ON d.review_id=r.id AND d.decision='approve' WHERE p.id=NEW.booking_id AND r.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now') AND NOT EXISTS(SELECT 1 FROM production_client_suspensions s WHERE s.client_id=x.id AND s.created_at>=r.prepared_at))
BEGIN SELECT RAISE(ABORT,'Client approval changed before roster preparation'); END;
