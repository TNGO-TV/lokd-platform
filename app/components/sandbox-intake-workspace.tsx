'use client';
import { useRef, useState } from 'react';
import { OfficerApplicationJourney } from '../join/page';
import ClientEnquiryForm from './client-enquiry-form';
import { readWorkspaceResponse, workspaceAccessDenied, workspaceFailure } from './workspace-request';
import styles from './signup-portal.module.css';
export default function SandboxIntakeWorkspace({ kind }: {
    kind: 'client' | 'officer';
}) {
    const [reference, setReference] = useState(''), [busy, setBusy] = useState(false), [linked, setLinked] = useState(false), [denied, setDenied] = useState(false), [error, setError] = useState('');
    const lock = useRef(false);
    function clear() { setDenied(true); setReference(''); setLinked(false); setError(''); }
    async function link() { if (lock.current || !reference || linked)
        return; lock.current = true; setBusy(true); try {
        const result = await readWorkspaceResponse<{
            mode: string;
            policyVersion: string;
            productionWorkEligible: boolean;
        }>(await fetch('/api/sandbox/application', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ service: 'intake', input: { kind, id: reference, action: 'link', expectedVersion: 0 } }) }));
        if (result.mode !== 'sandbox' || result.policyVersion !== 'lokd-sandbox-completion-v1' || result.productionWorkEligible !== false)
            throw Error('The isolated account-link boundary could not be confirmed.');
        setLinked(true);
        setError('');
    }
    catch (cause) {
        if (workspaceAccessDenied(cause))
            clear();
        else
            setError(workspaceFailure(cause, 'The original account link could not be confirmed. Inspect this same source before another request.'));
    }
    finally {
        lock.current = false;
        setBusy(false);
    } }
    return <section className={styles.shell}><h2>Start a fictional {kind === 'client' ? 'client enquiry' : 'officer application'}</h2><p className={styles.boundary}>Use the email of your designated synthetic sign-in account and fictional details only. This form uses the existing intake validation inside the separate sandbox database. Its acknowledgements apply to this rehearsal; no real onboarding contact is sent.</p>{denied ? <p role="alert">Sandbox access was denied. Intake drafts and references were cleared. Sign in again before reopening this form.</p> : <><details><summary>Complete the fictional {kind === 'client' ? 'client' : 'officer'} intake form</summary>{kind === 'officer' ? <OfficerApplicationJourney sandbox onSubmitted={setReference} onAccessLost={clear}/> : <ClientEnquiryForm sandbox onSubmitted={setReference} onAccessLost={clear}/>}</details>{reference && <section><p>Saved fictional source: <code>{reference}</code></p><button disabled={busy || linked} onClick={() => void link()}>{linked ? 'Fictional source linked' : 'Link this source to my synthetic account'}</button>{linked && <p role="status">The source was linked from version 0 to version 1. This does not grant identity, financial or work approval. {kind === 'officer' && <a href={'/officer/sandbox?applicantId=' + encodeURIComponent(reference) + '&applicantVersion=1#sandbox-identity'}>Continue with this application’s synthetic identity capture</a>}</p>}{error && <p role="alert">{error}</p>}</section>}</>}</section>;
}
