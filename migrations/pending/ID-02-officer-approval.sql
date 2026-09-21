-- Apply after ID-01; Central Command assigns final migration/schema order.
CREATE TABLE production_officer_reviews (
 id TEXT PRIMARY KEY, officer_id TEXT NOT NULL REFERENCES officers(id), source_json TEXT NOT NULL,
 source_hash TEXT NOT NULL, prepared_by TEXT NOT NULL, prepared_at TEXT NOT NULL, reason TEXT NOT NULL
);
CREATE TABLE production_officer_decisions (
 review_id TEXT PRIMARY KEY REFERENCES production_officer_reviews(id), decision TEXT NOT NULL CHECK(decision IN ('approve','reject')),
 actor_id TEXT NOT NULL, actor_email TEXT NOT NULL, reason TEXT NOT NULL, decided_at TEXT NOT NULL
);
CREATE TABLE production_officer_suspensions (
 id TEXT PRIMARY KEY, officer_id TEXT NOT NULL REFERENCES officers(id), actor_id TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE VIEW current_production_officer_sources AS
 SELECT o.id AS officer_id,l.case_id AS applicant_id,l.case_version AS applicant_version,l.owner_user_id,
 o.full_name,o.mobile,o.email,o.city,o.psira_number,o.psira_grade,
 i.id AS identity_case_id,i.outcome_id AS identity_outcome_id,i.reviewed_by AS identity_reviewer,l.prepared_by AS entity_preparer,
 p.id AS psira_case_id,e.id AS psira_event_id,e.recorded_by AS psira_reviewer,
 json_extract(e.evidence_json,'$.certificateExpiry') AS certificate_expiry,
 strftime('%Y-%m-%dT%H:%M:%fZ',min(julianday(i.expires_at),julianday(e.recheck_at),julianday(json_extract(e.evidence_json,'$.certificateExpiry')||'T00:00:00+02:00'))) AS expires_at
 FROM officers o JOIN production_entity_links l ON l.kind='officer' AND l.entity_id=o.id
 JOIN signup_cases c ON c.kind=l.kind AND c.source_id=l.case_id AND c.version=l.case_version AND c.owner_user_id=l.owner_user_id AND c.status='reviewed'
 JOIN officer_applications a ON a.id=c.source_id AND a.environment='prelaunch' AND a.integrity_state='user_submitted'
 JOIN current_production_identity_evidence i ON i.applicant_id=l.case_id AND i.applicant_version=l.case_version AND i.owner_user_id=l.owner_user_id
 JOIN psira_verification_cases p ON p.owner_user_id=l.owner_user_id AND p.psira_number=o.psira_number AND p.declaration='registered'
 JOIN psira_verification_events e ON e.id=p.latest_event_id AND e.case_id=p.id AND e.version=p.version AND e.psira_number=p.psira_number
 WHERE e.kind='review' AND e.declaration='registered' AND e.registration_status='registered' AND e.identity_match='confirmed'
 AND julianday(e.recheck_at)>julianday('now')
 AND julianday(json_extract(e.evidence_json,'$.checkedAt')) BETWEEN julianday('now','-30 days') AND julianday('now','+1 minute')
 AND julianday(e.recheck_at)<=julianday(json_extract(e.evidence_json,'$.checkedAt'),'+30 days')
 AND julianday(json_extract(e.evidence_json,'$.certificateExpiry')||'T00:00:00+02:00')>julianday('now')
 AND json_extract(e.evidence_json,'$.source')='https://digitalservices.psira.co.za/verify-user/4'
 AND json_extract(e.evidence_json,'$.returnedNumber')=o.psira_number
 AND lower(trim(json_extract(e.evidence_json,'$.returnedName')))=lower(trim(o.full_name))
 AND lower(json_extract(e.evidence_json,'$.returnedStatus'))='registered'
 AND upper(trim(replace(lower(json_extract(e.evidence_json,'$.grade')),'grade ','')))=upper(trim(replace(lower(o.psira_grade),'grade ','')))
 AND json_extract(e.evidence_json,'$.identityEvidence')='production-identity:'||i.outcome_id
 AND coalesce(json_extract(c.corrections_json,'$.pathway'),a.pathway)<>'training'
 AND coalesce(json_extract(c.corrections_json,'$.psiraStatus'),a.psira_status) IN ('active','expired')
 AND o.full_name=coalesce(json_extract(c.corrections_json,'$.fullName'),a.full_name)
 AND o.mobile=coalesce(json_extract(c.corrections_json,'$.mobile'),a.mobile_normalized)
 AND o.email=a.email_normalized
 AND o.city=coalesce(json_extract(c.corrections_json,'$.city'),a.city)
 AND o.psira_number=coalesce(json_extract(c.corrections_json,'$.psiraNumber'),a.psira_number)
 AND o.psira_grade=coalesce(json_extract(c.corrections_json,'$.psiraGrade'),a.psira_grade);
CREATE VIEW current_production_officer_reviews AS
 SELECT r.*,s.expires_at,s.certificate_expiry FROM production_officer_reviews r JOIN current_production_officer_sources s ON s.officer_id=r.officer_id AND json_extract(r.source_json,'$.officer_id')=s.officer_id AND json_extract(r.source_json,'$.applicant_id')=s.applicant_id AND json_extract(r.source_json,'$.applicant_version')=s.applicant_version AND json_extract(r.source_json,'$.owner_user_id')=s.owner_user_id AND json_extract(r.source_json,'$.full_name')=s.full_name AND json_extract(r.source_json,'$.mobile')=s.mobile AND json_extract(r.source_json,'$.email')=s.email AND json_extract(r.source_json,'$.city')=s.city AND json_extract(r.source_json,'$.psira_number')=s.psira_number AND json_extract(r.source_json,'$.psira_grade')=s.psira_grade AND json_extract(r.source_json,'$.identity_case_id')=s.identity_case_id AND json_extract(r.source_json,'$.identity_outcome_id')=s.identity_outcome_id AND json_extract(r.source_json,'$.identity_reviewer')=s.identity_reviewer AND json_extract(r.source_json,'$.entity_preparer')=s.entity_preparer AND json_extract(r.source_json,'$.psira_case_id')=s.psira_case_id AND json_extract(r.source_json,'$.psira_event_id')=s.psira_event_id AND json_extract(r.source_json,'$.psira_reviewer')=s.psira_reviewer AND json_extract(r.source_json,'$.certificate_expiry')=s.certificate_expiry AND json_extract(r.source_json,'$.expires_at')=s.expires_at
 WHERE NOT EXISTS(SELECT 1 FROM production_officer_suspensions x WHERE x.officer_id=r.officer_id AND x.created_at>=r.prepared_at);
CREATE VIEW current_production_officer_approvals AS
 SELECT r.* FROM current_production_officer_reviews r JOIN production_officer_decisions d ON d.review_id=r.id AND d.decision='approve';
CREATE TRIGGER production_officer_prepare_guard BEFORE INSERT ON production_officer_reviews BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM current_production_officer_sources s JOIN officers o ON o.id=s.officer_id WHERE s.officer_id=NEW.officer_id AND o.approval_status IN ('pending','suspended') AND s.owner_user_id<>NEW.prepared_by AND s.entity_preparer<>s.owner_user_id AND json_extract(NEW.source_json,'$.officer_id')=s.officer_id AND json_extract(NEW.source_json,'$.applicant_id')=s.applicant_id AND json_extract(NEW.source_json,'$.applicant_version')=s.applicant_version AND json_extract(NEW.source_json,'$.owner_user_id')=s.owner_user_id AND json_extract(NEW.source_json,'$.full_name')=s.full_name AND json_extract(NEW.source_json,'$.mobile')=s.mobile AND json_extract(NEW.source_json,'$.email')=s.email AND json_extract(NEW.source_json,'$.city')=s.city AND json_extract(NEW.source_json,'$.psira_number')=s.psira_number AND json_extract(NEW.source_json,'$.psira_grade')=s.psira_grade AND json_extract(NEW.source_json,'$.identity_case_id')=s.identity_case_id AND json_extract(NEW.source_json,'$.identity_outcome_id')=s.identity_outcome_id AND json_extract(NEW.source_json,'$.identity_reviewer')=s.identity_reviewer AND json_extract(NEW.source_json,'$.entity_preparer')=s.entity_preparer AND json_extract(NEW.source_json,'$.psira_case_id')=s.psira_case_id AND json_extract(NEW.source_json,'$.psira_event_id')=s.psira_event_id AND json_extract(NEW.source_json,'$.psira_reviewer')=s.psira_reviewer AND json_extract(NEW.source_json,'$.certificate_expiry')=s.certificate_expiry AND json_extract(NEW.source_json,'$.expires_at')=s.expires_at) THEN RAISE(ABORT,'Current owner-bound officer evidence required') END;
END;
CREATE TRIGGER production_officer_decision_guard BEFORE INSERT ON production_officer_decisions BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM production_officer_reviews r WHERE r.id=NEW.review_id AND r.prepared_by<>NEW.actor_id AND json_extract(r.source_json,'$.owner_user_id')<>NEW.actor_id AND json_extract(r.source_json,'$.identity_reviewer')<>NEW.actor_id AND json_extract(r.source_json,'$.entity_preparer')<>NEW.actor_id AND lower(json_extract(r.source_json,'$.psira_reviewer'))<>lower(NEW.actor_email)) THEN RAISE(ABORT,'Independent officer reviewer required') END;
 SELECT CASE WHEN NEW.decision='approve' AND NOT EXISTS(SELECT 1 FROM current_production_officer_reviews r JOIN officers o ON o.id=r.officer_id WHERE r.id=NEW.review_id AND o.approval_status IN ('pending','suspended')) THEN RAISE(ABORT,'Officer approval evidence changed or expired') END;
END;
CREATE TRIGGER production_officer_approval_guard BEFORE UPDATE OF approval_status ON officers
 WHEN NEW.approval_status='approved' AND EXISTS(SELECT 1 FROM production_entity_links WHERE kind='officer' AND entity_id=NEW.id)
 AND NOT EXISTS(SELECT 1 FROM current_production_officer_approvals WHERE officer_id=NEW.id)
 BEGIN SELECT RAISE(ABORT,'Independent current officer approval required'); END;
CREATE TRIGGER production_officer_apply_decision AFTER INSERT ON production_officer_decisions BEGIN
 UPDATE officers SET approval_status='approved',psira_expiry=(SELECT certificate_expiry FROM current_production_officer_reviews WHERE id=NEW.review_id) WHERE id=(SELECT officer_id FROM production_officer_reviews WHERE id=NEW.review_id) AND NEW.decision='approve';
 INSERT INTO compliance_records(id,officer_id,record_type,status,environment,integrity_state,evidence_reference,verified_at,expires_at,next_due_at)
 SELECT 'ID-BRIDGE-'||r.id,r.officer_id,'identity','current','production','verified','officer-review:'||r.id,NEW.decided_at,r.expires_at,r.expires_at FROM current_production_officer_reviews r WHERE r.id=NEW.review_id AND NEW.decision='approve';
 INSERT INTO compliance_records(id,officer_id,record_type,status,environment,integrity_state,evidence_reference,verified_at,expires_at,next_due_at)
 SELECT 'PSIRA-BRIDGE-'||r.id,r.officer_id,'psira','current','production','verified','officer-review:'||r.id,NEW.decided_at,r.expires_at,r.expires_at FROM current_production_officer_reviews r WHERE r.id=NEW.review_id AND NEW.decision='approve';
 INSERT INTO audit_events VALUES(lower(hex(randomblob(16))),'operations',NEW.actor_id,'officer_review_decided','officer_review',NEW.review_id,NEW.decision||': '||NEW.reason,NEW.decided_at);
 UPDATE activation_evidence_epoch SET revision=revision+1,updated_at=NEW.decided_at WHERE singleton=1;
END;
CREATE TRIGGER production_officer_apply_suspension AFTER INSERT ON production_officer_suspensions BEGIN
 UPDATE officers SET approval_status='suspended' WHERE id=NEW.officer_id;
 INSERT INTO audit_events VALUES(lower(hex(randomblob(16))),'operations',NEW.actor_id,'officer_suspended','officer',NEW.officer_id,NEW.reason,NEW.created_at);
 UPDATE activation_evidence_epoch SET revision=revision+1,updated_at=NEW.created_at WHERE singleton=1;
END;
CREATE TRIGGER production_officer_reviews_no_update BEFORE UPDATE ON production_officer_reviews BEGIN SELECT RAISE(ABORT,'Officer approval evidence is immutable'); END;
CREATE TRIGGER production_officer_reviews_no_delete BEFORE DELETE ON production_officer_reviews BEGIN SELECT RAISE(ABORT,'Officer approval evidence is immutable'); END;
CREATE TRIGGER production_officer_decisions_no_update BEFORE UPDATE ON production_officer_decisions BEGIN SELECT RAISE(ABORT,'Officer approval evidence is immutable'); END;
CREATE TRIGGER production_officer_decisions_no_delete BEFORE DELETE ON production_officer_decisions BEGIN SELECT RAISE(ABORT,'Officer approval evidence is immutable'); END;
CREATE TRIGGER production_officer_suspensions_no_update BEFORE UPDATE ON production_officer_suspensions BEGIN SELECT RAISE(ABORT,'Officer approval evidence is immutable'); END;
CREATE TRIGGER production_officer_suspensions_no_delete BEFORE DELETE ON production_officer_suspensions BEGIN SELECT RAISE(ABORT,'Officer approval evidence is immutable'); END;
CREATE TRIGGER id02_production_identity_outcomes_invalidate AFTER INSERT ON production_identity_outcomes WHEN 1 BEGIN
 UPDATE officers SET approval_status='suspended' WHERE approval_status='approved' AND id IN(SELECT entity_id FROM production_entity_links WHERE kind='officer') AND NOT EXISTS(SELECT 1 FROM current_production_officer_approvals a WHERE a.officer_id=officers.id);
 UPDATE activation_evidence_epoch SET revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE singleton=1;
END;
CREATE TRIGGER id02_production_identity_suspensions_invalidate AFTER INSERT ON production_identity_suspensions WHEN 1 BEGIN
 UPDATE officers SET approval_status='suspended' WHERE approval_status='approved' AND id IN(SELECT entity_id FROM production_entity_links WHERE kind='officer') AND NOT EXISTS(SELECT 1 FROM current_production_officer_approvals a WHERE a.officer_id=officers.id);
 UPDATE activation_evidence_epoch SET revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE singleton=1;
END;
CREATE TRIGGER id02_psira_verification_cases_invalidate AFTER UPDATE ON psira_verification_cases WHEN 1 BEGIN
 UPDATE officers SET approval_status='suspended' WHERE approval_status='approved' AND id IN(SELECT entity_id FROM production_entity_links WHERE kind='officer') AND NOT EXISTS(SELECT 1 FROM current_production_officer_approvals a WHERE a.officer_id=officers.id);
 UPDATE activation_evidence_epoch SET revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE singleton=1;
END;
CREATE TRIGGER id02_signup_cases_invalidate AFTER UPDATE ON signup_cases WHEN NEW.kind='officer' BEGIN
 UPDATE officers SET approval_status='suspended' WHERE approval_status='approved' AND id IN(SELECT entity_id FROM production_entity_links WHERE kind='officer') AND NOT EXISTS(SELECT 1 FROM current_production_officer_approvals a WHERE a.officer_id=officers.id);
 UPDATE activation_evidence_epoch SET revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE singleton=1;
END;
CREATE TRIGGER id02_production_entity_links_invalidate AFTER UPDATE ON production_entity_links WHEN NEW.kind='officer' BEGIN
 UPDATE officers SET approval_status='suspended' WHERE approval_status='approved' AND id IN(SELECT entity_id FROM production_entity_links WHERE kind='officer') AND NOT EXISTS(SELECT 1 FROM current_production_officer_approvals a WHERE a.officer_id=officers.id);
 UPDATE activation_evidence_epoch SET revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE singleton=1;
END;
CREATE TRIGGER id02_officer_details_invalidate AFTER UPDATE OF full_name,mobile,email,city,psira_number,psira_grade ON officers
 WHEN EXISTS(SELECT 1 FROM production_entity_links WHERE kind='officer' AND entity_id=NEW.id) AND (NEW.full_name IS NOT OLD.full_name OR NEW.mobile IS NOT OLD.mobile OR NEW.email IS NOT OLD.email OR NEW.city IS NOT OLD.city OR NEW.psira_number IS NOT OLD.psira_number OR NEW.psira_grade IS NOT OLD.psira_grade)
 BEGIN INSERT INTO production_officer_suspensions VALUES(lower(hex(randomblob(16))),NEW.id,'system','Officer details changed',strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;
CREATE TRIGGER id02_activation_commit_guard BEFORE UPDATE OF state ON assignment_activation_commands
 WHEN NEW.state='activated' AND EXISTS(SELECT 1 FROM production_entity_links WHERE kind='officer' AND entity_id=NEW.officer_id)
 AND NOT EXISTS(SELECT 1 FROM current_production_officer_approvals a JOIN officers o ON o.id=a.officer_id AND o.approval_status='approved' JOIN roster_slots r ON r.id=NEW.roster_slot_id WHERE a.officer_id=NEW.officer_id AND julianday(a.expires_at)>=julianday(r.ends_at))
 BEGIN SELECT RAISE(ABORT,'Officer evidence changed or expires before assignment end'); END;
CREATE TRIGGER id02_checkin_commit_guard BEFORE UPDATE OF status ON shifts
 WHEN NEW.status='on_post' AND EXISTS(SELECT 1 FROM production_entity_links WHERE kind='officer' AND entity_id=NEW.officer_id)
 AND NOT EXISTS(SELECT 1 FROM current_production_officer_approvals a JOIN officers o ON o.id=a.officer_id AND o.approval_status='approved' JOIN roster_assignments ra ON ra.officer_id=o.id AND ra.shift_id=NEW.id JOIN roster_slots r ON r.id=ra.roster_slot_id WHERE a.officer_id=NEW.officer_id AND julianday(a.expires_at)>=julianday(r.ends_at))
 BEGIN SELECT RAISE(ABORT,'Current officer approval required through service date'); END;
CREATE TRIGGER id02_compliance_immutable BEFORE UPDATE ON compliance_records
 WHEN OLD.evidence_reference LIKE 'officer-review:%'
 BEGIN SELECT RAISE(ABORT,'Bridge compliance evidence is immutable'); END;
CREATE TRIGGER id02_compliance_no_delete BEFORE DELETE ON compliance_records
 WHEN OLD.evidence_reference LIKE 'officer-review:%'
 BEGIN SELECT RAISE(ABORT,'Bridge compliance evidence is immutable'); END;
CREATE TRIGGER id02_compliance_insert_guard BEFORE INSERT ON compliance_records
 WHEN NEW.evidence_reference LIKE 'officer-review:%'
 AND NOT EXISTS(SELECT 1 FROM current_production_officer_approvals a JOIN production_officer_decisions d ON d.review_id=a.id
 WHERE NEW.evidence_reference='officer-review:'||a.id AND NEW.officer_id=a.officer_id
 AND ((NEW.record_type='identity' AND NEW.id='ID-BRIDGE-'||a.id) OR (NEW.record_type='psira' AND NEW.id='PSIRA-BRIDGE-'||a.id))
 AND NEW.environment='production' AND NEW.integrity_state='verified' AND NEW.status='current'
 AND NEW.verified_at=d.decided_at AND NEW.expires_at=a.expires_at AND NEW.next_due_at=a.expires_at)
 BEGIN SELECT RAISE(ABORT,'Exact approved officer compliance projection required'); END;
CREATE TRIGGER id02_officer_insert_guard BEFORE INSERT ON officers
 WHEN NEW.approval_status='approved' AND EXISTS(SELECT 1 FROM production_entity_links WHERE kind='officer' AND entity_id=NEW.id)
 BEGIN SELECT RAISE(ABORT,'Prepare pending officer before independent approval'); END;
CREATE TRIGGER id02_link_insert_epoch AFTER INSERT ON production_entity_links WHEN NEW.kind='officer' BEGIN
 UPDATE activation_evidence_epoch SET revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE singleton=1;
END;
