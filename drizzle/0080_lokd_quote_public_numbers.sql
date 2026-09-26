CREATE TABLE `lokd_quote_month_counters` (
	`month_key` text PRIMARY KEY NOT NULL,
	`last_sequence` integer NOT NULL,
	CONSTRAINT "lokd_quote_month_key" CHECK(length(month_key)=4 AND month_key GLOB '[0-9][0-9][0-9][0-9]'),
	CONSTRAINT "lokd_quote_month_sequence" CHECK(last_sequence BETWEEN 1 AND 99)
);
--> statement-breakpoint
ALTER TABLE `client_quote_offers` ADD `public_number` text;--> statement-breakpoint
CREATE UNIQUE INDEX `client_quote_public_number_idx` ON `client_quote_offers` (`public_number`);
--> statement-breakpoint
-- Issue path. month_key is the SAST YYMM; the trigger assigns LOKDYYMM## and the base-table guard checks it.
CREATE VIEW `client_quote_offer_issues` AS
SELECT `id`, `order_id`, `owner_user_id`, `terms_id`, `source_json`, `source_hash`, `offer_hash`,
 `issued_by`, `issued_at`, `expires_at`, `sequence`, `case_version`, `public_number`, NULL AS `month_key`
FROM `client_quote_offers`;
--> statement-breakpoint
CREATE TRIGGER client_quote_offer_issue INSTEAD OF INSERT ON client_quote_offer_issues
BEGIN
 INSERT INTO lokd_quote_month_counters(month_key, last_sequence) VALUES(NEW.month_key, 1)
 ON CONFLICT(month_key) DO UPDATE SET last_sequence = last_sequence + 1
 WHERE lokd_quote_month_counters.last_sequence < 99;
 SELECT RAISE(ABORT, 'quote_month_sequence_exhausted') WHERE changes() = 0;
 INSERT INTO client_quote_offers(id, order_id, owner_user_id, terms_id, source_json, source_hash, offer_hash, issued_by, issued_at, expires_at, sequence, case_version, public_number)
 SELECT NEW.id, NEW.order_id, NEW.owner_user_id, NEW.terms_id, NEW.source_json, NEW.source_hash, NEW.offer_hash, NEW.issued_by, NEW.issued_at, NEW.expires_at, NEW.sequence, NEW.case_version,
  'LOKD' || NEW.month_key || printf('%02d', c.last_sequence)
 FROM lokd_quote_month_counters c
 WHERE c.month_key = NEW.month_key;
END;
--> statement-breakpoint
-- SAST is UTC+2 year-round. The sequence must be the counter value just reserved for that month.
CREATE TRIGGER client_quote_public_number_guard BEFORE INSERT ON client_quote_offers
WHEN NEW.public_number IS NULL
 OR NEW.public_number NOT GLOB 'LOKD[0-9][0-9][0-9][0-9][0-9][0-9]'
 OR substr(NEW.public_number, 5, 4) != (
  substr(strftime('%Y', datetime(NEW.issued_at, '+2 hours')), 3, 2) || strftime('%m', datetime(NEW.issued_at, '+2 hours'))
 )
 OR CAST(substr(NEW.public_number, 9, 2) AS INTEGER) != COALESCE((
  SELECT last_sequence FROM lokd_quote_month_counters WHERE month_key = substr(NEW.public_number, 5, 4)
 ), -1)
BEGIN SELECT RAISE(ABORT, 'quote_public_number_required'); END;