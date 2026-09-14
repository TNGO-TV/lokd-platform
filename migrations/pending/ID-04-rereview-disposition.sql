-- ID-04 pending migration. Apply after ID-01/02/03. No evidence or permissions seeded.
CREATE TABLE production_workforce_holds (
 id TEXT PRIMARY KEY, engagement_id TEXT NOT NULL REFERENCES workforce_engagements(id), officer_id TEXT NOT NULL REFERENCES officers(id),
 snapshot_json TEXT NOT NULL, actor_id TEXT NOT NULL, reason TEXT NOT NULL, recorded_at TEXT NOT NULL
);
CREATE TABLE production_rereview_proposals (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('identity','officer','workforce','review','passport')), hold_id TEXT NOT NULL,
 applicant_id TEXT NOT NULL, applicant_version INTEGER NOT NULL, owner_user_id TEXT NOT NULL, source_epoch INTEGER NOT NULL,
 source_json TEXT NOT NULL, source_hash TEXT NOT NULL, evidence_reference TEXT NOT NULL, evidence_hash TEXT NOT NULL,
 checked_at TEXT NOT NULL, expires_at TEXT NOT NULL, prepared_by TEXT NOT NULL, prepared_at TEXT NOT NULL
);
CREATE TABLE production_rereview_decisions (
 proposal_id TEXT PRIMARY KEY REFERENCES production_rereview_proposals(id), decision TEXT NOT NULL CHECK(decision IN ('allow_replacement','keep_held')),
 actor_id TEXT NOT NULL, reason TEXT NOT NULL, decided_at TEXT NOT NULL
);
CREATE TABLE production_rereview_cutoffs (
 proposal_id TEXT PRIMARY KEY REFERENCES production_rereview_proposals(id), passport_sequence INTEGER NOT NULL,
 officer_rowid INTEGER NOT NULL, readiness_rowid INTEGER NOT NULL, workforce_rowid INTEGER NOT NULL
);
CREATE VIEW production_rereview_targets AS
 SELECT 'identity' AS kind,h.id AS hold_id,c.id AS subject_id,c.applicant_id,c.owner_user_id,l.entity_id AS officer_id,h.recorded_at AS held_at,h.actor_id AS held_by,h.reason
 FROM production_identity_suspensions h JOIN production_identity_cases c ON c.id=h.case_id LEFT JOIN production_entity_links l ON l.kind='officer' AND l.case_id=c.applicant_id AND l.owner_user_id=c.owner_user_id
 UNION ALL
 SELECT 'officer',h.id,h.officer_id,l.case_id,l.owner_user_id,h.officer_id,h.created_at,h.actor_id,h.reason FROM production_officer_suspensions h JOIN production_entity_links l ON l.kind='officer' AND l.entity_id=h.officer_id
 UNION ALL
 SELECT 'workforce',h.id,h.engagement_id,l.case_id,l.owner_user_id,h.officer_id,h.recorded_at,h.actor_id,h.reason FROM production_workforce_holds h JOIN production_entity_links l ON l.kind='officer' AND l.entity_id=h.officer_id
 UNION ALL
 SELECT 'review',h.id,r.id,l.case_id,l.owner_user_id,r.officer_id,h.recorded_at,h.actor_id,h.reason FROM production_readiness_holds h JOIN production_readiness_reviews r ON h.kind='review' AND r.id=h.target_id JOIN production_entity_links l ON l.kind='officer' AND l.entity_id=r.officer_id
 UNION ALL
 SELECT 'passport',h.id,p.id,l.case_id,l.owner_user_id,p.officer_id,h.recorded_at,h.actor_id,h.reason FROM production_readiness_holds h JOIN production_readiness_passports p ON h.kind='passport' AND p.id=h.target_id JOIN production_entity_links l ON l.kind='officer' AND l.entity_id=p.officer_id;
CREATE VIEW production_rereview_sources AS
 SELECT t.*,c.version AS applicant_version,c.status AS applicant_status,c.latest_event_id,c.corrections_json
 FROM production_rereview_targets t JOIN signup_cases c ON c.kind='officer' AND c.source_id=t.applicant_id AND c.owner_user_id=t.owner_user_id
 JOIN officer_applications a ON a.id=c.source_id AND a.environment='prelaunch' AND a.integrity_state='user_submitted';
CREATE VIEW production_rereview_authorizations AS
 SELECT p.*,d.actor_id AS decided_by,d.decided_at,f.passport_sequence,f.officer_rowid,f.readiness_rowid,f.workforce_rowid FROM production_rereview_proposals p JOIN production_rereview_cutoffs f ON f.proposal_id=p.id JOIN production_rereview_decisions d ON d.proposal_id=p.id AND d.decision='allow_replacement'
 JOIN signup_cases c ON c.kind='officer' AND c.source_id=p.applicant_id AND c.version=p.applicant_version AND c.owner_user_id=p.owner_user_id AND c.status='reviewed';
CREATE TRIGGER id04_proposal_guard BEFORE INSERT ON production_rereview_proposals BEGIN
 SELECT CASE WHEN NEW.source_epoch<>(SELECT revision FROM activation_evidence_epoch WHERE singleton=1) OR NOT EXISTS(SELECT 1 FROM production_rereview_sources t WHERE t.kind=NEW.kind AND t.hold_id=NEW.hold_id AND t.applicant_id=NEW.applicant_id AND t.applicant_version=NEW.applicant_version AND t.owner_user_id=NEW.owner_user_id AND t.applicant_status='reviewed' AND t.owner_user_id<>NEW.prepared_by AND julianday(NEW.checked_at)>=julianday(t.held_at) AND julianday(NEW.checked_at)<=julianday('now') AND julianday(NEW.expires_at)>julianday('now') AND length(NEW.evidence_reference)>2 AND length(NEW.evidence_hash)=64 AND json_extract(NEW.source_json,'$.latest_event_id')=t.latest_event_id AND json_extract(NEW.source_json,'$.corrections_json')=t.corrections_json) THEN RAISE(ABORT,'Current independently investigated hold required') END;
END;
CREATE TRIGGER id04_disposition_guard BEFORE INSERT ON production_rereview_decisions BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM production_rereview_proposals p JOIN production_rereview_targets t ON t.kind=p.kind AND t.hold_id=p.hold_id WHERE p.id=NEW.proposal_id AND p.prepared_by<>NEW.actor_id AND p.owner_user_id<>NEW.actor_id AND t.held_by<>NEW.actor_id) THEN RAISE(ABORT,'Independent disposition required') END;
 SELECT CASE WHEN NEW.decision='allow_replacement' AND NOT EXISTS(SELECT 1 FROM production_rereview_proposals p JOIN production_rereview_sources t ON t.kind=p.kind AND t.hold_id=p.hold_id AND t.applicant_id=p.applicant_id AND t.applicant_version=p.applicant_version AND t.owner_user_id=p.owner_user_id AND t.applicant_status='reviewed'
 WHERE p.id=NEW.proposal_id AND p.source_epoch=(SELECT revision FROM activation_evidence_epoch WHERE singleton=1) AND julianday(p.expires_at)>julianday('now') AND json_extract(p.source_json,'$.latest_event_id')=t.latest_event_id AND json_extract(p.source_json,'$.corrections_json')=t.corrections_json
 AND NOT EXISTS(SELECT 1 FROM production_rereview_authorizations a WHERE a.kind=p.kind AND a.hold_id=p.hold_id AND a.applicant_version=p.applicant_version AND julianday(a.expires_at)>julianday('now'))) THEN RAISE(ABORT,'Disposition source changed, expired or already authorized') END;
END;
CREATE TRIGGER id04_disposition_audit AFTER INSERT ON production_rereview_decisions BEGIN
 INSERT INTO audit_events VALUES(lower(hex(randomblob(16))),'operations',NEW.actor_id,'rereview_disposition','rereview_proposal',NEW.proposal_id,NEW.decision||': '||NEW.reason,NEW.decided_at);
 UPDATE activation_evidence_epoch SET revision=revision+1,updated_at=NEW.decided_at WHERE singleton=1;
END;
CREATE TRIGGER id04_identity_replacement_guard BEFORE INSERT ON production_identity_cases BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM production_rereview_targets t WHERE t.kind='identity' AND t.applicant_id=NEW.applicant_id AND NOT EXISTS(SELECT 1 FROM production_rereview_authorizations a WHERE a.kind=t.kind AND a.hold_id=t.hold_id AND a.applicant_version=NEW.applicant_version AND julianday(a.expires_at)>julianday('now'))) THEN RAISE(ABORT,'Identity hold needs independent replacement disposition') END;
 -- ID-01 unresolved-delivery and exact capture/version guards still run.
END;
CREATE TRIGGER id04_officer_replacement_guard BEFORE INSERT ON production_officer_reviews BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM production_rereview_targets t WHERE t.kind='officer' AND t.officer_id=NEW.officer_id AND NOT EXISTS(SELECT 1 FROM production_rereview_authorizations a WHERE a.kind=t.kind AND a.hold_id=t.hold_id AND julianday(a.expires_at)>julianday('now') AND julianday(NEW.prepared_at)>=julianday(a.decided_at))) THEN RAISE(ABORT,'Officer hold needs fresh independent disposition') END;
END;
CREATE TRIGGER id04_officer_decision_guard BEFORE INSERT ON production_officer_decisions WHEN NEW.decision='approve' BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM production_officer_reviews r JOIN production_rereview_targets t ON t.kind='officer' AND t.officer_id=r.officer_id WHERE r.id=NEW.review_id AND NOT EXISTS(SELECT 1 FROM production_rereview_authorizations a WHERE a.kind=t.kind AND a.hold_id=t.hold_id AND r.rowid>a.officer_rowid AND julianday(a.expires_at)>julianday('now') AND julianday(r.prepared_at)>=julianday(a.decided_at))) THEN RAISE(ABORT,'Officer disposition changed before approval') END;
END;
CREATE TRIGGER id04_review_replacement_guard BEFORE INSERT ON production_readiness_reviews BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM production_rereview_targets t JOIN production_readiness_reviews old ON t.kind='review' AND t.subject_id=old.id JOIN production_readiness_rules oldrule ON oldrule.id=old.rule_id JOIN production_readiness_rules rule ON rule.id=NEW.rule_id AND rule.code=oldrule.code WHERE t.officer_id=NEW.officer_id AND NOT EXISTS(SELECT 1 FROM production_rereview_authorizations a WHERE a.kind=t.kind AND a.hold_id=t.hold_id AND julianday(a.expires_at)>julianday('now') AND julianday(NEW.prepared_at)>=julianday(a.decided_at) AND NOT EXISTS(SELECT 1 FROM json_each(NEW.evidence_json) e WHERE julianday(json_extract(e.value,'$.checkedAt'))<julianday(a.decided_at)))) THEN RAISE(ABORT,'Assessment hold requires disposition and rechecked evidence') END;
END;
DROP VIEW valid_production_readiness_passports;
CREATE VIEW valid_production_readiness_passports AS
 SELECT p.* FROM production_readiness_passports p JOIN current_production_officer_approvals a ON a.id=p.officer_review_id AND a.officer_id=p.officer_id
 JOIN officers o ON o.id=p.officer_id AND o.approval_status='approved'
 WHERE julianday(p.expires_at)>julianday('now') AND julianday(p.expires_at)<=julianday(a.expires_at)
 AND json_array_length(p.items_json)>=3
 AND NOT EXISTS(SELECT 1 FROM json_each(p.items_json) j JOIN current_production_readiness_reviews r ON r.id=j.value WHERE r.category='service' AND NOT EXISTS(SELECT 1 FROM officer_services svc WHERE svc.officer_id=p.officer_id AND svc.service_type=r.service_type AND svc.qualified=1 AND svc.opted_in=1 AND julianday(svc.qualification_expiry)>=julianday(p.expires_at)))
 AND NOT EXISTS(SELECT 1 FROM json_each(p.items_json) item WHERE NOT EXISTS(SELECT 1 FROM current_production_readiness_reviews r WHERE r.id=item.value AND r.officer_id=p.officer_id AND r.officer_review_id=p.officer_review_id AND julianday(r.expires_at)>=julianday(p.expires_at)))
 AND (SELECT count(DISTINCT r.category) FROM json_each(p.items_json) item JOIN current_production_readiness_reviews r ON r.id=item.value)=3
 AND NOT EXISTS(SELECT 1 FROM json_each(p.items_json) item JOIN current_production_readiness_reviews r ON r.id=item.value WHERE r.category='service' AND NOT EXISTS(SELECT 1 FROM current_production_readiness_optins x JOIN json_each(p.optins_json) chosen ON chosen.value=x.id WHERE x.officer_id=p.officer_id AND x.service_type=r.service_type AND x.opted_in=1))
 AND NOT EXISTS(SELECT 1 FROM production_readiness_holds h JOIN production_readiness_passports old ON old.id=h.target_id WHERE h.kind='passport' AND old.officer_id=p.officer_id AND (h.target_id=p.id OR NOT EXISTS(SELECT 1 FROM production_rereview_authorizations a WHERE a.kind='passport' AND a.hold_id=h.id AND p.sequence>a.passport_sequence AND julianday(p.prepared_at)>=julianday(a.decided_at) AND julianday(p.prepared_at)<julianday(a.expires_at) AND NOT EXISTS(SELECT 1 FROM json_each(p.items_json) j JOIN production_readiness_reviews r ON r.id=j.value JOIN json_each(r.evidence_json) e WHERE (r.rowid<=a.readiness_rowid OR julianday(json_extract(e.value,'$.checkedAt'))<julianday(a.decided_at))))));
DROP TRIGGER id03_passport_guard;
CREATE TRIGGER id03_passport_guard BEFORE INSERT ON production_readiness_passports BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM production_readiness_holds h JOIN production_readiness_passports p ON p.id=h.target_id WHERE h.kind='passport' AND p.officer_id=NEW.officer_id AND NOT EXISTS(SELECT 1 FROM production_rereview_authorizations a WHERE a.kind='passport' AND a.hold_id=h.id AND julianday(a.expires_at)>julianday('now') AND julianday(NEW.prepared_at)>=julianday(a.decided_at))) THEN RAISE(ABORT,'Held passport requires separate disposition') END;
 SELECT CASE WHEN NEW.sequence<>coalesce((SELECT MAX(sequence)+1 FROM production_readiness_passports WHERE officer_id=NEW.officer_id),1) OR NOT EXISTS(SELECT 1 FROM current_production_officer_approvals a WHERE a.id=NEW.officer_review_id AND a.officer_id=NEW.officer_id AND json_extract(a.source_json,'$.owner_user_id')<>NEW.prepared_by) THEN RAISE(ABORT,'Current independent passport preparation required') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM officer_passports WHERE officer_id=NEW.officer_id AND coalesce(evidence_reference,'') NOT LIKE 'readiness-passport:%') THEN RAISE(ABORT,'Legacy or sandbox passport cannot be promoted') END;
END;
CREATE TRIGGER id04_passport_decision_guard BEFORE INSERT ON production_readiness_decisions WHEN NEW.kind='passport' AND NEW.decision='approve' BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM production_readiness_passports p JOIN production_rereview_targets t ON t.kind='passport' AND t.officer_id=p.officer_id WHERE p.id=NEW.target_id AND NOT EXISTS(SELECT 1 FROM production_rereview_authorizations a WHERE a.kind=t.kind AND a.hold_id=t.hold_id AND julianday(a.expires_at)>julianday('now') AND julianday(p.prepared_at)>=julianday(a.decided_at))) THEN RAISE(ABORT,'Passport disposition changed before approval') END;
END;
CREATE TRIGGER id04_capture_workforce_hold AFTER UPDATE OF status ON workforce_engagements
 WHEN NEW.status='suspended' AND OLD.status<>'suspended' AND NEW.environment='production' AND EXISTS(SELECT 1 FROM production_entity_links WHERE kind='officer' AND entity_id=NEW.officer_id) BEGIN
 INSERT INTO production_workforce_holds VALUES(lower(hex(randomblob(16))),NEW.id,NEW.officer_id,json_object('engagementId',OLD.id,'officerId',OLD.officer_id,'employerId',OLD.employer_id,'model',OLD.model,'version',OLD.version,'termsVersion',OLD.terms_version,'reference',OLD.engagement_reference),'system','Workforce source suspended; independent replacement review required',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
 INSERT INTO production_readiness_holds SELECT lower(hex(randomblob(16))),'passport',p.id,'suspend','system','Workforce source suspended',strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM current_production_readiness_passports p WHERE p.officer_id=NEW.officer_id;
END;
CREATE TRIGGER id04_workforce_frozen BEFORE UPDATE ON workforce_engagements WHEN EXISTS(SELECT 1 FROM production_workforce_holds WHERE engagement_id=OLD.id) BEGIN SELECT RAISE(ABORT,'Suspended workforce history cannot be reactivated or rewritten'); END;
CREATE TRIGGER id04_workforce_replacement_guard BEFORE INSERT ON workforce_engagements WHEN NEW.environment='production' AND NEW.status='active' BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM production_rereview_targets t WHERE t.kind='workforce' AND t.officer_id=NEW.officer_id AND NOT EXISTS(SELECT 1 FROM production_rereview_authorizations a JOIN production_evidence_reviews r ON r.kind='engagement' AND r.state='approved' AND json_extract(r.payload_json,'$.engagementId')=NEW.id AND julianday(r.prepared_at)>=julianday(a.decided_at) AND r.rowid>a.workforce_rowid WHERE a.kind=t.kind AND a.hold_id=t.hold_id AND julianday(a.expires_at)>julianday('now'))) THEN RAISE(ABORT,'Workforce replacement requires disposition and fresh approved sources') END;
END;
CREATE TRIGGER id04_intake_suspends_workforce AFTER UPDATE ON signup_cases WHEN NEW.kind='officer' AND (NEW.version<>OLD.version OR NEW.status='withdrawn') BEGIN
 UPDATE workforce_engagements SET status='suspended',active_key=NULL,version=version+1,updated_at=NEW.updated_at WHERE status='active' AND environment='production' AND officer_id IN(SELECT entity_id FROM production_entity_links WHERE kind='officer' AND case_id=NEW.source_id);
END;
CREATE TRIGGER id04_workforce_passport_guard BEFORE INSERT ON production_readiness_passports BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM production_rereview_targets t WHERE t.kind='workforce' AND t.officer_id=NEW.officer_id AND NOT EXISTS(SELECT 1 FROM production_rereview_authorizations a JOIN workforce_engagements w ON w.officer_id=NEW.officer_id AND w.status='active' AND w.active_key=w.officer_id AND w.id<>t.subject_id WHERE a.kind=t.kind AND a.hold_id=t.hold_id AND julianday(a.expires_at)>julianday('now'))) THEN RAISE(ABORT,'Current replacement workforce required after hold') END;
END;
CREATE TRIGGER id04_production_workforce_holds_no_update BEFORE UPDATE ON production_workforce_holds BEGIN SELECT RAISE(ABORT,'Disposition history is immutable'); END;
CREATE TRIGGER id04_production_workforce_holds_no_delete BEFORE DELETE ON production_workforce_holds BEGIN SELECT RAISE(ABORT,'Disposition history is immutable'); END;
CREATE TRIGGER id04_production_rereview_proposals_no_update BEFORE UPDATE ON production_rereview_proposals BEGIN SELECT RAISE(ABORT,'Disposition history is immutable'); END;
CREATE TRIGGER id04_production_rereview_proposals_no_delete BEFORE DELETE ON production_rereview_proposals BEGIN SELECT RAISE(ABORT,'Disposition history is immutable'); END;
CREATE TRIGGER id04_production_rereview_decisions_no_update BEFORE UPDATE ON production_rereview_decisions BEGIN SELECT RAISE(ABORT,'Disposition history is immutable'); END;
CREATE TRIGGER id04_production_rereview_decisions_no_delete BEFORE DELETE ON production_rereview_decisions BEGIN SELECT RAISE(ABORT,'Disposition history is immutable'); END;

CREATE TRIGGER id04_capture_cutoffs AFTER INSERT ON production_rereview_decisions WHEN NEW.decision='allow_replacement' BEGIN
 INSERT INTO production_rereview_cutoffs SELECT NEW.proposal_id,
 coalesce((SELECT max(sequence) FROM production_readiness_passports WHERE officer_id=json_extract(p.source_json,'$.officer_id')),0),
 coalesce((SELECT max(rowid) FROM production_officer_reviews),0),coalesce((SELECT max(rowid) FROM production_readiness_reviews),0),coalesce((SELECT max(rowid) FROM production_evidence_reviews),0)
 FROM production_rereview_proposals p WHERE p.id=NEW.proposal_id;
END;
CREATE TRIGGER id04_cutoffs_no_update BEFORE UPDATE ON production_rereview_cutoffs BEGIN SELECT RAISE(ABORT,'Disposition history is immutable'); END;
CREATE TRIGGER id04_cutoffs_no_delete BEFORE DELETE ON production_rereview_cutoffs BEGIN SELECT RAISE(ABORT,'Disposition history is immutable'); END;
CREATE TRIGGER id04_assessment_decision_guard BEFORE INSERT ON production_readiness_decisions WHEN NEW.kind='review' AND NEW.decision='approve' BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM production_readiness_reviews r JOIN production_readiness_rules rule ON rule.id=r.rule_id JOIN production_rereview_targets t ON t.kind='review' AND t.officer_id=r.officer_id JOIN production_readiness_reviews old ON old.id=t.subject_id JOIN production_readiness_rules oldrule ON oldrule.id=old.rule_id AND oldrule.code=rule.code
 WHERE r.id=NEW.target_id AND NOT EXISTS(SELECT 1 FROM production_rereview_authorizations a WHERE a.kind=t.kind AND a.hold_id=t.hold_id AND julianday(a.expires_at)>julianday('now') AND r.rowid>a.readiness_rowid AND NOT EXISTS(SELECT 1 FROM json_each(r.evidence_json) e WHERE julianday(json_extract(e.value,'$.checkedAt'))<julianday(a.decided_at)))) THEN RAISE(ABORT,'Assessment needs a fresh disposition and new review') END;
END;

CREATE TRIGGER id04_officer_suspends_workforce AFTER UPDATE OF approval_status ON officers WHEN OLD.approval_status='approved' AND NEW.approval_status<>'approved' BEGIN
 UPDATE workforce_engagements SET status='suspended',active_key=NULL,version=version+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE status='active' AND environment='production' AND officer_id=NEW.id AND EXISTS(SELECT 1 FROM production_entity_links WHERE kind='officer' AND entity_id=NEW.id);
END;
CREATE TRIGGER id04_workforce_no_delete BEFORE DELETE ON workforce_engagements WHEN EXISTS(SELECT 1 FROM production_workforce_holds WHERE engagement_id=OLD.id) BEGIN SELECT RAISE(ABORT,'Suspended workforce history is immutable'); END;
