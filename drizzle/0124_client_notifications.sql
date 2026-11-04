CREATE TABLE client_notification_jobs (
  id TEXT PRIMARY KEY NOT NULL,
  source_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('client','operations')),
  subject TEXT NOT NULL CHECK (length(subject) BETWEEN 1 AND 200),
  message_text TEXT NOT NULL CHECK (length(message_text) BETWEEN 1 AND 20000),
  state TEXT NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','dispatching','sent','blocked','retry_wait','failed','uncertain','cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  recipient TEXT,
  request_json TEXT CHECK (request_json IS NULL OR json_valid(request_json)),
  provider_id TEXT,
  first_attempt_at TEXT,
  last_error TEXT,
  lease_token TEXT,
  lease_expires_at TEXT,
  next_attempt_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX client_notification_due_idx ON client_notification_jobs(state,next_attempt_at);
--> statement-breakpoint
CREATE INDEX client_notification_owner_idx ON client_notification_jobs(owner_user_id,source_id);
--> statement-breakpoint
CREATE TRIGGER client_notification_content_immutable BEFORE UPDATE ON client_notification_jobs
WHEN NEW.id != OLD.id OR NEW.source_id != OLD.source_id OR NEW.owner_user_id != OLD.owner_user_id
 OR NEW.recipient_type != OLD.recipient_type OR NEW.subject != OLD.subject OR NEW.message_text != OLD.message_text
 OR NEW.created_at != OLD.created_at OR (OLD.request_json IS NOT NULL AND NEW.request_json IS NOT OLD.request_json)
 OR (OLD.recipient IS NOT NULL AND NEW.recipient IS NOT OLD.recipient)
BEGIN SELECT RAISE(ABORT,'notification_content_is_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER client_notification_no_delete BEFORE DELETE ON client_notification_jobs
BEGIN SELECT RAISE(ABORT,'notification_history_is_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER client_notification_replay_guard BEFORE INSERT ON client_notification_jobs
WHEN EXISTS(SELECT 1 FROM client_notification_jobs old WHERE old.id=NEW.id AND
 (old.source_id!=NEW.source_id OR old.owner_user_id!=NEW.owner_user_id OR old.recipient_type!=NEW.recipient_type
 OR old.subject!=NEW.subject OR old.message_text!=NEW.message_text))
BEGIN SELECT RAISE(ABORT,'notification_replay_has_different_content'); END;
--> statement-breakpoint
CREATE TRIGGER client_quote_issue_audit AFTER INSERT ON client_quote_offers BEGIN
 INSERT INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at)
 VALUES('quote:issued:'||NEW.id,'operations',NEW.issued_by,'quote_issued','client_quote',NEW.id,
 json_object('orderId',NEW.order_id,'offerHash',NEW.offer_hash,'sequence',NEW.sequence,'publicNumber',NEW.public_number),NEW.issued_at);
END;
--> statement-breakpoint
CREATE TRIGGER client_quote_accept_audit AFTER INSERT ON client_quote_receipts BEGIN
 INSERT INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at)
 VALUES('quote:accepted:'||NEW.quote_id,'client',NEW.actor_id,'quote_accepted','client_quote',NEW.quote_id,
 json_object('receiptHash',NEW.receipt_hash),NEW.accepted_at);
END;
--> statement-breakpoint
CREATE TRIGGER client_quote_cancel_audit AFTER INSERT ON client_quote_cancellations BEGIN
 INSERT INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at)
 SELECT 'quote:cancelled:'||NEW.quote_id,CASE WHEN q.owner_user_id=NEW.actor_id THEN 'client' ELSE 'operations' END,
 NEW.actor_id,CASE WHEN q.owner_user_id=NEW.actor_id THEN 'quote_declined' ELSE 'quote_cancelled' END,
 'client_quote',NEW.quote_id,json_object('reason',NEW.reason),NEW.created_at FROM client_quote_offers q WHERE q.id=NEW.quote_id;
END;
--> statement-breakpoint
CREATE TRIGGER client_quote_decline_guard BEFORE INSERT ON client_quote_cancellations
WHEN EXISTS(SELECT 1 FROM client_quote_offers q WHERE q.id=NEW.quote_id AND q.owner_user_id=NEW.actor_id)
 AND (EXISTS(SELECT 1 FROM client_quote_receipts WHERE quote_id=NEW.quote_id)
 OR NOT EXISTS(SELECT 1 FROM client_quote_offers q WHERE q.id=NEW.quote_id
 AND q.sequence=(SELECT MAX(sequence) FROM client_quote_offers WHERE order_id=q.order_id)
 AND julianday(q.expires_at)>julianday('now')))
BEGIN SELECT RAISE(ABORT,'only_current_unaccepted_quotes_can_be_declined'); END;
--> statement-breakpoint
CREATE TRIGGER client_terms_upload_audit AFTER INSERT ON client_terms_files BEGIN
 INSERT INTO audit_events VALUES('terms:uploaded:'||NEW.id,'operations',NEW.uploaded_by,'terms_uploaded','client_terms',NEW.id,json_object('fileHash',NEW.file_hash,'version',NEW.version),NEW.uploaded_at);
END;
--> statement-breakpoint
CREATE TRIGGER client_terms_approve_audit AFTER INSERT ON client_terms_approvals BEGIN
 INSERT INTO audit_events VALUES('terms:approved:'||NEW.terms_id,'operations',NEW.approved_by,'terms_approved','client_terms',NEW.terms_id,json_object('fileHash',NEW.file_hash),NEW.approved_at);
END;
--> statement-breakpoint
CREATE TRIGGER client_terms_withdraw_audit AFTER INSERT ON client_terms_withdrawals BEGIN
 INSERT INTO audit_events VALUES('terms:withdrawn:'||NEW.terms_id,'operations',NEW.actor_id,'terms_withdrawn','client_terms',NEW.terms_id,json_object('reason',NEW.reason),NEW.created_at);
END;
