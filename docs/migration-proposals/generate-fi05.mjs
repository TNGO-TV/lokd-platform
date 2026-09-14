// Unnumbered migration contract; Central Command owns journal/schema integration.
import fs from 'node:fs';
const statements=[];
for(const kind of ['employee','partner']){
 const p=kind, item=kind==='employee'?'payroll_item_id':'payable_id',role=kind==='employee'?'payroll_preparer':'operations_controller';
 const excluded=(alias,user)=>kind==='employee'?`${user} IS NOT json_extract(${alias}.source_json,'$.ownerUser')`:`${user} NOT IN (json_extract(${alias}.source_json,'$.representativeUser'),json_extract(${alias}.source_json,'$.officerUser'),json_extract(${alias}.source_json,'$.clientUser'))`;
 const authority=(op,role,amount)=>`EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=${op} AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=${amount} AND g.role='${role}' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active')`;
 const fresh=t=>`julianday(${t}) IS NOT NULL AND julianday(${t}) BETWEEN julianday('now')-5.0/1440 AND julianday('now')+1.0/86400`;
 statements.push(`CREATE TABLE ${p}_recovery_proposals (
 id TEXT PRIMARY KEY NOT NULL, reference TEXT NOT NULL REFERENCES ${p}_payment_instructions(reference),
 instruction_version INTEGER NOT NULL, evidence_id TEXT NOT NULL REFERENCES ${p}_transfer_observations(id),
 disposition TEXT NOT NULL CHECK(disposition IN ('failed','reversed')), source_hash TEXT NOT NULL,
 operator_id TEXT NOT NULL, user_id TEXT NOT NULL, note TEXT NOT NULL, auth_method TEXT NOT NULL, created_at TEXT NOT NULL
)`);
 statements.push(`CREATE TABLE ${p}_recovery_approvals (
 id TEXT PRIMARY KEY NOT NULL, proposal_id TEXT NOT NULL UNIQUE REFERENCES ${p}_recovery_proposals(id),
 operator_id TEXT NOT NULL, user_id TEXT NOT NULL, note TEXT NOT NULL, auth_method TEXT NOT NULL, created_at TEXT NOT NULL
)`);
 statements.push(`CREATE TABLE ${p}_recovery_replacements (
 reference TEXT PRIMARY KEY NOT NULL, predecessor TEXT NOT NULL UNIQUE REFERENCES ${p}_payment_instructions(reference),
 approval_id TEXT NOT NULL UNIQUE REFERENCES ${p}_recovery_approvals(id), created_at TEXT NOT NULL
)`);
 // Only the latest observation may be used. Every observation must bind the same exact transfer.
 statements.push(`CREATE VIEW ${p}_recovery_terminal AS
 SELECT i.reference,e.id AS evidence_id,json_extract(e.transfer_json,'$.status') AS disposition
 FROM ${p}_payment_instructions i JOIN ${p}_transfer_observations e ON e.reference=i.reference
 WHERE (SELECT count(*) FROM ${p}_transfer_observations bounded WHERE bounded.reference=i.reference)<=500
 AND i.mode='test' AND i.status='dispatch_claimed' AND e.source='verify' AND e.event='transfer.verify'
 AND e.rowid=(SELECT max(o.rowid) FROM ${p}_transfer_observations o WHERE o.reference=i.reference)
 AND ${fresh('e.created_at')}
 AND json_extract(e.transfer_json,'$.status') IN ('failed','reversed')
 AND e.webhook_count=(SELECT count(*) FROM ${p}_transfer_observations o WHERE o.reference=i.reference AND o.source='webhook')
 AND EXISTS(SELECT 1 FROM ${p}_transfer_observations w WHERE w.reference=i.reference AND w.source='webhook' AND w.event='transfer.'||json_extract(e.transfer_json,'$.status') AND json_extract(w.transfer_json,'$.status')=json_extract(e.transfer_json,'$.status'))
 AND NOT EXISTS(SELECT 1 FROM ${p}_transfer_observations o WHERE o.reference=i.reference AND (
 o.source NOT IN ('initiate','verify','webhook') OR json_type(o.transfer_json) IS NOT 'object'
 OR json_extract(o.transfer_json,'$.reference') IS NOT i.reference OR json_extract(o.transfer_json,'$.mode') IS NOT 'test'
 OR json_extract(o.transfer_json,'$.amount') IS NOT i.amount_cents OR json_extract(o.transfer_json,'$.currency') IS NOT 'ZAR'
 OR json_extract(o.transfer_json,'$.recipientId') IS NOT json_extract(i.source_json,'$.recipient.id')
 OR json_extract(o.transfer_json,'$.integration') IS NOT json_extract(i.source_json,'$.recipient.integration')
 OR json_extract(o.transfer_json,'$.id') IS NULL OR json_extract(o.transfer_json,'$.code') IS NULL
 OR json_extract(o.transfer_json,'$.id') IS NOT json_extract(e.transfer_json,'$.id') OR json_extract(o.transfer_json,'$.code') IS NOT json_extract(e.transfer_json,'$.code')
 OR (o.source='webhook' AND (o.event NOT IN ('transfer.success','transfer.failed','transfer.reversed') OR o.event IS NOT 'transfer.'||json_extract(o.transfer_json,'$.status')))
 OR json_extract(o.transfer_json,'$.status') NOT IN ('pending','otp','received',json_extract(e.transfer_json,'$.status'),CASE json_extract(e.transfer_json,'$.status') WHEN 'reversed' THEN 'success' ELSE 'failed' END)
 OR (json_extract(o.transfer_json,'$.status') IS NOT json_extract(e.transfer_json,'$.status') AND EXISTS(SELECT 1 FROM ${p}_transfer_observations terminal WHERE terminal.reference=i.reference AND terminal.rowid<o.rowid AND json_extract(terminal.transfer_json,'$.status')=json_extract(e.transfer_json,'$.status')))
 ))`);
 statements.push(`CREATE TRIGGER ${p}_recovery_proposal_insert BEFORE INSERT ON ${p}_recovery_proposals BEGIN
 SELECT CASE WHEN NEW.auth_method NOT IN ('mfa_verified','owner_mfa_exception') OR length(trim(NEW.note))<3 OR NOT (${fresh('NEW.created_at')}) OR NOT EXISTS(
 SELECT 1 FROM ${p}_payment_instructions i JOIN ${p}_recovery_terminal t ON t.reference=i.reference
 WHERE i.reference=NEW.reference AND i.version=NEW.instruction_version AND i.active_key IS NOT NULL AND i.source_hash=NEW.source_hash
 AND NOT EXISTS(SELECT 1 FROM ${p}_recovery_chain_holds h WHERE h.reference=i.reference)
 AND t.evidence_id=NEW.evidence_id AND t.disposition=NEW.disposition AND ${excluded('i','NEW.user_id')}
 AND ${authority('NEW.operator_id',role,'i.amount_cents')}
 ) THEN RAISE(ABORT,'Recovery final evidence, version or proposer authority changed') END;
END`);
 statements.push(`CREATE VIEW ${p}_recovery_reviewable AS
 SELECT p.*,i.amount_cents,i.source_json,i.prepared_by,i.prepared_user FROM ${p}_recovery_proposals p
 JOIN ${p}_payment_instructions i ON i.reference=p.reference AND i.version=p.instruction_version AND i.source_hash=p.source_hash AND i.active_key IS NOT NULL
 JOIN ${p}_recovery_terminal t ON t.reference=p.reference AND t.evidence_id=p.evidence_id AND t.disposition=p.disposition
 WHERE NOT EXISTS(SELECT 1 FROM ${p}_recovery_chain_holds h WHERE h.reference=p.reference) AND ${authority('p.operator_id',role,'i.amount_cents')}`);
 const approver=(alias)=>`${alias}.operator_id!=p.operator_id AND ${alias}.user_id!=p.user_id AND ${alias}.operator_id!=p.prepared_by AND ${alias}.user_id!=p.prepared_user AND ${excluded('p',alias+'.user_id')} AND ${authority(alias+'.operator_id','finance_approver','p.amount_cents')}`;
 statements.push(`CREATE TRIGGER ${p}_recovery_approval_insert BEFORE INSERT ON ${p}_recovery_approvals BEGIN
 SELECT CASE WHEN NEW.auth_method NOT IN ('mfa_verified','owner_mfa_exception') OR length(trim(NEW.note))<3 OR NOT (${fresh('NEW.created_at')}) OR NOT EXISTS(
 SELECT 1 FROM ${p}_recovery_reviewable p WHERE p.id=NEW.proposal_id AND ${approver('NEW')}
 ) THEN RAISE(ABORT,'Recovery evidence or independent finance authority changed') END;
END`);
 statements.push(`CREATE VIEW ${p}_recovery_available AS
 SELECT a.id AS approval_id,p.* FROM ${p}_recovery_approvals a JOIN ${p}_recovery_reviewable p ON p.id=a.proposal_id
 WHERE ${approver('a')}`);
 statements.push(`CREATE TRIGGER ${p}_recovery_replacement_insert BEFORE INSERT ON ${p}_recovery_replacements BEGIN
 SELECT CASE WHEN NEW.reference=NEW.predecessor OR NOT (${fresh('NEW.created_at')}) OR EXISTS(SELECT 1 FROM ${p}_payment_instructions WHERE reference=NEW.reference)
 OR NOT EXISTS(SELECT 1 FROM ${p}_recovery_available a WHERE a.reference=NEW.predecessor AND a.approval_id=NEW.approval_id)
 THEN RAISE(ABORT,'Recovery replacement evidence or approval changed') END;
END`);
 // Rotate the active slot only when the replacement instruction is actually inserted.
 statements.push(`CREATE TRIGGER ${p}_recovery_instruction_insert BEFORE INSERT ON ${p}_payment_instructions BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM ${p}_payment_instructions old WHERE old.${item}=NEW.${item} AND old.mode=NEW.mode AND old.status='dispatch_claimed' AND old.active_key IS NULL)
 AND NOT EXISTS(SELECT 1 FROM ${p}_recovery_replacements WHERE reference=NEW.reference)
 THEN RAISE(ABORT,'Claimed replacement history requires an explicit recovery chain') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM ${p}_recovery_replacements r WHERE r.reference=NEW.reference) AND NOT EXISTS(
 SELECT 1 FROM ${p}_recovery_replacements r JOIN ${p}_payment_instructions i ON i.reference=r.predecessor JOIN ${p}_recovery_available a ON a.approval_id=r.approval_id
 WHERE r.reference=NEW.reference AND i.${item}=NEW.${item} AND i.destination_id=NEW.destination_id AND i.source_json=NEW.source_json AND i.source_hash=NEW.source_hash AND i.amount_cents=NEW.amount_cents AND NEW.mode='test'
 ) THEN RAISE(ABORT,'Replacement must preserve exact original instruction and current approval') END;
 UPDATE ${p}_payment_instructions SET active_key=NULL,version=version+1,updated_at=NEW.created_at
 WHERE reference=(SELECT predecessor FROM ${p}_recovery_replacements WHERE reference=NEW.reference);
END`);
 const base=fs.readFileSync(new URL(`../../drizzle/${kind==='employee'?'0056_mute_supreme_intelligence.sql':'0059_puzzling_jack_power.sql'}`,import.meta.url),'utf8');
 const trigger=base.match(new RegExp(`CREATE TRIGGER ${p}_payment_update BEFORE UPDATE[\\s\\S]*?\\nEND;`))[0];
 const guard=`(OLD.status='dispatch_claimed' AND NEW.status=OLD.status AND OLD.active_key IS NOT NULL AND NEW.active_key IS NULL AND NEW.approved_by IS OLD.approved_by AND EXISTS(SELECT 1 FROM ${p}_recovery_replacements r JOIN ${p}_recovery_available a ON a.approval_id=r.approval_id WHERE r.predecessor=OLD.reference AND NOT EXISTS(SELECT 1 FROM ${p}_payment_instructions child WHERE child.reference=r.reference)))`;
 statements.push(`DROP TRIGGER ${p}_payment_update`);
 statements.push(trigger.replace('OR NOT EXISTS(SELECT 1 FROM '+p+'_payment_commands',`OR NOT (${guard} OR EXISTS(SELECT 1 FROM ${p}_payment_commands`).replace("\n THEN RAISE"," )\n THEN RAISE").replace(/;$/,''));
 // All released ancestors must still agree with their immutable approval at every later claim.
 statements.push(`CREATE VIEW ${p}_recovery_chain_holds AS
 WITH RECURSIVE chain(reference,predecessor,approval_id) AS (
 SELECT reference,predecessor,approval_id FROM ${p}_recovery_replacements
 UNION ALL SELECT c.reference,r.predecessor,r.approval_id FROM chain c JOIN ${p}_recovery_replacements r ON r.reference=c.predecessor
 ) SELECT c.reference FROM chain c JOIN ${p}_recovery_approvals a ON a.id=c.approval_id JOIN ${p}_recovery_proposals p ON p.id=a.proposal_id
 WHERE NOT EXISTS(SELECT 1 FROM ${p}_recovery_terminal t WHERE t.reference=c.predecessor AND t.disposition=p.disposition)
 OR NOT (${authority('p.operator_id',role,'(SELECT amount_cents FROM '+p+'_payment_instructions WHERE reference=c.predecessor)')})
 OR NOT (${authority('a.operator_id','finance_approver','(SELECT amount_cents FROM '+p+'_payment_instructions WHERE reference=c.predecessor)')})`);
 statements.push(`CREATE TRIGGER ${p}_recovery_command_guard BEFORE INSERT ON ${p}_payment_commands BEGIN
 SELECT CASE WHEN NEW.action!='cancel' AND EXISTS(SELECT 1 FROM ${p}_recovery_chain_holds WHERE reference=NEW.reference)
 THEN RAISE(ABORT,'Replacement ancestor evidence or authority changed; hold the chain') END;
END`);
 for(const suffix of ['proposals','approvals','replacements'])for(const event of ['UPDATE','DELETE']) statements.push(`CREATE TRIGGER ${p}_recovery_${suffix}_${event.toLowerCase()} BEFORE ${event} ON ${p}_recovery_${suffix} BEGIN SELECT RAISE(ABORT,'Recovery history is immutable'); END`);
}
fs.writeFileSync(new URL('./fi05-payment-recovery.sql',import.meta.url),statements.join(';\n--> statement-breakpoint\n')+';\n');
