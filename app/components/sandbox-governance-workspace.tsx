'use client';
import { useId, useRef, useState, type FormEvent } from 'react';
import { Fields, parse } from './sandbox-finance-workspace';
import type { SandboxField } from './sandbox-finance-actions';
import SandboxCommandRecovery from './sandbox-command-recovery';
import RecordDetails from './record-details';
import { readWorkspaceResponse, WorkspaceResponseError, workspaceAccessDenied, workspaceFailure } from './workspace-request';
import styles from './signup-portal.module.css';
import {SpecialistOperationsControl} from './specialist-operations-control';
type Action = {
    service: string;
    action: string;
    title: string;
    owner?: boolean;
    participant?: boolean;
    both?: boolean;
    keyed?: boolean;
    read?: boolean;
    fields: SandboxField[];
};
const text = (name: string, label: string): SandboxField => ({ name, label });
const review: SandboxField[] = [{ name: 'decision', label: 'Independent decision', options: [['approve', 'Approve exact source'], ['reject', 'Reject exact source']] }, { name: 'independentlyChecked', label: 'I independently inspected the exact current source and its versioned policy.', type: 'checkbox' }, { name: 'reason', label: 'Independent findings', type: 'textarea' }];
const incidentSource: SandboxField[] = [text('incidentId', 'Current incident reference'), {name:'expectedVersion',label:'Inspected current incident version',type:'number'}, {name:'reason',label:'Investigation or disposition findings',type:'textarea'}];
const actions: Action[] = [
    {service:'incident',action:'report',both:true,keyed:true,title:'Report a fictional assignment incident',fields:[text('shiftId','My assigned shift reference'),{name:'severity',label:'Incident severity',options:[['low','Low'],['medium','Medium'],['high','High'],['critical','Critical']]},text('category','Incident category'),text('summary','Incident summary'),{name:'detail',label:'Fictional incident details',type:'textarea'}]},
    ...(['acknowledge','investigate','escalate','resolve','close'] as const).map(action => ({service:'incident',action,keyed:true,owner:action==='resolve'||action==='close',title:({acknowledge:'Acknowledge and take ownership of an incident',investigate:'Record an incident investigation',escalate:'Escalate an overdue unresolved incident',resolve:'Independently resolve an incident',close:'Independently close a resolved incident'})[action],fields:incidentSource})),
    { service: 'training', action: 'import_finance', participant: true, title: 'Link my paid and independently reviewed training completion', fields: [text('workspace', 'Authorised finance workspace'), text('applicationId', 'My current reviewed application reference'), text('financeEntitlementId', 'My current paid finance entitlement reference'), text('completionId', 'My independently approved completion reference')] },
    { service: 'training', action: 'assess', title: 'Assess a current training entitlement', fields: [text('entitlementId', 'Current training entitlement reference'), text('assessmentReference', 'Inspected versioned assessment reference'), { name: 'scorePercent', label: 'Inspected assessment score (0–100 percent)', type: 'number' }, { name: 'evidenceInspected', label: 'I inspected the actual fictional assessment evidence.', type: 'checkbox' }, text('officerReviewId', 'Current independent officer review reference'), text('ruleId', 'Current approved training readiness rule')] },
    { service: 'training', action: 'revoke', owner: true, title: 'Revoke a training entitlement source', fields: [text('entitlementId', 'Exact entitlement to revoke'), { name: 'reason', label: 'Revocation findings', type: 'textarea' }] },
    { service: 'engagement', action: 'prepare_transition', title: 'Prepare a change of employer or workforce model', fields: [text('engagementId', 'Current active engagement reference'), { name: 'expectedVersion', label: 'Current engagement version', type: 'number' }, text('nextEngagementId', 'Separate next engagement reference'), text('employerId', 'Next reviewed employer reference'), { name: 'model', label: 'Next workforce model', options: [['direct_flex', 'Direct flex'], ['managed', 'Managed employment'], ['partner', 'Partner company']] }, text('termsVersion', 'Exact new terms version'), text('reference', 'Inspected transition source reference')] },
    { service: 'engagement', action: 'decide_transition', owner: true, title: 'Independently decide an engagement transition', fields: [text('transitionId', 'Pending transition reference'), ...review] },
    { service: 'engagement', action: 'period_inputs', read: true, title: 'Inspect immutable engagement splits for a service period', fields: [text('officerId', 'Officer reference'), text('periodStart', 'First service date (YYYY-MM-DD, SAST)'), text('periodEnd', 'Last service date (YYYY-MM-DD, SAST)')] },
    { service: 'specialist', action: 'prepare_authority', title: 'Prepare simulated specialist authority', fields: [{ name: 'code', label: 'Specialist authority requirement', options: [['S1_ARMED_SERVICE_AUTHORITY', 'Armed service authority'], ['S2_VIP_SERVICE_AUTHORITY', 'VIP service authority'], ['S3_SPECIALIST_INSURANCE', 'Specialist insurance'], ['S4_SPECIALIST_BOARD_APPROVAL', 'Specialist board approval']] }, text('reference', 'Fictional authority source (sandbox: reference)')] },
    { service: 'specialist', action: 'decide_authority', owner: true, title: 'Independently decide specialist authority', fields: [text('authorityId', 'Pending specialist authority reference'), ...review] },
    { service: 'specialist', action: 'read', read: true, title: 'Inspect current specialist readiness and packs', fields: [] }
];
function GovernanceForm({ definition, onDenied }: {
    definition: Action;
    onDenied: () => void;
}) {
    const prefix = useId(), lock = useRef(false), original = useRef<string | null>(null);
    const [values, setValues] = useState<Record<string, unknown>>({}), [busy, setBusy] = useState(false), [frozen, setFrozen] = useState(false), [error, setError] = useState(''), [receipt, setReceipt] = useState<Record<string, unknown> | null>(null);
    async function submit(e: FormEvent) {
        e.preventDefault();
        if (lock.current || (frozen && !definition.keyed))
            return;
        let input;
        try {
            input = { action: definition.action, ...parse(definition.fields, values), ...(definition.keyed ? {requestKey: crypto.randomUUID()} : {}) };
            if (!original.current) original.current = JSON.stringify({service:definition.service,input,...(definition.action==='import_finance'?{requestKey:crypto.randomUUID()}: {})});
        }
        catch (cause) {
            setError(workspaceFailure(cause, 'Check the required source fields.'));
            return;
        }
        lock.current = true;
        setBusy(true);
        setError('');
        try {
            const result = await readWorkspaceResponse<{
                mode: string;
                policyVersion: string;
                productionWorkEligible: boolean;
                data: Record<string, unknown>|null;
            }>(await fetch('/api/sandbox/application', { method: 'POST', headers: { 'content-type': 'application/json' }, body: original.current! }));
            if (result.mode !== 'sandbox' || result.policyVersion !== 'lokd-sandbox-completion-v1' || result.productionWorkEligible !== false)
                throw Error('The guarded sandbox policy could not be verified.');
            if(!result.data){setFrozen(true);setError('The original command is pending. Recover its original receipt.');return;}
            setReceipt(result.data);
            if (definition.read) original.current = null;
            setFrozen(!definition.read);
        }
        catch (cause) {
            if (workspaceAccessDenied(cause))
                onDenied();
            else {
                const uncertain = !(cause instanceof WorkspaceResponseError) || cause.status >= 500;
                setFrozen(!definition.read && uncertain);
                if (!uncertain) original.current = null;
                setError(workspaceFailure(cause, 'The outcome is unconfirmed. Inspect the original saved source before another request.'));
            }
        }
        finally {
            lock.current = false;
            setBusy(false);
        }
    }
    return <details><summary>{definition.title}</summary><form className={styles.form} onSubmit={e => void submit(e)}><fieldset disabled={busy || frozen}><legend>Exact source and version</legend><Fields prefix={prefix} fields={definition.fields} values={values} change={setValues}/><button>{busy ? 'Checking saved sources…' : definition.read ? 'Read authorised current sources' : 'Record this reviewed sandbox action'}</button></fieldset>{error && <p role="alert">{error}</p>}{frozen&&!receipt&&definition.action==='import_finance'&&<SandboxCommandRecovery scope="import_finance" endpoint="/api/sandbox/application" getBody={()=>original.current} onRejected={()=>{original.current=null;setFrozen(false);setError('The original import was rejected before any source write. Correct the inspected source references before submitting again.');}} onDenied={onDenied} onRecovered={setReceipt}/>}{frozen && definition.keyed && !receipt && <button type="button" disabled={busy} onClick={e=>void submit(e)}>Retry this original incident request</button>}{receipt && <><p role="status">Server result under lokd-sandbox-completion-v1. Employment eligibility and live activation remain separate.</p><RecordDetails json={JSON.stringify(receipt)}/></>}{frozen && <p>This submitted draft is retained. Inspect the original result before preparing a replacement; an incident retry keeps the exact original request key and body.</p>}</form></details>;
}
export default function SandboxGovernanceWorkspace({ owner = false, operations = false }: {
    owner?: boolean;
    operations?: boolean;
}) {
    const [denied, setDenied] = useState(false), [specialistOpen,setSpecialistOpen] = useState(false);
    const visible = actions.filter(a => (a.both || (a.participant ? !operations : operations)) && (!a.owner || owner));
    return <section className={styles.shell}><h2>{operations ? 'Training, engagement changes and specialist authority' : 'Training readiness and incident reporting'}</h2><p className={styles.boundary}>Versioned fictional policy only. A current paid finance entitlement and independently reviewed completion must be linked by their applicant before a separate assessment. Payment, assessment, independent readiness approval and opting in remain separate; none alone permits work.</p>{operations && <p>Engagement changes preserve historical service inputs and require new terms and disposition.</p>}{denied ? <p role="alert">Private sources and drafts were cleared after access was denied. Re-establish authorised access before reopening this journey.</p> : visible.map(definition => <GovernanceForm key={definition.service + '-' + definition.action} definition={definition} onDenied={() => setDenied(true)}/>)}{operations&&!denied&&(specialistOpen?<SpecialistOperationsControl sandbox/>:<button onClick={()=>setSpecialistOpen(true)}>Open current specialist packs, partners and terms</button>)}</section>;
}
