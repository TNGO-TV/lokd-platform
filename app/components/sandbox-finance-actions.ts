// Frontend field catalogue for the finance owner's actual finance-workflows contract.
export type SandboxField = {
    name: string;
    label: string;
    type?: 'number' | 'textarea' | 'checkbox' | 'rows' | 'object' | 'datetime-local';
    optional?: boolean;
    nullable?: boolean;
    options?: [
        string,
        string
    ][];
    fields?: SandboxField[];
};
export type SandboxAction = {
    action: string;
    title: string;
    group: string;
    participant?: boolean;
    fields: SandboxField[];
};
const text = (name: string, label: string, optional = false): SandboxField => ({ name, label, optional });
const amount = (name = 'amount', label = 'Amount (ZAR cents)'): SandboxField => ({ name, label, type: 'number' });
const reason: SandboxField = { name: 'reason', label: 'Reason and inspected evidence', type: 'textarea' };
const id = text('id', 'New record reference'), order = text('orderId', 'Current order reference');
const sourceRows: SandboxField = { name: 'sources', label: 'Confirmed service sources', type: 'rows', fields: [text('id', 'Canonical timesheet reference')] };
const segments: SandboxField = { name: 'segments', label: 'Every original engagement segment', type: 'rows', fields: [text('id', 'Original liability segment reference'), amount('gross', 'Corrected gross (ZAR cents)')] };
export const sandboxFinanceActions: SandboxAction[] = [
    { action: 'approve_company_recipient', title: 'Prepare company payment recipient authority', group: 'Payments & recovery', fields: [text('companyId', 'Exact company reference'), text('ownerUser', 'Separate company representative user reference'), text('reference', 'Inspected recipient authority source')] },
    { action: 'adopt_exported_payroll', title: 'Adopt an existing exported payroll item', group: 'Payroll & partner corrections', fields: [id, text('itemId', 'Exact exported payroll item reference'), order, text('ownerUser', 'Linked officer user reference')] },
    { action: 'prepare_tax_payout', title: 'Prepare an independently reviewed tax payout', group: 'Payments & recovery', fields: [id, text('liabilityId', 'Tax liability reference'), text('destinationId', 'Reviewed tax destination reference'), amount(), text('replaces', 'Final failed or reversed original operation (optional)', true)] },
    { action: 'cancel_unsubmitted', title: 'Cancel an operation with no submission claim', group: 'Payments & recovery', fields: [text('operationId', 'Original unsubmitted operation reference'), reason] },
    { action: 'void_credit_note', title: 'Void an unused credit note', group: 'Disputes & refunds', fields: [text('creditNoteId', 'Original unused credit reference'), reason] },
    { action: 'open_order', title: 'Create service invoice from booking', group: 'Orders & allocations', fields: [id, text('bookingId', 'Canonical booking reference'), text('clientUser', 'Linked client user reference')] },
    { action: 'prepare_collection', title: 'Prepare full or partial collection', group: 'Orders & allocations', fields: [id, order, amount()] },
    { action: 'allocate_funds', title: 'Allocate cleared funds to a company', group: 'Orders & allocations', fields: [order, text('companyId', 'Employer or company reference'), amount()] },
    { action: 'release_allocation', title: 'Release unused allocation after liability checks', group: 'Orders & allocations', fields: [order, text('companyId', 'Employer or company reference'), amount()] },
    { action: 'approve_destination', title: 'Prepare reviewed payment destination', group: 'Payments & recovery', fields: [id, text('ownerUser', 'Recipient user reference'), text('recipientCode', 'Provider test recipient code'), { name: 'purpose', label: 'Destination purpose (optional)', optional: true, options: [['tax', 'Tax payment']] }, text('companyId', 'Bound company reference (optional)', true)] },
    { action: 'prepare_payout', title: 'Prepare partial or replacement payout', group: 'Payments & recovery', fields: [id, text('liabilityId', 'Unpaid liability reference'), text('destinationId', 'Reviewed destination reference'), amount(), text('replaces', 'Final failed or reversed original operation (optional)', true)] },
    { action: 'recognize_payroll', title: 'Prepare payroll from confirmed service', group: 'Payroll & partner corrections', fields: [id, order, text('ownerUser', 'Linked officer user reference'), sourceRows, text('periodStart', 'Period start in SAST (YYYY-MM-DD, optional)', true), text('periodEnd', 'Period end in SAST (YYYY-MM-DD, optional)', true), text('payDate', 'Pay date in SAST (YYYY-MM-DD, optional)', true)] },
    { action: 'recognize_partner_invoice', title: 'Prepare partner invoice from confirmed service', group: 'Payroll & partner corrections', fields: [id, order, text('ownerUser', 'Linked recipient user reference'), sourceRows, text('periodStart', 'Period start in SAST (YYYY-MM-DD, optional)', true), text('periodEnd', 'Period end in SAST (YYYY-MM-DD, optional)', true), text('payDate', 'Pay date in SAST (YYYY-MM-DD, optional)', true)] },
    { action: 'correct_payroll', title: 'Correct payroll and preserve engagement splits', group: 'Payroll & partner corrections', fields: [text('payrollId', 'Original payroll reference'), segments, reason] },
    { action: 'correct_partner_invoice', title: 'Correct partner invoice and preserve its history', group: 'Payroll & partner corrections', fields: [text('payrollId', 'Original partner invoice reference'), segments, reason] },
    { action: 'recover_overpayment', title: 'Prepare consented overpayment recovery', group: 'Payroll & partner corrections', fields: [id, text('overpaidLiability', 'Overpaid liability reference'), text('newLiability', 'New liability for the same recipient'), amount(), { name: 'consent', label: 'The recipient consented under the bound sandbox recovery policy.', type: 'checkbox' }] },
    { action: 'publish_package', title: 'Publish a versioned training package', group: 'Enrolment & training', fields: [id, text('title', 'Package title'), text('provider', 'Fictional training provider'), amount('price', 'Package price (ZAR cents)'), { name: 'terms', label: 'Exact fictional package terms', type: 'textarea' }, { name: 'active', label: 'Offer this package in the sandbox catalogue', type: 'checkbox' }] },
    { action: 'order_training', title: 'Request a training place', group: 'Enrolment & training', participant: true, fields: [id, text('applicationId', 'Linked application reference'), text('packageId', 'Current training package reference'), { name: 'acceptedTerms', label: 'Exact current package terms accepted', type: 'textarea' }] },
    { action: 'order_enrolment', title: 'Request R350 registered-officer enrolment', group: 'Enrolment & training', participant: true, fields: [id, text('applicationId', 'Linked application reference')] },
    { action: 'issue_entitlement', title: 'Issue entitlement after reconciled payment', group: 'Enrolment & training', fields: [order] },
    { action: 'revoke_entitlement', title: 'Revoke an entitlement', group: 'Enrolment & training', fields: [text('entitlementId', 'Entitlement reference'), reason] },
    { action: 'record_completion', title: 'Record training completion', group: 'Enrolment & training', fields: [id, text('entitlementId', 'Current training entitlement'), text('provider', 'Training provider matching the package'), text('reference', 'Inspected completion evidence reference')] },
    { action: 'cancel_order', title: 'Cancel a reconciled order', group: 'Disputes & refunds', fields: [order, reason] },
    { action: 'issue_credit_note', title: 'Prepare an immutable credit note', group: 'Disputes & refunds', fields: [id, order, amount(), reason, text('replacementOf', 'Previous credit reference (optional)', true)] },
    { action: 'prepare_refund', title: 'Prepare refund against an issued credit', group: 'Disputes & refunds', fields: [id, text('creditNoteId', 'Issued positive credit note'), text('collectionId', 'Original paid collection operation')] },
    { action: 'retry_refund', title: 'Prepare reviewed refund recovery', group: 'Disputes & refunds', fields: [text('operationId', 'Original refund operation'), text('destinationId', 'Reviewed destination for its recipient')] },
    { action: 'open_dispute', title: 'Open a service or chargeback dispute', group: 'Disputes & refunds', fields: [id, order, amount(), text('reference', 'Dispute evidence reference')] },
    { action: 'record_bank_disposition', title: 'Prepare final bank disposition evidence', group: 'Disputes & refunds', fields: [id, text('disputeId', 'Open dispute reference'), { name: 'outcome', label: 'Final bank outcome', options: [['won', 'Dispute won'], ['lost', 'Dispute lost']] }, amount(), text('reference', 'Final bank disposition reference')] },
    { action: 'resolve_dispute', title: 'Resolve dispute from reviewed bank evidence', group: 'Disputes & refunds', fields: [text('disputeId', 'Open dispute reference'), { name: 'outcome', label: 'Reviewed final outcome', options: [['won', 'Dispute won'], ['lost', 'Dispute lost']] }, text('evidenceId', 'Independently reviewed bank disposition')] },
    { action: 'restore_funding', title: 'Prepare a funding top-up invoice', group: 'Disputes & refunds', fields: [id, order, amount()] },
    { action: 'apply_restored_funding', title: 'Apply reconciled replacement funding', group: 'Disputes & refunds', fields: [text('topupId', 'Reconciled funding top-up order')] },
];
