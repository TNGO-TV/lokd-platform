import {sql} from 'drizzle-orm';
import {sqliteTable,text,integer,check,uniqueIndex,type AnySQLiteColumn} from 'drizzle-orm/sqlite-core';
import {operatorAccounts} from '../../db/schema';
// Central must also add uniqueIndex('finance_document_invoice_booking_once').on(table.bookingId).where(sql`environment='production' AND document_type='invoice'`) to clientInvoices.
export const financeDocumentVersions=sqliteTable('finance_document_versions',{
 id:text('id').primaryKey().notNull(),
 kind:text('kind').notNull(),
 sourceId:text('source_id').notNull(),
 partyId:text('party_id').notNull(),
 recipientUser:text('recipient_user').notNull(),
 requestKey:text('request_key').notNull(),
 parentId:text('parent_id').references(():AnySQLiteColumn=>financeDocumentVersions.id),
 version:integer('version').notNull(),
 sourceJson:text('source_json').notNull(),
 financialJson:text('financial_json').notNull(),
 payloadHash:text('payload_hash').notNull(),
 amountCents:integer('amount_cents').notNull(),
 note:text('note').notNull(),
 operatorId:text('operator_id').notNull().references(():AnySQLiteColumn=>operatorAccounts.id),
 userId:text('user_id').notNull(),
 authContext:text('auth_context').notNull(),
 createdAt:text('created_at').notNull(),
},(t)=>[uniqueIndex('finance_document_successor').on(t.parentId).where(sql`parent_id IS NOT NULL`),uniqueIndex('finance_document_root').on(t.kind,t.sourceId).where(sql`parent_id IS NULL`),uniqueIndex('finance_document_versions_request_key_idx').on(t.requestKey),check('finance_document_versions_check_0',sql`kind IN('payslip','invoice','remittance')`),check('finance_document_versions_check_1',sql`version>=1`),check('finance_document_versions_check_2',sql`json_valid(source_json)`),check('finance_document_versions_check_3',sql`json_valid(financial_json)`),check('finance_document_versions_check_4',sql`length(payload_hash)=64`),check('finance_document_versions_check_5',sql`typeof(amount_cents)='integer' AND amount_cents>=0`),check('finance_document_versions_check_6',sql`length(trim(note))>=3`),check('finance_document_versions_check_7',sql`auth_context IN('mfa_verified','owner_mfa_exception')`)]);
export const financeDocumentDecisions=sqliteTable('finance_document_decisions',{
 id:text('id').primaryKey().notNull(),
 documentId:text('document_id').notNull().references(():AnySQLiteColumn=>financeDocumentVersions.id),
 decision:text('decision').notNull(),
 payloadHash:text('payload_hash').notNull(),
 operatorId:text('operator_id').notNull().references(():AnySQLiteColumn=>operatorAccounts.id),
 userId:text('user_id').notNull(),
 note:text('note').notNull(),
 authContext:text('auth_context').notNull(),
 createdAt:text('created_at').notNull(),
},(t)=>[uniqueIndex('finance_document_decisions_document_id_idx').on(t.documentId),check('finance_document_decisions_check_0',sql`decision IN('approved','rejected')`),check('finance_document_decisions_check_1',sql`length(trim(note))>=3`),check('finance_document_decisions_check_2',sql`auth_context IN('mfa_verified','owner_mfa_exception')`)]);
export const financeDocumentIssues=sqliteTable('finance_document_issues',{
 documentId:text('document_id').primaryKey().notNull().references(():AnySQLiteColumn=>financeDocumentVersions.id),
 number:text('number').notNull(),
 issuedAt:text('issued_at').notNull(),
},(t)=>[uniqueIndex('finance_document_issues_number_idx').on(t.number)]);
