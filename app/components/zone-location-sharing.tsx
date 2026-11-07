'use client';
import { useEffect, useRef, useState } from 'react';
import type { LocationConsent, ZoneMapPoint } from '../lib/zone-location';
import { matchesWorkspaceCommand } from '../lib/workspace-command-receipt';
import ZoneLiveMap from './zone-live-map';
import { ZoneNotice } from './zone-ui';
type ConsentReply = { consent: LocationConsent | null; error?: string; commandReceipt?: unknown };
function consentReply(value: unknown): value is ConsentReply {
  if (!value || typeof value !== 'object' || !('consent' in value)) return false;
  const c = value.consent;
  return c === null || typeof c === 'object' && 'revision' in c && Number.isSafeInteger(c.revision) && 'sessionId' in c && typeof c.sessionId === 'string' && 'active' in c && typeof c.active === 'boolean' && 'mode' in c && ['dispatch', 'en_route'].includes(String(c.mode)) && 'expiresAt' in c && typeof c.expiresAt === 'string' && Number.isFinite(Date.parse(c.expiresAt)) && 'shiftId' in c && (c.shiftId === null || typeof c.shiftId === 'string');
}
export function OfficerLocationSharing({ shifts }: { shifts: { id: string; status: string; siteName: string }[] }) {
  const [consent, setConsent] = useState<LocationConsent | null>(null), [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [mode, setMode] = useState('dispatch'), [shiftId, setShift] = useState('');
  const watch = useRef<number | null>(null), generation = useRef(0), lock = useRef(false);
  const stopWatch = () => { generation.current++; if (watch.current !== null) navigator.geolocation.clearWatch(watch.current); watch.current = null; };
  useEffect(() => { const counter = generation; let live = true; void fetch('/api/zone-location', { cache: 'no-store' }).then(async r => { const b: unknown = await r.json(); if (!r.ok || !consentReply(b)) throw new Error('Location sharing could not be loaded.'); if (live) { setConsent(b.consent); setReady(true); } }).catch((e: Error) => { if (live) setMessage(e.message); }); return () => { live = false; counter.current++; if (watch.current !== null) navigator.geolocation.clearWatch(watch.current); }; }, []);
  useEffect(() => {
    if (!consent?.active) return;
    const timer = setTimeout(() => { generation.current++; if (watch.current !== null) navigator.geolocation.clearWatch(watch.current); watch.current = null; setConsent(c => c && c.sessionId === consent.sessionId ? { ...c, active: false } : c); setMessage('Location sharing expired. Allow a new session to share again.'); }, Math.max(0, Date.parse(consent.expiresAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [consent?.active, consent?.expiresAt, consent?.sessionId]);
  async function send(command: Record<string, unknown>) {
    const requestedGeneration = generation.current;
    const r = await fetch('/api/zone-location', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(command) }), b: unknown = await r.json();
    if (!r.ok) throw new Error(b && typeof b === 'object' && 'error' in b && typeof b.error === 'string' ? b.error : 'Sharing could not be updated.');
    if (!consentReply(b) || !await matchesWorkspaceCommand(b, 'zone-location', command)) throw new Error('Sharing could not be verified. Refresh before continuing.');
    if (requestedGeneration === generation.current) setConsent(b.consent); return b.consent;
  }
  async function start(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current) return; lock.current = true; setBusy(true); setMessage(''); stopWatch();
    try {
      if (!navigator.geolocation) throw new Error('This device cannot share its location.');
      const c = await send({ action: 'start_sharing', expectedRevision: consent?.revision ?? 0, mode, shiftId: mode === 'en_route' ? shiftId : null, locationConsent: true });
      if (!c?.active) throw new Error('Sharing was not activated.');
      const current = ++generation.current; let publishing = false;
      watch.current = navigator.geolocation.watchPosition(position => {
        if (generation.current !== current || publishing || Date.parse(c.expiresAt) <= Date.now()) return;
        publishing = true;
        void send({ action: 'publish_location', sessionId: c.sessionId, revision: c.revision, latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, capturedAt: new Date(position.timestamp).toISOString() }).then(() => { if (generation.current === current) setMessage('Your current location is shared. Sharing expires after three minutes.'); }).catch((error: Error) => { if (generation.current === current) setMessage(error.message); }).finally(() => { publishing = false; });
      }, () => setMessage('Location could not be captured. Check your device permission or stop sharing.'), { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
      setMessage('Location sharing allowed. Waiting for a precise location.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Sharing could not be started.'); } finally { lock.current = false; setBusy(false); }
  }
  return <section className="zone-card"><h2>Location sharing</h2><p>Allow Dispatch to see your precise location for three minutes. Choose an assigned shift to also share your route with that client. Sharing does not change your availability or confirm an assignment.</p>{message && <ZoneNotice title="Location update">{message}</ZoneNotice>}{consent?.active && <p>Sharing allowed until {new Date(consent.expiresAt).toLocaleTimeString('en-ZA', { timeZone: 'Africa/Johannesburg', hour: '2-digit', minute: '2-digit' })} SAST. You can stop at any time.</p>}<form onSubmit={start} className="zone-form"><label>Share with<select value={mode} onChange={e => setMode(e.target.value)}><option value="dispatch">Dispatch only</option><option value="en_route">Dispatch and my assigned client</option></select></label>{mode === 'en_route' && <label>Confirmed shift<select required value={shiftId} onChange={e => setShift(e.target.value)}><option value="">Choose your shift</option>{shifts.filter(s => s.status === 'confirmed').map(s => <option key={s.id} value={s.id}>{s.siteName}</option>)}</select></label>}<label className="zone-check"><input type="checkbox" required />I allow this precise location sharing for three minutes.</label><button className="zone-primary" disabled={!ready || busy}>{busy ? 'Saving…' : 'Allow location sharing'}</button></form><button className="zone-secondary" disabled={!ready || busy} onClick={async () => { if (lock.current) return; lock.current = true; setBusy(true); stopWatch(); try { await send({ action: 'stop_sharing' }); setMessage('Location sharing stopped.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not stop sharing. Your session will expire after three minutes.'); } finally { lock.current = false; setBusy(false); } }}>Stop sharing</button></section>;
}
export function ClientOfficerRoute({ shiftId }: { shiftId: string }) {
  const [route, setRoute] = useState<{ points: ZoneMapPoint[]; site: { latitude: number; longitude: number; name: string } } | null>(null);
  useEffect(() => { let active = true; async function refresh() { try { const r = await fetch(`/api/zone-location?scope=client&shiftId=${encodeURIComponent(shiftId)}`, { cache: 'no-store' }), body = await r.json() as { points?: ZoneMapPoint[]; site?: { latitude: number; longitude: number; name: string } }; if (active) setRoute(r.ok && Array.isArray(body.points) && body.points.every(p => typeof p.name === 'string' && Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && Number.isFinite(p.accuracy) && Number.isFinite(Date.parse(p.capturedAt))) && body.site && Number.isFinite(body.site.latitude) && Number.isFinite(body.site.longitude) ? { points: body.points, site: body.site } : null); } catch { if (active) setRoute(null); } } void refresh(); const timer = setInterval(() => void refresh(), 15000); return () => { active = false; clearInterval(timer); }; }, [shiftId]);
  return route?.points.length ? <section><h3>Officer on route</h3><ZoneLiveMap points={route.points} site={route.site} label="Your officer on route" /><p>Live location shared by your assigned officer. Arrival depends on the route and traffic.</p></section> : <p className="zone-muted">Live route appears here when your assigned officer allows location sharing.</p>;
}
