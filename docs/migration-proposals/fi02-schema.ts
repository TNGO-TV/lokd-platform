// Central Command: integrate these declarations into the canonical schema and
// allocate the additive migration. Triggers/views are in fi02-payment-execution.sql.
import {sqliteTable,text,integer,primaryKey,uniqueIndex,check} from 'drizzle-orm/sqlite-core';
import {sql} from 'drizzle-orm';
const actor=()=>({operatorId:text('operator_id').notNull(),userId:text('user_id').notNull(),note:text('note').notNull(),authMethod:text('auth_method').notNull(),createdAt:text('created_at').notNull()});
export const paymentLiveControl=sqliteTable('payment_live_control',{id:integer('id').primaryKey(),enabled:integer('enabled').notNull()},t=>[check('live_control_id',sql`${t.id}=1`),check('live_control_enabled',sql`${t.enabled} IN (0,1)`)]);
export const paymentLiveReserves=sqliteTable('payment_live_reserves',{
 id:text('id').primaryKey().notNull(),requestKey:text('request_key').notNull().unique(),integration:text('integration').notNull(),amountCents:integer('amount_cents').notNull(),fundingReference:text('funding_reference').notNull().unique(),payloadJson:text('payload_json').notNull(),payloadHash:text('payload_hash').notNull(),expiresAt:text('expires_at').notNull(),...actor(),
},t=>[uniqueIndex('payment_live_funding_evidence_once').on(t.integration,sql`json_extract(${t.payloadJson},'$.fundingHash')`),check('live_reserve_amount',sql`typeof(${t.amountCents})='integer' AND ${t.amountCents}>0 AND ${t.amountCents}<=25000000`)]);
export const paymentLiveReserveDecisions=sqliteTable('payment_live_reserve_decisions',{
 id:text('id').primaryKey().notNull(),reserveId:text('reserve_id').notNull().unique().references(()=>paymentLiveReserves.id),payloadHash:text('payload_hash').notNull(),decision:text('decision').notNull(),...actor(),
},t=>[check('live_reserve_decision',sql`${t.decision} IN ('approved','rejected')`)]);
export const paymentLiveReleases=sqliteTable('payment_live_releases',{
 id:text('id').primaryKey().notNull(),requestKey:text('request_key').notNull().unique(),kind:text('kind').notNull(),reference:text('reference').notNull(),reserveId:text('reserve_id').notNull().references(()=>paymentLiveReserves.id),sourceHash:text('source_hash').notNull(),feeCeilingCents:integer('fee_ceiling_cents').notNull(),payloadJson:text('payload_json').notNull(),payloadHash:text('payload_hash').notNull(),expiresAt:text('expires_at').notNull(),...actor(),
},t=>[check('live_release_kind',sql`${t.kind} IN ('employee','partner')`),check('live_fee_ceiling',sql`typeof(${t.feeCeilingCents})='integer' AND ${t.feeCeilingCents}>=0 AND ${t.feeCeilingCents}<=100000`)]);
export const paymentLiveReleaseDecisions=sqliteTable('payment_live_release_decisions',{
 id:text('id').primaryKey().notNull(),releaseId:text('release_id').notNull().unique().references(()=>paymentLiveReleases.id),payloadHash:text('payload_hash').notNull(),decision:text('decision').notNull(),...actor(),
},t=>[check('live_release_decision',sql`${t.decision} IN ('approved','rejected')`)]);
export const paymentLiveClaims=sqliteTable('payment_live_claims',{
 kind:text('kind').notNull(),reference:text('reference').notNull(),releaseId:text('release_id').notNull().unique().references(()=>paymentLiveReleases.id),version:integer('version').notNull(),sourceHash:text('source_hash').notNull(),recipientHash:text('recipient_hash').notNull(),balanceCents:integer('balance_cents').notNull(),...actor(),
},t=>[primaryKey({columns:[t.kind,t.reference]}),check('live_claim_kind',sql`${t.kind} IN ('employee','partner')`),check('live_claim_balance',sql`typeof(${t.balanceCents})='integer' AND ${t.balanceCents}>=0`)]);
export const paymentLiveReconciliationReviews=sqliteTable('payment_live_reconciliation_reviews',{
 id:text('id').primaryKey().notNull(),requestKey:text('request_key').notNull().unique(),kind:text('kind').notNull(),reference:text('reference').notNull(),sourceHash:text('source_hash').notNull(),evidenceId:text('evidence_id').notNull(),disposition:text('disposition').notNull(),bankReference:text('bank_reference').notNull(),bankHash:text('bank_hash').notNull(),bankAmountCents:integer('bank_amount_cents').notNull(),payloadJson:text('payload_json').notNull(),payloadHash:text('payload_hash').notNull(),expiresAt:text('expires_at').notNull(),...actor(),
},t=>[check('live_reconciliation_kind',sql`${t.kind} IN ('employee','partner')`),check('live_reconciliation_disposition',sql`${t.disposition} IN ('success','reversed')`),check('live_bank_amount',sql`typeof(${t.bankAmountCents})='integer' AND ${t.bankAmountCents}>0`)]);
export const paymentLiveReconciliationDecisions=sqliteTable('payment_live_reconciliation_decisions',{
 id:text('id').primaryKey().notNull(),reviewId:text('review_id').notNull().unique().references(()=>paymentLiveReconciliationReviews.id),kind:text('kind').notNull(),reference:text('reference').notNull(),disposition:text('disposition').notNull(),bankReference:text('bank_reference').notNull(),payloadHash:text('payload_hash').notNull(),decision:text('decision').notNull(),...actor(),
},t=>[check('live_reconciliation_decision',sql`${t.decision} IN ('approved','rejected')`),uniqueIndex('payment_live_reconciled_once').on(t.kind,t.reference,t.disposition).where(sql`${t.decision}='approved'`),uniqueIndex('payment_bank_allocation_once').on(t.bankReference).where(sql`${t.decision}='approved'`)]);
export const paymentUnsentReplacements=sqliteTable('payment_unsent_replacements',{
 kind:text('kind').notNull(),reference:text('reference').notNull(),predecessor:text('predecessor').notNull(),createdAt:text('created_at').notNull(),
},t=>[primaryKey({columns:[t.kind,t.reference]}),uniqueIndex('payment_unsent_predecessor').on(t.kind,t.predecessor),check('unsent_replacement_kind',sql`${t.kind} IN ('employee','partner')`)]);
