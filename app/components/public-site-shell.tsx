"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CLIENT_PORTAL_URL,
  OFFICER_PORTAL_URL,
  OPERATIONS_PORTAL_URL,
  COMPANY_NAME,
  HEAD_OFFICE_ADDRESS,
  TRAINING_CENTRES,
  BOOKINGS_EMAIL,
  QUOTES_EMAIL,
  INVOICE_EMAIL,
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
  return <aside className="team-review-bar" aria-label="Security enquiries">
    <div><strong>South Africa · Enquiries open</strong><span>Unarmed guarding · Armed security · VIP protection</span></div>
    <nav><Link href="/contact">Plan a site</Link><a href={CLIENT_PORTAL_URL}>Client portal</a></nav>
  </aside>;
}

function SocialLinks() {
  return <div className="public-social-links" role="group" aria-label="LOKD social media">
    <a href="https://www.facebook.com/lokdsecurity/" aria-label="LOKD on Facebook" rel="me"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14 22v-9h3l.5-3H14V8c0-.9.3-1.5 1.6-1.5H18V3.2c-.4-.1-1.8-.2-3.3-.2C11.5 3 10 4.9 10 8v2H7v3h3v9z"/></svg></a>
    <a href="https://www.youtube.com/@lokdsecurity" aria-label="LOKD on YouTube" rel="me"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fillRule="evenodd" d="M21.6 6.2c-.2-.8-.8-1.4-1.6-1.6C18.6 4.2 12 4.2 12 4.2s-6.6 0-8 .4c-.8.2-1.4.8-1.6 1.6C2 7.6 2 12 2 12s0 4.4.4 5.8c.2.8.8 1.4 1.6 1.6 1.4.4 8 .4 8 .4s6.6 0 8-.4c.8-.2 1.4-.8 1.6-1.6.4-1.4.4-5.8.4-5.8s0-4.4-.4-5.8ZM10 8.5v7l6-3.5z"/></svg></a>
    <a href="https://www.instagram.com/lokdsecurity/" aria-label="LOKD on Instagram" rel="me"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg></a>
  </div>;
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
      <SocialLinks/>
      <a className="public-login" href={CLIENT_PORTAL_URL}>Client login</a>
      <Link className="public-button public-button--dark" href="/contact">Get a security plan</Link>
    </div>
  </header>;
}

export function PublicFooter() {
  return <footer className="site-footer">
    <div className="site-footer-grid">
      <div className="site-footer-company"><Link href="/" aria-label="LOKD home"><Image width={1096} height={333} unoptimized style={{height:"auto"}} src="/lokd-logo.png" alt="LOKD" /></Link><strong>{COMPANY_NAME}</strong><address><b>Head Office</b>{HEAD_OFFICE_ADDRESS}</address><SocialLinks /></div>
      <nav aria-label="Contact LOKD"><h2>Contact</h2><a href={`mailto:${BOOKINGS_EMAIL}`}><span>Bookings &amp; general enquiries</span>{BOOKINGS_EMAIL}</a><a href={`mailto:${QUOTES_EMAIL}`}><span>Quotes</span>{QUOTES_EMAIL}</a><a href={`mailto:${INVOICE_EMAIL}`}><span>Invoices</span>{INVOICE_EMAIL}</a><Link href="/contact">Send an enquiry</Link></nav>
      <nav aria-label="LOKD services"><h2>Explore</h2><Link href="/security-services">Security services</Link><Link href="/armed-security">Armed security</Link><Link href="/vip-protection">VIP protection</Link><Link href="/about">About LOKD</Link><Link href="/compliance">Compliance</Link><Link href="/training">Training</Link></nav>
      <nav aria-label="LOKD workspaces"><h2>Portals</h2><a href={CLIENT_PORTAL_URL}>Client portal</a><a href={OFFICER_PORTAL_URL}>Officer portal</a><a href={OPERATIONS_PORTAL_URL}>Operations portal</a><Link href="/join">Officer applications</Link></nav>
    </div>
    <div className="site-footer-training"><strong>Training centres opening soon</strong><p>{TRAINING_CENTRES.join(" · ")}</p></div>
    <div className="site-footer-bottom"><small>© {new Date().getFullYear()} {COMPANY_NAME}</small><nav aria-label="Legal"><Link href="/terms-and-conditions">Terms and conditions</Link><Link href="/terms">Terms of use</Link><Link href="/privacy">Privacy notice</Link></nav><p>Service availability is assessed locally. Deployment requires approval and advance funding.</p></div>
  </footer>;
}
