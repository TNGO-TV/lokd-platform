CREATE TABLE `quote_books_links` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_id` text NOT NULL,
	`kind` text NOT NULL,
	`organization_id` text NOT NULL,
	`document_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`offer_hash` text NOT NULL,
	`receipt_hash` text NOT NULL,
	`comparison_json` text NOT NULL,
	`linked_by` text NOT NULL,
	`linked_at` text NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `client_quote_offers`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "quote_books_kind" CHECK(kind IN ('estimate','invoice')),
	CONSTRAINT "quote_books_comparison_json" CHECK(json_valid(comparison_json))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quote_books_kind_unique` ON `quote_books_links` (`quote_id`,`kind`);--> statement-breakpoint
CREATE UNIQUE INDEX `quote_books_document_unique` ON `quote_books_links` (`organization_id`,`kind`,`document_id`);
--> statement-breakpoint
CREATE TRIGGER quote_books_links_current BEFORE INSERT ON quote_books_links
WHEN NOT EXISTS(SELECT 1 FROM client_quote_offers q JOIN client_quote_sources s ON s.order_id=q.order_id AND s.source_json=q.source_json
 JOIN current_production_client_approvals a ON a.client_id=s.client_id
 JOIN client_quote_receipts r ON r.quote_id=q.id AND r.receipt_hash=NEW.receipt_hash
 JOIN client_terms_approvals t ON t.terms_id=q.terms_id
 WHERE q.id=NEW.quote_id AND q.offer_hash=NEW.offer_hash AND q.owner_user_id=s.owner_user_id
 AND q.sequence=(SELECT MAX(sequence) FROM client_quote_offers WHERE order_id=q.order_id)
 AND NOT EXISTS(SELECT 1 FROM client_quote_cancellations WHERE quote_id=q.id)
 AND NOT EXISTS(SELECT 1 FROM client_terms_withdrawals WHERE terms_id=q.terms_id)
 AND json_extract(NEW.comparison_json,'$.referenceNumber')=q.id
 AND json_extract(NEW.comparison_json,'$.documentId')=NEW.document_id
 AND json_extract(NEW.comparison_json,'$.organizationId')=NEW.organization_id
 AND json_extract(NEW.comparison_json,'$.customerId')=NEW.customer_id
 AND json_extract(NEW.comparison_json,'$.kind')=NEW.kind
 AND json_extract(NEW.comparison_json,'$.totalMinor')=json_extract(q.source_json,'$.totalCents')
 AND json_extract(NEW.comparison_json,'$.taxMinor')=json_extract(q.source_json,'$.vatCents'))
 OR EXISTS(SELECT 1 FROM quote_books_links l WHERE l.quote_id=NEW.quote_id AND (l.customer_id!=NEW.customer_id OR l.organization_id!=NEW.organization_id))
BEGIN SELECT RAISE(ABORT,'books_link_requires_current_acceptance'); END;
--> statement-breakpoint
CREATE TRIGGER quote_books_links_no_update BEFORE UPDATE ON quote_books_links BEGIN SELECT RAISE(ABORT,'books_link_history_is_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER quote_books_links_no_delete BEFORE DELETE ON quote_books_links BEGIN SELECT RAISE(ABORT,'books_link_history_is_immutable'); END;
