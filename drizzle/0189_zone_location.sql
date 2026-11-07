-- Private, short-lived sharing. Attendance evidence remains in its own ledger.
CREATE TABLE officer_dispatch_consents (
 owner_user_id TEXT PRIMARY KEY NOT NULL,
 officer_id TEXT NOT NULL REFERENCES officers(id),
 revision INTEGER NOT NULL CHECK(revision > 0),
 session_id TEXT NOT NULL UNIQUE,
 active INTEGER NOT NULL CHECK(active IN (0,1)),
 mode TEXT NOT NULL CHECK(mode IN ('dispatch','en_route')),
 shift_id TEXT REFERENCES shifts(id),
 expires_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 CHECK((mode='dispatch' AND shift_id IS NULL) OR (mode='en_route' AND shift_id IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE officer_dispatch_locations (
 owner_user_id TEXT PRIMARY KEY NOT NULL REFERENCES officer_dispatch_consents(owner_user_id) ON DELETE CASCADE,
 revision INTEGER NOT NULL,
 session_id TEXT NOT NULL,
 latitude REAL NOT NULL CHECK(latitude BETWEEN -35 AND -22),
 longitude REAL NOT NULL CHECK(longitude BETWEEN 16 AND 33),
 accuracy_meters REAL NOT NULL CHECK(accuracy_meters > 0 AND accuracy_meters <= 150),
 captured_at TEXT NOT NULL,
 expires_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER officer_dispatch_consent_insert BEFORE INSERT ON officer_dispatch_consents WHEN NEW.active=1 BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM officers o JOIN production_entity_links l ON l.kind='officer' AND l.entity_id=o.id JOIN current_production_officer_approvals a ON a.officer_id=o.id AND json_extract(a.source_json,'$.owner_user_id')=l.owner_user_id WHERE o.id=NEW.officer_id AND l.owner_user_id=NEW.owner_user_id AND o.approval_status='approved' AND julianday(a.expires_at)>julianday('now')) THEN RAISE(ABORT,'zone_location_approval_changed') END);
 SELECT (CASE WHEN NEW.mode='en_route' AND NOT EXISTS(SELECT 1 FROM shifts s JOIN roster_assignments r ON r.shift_id=s.id AND r.officer_id=s.officer_id AND r.status='confirmed' AND r.active_key=r.roster_slot_id WHERE s.id=NEW.shift_id AND s.officer_id=NEW.officer_id AND s.status='confirmed' AND s.environment='production' AND s.integrity_state='production_verified') THEN RAISE(ABORT,'zone_location_assignment_changed') END);
END;
--> statement-breakpoint
CREATE TRIGGER officer_dispatch_consent_update BEFORE UPDATE ON officer_dispatch_consents WHEN NEW.active=1 BEGIN
 SELECT (CASE WHEN NEW.revision<=OLD.revision OR NEW.owner_user_id!=OLD.owner_user_id OR NOT EXISTS(SELECT 1 FROM officers o JOIN production_entity_links l ON l.kind='officer' AND l.entity_id=o.id JOIN current_production_officer_approvals a ON a.officer_id=o.id AND json_extract(a.source_json,'$.owner_user_id')=l.owner_user_id WHERE o.id=NEW.officer_id AND l.owner_user_id=NEW.owner_user_id AND o.approval_status='approved' AND julianday(a.expires_at)>julianday('now')) THEN RAISE(ABORT,'zone_location_approval_changed') END);
 SELECT (CASE WHEN NEW.mode='en_route' AND NOT EXISTS(SELECT 1 FROM shifts s JOIN roster_assignments r ON r.shift_id=s.id AND r.officer_id=s.officer_id AND r.status='confirmed' AND r.active_key=r.roster_slot_id WHERE s.id=NEW.shift_id AND s.officer_id=NEW.officer_id AND s.status='confirmed' AND s.environment='production' AND s.integrity_state='production_verified') THEN RAISE(ABORT,'zone_location_assignment_changed') END);
END;
--> statement-breakpoint
CREATE TRIGGER officer_dispatch_consent_clear AFTER UPDATE ON officer_dispatch_consents BEGIN
 DELETE FROM officer_dispatch_locations WHERE owner_user_id=NEW.owner_user_id;
END;
--> statement-breakpoint
CREATE TRIGGER officer_dispatch_point_insert BEFORE INSERT ON officer_dispatch_locations BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM officer_dispatch_consents c JOIN officers o ON o.id=c.officer_id JOIN current_production_officer_approvals a ON a.officer_id=o.id AND json_extract(a.source_json,'$.owner_user_id')=c.owner_user_id WHERE c.owner_user_id=NEW.owner_user_id AND c.session_id=NEW.session_id AND c.revision=NEW.revision AND c.active=1 AND o.approval_status='approved' AND julianday(a.expires_at)>julianday('now') AND julianday(c.expires_at)>julianday('now') AND julianday(NEW.expires_at)<=julianday(c.expires_at) AND julianday(NEW.captured_at)>=julianday('now','-2 minutes') AND julianday(NEW.captured_at)<=julianday('now','+10 seconds') AND (c.mode='dispatch' OR EXISTS(SELECT 1 FROM shifts s JOIN roster_assignments r ON r.shift_id=s.id AND r.status='confirmed' AND r.active_key=r.roster_slot_id WHERE s.id=c.shift_id AND s.officer_id=c.officer_id AND s.status='confirmed'))) THEN RAISE(ABORT,'zone_location_consent_changed') END);
END;
--> statement-breakpoint
CREATE TRIGGER officer_dispatch_point_update BEFORE UPDATE ON officer_dispatch_locations BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM officer_dispatch_consents c JOIN officers o ON o.id=c.officer_id JOIN current_production_officer_approvals a ON a.officer_id=o.id AND json_extract(a.source_json,'$.owner_user_id')=c.owner_user_id WHERE c.owner_user_id=NEW.owner_user_id AND c.session_id=NEW.session_id AND c.revision=NEW.revision AND c.active=1 AND o.approval_status='approved' AND julianday(a.expires_at)>julianday('now') AND julianday(c.expires_at)>julianday('now') AND julianday(NEW.expires_at)<=julianday(c.expires_at) AND julianday(NEW.captured_at)>=julianday('now','-2 minutes') AND julianday(NEW.captured_at)<=julianday('now','+10 seconds') AND (c.mode='dispatch' OR EXISTS(SELECT 1 FROM shifts s JOIN roster_assignments r ON r.shift_id=s.id AND r.status='confirmed' AND r.active_key=r.roster_slot_id WHERE s.id=c.shift_id AND s.officer_id=c.officer_id AND s.status='confirmed'))) THEN RAISE(ABORT,'zone_location_consent_changed') END);
END;
