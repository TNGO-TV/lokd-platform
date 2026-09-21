'use client';
import { useEffect, useRef, useState } from 'react';
import { readWorkspaceResponse, workspaceAccessDenied, workspaceFailure } from './workspace-request';
import OfficerPresenceMap from './officer-presence-map';
import styles from './signup-portal.module.css';
type Presence = {
    sharing: boolean;
    mode: 'test' | 'live';
    expiresAt?: string;
};
export default function SandboxPresenceWorkspace() {
    const [consent, setConsent] = useState(false), [mode, setMode] = useState<'test' | 'live'>('test'), [busy, setBusy] = useState(false), [result, setResult] = useState<Presence | null>(null), [error, setError] = useState(''), [unknown, setUnknown] = useState(false), [now, setNow] = useState(() => Date.now());
    const lock = useRef(false);
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
            const input = action === 'share' ? { action, mode, consent: true, latitude: -33.9, longitude: 18.4 } : { action, mode };
            const response = await readWorkspaceResponse<{
                mode: string;
                policyVersion: string;
                productionWorkEligible: boolean;
                data: Presence;
            }>(await fetch('/api/sandbox/application', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ service: 'presence', input }) }));
            if (response.mode !== 'sandbox' || response.policyVersion !== 'lokd-sandbox-completion-v1' || response.productionWorkEligible !== false || response.data.mode !== mode)
                throw Error('The isolated presence boundary could not be verified.');
            setResult(response.data);setMapRevision(n=>n+1);
            setUnknown(false);
            if (action === 'stop')
                setConsent(false);
        }
        catch (cause) {
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
    return <section className={styles.shell}><h2>Consent, stop and presence expiry</h2><p className={styles.boundary}>Fictional Cape Town area · isolated sandbox database only. This screen never requests your device location or writes a signal to the production public map.</p><label>Presence scenario<select value={mode} disabled={busy || unknown || seconds > 0} onChange={e => { setMode(e.target.value as 'test' | 'live'); setResult(null); setConsent(false); }}><option value="test">Private synthetic test signal</option><option value="live">Test current-assignment eligibility in the isolated map</option></select></label><p>The assignment-gated scenario uses the actual checked-in assignment rules inside the sandbox. An identity result or purchase alone cannot pass them.</p><label><input type="checkbox" checked={consent} disabled={busy || unknown} onChange={e => setConsent(e.target.checked)}/>I consent to sharing only this fictional approximate area in the selected isolated scenario.</label><p><button disabled={busy || unknown || !consent} onClick={() => void send('share')}>Share or refresh fictional presence</button> <button disabled={busy} onClick={() => void send('stop')}>Stop this sandbox signal</button></p>{result && <p role="status">{result.sharing ? (seconds > 0 ? `Saved signal expires in ${seconds} seconds. It is not refreshed automatically.` : 'The saved expiry time has passed. This signal must no longer appear in eligible presence reads.') : 'The server confirmed that this sandbox signal is stopped.'}</p>}{error && <p role="alert">{error}</p>}{unknown && <p>Sharing is paused while the result is uncertain. Stop uses the original selected mode and can be repeated safely to remove its signal.</p>}<button disabled={busy} onClick={()=>setMapRevision(n=>n+1)}>Refresh fictional presence map</button><OfficerPresenceMap sandbox revision={mapRevision}/></section>;
}
