--> statement-breakpoint
CREATE TABLE production_notifications (
 id TEXT PRIMARY KEY, recipient TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','sending','sent','blocked','retry_wait','uncertain')),
 attempts INTEGER NOT NULL DEFAULT 0, provider_id TEXT, from_address TEXT, last_error TEXT,
 first_attempt_at TEXT, next_attempt_at TEXT NOT NULL, lease_token TEXT, lease_expires_at TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX production_notifications_due ON production_notifications(state,next_attempt_at);
--> statement-breakpoint
CREATE TRIGGER production_notifications_immutable BEFORE UPDATE ON production_notifications
 WHEN NEW.id IS NOT OLD.id OR NEW.recipient IS NOT OLD.recipient OR NEW.subject IS NOT OLD.subject OR NEW.body IS NOT OLD.body OR NEW.created_at IS NOT OLD.created_at OR (OLD.from_address IS NOT NULL AND NEW.from_address IS NOT OLD.from_address)
 BEGIN SELECT RAISE(ABORT,'Notification content is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER production_notifications_retain BEFORE DELETE ON production_notifications BEGIN SELECT RAISE(ABORT,'Notification history is required'); END;
--> statement-breakpoint
CREATE TRIGGER operations_intake_email AFTER INSERT ON signup_events WHEN NEW.kind='officer' AND NEW.action IN ('review','submit','correct') BEGIN
 INSERT INTO production_notifications(id,recipient,subject,body,next_attempt_at,created_at,updated_at)
 SELECT 'intake:'||NEW.id,a.email_normalized,'LOKD Security — officer application update',
 'Your officer application has been updated. Sign in to your LOKD Officer account to read the decision and any information we need from you.'||char(10)||char(10)||'https://officers.lokd.co.za/officer'||char(10)||char(10)||'LOKD Security',NEW.recorded_at,NEW.recorded_at,NEW.recorded_at
 FROM officer_applications a WHERE a.id=NEW.source_id AND a.integrity_state='user_submitted';
END;
--> statement-breakpoint
CREATE TRIGGER operations_officer_decision_email AFTER INSERT ON production_officer_decisions BEGIN
 INSERT INTO production_notifications(id,recipient,subject,body,next_attempt_at,created_at,updated_at)
 SELECT 'officer:'||NEW.review_id,o.email,'LOKD Security — officer application decision',
 CASE NEW.decision WHEN 'approve' THEN 'Your officer application has been approved. Sign in to review your remaining requirements and LOKD Passport.' ELSE 'Your officer application was not approved. Sign in to read the review findings and the next steps.' END||char(10)||char(10)||'https://officers.lokd.co.za/officer'||char(10)||char(10)||'LOKD Security',NEW.decided_at,NEW.decided_at,NEW.decided_at
 FROM production_officer_reviews r JOIN officers o ON o.id=r.officer_id WHERE r.id=NEW.review_id;
END;
--> statement-breakpoint
CREATE TRIGGER operations_passport_email AFTER INSERT ON production_readiness_decisions WHEN NEW.kind='passport' BEGIN
 INSERT INTO production_notifications(id,recipient,subject,body,next_attempt_at,created_at,updated_at)
 SELECT 'passport:'||NEW.target_id,o.email,'LOKD Security — LOKD Passport update',
 CASE NEW.decision WHEN 'approve' THEN 'Your LOKD Passport has been issued. Open your Officer account to view it securely.' ELSE 'Your LOKD Passport review needs attention. Open your Officer account to read the review findings.' END||char(10)||char(10)||'https://officers.lokd.co.za/officer/readiness'||char(10)||char(10)||'LOKD Security',NEW.decided_at,NEW.decided_at,NEW.decided_at
 FROM production_readiness_passports p JOIN officers o ON o.id=p.officer_id WHERE p.id=NEW.target_id;
END;
--> statement-breakpoint
CREATE TRIGGER operations_passport_hold_email AFTER INSERT ON production_readiness_holds WHEN NEW.kind='passport' BEGIN
 INSERT INTO production_notifications(id,recipient,subject,body,next_attempt_at,created_at,updated_at)
 SELECT 'passport-hold:'||NEW.id,o.email,'LOKD Security — LOKD Passport withdrawn',
 'Your LOKD Passport is no longer valid. Sign in to read the reason and contact Operations for the next steps.'||char(10)||char(10)||'https://officers.lokd.co.za/officer/readiness'||char(10)||char(10)||'LOKD Security',NEW.recorded_at,NEW.recorded_at,NEW.recorded_at
 FROM production_readiness_passports p JOIN officers o ON o.id=p.officer_id WHERE p.id=NEW.target_id;
END;
--> statement-breakpoint
CREATE TRIGGER operations_payroll_email AFTER UPDATE OF status ON payroll_runs WHEN NEW.environment='production' AND NEW.status='approved_for_export' AND OLD.status<>NEW.status BEGIN
 INSERT INTO production_notifications(id,recipient,subject,body,next_attempt_at,created_at,updated_at)
 SELECT 'payroll:'||NEW.id||':'||i.id,o.email,'LOKD Security — payroll statement available',
 'Your payroll statement for '||NEW.period_start||' to '||NEW.period_end||' is available in your Officer account. This statement does not confirm that a bank payment has cleared.'||char(10)||char(10)||'https://officers.lokd.co.za/officer/service'||char(10)||char(10)||'LOKD Security',NEW.updated_at,NEW.updated_at,NEW.updated_at
 FROM payroll_items i JOIN officers o ON o.id=i.officer_id WHERE i.payroll_run_id=NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER operations_identity_decision_email AFTER INSERT ON production_identity_decisions BEGIN
 INSERT INTO production_notifications(id,recipient,subject,body,next_attempt_at,created_at,updated_at)
 SELECT 'identity-decision:'||NEW.outcome_id,a.email_normalized,'LOKD Security — identity review update',
 'Your identity review is complete. Open your Officer account to read the decision and any next steps.'||char(10)||char(10)||'https://officers.lokd.co.za/officer/readiness'||char(10)||char(10)||'LOKD Security',NEW.recorded_at,NEW.recorded_at,NEW.recorded_at
 FROM production_identity_outcomes o JOIN production_identity_cases c ON c.id=o.case_id JOIN officer_applications a ON a.id=c.applicant_id WHERE o.id=NEW.outcome_id;
END;
--> statement-breakpoint
CREATE TRIGGER operations_identity_suspension_email AFTER INSERT ON production_identity_suspensions BEGIN
 INSERT INTO production_notifications(id,recipient,subject,body,next_attempt_at,created_at,updated_at)
 SELECT 'identity-hold:'||NEW.id,a.email_normalized,'LOKD Security — identity review required',
 'Your identity approval has been suspended. Sign in to read the reason and contact Operations before accepting further work.'||char(10)||char(10)||'https://officers.lokd.co.za/officer/readiness'||char(10)||char(10)||'LOKD Security',NEW.recorded_at,NEW.recorded_at,NEW.recorded_at
 FROM production_identity_cases c JOIN officer_applications a ON a.id=c.applicant_id WHERE c.id=NEW.case_id;
END;
--> statement-breakpoint
CREATE TRIGGER operations_psira_email AFTER INSERT ON psira_verification_events BEGIN
 INSERT INTO production_notifications(id,recipient,subject,body,next_attempt_at,created_at,updated_at)
 SELECT 'psira:'||NEW.id,c.owner_email,'LOKD Security — PSiRA verification update',
 'Your PSiRA verification has been updated. Open your Officer account to see the result and any required action.'||char(10)||char(10)||'https://officers.lokd.co.za/officer/psira'||char(10)||char(10)||'LOKD Security',NEW.recorded_at,NEW.recorded_at,NEW.recorded_at
 FROM psira_verification_cases c WHERE c.id=NEW.case_id AND EXISTS(SELECT 1 FROM signup_cases sc JOIN officer_applications a ON a.id=sc.source_id WHERE sc.kind='officer' AND sc.owner_user_id=c.owner_user_id AND a.integrity_state='user_submitted');
END;
--> statement-breakpoint
CREATE TRIGGER operations_assignment_email AFTER INSERT ON roster_assignments WHEN NEW.environment='production' AND NEW.integrity_state='production_verified' AND NEW.status='confirmed' BEGIN
 INSERT INTO production_notifications(id,recipient,subject,body,next_attempt_at,created_at,updated_at)
 SELECT 'assignment-published:'||NEW.id,o.email,'LOKD Security — shift assignment confirmed',
 'Your assignment at '||b.site_name||' is confirmed. Sign in to review the shift time, post instructions and check-in requirements.'||char(10)||char(10)||'https://officers.lokd.co.za/officer/service'||char(10)||char(10)||'LOKD Security',NEW.assigned_at,NEW.assigned_at,NEW.assigned_at
 FROM officers o JOIN roster_slots s ON s.id=NEW.roster_slot_id JOIN bookings b ON b.id=s.booking_id WHERE o.id=NEW.officer_id;
END;
