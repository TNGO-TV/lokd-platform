'use client';
import { useId, useRef, useState, type FormEvent } from 'react';
import { Fields, parse } from './sandbox-finance-workspace';
import type { SandboxAction } from './sandbox-finance-actions';
import RecordDetails from './record-details';
import { readWorkspaceResponse, workspaceAccessDenied, workspaceFailure } from './workspace-request';
import styles from './signup-portal.module.css';
const definitions: SandboxAction[] = [
    { action: 'grant_company_authority', title: 'Record separate company representative authority', group: 'owner', fields: [{ name: 'employerId', label: 'Current partner company reference' }, { name: 'userId', label: 'Separate representative development user reference' }, { name: 'mandateReference', label: 'Inspected fictional mandate reference' }, { name: 'mandateHash', label: 'Exact mandate SHA-256 digest' }] },
    { action: 'confirm_partner_responsibility', title: 'Confirm company payroll and benefits responsibility', group: 'representative', fields: [{ name: 'authorityId', label: 'Current company authority reference' }, { name: 'engagementId', label: 'Exact partner engagement reference' }, { name: 'expectedVersion', label: 'Current engagement version', type: 'number' }, { name: 'payrollAccepted', label: 'I accept the bound company payroll responsibility.', type: 'checkbox' }, { name: 'benefitsAccepted', label: 'I accept the bound company benefits responsibility.', type: 'checkbox' }, { name: 'payrollReference', label: 'Inspected payroll responsibility source' }, { name: 'payrollHash', label: 'Exact payroll source SHA-256 digest' }, { name: 'benefitsReference', label: 'Inspected benefits responsibility source' }, { name: 'benefitsHash', label: 'Exact benefits source SHA-256 digest' }] },
    { action: 'decide_partner_responsibility', title: 'Independently decide company responsibility', group: 'owner', fields: [{ name: 'responsibilityId', label: 'Exact pending responsibility reference' }, { name: 'decision', label: 'Independent decision', options: [['approve', 'Approve this responsibility'], ['reject', 'Reject this responsibility']] }, { name: 'independentlyChecked', label: 'I independently checked this company authority and exact engagement evidence.', type: 'checkbox' }, { name: 'reason', label: 'Independent findings', type: 'textarea' }] }
];
function PartnerForm({ definition, onAccessLost }: {
    definition: SandboxAction;
    onAccessLost: () => void;
}) {
    const prefix = useId(), lock = useRef(false);
    const [values, setValues] = useState<Record<string, unknown>>({}), [busy, setBusy] = useState(false), [submitted, setSubmitted] = useState(false), [error, setError] = useState(''), [receipt, setReceipt] = useState<Record<string, unknown> | null>(null);
    async function submit(event: FormEvent) {
        event.preventDefault();
        if (lock.current || submitted)
            return;
        let input;
        try {
            input = { action: definition.action, ...parse(definition.fields, values) };
        }
        catch (cause) {
            setError(workspaceFailure(cause, 'Check the required fields.'));
            return;
        }
        lock.current = true;
        setBusy(true);
        setSubmitted(true);
        try {
            const result = await readWorkspaceResponse<{
                mode: string;
                policyVersion: string;
                productionWorkEligible: boolean;
                data: Record<string, unknown>;
            }>(await fetch('/api/sandbox/application', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ service: 'partner_responsibility', input }) }));
            if (result.mode !== 'sandbox' || result.policyVersion !== 'lokd-sandbox-completion-v1' || result.productionWorkEligible !== false)
                throw Error('The sandbox boundary could not be verified.');
            setReceipt(result.data);
            setError('');
        }
        catch (cause) {
            if (workspaceAccessDenied(cause))
                onAccessLost();
            else
                setError(workspaceFailure(cause, 'The outcome is unconfirmed. Inspect the original authority or responsibility record before another submission.'));
        }
        finally {
            lock.current = false;
            setBusy(false);
        }
    }
    return <details><summary>{definition.title}</summary><form className={styles.form} onSubmit={event => void submit(event)}><fieldset disabled={busy || submitted}><legend>Bound company evidence</legend><Fields prefix={prefix} fields={definition.fields} values={values} change={setValues}/><button>Submit exact responsibility evidence</button></fieldset>{error && <p role="alert">{error}</p>}{receipt && <><p role="status">Recorded in the isolated sandbox. Read the returned reference and current decision.</p><RecordDetails json={JSON.stringify(receipt)}/></>}{submitted && <p>This form is locked after submission to avoid duplicating an uncertain outcome. Inspect the saved source before preparing any replacement.</p>}</form></details>;
}
export default function SandboxPartnerWorkspace({ operations = false, owner = false }: {
    operations?: boolean;
    owner?: boolean;
}) { const [denied, setDenied] = useState(false); return <section className={styles.shell}><h2>Partner company responsibility</h2><p>A company representative confirms the exact engagement, payroll and benefits sources. A separate authorised owner decides the confirmation. Creating an engagement does not complete these checks.</p>{denied ? <p role="alert">Private company drafts and receipts were cleared after access was denied. Re-establish access before reopening this journey.</p> : definitions.filter(d => d.group === 'owner' ? operations && owner : !operations).map(definition => <PartnerForm key={definition.action} definition={definition} onAccessLost={() => setDenied(true)}/>)}</section>; }
