'use client';
import Link from 'next/link';
export default function OperationsError({reset}:{reset:()=>void}) {
 return <main className="operations-workspace"><section className="operations-panel"><h1>Operations is unavailable</h1><p>Your account needs an active named operator role and a verified authenticator. If these are already configured, storage or another required service may be unavailable.</p><p>Contact your LOKD administrator if the problem continues.</p><button onClick={reset}>Try again</button> <Link href="/ops/security">Account security</Link></section></main>;
}
