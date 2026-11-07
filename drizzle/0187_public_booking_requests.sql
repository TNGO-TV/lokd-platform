ALTER TABLE client_enquiries ADD COLUMN engagement_model TEXT CHECK (engagement_model IS NULL OR engagement_model IN ('fixed','flex'));
--> statement-breakpoint
ALTER TABLE client_enquiries ADD COLUMN notice_window TEXT CHECK (notice_window IS NULL OR notice_window IN ('standard','priority','urgent','immediate'));
--> statement-breakpoint
ALTER TABLE client_enquiries ADD COLUMN calendar_type TEXT CHECK (calendar_type IS NULL OR calendar_type IN ('ordinary','sunday','public_holiday','easter','christmas'));
--> statement-breakpoint
ALTER TABLE client_enquiries ADD COLUMN risk_band TEXT CHECK (risk_band IS NULL OR risk_band IN ('Standard','Enhanced','Elevated','High','Critical'));
--> statement-breakpoint
ALTER TABLE client_enquiries ADD COLUMN booking_details TEXT CHECK (booking_details IS NULL OR json_valid(booking_details));
--> statement-breakpoint
ALTER TABLE client_enquiries ADD COLUMN internal_draft_price TEXT CHECK (internal_draft_price IS NULL OR json_valid(internal_draft_price));
--> statement-breakpoint
CREATE TRIGGER client_enquiry_booking_immutable BEFORE UPDATE ON client_enquiries
WHEN NEW.engagement_model IS NOT OLD.engagement_model OR NEW.notice_window IS NOT OLD.notice_window
 OR NEW.calendar_type IS NOT OLD.calendar_type OR NEW.risk_band IS NOT OLD.risk_band
 OR NEW.booking_details IS NOT OLD.booking_details OR NEW.internal_draft_price IS NOT OLD.internal_draft_price
BEGIN SELECT RAISE(ABORT,'enquiry_booking_immutable'); END;
