--> statement-breakpoint
CREATE TABLE production_schedule_changes (
 id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL UNIQUE REFERENCES roster_assignments(id),
 assignment_version INTEGER NOT NULL, reason_code TEXT NOT NULL CHECK(reason_code IN ('swap','no_show','cancel')),
 note TEXT NOT NULL CHECK(length(trim(note))>=3), replacement_slot_id TEXT UNIQUE,
 replacement_starts_at TEXT, service_date TEXT, calendar_category TEXT, officer_offer_cents INTEGER,
 operator_id TEXT NOT NULL REFERENCES operator_accounts(id), user_id TEXT NOT NULL, created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER production_schedule_change_guard BEFORE INSERT ON production_schedule_changes BEGIN
 SELECT (CASE WHEN NOT EXISTS(
  SELECT 1 FROM roster_assignments ra JOIN roster_slots slot ON slot.id=ra.roster_slot_id JOIN bookings b ON b.id=slot.booking_id
  JOIN shifts s ON s.id=ra.shift_id JOIN operator_accounts a ON a.id=NEW.operator_id
  JOIN operator_role_assignments role ON role.operator_id=a.id AND role.role='operations_controller' AND role.status='active' AND role.environment='production'
  WHERE ra.id=NEW.assignment_id AND ra.version=NEW.assignment_version AND ra.status='confirmed' AND ra.active_key=ra.roster_slot_id
  AND ra.environment='production' AND ra.integrity_state='production_verified' AND s.status='confirmed' AND s.check_in_at IS NULL AND s.check_out_at IS NULL
  AND a.status='active' AND a.environment='production' AND a.approval_limit_cents>=b.client_price_cents
  AND (NEW.reason_code<>'no_show' OR julianday(slot.check_in_due_at)<=julianday('now'))
  AND (NEW.replacement_slot_id IS NULL OR (julianday(NEW.replacement_starts_at)>julianday('now') AND julianday(NEW.replacement_starts_at)<julianday(slot.ends_at) AND NEW.officer_offer_cents>0))
 ) THEN RAISE(ABORT,'Assignment, approval limit or replacement interval changed') END);
END;
--> statement-breakpoint
CREATE TRIGGER production_schedule_apply AFTER INSERT ON production_schedule_changes BEGIN
 UPDATE roster_assignments SET status=CASE WHEN NEW.reason_code='swap' THEN 'replaced' ELSE 'cancelled' END,
 active_key=NULL,released_at=NEW.created_at,version=version+1 WHERE id=NEW.assignment_id AND version=NEW.assignment_version AND status='confirmed';
 SELECT (CASE WHEN changes()<>1 THEN RAISE(ABORT,'The assignment changed before release') END);
 UPDATE roster_slots SET status='cancelled',version=version+1,updated_at=NEW.created_at
 WHERE id=(SELECT roster_slot_id FROM roster_assignments WHERE id=NEW.assignment_id)
 AND (NEW.replacement_slot_id IS NOT NULL OR NEW.reason_code='cancel');
 INSERT INTO roster_slots(id,site_id,post_id,booking_id,service_date,starts_at,ends_at,arrival_due_at,check_in_due_at,position_index,calendar_category,officer_offer_cents,environment,integrity_state,status)
 SELECT NEW.replacement_slot_id,s.site_id,s.post_id,s.booking_id,NEW.service_date,NEW.replacement_starts_at,s.ends_at,
 strftime('%Y-%m-%dT%H:%M:%fZ',NEW.replacement_starts_at,'-5 minutes'),NEW.replacement_starts_at,
 (SELECT coalesce(max(position_index),0)+1 FROM roster_slots WHERE booking_id=s.booking_id AND post_id=s.post_id AND service_date=NEW.service_date),
 NEW.calendar_category,NEW.officer_offer_cents,'production','production_verified','scheduled'
 FROM roster_slots s JOIN roster_assignments ra ON ra.roster_slot_id=s.id WHERE ra.id=NEW.assignment_id AND NEW.replacement_slot_id IS NOT NULL;
 INSERT INTO audit_events VALUES(lower(hex(randomblob(16))),'operations',NEW.user_id,'production_assignment_released','roster_assignment',NEW.assignment_id,NEW.reason_code||': '||NEW.note,NEW.created_at);
 INSERT INTO production_notifications(id,recipient,subject,body,next_attempt_at,created_at,updated_at)
 SELECT 'assignment:'||NEW.id,o.email,'LOKD Security — shift assignment changed',
 'Your assignment at '||b.site_name||' starting '||s.starts_at||' has been withdrawn. Open your Officer account for the current schedule and contact Operations with any questions.'||char(10)||char(10)||'https://officers.lokd.co.za/officer/service'||char(10)||char(10)||'LOKD Security',NEW.created_at,NEW.created_at,NEW.created_at
 FROM roster_assignments ra JOIN officers o ON o.id=ra.officer_id JOIN roster_slots s ON s.id=ra.roster_slot_id JOIN bookings b ON b.id=s.booking_id WHERE ra.id=NEW.assignment_id;
END;
--> statement-breakpoint
CREATE TRIGGER production_schedule_changes_immutable BEFORE UPDATE ON production_schedule_changes BEGIN SELECT RAISE(ABORT,'Assignment change history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER production_schedule_changes_retain BEFORE DELETE ON production_schedule_changes BEGIN SELECT RAISE(ABORT,'Assignment change history is required'); END;
