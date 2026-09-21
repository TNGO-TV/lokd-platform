// Central Command: merge these declarations into db/schema.ts, then regenerate metadata.
import {sqliteTable,text,integer,check} from 'drizzle-orm/sqlite-core';
import {sql} from 'drizzle-orm';
import {employeePaymentInstructions,employeeTransferObservations,partnerPaymentInstructions,partnerTransferObservations} from '../../db/schema';

export const employeeRecoveryProposals=sqliteTable('employee_recovery_proposals',{
 id:text('id').primaryKey().notNull(),reference:text('reference').notNull().references(()=>employeePaymentInstructions.reference),
 instructionVersion:integer('instruction_version').notNull(),evidenceId:text('evidence_id').notNull().references(()=>employeeTransferObservations.id),
 disposition:text('disposition').notNull(),sourceHash:text('source_hash').notNull(),
 operatorId:text('operator_id').notNull(),userId:text('user_id').notNull(),note:text('note').notNull(),authMethod:text('auth_method').notNull(),createdAt:text('created_at').notNull(),
},t=>[check('employee_recovery_disposition',sql`${t.disposition} IN ('failed','reversed')`)]);
export const employeeRecoveryApprovals=sqliteTable('employee_recovery_approvals',{
 id:text('id').primaryKey().notNull(),proposalId:text('proposal_id').notNull().unique().references(()=>employeeRecoveryProposals.id),
 operatorId:text('operator_id').notNull(),userId:text('user_id').notNull(),note:text('note').notNull(),authMethod:text('auth_method').notNull(),createdAt:text('created_at').notNull(),
});
export const employeeRecoveryReplacements=sqliteTable('employee_recovery_replacements',{
 reference:text('reference').primaryKey().notNull(),predecessor:text('predecessor').notNull().unique().references(()=>employeePaymentInstructions.reference),
 approvalId:text('approval_id').notNull().unique().references(()=>employeeRecoveryApprovals.id),createdAt:text('created_at').notNull(),
});

export const partnerRecoveryProposals=sqliteTable('partner_recovery_proposals',{
 id:text('id').primaryKey().notNull(),reference:text('reference').notNull().references(()=>partnerPaymentInstructions.reference),
 instructionVersion:integer('instruction_version').notNull(),evidenceId:text('evidence_id').notNull().references(()=>partnerTransferObservations.id),
 disposition:text('disposition').notNull(),sourceHash:text('source_hash').notNull(),
 operatorId:text('operator_id').notNull(),userId:text('user_id').notNull(),note:text('note').notNull(),authMethod:text('auth_method').notNull(),createdAt:text('created_at').notNull(),
},t=>[check('partner_recovery_disposition',sql`${t.disposition} IN ('failed','reversed')`)]);
export const partnerRecoveryApprovals=sqliteTable('partner_recovery_approvals',{
 id:text('id').primaryKey().notNull(),proposalId:text('proposal_id').notNull().unique().references(()=>partnerRecoveryProposals.id),
 operatorId:text('operator_id').notNull(),userId:text('user_id').notNull(),note:text('note').notNull(),authMethod:text('auth_method').notNull(),createdAt:text('created_at').notNull(),
});
export const partnerRecoveryReplacements=sqliteTable('partner_recovery_replacements',{
 reference:text('reference').primaryKey().notNull(),predecessor:text('predecessor').notNull().unique().references(()=>partnerPaymentInstructions.reference),
 approvalId:text('approval_id').notNull().unique().references(()=>partnerRecoveryApprovals.id),createdAt:text('created_at').notNull(),
});
