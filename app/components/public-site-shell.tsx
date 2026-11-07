"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { COMPANY_NAME, BOOKINGS_EMAIL, QUOTES_EMAIL } from "../lib/public-site";

export type PublicSection = "home" | "services" | "industries" | "clients" | "officers" | "about" | "contact";
const navigation = [
  ["Security services", "/security-services"], ["For clients", "/clients"],
  ["For officers", "/officers"], ["Training", "/training"], ["About", "/about"], ["Contact", "/contact"],
] as const;

export function PublicHeader({ active = "home" }: { active?: PublicSection }) {
  const pathname = usePathname();
  const links = navigation.map(([label, href]) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} onClick={event => event.currentTarget.closest("details")?.removeAttribute("open")}>{label}</Link>);
  return <header className="public-header-wrap" data-section={active}>
    <a className="public-skip" href="#main-content">Skip to content</a>
    <div className="public-header">
      <Link className="public-logo" href="/" aria-label="LOKD home"><Image src="/lokd-logo-reverse.svg" width={2202} height={713} unoptimized priority alt="LOKD" /></Link>
      <nav aria-label="Main navigation">{links}</nav>
      <div className="public-header-actions"><Link className="public-login" href="/sign-in">Zone</Link><Link className="public-button public-button--primary" href="/quote">Get a quote</Link></div>
      <details className="public-mobile-menu"><summary>Menu</summary><nav aria-label="Mobile navigation">{links}<Link href="/sign-in">Zone</Link><Link href="/quote">Get a quote</Link></nav></details>
    </div>
  </header>;
}

export function PublicFooter() {
  return <footer className="site-footer">
    <div className="site-footer-grid">
      <div className="site-footer-company"><Link href="/" aria-label="LOKD home"><Image src="/lokd-logo-reverse.svg" width={2202} height={713} unoptimized alt="LOKD" /></Link><p>Security for your shift, event or everyday cover.</p><p>Johannesburg, South Africa</p></div>
      <nav aria-label="Security services"><h2>Find your cover</h2><Link href="/security-services">Unarmed guarding</Link><Link href="/armed-security">Armed security</Link><Link href="/vip-protection">VIP protection</Link><Link href="/industries">Industries</Link><Link href="/locations/johannesburg">Johannesburg</Link><Link href="/quote">Get a quote</Link></nav>
      <nav aria-label="About LOKD"><h2>LOKD</h2><Link href="/about">About us</Link><Link href="/compliance">Our checks</Link><Link href="/verify">Verify a Passport</Link><Link href="/officers">For officers</Link><Link href="/training">Training</Link><Link href="/join">Apply as an officer</Link></nav>
      <nav aria-label="Contact and accounts"><h2>Talk to us</h2><Link href="/contact">Contact LOKD</Link><a href={"mailto:" + QUOTES_EMAIL}>{QUOTES_EMAIL}</a><a href={"mailto:" + BOOKINGS_EMAIL}>{BOOKINGS_EMAIL}</a><Link href="/sign-in?return_to=%2Fclient">Client Zone</Link><Link href="/sign-in?return_to=%2Fofficer">Officer Zone</Link><Link href="/sign-in?return_to=%2Fops">Operations Zone</Link></nav>
    </div>
    <div className="site-footer-bottom"><small>© {new Date().getFullYear()} {COMPANY_NAME}</small><nav aria-label="Legal"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms and conditions</Link></nav></div>
  </footer>;
}

export const publicProofPoints = [
  ["PSIRA-verified officers", "Registration checked before an officer is approved for work."],
  ["Identity checks", "The person arriving is matched to their verified officer profile."],
  ["Live check-in", "Follow attendance and shift updates in the LOKD Zone."],
  ["Clear quotes", "Agree the duties, dates and cost before confirming your cover."],
] as const;

export function PublicProofPoints() {
  return <ul className="public-proof-grid">{publicProofPoints.map(([title, description]) => <li key={title}><span aria-hidden="true">✓</span><div><h2>{title}</h2><p>{description}</p></div></li>)}</ul>;
}

export function PublicSteps({ officer = false }: { officer?: boolean }) {
  const steps = officer ? [
    ["Apply online", "Share your contact details, location, registration and work interests."],
    ["Complete your checks", "Follow your application and complete identity and PSIRA checks in your account."],
    ["Find your shifts", "Once approved, view suitable work, accept shifts and check in through the LOKD app."],
  ] : [
    ["Tell us what you need", "Choose a service and share your site, dates, hours and number of officers."],
    ["Agree your quote", "We review your requirements and send a clear scope and price for you to accept."],
    ["Stay in the loop", "See your assigned officers, check-ins and service updates in the Client Zone."],
  ];
  return <section className="public-section"><div className="public-section-heading"><p className="public-kicker">How it works</p><h2>{officer ? "Your next shift starts here." : "From a request to reliable cover."}</h2></div><ol className="public-three-grid public-steps">{steps.map(([title, description], index) => <li key={title}><span className="public-step-number">0{index + 1}</span><h3>{title}</h3><p>{description}</p></li>)}</ol></section>;
}

export function PublicServices() {
  return <section className="public-section public-section--white"><div className="public-section-heading"><p className="public-kicker">Choose your cover</p><h2>The right people for the job.</h2><p>Book for a single shift, an event or ongoing cover in Johannesburg.</p></div><div className="public-three-grid public-service-grid">
    <article><span className="public-service-icon" aria-hidden="true">01</span><h3>Unarmed guarding</h3><p>Access control, patrols and a visible security presence at your property or event.</p><Link href="/security-services">Explore guarding <span aria-hidden="true">↗</span></Link></article>
    <article><span className="public-service-icon" aria-hidden="true">02</span><h3>Armed security</h3><p>Armed cover matched to your site, assessed risks and the duties you need.</p><Link href="/armed-security">Explore armed security <span aria-hidden="true">↗</span></Link></article>
    <article><span className="public-service-icon" aria-hidden="true">03</span><h3>VIP protection</h3><p>Personal protection for your movements, appearances and private engagements.</p><Link href="/vip-protection">Explore VIP protection <span aria-hidden="true">↗</span></Link></article>
  </div></section>;
}

export function OfficerRecruitment() {
  return <section className="public-recruitment"><div><p className="public-kicker">For security officers</p><h2>Your skills. Your next opportunity.</h2><p>Apply to LOKD, complete your verification and find suitable shifts through the app.</p></div><Link className="public-button public-button--primary" href="/join">Apply as an officer <span aria-hidden="true">↗</span></Link></section>;
}

export function PublicPage({ active, eyebrow, title, promise, officer = false, children }: { active?: PublicSection; eyebrow: string; title: string; promise: string; officer?: boolean; children: ReactNode }) {
  return <div className="public-site"><PublicHeader active={active} /><main id="main-content" tabIndex={-1}>
    <section className="public-page-hero"><p className="public-kicker">{eyebrow}</p><h1>{title}</h1><p>{promise}</p><Link className="public-button public-button--primary" href={officer ? "/join" : "/quote"}>{officer ? "Apply as an officer" : "Get a quote"}<span aria-hidden="true">↗</span></Link></section>
    <section className="public-proof-section" aria-label="The LOKD promise"><PublicProofPoints /></section>{children}
  </main><PublicFooter /></div>;
}
