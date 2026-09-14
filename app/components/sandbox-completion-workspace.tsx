'use client';
import SandboxIdentityWorkspace from './sandbox-identity-workspace';
import SandboxFinanceWorkspace from './sandbox-finance-workspace';
import SandboxServiceWorkspace from './sandbox-service-workspace';
import SandboxPartnerWorkspace from './sandbox-partner-workspace';
import SandboxPresenceWorkspace from './sandbox-presence-workspace';
import styles from './sandbox-workspace.module.css';
import SandboxGovernanceWorkspace from './sandbox-governance-workspace';
import SandboxIntakeWorkspace from './sandbox-intake-workspace';
import SandboxReviewWorkspace from './sandbox-review-workspace';
import WorkspaceSections from './workspace-sections';
export default function SandboxCompletionWorkspace({ kind = 'officer', operations = false, owner = false, applicantId = '', applicantVersion = 1 }: {
    kind?: 'client' | 'officer';
    operations?: boolean;
    owner?: boolean;
    applicantId?: string;
    applicantVersion?: number;
}) {
    const items = [{id:'sandbox-review',label:'Saved records & corrections'},...(!operations ? [{ id: 'sandbox-intake', label: 'Fictional intake' }] : []), ...((kind === 'officer' || operations) ? [{ id: 'sandbox-identity', label: 'Identity & consent' }] : []), { id: 'sandbox-service', label: 'Availability & service' }, ...((operations || kind === 'officer') ? [{ id: 'sandbox-governance', label: operations ? 'Training & workforce review' : 'Training readiness' }] : []), { id: 'sandbox-partner', label: 'Company responsibility' }, { id: 'sandbox-finance', label: 'Finance & training' }, ...(!operations && kind === 'officer' ? [{ id: 'sandbox-presence', label: 'Presence consent' }] : [])];
    return <main className={styles.workspace}><h1>Controlled sandbox workflows</h1><p>Fictional records only. Each section identifies its saved source, policy and current result. Sandbox receipts do not establish live provider compatibility or permission to work.</p><WorkspaceSections items={items} label="Sandbox workflow sections"/>{!operations && <section id="sandbox-intake"><SandboxIntakeWorkspace kind={kind}/></section>}{(kind === 'officer' || operations) && <section id="sandbox-identity"><SandboxIdentityWorkspace operations={operations} owner={owner} applicantId={applicantId} applicantVersion={applicantVersion}/></section>}<section id="sandbox-review"><SandboxReviewWorkspace kind={kind} operations={operations} owner={owner}/></section><section id="sandbox-service"><SandboxServiceWorkspace kind={kind} operations={operations}/></section>{(operations || kind === 'officer') && <section id="sandbox-governance"><SandboxGovernanceWorkspace owner={owner} operations={operations}/></section>}<section id="sandbox-partner"><SandboxPartnerWorkspace operations={operations} owner={owner}/></section><section id="sandbox-finance"><SandboxFinanceWorkspace kind={kind} operations={operations} owner={owner}/></section>{!operations && kind === 'officer' && <section id="sandbox-presence"><SandboxPresenceWorkspace /></section>}</main>;
}
