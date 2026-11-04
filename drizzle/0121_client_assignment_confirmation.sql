CREATE TRIGGER client_assignment_confirmation_email AFTER UPDATE OF status ON shifts
WHEN NEW.environment='production' AND NEW.integrity_state='production_verified'
 AND NEW.status='confirmed' AND OLD.status='reserved'
BEGIN
 INSERT OR IGNORE INTO client_notification_jobs
 (id,source_id,owner_user_id,recipient_type,subject,message_text,next_attempt_at,created_at,updated_at)
 SELECT 'assignment:client:'||a.id,NEW.id,l.owner_user_id,'client','LOKD | Your shift is confirmed',
 'Your shift at '||b.site_name||' is confirmed.'||char(10)||char(10)||
 'Officer: '||o.full_name||' ('||o.psira_grade||')'||char(10)||
 'Starts: '||strftime('%Y-%m-%d %H:%M',r.starts_at,'+2 hours')||' SAST'||char(10)||
 'Ends: '||strftime('%Y-%m-%d %H:%M',r.ends_at,'+2 hours')||' SAST'||char(10)||
 'Booking: '||b.id||char(10)||'Shift: '||NEW.id||char(10)||char(10)||
 'View your officer and live arrival status: https://portal.lokd.co.za/client'||char(10)||char(10)||'LOKD Security',
 a.confirmed_at,a.confirmed_at,a.confirmed_at
 FROM roster_assignments a JOIN roster_slots r ON r.id=a.roster_slot_id
 JOIN bookings b ON b.id=r.booking_id JOIN officers o ON o.id=NEW.officer_id
 JOIN production_entity_links l ON l.kind='client' AND l.entity_id=b.client_id
 WHERE a.shift_id=NEW.id AND a.officer_id=NEW.officer_id AND a.status='confirmed' AND a.active_key=r.id
 AND a.environment='production' AND r.environment='production' AND b.environment='production'
 AND a.confirmed_at IS NOT NULL
 AND EXISTS(SELECT 1 FROM assignment_activation_snapshots s WHERE s.roster_assignment_id=a.id AND s.shift_id=NEW.id AND s.environment='production' AND s.final=1);

 INSERT OR IGNORE INTO client_notification_jobs
 (id,source_id,owner_user_id,recipient_type,subject,message_text,next_attempt_at,created_at,updated_at)
 SELECT replace(id,'assignment:client:','assignment:operations:'),source_id,owner_user_id,'operations',subject,message_text,next_attempt_at,created_at,updated_at
 FROM client_notification_jobs WHERE id IN (
 SELECT 'assignment:client:'||id FROM roster_assignments WHERE shift_id=NEW.id AND environment='production');
END;
