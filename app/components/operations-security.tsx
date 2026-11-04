'use client';
import { useState, useRef } from 'react';
import Link from 'next/link';

type SecurityState = { fresh: boolean; enrolled: boolean; required: boolean; maxAgeMinutes: number; verifiedAt: string | null; error?: string };
const isState = (v: unknown): v is SecurityState => !!v && typeof v === 'object' && typeof (v as SecurityState).fresh === 'boolean'
  && typeof (v as SecurityState).enrolled === 'boolean' && typeof (v as SecurityState).required === 'boolean';

export default function OperationsSecurity() {
  const [message, setMessage] = useState('Operations records open once your second factor has been verified in the last five minutes.');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function check() {
    if (lock.current) return; lock.current = true; setBusy(true);
    try {
      const response = await fetch('/api/operations/security?verify=1', { cache: 'no-store' });
      const result: unknown = await response.json();
      if (response.status === 401) setMessage('Sign in to your Operations account first.');
      else if (!isState(result)) setMessage('Security status is unavailable. Try again.');
      else if (!result.enrolled) setMessage('Enrol an authenticator app on your account, then check again.');
      else if (result.fresh && typeof result.verifiedAt === 'string' && Date.now() - Date.parse(result.verifiedAt) >= 0 && Date.now() - Date.parse(result.verifiedAt) < 5 * 60_000) setMessage('Second factor verified. Live Operations changes are available for five minutes; your assigned permissions still apply.');
      else setMessage(result.error ?? 'Verify your second factor, then check again.');
    } catch { setMessage('Security status is unavailable. Try again.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <main style={{ maxWidth: 720, margin: '4rem auto', padding: '1.5rem' }}>
    <Link href="/ops">← Operations</Link><h1>Operations account security</h1>
    <p>Every Operations user needs an authenticator app. An emailed sign-in code alone does not meet the Operations requirement.</p>
    <p role="status">{message}</p>
    <button className="public-button public-button--dark" disabled={busy} onClick={() => void check()}>{busy ? 'Checking…' : 'Check second factor'}</button>
    <p>Verification lasts five minutes. Financial approvals also need the assigned role, approval limits and an independent reviewer.</p>
  </main>;
}
