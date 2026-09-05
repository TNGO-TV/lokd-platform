CREATE TABLE `specialist_commercial_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`pricing_version` text NOT NULL,
	`terms_version` text NOT NULL,
	`status` text DEFAULT 'review' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`evidence_reference` text NOT NULL,
	`expires_at` text NOT NULL,
	`prepared_by` text NOT NULL,
	`approved_by` text,
	`approved_at` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `specialist_commercial_env_version_idx` ON `specialist_commercial_reviews` (`environment`,`pricing_version`,`terms_version`);--> statement-breakpoint
CREATE TABLE `specialist_deployment_packs` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`content` text NOT NULL,
	`quote_snapshot` text NOT NULL,
	`commercial_review_id` text,
	`commercial_review_version` integer DEFAULT 0 NOT NULL,
	`partner_id` text,
	`partner_version` integer DEFAULT 0 NOT NULL,
	`prepared_by` text NOT NULL,
	`approved_by` text,
	`approved_at` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`commercial_review_id`) REFERENCES `specialist_commercial_reviews`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`partner_id`) REFERENCES `specialist_partners`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `specialist_pack_booking_idx` ON `specialist_deployment_packs` (`booking_id`);--> statement-breakpoint
CREATE INDEX `specialist_pack_queue_idx` ON `specialist_deployment_packs` (`environment`,`status`);--> statement-breakpoint
CREATE TABLE `specialist_partners` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`service_codes` text NOT NULL,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`evidence_reference` text NOT NULL,
	`valid_from` text NOT NULL,
	`expires_at` text NOT NULL,
	`status` text DEFAULT 'review' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`prepared_by` text NOT NULL,
	`approved_by` text,
	`approved_at` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `specialist_partner_env_idx` ON `specialist_partners` (`environment`,`status`);--> statement-breakpoint
CREATE TABLE `specialist_rehearsal_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`environment` text DEFAULT 'demo' NOT NULL,
	`integrity_state` text DEFAULT 'synthetic' NOT NULL,
	`scenarios` text NOT NULL,
	`run_by` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `specialist_rehearsal_date_idx` ON `specialist_rehearsal_runs` (`environment`,`created_at`);

--> statement-breakpoint
CREATE VIEW specialist_required_checks_v34 AS
SELECT p.id AS pack_id,r.value AS code
FROM specialist_deployment_packs p JOIN bookings b ON b.id=p.booking_id,
json_each('["client_contract","client_onboarding","risk_assessment","post_orders","insurance","command_relief","cost_evidence","armed_authority","principal_consent","vehicle","overnight"]') r
WHERE r.value IN ('client_contract','client_onboarding','risk_assessment','post_orders','insurance','command_relief','cost_evidence')
 OR (r.value='armed_authority' AND b.specialist_service_code IN ('armed_static','armed_movement','vip_armed'))
 OR (r.value='principal_consent' AND b.specialist_service_code LIKE 'vip_%')
 OR (r.value='vehicle' AND json_extract(b.specialist_configuration,'$.vehicleClass')<>'none')
 OR (r.value='overnight' AND json_extract(b.specialist_configuration,'$.overnightDays')>0)
UNION ALL
SELECT p.id,'officer:'||o.value||':'||r.value
FROM specialist_deployment_packs p JOIN bookings b ON b.id=p.booking_id,
json_each(p.content,'$.officerIds') o,json_each('["onboarding","psira","induction","readiness","firearm","protection","driving"]') r
WHERE r.value IN ('onboarding','psira','induction','readiness')
 OR (r.value='firearm' AND b.specialist_service_code IN ('armed_static','armed_movement','vip_armed'))
 OR (r.value='protection' AND b.specialist_service_code LIKE 'vip_%')
 OR (r.value='driving' AND b.specialist_service_code IN ('armed_movement','vip_protective_driver'));
--> statement-breakpoint

CREATE VIEW specialist_pack_validation_v34 AS
SELECT p.id,p.booking_id,p.environment,CASE WHEN
 p.environment=b.environment AND p.integrity_state=CASE p.environment WHEN 'demo' THEN 'synthetic' ELSE 'recorded' END
 AND b.specialist_service_code<>'standard_unarmed' AND price.valid=1 AND b.pricing_status='authoritative'
 AND control.assignment_plan_current=1 AND control.specialist_authority_current=1 AND control.funding_current=1
 AND cr.status='approved' AND cr.environment=p.environment AND cr.version=p.commercial_review_version
 AND cr.pricing_version=b.pricing_version AND cr.terms_version='LOKD-SPECIALIST-TERMS-2026.09-v1'
 AND julianday(cr.expires_at)>julianday(CURRENT_TIMESTAMP) AND julianday(cr.expires_at)>=julianday((SELECT MAX(ends_at) FROM roster_slots WHERE booking_id=b.id))
 AND julianday((SELECT MAX(ends_at) FROM roster_slots WHERE booking_id=b.id))>julianday(CURRENT_TIMESTAMP)
 AND p.quote_snapshot=json_array(b.id,b.client_id,b.specialist_service_code,b.specialist_configuration,b.pricing_version,
 b.quote_subtotal_cents,b.vat_cents,b.client_price_cents,b.cost_floor_cents,b.margin_basis_points,b.headcount,
 (SELECT MIN(starts_at) FROM roster_slots WHERE booking_id=b.id),(SELECT MAX(ends_at) FROM roster_slots WHERE booking_id=b.id),'LOKD-SPECIALIST-TERMS-2026.09-v1')
 AND json_type(p.content,'$.officerIds')='array' AND json_array_length(p.content,'$.officerIds')>=b.headcount
 AND json_array_length(p.content,'$.officerIds')=(SELECT COUNT(DISTINCT value) FROM json_each(p.content,'$.officerIds'))
 AND NOT EXISTS(SELECT 1 FROM json_each(p.content,'$.officerIds') o WHERE NOT EXISTS(
 SELECT 1 FROM officers officer JOIN workforce_engagements w ON w.officer_id=officer.id
 WHERE officer.id=o.value AND w.environment=p.environment AND officer.approval_status='approved'
 AND julianday(officer.psira_expiry)>=julianday((SELECT MAX(ends_at) FROM roster_slots WHERE booking_id=b.id))))
 AND length(trim(json_extract(p.content,'$.commandOwner')))>0
 AND length(trim(json_extract(p.content,'$.clientBrief')))>0 AND length(trim(json_extract(p.content,'$.officerBrief')))>0
 AND ( (p.partner_id IS NULL AND json_extract(b.specialist_configuration,'$.vehicleClass') NOT IN ('standard_suv','armoured_partner'))
 OR (partner.status='approved' AND partner.environment=p.environment AND partner.version=p.partner_version
 AND julianday(partner.valid_from)<=julianday(CURRENT_TIMESTAMP)
 AND julianday(partner.valid_from)<=julianday((SELECT MIN(starts_at) FROM roster_slots WHERE booking_id=b.id))
 AND julianday(partner.expires_at)>=julianday((SELECT MAX(ends_at) FROM roster_slots WHERE booking_id=b.id))
 AND julianday(partner.expires_at)>julianday(CURRENT_TIMESTAMP)
 AND EXISTS(SELECT 1 FROM json_each(partner.service_codes) WHERE value=b.specialist_service_code)))
 AND NOT EXISTS(SELECT 1 FROM specialist_required_checks_v34 r WHERE r.pack_id=p.id AND NOT EXISTS(
 SELECT 1 FROM json_each(p.content,'$.checks') e WHERE json_extract(e.value,'$.code')=r.code
 AND json_type(e.value,'$.reference')='text' AND length(trim(json_extract(e.value,'$.reference')))>0
 AND julianday(json_extract(e.value,'$.validFrom'))<=julianday(CURRENT_TIMESTAMP)
 AND julianday(json_extract(e.value,'$.validFrom'))<=julianday((SELECT MIN(starts_at) FROM roster_slots WHERE booking_id=b.id))
 AND julianday(json_extract(e.value,'$.expiresAt'))>=julianday((SELECT MAX(ends_at) FROM roster_slots WHERE booking_id=b.id))
 AND julianday(json_extract(e.value,'$.expiresAt'))>julianday(CURRENT_TIMESTAMP)
 AND (p.environment='demo' OR (lower(json_extract(e.value,'$.reference')) NOT LIKE '%demo:%'
 AND lower(json_extract(e.value,'$.reference')) NOT LIKE '%synthetic%'
 AND lower(json_extract(e.value,'$.reference')) NOT LIKE '%.invalid%'
 AND lower(json_extract(e.value,'$.reference')) NOT LIKE '%.example%'))))
 THEN 1 ELSE 0 END AS valid
FROM specialist_deployment_packs p JOIN bookings b ON b.id=p.booking_id
LEFT JOIN specialist_pricing_validation_v33 price ON price.id=b.id
LEFT JOIN specialist_booking_control_validation_v33 control ON control.id=b.id
LEFT JOIN specialist_commercial_reviews cr ON cr.id=p.commercial_review_id
LEFT JOIN specialist_partners partner ON partner.id=p.partner_id;

--> statement-breakpoint
CREATE TRIGGER specialist_commercial_reviews_insert_shape_v34 BEFORE INSERT ON specialist_commercial_reviews
 BEGIN
 SELECT (CASE WHEN NOT COALESCE(NEW.environment IN ('demo','production') AND NEW.integrity_state=CASE NEW.environment WHEN 'demo' THEN 'synthetic' ELSE 'recorded' END
 AND NEW.status IN ('draft','review','approved','revoked') AND length(trim(NEW.prepared_by))>0 AND (NEW.pricing_version='LOKD-SPECIALIST-2026.09-v1' AND NEW.terms_version='LOKD-SPECIALIST-TERMS-2026.09-v1' AND julianday(NEW.expires_at) IS NOT NULL AND length(trim(NEW.evidence_reference))>0),0)
 THEN RAISE(ABORT,'specialist_record_shape_invalid') END);
 SELECT (CASE WHEN NEW.status<>'review' OR NEW.approved_by IS NOT NULL OR NEW.version<>1 THEN RAISE(ABORT,'specialist_initial_review_required') END);
 END;
--> statement-breakpoint
CREATE TRIGGER specialist_commercial_reviews_update_shape_v34 BEFORE UPDATE ON specialist_commercial_reviews
 BEGIN
 SELECT (CASE WHEN NOT COALESCE(NEW.environment IN ('demo','production') AND NEW.integrity_state=CASE NEW.environment WHEN 'demo' THEN 'synthetic' ELSE 'recorded' END
 AND NEW.status IN ('draft','review','approved','revoked') AND length(trim(NEW.prepared_by))>0 AND (NEW.pricing_version='LOKD-SPECIALIST-2026.09-v1' AND NEW.terms_version='LOKD-SPECIALIST-TERMS-2026.09-v1' AND julianday(NEW.expires_at) IS NOT NULL AND length(trim(NEW.evidence_reference))>0),0)
 THEN RAISE(ABORT,'specialist_record_shape_invalid') END);
 SELECT (CASE WHEN NEW.id<>OLD.id OR NEW.environment<>OLD.environment OR NEW.integrity_state<>OLD.integrity_state OR NEW.version<>OLD.version+1
 THEN RAISE(ABORT,'specialist_revision_conflict') END);
 END;
--> statement-breakpoint
CREATE TRIGGER specialist_commercial_reviews_approval_v34 AFTER UPDATE ON specialist_commercial_reviews WHEN NEW.status='approved'
 BEGIN
 SELECT (CASE WHEN OLD.status<>'review' OR lower(NEW.prepared_by)=lower(COALESCE(NEW.approved_by,'')) OR NEW.approved_by IS NULL
 OR NEW.prepared_by<>OLD.prepared_by OR NEW.approved_at IS NULL OR julianday(NEW.approved_at)>julianday(CURRENT_TIMESTAMP)
 OR NEW.evidence_reference<>OLD.evidence_reference OR NEW.expires_at<>OLD.expires_at
 THEN RAISE(ABORT,'specialist_independent_review_required') END);
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments r ON r.operator_id=a.id AND r.environment=a.environment
 WHERE lower(a.email)=lower(NEW.approved_by) AND a.environment=NEW.environment AND a.status='active'
 AND r.role IN ('operations_owner','compliance_reviewer') AND r.status='active' AND r.revoked_at IS NULL
 AND (NEW.environment='demo' OR (a.mfa_status='verified' AND julianday(a.mfa_verified_at)<=julianday(CURRENT_TIMESTAMP)
 AND julianday(a.mfa_verified_at)>=julianday(CURRENT_TIMESTAMP,'-15 minutes')
 )))
 THEN RAISE(ABORT,'specialist_reviewer_role_or_mfa_required') END);
 SELECT (CASE WHEN julianday(NEW.expires_at)<=julianday(CURRENT_TIMESTAMP) OR (NEW.environment='production' AND (lower(NEW.evidence_reference) LIKE '%demo:%' OR lower(NEW.evidence_reference) LIKE '%synthetic%' OR lower(NEW.evidence_reference) LIKE '%.invalid%' OR lower(NEW.evidence_reference) LIKE '%.example%')) THEN RAISE(ABORT,'specialist_current_verified_evidence_required') END);
 END;
--> statement-breakpoint
CREATE TRIGGER specialist_commercial_reviews_history_v34 AFTER UPDATE ON specialist_commercial_reviews
 BEGIN
 INSERT INTO audit_events (id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at)
 VALUES ('SA-'||lower(hex(randomblob(16))),'system','specialist-workflow','specialist_revision','specialist_commercial_reviews',OLD.id,
 json_object('version',OLD.version,'status',OLD.status,'environment',OLD.environment,'preparedBy',OLD.prepared_by,'approvedBy',OLD.approved_by,
 'evidenceReference',OLD.evidence_reference,'expiresAt',OLD.expires_at),CURRENT_TIMESTAMP);
 UPDATE activation_evidence_epoch SET revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE singleton=1;
 END;
--> statement-breakpoint
CREATE TRIGGER specialist_partners_insert_shape_v34 BEFORE INSERT ON specialist_partners
 BEGIN
 SELECT (CASE WHEN NOT COALESCE(NEW.environment IN ('demo','production') AND NEW.integrity_state=CASE NEW.environment WHEN 'demo' THEN 'synthetic' ELSE 'recorded' END
 AND NEW.status IN ('draft','review','approved','revoked') AND length(trim(NEW.prepared_by))>0 AND (json_valid(NEW.service_codes) AND json_type(NEW.service_codes)='array' AND json_array_length(NEW.service_codes)>0 AND julianday(NEW.valid_from) IS NOT NULL AND julianday(NEW.expires_at) IS NOT NULL AND length(trim(NEW.evidence_reference))>0),0)
 THEN RAISE(ABORT,'specialist_record_shape_invalid') END);
 SELECT (CASE WHEN NEW.status<>'review' OR NEW.approved_by IS NOT NULL OR NEW.version<>1 THEN RAISE(ABORT,'specialist_initial_review_required') END);
 END;
--> statement-breakpoint
CREATE TRIGGER specialist_partners_update_shape_v34 BEFORE UPDATE ON specialist_partners
 BEGIN
 SELECT (CASE WHEN NOT COALESCE(NEW.environment IN ('demo','production') AND NEW.integrity_state=CASE NEW.environment WHEN 'demo' THEN 'synthetic' ELSE 'recorded' END
 AND NEW.status IN ('draft','review','approved','revoked') AND length(trim(NEW.prepared_by))>0 AND (json_valid(NEW.service_codes) AND json_type(NEW.service_codes)='array' AND json_array_length(NEW.service_codes)>0 AND julianday(NEW.valid_from) IS NOT NULL AND julianday(NEW.expires_at) IS NOT NULL AND length(trim(NEW.evidence_reference))>0),0)
 THEN RAISE(ABORT,'specialist_record_shape_invalid') END);
 SELECT (CASE WHEN NEW.id<>OLD.id OR NEW.environment<>OLD.environment OR NEW.integrity_state<>OLD.integrity_state OR NEW.version<>OLD.version+1
 THEN RAISE(ABORT,'specialist_revision_conflict') END);
 END;
--> statement-breakpoint
CREATE TRIGGER specialist_partners_approval_v34 AFTER UPDATE ON specialist_partners WHEN NEW.status='approved'
 BEGIN
 SELECT (CASE WHEN OLD.status<>'review' OR lower(NEW.prepared_by)=lower(COALESCE(NEW.approved_by,'')) OR NEW.approved_by IS NULL
 OR NEW.prepared_by<>OLD.prepared_by OR NEW.approved_at IS NULL OR julianday(NEW.approved_at)>julianday(CURRENT_TIMESTAMP)
 OR NEW.service_codes<>OLD.service_codes OR NEW.evidence_reference<>OLD.evidence_reference OR NEW.expires_at<>OLD.expires_at OR NEW.valid_from<>OLD.valid_from
 THEN RAISE(ABORT,'specialist_independent_review_required') END);
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments r ON r.operator_id=a.id AND r.environment=a.environment
 WHERE lower(a.email)=lower(NEW.approved_by) AND a.environment=NEW.environment AND a.status='active'
 AND r.role IN ('operations_owner','compliance_reviewer') AND r.status='active' AND r.revoked_at IS NULL
 AND (NEW.environment='demo' OR (a.mfa_status='verified' AND julianday(a.mfa_verified_at)<=julianday(CURRENT_TIMESTAMP)
 AND julianday(a.mfa_verified_at)>=julianday(CURRENT_TIMESTAMP,'-15 minutes')
 )))
 THEN RAISE(ABORT,'specialist_reviewer_role_or_mfa_required') END);
 SELECT (CASE WHEN julianday(NEW.expires_at)<=julianday(CURRENT_TIMESTAMP) OR (NEW.environment='production' AND (lower(NEW.evidence_reference) LIKE '%demo:%' OR lower(NEW.evidence_reference) LIKE '%synthetic%' OR lower(NEW.evidence_reference) LIKE '%.invalid%' OR lower(NEW.evidence_reference) LIKE '%.example%')) THEN RAISE(ABORT,'specialist_current_verified_evidence_required') END);
 END;
--> statement-breakpoint
CREATE TRIGGER specialist_partners_history_v34 AFTER UPDATE ON specialist_partners
 BEGIN
 INSERT INTO audit_events (id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at)
 VALUES ('SA-'||lower(hex(randomblob(16))),'system','specialist-workflow','specialist_revision','specialist_partners',OLD.id,
 json_object('version',OLD.version,'status',OLD.status,'environment',OLD.environment,'preparedBy',OLD.prepared_by,'approvedBy',OLD.approved_by,
 'evidenceReference',OLD.evidence_reference,'expiresAt',OLD.expires_at),CURRENT_TIMESTAMP);
 UPDATE activation_evidence_epoch SET revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE singleton=1;
 END;
--> statement-breakpoint
CREATE TRIGGER specialist_deployment_packs_insert_shape_v34 BEFORE INSERT ON specialist_deployment_packs
 BEGIN
 SELECT (CASE WHEN NOT COALESCE(NEW.environment IN ('demo','production') AND NEW.integrity_state=CASE NEW.environment WHEN 'demo' THEN 'synthetic' ELSE 'recorded' END
 AND NEW.status IN ('draft','review','approved','revoked') AND length(trim(NEW.prepared_by))>0 AND (json_valid(NEW.content) AND json_type(NEW.content)='object' AND json_type(NEW.content,'$.checks')='array' AND json_type(NEW.content,'$.officerIds')='array' AND json_valid(NEW.quote_snapshot)),0)
 THEN RAISE(ABORT,'specialist_record_shape_invalid') END);
 SELECT (CASE WHEN NEW.status<>'draft' OR NEW.approved_by IS NOT NULL OR NEW.version<>1 THEN RAISE(ABORT,'specialist_initial_review_required') END);
 END;
--> statement-breakpoint
CREATE TRIGGER specialist_deployment_packs_update_shape_v34 BEFORE UPDATE ON specialist_deployment_packs
 BEGIN
 SELECT (CASE WHEN NOT COALESCE(NEW.environment IN ('demo','production') AND NEW.integrity_state=CASE NEW.environment WHEN 'demo' THEN 'synthetic' ELSE 'recorded' END
 AND NEW.status IN ('draft','review','approved','revoked') AND length(trim(NEW.prepared_by))>0 AND (json_valid(NEW.content) AND json_type(NEW.content)='object' AND json_type(NEW.content,'$.checks')='array' AND json_type(NEW.content,'$.officerIds')='array' AND json_valid(NEW.quote_snapshot)),0)
 THEN RAISE(ABORT,'specialist_record_shape_invalid') END);
 SELECT (CASE WHEN NEW.id<>OLD.id OR NEW.environment<>OLD.environment OR NEW.integrity_state<>OLD.integrity_state OR NEW.version<>OLD.version+1 OR NEW.booking_id<>OLD.booking_id
 THEN RAISE(ABORT,'specialist_revision_conflict') END);
 END;
--> statement-breakpoint
CREATE TRIGGER specialist_deployment_packs_approval_v34 AFTER UPDATE ON specialist_deployment_packs WHEN NEW.status='approved'
 BEGIN
 SELECT (CASE WHEN OLD.status<>'review' OR lower(NEW.prepared_by)=lower(COALESCE(NEW.approved_by,'')) OR NEW.approved_by IS NULL
 OR NEW.prepared_by<>OLD.prepared_by OR NEW.approved_at IS NULL OR julianday(NEW.approved_at)>julianday(CURRENT_TIMESTAMP)
 OR NEW.content<>OLD.content OR NEW.quote_snapshot<>OLD.quote_snapshot
 THEN RAISE(ABORT,'specialist_independent_review_required') END);
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments r ON r.operator_id=a.id AND r.environment=a.environment
 WHERE lower(a.email)=lower(NEW.approved_by) AND a.environment=NEW.environment AND a.status='active'
 AND r.role IN ('operations_owner','compliance_reviewer') AND r.status='active' AND r.revoked_at IS NULL
 AND (NEW.environment='demo' OR (a.mfa_status='verified' AND julianday(a.mfa_verified_at)<=julianday(CURRENT_TIMESTAMP)
 AND julianday(a.mfa_verified_at)>=julianday(CURRENT_TIMESTAMP,'-15 minutes')
 AND a.approval_limit_cents>=(SELECT client_price_cents FROM bookings WHERE id=NEW.booking_id))))
 THEN RAISE(ABORT,'specialist_reviewer_role_or_mfa_required') END);
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM specialist_pack_validation_v34 WHERE id=NEW.id AND valid=1) THEN RAISE(ABORT,'specialist_pack_controls_not_current') END);
 END;
--> statement-breakpoint
CREATE TRIGGER specialist_deployment_packs_history_v34 AFTER UPDATE ON specialist_deployment_packs
 BEGIN
 INSERT INTO audit_events (id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at)
 VALUES ('SA-'||lower(hex(randomblob(16))),'system','specialist-workflow','specialist_revision','specialist_deployment_packs',OLD.id,
 json_object('version',OLD.version,'status',OLD.status,'environment',OLD.environment,'preparedBy',OLD.prepared_by,'approvedBy',OLD.approved_by,
 'content',json(OLD.content),'quoteSnapshot',OLD.quote_snapshot),CURRENT_TIMESTAMP);
 UPDATE activation_evidence_epoch SET revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE singleton=1;
 END;
--> statement-breakpoint
CREATE TRIGGER specialist_rehearsal_demo_only_v34 BEFORE INSERT ON specialist_rehearsal_runs
WHEN NEW.environment<>'demo' OR NEW.integrity_state<>'synthetic' OR NOT json_valid(NEW.scenarios)
BEGIN SELECT RAISE(ABORT,'specialist_rehearsal_demo_only'); END;
--> statement-breakpoint
CREATE TRIGGER specialist_offer_pack_insert_v34 BEFORE INSERT ON offers
 WHEN NEW.status IN ('open','accepted') AND EXISTS(SELECT 1 FROM bookings b WHERE b.id=NEW.booking_id AND b.environment='production' AND b.specialist_service_code<>'standard_unarmed')
 BEGIN SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM specialist_deployment_packs p JOIN specialist_pack_validation_v34 v ON v.id=p.id
 WHERE p.booking_id=NEW.booking_id AND p.status='approved' AND v.valid=1
 AND EXISTS(SELECT 1 FROM json_each(p.content,'$.officerIds') WHERE value=NEW.officer_id))
 THEN RAISE(ABORT,'specialist_approved_pack_required') END); END;
--> statement-breakpoint
CREATE TRIGGER specialist_offer_pack_update_v34 BEFORE UPDATE OF status ON offers
 WHEN NEW.status IN ('open','accepted') AND EXISTS(SELECT 1 FROM bookings b WHERE b.id=NEW.booking_id AND b.environment='production' AND b.specialist_service_code<>'standard_unarmed')
 BEGIN SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM specialist_deployment_packs p JOIN specialist_pack_validation_v34 v ON v.id=p.id
 WHERE p.booking_id=NEW.booking_id AND p.status='approved' AND v.valid=1
 AND EXISTS(SELECT 1 FROM json_each(p.content,'$.officerIds') WHERE value=NEW.officer_id))
 THEN RAISE(ABORT,'specialist_approved_pack_required') END); END;
--> statement-breakpoint
CREATE TRIGGER specialist_activation_pack_v34 BEFORE UPDATE OF state ON assignment_activation_commands
WHEN NEW.state='activated' AND NEW.environment='production'
AND EXISTS(SELECT 1 FROM roster_slots s JOIN bookings b ON b.id=s.booking_id WHERE s.id=NEW.roster_slot_id AND b.specialist_service_code<>'standard_unarmed')
BEGIN SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM roster_slots s JOIN specialist_deployment_packs p ON p.booking_id=s.booking_id JOIN specialist_pack_validation_v34 v ON v.id=p.id
WHERE s.id=NEW.roster_slot_id AND p.status='approved' AND v.valid=1 AND EXISTS(SELECT 1 FROM json_each(p.content,'$.officerIds') WHERE value=NEW.officer_id))
THEN RAISE(ABORT,'specialist_approved_pack_required') END); END;

--> statement-breakpoint
CREATE TRIGGER specialist_revalidation_pack_v34 BEFORE UPDATE OF status ON assignment_revalidations
WHEN NEW.status='passed' AND EXISTS(
 SELECT 1 FROM assignment_activation_snapshots snap JOIN bookings b ON b.id=snap.booking_id
 WHERE snap.id=NEW.snapshot_id AND b.environment='production' AND b.specialist_service_code<>'standard_unarmed')
BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM assignment_activation_snapshots snap
 JOIN specialist_deployment_packs p ON p.booking_id=snap.booking_id JOIN specialist_pack_validation_v34 v ON v.id=p.id
 WHERE snap.id=NEW.snapshot_id AND p.status='approved' AND v.valid=1
 AND EXISTS(SELECT 1 FROM json_each(p.content,'$.officerIds') WHERE value=snap.officer_id))
 THEN RAISE(ABORT,'specialist_approved_pack_required') END);
END;
--> statement-breakpoint
CREATE TRIGGER specialist_pack_delete_epoch_v34 AFTER DELETE ON specialist_deployment_packs
BEGIN UPDATE activation_evidence_epoch SET revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE singleton=1; END;
