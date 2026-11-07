'use client';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { OfficerZoneProvider, useOfficerZone } from './officer-zone-context';
import { ZoneIcon, type ZoneIconName } from './zone-ui';
export default function OfficerZoneShell({ children }: { children: React.ReactNode }) { return <OfficerZoneProvider><Shell>{children}</Shell></OfficerZoneProvider>; }
function Shell({ children }: { children: React.ReactNode }) {
  const { state } = useOfficerZone(), path = usePathname(), view = useSearchParams().get('view') ?? 'today';
  const access = state?.officer?.approvalStatus === 'approved';
  const links: [string, string, ZoneIconName, boolean][] = [
    ['/officer?view=shifts', 'Shifts', 'calendar', path === '/officer/service' || path === '/officer' && view === 'shifts'],
    ['/officer?view=today', 'Today', 'clock', path === '/officer' && view === 'today'],
    ['/officer/training', 'Training', 'briefcase', path === '/officer/training'],
    ['/officer?view=passport', 'Passport', 'qr', path === '/officer' && view === 'passport'],
    ['/officer?view=zone', 'Zone', 'user', !['today', 'shifts', 'passport'].includes(view) && path !== '/officer/training' || !['/officer', '/officer/training', '/officer/service'].includes(path)],
  ];
  return <div className="zone-app officer-zone"><a className="client-skip" href="#officer-content">Skip to content</a><header className="zone-appbar"><Link href="/officer" className="zone-logo" aria-label="LOKD Officer home"><Image unoptimized priority src="/brand/lokd-mark.svg" alt="LOKD" width={32} height={32} /></Link><div className="zone-identity"><span>LOKD Zone</span><small>{access ? 'Officer Zone' : 'Officer application'}</small></div><Link href="/officer?view=updates" aria-label="Your updates"><ZoneIcon name="bell" tone="blue" /></Link></header><div className="zone-mobile-content" id="officer-content" tabIndex={-1}>{children}</div>{access && <nav className="zone-bottom-nav" aria-label="Officer navigation">{links.map(([href, name, icon, active]) => <Link key={name} href={href} aria-current={active ? 'page' : undefined}><ZoneIcon name={icon} tone={active ? 'blue' : undefined} /><span>{name}</span></Link>)}</nav>}<footer className="client-footer"><Link href="/contact">Contact LOKD</Link><Link href="/privacy">Privacy</Link><Link href="/sign-out" prefetch={false}>Sign out</Link></footer></div>;
}
