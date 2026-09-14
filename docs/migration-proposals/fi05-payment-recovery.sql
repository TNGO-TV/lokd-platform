CREATE TABLE employee_recovery_proposals (
 id TEXT PRIMARY KEY NOT NULL, reference TEXT NOT NULL REFERENCES employee_payment_instructions(reference),
 instruction_version INTEGER NOT NULL, evidence_id TEXT NOT NULL REFERENCES employee_transfer_observations(id),
 disposition TEXT NOT NULL CHECK(disposition IN ('failed','reversed')), source_hash TEXT NOT NULL,
 operator_id TEXT NOT NULL, user_id TEXT NOT NULL, note TEXT NOT NULL, auth_method TEXT NOT NULL, created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE employee_recovery_approvals (
 id TEXT PRIMARY KEY NOT NULL, proposal_id TEXT NOT NULL UNIQUE REFERENCES employee_recovery_proposals(id),
 operator_id TEXT NOT NULL, user_id TEXT NOT NULL, note TEXT NOT NULL, auth_method TEXT NOT NULL, created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE employee_recovery_replacements (
 reference TEXT PRIMARY KEY NOT NULL, predecessor TEXT NOT NULL UNIQUE REFERENCES employee_payment_instructions(reference),
 approval_id TEXT NOT NULL UNIQUE REFERENCES employee_recovery_approvals(id), created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE VIEW employee_recovery_terminal AS
 SELECT i.reference,e.id AS evidence_id,json_extract(e.transfer_json,'$.status') AS disposition
 FROM employee_payment_instructions i JOIN employee_transfer_observations e ON e.reference=i.reference
 WHERE (SELECT count(*) FROM employee_transfer_observations bounded WHERE bounded.reference=i.reference)<=500
 AND i.mode='test' AND i.status='dispatch_claimed' AND e.source='verify' AND e.event='transfer.verify'
 AND e.rowid=(SELECT max(o.rowid) FROM employee_transfer_observations o WHERE o.reference=i.reference)
 AND julianday(e.created_at) IS NOT NULL AND julianday(e.created_at) BETWEEN julianday('now')-5.0/1440 AND julianday('now')+1.0/86400
 AND json_extract(e.transfer_json,'$.status') IN ('failed','reversed')
 AND e.webhook_count=(SELECT count(*) FROM employee_transfer_observations o WHERE o.reference=i.reference AND o.source='webhook')
 AND EXISTS(SELECT 1 FROM employee_transfer_observations w WHERE w.reference=i.reference AND w.source='webhook' AND w.event='transfer.'||json_extract(e.transfer_json,'$.status') AND json_extract(w.transfer_json,'$.status')=json_extract(e.transfer_json,'$.status'))
 AND NOT EXISTS(SELECT 1 FROM employee_transfer_observations o WHERE o.reference=i.reference AND (
 o.source NOT IN ('initiate','verify','webhook') OR json_type(o.transfer_json) IS NOT 'object'
 OR json_extract(o.transfer_json,'$.reference') IS NOT i.reference OR json_extract(o.transfer_json,'$.mode') IS NOT 'test'
 OR json_extract(o.transfer_json,'$.amount') IS NOT i.amount_cents OR json_extract(o.transfer_json,'$.currency') IS NOT 'ZAR'
 OR json_extract(o.transfer_json,'$.recipientId') IS NOT json_extract(i.source_json,'$.recipient.id')
 OR json_extract(o.transfer_json,'$.integration') IS NOT json_extract(i.source_json,'$.recipient.integration')
 OR json_extract(o.transfer_json,'$.id') IS NULL OR json_extract(o.transfer_json,'$.code') IS NULL
 OR json_extract(o.transfer_json,'$.id') IS NOT json_extract(e.transfer_json,'$.id') OR json_extract(o.transfer_json,'$.code') IS NOT json_extract(e.transfer_json,'$.code')
 OR (o.source='webhook' AND (o.event NOT IN ('transfer.success','transfer.failed','transfer.reversed') OR o.event IS NOT 'transfer.'||json_extract(o.transfer_json,'$.status')))
 OR json_extract(o.transfer_json,'$.status') NOT IN ('pending','otp','received',json_extract(e.transfer_json,'$.status'),CASE json_extract(e.transfer_json,'$.status') WHEN 'reversed' THEN 'success' ELSE 'failed' END)
 OR (json_extract(o.transfer_json,'$.status') IS NOT json_extract(e.transfer_json,'$.status') AND EXISTS(SELECT 1 FROM employee_transfer_observations terminal WHERE terminal.reference=i.reference AND terminal.rowid<o.rowid AND json_extract(terminal.transfer_json,'$.status')=json_extract(e.transfer_json,'$.status')))
 ));
--> statement-breakpoint
CREATE TRIGGER employee_recovery_proposal_insert BEFORE INSERT ON employee_recovery_proposals BEGIN
 SELECT CASE WHEN NEW.auth_method NOT IN ('mfa_verified','owner_mfa_exception') OR length(trim(NEW.note))<3 OR NOT (julianday(NEW.created_at) IS NOT NULL AND julianday(NEW.created_at) BETWEEN julianday('now')-5.0/1440 AND julianday('now')+1.0/86400) OR NOT EXISTS(
 SELECT 1 FROM employee_payment_instructions i JOIN employee_recovery_terminal t ON t.reference=i.reference
 WHERE i.reference=NEW.reference AND i.version=NEW.instruction_version AND i.active_key IS NOT NULL AND i.source_hash=NEW.source_hash
 AND NOT EXISTS(SELECT 1 FROM employee_recovery_chain_holds h WHERE h.reference=i.reference)
 AND t.evidence_id=NEW.evidence_id AND t.disposition=NEW.disposition AND NEW.user_id IS NOT json_extract(i.source_json,'$.ownerUser')
 AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=NEW.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=i.amount_cents AND g.role='payroll_preparer' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active')
 ) THEN RAISE(ABORT,'Recovery final evidence, version or proposer authority changed') END;
END;
--> statement-breakpoint
CREATE VIEW employee_recovery_reviewable AS
 SELECT p.*,i.amount_cents,i.source_json,i.prepared_by,i.prepared_user FROM employee_recovery_proposals p
 JOIN employee_payment_instructions i ON i.reference=p.reference AND i.version=p.instruction_version AND i.source_hash=p.source_hash AND i.active_key IS NOT NULL
 JOIN employee_recovery_terminal t ON t.reference=p.reference AND t.evidence_id=p.evidence_id AND t.disposition=p.disposition
 WHERE NOT EXISTS(SELECT 1 FROM employee_recovery_chain_holds h WHERE h.reference=p.reference) AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=p.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=i.amount_cents AND g.role='payroll_preparer' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active');
--> statement-breakpoint
CREATE TRIGGER employee_recovery_approval_insert BEFORE INSERT ON employee_recovery_approvals BEGIN
 SELECT CASE WHEN NEW.auth_method NOT IN ('mfa_verified','owner_mfa_exception') OR length(trim(NEW.note))<3 OR NOT (julianday(NEW.created_at) IS NOT NULL AND julianday(NEW.created_at) BETWEEN julianday('now')-5.0/1440 AND julianday('now')+1.0/86400) OR NOT EXISTS(
 SELECT 1 FROM employee_recovery_reviewable p WHERE p.id=NEW.proposal_id AND NEW.operator_id!=p.operator_id AND NEW.user_id!=p.user_id AND NEW.operator_id!=p.prepared_by AND NEW.user_id!=p.prepared_user AND NEW.user_id IS NOT json_extract(p.source_json,'$.ownerUser') AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=NEW.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=p.amount_cents AND g.role='finance_approver' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active')
 ) THEN RAISE(ABORT,'Recovery evidence or independent finance authority changed') END;
END;
--> statement-breakpoint
CREATE VIEW employee_recovery_available AS
 SELECT a.id AS approval_id,p.* FROM employee_recovery_approvals a JOIN employee_recovery_reviewable p ON p.id=a.proposal_id
 WHERE a.operator_id!=p.operator_id AND a.user_id!=p.user_id AND a.operator_id!=p.prepared_by AND a.user_id!=p.prepared_user AND a.user_id IS NOT json_extract(p.source_json,'$.ownerUser') AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=a.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=p.amount_cents AND g.role='finance_approver' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active');
--> statement-breakpoint
CREATE TRIGGER employee_recovery_replacement_insert BEFORE INSERT ON employee_recovery_replacements BEGIN
 SELECT CASE WHEN NEW.reference=NEW.predecessor OR NOT (julianday(NEW.created_at) IS NOT NULL AND julianday(NEW.created_at) BETWEEN julianday('now')-5.0/1440 AND julianday('now')+1.0/86400) OR EXISTS(SELECT 1 FROM employee_payment_instructions WHERE reference=NEW.reference)
 OR NOT EXISTS(SELECT 1 FROM employee_recovery_available a WHERE a.reference=NEW.predecessor AND a.approval_id=NEW.approval_id)
 THEN RAISE(ABORT,'Recovery replacement evidence or approval changed') END;
END;
--> statement-breakpoint
CREATE TRIGGER employee_recovery_instruction_insert BEFORE INSERT ON employee_payment_instructions BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM employee_payment_instructions old WHERE old.payroll_item_id=NEW.payroll_item_id AND old.mode=NEW.mode AND old.status='dispatch_claimed' AND old.active_key IS NULL)
 AND NOT EXISTS(SELECT 1 FROM employee_recovery_replacements WHERE reference=NEW.reference)
 THEN RAISE(ABORT,'Claimed replacement history requires an explicit recovery chain') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM employee_recovery_replacements r WHERE r.reference=NEW.reference) AND NOT EXISTS(
 SELECT 1 FROM employee_recovery_replacements r JOIN employee_payment_instructions i ON i.reference=r.predecessor JOIN employee_recovery_available a ON a.approval_id=r.approval_id
 WHERE r.reference=NEW.reference AND i.payroll_item_id=NEW.payroll_item_id AND i.destination_id=NEW.destination_id AND i.source_json=NEW.source_json AND i.source_hash=NEW.source_hash AND i.amount_cents=NEW.amount_cents AND NEW.mode='test'
 ) THEN RAISE(ABORT,'Replacement must preserve exact original instruction and current approval') END;
 UPDATE employee_payment_instructions SET active_key=NULL,version=version+1,updated_at=NEW.created_at
 WHERE reference=(SELECT predecessor FROM employee_recovery_replacements WHERE reference=NEW.reference);
END;
--> statement-breakpoint
DROP TRIGGER employee_payment_update;
--> statement-breakpoint
CREATE TRIGGER employee_payment_update BEFORE UPDATE ON employee_payment_instructions BEGIN
 SELECT (CASE WHEN NEW.reference IS NOT OLD.reference OR NEW.payroll_item_id IS NOT OLD.payroll_item_id OR NEW.destination_id IS NOT OLD.destination_id OR NEW.mode IS NOT OLD.mode OR NEW.amount_cents IS NOT OLD.amount_cents OR NEW.source_json IS NOT OLD.source_json OR NEW.source_hash IS NOT OLD.source_hash OR NEW.request_key IS NOT OLD.request_key OR NEW.request_hash IS NOT OLD.request_hash OR NEW.prepared_by IS NOT OLD.prepared_by OR NEW.prepared_user IS NOT OLD.prepared_user OR NEW.created_at IS NOT OLD.created_at OR NEW.version!=OLD.version+1
 OR NOT ((OLD.status='dispatch_claimed' AND NEW.status=OLD.status AND OLD.active_key IS NOT NULL AND NEW.active_key IS NULL AND NEW.approved_by IS OLD.approved_by AND EXISTS(SELECT 1 FROM employee_recovery_replacements r JOIN employee_recovery_available a ON a.approval_id=r.approval_id WHERE r.predecessor=OLD.reference AND NOT EXISTS(SELECT 1 FROM employee_payment_instructions child WHERE child.reference=r.reference))) OR EXISTS(SELECT 1 FROM employee_payment_commands c WHERE c.reference=OLD.reference AND c.version=OLD.version AND ((c.action='approve' AND NEW.status='approved' AND NEW.approved_by=c.operator_id AND NEW.active_key IS OLD.active_key) OR (c.action='cancel' AND NEW.status='cancelled' AND NEW.active_key IS NULL AND NEW.approved_by IS OLD.approved_by) OR (c.action='dispatch_test' AND NEW.status='dispatch_claimed' AND NEW.active_key IS OLD.active_key AND NEW.approved_by IS OLD.approved_by))) )
 THEN RAISE(ABORT,'Employee instruction history or transition is invalid') END);
END;
--> statement-breakpoint
CREATE VIEW employee_recovery_chain_holds AS
 WITH RECURSIVE chain(reference,predecessor,approval_id) AS (
 SELECT reference,predecessor,approval_id FROM employee_recovery_replacements
 UNION ALL SELECT c.reference,r.predecessor,r.approval_id FROM chain c JOIN employee_recovery_replacements r ON r.reference=c.predecessor
 ) SELECT c.reference FROM chain c JOIN employee_recovery_approvals a ON a.id=c.approval_id JOIN employee_recovery_proposals p ON p.id=a.proposal_id
 WHERE NOT EXISTS(SELECT 1 FROM employee_recovery_terminal t WHERE t.reference=c.predecessor AND t.disposition=p.disposition)
 OR NOT (EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=p.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=(SELECT amount_cents FROM employee_payment_instructions WHERE reference=c.predecessor) AND g.role='payroll_preparer' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active'))
 OR NOT (EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=a.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=(SELECT amount_cents FROM employee_payment_instructions WHERE reference=c.predecessor) AND g.role='finance_approver' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active'));
--> statement-breakpoint
CREATE TRIGGER employee_recovery_command_guard BEFORE INSERT ON employee_payment_commands BEGIN
 SELECT CASE WHEN NEW.action!='cancel' AND EXISTS(SELECT 1 FROM employee_recovery_chain_holds WHERE reference=NEW.reference)
 THEN RAISE(ABORT,'Replacement ancestor evidence or authority changed; hold the chain') END;
END;
--> statement-breakpoint
CREATE TRIGGER employee_recovery_proposals_update BEFORE UPDATE ON employee_recovery_proposals BEGIN SELECT RAISE(ABORT,'Recovery history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER employee_recovery_proposals_delete BEFORE DELETE ON employee_recovery_proposals BEGIN SELECT RAISE(ABORT,'Recovery history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER employee_recovery_approvals_update BEFORE UPDATE ON employee_recovery_approvals BEGIN SELECT RAISE(ABORT,'Recovery history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER employee_recovery_approvals_delete BEFORE DELETE ON employee_recovery_approvals BEGIN SELECT RAISE(ABORT,'Recovery history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER employee_recovery_replacements_update BEFORE UPDATE ON employee_recovery_replacements BEGIN SELECT RAISE(ABORT,'Recovery history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER employee_recovery_replacements_delete BEFORE DELETE ON employee_recovery_replacements BEGIN SELECT RAISE(ABORT,'Recovery history is immutable'); END;
--> statement-breakpoint
CREATE TABLE partner_recovery_proposals (
 id TEXT PRIMARY KEY NOT NULL, reference TEXT NOT NULL REFERENCES partner_payment_instructions(reference),
 instruction_version INTEGER NOT NULL, evidence_id TEXT NOT NULL REFERENCES partner_transfer_observations(id),
 disposition TEXT NOT NULL CHECK(disposition IN ('failed','reversed')), source_hash TEXT NOT NULL,
 operator_id TEXT NOT NULL, user_id TEXT NOT NULL, note TEXT NOT NULL, auth_method TEXT NOT NULL, created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE partner_recovery_approvals (
 id TEXT PRIMARY KEY NOT NULL, proposal_id TEXT NOT NULL UNIQUE REFERENCES partner_recovery_proposals(id),
 operator_id TEXT NOT NULL, user_id TEXT NOT NULL, note TEXT NOT NULL, auth_method TEXT NOT NULL, created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE partner_recovery_replacements (
 reference TEXT PRIMARY KEY NOT NULL, predecessor TEXT NOT NULL UNIQUE REFERENCES partner_payment_instructions(reference),
 approval_id TEXT NOT NULL UNIQUE REFERENCES partner_recovery_approvals(id), created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE VIEW partner_recovery_terminal AS
 SELECT i.reference,e.id AS evidence_id,json_extract(e.transfer_json,'$.status') AS disposition
 FROM partner_payment_instructions i JOIN partner_transfer_observations e ON e.reference=i.reference
 WHERE (SELECT count(*) FROM partner_transfer_observations bounded WHERE bounded.reference=i.reference)<=500
 AND i.mode='test' AND i.status='dispatch_claimed' AND e.source='verify' AND e.event='transfer.verify'
 AND e.rowid=(SELECT max(o.rowid) FROM partner_transfer_observations o WHERE o.reference=i.reference)
 AND julianday(e.created_at) IS NOT NULL AND julianday(e.created_at) BETWEEN julianday('now')-5.0/1440 AND julianday('now')+1.0/86400
 AND json_extract(e.transfer_json,'$.status') IN ('failed','reversed')
 AND e.webhook_count=(SELECT count(*) FROM partner_transfer_observations o WHERE o.reference=i.reference AND o.source='webhook')
 AND EXISTS(SELECT 1 FROM partner_transfer_observations w WHERE w.reference=i.reference AND w.source='webhook' AND w.event='transfer.'||json_extract(e.transfer_json,'$.status') AND json_extract(w.transfer_json,'$.status')=json_extract(e.transfer_json,'$.status'))
 AND NOT EXISTS(SELECT 1 FROM partner_transfer_observations o WHERE o.reference=i.reference AND (
 o.source NOT IN ('initiate','verify','webhook') OR json_type(o.transfer_json) IS NOT 'object'
 OR json_extract(o.transfer_json,'$.reference') IS NOT i.reference OR json_extract(o.transfer_json,'$.mode') IS NOT 'test'
 OR json_extract(o.transfer_json,'$.amount') IS NOT i.amount_cents OR json_extract(o.transfer_json,'$.currency') IS NOT 'ZAR'
 OR json_extract(o.transfer_json,'$.recipientId') IS NOT json_extract(i.source_json,'$.recipient.id')
 OR json_extract(o.transfer_json,'$.integration') IS NOT json_extract(i.source_json,'$.recipient.integration')
 OR json_extract(o.transfer_json,'$.id') IS NULL OR json_extract(o.transfer_json,'$.code') IS NULL
 OR json_extract(o.transfer_json,'$.id') IS NOT json_extract(e.transfer_json,'$.id') OR json_extract(o.transfer_json,'$.code') IS NOT json_extract(e.transfer_json,'$.code')
 OR (o.source='webhook' AND (o.event NOT IN ('transfer.success','transfer.failed','transfer.reversed') OR o.event IS NOT 'transfer.'||json_extract(o.transfer_json,'$.status')))
 OR json_extract(o.transfer_json,'$.status') NOT IN ('pending','otp','received',json_extract(e.transfer_json,'$.status'),CASE json_extract(e.transfer_json,'$.status') WHEN 'reversed' THEN 'success' ELSE 'failed' END)
 OR (json_extract(o.transfer_json,'$.status') IS NOT json_extract(e.transfer_json,'$.status') AND EXISTS(SELECT 1 FROM partner_transfer_observations terminal WHERE terminal.reference=i.reference AND terminal.rowid<o.rowid AND json_extract(terminal.transfer_json,'$.status')=json_extract(e.transfer_json,'$.status')))
 ));
--> statement-breakpoint
CREATE TRIGGER partner_recovery_proposal_insert BEFORE INSERT ON partner_recovery_proposals BEGIN
 SELECT CASE WHEN NEW.auth_method NOT IN ('mfa_verified','owner_mfa_exception') OR length(trim(NEW.note))<3 OR NOT (julianday(NEW.created_at) IS NOT NULL AND julianday(NEW.created_at) BETWEEN julianday('now')-5.0/1440 AND julianday('now')+1.0/86400) OR NOT EXISTS(
 SELECT 1 FROM partner_payment_instructions i JOIN partner_recovery_terminal t ON t.reference=i.reference
 WHERE i.reference=NEW.reference AND i.version=NEW.instruction_version AND i.active_key IS NOT NULL AND i.source_hash=NEW.source_hash
 AND NOT EXISTS(SELECT 1 FROM partner_recovery_chain_holds h WHERE h.reference=i.reference)
 AND t.evidence_id=NEW.evidence_id AND t.disposition=NEW.disposition AND NEW.user_id NOT IN (json_extract(i.source_json,'$.representativeUser'),json_extract(i.source_json,'$.officerUser'),json_extract(i.source_json,'$.clientUser'))
 AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=NEW.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=i.amount_cents AND g.role='operations_controller' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active')
 ) THEN RAISE(ABORT,'Recovery final evidence, version or proposer authority changed') END;
END;
--> statement-breakpoint
CREATE VIEW partner_recovery_reviewable AS
 SELECT p.*,i.amount_cents,i.source_json,i.prepared_by,i.prepared_user FROM partner_recovery_proposals p
 JOIN partner_payment_instructions i ON i.reference=p.reference AND i.version=p.instruction_version AND i.source_hash=p.source_hash AND i.active_key IS NOT NULL
 JOIN partner_recovery_terminal t ON t.reference=p.reference AND t.evidence_id=p.evidence_id AND t.disposition=p.disposition
 WHERE NOT EXISTS(SELECT 1 FROM partner_recovery_chain_holds h WHERE h.reference=p.reference) AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=p.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=i.amount_cents AND g.role='operations_controller' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active');
--> statement-breakpoint
CREATE TRIGGER partner_recovery_approval_insert BEFORE INSERT ON partner_recovery_approvals BEGIN
 SELECT CASE WHEN NEW.auth_method NOT IN ('mfa_verified','owner_mfa_exception') OR length(trim(NEW.note))<3 OR NOT (julianday(NEW.created_at) IS NOT NULL AND julianday(NEW.created_at) BETWEEN julianday('now')-5.0/1440 AND julianday('now')+1.0/86400) OR NOT EXISTS(
 SELECT 1 FROM partner_recovery_reviewable p WHERE p.id=NEW.proposal_id AND NEW.operator_id!=p.operator_id AND NEW.user_id!=p.user_id AND NEW.operator_id!=p.prepared_by AND NEW.user_id!=p.prepared_user AND NEW.user_id NOT IN (json_extract(p.source_json,'$.representativeUser'),json_extract(p.source_json,'$.officerUser'),json_extract(p.source_json,'$.clientUser')) AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=NEW.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=p.amount_cents AND g.role='finance_approver' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active')
 ) THEN RAISE(ABORT,'Recovery evidence or independent finance authority changed') END;
END;
--> statement-breakpoint
CREATE VIEW partner_recovery_available AS
 SELECT a.id AS approval_id,p.* FROM partner_recovery_approvals a JOIN partner_recovery_reviewable p ON p.id=a.proposal_id
 WHERE a.operator_id!=p.operator_id AND a.user_id!=p.user_id AND a.operator_id!=p.prepared_by AND a.user_id!=p.prepared_user AND a.user_id NOT IN (json_extract(p.source_json,'$.representativeUser'),json_extract(p.source_json,'$.officerUser'),json_extract(p.source_json,'$.clientUser')) AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=a.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=p.amount_cents AND g.role='finance_approver' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active');
--> statement-breakpoint
CREATE TRIGGER partner_recovery_replacement_insert BEFORE INSERT ON partner_recovery_replacements BEGIN
 SELECT CASE WHEN NEW.reference=NEW.predecessor OR NOT (julianday(NEW.created_at) IS NOT NULL AND julianday(NEW.created_at) BETWEEN julianday('now')-5.0/1440 AND julianday('now')+1.0/86400) OR EXISTS(SELECT 1 FROM partner_payment_instructions WHERE reference=NEW.reference)
 OR NOT EXISTS(SELECT 1 FROM partner_recovery_available a WHERE a.reference=NEW.predecessor AND a.approval_id=NEW.approval_id)
 THEN RAISE(ABORT,'Recovery replacement evidence or approval changed') END;
END;
--> statement-breakpoint
CREATE TRIGGER partner_recovery_instruction_insert BEFORE INSERT ON partner_payment_instructions BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM partner_payment_instructions old WHERE old.payable_id=NEW.payable_id AND old.mode=NEW.mode AND old.status='dispatch_claimed' AND old.active_key IS NULL)
 AND NOT EXISTS(SELECT 1 FROM partner_recovery_replacements WHERE reference=NEW.reference)
 THEN RAISE(ABORT,'Claimed replacement history requires an explicit recovery chain') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM partner_recovery_replacements r WHERE r.reference=NEW.reference) AND NOT EXISTS(
 SELECT 1 FROM partner_recovery_replacements r JOIN partner_payment_instructions i ON i.reference=r.predecessor JOIN partner_recovery_available a ON a.approval_id=r.approval_id
 WHERE r.reference=NEW.reference AND i.payable_id=NEW.payable_id AND i.destination_id=NEW.destination_id AND i.source_json=NEW.source_json AND i.source_hash=NEW.source_hash AND i.amount_cents=NEW.amount_cents AND NEW.mode='test'
 ) THEN RAISE(ABORT,'Replacement must preserve exact original instruction and current approval') END;
 UPDATE partner_payment_instructions SET active_key=NULL,version=version+1,updated_at=NEW.created_at
 WHERE reference=(SELECT predecessor FROM partner_recovery_replacements WHERE reference=NEW.reference);
END;
--> statement-breakpoint
DROP TRIGGER partner_payment_update;
--> statement-breakpoint
CREATE TRIGGER partner_payment_update BEFORE UPDATE ON partner_payment_instructions BEGIN
 SELECT (CASE WHEN NEW.reference IS NOT OLD.reference OR NEW.payable_id IS NOT OLD.payable_id OR NEW.destination_id IS NOT OLD.destination_id OR NEW.mode IS NOT OLD.mode OR NEW.amount_cents IS NOT OLD.amount_cents OR NEW.source_json IS NOT OLD.source_json OR NEW.source_hash IS NOT OLD.source_hash OR NEW.request_key IS NOT OLD.request_key OR NEW.request_hash IS NOT OLD.request_hash OR NEW.prepared_by IS NOT OLD.prepared_by OR NEW.prepared_user IS NOT OLD.prepared_user OR NEW.created_at IS NOT OLD.created_at OR NEW.version!=OLD.version+1
 OR NOT ((OLD.status='dispatch_claimed' AND NEW.status=OLD.status AND OLD.active_key IS NOT NULL AND NEW.active_key IS NULL AND NEW.approved_by IS OLD.approved_by AND EXISTS(SELECT 1 FROM partner_recovery_replacements r JOIN partner_recovery_available a ON a.approval_id=r.approval_id WHERE r.predecessor=OLD.reference AND NOT EXISTS(SELECT 1 FROM partner_payment_instructions child WHERE child.reference=r.reference))) OR EXISTS(SELECT 1 FROM partner_payment_commands c WHERE c.reference=OLD.reference AND c.version=OLD.version AND ((c.action='approve' AND NEW.status='approved' AND NEW.approved_by=c.operator_id AND NEW.active_key IS OLD.active_key) OR (c.action='cancel' AND NEW.status='cancelled' AND NEW.active_key IS NULL AND NEW.approved_by IS OLD.approved_by) OR (c.action='dispatch_test' AND NEW.status='dispatch_claimed' AND NEW.active_key IS OLD.active_key AND NEW.approved_by IS OLD.approved_by))) )
 THEN RAISE(ABORT,'Partner instruction history or transition is invalid') END);
END;
--> statement-breakpoint
CREATE VIEW partner_recovery_chain_holds AS
 WITH RECURSIVE chain(reference,predecessor,approval_id) AS (
 SELECT reference,predecessor,approval_id FROM partner_recovery_replacements
 UNION ALL SELECT c.reference,r.predecessor,r.approval_id FROM chain c JOIN partner_recovery_replacements r ON r.reference=c.predecessor
 ) SELECT c.reference FROM chain c JOIN partner_recovery_approvals a ON a.id=c.approval_id JOIN partner_recovery_proposals p ON p.id=a.proposal_id
 WHERE NOT EXISTS(SELECT 1 FROM partner_recovery_terminal t WHERE t.reference=c.predecessor AND t.disposition=p.disposition)
 OR NOT (EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=p.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=(SELECT amount_cents FROM partner_payment_instructions WHERE reference=c.predecessor) AND g.role='operations_controller' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active'))
 OR NOT (EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=a.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=(SELECT amount_cents FROM partner_payment_instructions WHERE reference=c.predecessor) AND g.role='finance_approver' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active'));
--> statement-breakpoint
CREATE TRIGGER partner_recovery_command_guard BEFORE INSERT ON partner_payment_commands BEGIN
 SELECT CASE WHEN NEW.action!='cancel' AND EXISTS(SELECT 1 FROM partner_recovery_chain_holds WHERE reference=NEW.reference)
 THEN RAISE(ABORT,'Replacement ancestor evidence or authority changed; hold the chain') END;
END;
--> statement-breakpoint
CREATE TRIGGER partner_recovery_proposals_update BEFORE UPDATE ON partner_recovery_proposals BEGIN SELECT RAISE(ABORT,'Recovery history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER partner_recovery_proposals_delete BEFORE DELETE ON partner_recovery_proposals BEGIN SELECT RAISE(ABORT,'Recovery history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER partner_recovery_approvals_update BEFORE UPDATE ON partner_recovery_approvals BEGIN SELECT RAISE(ABORT,'Recovery history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER partner_recovery_approvals_delete BEFORE DELETE ON partner_recovery_approvals BEGIN SELECT RAISE(ABORT,'Recovery history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER partner_recovery_replacements_update BEFORE UPDATE ON partner_recovery_replacements BEGIN SELECT RAISE(ABORT,'Recovery history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER partner_recovery_replacements_delete BEFORE DELETE ON partner_recovery_replacements BEGIN SELECT RAISE(ABORT,'Recovery history is immutable'); END;
