CREATE TABLE `client_quote_cancellations` (
	`quote_id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `client_quote_offers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `client_quote_offers` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`terms_id` text NOT NULL,
	`source_json` text NOT NULL,
	`source_hash` text NOT NULL,
	`offer_hash` text NOT NULL,
	`issued_by` text NOT NULL,
	`issued_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`sequence` integer NOT NULL,
	`case_version` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`terms_id`) REFERENCES `client_terms_files`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "client_quote_source_json" CHECK(json_valid(source_json))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `client_quote_order_sequence_idx` ON `client_quote_offers` (`order_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `client_quote_owner_idx` ON `client_quote_offers` (`owner_user_id`);--> statement-breakpoint
CREATE TABLE `client_quote_receipts` (
	`quote_id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`receipt_json` text NOT NULL,
	`receipt_hash` text NOT NULL,
	`accepted_at` text NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `client_quote_offers`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "client_quote_receipt_json" CHECK(json_valid(receipt_json))
);
--> statement-breakpoint
CREATE TABLE `client_terms_approvals` (
	`terms_id` text PRIMARY KEY NOT NULL,
	`file_hash` text NOT NULL,
	`approved_by` text NOT NULL,
	`approved_at` text NOT NULL,
	FOREIGN KEY (`terms_id`) REFERENCES `client_terms_files`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `client_terms_files` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`version` text NOT NULL,
	`entity_id` text NOT NULL,
	`storage_key` text NOT NULL,
	`file_hash` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`uploaded_by` text NOT NULL,
	`uploaded_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `client_terms_entity_version_idx` ON `client_terms_files` (`entity_id`,`version`);--> statement-breakpoint
CREATE TABLE `client_terms_withdrawals` (
	`terms_id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`terms_id`) REFERENCES `client_terms_files`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE VIEW client_quote_sources AS
SELECT b.id AS order_id,b.client_id,l.owner_user_id,b.contracting_entity_id AS entity_id,l.case_version,b.agreement_version AS order_version,
 json_patch(json_patch(json_object('orderId',b.id,'orderVersion',b.agreement_version,'clientId',c.id,'clientName',c.organisation_name,
 'contactName',c.contact_name,'contactEmail',c.contact_email,'ownerUserId',l.owner_user_id,'caseVersion',l.case_version,
 'contractingEntityId',b.contracting_entity_id,'siteName',b.site_name,'siteArea',b.site_area,'address',s.address_label,
 'postName',b.post_name,'instructions',json_extract(p.request_json,'$.instructions')
 ),json_object('serviceType',b.service_type,'purposeLabel',b.purpose_label,'purposeCode',b.purpose_code,
 'startDate',b.start_date,'endDate',b.end_date,'shiftStart',b.shift_start,'shiftEnd',b.shift_end,
 'headcount',b.headcount,'rosterPattern',b.roster_pattern,'shiftCount',b.shift_count,'serviceDayCount',b.service_day_count,
 'contractMonths',b.contract_months,'engagementModel',b.engagement_model,'riskBand',b.risk_band
 )),json_object('specialistConfiguration',b.specialist_configuration,'subtotalCents',b.quote_subtotal_cents,'vatCents',b.vat_cents,
 'totalCents',b.client_price_cents,'currency','ZAR','pricingVersion',b.pricing_version,
 'fundingModel',b.funding_model,'creditTermsDays',b.credit_terms_days,'releaseCadence',b.release_cadence)) AS source_json
FROM bookings b JOIN production_order_setups p ON p.id=b.id
JOIN clients c ON c.id=b.client_id
JOIN production_entity_links l ON l.kind='client' AND l.entity_id=c.id AND l.case_version=p.case_version
JOIN signup_cases a ON a.kind='client' AND a.source_id=l.case_id AND a.version=l.case_version AND a.owner_user_id=l.owner_user_id AND a.status='reviewed'
JOIN operational_sites s ON s.booking_id=b.id AND s.id='SITE-'||b.id
WHERE b.environment='production' AND b.integrity_state='production_verified' AND b.status NOT IN ('cancelled','completed')
AND c.environment='production' AND c.integrity_state='production_verified' AND c.approval_status='approved';
--> statement-breakpoint
CREATE TRIGGER client_terms_approval_guard BEFORE INSERT ON client_terms_approvals
WHEN NOT EXISTS(SELECT 1 FROM client_terms_files WHERE id=NEW.terms_id AND file_hash=NEW.file_hash)
OR EXISTS(SELECT 1 FROM client_terms_withdrawals WHERE terms_id=NEW.terms_id)
BEGIN SELECT RAISE(ABORT,'terms_approval_requires_current_file'); END;
--> statement-breakpoint
CREATE TRIGGER client_quote_offer_guard BEFORE INSERT ON client_quote_offers
WHEN NOT EXISTS(SELECT 1 FROM client_quote_sources s JOIN current_production_client_approvals r ON r.client_id=s.client_id
 JOIN client_terms_files t ON t.entity_id=s.entity_id AND t.id=NEW.terms_id
 JOIN client_terms_approvals a ON a.terms_id=t.id AND a.file_hash=t.file_hash
 WHERE s.order_id=NEW.order_id AND s.source_json=NEW.source_json AND s.owner_user_id=NEW.owner_user_id
 AND s.case_version=NEW.case_version AND NEW.issued_by!=s.owner_user_id)
OR EXISTS(SELECT 1 FROM client_terms_withdrawals WHERE terms_id=NEW.terms_id)
OR EXISTS(SELECT 1 FROM client_quote_offers old JOIN client_quote_receipts r ON r.quote_id=old.id WHERE old.order_id=NEW.order_id AND old.sequence=(SELECT MAX(sequence) FROM client_quote_offers WHERE order_id=NEW.order_id) AND NOT EXISTS(SELECT 1 FROM client_quote_cancellations c WHERE c.quote_id=old.id))
OR NEW.sequence!=COALESCE((SELECT MAX(sequence)+1 FROM client_quote_offers WHERE order_id=NEW.order_id),1)
OR julianday(NEW.expires_at)<=julianday('now')
BEGIN SELECT RAISE(ABORT,'quote_requires_current_source_and_terms'); END;
--> statement-breakpoint
CREATE TRIGGER client_quote_receipt_guard BEFORE INSERT ON client_quote_receipts
WHEN NOT EXISTS(SELECT 1 FROM client_quote_offers q JOIN client_quote_sources s ON s.order_id=q.order_id AND s.source_json=q.source_json
 JOIN current_production_client_approvals r ON r.client_id=s.client_id
 JOIN client_terms_files t ON t.id=q.terms_id JOIN client_terms_approvals a ON a.terms_id=t.id AND a.file_hash=t.file_hash
 WHERE q.id=NEW.quote_id AND q.owner_user_id=NEW.actor_id AND s.owner_user_id=NEW.actor_id
 AND q.sequence=(SELECT MAX(sequence) FROM client_quote_offers WHERE order_id=q.order_id)
 AND julianday(q.expires_at)>julianday('now') AND NOT EXISTS(SELECT 1 FROM client_quote_cancellations WHERE quote_id=q.id)
 AND NOT EXISTS(SELECT 1 FROM client_terms_withdrawals WHERE terms_id=t.id)
 AND json_extract(NEW.receipt_json,'$.quoteId')=q.id AND json_extract(NEW.receipt_json,'$.actorUserId')=NEW.actor_id
 AND json_extract(NEW.receipt_json,'$.offerHash')=q.offer_hash
 AND json_extract(NEW.receipt_json,'$.terms.sha256')=t.file_hash)
BEGIN SELECT RAISE(ABORT,'quote_acceptance_requires_current_source'); END;

--> statement-breakpoint
CREATE TRIGGER client_terms_files_no_update BEFORE UPDATE ON client_terms_files BEGIN SELECT RAISE(ABORT,'quote_history_is_immutable'); END;

--> statement-breakpoint
CREATE TRIGGER client_terms_files_no_delete BEFORE DELETE ON client_terms_files BEGIN SELECT RAISE(ABORT,'quote_history_is_immutable'); END;

--> statement-breakpoint
CREATE TRIGGER client_terms_approvals_no_update BEFORE UPDATE ON client_terms_approvals BEGIN SELECT RAISE(ABORT,'quote_history_is_immutable'); END;

--> statement-breakpoint
CREATE TRIGGER client_terms_approvals_no_delete BEFORE DELETE ON client_terms_approvals BEGIN SELECT RAISE(ABORT,'quote_history_is_immutable'); END;

--> statement-breakpoint
CREATE TRIGGER client_terms_withdrawals_no_update BEFORE UPDATE ON client_terms_withdrawals BEGIN SELECT RAISE(ABORT,'quote_history_is_immutable'); END;

--> statement-breakpoint
CREATE TRIGGER client_terms_withdrawals_no_delete BEFORE DELETE ON client_terms_withdrawals BEGIN SELECT RAISE(ABORT,'quote_history_is_immutable'); END;

--> statement-breakpoint
CREATE TRIGGER client_quote_offers_no_update BEFORE UPDATE ON client_quote_offers BEGIN SELECT RAISE(ABORT,'quote_history_is_immutable'); END;

--> statement-breakpoint
CREATE TRIGGER client_quote_offers_no_delete BEFORE DELETE ON client_quote_offers BEGIN SELECT RAISE(ABORT,'quote_history_is_immutable'); END;

--> statement-breakpoint
CREATE TRIGGER client_quote_receipts_no_update BEFORE UPDATE ON client_quote_receipts BEGIN SELECT RAISE(ABORT,'quote_history_is_immutable'); END;

--> statement-breakpoint
CREATE TRIGGER client_quote_receipts_no_delete BEFORE DELETE ON client_quote_receipts BEGIN SELECT RAISE(ABORT,'quote_history_is_immutable'); END;

--> statement-breakpoint
CREATE TRIGGER client_quote_cancellations_no_update BEFORE UPDATE ON client_quote_cancellations BEGIN SELECT RAISE(ABORT,'quote_history_is_immutable'); END;

--> statement-breakpoint
CREATE TRIGGER client_quote_cancellations_no_delete BEFORE DELETE ON client_quote_cancellations BEGIN SELECT RAISE(ABORT,'quote_history_is_immutable'); END;

--> statement-breakpoint
DROP TRIGGER operational_delivery_original_claim;
--> statement-breakpoint
CREATE TRIGGER operational_delivery_original_claim BEFORE INSERT ON operational_delivery_jobs
WHEN EXISTS(SELECT 1 FROM operational_delivery_jobs WHERE id=NEW.id OR (kind=NEW.kind AND source_id=NEW.source_id))
 OR NEW.state!='queued' OR NEW.attempts!=0 OR NEW.provider_id IS NOT NULL OR NEW.request_json IS NOT NULL
 OR NEW.recipient IS NOT NULL OR NEW.first_attempt_at IS NOT NULL
 OR NOT (
  (NEW.kind IN ('enquiry_crm','enquiry_email') AND NEW.environment='prelaunch' AND EXISTS(SELECT 1 FROM client_enquiries WHERE id=NEW.source_id AND environment='prelaunch' AND integrity_state='user_submitted'))
  OR (NEW.kind='booking_email' AND NEW.environment='production' AND EXISTS(SELECT 1 FROM production_order_setups WHERE id=NEW.source_id))
  OR (NEW.kind='contract_email' AND NEW.environment='production' AND (EXISTS(SELECT 1 FROM production_signing_envelopes WHERE id=NEW.source_id) OR EXISTS(SELECT 1 FROM client_quote_offers WHERE id=NEW.source_id)))
 )
BEGIN SELECT RAISE(ABORT,'delivery_original_claim_required'); END;
--> statement-breakpoint
CREATE TRIGGER client_quote_queue AFTER INSERT ON client_quote_offers BEGIN
 UPDATE operational_delivery_jobs SET state='cancelled',last_error='quote_superseded',updated_at=NEW.issued_at
 WHERE kind='contract_email' AND source_id IN(SELECT id FROM client_quote_offers WHERE order_id=NEW.order_id AND id!=NEW.id) AND state IN('queued','blocked','retry_wait');
 INSERT INTO operational_delivery_jobs(id,kind,source_id,environment,next_attempt_at,created_at,updated_at)
 VALUES('quote:'||NEW.id,'contract_email',NEW.id,'production',NEW.issued_at,NEW.issued_at,NEW.issued_at);
END;
--> statement-breakpoint
CREATE TRIGGER client_quote_cancel_delivery AFTER INSERT ON client_quote_cancellations BEGIN
 UPDATE operational_delivery_jobs SET state='cancelled',last_error='quote_cancelled',updated_at=NEW.created_at
 WHERE kind='contract_email' AND source_id=NEW.quote_id AND state IN('queued','blocked','retry_wait');
END;
--> statement-breakpoint
CREATE TRIGGER client_terms_cancel_delivery AFTER INSERT ON client_terms_withdrawals BEGIN
 UPDATE operational_delivery_jobs SET state='cancelled',last_error='terms_withdrawn',updated_at=NEW.created_at
 WHERE kind='contract_email' AND source_id IN(SELECT id FROM client_quote_offers WHERE terms_id=NEW.terms_id) AND state IN('queued','blocked','retry_wait');
END;

--> statement-breakpoint
CREATE TRIGGER client_terms_approvals_epoch AFTER INSERT ON client_terms_approvals BEGIN UPDATE activation_evidence_epoch SET revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE singleton=1; END;

--> statement-breakpoint
CREATE TRIGGER client_terms_withdrawals_epoch AFTER INSERT ON client_terms_withdrawals BEGIN UPDATE activation_evidence_epoch SET revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE singleton=1; END;

--> statement-breakpoint
CREATE TRIGGER client_quote_offers_epoch AFTER INSERT ON client_quote_offers BEGIN UPDATE activation_evidence_epoch SET revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE singleton=1; END;

--> statement-breakpoint
CREATE TRIGGER client_quote_receipts_epoch AFTER INSERT ON client_quote_receipts BEGIN UPDATE activation_evidence_epoch SET revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE singleton=1; END;

--> statement-breakpoint
CREATE TRIGGER client_quote_cancellations_epoch AFTER INSERT ON client_quote_cancellations BEGIN UPDATE activation_evidence_epoch SET revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE singleton=1; END;
