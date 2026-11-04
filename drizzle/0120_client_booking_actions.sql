ALTER TABLE bookings ADD COLUMN client_version INTEGER NOT NULL DEFAULT 1;
--> statement-breakpoint
CREATE TRIGGER booking_client_version AFTER UPDATE OF status,funding_status,start_date,end_date,shift_start,shift_end,client_price_cents ON bookings
WHEN NEW.environment='production'
BEGIN UPDATE bookings SET client_version=OLD.client_version+1 WHERE id=NEW.id; END;
--> statement-breakpoint
CREATE UNIQUE INDEX client_shift_rating_once ON service_requests(shift_id,requested_by_id)
WHERE category='shift_rating' AND environment='production';
--> statement-breakpoint
CREATE INDEX client_request_owner ON service_requests(requested_by_id,environment,category,created_at);
--> statement-breakpoint
CREATE TRIGGER client_request_mutation_guard BEFORE INSERT ON audit_events
WHEN NEW.event_type IN ('client_site_changed','client_cover_changed','client_cover_cancelled')
AND NOT EXISTS(SELECT 1 FROM service_requests r WHERE r.id=NEW.entity_id
 AND r.requested_by_id=NEW.actor_id AND r.requested_by_role='client'
 AND r.environment='production' AND r.version=json_extract(NEW.detail,'$.expectedVersion')
 AND r.status='open' AND r.category IN ('client_site','booking_request'))
BEGIN SELECT RAISE(ABORT,'client_request_changed'); END;
--> statement-breakpoint
CREATE TRIGGER client_booking_cancel_guard BEFORE INSERT ON audit_events
WHEN NEW.event_type='client_booking_cancelled' AND NOT EXISTS(
 SELECT 1 FROM bookings b JOIN production_entity_links l ON l.entity_id=b.client_id AND l.kind='client'
 WHERE b.id=NEW.entity_id AND l.owner_user_id=NEW.actor_id AND b.environment='production'
 AND b.client_version=json_extract(NEW.detail,'$.expectedVersion') AND b.status='draft' AND b.funding_status='unfunded'
 AND datetime(b.start_date||'T'||b.shift_start||':00','-2 hours')>datetime('now')
 AND NOT EXISTS(SELECT 1 FROM shifts s WHERE s.booking_id=b.id)
 AND NOT EXISTS(SELECT 1 FROM offers o WHERE o.booking_id=b.id AND o.status IN ('open','accepted'))
 AND NOT EXISTS(SELECT 1 FROM roster_assignments a JOIN roster_slots r ON r.id=a.roster_slot_id WHERE r.booking_id=b.id)
 AND NOT EXISTS(SELECT 1 FROM client_quote_offers q JOIN client_quote_receipts r ON r.quote_id=q.id WHERE q.order_id=b.id)
 AND NOT EXISTS(SELECT 1 FROM agreement_acceptance_receipts a JOIN roster_slots r ON r.id=json_extract(a.receipt_json,'$.context.transactionId') WHERE r.booking_id=b.id AND json_extract(a.receipt_json,'$.purpose')='client_service')
 AND NOT EXISTS(SELECT 1 FROM booking_collection_requests c WHERE c.order_id=b.id)
)
BEGIN SELECT RAISE(ABORT,'client_booking_cancellation_requires_review'); END;
--> statement-breakpoint
CREATE TRIGGER client_shift_feedback_guard BEFORE INSERT ON service_requests
WHEN NEW.environment='production' AND NEW.category IN ('shift_rating','service_issue') AND (
 NOT EXISTS(SELECT 1 FROM shifts s JOIN bookings b ON b.id=s.booking_id
 JOIN production_entity_links l ON l.kind='client' AND l.entity_id=b.client_id
 WHERE s.id=NEW.shift_id AND b.id=NEW.booking_id AND b.client_id=NEW.client_id
 AND l.owner_user_id=NEW.requested_by_id AND NEW.requested_by_role='client'
 AND s.environment='production' AND s.integrity_state='production_verified'
 AND (NEW.category!='shift_rating' OR s.status IN ('completed','verified')))
 OR (NEW.category='shift_rating' AND (COALESCE(json_type(NEW.detail,'$.score'),'')!='integer' OR json_extract(NEW.detail,'$.score') NOT BETWEEN 1 AND 5))
)
BEGIN SELECT RAISE(ABORT,'client_feedback_requires_owned_shift'); END;
--> statement-breakpoint
CREATE TRIGGER client_service_decision_guard BEFORE INSERT ON production_service_events
WHEN NEW.action IN ('client_signoff','client_dispute') AND NOT EXISTS(
 SELECT 1 FROM shifts s JOIN bookings b ON b.id=s.booking_id
 JOIN production_entity_links l ON l.kind='client' AND l.entity_id=b.client_id
 JOIN shift_timesheets t ON t.shift_id=s.id AND t.active_key=s.id
 WHERE s.id=NEW.shift_id AND l.owner_user_id=NEW.actor_id
 AND s.environment='production' AND s.status IN ('completed','verified')
 AND t.client_evidence_status='pending' AND t.operations_status='awaiting_review'
 AND t.version=json_extract(NEW.detail,'$.expectedVersion')
)
BEGIN SELECT RAISE(ABORT,'client_service_decision_changed'); END;
