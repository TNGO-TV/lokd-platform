'use client';
import {FINANCE_SANDBOX_POLICY} from '../lib/finance-sandbox-policy';
import { useCallback, useEffect, useRef, useState, useId, type FormEvent } from 'react';
import { sandboxFinanceActions, type SandboxField, type SandboxAction } from './sandbox-finance-actions';
import RecordDetails from './record-details';
import { readWorkspaceResponse, WorkspaceResponseError, workspaceAccessDenied, workspaceFailure } from './workspace-request';
import styles from './signup-portal.module.css';
type Values = Record<string, unknown>;
type FinanceRecord = {
    id: string;
    kind: string;
    version: number;
    policy_version: string;
    data: Values;
    financialState: string;
};
type Command = {
    id: string;
    digest: string;
    input_json: string;
    plan_json: string;
    decision?: string | null;
    maker_user_id?: string;
    policy_version?: string;
};
type Capabilities = {
    member: {
        userId: string;
        role: string;
        version: number;
        limitCents: number;
    };
    canPrepare: boolean;
    canReview: boolean;
    canOrder: boolean;
    canBootstrap: boolean;
};
type WorkspaceChoice = {
    id: string;
    role: string;
    version: number;
    limit_cents: number;
};
type Data = {
    environment: 'sandbox';
    records: FinanceRecord[];
    balances: {
        account: string;
        balance: number;
    }[];
    nextAfter: number | null;
    commands?: Command[];
    member?: {
        role: string;
    };
    policyVersion?: string;
};
const format = (cents: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(cents / 100);
export function Fields({ fields, values, change, locked = false, prefix = '' }: {
    fields: SandboxField[];
    values: Values;
    change: (values: Values) => void;
    locked?: boolean;
    prefix?: string;
}) {
    return <>{fields.map(field => {
            const key = prefix + field.name, value = values[field.name];
            if (field.type === 'object')
                return <fieldset key={key}><legend>{field.label}</legend><Fields fields={field.fields ?? []} values={(value ?? {}) as Values} change={next => change({ ...values, [field.name]: next })} locked={locked} prefix={key + '-'}/></fieldset>;
            if (field.type === 'rows') {
                const rows = (value ?? [{}]) as Values[];
                return <fieldset key={key}><legend>{field.label}</legend>{rows.map((row, index) => <fieldset key={index}><legend>{field.label} {index + 1}</legend><Fields fields={field.fields ?? []} values={row} change={next => change({ ...values, [field.name]: rows.map((r, i) => i === index ? next : r) })} locked={locked} prefix={key + '-' + index + '-'}/><button type="button" disabled={locked || rows.length === 1} onClick={() => change({ ...values, [field.name]: rows.filter((_, i) => i !== index) })}>Remove {field.label.toLowerCase()} {index + 1}</button></fieldset>)}<button type="button" disabled={locked || rows.length >= 100} onClick={() => change({ ...values, [field.name]: [...rows, {}] })}>Add {field.label.toLowerCase()}</button></fieldset>;
            }
            if (field.type === 'checkbox')
                return <label key={key} htmlFor={key}><input id={key} type="checkbox" checked={value === true} disabled={locked} onChange={e => change({ ...values, [field.name]: e.target.checked })}/>{field.label}</label>;
            return <div key={key}><label htmlFor={key}>{field.label}</label>{field.options ? <select id={key} disabled={locked} value={String(value ?? '')} required={!field.optional} onChange={e => change({ ...values, [field.name]: e.target.value })}><option value="">Choose…</option>{field.options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select> : field.type === 'textarea' ? <textarea id={key} value={String(value ?? '')} readOnly={locked} required={!field.optional} minLength={3} maxLength={2000} onChange={e => change({ ...values, [field.name]: e.target.value })}/> : <input id={key} value={String(value ?? '')} readOnly={locked} required={!field.optional} type={field.type === 'number' ? 'number' : field.type === 'datetime-local' ? 'datetime-local' : 'text'} min={field.type === 'number' ? 0 : undefined} step={field.type === 'number' ? 1 : undefined} maxLength={300} onChange={e => change({ ...values, [field.name]: e.target.value })}/>}</div>;
        })}</>;
}
export function parse(fields: SandboxField[], values: Values): Values { const result: Values = {}; for (const field of fields) {
    const value = values[field.name];
    if (field.nullable && (value === undefined || value === '')) {
        result[field.name] = null;
        continue;
    }
    if (field.optional && (value === undefined || value === ''))
        continue;
    if (field.type === 'number') {
        const n = Number(value);
        if (!Number.isSafeInteger(n) || n < 0)
            throw Error('Enter nonnegative whole ZAR cents.');
        result[field.name] = n;
    }
    else if (field.type === 'rows')
        result[field.name] = (Array.isArray(value) ? value : [{}]).map(row => parse(field.fields ?? [], row));
    else if (field.type === 'object')
        result[field.name] = parse(field.fields ?? [], (value ?? {}) as Values);
    else if (field.type === 'datetime-local')
        result[field.name] = new Date(String(value)).toISOString();
    else if (field.type === 'checkbox')
        result[field.name] = value === true;
    else
        result[field.name] = String(value ?? '');
} return result; }
function FinanceForm({ definition, source, disabled, send, direct = false, extra = {} }: {
    definition: SandboxAction;
    source: string;
    disabled: boolean;
    send: (body: Values) => Promise<Values>;
    direct?: boolean;
    extra?: Values;
}) {
    const formId = useId();
    const [values, setValues] = useState<Values>({}), [bound, setBound] = useState<string | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [receipt, setReceipt] = useState<Values | null>(null), [reviewed, setReviewed] = useState(false), [original, setOriginal] = useState<Values | null>(null);
    const lock = useRef(false), possiblySent = useRef(false);
    const stale = bound !== null && source !== bound;
    useEffect(() => { if (bound === null || receipt)
        return; const warn = (event: BeforeUnloadEvent) => event.preventDefault(); window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [bound, receipt]);
    async function submit(e: FormEvent) {
        e.preventDefault();
        if (lock.current || disabled || stale || !reviewed)
            return;
        let body: Values;
        try {
            const input = { action: definition.action, ...parse(definition.fields, values), ...extra };
            body = original ?? (direct ? input : { action: 'prepare', requestKey: crypto.randomUUID(), policyVersion: FINANCE_SANDBOX_POLICY.version, command: input });
        }
        catch (cause) {
            setError(workspaceFailure(cause, 'Check the required fields.'));
            return;
        }
        lock.current = true;
        setBusy(true);
        setError('');
        setOriginal(body);
        try {
            setReceipt(await send(body));
            possiblySent.current = true;
        }
        catch (cause) {
            if (!(cause instanceof WorkspaceResponseError && [400, 401, 403, 413, 423].includes(cause.status)))
                possiblySent.current = true;
            if (!possiblySent.current)
                setOriginal(null);
            setError(workspaceFailure(cause, 'The outcome is unconfirmed. Refresh the original command before another request.'));
        }
        finally {
            lock.current = false;
            setBusy(false);
        }
    }
    const edit = (next: Values) => { if (bound === null)
        setBound(source); setValues(next); };
    return <details><summary>{definition.title}</summary><form className={styles.form} onSubmit={e => void submit(e)}><fieldset disabled={disabled || busy || !!receipt}><legend>Exact request details</legend><Fields fields={definition.fields} values={values} change={edit} locked={!!original} prefix={formId + '-' + definition.action + '-'}/><label><input type="checkbox" checked={reviewed} onChange={e => { if (bound === null)
        setBound(source); setReviewed(e.target.checked); }} required/>I reviewed the current sources, exact amounts and versioned sandbox policy.</label><button disabled={stale}>{busy ? 'Saving…' : original ? 'Retry original request' : direct ? 'Record reviewed decision' : 'Prepare for independent review'}</button></fieldset>{stale && <p role="alert">The source records changed. Your draft is retained.<button type="button" disabled={disabled || busy} onClick={() => { setBound(source); setReviewed(false); }}>Review refreshed sources</button></p>}{original && <p>Original request reference: <code>{String(original.requestKey ?? extra.commandId ?? definition.action)}</code>. Retrying preserves the exact submitted facts.</p>}{error && <p role="alert">{error}</p>}{receipt && <><p role="status">Request recorded. Inspect the current server state; a receipt does not prove payment or cancel a liability.</p><RecordDetails json={JSON.stringify(receipt)}/><button type="button" disabled={busy || disabled} onClick={() => { setOriginal(null); setReceipt(null); setError(''); possiblySent.current = false; setBound(null); setReviewed(false); setValues({}); }}>Start a separate reviewed request</button></>}</form></details>;
}
function DocumentDownload({ record, authorize }: {
    record: FinanceRecord;
    authorize: () => Promise<void>;
}) {
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    const lock = useRef(false);
    async function save() {
        if (lock.current)
            return;
        lock.current = true;
        setBusy(true);
        setError('');
        try {
            await authorize();
            const doc = document.implementation.createHTMLDocument('Fictional sandbox document');
            const policy = doc.createElement('meta');
            policy.httpEquiv = 'Content-Security-Policy';
            policy.content = "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'";
            doc.head.appendChild(policy);
            const style = doc.createElement('style');
            style.textContent = 'body{font:16px/1.5 system-ui;max-width:64rem;margin:2rem auto;padding:1rem;color:#173c32}pre{white-space:pre-wrap;overflow-wrap:anywhere}h1{font-size:1.6rem}';
            doc.head.appendChild(style);
            for (const [tag, text] of [['h1', 'Fictional sandbox document'], ['p', 'This isolated record is not a legal invoice or proof of real payment.'], ['p', record.id + ' · version ' + record.version + ' · policy ' + record.policy_version], ['h2', 'Exact issued record and historical facts'], ['pre', JSON.stringify(record.data, null, 2)], ['h2', 'Current financial state at this access'], ['p', record.financialState + ' — provider success alone does not establish reconciled payment.']]) {
                const element = doc.createElement(tag);
                element.textContent = text;
                doc.body.appendChild(element);
            }
            const url = URL.createObjectURL(new Blob(['<!doctype html>' + doc.documentElement.outerHTML], { type: 'text/html' })), link = document.createElement('a');
            link.href = url;
            link.download = 'sandbox-' + record.id.replace(/[^a-zA-Z0-9_-]/g, '_') + '-v' + record.version + '.html';
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
        catch (cause) {
            setError(workspaceFailure(cause, 'Private document access could not be confirmed. Refresh its saved state.'));
        }
        finally {
            lock.current = false;
            setBusy(false);
        }
    }
    return <><button disabled={busy} onClick={() => void save()}>{busy ? 'Checking private document access…' : 'Download private document (printable HTML)'}</button>{error && <p role="alert">{error}</p>}</>;
}
type TrainingPackage = {
    id: string;
    version: number;
    policyVersion: string;
    title: string;
    provider: string;
    price: number;
    terms: string;
};
function TrainingRequest({ source, disabled, send, read }: {
    source: string;
    disabled: boolean;
    send: (body: Values) => Promise<Values>;
    read: (query: string) => Promise<Values>;
}) {
    const [packages, setPackages] = useState<TrainingPackage[]>([]), [selected, setSelected] = useState(''), [loading, setLoading] = useState(false), [error, setError] = useState(''), [loaded, setLoaded] = useState(false);
    const lock = useRef(false);
    const chosen = packages.find(p => p.id === selected);
    async function load() { if (lock.current)
        return; lock.current = true; setLoading(true); try {
        const result = await read('&catalogue=training');
        if (!Array.isArray(result.packages))
            throw Error('The current training catalogue was not returned.');
        setPackages(result.packages as TrainingPackage[]);
        setLoaded(true);
        setError('');
    }
    catch (cause) {
        setError(workspaceFailure(cause, 'The training catalogue could not be loaded. Your request draft is retained while access remains valid.'));
    }
    finally {
        lock.current = false;
        setLoading(false);
    } }
    return <section><h3>Choose a current training package</h3><button disabled={disabled || loading} onClick={() => void load()}>Load or refresh training catalogue</button>{loading && <p role="status">Loading current package prices and exact terms…</p>}{error && <p role="alert">{error}</p>}{loaded && !packages.length && <p>No active training packages were returned.</p>}{!!packages.length && <><label>Current training package<select value={selected} disabled={disabled || loading} onChange={e => setSelected(e.target.value)}><option value="">Choose a current package</option>{packages.map(p => <option key={p.id} value={p.id}>{p.title} · {format(p.price)} · version {p.version}</option>)}</select></label>{chosen && <><p>{chosen.provider} · {format(chosen.price)} · policy {chosen.policyVersion}</p><h4>Exact package terms</h4><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{chosen.terms}</pre><p>Preparing this request binds the exact displayed terms. It does not issue a qualification or confirm payment.</p></>}</>}
 <FinanceForm definition={{ action: 'order_training', title: 'Request this reviewed training place', group: 'Enrolment & training', fields: [{ name: 'id', label: 'New training order reference' }, { name: 'applicationId', label: 'Linked application reference' }] }} extra={{ packageId: chosen?.id ?? '', acceptedTerms: chosen?.terms ?? '' }} source={source + JSON.stringify(chosen ?? null)} disabled={disabled || loading || !!error || !chosen} send={send}/></section>;
}
function EnrolmentReadiness({ disabled, read }: {
    disabled: boolean;
    read: (query: string) => Promise<Values>;
}) {
    const [application, setApplication] = useState(''), [data, setData] = useState<Values | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const lock = useRef(false);
    async function inspect(e: FormEvent) { e.preventDefault(); if (lock.current)
        return; lock.current = true; setBusy(true); try {
        const result = await read('&applicationId=' + encodeURIComponent(application));
        if (result.applicationId !== application || result.workEligible !== false)
            throw Error('The bound enrolment response could not be verified.');
        setData(result);
        setError('');
    }
    catch (cause) {
        setError(workspaceFailure(cause, 'Current enrolment and training status could not be confirmed.'));
    }
    finally {
        lock.current = false;
        setBusy(false);
    } }
    return <section><h3>Current enrolment and training entitlement</h3><form className={styles.form} onSubmit={e => void inspect(e)}><label>My linked application reference<input required value={application} disabled={busy} onChange={e => { setApplication(e.target.value); setData(null); }}/></label><button disabled={disabled || busy}>Check current enrolment and training</button></form>{error && <p role="alert">{error}</p>}{data && <><p>R350 enrolment: {data.enrolmentPaid === true ? 'Reconciled current entitlement' : 'No usable paid entitlement returned'}. This does not grant permission to work.</p><RecordDetails json={JSON.stringify(data)}/></>}</section>;
}
function SavedCommandInspector({ read, disabled }: {
    read: (query: string) => Promise<Values>;
    disabled: boolean;
}) {
    const [id, setId] = useState(''), [command, setCommand] = useState<Values | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const lock = useRef(false);
    async function inspect(e: FormEvent) { e.preventDefault(); if (lock.current)
        return; lock.current = true; setBusy(true); try {
        const result = await read('&commandId=' + encodeURIComponent(id));
        if (!result.command || typeof result.command !== 'object')
            throw Error('The original command was not returned.');
        setCommand(result.command as Values);
        setError('');
    }
    catch (cause) {
        setError(workspaceFailure(cause, 'Original command access could not be confirmed.'));
    }
    finally {
        lock.current = false;
        setBusy(false);
    } }
    return <section><h3>Inspect an original command or decision</h3><form className={styles.form} onSubmit={e => void inspect(e)}><label>Saved command reference<input value={id} disabled={busy} required onChange={e => { setId(e.target.value); setCommand(null); }}/></label><button disabled={disabled || busy}>Read original command and decision</button></form>{error && <p role="alert">{error}</p>}{command && <><p>Maker: {String(command.maker_user_id)} · reviewer: {String(command.reviewer_user_id ?? 'Awaiting decision')} · decision: {String(command.decision ?? 'Pending')}</p><p>{String(command.findings ?? '')}</p><RecordDetails json={String(command.input_json)}/><RecordDetails json={String(command.plan_json)}/><p>Digest: <code>{String(command.digest)}</code></p></>}</section>;
}
function RecordHistory({ record, read, disabled }: {
    record: FinanceRecord;
    read: (query: string) => Promise<Values>;
    disabled: boolean;
}) {
    const [rows, setRows] = useState<FinanceRecord[]>([]), [cursor, setCursor] = useState<number | null>(null), [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const lock = useRef(false);
    async function load(after?: number) { if (lock.current)
        return; lock.current = true; setBusy(true); try {
        const result = await read('&id=' + encodeURIComponent(record.id) + (after ? '&after=' + after : ''));
        if (!Array.isArray(result.records) || result.records.some(row => row.id !== record.id))
            throw Error('Bound document history was not returned.');
        setRows(previous => after ? [...previous, ...result.records as FinanceRecord[]].filter((r, i, all) => all.findIndex(x => x.id === r.id && x.version === r.version) === i) : result.records as FinanceRecord[]);
        setCursor(typeof result.nextAfter === 'number' ? result.nextAfter : null);
        setLoaded(true);
        setError('');
    }
    catch (cause) {
        setError(workspaceFailure(cause, 'Private immutable history could not be refreshed.'));
    }
    finally {
        setBusy(false);
        lock.current = false;
    } }
    return <details><summary>Retained versions and issued facts</summary><button disabled={busy || disabled} onClick={() => void load()}>Read private history for {record.id}</button>{error && <p role="alert">{error}</p>}{loaded && !rows.length && <p>No retained versions returned.</p>}{rows.map(row => <section key={row.version}><h5>Version {row.version} · policy {row.policy_version}</h5><RecordDetails json={JSON.stringify(row.data)}/></section>)}{cursor !== null && <button disabled={busy || disabled} onClick={() => void load(cursor)}>Load more versions of {record.id}</button>}</details>;
}
function OperationEvidence({ id, read, disabled }: {
    id: string;
    read: (query: string) => Promise<Values>;
    disabled: boolean;
}) {
    const [data, setData] = useState<Values | null>(null), [cursor, setCursor] = useState<number | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const lock = useRef(false);
    async function load(after?: number) { if (lock.current)
        return; lock.current = true; setBusy(true); try {
        const result = await read('&operationId=' + encodeURIComponent(id) + (after ? '&afterEvidence=' + after : ''));
        if (!result.operation || typeof result.operation !== 'object' || (result.operation as Values).id !== id || !Array.isArray(result.evidence) || !Array.isArray(result.claims))
            throw Error('The bound operation evidence was not returned.');
        setData(previous => after && previous ? { ...result, evidence: [...previous.evidence as Values[], ...result.evidence as Values[]].filter((r, i, all) => all.findIndex(x => x.sequence === r.sequence) === i) } : result);
        setCursor(typeof result.nextEvidenceAfter === 'number' ? result.nextEvidenceAfter : null);
        setError('');
    }
    catch (cause) {
        setError(workspaceFailure(cause, 'Original provider and bank evidence could not be read.'));
    }
    finally {
        setBusy(false);
        lock.current = false;
    } }
    return <details><summary>Original submission claims and financial evidence</summary><p>Reconciliation requires the matching API observation, signed event and independent bank record. An individual successful observation does not prove payment.</p><button disabled={busy || disabled} onClick={() => void load()}>Read private evidence for {id}</button>{error && <p role="alert">{error}</p>}{data && <><h5>Original submission claims</h5><RecordDetails json={JSON.stringify(data.claims)}/><h5>Authoritative saved observations</h5>{(data.evidence as Values[]).map(evidence => <article key={String(evidence.sequence)}><p>{String(evidence.source)} · {String(evidence.created_at ?? '')} · observation {String(evidence.sequence)}</p><RecordDetails json={String(evidence.body_json)}/></article>)}{!(data.evidence as Values[]).length && <p>No provider or bank observations were returned.</p>}</>}{cursor !== null && <button disabled={busy || disabled} onClick={() => void load(cursor)}>Load more financial evidence for {id}</button>}</details>;
}
export default function SandboxFinanceWorkspace({ operations = false, owner = false, kind = 'officer' }: {
    operations?: boolean;
    owner?: boolean;
    kind?: 'client' | 'officer';
}) {
    const [workspace, setWorkspace] = useState(''), [opened, setOpened] = useState(''), [data, setData] = useState<Data | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [epoch, setEpoch] = useState(0), [group, setGroup] = useState('Orders & allocations'), [notice, setNotice] = useState(''), [attemptedIds, setAttemptedIds] = useState<string[]>([]), [scenarios, setScenarios] = useState<Record<string, string>>({}), [capabilities, setCapabilities] = useState<Capabilities | null>(null), [workspaceChoices, setWorkspaceChoices] = useState<WorkspaceChoice[]>([]), [queueCursor, setQueueCursor] = useState<string | null>(null);
    const generation = useRef(0), lock = useRef(false), attempted = useRef(new Set<string>());
    useEffect(() => { const sync = () => setGroup(new URLSearchParams(location.search).get('financeSection') || 'Orders & allocations'); const timer = setTimeout(sync, 0); window.addEventListener('popstate', sync); return () => { clearTimeout(timer); window.removeEventListener('popstate', sync); }; }, []);
    function selectGroup(name: string) { setGroup(name); const url = new URL(location.href); url.searchParams.set('financeSection', name); history.pushState(null, '', url); }
    const endpoint = '/api/finance-workflows?workspace=' + encodeURIComponent(opened);
    const clear = useCallback(() => { generation.current++; setLoading(false); setData(null); setEpoch(n => n + 1); attempted.current.clear(); setAttemptedIds([]); setScenarios({}); setNotice(''); setCapabilities(null); setWorkspaceChoices([]); setQueueCursor(null); }, []);
    const openedRef = useRef(opened);
    useEffect(() => { openedRef.current = opened; }, [opened]);
    useEffect(() => { const sync = () => { const candidate = new URLSearchParams(location.search).get('workspace') ?? '', next = /^sbx-[a-z0-9-]{3,80}$/.test(candidate) ? candidate : ''; if (next === openedRef.current)
        return; if (openedRef.current && !window.confirm('Open a different sandbox workspace? Private drafts in this workspace will be cleared.')) {
        const url = new URL(location.href);
        url.searchParams.set('workspace', openedRef.current);
        history.pushState(null, '', url);
        return;
    } clear(); setWorkspace(next); setOpened(next); }; const timer = setTimeout(sync, 0); window.addEventListener('popstate', sync); return () => { clearTimeout(timer); window.removeEventListener('popstate', sync); }; }, [clear]);
    const invalidate = useCallback(() => { generation.current++; }, []);
    const load = useCallback(async (after?: number) => { if (!opened)
        return; const token = ++generation.current; setLoading(true); try {
        const [result, authority] = await Promise.all([fetch(endpoint + '&current=true' + (after ? '&after=' + after : ''), { cache: 'no-store' }).then(response => readWorkspaceResponse<Data>(response)), fetch(endpoint + '&capabilities', { cache: 'no-store' }).then(response => readWorkspaceResponse<Capabilities>(response))]);
        if (result.environment !== 'sandbox' || !Array.isArray(result.records) || !Array.isArray(result.balances))
            throw Error('The authorised sandbox response is incomplete.');
        if (token === generation.current) {
            setCapabilities(authority.member ? authority : null);
            setData(old => after && old ? { ...result, records: [...old.records, ...result.records].filter((r, i, rows) => rows.findIndex(x => x.id === r.id && x.version === r.version) === i) } : result);
            setError('');
        }
    }
    catch (cause) {
        if (token === generation.current) {
            if (workspaceAccessDenied(cause))
                clear();
            setError(workspaceFailure(cause, 'Private sandbox records could not be loaded.'));
        }
    }
    finally {
        if (token === generation.current || !data)
            setLoading(false);
    } }, [opened, endpoint, clear, data]);
    // Avoid refetching merely because a successfully loaded data object changed.
    const loadRef = useRef(load);
    useEffect(() => { loadRef.current = load; }, [load]);
    useEffect(() => { const timer = setTimeout(() => void loadRef.current(), 0); return () => { clearTimeout(timer); invalidate(); }; }, [opened, invalidate]);
    async function send(body: Values) { if (lock.current)
        throw Error('Another request is pending.'); lock.current = true; setBusy(true); try {
        const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
        const receipt = await readWorkspaceResponse<Values>(response);
        await load();
        return receipt;
    }
    catch (cause) {
        if (workspaceAccessDenied(cause))
            clear();
        throw cause;
    }
    finally {
        lock.current = false;
        setBusy(false);
    } }
    async function operation(action: 'dispatch' | 'recover', id: string) { if (action === 'dispatch' && attempted.current.has(id))
        return; if (action === 'dispatch') {
        attempted.current.add(id);
        setAttemptedIds(ids => [...ids, id]);
    } setNotice(''); try {
        const receipt = await send({ action, operationId: id, scenario: scenarios[id] ?? 'success' });
        setNotice('Original operation updated. Review its authoritative provider and bank evidence. Reference: ' + String(receipt.operationId ?? id));
    }
    catch (cause) {
        setError(workspaceFailure(cause, 'The operation outcome is unconfirmed. Recover the original reference.'));
    } }
    async function discover() { if (lock.current)
        return; lock.current = true; setLoading(true); try {
        const result = await readWorkspaceResponse<{
            environment: string;
            workspaces: WorkspaceChoice[];
        }>(await fetch('/api/finance-workflows?workspaces', { cache: 'no-store' }));
        if (result.environment !== 'sandbox' || !Array.isArray(result.workspaces))
            throw Error('Authorised workspace discovery was not returned.');
        setWorkspaceChoices(result.workspaces);
        setError('');
    }
    catch (cause) {
        if (workspaceAccessDenied(cause))
            clear();
        setError(workspaceFailure(cause, 'Workspace discovery could not be loaded.'));
    }
    finally {
        setLoading(false);
        lock.current = false;
    } }
    async function loadQueue(after?: string) { try {
        const result = await readPrivate('&commands' + (after ? '&afterCommand=' + encodeURIComponent(after) : ''));
        if (!Array.isArray(result.commands))
            throw Error('The authorised queue was not returned.');
        setData(previous => previous ? { ...previous, commands: after ? [...(previous.commands ?? []), ...result.commands as Command[]].filter((c, i, rows) => rows.findIndex(x => x.id === c.id) === i) : result.commands as Command[] } : previous);
        setQueueCursor(typeof result.nextCommandAfter === 'string' ? result.nextCommandAfter : null);
        setError('');
    }
    catch (cause) {
        setError(workspaceFailure(cause, 'The command queue could not be refreshed.'));
    } }
    async function readPrivate(query: string) { try {
        const result = await readWorkspaceResponse<Values>(await fetch(endpoint + query, { cache: 'no-store' }));
        if (result.environment !== 'sandbox')
            throw Error('The sandbox environment could not be verified.');
        return result;
    }
    catch (cause) {
        if (workspaceAccessDenied(cause))
            clear();
        throw cause;
    } }
    async function authorizeDocument(record: FinanceRecord) { try {
        const result = await readWorkspaceResponse<Data>(await fetch(endpoint + '&id=' + encodeURIComponent(record.id), { cache: 'no-store' }));
        if (result.environment !== 'sandbox' || !result.records?.some(row => row.id === record.id && row.version === record.version && row.financialState === record.financialState && JSON.stringify(row.data) === JSON.stringify(record.data)))
            throw Error('Document access or its current state changed. Refresh and inspect the original document before downloading.');
    }
    catch (cause) {
        if (workspaceAccessDenied(cause))
            clear();
        throw cause;
    } }
    const current = [...new Map(data?.records.map(r => [r.id, r]) ?? []).values()];
    const source = JSON.stringify(data?.records ?? []);
    const actions = sandboxFinanceActions.filter(a => operations ? capabilities?.canPrepare !== false && !a.participant : kind === 'officer' && capabilities?.canOrder !== false && a.participant);
    const groups = [...new Set(actions.map(a => a.group))];
    return <section className={styles.shell}><h2>Sandbox service, payroll and training</h2><p className={styles.boundary}>Fictional policy {FINANCE_SANDBOX_POLICY.version} · ZAR · SAST. Transactions use the isolated application ledger. Buying enrolment or training does not grant permission to work.</p><button disabled={busy || loading} onClick={() => void discover()}>Find my authorised finance workspaces</button>{!!workspaceChoices.length && <label>My finance workspaces<select value={workspace} onChange={e => setWorkspace(e.target.value)}><option value="">Choose a workspace</option>{workspaceChoices.map(w => <option key={w.id} value={w.id}>{w.id} · {w.role} · {format(w.limit_cents)} limit</option>)}</select></label>}<form className={styles.form} onSubmit={e => { e.preventDefault(); if (opened && opened !== workspace && !window.confirm('Switch sandbox workspace? Unsaved private drafts will be cleared.'))
        return; if (opened === workspace) {
        void load();
        return;
    } clear(); setOpened(workspace); const url = new URL(location.href); url.searchParams.set('workspace', workspace); history.replaceState(null, '', url); }}><label>Authorised sandbox workspace<input required value={workspace} onChange={e => setWorkspace(e.target.value)} pattern="sbx-[a-z0-9-]{3,80}"/></label><button disabled={busy}>Open sandbox workspace</button></form>{opened && <button disabled={loading || busy} onClick={() => void load()}>Refresh sandbox records</button>}{loading && <p role="status">Loading private sandbox records…</p>}{error && <p role="alert" className={styles.error}>{error}</p>}{notice && <p role="status">{notice}</p>}
 {owner && <FinanceForm key={'setup-' + epoch} definition={{ action: 'create_workspace', title: 'Create an isolated finance workspace', group: 'Setup', fields: [{ name: 'id', label: 'New sandbox workspace reference' }, { name: 'members', label: 'Designated synthetic members', type: 'rows', fields: [{ name: 'userId', label: 'Development user reference' }, { name: 'role', label: 'Independent workspace role', options: [['preparer', 'Preparer'], ['reviewer', 'Separate reviewer'], ['client', 'Client'], ['officer', 'Officer'], ['trainer', 'Trainer']] }, { name: 'limit', label: 'Amount limit (ZAR cents)', type: 'number' }] }] }} source={source} disabled={busy || loading} send={send} direct/>}
 {data && <div key={opened + '-' + epoch}>{capabilities && <p>Your current finance role: <strong>{capabilities.member.role}</strong> · authority version {capabilities.member.version} · limit {format(capabilities.member.limitCents)}. Every action is checked again by the server.</p>}<nav className={styles.tabs} aria-label="Sandbox finance sections">{groups.map(name => <button key={name} aria-pressed={(groups.includes(group) ? group : groups[0]) === name} onClick={() => selectGroup(name)}>{name}</button>)}</nav>{actions.map(definition => <div key={definition.action} hidden={definition.group !== (groups.includes(group) ? group : groups[0])}>{definition.action === 'order_training' ? <TrainingRequest source={source} disabled={loading || busy || !!error} send={send} read={readPrivate}/> : <FinanceForm definition={definition} source={source} disabled={loading || busy || !!error} send={send}/>}</div>)}
 {!operations && kind === 'officer' && <EnrolmentReadiness disabled={loading || busy || !!error} read={readPrivate}/>}
 {operations && <SavedCommandInspector read={readPrivate} disabled={loading || busy || !!error}/>}
 {operations && <section><h3>Independent command decisions</h3><button disabled={busy || loading} onClick={() => void loadQueue()}>Refresh authorised review queue</button>{queueCursor && <button disabled={busy || loading} onClick={() => void loadQueue(queueCursor)}>Load next pending commands</button>}<p>Inspect the exact server-stored command and current source evidence. The proposer cannot approve their own command.</p>{data.commands?.filter(c => !c.decision).map(command => <article className={styles.card} key={command.id}><h4>{command.id}</h4><p>Proposed by {command.maker_user_id ?? 'Not returned'} · policy {command.policy_version ?? 'Not returned'} · digest <code>{command.digest}</code></p><h5>Exact submitted request</h5><RecordDetails json={command.input_json}/><h5>Proposed entries and source versions</h5><RecordDetails json={command.plan_json}/>{capabilities?.canReview !== false && <FinanceForm definition={{ action: 'decide', title: 'Decide this exact command', group: 'Review', fields: [{ name: 'decision', label: 'Decision', options: [['approved', 'Approve and apply exact command'], ['rejected', 'Reject command']] }, { name: 'findings', label: 'Independent review findings', type: 'textarea' }] }} extra={{ commandId: command.id, digest: command.digest }} source={source} disabled={loading || busy || !!error} send={send} direct/>}</article>)}{data.commands === undefined ? <p>The server did not return an authorised review queue. Independent decisions need the stored command, digest and source evidence before they can be shown.</p> : !data.commands.some(c => !c.decision) && <p>No pending command decisions were returned for this account.</p>}</section>}
 <section><h3>Current records and immutable history</h3>{!current.length && <p>No private records returned in this workspace.</p>}{current.map(record => <article key={record.id} className={styles.card}><h4>{record.kind.replaceAll('_', ' ')} · {record.id}</h4><p>Current version {record.version} · current financial state: <strong>{record.financialState}</strong></p><RecordDetails json={JSON.stringify(record.data)}/>{record.kind === 'document' && <DocumentDownload record={record} authorize={() => authorizeDocument(record)}/>}<RecordHistory record={record} read={readPrivate} disabled={busy || loading}/>{operations && record.kind === 'operation' && <><OperationEvidence id={record.id} read={readPrivate} disabled={busy || loading}/><label>Provider scenario for {record.id}<select value={scenarios[record.id] ?? 'success'} disabled={busy || loading || attemptedIds.includes(record.id)} onChange={e => setScenarios(previous => ({ ...previous, [record.id]: e.target.value }))}>{[['success', 'Successful provider observation'], ['failed', 'Final failure'], ['reversed', 'Final reversal'], ['pending', 'Still pending'], ['needs_attention', 'Recipient attention needed'], ['timeout', 'Original submission response lost']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button disabled={busy || loading || !!error || attemptedIds.includes(record.id) || record.data.state !== 'authorized'} onClick={() => void operation('dispatch', record.id)}>Submit this sandbox operation once</button><button disabled={busy || loading || !!error} onClick={() => void operation('recover', record.id)}>Recover original operation</button><FinanceForm definition={{ action: 'bank_evidence', title: 'Record independent bank evidence', group: 'Payments', fields: [{ name: 'eventId', label: 'Unique bank evidence reference' }, { name: 'evidence', label: 'Exact bank evidence', type: 'object', fields: [{ name: 'reference', label: 'Original operation reference' }, { name: 'amount', label: 'Bank amount (ZAR cents)', type: 'number' }, { name: 'currency', label: 'Currency', options: [['ZAR', 'South African rand']] }, { name: 'status', label: 'Authoritative bank outcome', options: [['pending', 'Pending'], ['success', 'Successful'], ['failed', 'Failed'], ['reversed', 'Reversed'], ['needs_attention', 'Recipient attention required']] }, { name: 'final', label: 'The inspected bank result is final.', type: 'checkbox' }, { name: 'observedAt', label: 'Evidence observed at (device local time)', type: 'datetime-local' }, { name: 'recipient', label: 'Bound provider recipient (blank only when absent)', optional: true, nullable: true }, { name: 'providerId', label: 'Original provider transaction identifier' }, { name: 'attempt', label: 'Exact operation attempt', type: 'number' }, { name: 'mode', label: 'Evidence environment', options: [['simulator', 'Deterministic simulator']] }] }] }} extra={{ operationId: record.id }} source={source} disabled={busy || loading || !!error} send={send} direct/><FinanceForm definition={{ action: 'reconcile_operation', title: 'Prepare independent financial reconciliation', group: 'Payments', fields: [] }} extra={{ operationId: record.id }} source={source} disabled={busy || loading || !!error} send={send}/></>}</article>)}</section>
 {data.nextAfter !== null && <button disabled={busy || loading} onClick={() => void load(data.nextAfter!)}>Load more private history</button>}{operations && <details><summary>Current account balances</summary><dl className={styles.details}>{data.balances.map(row => <div key={row.account}><dt>{row.account}</dt><dd>{format(row.balance)}</dd></div>)}</dl></details>}</div>}
 </section>;
}
