-- Pending ID-03. Apply after ID-01 and ID-02; contains no policy/evidence seeds.
CREATE TABLE production_readiness_rules (
 id TEXT PRIMARY KEY, code TEXT NOT NULL, label TEXT NOT NULL, category TEXT NOT NULL CHECK(category IN ('core','service','purpose')),
 service_type TEXT, purpose_code TEXT, requirements_json TEXT NOT NULL, max_days INTEGER NOT NULL CHECK(max_days>0),
 evidence_reference TEXT NOT NULL, expires_at TEXT NOT NULL, prepared_by TEXT NOT NULL, prepared_at TEXT NOT NULL
);
CREATE TABLE production_readiness_reviews (
 id TEXT PRIMARY KEY, officer_id TEXT NOT NULL REFERENCES officers(id), officer_review_id TEXT NOT NULL REFERENCES production_officer_reviews(id),
 rule_id TEXT NOT NULL REFERENCES production_readiness_rules(id), evidence_json TEXT NOT NULL, expires_at TEXT NOT NULL,
 prepared_by TEXT NOT NULL, prepared_at TEXT NOT NULL
);
CREATE TABLE production_readiness_optins (
 id TEXT PRIMARY KEY, officer_id TEXT NOT NULL REFERENCES officers(id), service_type TEXT NOT NULL, revision INTEGER NOT NULL,
 opted_in INTEGER NOT NULL CHECK(opted_in IN (0,1)), actor_id TEXT NOT NULL, recorded_at TEXT NOT NULL, UNIQUE(officer_id,service_type,revision)
);
CREATE TABLE production_readiness_passports (
 id TEXT PRIMARY KEY, officer_id TEXT NOT NULL REFERENCES officers(id), sequence INTEGER NOT NULL,
 officer_review_id TEXT NOT NULL REFERENCES production_officer_reviews(id), items_json TEXT NOT NULL, optins_json TEXT NOT NULL,
 token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, prepared_by TEXT NOT NULL, prepared_at TEXT NOT NULL, UNIQUE(officer_id,sequence)
);
CREATE TABLE production_readiness_decisions (
 kind TEXT NOT NULL CHECK(kind IN ('rule','review','passport')), target_id TEXT NOT NULL,
 decision TEXT NOT NULL CHECK(decision IN ('approve','reject')), actor_id TEXT NOT NULL, reason TEXT NOT NULL, decided_at TEXT NOT NULL,
 PRIMARY KEY(kind,target_id)
);
CREATE TABLE production_readiness_holds (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('rule','review','passport')), target_id TEXT NOT NULL,
 disposition TEXT NOT NULL CHECK(disposition IN ('suspend','revoke')), actor_id TEXT NOT NULL, reason TEXT NOT NULL, recorded_at TEXT NOT NULL
);
CREATE VIEW current_production_readiness_rules AS
 SELECT r.* FROM production_readiness_rules r JOIN production_readiness_decisions d ON d.kind='rule' AND d.target_id=r.id AND d.decision='approve'
 WHERE julianday(r.expires_at)>julianday('now') AND NOT EXISTS(SELECT 1 FROM production_readiness_holds h WHERE h.kind='rule' AND h.target_id=r.id)
 AND NOT EXISTS(SELECT 1 FROM production_readiness_rules newer JOIN production_readiness_decisions nd ON nd.kind='rule' AND nd.target_id=newer.id AND nd.decision='approve' WHERE newer.code=r.code AND newer.rowid>r.rowid);
CREATE VIEW valid_production_readiness_reviews AS
 SELECT r.*,p.code,p.label,p.category,p.service_type,p.purpose_code FROM production_readiness_reviews r
 JOIN current_production_officer_approvals a ON a.id=r.officer_review_id AND a.officer_id=r.officer_id
 JOIN officers o ON o.id=r.officer_id AND o.approval_status='approved'
 JOIN current_production_readiness_rules p ON p.id=r.rule_id
 WHERE julianday(r.expires_at)>julianday('now') AND julianday(r.expires_at)<=julianday(a.expires_at) AND julianday(r.expires_at)<=julianday(p.expires_at)
 AND NOT EXISTS(SELECT 1 FROM production_readiness_holds h WHERE h.kind='review' AND h.target_id=r.id);
CREATE VIEW current_production_readiness_reviews AS
 SELECT r.* FROM valid_production_readiness_reviews r JOIN production_readiness_decisions d ON d.kind='review' AND d.target_id=r.id AND d.decision='approve'
 WHERE NOT EXISTS(SELECT 1 FROM production_readiness_reviews newer JOIN production_readiness_rules np ON np.id=newer.rule_id JOIN production_readiness_decisions nd ON nd.kind='review' AND nd.target_id=newer.id AND nd.decision='approve' WHERE newer.officer_id=r.officer_id AND np.code=r.code AND newer.rowid>(SELECT rowid FROM production_readiness_reviews WHERE id=r.id));
CREATE VIEW current_production_readiness_optins AS
 SELECT x.* FROM production_readiness_optins x WHERE x.revision=(SELECT MAX(revision) FROM production_readiness_optins WHERE officer_id=x.officer_id AND service_type=x.service_type);
CREATE VIEW valid_production_readiness_passports AS
 SELECT p.* FROM production_readiness_passports p JOIN current_production_officer_approvals a ON a.id=p.officer_review_id AND a.officer_id=p.officer_id
 JOIN officers o ON o.id=p.officer_id AND o.approval_status='approved'
 WHERE julianday(p.expires_at)>julianday('now') AND julianday(p.expires_at)<=julianday(a.expires_at)
 AND json_array_length(p.items_json)>=3
 AND NOT EXISTS(SELECT 1 FROM json_each(p.items_json) j JOIN current_production_readiness_reviews r ON r.id=j.value WHERE r.category='service' AND NOT EXISTS(SELECT 1 FROM officer_services svc WHERE svc.officer_id=p.officer_id AND svc.service_type=r.service_type AND svc.qualified=1 AND svc.opted_in=1 AND julianday(svc.qualification_expiry)>=julianday(p.expires_at)))
 AND NOT EXISTS(SELECT 1 FROM json_each(p.items_json) item WHERE NOT EXISTS(SELECT 1 FROM current_production_readiness_reviews r WHERE r.id=item.value AND r.officer_id=p.officer_id AND r.officer_review_id=p.officer_review_id AND julianday(r.expires_at)>=julianday(p.expires_at)))
 AND (SELECT count(DISTINCT r.category) FROM json_each(p.items_json) item JOIN current_production_readiness_reviews r ON r.id=item.value)=3
 AND NOT EXISTS(SELECT 1 FROM json_each(p.items_json) item JOIN current_production_readiness_reviews r ON r.id=item.value WHERE r.category='service' AND NOT EXISTS(SELECT 1 FROM current_production_readiness_optins x JOIN json_each(p.optins_json) chosen ON chosen.value=x.id WHERE x.officer_id=p.officer_id AND x.service_type=r.service_type AND x.opted_in=1))
 AND NOT EXISTS(SELECT 1 FROM production_readiness_holds h WHERE h.kind='passport' AND (h.target_id IN(SELECT id FROM production_readiness_passports WHERE officer_id=p.officer_id)));
CREATE VIEW current_production_readiness_passports AS
 SELECT p.* FROM valid_production_readiness_passports p JOIN production_readiness_decisions d ON d.kind='passport' AND d.target_id=p.id AND d.decision='approve'
 WHERE NOT EXISTS(SELECT 1 FROM production_readiness_passports newer JOIN production_readiness_decisions nd ON nd.kind='passport' AND nd.target_id=newer.id AND nd.decision='approve' WHERE newer.officer_id=p.officer_id AND newer.sequence>p.sequence);
CREATE TRIGGER id03_rule_guard BEFORE INSERT ON production_readiness_rules BEGIN
 SELECT CASE WHEN json_type(NEW.requirements_json)<>'array' OR json_array_length(NEW.requirements_json)<1 OR julianday(NEW.expires_at) IS NULL OR julianday(NEW.expires_at)<=julianday('now')
 OR NOT coalesce(((NEW.category='core' AND NEW.code='core_ready' AND NEW.service_type IS NULL AND NEW.purpose_code IS NULL) OR (NEW.category='service' AND NEW.code='service_'||lower(NEW.service_type) AND NEW.service_type IN ('Unarmed','Armed','VIP') AND NEW.purpose_code IS NULL) OR (NEW.category='purpose' AND NEW.code='purpose_'||NEW.purpose_code AND NEW.service_type IS NULL AND length(NEW.purpose_code)>0)),0) THEN RAISE(ABORT,'Explicit valid readiness policy required') END;
END;
CREATE TRIGGER id03_review_guard BEFORE INSERT ON production_readiness_reviews BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM current_production_officer_approvals a JOIN current_production_readiness_rules p ON p.id=NEW.rule_id JOIN officers o ON o.id=a.officer_id AND o.approval_status='approved'
 WHERE a.id=NEW.officer_review_id AND a.officer_id=NEW.officer_id AND json_extract(a.source_json,'$.owner_user_id')<>NEW.prepared_by
 AND julianday(NEW.expires_at)>julianday('now') AND julianday(NEW.expires_at)<=min(julianday(a.expires_at),julianday(p.expires_at))
 AND json_type(NEW.evidence_json)='array' AND json_array_length(NEW.evidence_json)=json_array_length(p.requirements_json)
 AND NOT EXISTS(SELECT 1 FROM json_each(p.requirements_json) req WHERE (SELECT count(*) FROM json_each(NEW.evidence_json) e WHERE json_extract(e.value,'$.requirement')=req.value AND json_extract(e.value,'$.ownerUserId')=json_extract(a.source_json,'$.owner_user_id') AND length(json_extract(e.value,'$.reference'))>2 AND length(json_extract(e.value,'$.sha256'))=64 AND julianday(json_extract(e.value,'$.checkedAt'))<=julianday('now') AND julianday(json_extract(e.value,'$.expiresAt'))>=julianday(NEW.expires_at) AND julianday(json_extract(e.value,'$.checkedAt'))+p.max_days>=julianday(NEW.expires_at))<>1)) THEN RAISE(ABORT,'Current exact readiness evidence required') END;
END;
CREATE TRIGGER id03_optin_guard BEFORE INSERT ON production_readiness_optins BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM production_entity_links l WHERE l.kind='officer' AND l.entity_id=NEW.officer_id AND l.owner_user_id=NEW.actor_id) OR NEW.revision<>coalesce((SELECT MAX(revision)+1 FROM production_readiness_optins WHERE officer_id=NEW.officer_id AND service_type=NEW.service_type),1) OR NEW.service_type NOT IN ('Unarmed','Armed','VIP') THEN RAISE(ABORT,'Owned current opt-in revision required') END;
 SELECT CASE WHEN NEW.opted_in=1 AND NOT EXISTS(SELECT 1 FROM current_production_readiness_reviews r WHERE r.officer_id=NEW.officer_id AND r.service_type=NEW.service_type AND r.category='service') THEN RAISE(ABORT,'Current service qualification required') END;
END;
CREATE TRIGGER id03_passport_guard BEFORE INSERT ON production_readiness_passports BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM production_readiness_holds h JOIN production_readiness_passports p ON p.id=h.target_id WHERE h.kind='passport' AND p.officer_id=NEW.officer_id) THEN RAISE(ABORT,'Held passport requires separate disposition') END;
 SELECT CASE WHEN NEW.sequence<>coalesce((SELECT MAX(sequence)+1 FROM production_readiness_passports WHERE officer_id=NEW.officer_id),1) OR NOT EXISTS(SELECT 1 FROM current_production_officer_approvals a WHERE a.id=NEW.officer_review_id AND a.officer_id=NEW.officer_id AND json_extract(a.source_json,'$.owner_user_id')<>NEW.prepared_by) THEN RAISE(ABORT,'Current independent passport preparation required') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM officer_passports WHERE officer_id=NEW.officer_id AND coalesce(evidence_reference,'') NOT LIKE 'readiness-passport:%') THEN RAISE(ABORT,'Legacy or sandbox passport cannot be promoted') END;
END;
CREATE TRIGGER id03_decision_guard BEFORE INSERT ON production_readiness_decisions BEGIN
 SELECT CASE WHEN NOT EXISTS(
 SELECT 1 FROM production_readiness_rules r WHERE NEW.kind='rule' AND r.id=NEW.target_id AND r.prepared_by<>NEW.actor_id
 UNION ALL SELECT 1 FROM production_readiness_reviews r JOIN production_officer_reviews a ON a.id=r.officer_review_id JOIN production_officer_decisions ad ON ad.review_id=a.id WHERE NEW.kind='review' AND r.id=NEW.target_id AND r.prepared_by<>NEW.actor_id AND json_extract(a.source_json,'$.owner_user_id')<>NEW.actor_id AND ad.actor_id<>NEW.actor_id
 UNION ALL SELECT 1 FROM production_readiness_passports p JOIN production_officer_reviews a ON a.id=p.officer_review_id WHERE NEW.kind='passport' AND p.id=NEW.target_id AND p.prepared_by<>NEW.actor_id AND json_extract(a.source_json,'$.owner_user_id')<>NEW.actor_id AND NOT EXISTS(SELECT 1 FROM json_each(p.items_json) j JOIN production_readiness_reviews r ON r.id=j.value WHERE r.prepared_by=NEW.actor_id)
 ) THEN RAISE(ABORT,'Independent readiness decision required') END;
 SELECT CASE WHEN NEW.decision='approve' AND ((NEW.kind='rule' AND NOT EXISTS(SELECT 1 FROM production_readiness_rules r WHERE r.id=NEW.target_id AND julianday(r.expires_at)>julianday('now') AND NOT EXISTS(SELECT 1 FROM production_readiness_holds WHERE kind='rule' AND target_id=r.id) AND NOT EXISTS(SELECT 1 FROM production_readiness_rules newer JOIN production_readiness_decisions d ON d.kind='rule' AND d.target_id=newer.id AND d.decision='approve' WHERE newer.code=r.code AND newer.rowid>r.rowid)))
 OR (NEW.kind='review' AND NOT EXISTS(SELECT 1 FROM valid_production_readiness_reviews r WHERE r.id=NEW.target_id AND NOT EXISTS(SELECT 1 FROM production_readiness_reviews newer JOIN production_readiness_rules np ON np.id=newer.rule_id JOIN production_readiness_decisions nd ON nd.kind='review' AND nd.target_id=newer.id AND nd.decision='approve' WHERE newer.officer_id=r.officer_id AND np.code=r.code AND newer.rowid>(SELECT rowid FROM production_readiness_reviews WHERE id=r.id))))
 OR (NEW.kind='passport' AND NOT EXISTS(SELECT 1 FROM valid_production_readiness_passports p WHERE p.id=NEW.target_id AND p.sequence=(SELECT MAX(sequence) FROM production_readiness_passports WHERE officer_id=p.officer_id)))) THEN RAISE(ABORT,'Readiness decision evidence changed or expired') END;
END;
CREATE TRIGGER id03_hold_guard BEFORE INSERT ON production_readiness_holds BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM production_readiness_rules WHERE NEW.kind='rule' AND id=NEW.target_id UNION ALL SELECT 1 FROM production_readiness_reviews WHERE NEW.kind='review' AND id=NEW.target_id UNION ALL SELECT 1 FROM production_readiness_passports WHERE NEW.kind='passport' AND id=NEW.target_id) THEN RAISE(ABORT,'Readiness hold target missing') END;
END;
CREATE TRIGGER id03_apply_review AFTER INSERT ON production_readiness_decisions WHEN NEW.kind='review' AND NEW.decision='approve' BEGIN
 INSERT INTO officer_endorsements(id,officer_id,code,label,category,service_type,purpose_code,status,assessed_at,expires_at,next_due_at,assessor,client_visible,environment,integrity_state,evidence_reference)
 SELECT 'RDY-'||r.officer_id||'-'||r.code,r.officer_id,r.code,r.label,r.category,r.service_type,r.purpose_code,'current',NEW.decided_at,r.expires_at,r.expires_at,NEW.actor_id,1,'production','verified','readiness-review:'||r.id FROM current_production_readiness_reviews r WHERE r.id=NEW.target_id
 ON CONFLICT(officer_id,code) DO UPDATE SET label=excluded.label,status=excluded.status,assessed_at=excluded.assessed_at,expires_at=excluded.expires_at,next_due_at=excluded.next_due_at,assessor=excluded.assessor,environment=excluded.environment,integrity_state=excluded.integrity_state,evidence_reference=excluded.evidence_reference;
 INSERT INTO officer_services(officer_id,service_type,qualified,opted_in,qualification_expiry)
 SELECT officer_id,service_type,1,0,expires_at FROM current_production_readiness_reviews WHERE id=NEW.target_id AND category='service'
 ON CONFLICT(officer_id,service_type) DO UPDATE SET qualified=1,qualification_expiry=excluded.qualification_expiry;
END;
CREATE TRIGGER id03_apply_optin AFTER INSERT ON production_readiness_optins BEGIN
 UPDATE officer_services SET opted_in=NEW.opted_in,qualified=CASE WHEN EXISTS(SELECT 1 FROM current_production_readiness_reviews r WHERE r.officer_id=NEW.officer_id AND r.service_type=NEW.service_type) THEN qualified ELSE 0 END WHERE officer_id=NEW.officer_id AND service_type=NEW.service_type;
END;
CREATE TRIGGER id03_apply_passport AFTER INSERT ON production_readiness_decisions WHEN NEW.kind='passport' AND NEW.decision='approve' BEGIN
 INSERT INTO officer_passports(officer_id,passport_number,public_token_hash,status,readiness_label,issued_at,last_reviewed_at,next_review_at,updated_at,environment,integrity_state,evidence_reference)
 SELECT p.officer_id,'LOKD-P-'||p.id,p.token_hash,'active','Reviewed readiness; assignment approval required',NEW.decided_at,NEW.decided_at,p.expires_at,NEW.decided_at,'production','verified','readiness-passport:'||p.id FROM current_production_readiness_passports p WHERE p.id=NEW.target_id
 ON CONFLICT(officer_id) DO UPDATE SET passport_number=excluded.passport_number,public_token_hash=excluded.public_token_hash,status=excluded.status,readiness_label=excluded.readiness_label,issued_at=excluded.issued_at,last_reviewed_at=excluded.last_reviewed_at,next_review_at=excluded.next_review_at,updated_at=excluded.updated_at,environment=excluded.environment,integrity_state=excluded.integrity_state,evidence_reference=excluded.evidence_reference;
END;
CREATE TRIGGER id03_endorsement_no_promotion BEFORE UPDATE ON officer_endorsements
 WHEN NEW.evidence_reference LIKE 'readiness-review:%' AND (OLD.environment<>'production' OR OLD.integrity_state<>'verified')
 BEGIN SELECT RAISE(ABORT,'Sandbox or legacy endorsement cannot be promoted'); END;
CREATE TRIGGER id03_rules_no_update BEFORE UPDATE ON production_readiness_rules BEGIN SELECT RAISE(ABORT,'Readiness evidence is immutable'); END;
CREATE TRIGGER id03_rules_no_delete BEFORE DELETE ON production_readiness_rules BEGIN SELECT RAISE(ABORT,'Readiness evidence is immutable'); END;
CREATE TRIGGER id03_reviews_no_update BEFORE UPDATE ON production_readiness_reviews BEGIN SELECT RAISE(ABORT,'Readiness evidence is immutable'); END;
CREATE TRIGGER id03_reviews_no_delete BEFORE DELETE ON production_readiness_reviews BEGIN SELECT RAISE(ABORT,'Readiness evidence is immutable'); END;
CREATE TRIGGER id03_optins_no_update BEFORE UPDATE ON production_readiness_optins BEGIN SELECT RAISE(ABORT,'Readiness evidence is immutable'); END;
CREATE TRIGGER id03_optins_no_delete BEFORE DELETE ON production_readiness_optins BEGIN SELECT RAISE(ABORT,'Readiness evidence is immutable'); END;
CREATE TRIGGER id03_passports_no_update BEFORE UPDATE ON production_readiness_passports BEGIN SELECT RAISE(ABORT,'Readiness evidence is immutable'); END;
CREATE TRIGGER id03_passports_no_delete BEFORE DELETE ON production_readiness_passports BEGIN SELECT RAISE(ABORT,'Readiness evidence is immutable'); END;
CREATE TRIGGER id03_decisions_no_update BEFORE UPDATE ON production_readiness_decisions BEGIN SELECT RAISE(ABORT,'Readiness evidence is immutable'); END;
CREATE TRIGGER id03_decisions_no_delete BEFORE DELETE ON production_readiness_decisions BEGIN SELECT RAISE(ABORT,'Readiness evidence is immutable'); END;
CREATE TRIGGER id03_holds_no_update BEFORE UPDATE ON production_readiness_holds BEGIN SELECT RAISE(ABORT,'Readiness evidence is immutable'); END;
CREATE TRIGGER id03_holds_no_delete BEFORE DELETE ON production_readiness_holds BEGIN SELECT RAISE(ABORT,'Readiness evidence is immutable'); END;
CREATE TRIGGER id03_production_readiness_decisions_invalidate AFTER INSERT ON production_readiness_decisions BEGIN
 UPDATE officer_endorsements SET status='suspended' WHERE evidence_reference LIKE 'readiness-review:%' AND status='current' AND NOT EXISTS(SELECT 1 FROM current_production_readiness_reviews r WHERE 'readiness-review:'||r.id=officer_endorsements.evidence_reference);
 UPDATE officer_services SET qualified=0,opted_in=0 WHERE officer_id IN(SELECT officer_id FROM production_readiness_reviews) AND NOT EXISTS(SELECT 1 FROM current_production_readiness_reviews r WHERE r.officer_id=officer_services.officer_id AND r.service_type=officer_services.service_type AND r.category='service');
 UPDATE officer_passports SET status='suspended',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE evidence_reference LIKE 'readiness-passport:%' AND status IN ('active','expiring') AND NOT EXISTS(SELECT 1 FROM current_production_readiness_passports p WHERE 'readiness-passport:'||p.id=officer_passports.evidence_reference);
 UPDATE activation_evidence_epoch SET revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE singleton=1;
END;
CREATE TRIGGER id03_production_readiness_holds_invalidate AFTER INSERT ON production_readiness_holds BEGIN
 UPDATE officer_endorsements SET status='suspended' WHERE evidence_reference LIKE 'readiness-review:%' AND status='current' AND NOT EXISTS(SELECT 1 FROM current_production_readiness_reviews r WHERE 'readiness-review:'||r.id=officer_endorsements.evidence_reference);
 UPDATE officer_services SET qualified=0,opted_in=0 WHERE officer_id IN(SELECT officer_id FROM production_readiness_reviews) AND NOT EXISTS(SELECT 1 FROM current_production_readiness_reviews r WHERE r.officer_id=officer_services.officer_id AND r.service_type=officer_services.service_type AND r.category='service');
 UPDATE officer_passports SET status='suspended',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE evidence_reference LIKE 'readiness-passport:%' AND status IN ('active','expiring') AND NOT EXISTS(SELECT 1 FROM current_production_readiness_passports p WHERE 'readiness-passport:'||p.id=officer_passports.evidence_reference);
 UPDATE activation_evidence_epoch SET revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE singleton=1;
END;
CREATE TRIGGER id03_production_readiness_optins_invalidate AFTER INSERT ON production_readiness_optins BEGIN
 UPDATE officer_endorsements SET status='suspended' WHERE evidence_reference LIKE 'readiness-review:%' AND status='current' AND NOT EXISTS(SELECT 1 FROM current_production_readiness_reviews r WHERE 'readiness-review:'||r.id=officer_endorsements.evidence_reference);
 UPDATE officer_services SET qualified=0,opted_in=0 WHERE officer_id IN(SELECT officer_id FROM production_readiness_reviews) AND NOT EXISTS(SELECT 1 FROM current_production_readiness_reviews r WHERE r.officer_id=officer_services.officer_id AND r.service_type=officer_services.service_type AND r.category='service');
 UPDATE officer_passports SET status='suspended',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE evidence_reference LIKE 'readiness-passport:%' AND status IN ('active','expiring') AND NOT EXISTS(SELECT 1 FROM current_production_readiness_passports p WHERE 'readiness-passport:'||p.id=officer_passports.evidence_reference);
 UPDATE activation_evidence_epoch SET revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE singleton=1;
END;
CREATE TRIGGER id03_officers_invalidate AFTER UPDATE ON officers BEGIN
 UPDATE officer_endorsements SET status='suspended' WHERE evidence_reference LIKE 'readiness-review:%' AND status='current' AND NOT EXISTS(SELECT 1 FROM current_production_readiness_reviews r WHERE 'readiness-review:'||r.id=officer_endorsements.evidence_reference);
 UPDATE officer_services SET qualified=0,opted_in=0 WHERE officer_id IN(SELECT officer_id FROM production_readiness_reviews) AND NOT EXISTS(SELECT 1 FROM current_production_readiness_reviews r WHERE r.officer_id=officer_services.officer_id AND r.service_type=officer_services.service_type AND r.category='service');
 UPDATE officer_passports SET status='suspended',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE evidence_reference LIKE 'readiness-passport:%' AND status IN ('active','expiring') AND NOT EXISTS(SELECT 1 FROM current_production_readiness_passports p WHERE 'readiness-passport:'||p.id=officer_passports.evidence_reference);
 UPDATE activation_evidence_epoch SET revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE singleton=1;
END;
CREATE TRIGGER id03_production_officer_suspensions_invalidate AFTER INSERT ON production_officer_suspensions BEGIN
 UPDATE officer_endorsements SET status='suspended' WHERE evidence_reference LIKE 'readiness-review:%' AND status='current' AND NOT EXISTS(SELECT 1 FROM current_production_readiness_reviews r WHERE 'readiness-review:'||r.id=officer_endorsements.evidence_reference);
 UPDATE officer_services SET qualified=0,opted_in=0 WHERE officer_id IN(SELECT officer_id FROM production_readiness_reviews) AND NOT EXISTS(SELECT 1 FROM current_production_readiness_reviews r WHERE r.officer_id=officer_services.officer_id AND r.service_type=officer_services.service_type AND r.category='service');
 UPDATE officer_passports SET status='suspended',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE evidence_reference LIKE 'readiness-passport:%' AND status IN ('active','expiring') AND NOT EXISTS(SELECT 1 FROM current_production_readiness_passports p WHERE 'readiness-passport:'||p.id=officer_passports.evidence_reference);
 UPDATE activation_evidence_epoch SET revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE singleton=1;
END;
CREATE TRIGGER id03_production_identity_outcomes_invalidate AFTER INSERT ON production_identity_outcomes BEGIN
 UPDATE officer_endorsements SET status='suspended' WHERE evidence_reference LIKE 'readiness-review:%' AND status='current' AND NOT EXISTS(SELECT 1 FROM current_production_readiness_reviews r WHERE 'readiness-review:'||r.id=officer_endorsements.evidence_reference);
 UPDATE officer_services SET qualified=0,opted_in=0 WHERE officer_id IN(SELECT officer_id FROM production_readiness_reviews) AND NOT EXISTS(SELECT 1 FROM current_production_readiness_reviews r WHERE r.officer_id=officer_services.officer_id AND r.service_type=officer_services.service_type AND r.category='service');
 UPDATE officer_passports SET status='suspended',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE evidence_reference LIKE 'readiness-passport:%' AND status IN ('active','expiring') AND NOT EXISTS(SELECT 1 FROM current_production_readiness_passports p WHERE 'readiness-passport:'||p.id=officer_passports.evidence_reference);
 UPDATE activation_evidence_epoch SET revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE singleton=1;
END;
CREATE TRIGGER id03_production_identity_suspensions_invalidate AFTER INSERT ON production_identity_suspensions BEGIN
 UPDATE officer_endorsements SET status='suspended' WHERE evidence_reference LIKE 'readiness-review:%' AND status='current' AND NOT EXISTS(SELECT 1 FROM current_production_readiness_reviews r WHERE 'readiness-review:'||r.id=officer_endorsements.evidence_reference);
 UPDATE officer_services SET qualified=0,opted_in=0 WHERE officer_id IN(SELECT officer_id FROM production_readiness_reviews) AND NOT EXISTS(SELECT 1 FROM current_production_readiness_reviews r WHERE r.officer_id=officer_services.officer_id AND r.service_type=officer_services.service_type AND r.category='service');
 UPDATE officer_passports SET status='suspended',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE evidence_reference LIKE 'readiness-passport:%' AND status IN ('active','expiring') AND NOT EXISTS(SELECT 1 FROM current_production_readiness_passports p WHERE 'readiness-passport:'||p.id=officer_passports.evidence_reference);
 UPDATE activation_evidence_epoch SET revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE singleton=1;
END;
CREATE TRIGGER id03_psira_verification_cases_invalidate AFTER UPDATE ON psira_verification_cases BEGIN
 UPDATE officer_endorsements SET status='suspended' WHERE evidence_reference LIKE 'readiness-review:%' AND status='current' AND NOT EXISTS(SELECT 1 FROM current_production_readiness_reviews r WHERE 'readiness-review:'||r.id=officer_endorsements.evidence_reference);
 UPDATE officer_services SET qualified=0,opted_in=0 WHERE officer_id IN(SELECT officer_id FROM production_readiness_reviews) AND NOT EXISTS(SELECT 1 FROM current_production_readiness_reviews r WHERE r.officer_id=officer_services.officer_id AND r.service_type=officer_services.service_type AND r.category='service');
 UPDATE officer_passports SET status='suspended',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE evidence_reference LIKE 'readiness-passport:%' AND status IN ('active','expiring') AND NOT EXISTS(SELECT 1 FROM current_production_readiness_passports p WHERE 'readiness-passport:'||p.id=officer_passports.evidence_reference);
 UPDATE activation_evidence_epoch SET revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE singleton=1;
END;
CREATE TRIGGER id03_signup_cases_invalidate AFTER UPDATE ON signup_cases BEGIN
 UPDATE officer_endorsements SET status='suspended' WHERE evidence_reference LIKE 'readiness-review:%' AND status='current' AND NOT EXISTS(SELECT 1 FROM current_production_readiness_reviews r WHERE 'readiness-review:'||r.id=officer_endorsements.evidence_reference);
 UPDATE officer_services SET qualified=0,opted_in=0 WHERE officer_id IN(SELECT officer_id FROM production_readiness_reviews) AND NOT EXISTS(SELECT 1 FROM current_production_readiness_reviews r WHERE r.officer_id=officer_services.officer_id AND r.service_type=officer_services.service_type AND r.category='service');
 UPDATE officer_passports SET status='suspended',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE evidence_reference LIKE 'readiness-passport:%' AND status IN ('active','expiring') AND NOT EXISTS(SELECT 1 FROM current_production_readiness_passports p WHERE 'readiness-passport:'||p.id=officer_passports.evidence_reference);
 UPDATE activation_evidence_epoch SET revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE singleton=1;
END;
CREATE TRIGGER id03_assignment_activation_commands_commit BEFORE UPDATE OF state ON assignment_activation_commands
 WHEN NEW.state='activated' AND EXISTS(SELECT 1 FROM production_entity_links WHERE kind='officer' AND entity_id=NEW.officer_id)
 AND NOT EXISTS(SELECT 1 FROM usable_production_readiness_passports p JOIN roster_slots rs ON rs.id=NEW.roster_slot_id JOIN bookings b ON b.id=rs.booking_id WHERE p.officer_id=NEW.officer_id AND julianday(p.expires_at)>=julianday(rs.ends_at)
 AND EXISTS(SELECT 1 FROM json_each(p.items_json) j JOIN current_production_readiness_reviews r ON r.id=j.value WHERE r.category='service' AND r.service_type=b.service_type)
 AND EXISTS(SELECT 1 FROM json_each(p.items_json) j JOIN current_production_readiness_reviews r ON r.id=j.value WHERE r.category='purpose' AND r.purpose_code=b.purpose_code))
 BEGIN SELECT RAISE(ABORT,'Current scoped readiness passport required through shift end'); END;
CREATE TRIGGER id03_shifts_commit BEFORE UPDATE OF status ON shifts
 WHEN NEW.status='on_post' AND EXISTS(SELECT 1 FROM production_entity_links WHERE kind='officer' AND entity_id=NEW.officer_id)
 AND NOT EXISTS(SELECT 1 FROM usable_production_readiness_passports p JOIN roster_assignments ra ON ra.shift_id=NEW.id JOIN roster_slots rs ON rs.id=ra.roster_slot_id JOIN bookings b ON b.id=rs.booking_id WHERE p.officer_id=NEW.officer_id AND julianday(p.expires_at)>=julianday(rs.ends_at)
 AND EXISTS(SELECT 1 FROM json_each(p.items_json) j JOIN current_production_readiness_reviews r ON r.id=j.value WHERE r.category='service' AND r.service_type=b.service_type)
 AND EXISTS(SELECT 1 FROM json_each(p.items_json) j JOIN current_production_readiness_reviews r ON r.id=j.value WHERE r.category='purpose' AND r.purpose_code=b.purpose_code))
 BEGIN SELECT RAISE(ABORT,'Current scoped readiness passport required through shift end'); END;

CREATE TRIGGER id03_revoke_passport AFTER INSERT ON production_readiness_holds WHEN NEW.kind='passport' AND NEW.disposition='revoke' BEGIN
 UPDATE officer_passports SET status='revoked',updated_at=NEW.recorded_at WHERE officer_id=(SELECT officer_id FROM production_readiness_passports WHERE id=NEW.target_id) AND evidence_reference LIKE 'readiness-passport:%';
END;
CREATE TRIGGER id03_decision_audit AFTER INSERT ON production_readiness_decisions BEGIN
 INSERT INTO audit_events VALUES(lower(hex(randomblob(16))),'operations',NEW.actor_id,'readiness_decision',NEW.kind,NEW.target_id,NEW.decision||': '||NEW.reason,NEW.decided_at);
END;
CREATE TRIGGER id03_hold_audit AFTER INSERT ON production_readiness_holds BEGIN
 INSERT INTO audit_events VALUES(lower(hex(randomblob(16))),'operations',NEW.actor_id,'readiness_hold',NEW.kind,NEW.target_id,NEW.disposition||': '||NEW.reason,NEW.recorded_at);
END;
CREATE TRIGGER id03_endorsement_insert_guard BEFORE INSERT ON officer_endorsements
 WHEN NEW.evidence_reference LIKE 'readiness-review:%' AND NEW.status='current'
 AND NOT EXISTS(SELECT 1 FROM current_production_readiness_reviews r WHERE NEW.evidence_reference='readiness-review:'||r.id AND NEW.officer_id=r.officer_id AND NEW.code=r.code AND NEW.category=r.category AND NEW.service_type IS r.service_type AND NEW.purpose_code IS r.purpose_code AND NEW.environment='production' AND NEW.integrity_state='verified' AND NEW.expires_at=r.expires_at AND NEW.next_due_at=r.expires_at)
 BEGIN SELECT RAISE(ABORT,'Exact approved readiness projection required'); END;
CREATE TRIGGER id03_passport_insert_guard BEFORE INSERT ON officer_passports
 WHEN NEW.evidence_reference LIKE 'readiness-passport:%' AND NEW.status IN ('active','expiring')
 AND NOT EXISTS(SELECT 1 FROM current_production_readiness_passports p WHERE NEW.evidence_reference='readiness-passport:'||p.id AND NEW.officer_id=p.officer_id AND NEW.public_token_hash=p.token_hash AND NEW.passport_number='LOKD-P-'||p.id AND NEW.environment='production' AND NEW.integrity_state='verified' AND NEW.next_review_at=p.expires_at)
 BEGIN SELECT RAISE(ABORT,'Exact approved passport projection required'); END;
CREATE TRIGGER id03_endorsement_update_guard BEFORE UPDATE ON officer_endorsements
 WHEN NEW.evidence_reference LIKE 'readiness-review:%' AND NEW.status='current'
 AND NOT EXISTS(SELECT 1 FROM current_production_readiness_reviews r WHERE NEW.evidence_reference='readiness-review:'||r.id AND NEW.officer_id=r.officer_id AND NEW.code=r.code AND NEW.category=r.category AND NEW.service_type IS r.service_type AND NEW.purpose_code IS r.purpose_code AND NEW.environment='production' AND NEW.integrity_state='verified' AND NEW.expires_at=r.expires_at AND NEW.next_due_at=r.expires_at)
 BEGIN SELECT RAISE(ABORT,'Exact approved readiness projection required'); END;
CREATE TRIGGER id03_passport_update_guard BEFORE UPDATE ON officer_passports
 WHEN NEW.evidence_reference LIKE 'readiness-passport:%' AND NEW.status IN ('active','expiring')
 AND NOT EXISTS(SELECT 1 FROM current_production_readiness_passports p WHERE NEW.evidence_reference='readiness-passport:'||p.id AND NEW.officer_id=p.officer_id AND NEW.public_token_hash=p.token_hash AND NEW.passport_number='LOKD-P-'||p.id AND NEW.environment='production' AND NEW.integrity_state='verified' AND NEW.next_review_at=p.expires_at)
 BEGIN SELECT RAISE(ABORT,'Exact approved passport projection required'); END;
CREATE TRIGGER id03_service_update_guard BEFORE UPDATE ON officer_services
 WHEN EXISTS(SELECT 1 FROM production_readiness_reviews WHERE officer_id=NEW.officer_id)
 AND ((NEW.qualified=1 AND NOT EXISTS(SELECT 1 FROM current_production_readiness_reviews r WHERE r.officer_id=NEW.officer_id AND r.category='service' AND r.service_type=NEW.service_type AND NEW.qualification_expiry=r.expires_at))
 OR (NEW.opted_in=1 AND NOT EXISTS(SELECT 1 FROM current_production_readiness_optins x WHERE x.officer_id=NEW.officer_id AND x.service_type=NEW.service_type AND x.opted_in=1)))
 BEGIN SELECT RAISE(ABORT,'Approved qualification and owned opt-in required'); END;
CREATE TRIGGER id03_endorsement_binding_guard BEFORE UPDATE ON officer_endorsements
 WHEN OLD.evidence_reference LIKE 'readiness-review:%' AND (NEW.officer_id<>OLD.officer_id OR NEW.code<>OLD.code OR coalesce(NEW.evidence_reference,'') NOT LIKE 'readiness-review:%')
 BEGIN SELECT RAISE(ABORT,'Managed readiness binding cannot be replaced'); END;
CREATE TRIGGER id03_passport_binding_guard BEFORE UPDATE ON officer_passports
 WHEN OLD.evidence_reference LIKE 'readiness-passport:%' AND (NEW.officer_id<>OLD.officer_id OR coalesce(NEW.evidence_reference,'') NOT LIKE 'readiness-passport:%')
 BEGIN SELECT RAISE(ABORT,'Managed passport binding cannot be replaced'); END;
CREATE TRIGGER id03_passport_no_delete BEFORE DELETE ON officer_passports WHEN OLD.evidence_reference LIKE 'readiness-passport:%' BEGIN SELECT RAISE(ABORT,'Managed passport projection cannot be deleted'); END;
CREATE TRIGGER id03_endorsement_no_delete BEFORE DELETE ON officer_endorsements WHEN OLD.evidence_reference LIKE 'readiness-review:%' BEGIN SELECT RAISE(ABORT,'Managed readiness projection cannot be deleted'); END;
CREATE VIEW usable_production_readiness_passports AS
 SELECT p.* FROM current_production_readiness_passports p JOIN officer_passports projection ON projection.officer_id=p.officer_id AND projection.evidence_reference='readiness-passport:'||p.id AND projection.public_token_hash=p.token_hash AND projection.status IN ('active','expiring') AND projection.environment='production' AND projection.integrity_state='verified';
CREATE TRIGGER id03_passport_no_promotion BEFORE UPDATE ON officer_passports
 WHEN NEW.evidence_reference LIKE 'readiness-passport:%' AND (OLD.environment<>'production' OR OLD.integrity_state<>'verified')
 BEGIN SELECT RAISE(ABORT,'Sandbox or legacy passport cannot be promoted'); END;
