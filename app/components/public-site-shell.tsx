"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CLIENT_PORTAL_URL,
  OFFICER_PORTAL_URL,
  OPERATIONS_PORTAL_URL,
} from "../lib/public-site";

export type PublicSection = "home" | "services" | "industries" | "clients" | "officers" | "about" | "contact";

const navigation: Array<{ label: string; href: string; section: PublicSection }> = [
  { label: "Services", href: "/security-services", section: "services" },
  { label: "Armed security", href: "/armed-security", section: "services" },
  { label: "VIP protection", href: "/vip-protection", section: "services" },
  { label: "Industries", href: "/industries", section: "industries" },
  { label: "For clients", href: "/clients", section: "clients" },
  { label: "For officers", href: "/officers", section: "officers" },
  { label: "About", href: "/about", section: "about" },
];

export function PublicLaunchBar() {
  return <aside className="team-review-bar" aria-label="LOKD launch status">
    <div><strong>Johannesburg · Enquiries open</strong><span>Unarmed guarding · Armed security · VIP protection</span></div>
    <nav><Link href="/contact">Plan a site</Link><a href={CLIENT_PORTAL_URL}>Client portal</a></nav>
  </aside>;
}

export function PublicHeader({ active = "home" }: { active?: PublicSection }) {
  const pathname = usePathname();
  return <header className="public-header" data-section={active}>
    <Link className="public-logo" href="/" aria-label="LOKD home"><Image width={1096} height={333} unoptimized loading="eager" style={{height:"auto"}} src="/lokd-logo.png" alt="LOKD" /></Link>
    <nav aria-label="Main navigation">
      {navigation.map((item) => <Link aria-current={pathname === item.href ? "page" : undefined} href={item.href} key={item.href}>{item.label}</Link>)}
    </nav>
    <details className="public-mobile-menu"><summary>Menu</summary><nav aria-label="Mobile navigation">{navigation.map(item => <Link aria-current={pathname === item.href ? "page" : undefined} href={item.href} key={item.href} onClick={event => event.currentTarget.closest("details")?.removeAttribute("open")}>{item.label}</Link>)}</nav></details>
    <div className="public-header-actions">
      <a className="public-login" href={CLIENT_PORTAL_URL}>Client login</a>
      <Link className="public-button public-button--dark" href="/contact">Get a security plan</Link>
    </div>
  </header>;
}

export function PublicFooter() {
  return <footer className="public-footer public-footer--expanded">
    <div className="public-footer-brand"><Image width={1096} height={333} unoptimized loading="eager" style={{height:"auto"}} src="/lokd-logo.png" alt="LOKD" /><p>Verified people. Controlled operations. Complete proof.</p></div>
    <nav aria-label="LOKD services"><strong>Explore</strong><Link href="/security-services">Security services</Link><Link href="/armed-security">Armed security</Link><Link href="/vip-protection">VIP protection</Link><Link href="/locations/johannesburg">Johannesburg</Link></nav>
    <nav aria-label="LOKD company"><strong>LOKD</strong><Link href="/about">About</Link><Link href="/compliance">Compliance</Link><Link href="/training">Training</Link><Link href="/contact">Contact</Link></nav>
    <nav aria-label="LOKD workspaces"><strong>Workspaces</strong><a href={CLIENT_PORTAL_URL}>Client portal</a><a href={OFFICER_PORTAL_URL}>Officer portal</a><a href={OPERATIONS_PORTAL_URL}>Operations portal</a><Link href="/join">Officer applications</Link></nav>
    <small>© 2026 LOKD · Service subject to approval and advance funding · <Link href="/privacy">Privacy notice</Link></small>
  </footer>;
}
