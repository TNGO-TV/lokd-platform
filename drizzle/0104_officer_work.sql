CREATE TABLE officer_notification_preferences (
 user_id TEXT PRIMARY KEY NOT NULL,
 email_enabled INTEGER NOT NULL DEFAULT 1 CHECK(email_enabled IN (0,1)),
 updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE officer_offer_responses (
 id TEXT PRIMARY KEY NOT NULL,
 offer_id TEXT NOT NULL REFERENCES offers(id),
 user_id TEXT NOT NULL,
 response TEXT NOT NULL CHECK(response IN ('accepted','declined')),
 created_at TEXT NOT NULL,
 UNIQUE(offer_id)
);
--> statement-breakpoint
CREATE TRIGGER officer_offer_response_guard BEFORE INSERT ON officer_offer_responses BEGIN
 SELECT (CASE WHEN NOT EXISTS (
  SELECT 1 FROM offers f JOIN bookings b ON b.id=f.booking_id
  JOIN production_entity_links l ON l.kind='officer' AND l.entity_id=f.officer_id AND l.owner_user_id=NEW.user_id
  JOIN signup_cases c ON c.kind=l.kind AND c.source_id=l.case_id AND c.version=l.case_version AND c.owner_user_id=l.owner_user_id AND c.status='reviewed'
  WHERE f.id=NEW.offer_id AND f.status='open' AND f.expires_at>NEW.created_at
   AND b.environment='production' AND b.integrity_state='production_verified'
   AND (NEW.response='declined' OR EXISTS(SELECT 1 FROM current_production_officer_approvals a WHERE a.officer_id=f.officer_id))
 ) THEN RAISE(ABORT,'The offer or officer approval changed. Refresh your offers.') END);
END;
--> statement-breakpoint
CREATE TRIGGER officer_offer_response_commit AFTER INSERT ON officer_offer_responses BEGIN
 UPDATE offers SET status=NEW.response,responded_at=NEW.created_at WHERE id=NEW.offer_id AND status='open';
 INSERT INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at)
 VALUES(NEW.id,'officer',NEW.user_id,'officer_offer_responded','offer',NEW.offer_id,NEW.response,NEW.created_at);
 INSERT INTO officer_work_notifications(id,user_id,kind,source_id,message,created_at)
 VALUES(NEW.id,NEW.user_id,'offer_response',NEW.offer_id,CASE WHEN NEW.response='accepted' THEN 'Offer accepted. Your confirmed assignment will appear in My shifts.' ELSE 'Offer declined.' END,NEW.created_at);
END;
--> statement-breakpoint
CREATE TABLE officer_attendance_locations (
 id TEXT PRIMARY KEY NOT NULL,
 shift_id TEXT NOT NULL REFERENCES shifts(id),
 user_id TEXT NOT NULL,
 checkpoint TEXT NOT NULL CHECK(checkpoint IN ('check_in','check_out')),
 latitude REAL NOT NULL CHECK(latitude BETWEEN -90 AND 90),
 longitude REAL NOT NULL CHECK(longitude BETWEEN -180 AND 180),
 accuracy_meters REAL NOT NULL CHECK(accuracy_meters>0 AND accuracy_meters<=150),
 captured_at TEXT NOT NULL,
 site_id TEXT NOT NULL REFERENCES operational_sites(id),
 site_version INTEGER NOT NULL,
 distance_meters REAL NOT NULL CHECK(distance_meters>=0),
 status TEXT NOT NULL DEFAULT 'received' CHECK(status IN ('received','recorded')),
 created_at TEXT NOT NULL,
 UNIQUE(shift_id,checkpoint)
);
--> statement-breakpoint
CREATE TABLE officer_work_notifications (
 id TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL,
 kind TEXT NOT NULL,
 source_id TEXT NOT NULL,
 message TEXT NOT NULL,
 created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX officer_work_notifications_owner ON officer_work_notifications(user_id,created_at);
--> statement-breakpoint
CREATE TRIGGER officer_attendance_recorded AFTER UPDATE OF status ON officer_attendance_locations
 WHEN NEW.status='recorded' AND OLD.status='received' BEGIN
 INSERT INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at)
 VALUES(NEW.id,'officer',NEW.user_id,NEW.checkpoint,'shift',NEW.shift_id,json_object('locationId',NEW.id,'capturedAt',NEW.captured_at,'distanceMeters',NEW.distance_meters),NEW.created_at);
 INSERT INTO officer_work_notifications(id,user_id,kind,source_id,message,created_at)
 VALUES(NEW.id,NEW.user_id,NEW.checkpoint,NEW.shift_id,CASE WHEN NEW.checkpoint='check_in' THEN 'You are checked in.' ELSE 'You are checked out. Your hours are awaiting review.' END,NEW.created_at);
END;
--> statement-breakpoint
CREATE TRIGGER officer_attendance_received AFTER INSERT ON officer_attendance_locations BEGIN
 INSERT INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at)
 VALUES(lower(hex(randomblob(16))),'officer',NEW.user_id,'attendance_location_received','shift',NEW.shift_id,json_object('locationId',NEW.id,'checkpoint',NEW.checkpoint,'capturedAt',NEW.captured_at,'siteId',NEW.site_id,'siteVersion',NEW.site_version),NEW.created_at);
END;
--> statement-breakpoint
CREATE TRIGGER officer_attendance_recaptured AFTER UPDATE OF captured_at ON officer_attendance_locations
 WHEN OLD.status='received' BEGIN
 INSERT INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at)
 VALUES(lower(hex(randomblob(16))),'officer',NEW.user_id,'attendance_location_recaptured','shift',NEW.shift_id,json_object('locationId',NEW.id,'checkpoint',NEW.checkpoint,'capturedAt',NEW.captured_at,'siteId',NEW.site_id,'siteVersion',NEW.site_version),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
