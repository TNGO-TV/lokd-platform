CREATE TABLE `payment_destination_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL,
	`decision` text NOT NULL,
	`operator_id` text NOT NULL,
	`user_id` text NOT NULL,
	`payload_hash` text NOT NULL,
	`provider_hash` text,
	`note` text NOT NULL,
	`auth_method` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`review_id`) REFERENCES `payment_destination_reviews`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `destination_decision_idx` ON `payment_destination_decisions` (`review_id`);--> statement-breakpoint
CREATE TABLE `payment_destination_holds` (
	`id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL,
	`operator_id` text NOT NULL,
	`user_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`review_id`) REFERENCES `payment_destination_reviews`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `destination_hold_idx` ON `payment_destination_holds` (`review_id`);--> statement-breakpoint
CREATE TABLE `payment_destination_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`officer_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`mode` text NOT NULL,
	`revision` integer NOT NULL,
	`request_key` text NOT NULL,
	`request_hash` text NOT NULL,
	`payload_json` text NOT NULL,
	`payload_hash` text NOT NULL,
	`prepared_by` text NOT NULL,
	`prepared_user` text NOT NULL,
	`prepared_at` text NOT NULL,
	`review_until` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`officer_id`) REFERENCES `officers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`profile_id`) REFERENCES `payroll_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `destination_request_idx` ON `payment_destination_reviews` (`request_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `destination_revision_idx` ON `payment_destination_reviews` (`officer_id`,`mode`,`revision`);--> statement-breakpoint
CREATE VIEW payment_destination_sources AS
SELECT p.id AS profile_id,p.officer_id,l.owner_user_id,
 json_object('profileId',p.id,'profileVersion',p.version,'officerId',p.officer_id,'engagementId',w.id,'engagementVersion',w.version,'employerId',e.id,'employerVersion',e.version,'caseId',l.case_id,'caseVersion',l.case_version,'ownerUser',l.owner_user_id,'profileReview',r.id,'profileHash',r.payload_hash,'expiresAt',min(r.expires_at,w.review_due_at,e.review_due_at)) AS source_json
FROM payroll_profiles p
JOIN production_evidence_reviews r ON p.evidence_reference='review:'||r.id AND r.state='approved'
JOIN workforce_engagements w ON w.id=p.workforce_engagement_id AND w.officer_id=p.officer_id AND w.employer_id=p.employer_id
JOIN workforce_employers e ON e.id=w.employer_id
JOIN production_entity_links l ON l.kind='officer' AND l.entity_id=p.officer_id
JOIN signup_cases c ON c.kind=l.kind AND c.source_id=l.case_id AND c.version=l.case_version AND c.owner_user_id=l.owner_user_id AND c.status='reviewed'
WHERE p.environment='production' AND p.integrity_state='production_verified' AND p.status='calculation_ready' AND p.active_key=p.officer_id
AND w.environment='production' AND w.status='active' AND w.active_key=w.officer_id AND w.model IN ('direct_flex','managed')
AND e.environment='production' AND e.employer_type='lokd_employer' AND e.status='current'
AND min(r.expires_at,w.review_due_at,e.review_due_at)>strftime('%Y-%m-%dT%H:%M:%fZ','now');
--> statement-breakpoint
CREATE VIEW payment_destination_current AS
SELECT r.*,
 CASE WHEN h.id IS NOT NULL THEN 'held'
 WHEN EXISTS(SELECT 1 FROM payment_destination_reviews newer JOIN payment_destination_decisions nd ON nd.review_id=newer.id AND nd.decision IN ('verified_live','confirmed_test') WHERE newer.officer_id=r.officer_id AND newer.mode=r.mode AND newer.revision>r.revision) THEN 'superseded'
 WHEN d.decision='rejected' THEN 'rejected'
 WHEN NOT EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=r.prepared_by AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active' AND g.role='payroll_preparer') OR (d.id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=d.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active' AND g.role='payroll_reviewer')) THEN 'authority_changed'
 WHEN s.profile_id IS NULL OR s.source_json!=json_extract(r.payload_json,'$.sourceJson') THEN 'source_changed'
 WHEN r.expires_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now') OR r.review_until<=strftime('%Y-%m-%dT%H:%M:%fZ','now') THEN 'expired'
 ELSE coalesce(d.decision,'pending') END AS status,
 d.operator_id AS reviewed_by,h.reason AS hold_reason
FROM payment_destination_reviews r
LEFT JOIN payment_destination_sources s ON s.profile_id=r.profile_id
LEFT JOIN payment_destination_decisions d ON d.review_id=r.id
LEFT JOIN payment_destination_holds h ON h.review_id=r.id;
--> statement-breakpoint
CREATE TRIGGER destination_review_insert BEFORE INSERT ON payment_destination_reviews BEGIN
 SELECT (CASE WHEN NEW.mode NOT IN ('test','live') OR NEW.revision<1 OR NOT json_valid(NEW.payload_json)
 OR NEW.review_until>strftime('%Y-%m-%dT%H:%M:%fZ','now','+31 minutes') OR NEW.review_until<=strftime('%Y-%m-%dT%H:%M:%fZ','now')
 OR NEW.expires_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now')
 OR NOT EXISTS(SELECT 1 FROM payment_destination_sources s WHERE s.profile_id=NEW.profile_id AND s.officer_id=NEW.officer_id AND s.source_json=json_extract(NEW.payload_json,'$.sourceJson') AND s.owner_user_id!=NEW.prepared_user AND NEW.expires_at<=json_extract(s.source_json,'$.expiresAt'))
 OR NOT EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=NEW.prepared_by AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active' AND g.role='payroll_preparer')
 THEN RAISE(ABORT,'Destination source or preparer changed') END);
END;
--> statement-breakpoint
CREATE TRIGGER destination_decision_insert BEFORE INSERT ON payment_destination_decisions BEGIN
 SELECT (CASE WHEN NEW.decision NOT IN ('verified_live','confirmed_test','rejected')
 OR NOT EXISTS(SELECT 1 FROM payment_destination_reviews r WHERE r.id=NEW.review_id AND r.payload_hash=NEW.payload_hash AND r.prepared_by!=NEW.operator_id AND r.prepared_user!=NEW.user_id AND json_extract(json_extract(r.payload_json,'$.sourceJson'),'$.ownerUser')!=NEW.user_id)
 OR NOT EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=NEW.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active' AND g.role='payroll_reviewer')
 THEN RAISE(ABORT,'Independent destination reviewer required') END);
 SELECT (CASE WHEN NEW.decision!='rejected' AND NOT EXISTS(
 SELECT 1 FROM payment_destination_current r WHERE r.id=NEW.review_id AND r.status='pending'
 AND NEW.decision=CASE r.mode WHEN 'live' THEN 'verified_live' ELSE 'confirmed_test' END
 AND NEW.provider_hash=json_extract(r.payload_json,'$.providerHash')
 AND NOT EXISTS(SELECT 1 FROM payment_destination_reviews other JOIN payment_destination_decisions od ON od.review_id=other.id AND od.decision IN ('verified_live','confirmed_test') WHERE other.mode=r.mode AND other.officer_id!=r.officer_id AND (json_extract(other.payload_json,'$.provider.accountHash')=json_extract(r.payload_json,'$.provider.accountHash') OR (json_extract(other.payload_json,'$.provider.integration')=json_extract(r.payload_json,'$.provider.integration') AND json_extract(other.payload_json,'$.provider.code')=json_extract(r.payload_json,'$.provider.code'))))
 AND NOT EXISTS(SELECT 1 FROM payment_destination_reviews newer JOIN payment_destination_decisions nd ON nd.review_id=newer.id AND nd.decision IN ('verified_live','confirmed_test') WHERE newer.officer_id=r.officer_id AND newer.mode=r.mode AND newer.revision>r.revision)
 AND coalesce(json_extract(r.payload_json,'$.supersedesId'),'')=coalesce((SELECT prev.id FROM payment_destination_reviews prev JOIN payment_destination_decisions pd ON pd.review_id=prev.id AND pd.decision IN ('verified_live','confirmed_test') WHERE prev.officer_id=r.officer_id AND prev.mode=r.mode ORDER BY prev.revision DESC LIMIT 1),'')
 AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=r.prepared_by AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active' AND g.role='payroll_preparer')
 ) THEN RAISE(ABORT,'Destination source, hold, expiry or replacement changed') END);
END;
--> statement-breakpoint
CREATE TRIGGER destination_hold_insert BEFORE INSERT ON payment_destination_holds BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=NEW.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active' AND g.role IN ('payroll_preparer','payroll_reviewer')) THEN RAISE(ABORT,'Destination review authority required') END);
END;

--> statement-breakpoint
CREATE TRIGGER payment_destination_reviews_update BEFORE UPDATE ON payment_destination_reviews BEGIN SELECT RAISE(ABORT,'Destination history is immutable'); END;

--> statement-breakpoint
CREATE TRIGGER payment_destination_reviews_delete BEFORE DELETE ON payment_destination_reviews BEGIN SELECT RAISE(ABORT,'Destination history is immutable'); END;

--> statement-breakpoint
CREATE TRIGGER payment_destination_decisions_update BEFORE UPDATE ON payment_destination_decisions BEGIN SELECT RAISE(ABORT,'Destination history is immutable'); END;

--> statement-breakpoint
CREATE TRIGGER payment_destination_decisions_delete BEFORE DELETE ON payment_destination_decisions BEGIN SELECT RAISE(ABORT,'Destination history is immutable'); END;

--> statement-breakpoint
CREATE TRIGGER payment_destination_holds_update BEFORE UPDATE ON payment_destination_holds BEGIN SELECT RAISE(ABORT,'Destination history is immutable'); END;

--> statement-breakpoint
CREATE TRIGGER payment_destination_holds_delete BEFORE DELETE ON payment_destination_holds BEGIN SELECT RAISE(ABORT,'Destination history is immutable'); END;
