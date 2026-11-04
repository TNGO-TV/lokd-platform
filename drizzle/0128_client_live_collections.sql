-- Keep collection preparation and transitions restricted to production payments.
CREATE TRIGGER booking_collection_live_insert BEFORE INSERT ON booking_collection_requests
WHEN NEW.mode <> 'live'
BEGIN SELECT RAISE(ABORT, 'Live collection required'); END;
--> statement-breakpoint
CREATE TRIGGER booking_collection_live_update BEFORE UPDATE ON booking_collection_requests
WHEN NEW.mode <> 'live'
BEGIN SELECT RAISE(ABORT, 'Live collection required'); END;
--> statement-breakpoint
CREATE TRIGGER booking_collection_prepared_audit AFTER INSERT ON booking_collection_requests
BEGIN
  INSERT INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at)
  VALUES(lower(hex(randomblob(16))),'operations',NEW.prepared_by,'booking_collection_prepared','booking_collection',NEW.reference,
    json_object('bookingId',NEW.order_id,'clientId',NEW.client_id,'amountCents',NEW.amount_minor,'currency',NEW.currency),NEW.created_at);
END;
--> statement-breakpoint
CREATE TRIGGER booking_collection_invoice_guard BEFORE UPDATE ON booking_collection_requests
WHEN NEW.state='initializing'
BEGIN
  SELECT (CASE WHEN NOT EXISTS (
    SELECT 1 FROM client_invoices i
    JOIN finance_document_versions v ON v.kind='invoice' AND v.source_id=i.id AND v.recipient_user=NEW.applicant_id
    JOIN finance_document_issues issue ON issue.document_id=v.id
    WHERE i.booking_id=NEW.order_id AND i.client_id=NEW.client_id
      AND i.environment='production' AND i.integrity_state='production_verified'
      AND i.total_cents=NEW.amount_minor
      AND json_extract(v.source_json,'$.totalCents')=NEW.amount_minor
      AND NOT EXISTS(SELECT 1 FROM finance_document_versions next JOIN finance_document_issues ni ON ni.document_id=next.id WHERE next.kind='invoice' AND next.source_id=i.id AND next.version>v.version)
      AND COALESCE((SELECT sum(c.direction*(c.net_cents+c.tax_cents)) FROM credit_notes c JOIN credit_note_issues ci ON ci.credit_id=c.id WHERE c.invoice_id=i.id),0)=0
      AND NOT EXISTS(SELECT 1 FROM booking_funding_reconciliations f WHERE f.booking_id=i.booking_id AND f.environment='production' AND f.active_key=i.booking_id AND f.status IN('cleared_reconciled','held'))
  ) THEN RAISE(ABORT, 'Invoice amount changed or payment already received') END);
  SELECT (CASE WHEN NOT EXISTS (
    SELECT 1 FROM client_quote_offers q
    JOIN client_quote_receipts receipt ON receipt.quote_id=q.id AND receipt.actor_id=NEW.applicant_id
    JOIN client_quote_sources source ON source.order_id=q.order_id AND source.source_json=q.source_json
    WHERE q.order_id=NEW.order_id AND q.owner_user_id=NEW.applicant_id
      AND q.sequence=(SELECT max(sequence) FROM client_quote_offers WHERE order_id=q.order_id)
      AND NOT EXISTS(SELECT 1 FROM client_quote_cancellations cancelled WHERE cancelled.quote_id=q.id)
      AND NOT EXISTS(SELECT 1 FROM client_terms_withdrawals withdrawn WHERE withdrawn.terms_id=q.terms_id)
  ) THEN RAISE(ABORT, 'Accept the current quote and terms before payment') END);
END;
