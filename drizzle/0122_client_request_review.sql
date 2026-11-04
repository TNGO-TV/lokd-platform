CREATE TRIGGER client_service_request_review_guard BEFORE INSERT ON audit_events
WHEN NEW.event_type='client_service_request_reviewed' AND NOT EXISTS(
 SELECT 1 FROM service_requests r WHERE r.id=NEW.entity_id
 AND NEW.actor_type='operations' AND r.requested_by_id!=NEW.actor_id
 AND r.requested_by_role='client' AND r.environment='production' AND r.integrity_state='production_verified'
 AND r.category IN ('client_site','booking_request','booking_change','booking_cancellation','shift_rating','service_issue')
 AND r.version=json_extract(NEW.detail,'$.expectedVersion')
 AND (r.owner_id IS NULL OR r.owner_id=NEW.actor_id OR json_extract(NEW.detail,'$.ownerOverride')=1)
 AND ((r.status='open' AND json_extract(NEW.detail,'$.status') IN ('triaged','closed'))
 OR (r.status='triaged' AND json_extract(NEW.detail,'$.status')='closed'))
)
BEGIN SELECT RAISE(ABORT,'client_service_request_review_changed'); END;
--> statement-breakpoint
CREATE TRIGGER client_closed_booking_request_guard BEFORE INSERT ON service_requests
WHEN NEW.environment='production' AND NEW.category IN ('booking_change','booking_cancellation')
 AND EXISTS(SELECT 1 FROM bookings b WHERE b.id=NEW.booking_id AND (b.status='cancelled' OR (
 b.shift_count>0
 AND (SELECT count(*) FROM roster_slots r WHERE r.booking_id=b.id AND r.environment='production' AND r.status!='cancelled')>=b.shift_count
 AND NOT EXISTS(SELECT 1 FROM roster_slots r WHERE r.booking_id=b.id AND r.environment='production' AND r.status!='cancelled'
  AND NOT EXISTS(SELECT 1 FROM roster_assignments a JOIN shifts s ON s.id=a.shift_id
   WHERE a.roster_slot_id=r.id AND a.environment='production' AND a.status='confirmed' AND a.active_key=r.id
   AND s.environment='production' AND s.status IN ('completed','verified')))
 )))
BEGIN SELECT RAISE(ABORT,'client_booking_already_closed'); END;
