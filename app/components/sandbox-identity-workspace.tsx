'use client';
import {workspaceAutoContract} from '../lib/workspace-response-contracts';
import { useRef, useState, useEffect, useEffectEvent, type FormEvent } from 'react';
import { readWorkspaceResponse, workspaceFailure, workspaceAccessDenied, WorkspaceResponseError } from './workspace-request';
import SandboxCommandRecovery from './sandbox-command-recovery';
import styles from './signup-portal.module.css';
type Envelope = {
    mode: 'simulator';
    policyVersion: string;
    productionIdentityVerified: false;
    productionWorkEligible: false;
    data: Record<string, unknown>;
};
const consentVersion = 'lokd-sandbox-consent-v1';
const scenarios = [['verified', 'Person and records match'], ['declined', 'Verification declined'], ['no_record', 'No matching record'], ['manual_review', 'Independent review needed'], ['pending', 'Pending, then recovered'], ['lost_response', 'Saved provider result; response lost'], ['outage', 'Provider unavailable'], ['wrong_person', 'Wrong-person result rejected'], ['stale', 'Expired result rejected']];
const consent = 'I consent to this isolated simulation using fictional identity records. The server will create synthetic capture and evidence under lokd-sandbox-completion-v1. No real ID, photograph, bank detail or person is submitted. This consent does not authorise real verification or work.';
export default function SandboxIdentityWorkspace({ operations = false, owner = false, applicantId = '', applicantVersion = 1 }: {
    operations?: boolean;
    owner?: boolean;
    applicantId?: string;
    applicantVersion?: number;
}) {
    const [application, setApplication] = useState(applicantId), [version, setVersion] = useState(String(applicantVersion)), [scenario, setScenario] = useState('verified'), [capture, setCapture] = useState(''), [identity, setIdentity] = useState(''), [record, setRecord] = useState<Record<string, unknown> | null>(null), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [captureUncertain, setCaptureUncertain] = useState(false), [epoch, setEpoch] = useState(0), [grant, setGrant] = useState(''), [reviewDraft, setReviewDraft] = useState({ decision: 'approve', reason: '', checked: false }), [reviewSource, setReviewSource] = useState('');
    const lock = useRef(false);
    const accessGeneration=useRef(0),discoveryGeneration=useRef(0);
    const captureBody=useRef<string|null>(null);
    const [sources,setSources]=useState<{applications:{id:string;version:number;details:Record<string,string>}[];captures:Record<string,unknown>[];cases:Record<string,unknown>[];grants:Record<string,unknown>[]} >({applications:[],captures:[],cases:[],grants:[]});
    const [sourcePage,setSourcePage]=useState(0),[moreSources,setMoreSources]=useState(false),[policy,setPolicy]=useState<{consentText:string;consentVersion:string}|null>(null);
    async function discover(offset=0){const access=accessGeneration.current,request=++discoveryGeneration.current;try{
      const results=await Promise.all(['intake&kind=officer','identity'].map(async view=>readWorkspaceResponse<{mode:string;policyVersion:string;productionWorkEligible:boolean;policy:{consentText:string;consentVersion:string};data:Record<string,unknown>}>(await fetch('/api/sandbox/discovery?view='+view+'&offset='+offset,{cache:'no-store'}),workspaceAutoContract("sandbox-identity-workspace.tsx/8b87f391f98a"))));
      if(access!==accessGeneration.current||request!==discoveryGeneration.current)return;
      if(results.some(r=>r.mode!=='simulator'||r.policyVersion!=='lokd-sandbox-completion-v1'||r.productionWorkEligible!==false))throw Error('The source boundary could not be verified.');
      setSources({applications:results[0].data.records as typeof sources.applications,captures:results[1].data.captures as typeof sources.captures,cases:results[1].data.cases as typeof sources.cases,grants:results[1].data.grants as typeof sources.grants});setPolicy(results[1].policy);setSourcePage(offset);setMoreSources(!!results[0].data.hasMore||!!results[1].data.hasMore);setError('');
    }catch(cause){if(access!==accessGeneration.current||request!==discoveryGeneration.current)return;if(workspaceAccessDenied(cause))clear();setError(workspaceFailure(cause,'Saved sources could not be loaded.'));}}
    const initialDiscovery=useEffectEvent(()=>void discover());
    useEffect(()=>{const timer=setTimeout(initialDiscovery,0);return()=>clearTimeout(timer);},[]);

    const originalStart = useRef<Record<string, unknown> | null>(null);
    function clear() { accessGeneration.current++;discoveryGeneration.current++;captureBody.current=null;setSources({applications:[],captures:[],cases:[],grants:[]});setPolicy(null); setGrant(''); setReviewSource(''); setReviewDraft({ decision: 'approve', reason: '', checked: false }); setRecord(null); setCapture(''); setIdentity(''); setApplication(''); setVersion('1'); originalStart.current = null; setCaptureUncertain(false); setEpoch(n => n + 1); }
    async function command(action: string, input: Record<string, unknown>, download = false) {
        if (lock.current)
            return null;
        lock.current = true;
        const access=accessGeneration.current;
        setBusy(true);
        setError('');
        setNotice('');
        try {
            const response = await fetch('/api/sandbox/identity', { method: 'POST', headers: { 'content-type': 'application/json' }, body: action==='capture'?captureBody.current!:JSON.stringify({ action, input }) });
            if(access!==accessGeneration.current)return null;
            if (download && response.ok) {
                if (response.headers.get('x-lokd-evidence-mode') !== 'simulator')
                    throw Error('The private evidence mode could not be verified.');
                const blob = await response.blob();if(access!==accessGeneration.current)return null;const url = URL.createObjectURL(blob), a = document.createElement('a');
                a.href = url;
                a.download = 'private-simulated-identity-evidence.json';
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                setNotice('Private simulated evidence downloaded. The backend records this protected access.');
                return null;
            }
            const result = await readWorkspaceResponse<Envelope>(response,workspaceAutoContract("sandbox-identity-workspace.tsx/47a1436c7090"));
            if(access!==accessGeneration.current)return null;
            if(action==='capture'&&response.status===202){setCaptureUncertain(true);setNotice('The original capture is pending. Recover its original receipt.');return null;}
            if (result.mode !== 'simulator' || result.policyVersion !== 'lokd-sandbox-completion-v1' || result.productionIdentityVerified !== false || result.productionWorkEligible !== false)
                throw Error('The sandbox response policy or production boundary is unexpected.');
            setNotice('Saved under ' + result.policyVersion + '. No production identity or work approval was granted.');
            return result.data ?? {};
        }
        catch (cause) {
            if(access!==accessGeneration.current)return null;
            if (workspaceAccessDenied(cause))
                clear();
            else if (action === 'capture' && (!(cause instanceof WorkspaceResponseError) || cause.status >= 500))
                setCaptureUncertain(true);
            setError(workspaceFailure(cause, 'The result is unconfirmed. Keep the original case reference and refresh its status.'));
            return null;
        }
        finally {
            lock.current = false;
            setBusy(false);
        }
    }
    async function capturePerson(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (captureUncertain)
        return; const input={ applicantId: application, applicantVersion: Number(version), consentVersion:policy?.consentVersion??consentVersion, consented: true, scenario };captureBody.current=JSON.stringify({action:'capture',input,requestKey:crypto.randomUUID()}); const result = await command('capture',input); if (result && typeof result.captureReference === 'string') {
        setCapture(result.captureReference);
        originalStart.current = null;
        setCaptureUncertain(false);
    } }
    async function start() { originalStart.current ??= { applicantId: application, applicantVersion: Number(version), captureReference: capture, consentVersion:policy?.consentVersion??consentVersion }; const result = await command('start', originalStart.current); if (result) {
        setRecord(result);
        if (typeof result.id === 'string')
            setIdentity(result.id);
    } }
    async function read() { if (!identity)
        return; const result = await command('read', { id: identity }); if (result)
        setRecord(result); }
    const source = JSON.stringify({ id: identity, outcomeId: record?.outcomeId });
    const staleReview = !!reviewSource && reviewSource !== source;
    function editReview(value: typeof reviewDraft) { if (!reviewSource)
        setReviewSource(source); setReviewDraft(value); }
    async function review(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (staleReview || !reviewDraft.checked)
        return; const bound = JSON.parse(reviewSource || source); const result = await command('decide', { ...bound, decision: reviewDraft.decision, reason: reviewDraft.reason, independentlyChecked: true }); if (result) {
        setRecord(result);
        setReviewDraft(previous => ({ ...previous, checked: false }));
    } }
    return <section className={styles.shell}><h2>Identity capture and recovery</h2><p className={styles.boundary}>Isolated person-verification simulator · policy lokd-sandbox-completion-v1. Use fictional records only. Production work eligibility remains unchanged.</p>{error && <p role="alert" className={styles.error}>{error}</p>}{notice && <p role="status">{notice}</p>}
 <section className={styles.card}><h3>Choose saved identity sources</h3><button disabled={busy} onClick={()=>void discover(sourcePage)}>Refresh authorised identity sources</button><button disabled={busy||sourcePage===0} onClick={()=>void discover(Math.max(0,sourcePage-50))}>Previous sources</button><button disabled={busy||!moreSources} onClick={()=>void discover(sourcePage+50)}>Next sources</button>
 <label>Saved application<select value={application} disabled={busy||!!capture||captureUncertain} onChange={e=>{const item=sources.applications.find(r=>r.id===e.target.value);setApplication(e.target.value);setVersion(String(item?.version??1));}}><option value="">Choose an authorised application</option>{sources.applications.map(r=><option key={r.id} value={r.id}>{r.details.fullName??r.id} · version {r.version}</option>)}</select></label>
 <label>Saved synthetic capture<select value={capture} disabled={busy||captureUncertain} onChange={e=>{const item=sources.captures.find(r=>r.captureReference===e.target.value);setCapture(e.target.value);if(item){setApplication(String(item.applicantId));setVersion(String(item.applicantVersion));}originalStart.current=null;}}><option value="">Choose an original capture</option>{sources.captures.filter(r=>!application||r.applicantId===application).map(r=><option key={String(r.captureReference)} value={String(r.captureReference)}>{String(r.scenario)} · version {String(r.applicantVersion)} · {r.withdrawn?'withdrawn':String(r.capturedAt)}</option>)}</select></label>
 <label>Saved identity case<select value={identity} disabled={busy} onChange={e=>{setIdentity(e.target.value);setRecord(null);}}><option value="">Choose a case to inspect</option>{sources.cases.map(r=><option key={String(r.id)} value={String(r.id)}>{String(r.applicantId)} · {String(r.outcome)} · version {String(r.applicantVersion)}</option>)}</select></label>
 {owner&&<label>Saved private evidence grant<select value={grant} disabled={busy} onChange={e=>setGrant(e.target.value)}><option value="">Choose a grant</option>{sources.grants.filter(r=>r.caseId===identity).map(r=><option key={String(r.grantId)} value={String(r.grantId)}>{String(r.readerUserId)} · {r.revoked?'revoked':'expires '+String(r.expiresAt)}</option>)}</select></label>}</section>
 {!operations && <form key={'capture-' + epoch} className={styles.form} onSubmit={e => void capturePerson(e)}><fieldset disabled={busy || !!capture || captureUncertain || !policy}><legend>Prepare synthetic capture</legend><label>Linked application reference<input value={application} onChange={e => setApplication(e.target.value)} required maxLength={300}/></label><label>Current application version<input type="number" min={1} step={1} value={version} onChange={e => setVersion(e.target.value)} required/></label><label>Simulation outcome<select value={scenario} onChange={e => setScenario(e.target.value)}>{scenarios.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><p>{policy?.consentText??consent}</p><p>Consent version: {policy?.consentVersion??consentVersion}. Capture expiry and evidence retention are enforced by the server’s sandbox policy.</p><label><input type="checkbox" required/>I have read and accept this versioned synthetic-capture consent.</label><button>Create synthetic capture</button></fieldset></form>}
 {captureUncertain&&<SandboxCommandRecovery scope="capture" getBody={()=>captureBody.current} endpoint="/api/sandbox/identity" onRejected={()=>{captureBody.current=null;setCaptureUncertain(false);setError('The original capture was rejected before any source write. Refresh and inspect the current application before trying corrected details.');}} onDenied={clear} onRecovered={result=>{if(typeof result.captureReference==='string'){setCapture(result.captureReference);setCaptureUncertain(false);setError('');}}}/>}
 {captureUncertain && <p role="alert">The capture response was not confirmed. Do not create a replacement capture until the original request has been recovered. Use the original submission recovery controls below.</p>}
 {capture && <section className={styles.card}><h3>Captured source</h3><p>{capture}</p><button disabled={busy || operations} onClick={() => void start()}>Submit this exact capture</button><button disabled={busy} onClick={() => void command('withdraw_capture', { captureReference: capture }).then(result => { if (result) {
        setCapture('');
        setRecord(null);
        originalStart.current = null;
    } })}>Withdraw this capture consent</button></section>}
 <form className={styles.form} onSubmit={e => { e.preventDefault(); void read(); }}><label>Saved identity case reference<input value={identity} disabled={busy} onChange={e => { setIdentity(e.target.value); setRecord(null); }} required maxLength={300}/></label><button disabled={busy || !identity.trim()}>Refresh original case</button></form>
 {record && <article className={styles.card}><h3>Current identity status</h3><p>{String(record.outcome ?? 'Status not returned').replaceAll('_', ' ')}</p><dl className={styles.details}><div><dt>Case reference</dt><dd>{String(record.id ?? identity)}</dd></div><div><dt>Outcome reference</dt><dd>{String(record.outcomeId ?? 'Pending')}</dd></div><div><dt>Application version</dt><dd>{String(record.applicantVersion ?? 'Not returned')}</dd></div></dl><p>Sandbox identity approval: {record.identityVerified === true ? 'current approved evidence returned' : 'no current approved evidence returned'}. A provider result, an independent identity review and work readiness are separate decisions.</p>{operations ? <button disabled={busy || !!error} onClick={() => void command('recover', { id: identity, expectedOutcomeId: record.outcomeId }).then(result => { if (result)
            setRecord(result); })}>Recover original provider result</button> : <p>Operations recovers an uncertain provider result against this original case and outcome. Keep the case reference and refresh its status here.</p>}
 {operations && <form key={'review-' + epoch} className={styles.form} onSubmit={e => void review(e)}><fieldset disabled={busy || !!error}><legend>Independent identity review</legend><label>Decision<select name="decision" value={reviewDraft.decision} onChange={e => editReview({ ...reviewDraft, decision: e.target.value })}><option value="approve">Approve inspected identity evidence</option><option value="reject">Reject identity evidence</option></select></label><label>Review findings<textarea name="reason" required minLength={3} maxLength={1200} value={reviewDraft.reason} onChange={e => editReview({ ...reviewDraft, reason: e.target.value })}/></label><label><input type="checkbox" required checked={reviewDraft.checked} onChange={e => editReview({ ...reviewDraft, checked: e.target.checked })}/>I independently inspected this exact source and current outcome.</label><button disabled={staleReview}>Record independent review</button></fieldset>{staleReview && <p role="alert">The saved outcome changed. Your findings are retained.<button type="button" onClick={() => { setReviewSource(source); setReviewDraft(previous => ({ ...previous, checked: false })); }}>Review the refreshed identity outcome</button></p>}</form>}
 {operations && <button disabled={busy || !!error} onClick={() => void command('download', { id: identity }, true)}>Download authorised private evidence</button>}
 {operations && owner && <form className={styles.form} onSubmit={e => { e.preventDefault(); void command('grant_evidence', { caseId: identity, readerUserId: new FormData(e.currentTarget).get('reader') }).then(result => { if (result && typeof result.grantId === 'string')
            setGrant(result.grantId); }); }}><fieldset disabled={busy}><legend>Grant a separate evidence reader</legend><label>Designated reviewer user reference<input name="reader" required maxLength={300}/></label><button>Grant private evidence access</button></fieldset></form>}
 {operations && owner && <form className={styles.form} onSubmit={e => { e.preventDefault(); void command('revoke_evidence', { grantId: grant }).then(result => { if (result)
            setGrant(''); }); }}><fieldset disabled={busy}><legend>Revoke private evidence access</legend><label>Exact evidence grant reference<input required value={grant} onChange={e => setGrant(e.target.value)} maxLength={300}/></label><button>Revoke this evidence grant</button></fieldset></form>}
 {operations && <form className={styles.form} onSubmit={e => { e.preventDefault(); void command('suspend', { id: identity, reason: new FormData(e.currentTarget).get('suspensionReason') }).then(result => { if (result)
            void read(); }); }}><fieldset disabled={busy}><legend>Suspend this identity approval</legend><p>A suspension retains the original approval history. Correction requires the separate disposition and replacement-review process.</p><label>Reason for suspension<textarea name="suspensionReason" required minLength={3} maxLength={1200}/></label><button>Suspend the current identity approval</button></fieldset></form>}
 </article>}
 </section>;
}
