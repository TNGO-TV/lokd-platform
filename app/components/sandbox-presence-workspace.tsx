'use client';
import {workspaceAutoContract} from '../lib/workspace-response-contracts';
import { useEffect, useRef, useState } from 'react';
import { readWorkspaceResponse, workspaceAccessDenied, workspaceFailure } from './workspace-request';
import OfficerPresenceMap from './officer-presence-map';
import styles from './signup-portal.module.css';
type Presence = {
    sharing: boolean;
    mode: 'test' | 'live';
    expiresAt?: string;
};
type PresenceState = {mode: 'test' | 'live'; revision: number};
type PresenceSession = {mode: 'test' | 'live'; sessionId: string; consentRevision: number};
async function requestPresence(input: Record<string, unknown>) {
    const response = await readWorkspaceResponse<{
        mode: 'sandbox';
        policyVersion: 'lokd-sandbox-completion-v1';
        productionWorkEligible: false;
        data: Presence | PresenceState | PresenceSession;
    }>(await fetch('/api/sandbox/application', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({service: 'presence', input})}),workspaceAutoContract("sandbox-presence-workspace.tsx/deb0112491b7"));
    const data = response.data;
    if (data.mode !== input.mode
        || input.action === 'state' && (!('revision' in data) || !Number.isSafeInteger(data.revision) || data.revision < 0)
        || input.action === 'start' && (!('sessionId' in data) || !/^[0-9a-f-]{36}$/i.test(data.sessionId) || data.consentRevision !== Number(input.expectedRevision) + 1)
        || input.action === 'share' && (!('sharing' in data) || data.sharing !== true || !data.expiresAt || !Number.isFinite(Date.parse(data.expiresAt)))
        || input.action === 'stop' && (!('sharing' in data) || data.sharing !== false))
        throw Error('The isolated presence response could not be verified. Stop before trying again.');
    return data;
}
export default function SandboxPresenceWorkspace() {
    const [consent, setConsent] = useState(false), [mode, setMode] = useState<'test' | 'live'>('test'), [busy, setBusy] = useState(false), [result, setResult] = useState<Presence | null>(null), [error, setError] = useState(''), [unknown, setUnknown] = useState(false), [now, setNow] = useState(() => Date.now());
    const lock = useRef(false), session = useRef<PresenceSession | null>(null);
    const [mapRevision,setMapRevision]=useState(0);
    useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
    const seconds = result?.expiresAt ? Math.max(0, Math.ceil((Date.parse(result.expiresAt) - now) / 1000)) : 0;
    async function send(action: 'share' | 'stop') {
        if (lock.current || (action === 'share' && (!consent || unknown)))
            return;
        lock.current = true;
        setBusy(true);
        setError('');
        try {
            let bound = session.current;
            if (action === 'share' && !bound) {
                const state = await requestPresence({action: 'state', mode});
                if (!('revision' in state)) throw Error('The current consent revision was not returned.');
                const started = await requestPresence({action: 'start', mode, consent: true, expectedRevision: state.revision});
                if (!('sessionId' in started)) throw Error('The current consent session was not returned.');
                bound = started;
                session.current = bound;
            }
            if (action === 'stop') session.current = null;
            const input = action === 'share' ? {action, mode, consent: true, sessionId: bound?.sessionId, consentRevision: bound?.consentRevision, latitude: -33.9, longitude: 18.4} : {action, mode};
            const response = await requestPresence(input);
            if (!('sharing' in response)) throw Error('The presence outcome was not returned.');
            setResult(response);setMapRevision(n=>n+1);
            setUnknown(false);
            if (action === 'stop')
                setConsent(false);
        }
        catch (cause) {
            session.current = null;
            if (workspaceAccessDenied(cause)) {
                setResult(null);setMapRevision(n=>n+1);
                setConsent(false);
                setUnknown(false);
            }
            else
                setUnknown(true);
            setError(workspaceFailure(cause, 'Presence outcome is unconfirmed. Stop this original signal before attempting another share.'));
        }
        finally {
            lock.current = false;
            setBusy(false);
        }
    }
    return <section className={styles.shell}><h2>Consent, stop and presence expiry</h2><p className={styles.boundary}>Fictional Cape Town area · isolated sandbox database only. This screen never requests your device location or writes a signal to the production public map.</p><label>Presence scenario<select value={mode} disabled={busy || unknown || seconds > 0} onChange={e => { session.current = null; setMode(e.target.value as 'test' | 'live'); setResult(null); setConsent(false); }}><option value="test">Private synthetic test signal</option><option value="live">Test current-assignment eligibility in the isolated map</option></select></label><p>The assignment-gated scenario uses the actual checked-in assignment rules inside the sandbox. An identity result or purchase alone cannot pass them.</p><label><input type="checkbox" checked={consent} disabled={busy || unknown} onChange={e => setConsent(e.target.checked)}/>I consent to sharing only this fictional approximate area in the selected isolated scenario.</label><p><button disabled={busy || unknown || !consent} onClick={() => void send('share')}>Share or refresh fictional presence</button> <button disabled={busy} onClick={() => void send('stop')}>Stop this sandbox signal</button></p>{result && <p role="status">{result.sharing ? (seconds > 0 ? `Saved signal expires in ${seconds} seconds. It is not refreshed automatically.` : 'The saved expiry time has passed. This signal must no longer appear in eligible presence reads.') : 'The server confirmed that this sandbox signal is stopped.'}</p>}{error && <p role="alert">{error}</p>}{unknown && <p>Sharing is paused while the result is uncertain. Stop uses the original selected mode and can be repeated safely to remove its signal.</p>}<button disabled={busy} onClick={()=>setMapRevision(n=>n+1)}>Refresh fictional presence map</button><OfficerPresenceMap sandbox revision={mapRevision}/></section>;
}
