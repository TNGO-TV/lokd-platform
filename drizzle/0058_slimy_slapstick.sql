CREATE TABLE `partner_destination_decisions` (
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
	FOREIGN KEY (`review_id`) REFERENCES `partner_destination_reviews`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `partner_destination_decision_idx` ON `partner_destination_decisions` (`review_id`);--> statement-breakpoint
CREATE TABLE `partner_destination_holds` (
	`id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL,
	`operator_id` text NOT NULL,
	`user_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`review_id`) REFERENCES `partner_destination_reviews`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `partner_destination_hold_idx` ON `partner_destination_holds` (`review_id`);--> statement-breakpoint
CREATE TABLE `partner_destination_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`employer_id` text NOT NULL,
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
	FOREIGN KEY (`employer_id`) REFERENCES `workforce_employers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `partner_destination_request_idx` ON `partner_destination_reviews` (`request_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `partner_destination_revision_idx` ON `partner_destination_reviews` (`employer_id`,`mode`,`revision`);
--> statement-breakpoint
CREATE VIEW partner_destination_sources AS
SELECT e.id AS employer_id,
 json_object('employerId',e.id,'employerName',e.legal_name,'employerVersion',e.version,'expiresAt',min(e.review_due_at,(SELECT min(ec.expires_at) FROM employer_compliance_evidence ec WHERE ec.employer_id=e.id AND ec.active_key=e.id||':'||ec.control_code)),
 'complianceJson',(SELECT json_group_array(json_object('id',c.id,'control',c.control_code,'reference',c.evidence_reference,'version',c.version,'expiresAt',c.expires_at)) FROM (SELECT * FROM employer_compliance_evidence ec WHERE ec.employer_id=e.id AND ec.active_key=e.id||':'||ec.control_code ORDER BY ec.control_code) c)) AS source_json
FROM workforce_employers e
WHERE e.environment='production' AND e.employer_type='partner_company' AND e.status='current'
AND e.review_due_at>strftime('%Y-%m-%dT%H:%M:%fZ','now')
AND e.psira_status='current' AND e.nbcpss_status='current' AND e.psspf_status='current' AND e.uif_status='current' AND e.coida_status='current' AND e.insurance_status='current' AND e.service_agreement_status='current'
AND (SELECT count(DISTINCT ec.control_code) FROM employer_compliance_evidence ec WHERE ec.employer_id=e.id AND ec.control_code IN ('psira','nbcpss','psspf','uif','coida','insurance','service_agreement') AND ec.active_key=e.id||':'||ec.control_code AND ec.environment='production' AND ec.integrity_state='verified' AND ec.status='current' AND ec.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now'))=7;
--> statement-breakpoint
CREATE VIEW partner_destination_current AS
SELECT r.*,
 CASE WHEN h.id IS NOT NULL THEN 'held'
 WHEN EXISTS(SELECT 1 FROM partner_destination_reviews newer JOIN partner_destination_decisions nd ON nd.review_id=newer.id AND nd.decision IN ('verified_live','confirmed_test') WHERE newer.employer_id=r.employer_id AND newer.mode=r.mode AND newer.revision>r.revision) THEN 'superseded'
 WHEN d.decision='rejected' THEN 'rejected'
 WHEN NOT EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=r.prepared_by AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active' AND g.role='operations_controller') OR (d.id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=d.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active' AND g.role='finance_approver')) THEN 'authority_changed'
 WHEN s.employer_id IS NULL OR s.source_json!=json_extract(r.payload_json,'$.sourceJson') THEN 'source_changed'
 WHEN r.expires_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now') OR r.review_until<=strftime('%Y-%m-%dT%H:%M:%fZ','now') THEN 'expired'
 ELSE coalesce(d.decision,'pending') END AS status,
 d.operator_id AS reviewed_by,h.reason AS hold_reason
FROM partner_destination_reviews r
LEFT JOIN partner_destination_sources s ON s.employer_id=r.employer_id
LEFT JOIN partner_destination_decisions d ON d.review_id=r.id
LEFT JOIN partner_destination_holds h ON h.review_id=r.id;
--> statement-breakpoint
CREATE TRIGGER partner_destination_review_insert BEFORE INSERT ON partner_destination_reviews BEGIN
 SELECT (CASE WHEN NEW.mode NOT IN ('test','live') OR NEW.revision<1 OR length(json_extract(NEW.payload_json,'$.representativeUserId'))<3 OR json_extract(NEW.payload_json,'$.representativeUserId') IS NULL OR NOT json_valid(NEW.payload_json)
 OR NEW.review_until>strftime('%Y-%m-%dT%H:%M:%fZ','now','+31 minutes') OR NEW.review_until<=strftime('%Y-%m-%dT%H:%M:%fZ','now')
 OR NEW.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now','+30 days') OR NEW.expires_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now')
 OR NOT EXISTS(SELECT 1 FROM partner_destination_sources s WHERE s.employer_id=NEW.employer_id AND s.employer_id=NEW.employer_id AND s.source_json=json_extract(NEW.payload_json,'$.sourceJson') AND json_extract(NEW.payload_json,'$.representativeUserId')!=NEW.prepared_user AND NEW.expires_at<=json_extract(s.source_json,'$.expiresAt'))
 OR NOT EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=NEW.prepared_by AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active' AND g.role='operations_controller')
 THEN RAISE(ABORT,'Destination source or preparer changed') END);
END;
--> statement-breakpoint
CREATE TRIGGER partner_destination_decision_insert BEFORE INSERT ON partner_destination_decisions BEGIN
 SELECT (CASE WHEN NEW.decision NOT IN ('verified_live','confirmed_test','rejected')
 OR NEW.auth_method NOT IN ('mfa_verified','owner_mfa_exception') OR NOT EXISTS(SELECT 1 FROM partner_destination_reviews r WHERE r.id=NEW.review_id AND r.payload_hash=NEW.payload_hash AND r.prepared_by!=NEW.operator_id AND r.prepared_user!=NEW.user_id AND json_extract(r.payload_json,'$.representativeUserId')!=NEW.user_id)
 OR NOT EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=NEW.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active' AND g.role='finance_approver')
 THEN RAISE(ABORT,'Independent destination reviewer required') END);
 SELECT (CASE WHEN NEW.decision!='rejected' AND NOT EXISTS(
 SELECT 1 FROM partner_destination_current r WHERE r.id=NEW.review_id AND r.status='pending'
 AND NEW.decision=CASE r.mode WHEN 'live' THEN 'verified_live' ELSE 'confirmed_test' END
 AND NEW.provider_hash=json_extract(r.payload_json,'$.providerHash')
 AND NOT EXISTS(SELECT 1 FROM partner_destination_reviews other JOIN partner_destination_decisions od ON od.review_id=other.id AND od.decision IN ('verified_live','confirmed_test') WHERE other.mode=r.mode AND other.employer_id!=r.employer_id AND (json_extract(other.payload_json,'$.provider.accountHash')=json_extract(r.payload_json,'$.provider.accountHash') OR (json_extract(other.payload_json,'$.provider.integration')=json_extract(r.payload_json,'$.provider.integration') AND json_extract(other.payload_json,'$.provider.code')=json_extract(r.payload_json,'$.provider.code'))))
 AND NOT EXISTS(SELECT 1 FROM partner_destination_reviews newer JOIN partner_destination_decisions nd ON nd.review_id=newer.id AND nd.decision IN ('verified_live','confirmed_test') WHERE newer.employer_id=r.employer_id AND newer.mode=r.mode AND newer.revision>r.revision)
 AND coalesce(json_extract(r.payload_json,'$.supersedesId'),'')=coalesce((SELECT prev.id FROM partner_destination_reviews prev JOIN partner_destination_decisions pd ON pd.review_id=prev.id AND pd.decision IN ('verified_live','confirmed_test') WHERE prev.employer_id=r.employer_id AND prev.mode=r.mode ORDER BY prev.revision DESC LIMIT 1),'')
 AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=r.prepared_by AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active' AND g.role='operations_controller')
 ) THEN RAISE(ABORT,'Destination source, hold, expiry or replacement changed') END);
END;
--> statement-breakpoint
CREATE TRIGGER partner_destination_hold_insert BEFORE INSERT ON partner_destination_holds BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=NEW.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active' AND g.role IN ('operations_controller','finance_approver')) THEN RAISE(ABORT,'Destination review authority required') END);
END;

--> statement-breakpoint
CREATE TRIGGER partner_destination_reviews_update BEFORE UPDATE ON partner_destination_reviews BEGIN SELECT RAISE(ABORT,'Destination history is immutable'); END;

--> statement-breakpoint
CREATE TRIGGER partner_destination_reviews_delete BEFORE DELETE ON partner_destination_reviews BEGIN SELECT RAISE(ABORT,'Destination history is immutable'); END;

--> statement-breakpoint
CREATE TRIGGER partner_destination_decisions_update BEFORE UPDATE ON partner_destination_decisions BEGIN SELECT RAISE(ABORT,'Destination history is immutable'); END;

--> statement-breakpoint
CREATE TRIGGER partner_destination_decisions_delete BEFORE DELETE ON partner_destination_decisions BEGIN SELECT RAISE(ABORT,'Destination history is immutable'); END;

--> statement-breakpoint
CREATE TRIGGER partner_destination_holds_update BEFORE UPDATE ON partner_destination_holds BEGIN SELECT RAISE(ABORT,'Destination history is immutable'); END;

--> statement-breakpoint
CREATE TRIGGER partner_destination_holds_delete BEFORE DELETE ON partner_destination_holds BEGIN SELECT RAISE(ABORT,'Destination history is immutable'); END;

--> statement-breakpoint
CREATE TRIGGER partner_destination_person_company_separation BEFORE INSERT ON partner_destination_decisions WHEN NEW.decision IN ('verified_live','confirmed_test') BEGIN
 SELECT (CASE WHEN EXISTS(SELECT 1 FROM partner_destination_reviews r JOIN payment_destination_reviews other ON other.mode=r.mode JOIN payment_destination_decisions d ON d.review_id=other.id AND d.decision IN ('verified_live','confirmed_test') WHERE r.id=NEW.review_id AND (json_extract(other.payload_json,'$.provider.accountHash')=json_extract(r.payload_json,'$.provider.accountHash') OR (json_extract(other.payload_json,'$.provider.integration')=json_extract(r.payload_json,'$.provider.integration') AND json_extract(other.payload_json,'$.provider.code')=json_extract(r.payload_json,'$.provider.code')))) THEN RAISE(ABORT,'Employee and company destinations must remain separate') END);
END;

--> statement-breakpoint
CREATE TRIGGER payment_destination_person_company_separation BEFORE INSERT ON payment_destination_decisions WHEN NEW.decision IN ('verified_live','confirmed_test') BEGIN
 SELECT (CASE WHEN EXISTS(SELECT 1 FROM payment_destination_reviews r JOIN partner_destination_reviews other ON other.mode=r.mode JOIN partner_destination_decisions d ON d.review_id=other.id AND d.decision IN ('verified_live','confirmed_test') WHERE r.id=NEW.review_id AND (json_extract(other.payload_json,'$.provider.accountHash')=json_extract(r.payload_json,'$.provider.accountHash') OR (json_extract(other.payload_json,'$.provider.integration')=json_extract(r.payload_json,'$.provider.integration') AND json_extract(other.payload_json,'$.provider.code')=json_extract(r.payload_json,'$.provider.code')))) THEN RAISE(ABORT,'Employee and company destinations must remain separate') END);
END;
