'use client';
import {matchesWorkspaceCommand} from '../lib/workspace-command-receipt';
import {sandboxServiceResponse} from '../lib/workspace-response-contracts';
import { useCallback, useRef, useState } from 'react';
import ProductionScheduleControls, { type ScheduleState } from './production-schedule-controls';
import ProductionServiceControls, { type ServiceState } from './production-service-controls';
import ProductionOrderControls, { type OrderState } from './production-order-controls';
import { readWorkspaceResponse, workspaceAccessDenied, workspaceFailure } from './workspace-request';
import ProductionEvidenceControls, { type EvidenceState } from './production-evidence-controls';
import ClientReviewControls, { type ClientReviewState } from './client-review-controls';
import RecordDetails from './record-details';
import styles from './signup-portal.module.css';
export type SandboxSchedule=ScheduleState;
// These fields come from the separately validated Operations response below;
// they are not part of the service/orders handler responses themselves.
export type SandboxService=Omit<ServiceState,'owner'>;
export type SandboxOrders=Omit<OrderState,'reviewClients'>;
type OperationalState = EvidenceState & ClientReviewState & {
    rosters: {
        id: string;
        version: number;
        status: string;
        starts_at: string;
        booking_id: string;
    }[];
    approvals: {
        id: string;
        state: string;
        request_json: string;
    }[];
    shifts: {
        id: string;
        status: string;
    }[];
};
type State = {
    schedule?: ScheduleState;
    service?: ServiceState;
    orders?: OrderState;
    operations?: OperationalState;
    result?: Record<string, unknown>;
};
type Envelope<T> = {
    mode: 'sandbox';
    policyVersion: string;
    productionWorkEligible: false;
    data: T;
};
function ScanControl({ shiftId, disabled, send }: {
    shiftId: string;
    disabled: boolean;
    send: (service: string, input: Record<string, unknown>) => Promise<void>;
}) {
    const original = useRef<Record<string, unknown> | null>(null);
    const [saved, setSaved] = useState(false);
    return <form className={styles.form} onSubmit={e => { e.preventDefault(); if (disabled)
        return; const f = new FormData(e.currentTarget); original.current ??= { requestKey: crypto.randomUUID(), shiftId, passportToken: f.get('passportToken'), scenario: f.get('scenario'), consent: f.get('consent') === 'on' }; setSaved(true); void send('scan', original.current); }}><fieldset disabled={disabled || saved}><legend>Private passport and fictional scan</legend><p>Only the recipient’s private passport token is submitted to the guarded scan route. No device location is requested.</p><label>My current private passport token<input name="passportToken" type="password" autoComplete="off" required maxLength={700}/></label><label>Fictional scan scenario<select name="scenario"><option value="at_site">At the approved site</option><option value="outside_geofence">Outside the permitted area</option><option value="stale_clock">Observation too old</option><option value="future_clock">Clock in the future</option><option value="gps_unavailable">Location unavailable</option><option value="wrong_passport">Wrong passport rejected</option></select></label><label><input name="consent" type="checkbox" required/>I consent to this fictional device observation for my isolated assignment.</label></fieldset><button disabled={disabled}>{saved ? 'Retry original sandbox scan' : 'Check in with this fictional scan'}</button>{saved && <button type="button" disabled={disabled} onClick={e => { original.current = null; setSaved(false); e.currentTarget.form?.reset(); }}>Start a separate inspected scan</button>}</form>;
}
export default function SandboxServiceWorkspace({ kind, operations = false }: {
    kind: 'client' | 'officer';
    operations?: boolean;
}) {
    const [data, setData] = useState<State>({}), [error, setError] = useState(''), [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [epoch, setEpoch] = useState(0), [uncertain, setUncertain] = useState(false), [notice, setNotice] = useState('');
    const lock = useRef(false), generation = useRef(0);
    const clear = useCallback(() => { generation.current++; setData({}); setEpoch(n => n + 1); setUncertain(false); setNotice(''); }, []);
    const call = useCallback(async <T,>(service: string, input: Record<string, unknown>): Promise<T> => {
        try {
            const result = await readWorkspaceResponse<Envelope<T>>(await fetch('/api/sandbox/application', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ service, input }) }),value=>sandboxServiceResponse(value,service));
            if(!service.endsWith('_read')&&!await matchesWorkspaceCommand(result,'sandbox-application',{service,input}))throw Error('The isolated command is unconfirmed. Refresh its original record before retrying.');
            if (result.mode !== 'sandbox' || result.policyVersion !== 'lokd-sandbox-completion-v1' || result.productionWorkEligible !== false)
                throw Error('The isolated sandbox boundary could not be verified.');
            return result.data;
        }
        catch (cause) {
            if (workspaceAccessDenied(cause))
                clear();
            throw cause;
        }
    }, [clear]);
    async function load() {
        if (lock.current)
            return;
        lock.current = true;
        setLoading(true);
        const token = ++generation.current;
        setError('');
        try {
            const [schedule, service, orders, operational] = await Promise.all([kind === 'officer' || operations ? call<ScheduleState>('schedule_read', {}) : undefined, call<SandboxService>('service_read', {}), call<SandboxOrders>('orders_read', {}), call<OperationalState>('operations_read', {})]);
            if (token === generation.current)
                setData(previous => ({ ...previous, schedule, service: {...service,owner:operational.owner}, orders: {...orders,reviewClients:operational.reviewClients}, operations: operational }));
        }
        catch (cause) {
            if (token === generation.current || workspaceAccessDenied(cause))
                setError(workspaceFailure(cause, 'Sandbox service records could not be loaded. Your drafts are retained unless access was denied.'));
        }
        finally {
            lock.current = false;
            setLoading(false);
        }
    }
    async function execute(service: string, input: Record<string, unknown>) {
        if (lock.current || uncertain || loading || !!error || !data.service)
            return false;
        lock.current = true;
        setBusy(true);
        setError('');
        const token = generation.current;
        try {
            const result = await call<Record<string, unknown>>(service, input);
            if (token !== generation.current)
                return false;
            if (service === 'operations' && input.action === 'evaluate')
                setData(previous => ({ ...previous, result }));
            else if (service === 'orders' && input.action === 'quote_order')
                setData(previous => ({ ...previous, orders: previous.orders ? { ...previous.orders, result } : undefined }));
            else {
                setData(previous => ({ ...previous, result }));
                setUncertain(true);
                setNotice(service === 'scan' && result.ready === false ? 'Scan not accepted: ' + String(result.reason ?? 'readiness checks failed').replaceAll('_', ' ') + '. Inspect the original result before another scan.' : 'Request recorded. Refresh and inspect the saved version before another action.');
            }
            return true;
        }
        catch (cause) {
            if (!workspaceAccessDenied(cause))
                setUncertain(true);
            setError(workspaceFailure(cause, 'The outcome is unconfirmed. Inspect the original record before another action.'));
            return false;
        }
        finally {
            lock.current = false;
            setBusy(false);
        }
    }
    async function send(service:string,input:Record<string,unknown>):Promise<void>{await execute(service,input);}
    const disabled = loading || busy || !!error || uncertain;
    return <section className={styles.shell}><h2>Availability, orders and service evidence</h2><p className={styles.boundary}>These controls use the actual application services inside the isolated sandbox database. Every person, site and service record here must be fictional. Production dispatch remains locked.</p><button disabled={loading || busy} onClick={() => void load()}>Load or refresh sandbox service records</button>{loading && <p role="status">Loading authorised sandbox service records…</p>}{error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}{data.result && <RecordDetails json={JSON.stringify(data.result)}/>}{uncertain && <p>Check the saved source and its history after refreshing. <button disabled={loading || busy || !!error} onClick={() => { setUncertain(false); setNotice(''); }}>I inspected the original outcome; enable a separate action</button></p>}
 <div key={epoch}>{data.operations && <section><h3>Scheduled sandbox service</h3>{!data.operations.rosters.length && <p>No authorised roster records returned.</p>}{data.operations.rosters.map(r => <article className={styles.card} key={r.id}><p>{new Date(r.starts_at).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })} SAST · {r.status.replaceAll('_', ' ')}</p><p>Roster {r.id} · version {r.version} · booking {r.booking_id}</p></article>)}{data.operations.shifts.map(shift => <article key={shift.id}><h4>Assignment {shift.id}</h4><p>{shift.status.replaceAll('_', ' ')}</p>{!operations && kind === 'officer' && shift.status === 'confirmed' && <ScanControl shiftId={shift.id} disabled={disabled} send={send}/>} {!operations && kind === 'officer' && shift.status === 'on_post' && <form className={styles.form} onSubmit={e => { e.preventDefault(); void send('operations', { action: 'complete_service', shiftId: shift.id, note: new FormData(e.currentTarget).get('note') }); }}><label>Completed service and incident findings<textarea name="note" required minLength={3} maxLength={1200}/></label><button disabled={disabled}>Record checkout for this sandbox assignment</button></form>}</article>)}
 {operations && <><h3>Inspect readiness for an isolated assignment</h3><form className={styles.form} onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget), submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement; void send('operations', { action: submitter.value, rosterSlotId: form.get('rosterSlotId'), officerId: form.get('officerId'), slotVersion: Number(form.get('slotVersion')), activationKey: form.get('activationKey') }); }}><label>Sandbox roster reference<input name="rosterSlotId" required/></label><label>Operational officer reference<input name="officerId" required/></label><label>Current roster version<input name="slotVersion" type="number" min={1} required/></label><label>Unique sandbox activation reference<input name="activationKey" required/></label><button value="evaluate" disabled={disabled}>Evaluate sandbox assignment readiness</button><button value="prepare_activation" disabled={disabled}>Prepare isolated assignment for independent review</button></form><h3>Saved activation reviews</h3>{data.operations.approvals.map(review => <article key={review.id}><h4>{review.id} · {review.state}</h4><RecordDetails json={review.request_json}/><p>Inspect the exact saved sources before a separate controller activates this isolated assignment.</p><button disabled={disabled || !['prepared', 'approving'].includes(review.state)} onClick={() => void send('operations', { action: 'approve_activation', activationKey: review.id })}>Independently approve this sandbox activation</button></article>)}<ProductionEvidenceControls data={data.operations} busy={disabled} sandbox send={input => execute('evidence', input)}/><ClientReviewControls data={data.operations} busy={disabled} send={input => execute('operations', input)}/></>}
 </section>}{data.schedule && <ProductionScheduleControls data={data.schedule} operations={operations} busy={disabled} send={input => send('schedule', input)}/>} {data.orders && <ProductionOrderControls data={data.orders} operations={operations} busy={disabled} send={input => send('orders', input)}/>} {data.service && <ProductionServiceControls data={data.service} kind={kind} operations={operations} busy={disabled} send={input => execute('service', input)}/>}</div>
 </section>;
}
