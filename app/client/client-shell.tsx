'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import { ZoneIcon, type ZoneIconName } from '../components/zone-ui';

export default function ClientShell({ name, children }: { name: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const view = useSearchParams().get('view') ?? 'home';
  const links: { href: string; label: string; icon: ZoneIconName; active: boolean }[] = [
    { href: '/client', label: 'Home', icon: 'home', active: pathname === '/client' && ['home', 'request'].includes(view) },
    { href: '/client?view=bookings', label: 'Bookings', icon: 'calendar', active: pathname === '/client' && view === 'bookings' || pathname === '/client/service' },
    { href: '/client?view=contracts', label: 'Contracts', icon: 'briefcase', active: view === 'contracts' },
    { href: '/client?view=reports', label: 'Reports', icon: 'report', active: view === 'reports' },
    { href: '/client?view=account', label: 'Zone', icon: 'user', active: !['home', 'request', 'bookings', 'contracts', 'reports'].includes(view) || pathname.startsWith('/client/agreements') },
  ];
  return <div className="zone-app client-zone">
    <a className="client-skip" href="#client-content">Skip to content</a>
    <header className="zone-appbar"><Link href="/client" className="zone-logo" aria-label="LOKD Client Zone home"><Image unoptimized priority src="/brand/lokd-mark.svg" alt="LOKD" width={32} height={32} /></Link><div className="zone-identity"><span>LOKD Zone</span><small>Client Zone</small></div><Link href="/client?view=updates" aria-label="Your updates"><ZoneIcon name="bell" tone="blue" /></Link></header>
    <main className="zone-mobile-content" id="client-content" tabIndex={-1}>{children}</main>
    <nav className="zone-bottom-nav" aria-label="Client navigation">{links.map(link => <Link key={link.label} href={link.href} prefetch={false} aria-current={link.active ? 'page' : undefined}><ZoneIcon name={link.icon} tone={link.active ? 'blue' : undefined} /><span>{link.label}</span></Link>)}</nav>
    <footer className="client-footer"><span>{name}</span><Link href="/privacy">Privacy</Link><Link href="/contact">Contact LOKD</Link><Link prefetch={false} href="/sign-out">Sign out</Link></footer>
  </div>;
}
