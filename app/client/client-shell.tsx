'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

export default function ClientShell({ name, children }: { name: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const view = useSearchParams().get('view') ?? 'bookings';
  const links = [
    { href: '/client', label: 'Your bookings', active: (pathname === '/client' && view === 'bookings') || pathname === '/client/service' },
    { href: '/client?view=request', label: 'Request cover', active: pathname === '/client' && view === 'request' },
    { href: '/client/agreements', label: 'Quotes & agreements', active: pathname.startsWith('/client/agreements') },
    { href: '/client?view=invoices', label: 'Invoices', active: pathname === '/client' && view === 'invoices' },
    { href: '/client?view=account', label: 'Your account', active: pathname === '/client' && view === 'account' },
  ];
  return <div className="client-workspace">
    <a className="client-skip" href="#client-content">Skip to content</a>
    <header className="client-appbar">
      <div className="client-appbar-row"><Link href="/client" className="client-brand" aria-label="LOKD client home">LOKD<span>Client portal</span></Link><div className="client-user"><span>{name}</span><Link prefetch={false} href="/sign-out">Sign out</Link></div></div>
      <nav aria-label="Client navigation">{links.map(link => <Link key={link.href} href={link.href} prefetch={false} aria-current={link.active ? 'page' : undefined}>{link.label}</Link>)}</nav>
    </header>
    <main className="client-content" id="client-content" tabIndex={-1}>{children}</main>
    <footer className="client-footer"><span>LOKD Security</span><Link href="/privacy">Privacy</Link><Link href="/contact">Contact LOKD</Link></footer>
  </div>;
}
