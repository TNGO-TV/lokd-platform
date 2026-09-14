-- Central assigns numbering after current canonical history. No evidence seeded.
CREATE TABLE production_passport_deliveries (
 id TEXT PRIMARY KEY, officer_id TEXT NOT NULL REFERENCES officers(id), owner_user_id TEXT NOT NULL,
 applicant_id TEXT NOT NULL, applicant_version INTEGER NOT NULL, request_key TEXT NOT NULL,
 token_hash TEXT NOT NULL UNIQUE CHECK(length(token_hash)=64 AND token_hash NOT GLOB '*[^a-f0-9]*'),
 created_at TEXT NOT NULL, expires_at TEXT NOT NULL,
 UNIQUE(owner_user_id,request_key)
);
CREATE TABLE production_passport_delivery_bindings (
 delivery_id TEXT PRIMARY KEY REFERENCES production_passport_deliveries(id),
 passport_id TEXT NOT NULL UNIQUE REFERENCES production_readiness_passports(id), bound_at TEXT NOT NULL
);
CREATE VIEW current_production_passport_deliveries AS
 SELECT d.* FROM production_passport_deliveries d JOIN production_entity_links l ON l.kind='officer' AND l.entity_id=d.officer_id AND l.owner_user_id=d.owner_user_id AND l.case_id=d.applicant_id AND l.case_version=d.applicant_version
 JOIN signup_cases c ON c.kind='officer' AND c.source_id=d.applicant_id AND c.owner_user_id=d.owner_user_id AND c.version=d.applicant_version AND c.status='reviewed'
 WHERE julianday(d.expires_at)>julianday('now');
CREATE TRIGGER id_usable_delivery_guard BEFORE INSERT ON production_passport_deliveries BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM production_entity_links l JOIN signup_cases c ON c.kind=l.kind AND c.source_id=l.case_id AND c.version=l.case_version AND c.owner_user_id=l.owner_user_id AND c.status='reviewed'
 WHERE l.kind='officer' AND l.entity_id=NEW.officer_id AND l.owner_user_id=NEW.owner_user_id AND l.case_id=NEW.applicant_id AND l.case_version=NEW.applicant_version)
 OR julianday(NEW.created_at) IS NULL OR julianday(NEW.expires_at) IS NULL OR julianday(NEW.created_at)>julianday('now') OR julianday(NEW.expires_at)<=julianday('now') OR julianday(NEW.expires_at)>julianday(NEW.created_at,'+1 day')
 OR EXISTS(SELECT 1 FROM production_readiness_passports WHERE token_hash=NEW.token_hash)
 THEN RAISE(ABORT,'Current owner-bound private delivery required') END);
END;
CREATE TRIGGER id_usable_passport_delivery_guard BEFORE INSERT ON production_readiness_passports
 WHEN EXISTS(SELECT 1 FROM production_passport_deliveries WHERE token_hash=NEW.token_hash) BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM current_production_passport_deliveries d WHERE d.token_hash=NEW.token_hash AND d.officer_id=NEW.officer_id AND d.owner_user_id<>NEW.prepared_by AND NOT EXISTS(SELECT 1 FROM production_passport_delivery_bindings b WHERE b.delivery_id=d.id)) THEN RAISE(ABORT,'Private delivery changed, expired or already consumed') END);
END;
CREATE TRIGGER id_usable_delivery_binding_guard BEFORE INSERT ON production_passport_delivery_bindings BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM current_production_passport_deliveries d JOIN production_readiness_passports p ON p.id=NEW.passport_id AND p.officer_id=d.officer_id AND p.token_hash=d.token_hash WHERE d.id=NEW.delivery_id) THEN RAISE(ABORT,'Exact current private delivery required') END);
END;
CREATE TRIGGER id_usable_delivery_approval_guard BEFORE INSERT ON production_readiness_decisions WHEN NEW.kind='passport' AND NEW.decision='approve'
 AND EXISTS(SELECT 1 FROM production_readiness_passports p JOIN production_passport_deliveries d ON d.token_hash=p.token_hash WHERE p.id=NEW.target_id) BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM production_passport_delivery_bindings b JOIN current_production_passport_deliveries d ON d.id=b.delivery_id WHERE b.passport_id=NEW.target_id) THEN RAISE(ABORT,'Private delivery changed or expired before approval') END);
END;
CREATE TRIGGER id_usable_deliveries_no_update BEFORE UPDATE ON production_passport_deliveries BEGIN SELECT RAISE(ABORT,'Private delivery history is immutable'); END;
CREATE TRIGGER id_usable_deliveries_no_delete BEFORE DELETE ON production_passport_deliveries BEGIN SELECT RAISE(ABORT,'Private delivery history is immutable'); END;
CREATE TRIGGER id_usable_bindings_no_update BEFORE UPDATE ON production_passport_delivery_bindings BEGIN SELECT RAISE(ABORT,'Private delivery history is immutable'); END;
CREATE TRIGGER id_usable_bindings_no_delete BEFORE DELETE ON production_passport_delivery_bindings BEGIN SELECT RAISE(ABORT,'Private delivery history is immutable'); END;

CREATE TABLE production_hold_provenance (
 kind TEXT NOT NULL CHECK(kind IN ('workforce','passport')), hold_id TEXT NOT NULL,
 audit_event_id TEXT NOT NULL REFERENCES audit_events(id), PRIMARY KEY(kind,hold_id,audit_event_id)
);
-- Preserve the original hold, recording the exact originating workforce hold ID
-- in the automatic passport hold ID. Historical system holds are not rewritten.
DROP TRIGGER id04_capture_workforce_hold;
CREATE TRIGGER id04_capture_workforce_hold AFTER UPDATE OF status ON workforce_engagements
 WHEN NEW.status='suspended' AND OLD.status<>'suspended' AND NEW.environment='production' AND EXISTS(SELECT 1 FROM production_entity_links WHERE kind='officer' AND entity_id=NEW.officer_id) BEGIN
 INSERT INTO production_workforce_holds VALUES(lower(hex(randomblob(16))),NEW.id,NEW.officer_id,json_object('engagementId',OLD.id,'officerId',OLD.officer_id,'employerId',OLD.employer_id,'model',OLD.model,'version',OLD.version,'termsVersion',OLD.terms_version,'reference',OLD.engagement_reference),'system','Workforce source suspended; independent replacement review required',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
 INSERT INTO production_readiness_holds SELECT 'workforce-passport:'||h.id||':'||p.id,'passport',p.id,'suspend','system','Workforce source suspended',strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM current_production_readiness_passports p JOIN production_workforce_holds h ON h.engagement_id=NEW.id AND json_extract(h.snapshot_json,'$.version')=OLD.version WHERE p.officer_id=NEW.officer_id;
END;
CREATE TRIGGER id_usable_workforce_human_audit AFTER INSERT ON audit_events
 WHEN NEW.event_type='production_evidence_suspended' AND NEW.entity_type='evidence_review' AND json_valid(NEW.detail) BEGIN
 INSERT INTO production_hold_provenance
 SELECT 'workforce',h.id,NEW.id FROM production_workforce_holds h JOIN production_evidence_reviews r ON r.id=NEW.entity_id AND r.kind='engagement' AND r.state='approved'
 WHERE h.engagement_id=json_extract(r.payload_json,'$.engagementId') AND h.engagement_id=json_extract(NEW.detail,'$.engagementId') AND json_extract(h.snapshot_json,'$.version')=json_extract(NEW.detail,'$.sourceVersion');
 SELECT (CASE WHEN EXISTS(SELECT 1 FROM production_evidence_reviews r JOIN production_entity_links l ON l.kind='officer' AND l.entity_id=json_extract(r.payload_json,'$.officerId') WHERE r.id=NEW.entity_id AND r.kind='engagement') AND NOT EXISTS(SELECT 1 FROM production_hold_provenance WHERE audit_event_id=NEW.id) THEN RAISE(ABORT,'Workforce suspension source changed before audit') END);
 INSERT INTO production_hold_provenance SELECT 'passport',p.id,NEW.id FROM production_hold_provenance x JOIN production_readiness_holds p ON p.kind='passport' AND p.id='workforce-passport:'||x.hold_id||':'||p.target_id WHERE x.kind='workforce' AND x.audit_event_id=NEW.id;
END;
CREATE TRIGGER id_usable_provenance_no_update BEFORE UPDATE ON production_hold_provenance BEGIN SELECT RAISE(ABORT,'Hold provenance is immutable'); END;
CREATE TRIGGER id_usable_provenance_no_delete BEFORE DELETE ON production_hold_provenance BEGIN SELECT RAISE(ABORT,'Hold provenance is immutable'); END;
CREATE TRIGGER id_usable_disposition_human_separation BEFORE INSERT ON production_rereview_decisions BEGIN
 SELECT (CASE WHEN EXISTS(SELECT 1 FROM production_rereview_proposals p JOIN production_hold_provenance h ON h.kind=p.kind AND h.hold_id=p.hold_id JOIN audit_events a ON a.id=h.audit_event_id WHERE p.id=NEW.proposal_id AND a.actor_id=NEW.actor_id) THEN RAISE(ABORT,'Independent human suspension reviewer required') END);
END;
CREATE TRIGGER id_usable_provenance_guard BEFORE INSERT ON production_hold_provenance BEGIN
 SELECT (CASE WHEN NEW.kind='workforce' AND NOT EXISTS(SELECT 1 FROM production_workforce_holds h JOIN audit_events a ON a.id=NEW.audit_event_id AND a.actor_type='operations' AND a.event_type='production_evidence_suspended' AND a.entity_type='evidence_review' JOIN production_evidence_reviews r ON r.id=a.entity_id AND r.kind='engagement' AND r.state='approved' WHERE h.id=NEW.hold_id AND json_valid(a.detail) AND h.engagement_id=json_extract(r.payload_json,'$.engagementId') AND h.engagement_id=json_extract(a.detail,'$.engagementId') AND json_extract(h.snapshot_json,'$.version')=json_extract(a.detail,'$.sourceVersion')) THEN RAISE(ABORT,'Exact human workforce audit required') END);
 SELECT (CASE WHEN NEW.kind='passport' AND NOT EXISTS(SELECT 1 FROM production_readiness_holds p JOIN production_hold_provenance w ON w.kind='workforce' AND w.audit_event_id=NEW.audit_event_id AND p.id='workforce-passport:'||w.hold_id||':'||p.target_id WHERE p.id=NEW.hold_id AND p.kind='passport') THEN RAISE(ABORT,'Exact originating workforce hold required') END);
END;
CREATE TRIGGER id_usable_human_audit_no_update BEFORE UPDATE ON audit_events WHEN OLD.event_type='identity_review_data_access' OR EXISTS(SELECT 1 FROM production_hold_provenance WHERE audit_event_id=OLD.id) BEGIN SELECT RAISE(ABORT,'Identity review audit is immutable'); END;
CREATE TRIGGER id_usable_human_audit_no_delete BEFORE DELETE ON audit_events WHEN OLD.event_type='identity_review_data_access' OR EXISTS(SELECT 1 FROM production_hold_provenance WHERE audit_event_id=OLD.id) BEGIN SELECT RAISE(ABORT,'Identity review audit is immutable'); END;
