-- Keep public requirements with the existing enquiry and receipt records.
ALTER TABLE client_enquiries ADD COLUMN site_address TEXT;
--> statement-breakpoint
ALTER TABLE client_enquiries ADD COLUMN start_date TEXT;
--> statement-breakpoint
ALTER TABLE client_enquiries ADD COLUMN end_date TEXT;
--> statement-breakpoint
ALTER TABLE client_enquiries ADD COLUMN start_time TEXT;
--> statement-breakpoint
ALTER TABLE client_enquiries ADD COLUMN end_time TEXT;
--> statement-breakpoint
ALTER TABLE client_enquiries ADD COLUMN officer_count INTEGER CHECK (officer_count IS NULL OR officer_count BETWEEN 1 AND 100);
--> statement-breakpoint
ALTER TABLE client_enquiries ADD COLUMN schedule TEXT;
--> statement-breakpoint

CREATE TRIGGER client_enquiry_schedule_immutable
BEFORE UPDATE ON client_enquiries
WHEN NEW.site_address IS NOT OLD.site_address OR NEW.start_date IS NOT OLD.start_date
 OR NEW.end_date IS NOT OLD.end_date OR NEW.start_time IS NOT OLD.start_time
 OR NEW.end_time IS NOT OLD.end_time OR NEW.officer_count IS NOT OLD.officer_count OR NEW.schedule IS NOT OLD.schedule
BEGIN SELECT RAISE(ABORT,'enquiry_schedule_immutable'); END;
--> statement-breakpoint

CREATE INDEX public_enquiry_rate_lookup ON audit_events(event_type,actor_id,created_at);
--> statement-breakpoint
-- Batch admission is atomic, including concurrent requests from different Workers.
CREATE TRIGGER public_enquiry_rate_guard BEFORE INSERT ON audit_events
WHEN NEW.event_type IN ('public_enquiry_rate_ip','public_enquiry_rate_email')
 AND (SELECT count(*) FROM audit_events
      WHERE event_type=NEW.event_type AND actor_id=NEW.actor_id
      AND created_at>strftime('%Y-%m-%dT%H:%M:%fZ',NEW.created_at,'-1 hour'))
      >= CASE NEW.event_type WHEN 'public_enquiry_rate_email' THEN 3 ELSE 10 END
BEGIN SELECT RAISE(ABORT,'public_enquiry_rate_limited'); END;
