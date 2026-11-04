-- Finance records and their notifications are saved in the same D1 transaction.
CREATE TRIGGER client_credit_note_notification AFTER INSERT ON credit_note_issues
BEGIN
  INSERT OR IGNORE INTO client_notification_jobs
    (id,source_id,owner_user_id,recipient_type,subject,message_text,next_attempt_at,created_at,updated_at)
  SELECT 'CREDIT-'||NEW.credit_id,c.invoice_id,s.recipient_user,'client',
    'LOKD | Credit note '||NEW.number,
    'Your LOKD credit note '||NEW.number||char(10)||char(10)||
    'Amount: '||printf('R %.2f',c.direction*(c.net_cents+c.tax_cents)/100.0)||char(10)||
    COALESCE(json_extract(c.payload_json,'$.note'),'')||char(10)||char(10)||
    'Sign in to your LOKD client account to view the credit note and your updated statement.'||char(10)||char(10)||'LOKD Security',
    NEW.issued_at,NEW.issued_at,NEW.issued_at
  FROM credit_notes c JOIN credit_note_sources s ON s.invoice_id=c.invoice_id WHERE c.id=NEW.credit_id;
  INSERT INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at)
  SELECT lower(hex(randomblob(16))),'operations',d.user_id,'client_credit_note_issued','credit_note',c.id,
    json_object('invoiceId',c.invoice_id,'number',NEW.number,'amountCents',c.direction*(c.net_cents+c.tax_cents)),NEW.issued_at
  FROM credit_notes c JOIN credit_note_decisions d ON d.credit_id=c.id AND d.decision='approved' WHERE c.id=NEW.credit_id;
END;
--> statement-breakpoint
CREATE TRIGGER client_payment_receipt_notification AFTER INSERT ON booking_funding_reconciliations
WHEN NEW.environment='production' AND NEW.integrity_state='production_verified' AND NEW.status='cleared_reconciled'
BEGIN
  INSERT OR IGNORE INTO client_notification_jobs
    (id,source_id,owner_user_id,recipient_type,subject,message_text,next_attempt_at,created_at,updated_at)
  SELECT 'PAYMENT-'||NEW.id,NEW.booking_id,l.owner_user_id,'client',
    'LOKD | Payment received for '||NEW.booking_id,
    'Thank you. We received '||printf('R %.2f',NEW.cleared_amount_cents/100.0)||' for booking '||NEW.booking_id||'.'||char(10)||char(10)||
    'Payment reference: '||NEW.provider_reference||char(10)||
    'Sign in to your LOKD client account to download your receipt and view your statement.'||char(10)||char(10)||'LOKD Security',
    NEW.created_at,NEW.created_at,NEW.created_at
  FROM bookings b JOIN production_entity_links l ON l.kind='client' AND l.entity_id=b.client_id WHERE b.id=NEW.booking_id;
END;
--> statement-breakpoint
CREATE TRIGGER client_payment_receipt_update_notification AFTER UPDATE ON booking_funding_reconciliations
WHEN NEW.environment='production' AND NEW.integrity_state='production_verified' AND NEW.status='cleared_reconciled' AND OLD.status<>'cleared_reconciled'
BEGIN
  INSERT OR IGNORE INTO client_notification_jobs
    (id,source_id,owner_user_id,recipient_type,subject,message_text,next_attempt_at,created_at,updated_at)
  SELECT 'PAYMENT-'||NEW.id,NEW.booking_id,l.owner_user_id,'client',
    'LOKD | Payment received for '||NEW.booking_id,
    'Thank you. We received '||printf('R %.2f',NEW.cleared_amount_cents/100.0)||' for booking '||NEW.booking_id||'.'||char(10)||char(10)||
    'Payment reference: '||NEW.provider_reference||char(10)||
    'Sign in to your LOKD client account to download your receipt and view your statement.'||char(10)||char(10)||'LOKD Security',
    COALESCE(NEW.reconciled_at,NEW.created_at),COALESCE(NEW.reconciled_at,NEW.created_at),COALESCE(NEW.reconciled_at,NEW.created_at)
  FROM bookings b JOIN production_entity_links l ON l.kind='client' AND l.entity_id=b.client_id WHERE b.id=NEW.booking_id;
END;
