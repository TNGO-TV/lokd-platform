'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { WorkspaceRole } from '../lib/public-site';
import styles from './workspace-shell.module.css';

export default function WorkspaceShell({ role, children }: { role: WorkspaceRole; children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const base = role === 'operations' ? '/ops' : `/${role}`;
  const label = role === 'operations' ? 'Operations' : role === 'client' ? 'Client' : 'Officer';
  const links = [
    { href: base, label: role === 'operations' ? 'Intake review' : 'My submission', active: pathname === base || pathname === '/signup' || pathname === '/ops/intake' },
    { href: `${base}/agreements`, label: 'Agreements' },
    { href: `${base}/service`, label: 'Service & payments' },
    ...(role !== 'client' ? [{ href: `${base}/psira`, label: 'PSiRA checks' }] : []),
    ...(pathname === `${base}/identity` ? [{ href: `${pathname}?${searchParams.toString()}`, label: 'Identity · sandbox', active: true }] : []),
    { href: `${base}/test-cycle`, label: 'Test cycle · simulated' },
    ...(role === 'operations' ? [{ href: '/ops/security', label: 'Account security' }] : []),
  ];
  return <div className={styles.workspace}>
    <a className={styles.skip} href="#workspace-content">Skip to page content</a>
    <header className={styles.header}>
      <div className={styles.brand}><a href="https://lokd.co.za"><img src="/lokd-logo.png" alt="LOKD home" /></a><strong>{label} portal</strong><Link href="/sign-out">Sign out</Link></div>
      <nav className={styles.nav} aria-label={`${label} navigation`}>
        {links.map(link => <Link key={link.href} href={link.href} aria-current={(link.active ?? pathname === link.href) ? 'page' : undefined}>{link.label}</Link>)}
      </nav>
    </header>
    <div id="workspace-content" className={styles.content} tabIndex={-1}>{children}</div>
  </div>;
}
