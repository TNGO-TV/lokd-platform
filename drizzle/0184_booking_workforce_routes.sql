-- Each assignment already records its route in workforce_model. Check it
-- against the linked booking, and freeze the booking model in its evidence.
CREATE TRIGGER assignment_booking_workforce_route_guard
BEFORE INSERT ON assignment_workforce_snapshots
WHEN NEW.environment = 'production'
BEGIN
  SELECT (CASE WHEN NOT EXISTS (
    SELECT 1 FROM roster_assignments assignment
    JOIN roster_slots slot ON slot.id = assignment.roster_slot_id
    JOIN bookings booking ON booking.id = slot.booking_id
    WHERE assignment.id = NEW.roster_assignment_id
      AND ((booking.engagement_model = 'flex' AND NEW.workforce_model IN ('direct_flex', 'partner'))
        OR (booking.engagement_model = 'fixed' AND NEW.workforce_model IN ('managed', 'partner')))
  ) THEN RAISE(ABORT, 'booking_workforce_route_mismatch') END);
END;
--> statement-breakpoint
CREATE TRIGGER activation_booking_workforce_route_guard
BEFORE INSERT ON assignment_activation_snapshots
WHEN NEW.environment = 'production'
BEGIN
  SELECT (CASE WHEN NOT EXISTS (
    SELECT 1 FROM bookings booking WHERE booking.id = NEW.booking_id
      AND json_extract(NEW.site_evidence, '$.bookingModel') IS booking.engagement_model
      AND ((booking.engagement_model = 'flex' AND NEW.workforce_model IN ('direct_flex', 'partner'))
        OR (booking.engagement_model = 'fixed' AND NEW.workforce_model IN ('managed', 'partner')))
  ) THEN RAISE(ABORT, 'booking_workforce_route_mismatch') END);
END;
