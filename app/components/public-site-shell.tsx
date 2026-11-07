"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import { COMPANY_NAME, BOOKINGS_EMAIL, QUOTES_EMAIL } from "../lib/public-site";

export type PublicSection = "home" | "services" | "industries" | "clients" | "officers" | "training" | "about" | "contact";
const navigation = [
  ["Book", "/book"], ["Security services", "/security-services"], ["For clients", "/clients"],
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
      <div className="public-header-actions"><Link className="public-login" href="/sign-in">Zone</Link><Link className="public-button public-button--primary public-header-book" href="/book">Book officers<Icon name="arrowUpRight" size={18} /></Link></div>
      <details className="public-mobile-menu" onKeyDown={event => { if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); } }}>
        <summary>Menu<span className="site-menu-icon" aria-hidden="true"><i /><i /></span></summary>
        <nav aria-label="Mobile navigation">{links}<Link href="/sign-in">Zone</Link><Link href="/book?when=ongoing">Ongoing cover</Link></nav>
      </details>
    </div>
  </header>;
}

export function PublicFooter() {
  return <footer className="site-footer">
    <div className="site-footer-grid">
      <div className="site-footer-company"><Link href="/" aria-label="LOKD home"><Image src="/lokd-logo-reverse.svg" width={2202} height={713} unoptimized alt="LOKD" /></Link><p>On-demand security. Ongoing cover. Training for your next step.</p><span className="site-footer-location"><Icon name="mapPin" size={16} />South Africa</span></div>
      <nav aria-label="Security services"><h2>Find your cover</h2><Link href="/book">Book officers</Link><Link href="/book?when=ongoing">Ongoing cover</Link><Link href="/security-services">Unarmed guarding</Link><Link href="/armed-security">Armed security</Link><Link href="/vip-protection">VIP protection</Link><Link href="/industries">Industries</Link><Link href="/contact">Service areas</Link></nav>
      <nav aria-label="About LOKD"><h2>LOKD</h2><Link href="/about">About us</Link><Link href="/compliance">Our checks</Link><Link href="/verify">Verify a Passport</Link><Link href="/officers">For officers</Link><Link href="/training">Training</Link><Link href="/officers">Apply as an officer</Link></nav>
      <nav aria-label="Contact and accounts"><h2>Talk to us</h2><Link href="/contact">Contact LOKD</Link><a href={"mailto:" + QUOTES_EMAIL}>{QUOTES_EMAIL}</a><a href={"mailto:" + BOOKINGS_EMAIL}>{BOOKINGS_EMAIL}</a><Link href="/sign-in?return_to=%2Fclient">Client Zone</Link><Link href="/sign-in?return_to=%2Fofficer">Officer Zone</Link><Link href="/sign-in?return_to=%2Fops">Operations Zone</Link></nav>
    </div>
    <div className="site-footer-bottom"><small>© {new Date().getFullYear()} {COMPANY_NAME}</small><nav aria-label="Legal"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms and conditions</Link></nav></div>
  </footer>;
}

export const publicProofPoints = [
  ["PSIRA-verified officers", "Registration and grade checked for the assignment."],
  ["Identity matched", "The person arriving is matched to their officer profile."],
  ["Role qualifications", "Additional requirements for armed and VIP work."],
  ["LOKD Passport", "Officer credentials you can check at your gate."],
] as const;
const proofIcons: IconName[] = ["shieldCheck", "userCheck", "badgeCheck", "scan"];

export function PublicProofPoints() {
  return <div className="site-proof-grid">{publicProofPoints.map(([title, description], index) => <article key={title}><span className="site-icon"><Icon name={proofIcons[index]} /></span><h2>{title}</h2><p>{description}</p></article>)}</div>;
}

export function PublicSteps({ officer = false }: { officer?: boolean }) {
  const steps: [IconName, string, string][] = officer ? [
    ["clipboard", "Apply online", "Share your contact details, registration and work interests."],
    ["badgeCheck", "Complete your checks", "Complete the identity, PSIRA and role checks for your pathway."],
    ["calendar", "Find your shifts", "Once approved, manage suitable work through your Officer Zone."],
  ] : [
    ["mapPin", "Set your brief", "Choose your location, service, dates and number of officers."],
    ["userCheck", "Confirm your cover", "LOKD reviews availability, duties and officer requirements with you."],
    ["scan", "Know who arrives", "Check the officer’s LOKD Passport and follow your cover in the Client Zone."],
  ];
  return <section className="public-section"><div className="public-section-heading"><p className="public-kicker">How it works</p><h2>{officer ? "Your next shift starts here." : "A clear brief. The right cover."}</h2></div><ol className="site-process-grid">{steps.map(([icon, title, description], index) => <li key={title}><div><span className="site-icon"><Icon name={icon} /></span><span className="site-index">0{index + 1}</span></div><h3>{title}</h3><p>{description}</p></li>)}</ol></section>;
}

export function BookingModels() {
  return <section className="site-section" id="booking-models" aria-labelledby="booking-models-title">
    <div className="site-section-head"><div><p className="public-kicker">How booking works</p><h2 id="booking-models-title">One shift or a full roster.<br />You choose.</h2></div><p>On-demand bookings and ongoing contract cover, with verified officers matched to your requirements.</p></div>
    <div className="site-model-grid">
      <article className="site-model"><div className="site-panel-top"><span className="site-icon site-icon--red"><Icon name="clock" /></span><span className="site-tag">On demand</span></div><h3>LOKD Flex</h3><p>Today, tomorrow or short notice. Book for a shift, an event or a temporary gap in your cover.</p>
        <div className="site-date-options" aria-label="Choose when you need officers"><Link href="/book?when=today"><Icon name="clock" />Today</Link><Link href="/book?when=tomorrow"><Icon name="calendar" />Tomorrow</Link><Link href="/book"><Icon name="calendar" />Choose a date</Link></div>
        <div className="site-model-flow"><span><Icon name="mapPin" size={18} />Your location</span><span><Icon name="users" size={18} />Your officers</span><span><Icon name="clipboard" size={18} />Your brief</span></div>
        <Link className="site-card-link" href="/book">Book on demand<Icon name="arrowUpRight" size={20} /></Link>
      </article>
      <article className="site-model site-model--fixed"><div className="site-panel-top"><span className="site-icon"><Icon name="calendar" /></span><span className="site-tag">Ongoing contract cover</span></div><h3>LOKD Fixed</h3><p>Build a planned roster around your site. Agree the duties, shift pattern and officer requirements for ongoing cover.</p>
        <div className="site-roster" aria-label="Plan your ongoing roster"><div><Icon name="building" size={20} /><strong>Your site. Your schedule.</strong></div><div className="site-roster-days" aria-hidden="true">{["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <span key={index}>{day}<i /></span>)}</div><div className="site-roster-labels"><span><Icon name="clock" size={16} />Day or night shifts</span><span><Icon name="users" size={16} />Planned team cover</span></div></div>
        <Link className="site-card-link" href="/book?when=ongoing">Plan ongoing cover<Icon name="arrowUpRight" size={20} /></Link>
      </article>
    </div>
    <p className="site-dispatch-note"><Icon name="route" size={19} />Officers are dispatched from the closest available pool. Arrival time depends on your location and availability.</p>
  </section>;
}

const services: [IconName, string, string, string, string][] = [
  ["building", "Unarmed guarding", "Access control, patrols and a professional presence for your premises or event.", "Grade C minimum", "/security-services"],
  ["shield", "Armed security", "Qualified armed officers for site duties and movements, matched to the assignment.", "Grade B minimum", "/armed-security"],
  ["car", "VIP protection", "Discreet close protection planned around people, venues and movements.", "Grade B minimum", "/vip-protection"],
];

export function PublicServices() {
  return <section className="site-section" aria-labelledby="services-title"><div className="site-section-head"><div><p className="public-kicker">Security services</p><h2 id="services-title">The right cover.<br />For your kind of day.</h2></div><p>From a single booking to a contracted roster. Choose the service that fits your site and responsibilities.</p></div><div className="site-services-grid">{services.map(([icon, title, description, grade, href], index) => <article className={"site-service-card" + (index === 1 ? " site-service-card--dark" : "")} key={title}><div className="site-panel-top"><span className="site-icon"><Icon name={icon} /></span><span className="site-index">0{index + 1}</span></div><h3>{title}</h3><p>{description}</p><div className="site-service-detail"><Icon name="badgeCheck" size={22} /><span>Officer requirement<strong>{grade}</strong></span><Icon name={index === 2 ? "route" : "doorOpen"} size={36} /></div><Link className="site-card-link" href={href}>{title}<Icon name="arrowUpRight" size={20} /></Link></article>)}</div><Link className="site-industry-link" href="/industries"><span><Icon name="building" size={20} />Workplaces and retail</span><span><Icon name="users" size={20} />Residential</span><span><Icon name="clipboard" size={20} />Construction and logistics</span><span><Icon name="calendar" size={20} />Events and venues</span><Icon name="arrowUpRight" size={22} /></Link></section>;
}

export function OfficerRecruitment() {
  return <section className="site-officer-band" aria-labelledby="officer-paths-title"><div><p className="public-kicker">For officers</p><h2 id="officer-paths-title">Your skills.<br />Your next opportunity.</h2><p>Already registered or entering the industry? Start with the pathway that fits where you are.</p></div><div className="site-officer-paths"><Link href="/officers"><span className="site-icon"><Icon name="badgeCheck" /></span><span><strong>PSIRA Registered or renewal</strong><small>Continue your security career</small></span><Icon name="arrowUpRight" size={22} /></Link><Link href="/officers"><span className="site-icon"><Icon name="graduationCap" /></span><span><strong>New Application</strong><small>Explore your first step into security</small></span><Icon name="arrowUpRight" size={22} /></Link></div></section>;
}

export type PublicFeature = { icon: IconName; title: string; description: string; detail?: string };

export function PublicFeatureGrid({ eyebrow, title, features }: { eyebrow: string; title: string; features: PublicFeature[] }) {
  return <section className="site-section"><div className="site-section-head"><div><p className="public-kicker">{eyebrow}</p><h2>{title}</h2></div></div><div className="site-feature-grid">{features.map(feature => <article key={feature.title}><div className="site-panel-top"><span className="site-icon"><Icon name={feature.icon} /></span>{feature.detail && <span className="site-tag">{feature.detail}</span>}</div><h3>{feature.title}</h3><p>{feature.description}</p></article>)}</div></section>;
}

export function ServiceRequirements({ grade, specialist }: { grade: "B" | "C"; specialist?: "armed" | "vip" }) {
  const items: [IconName, string, string][] = [
    ["badgeCheck", "PSIRA grade " + grade + " minimum", "Current registration and the required grade are checked."],
    ["userCheck", "Identity and Passport", "Identity is matched to the officer profile and LOKD Passport."],
    [specialist === "vip" ? "car" : "shield", specialist === "armed" ? "Firearm competency" : specialist === "vip" ? "Close-protection qualifications" : "Assignment readiness", specialist === "armed" ? "Relevant firearm competency and assignment requirements apply." : specialist === "vip" ? "Relevant VIP qualifications apply. Armed roles also require firearm competency." : "Duties, access instructions and the site brief guide the assignment."],
  ];
  return <PublicFeatureGrid eyebrow="Officer requirements" title="The credentials behind your cover." features={items.map(([icon, title, description]) => ({ icon, title, description }))} />;
}

export function PublicPage({ active, eyebrow, title, promise, officer = false, ctaHref, ctaLabel, children }: { active?: PublicSection; eyebrow: string; title: string; promise: string; officer?: boolean; ctaHref?: string; ctaLabel?: string; children: ReactNode }) {
  const ongoingHref = ctaHref?.includes("?") ? ctaHref + "&when=ongoing" : "/book?when=ongoing";
  return <div className="public-site"><PublicHeader active={active} /><main id="main-content" tabIndex={-1}>
    <section className={"public-page-hero" + (ctaHref ? " public-page-hero--product" : "")}><div><p className="public-kicker">{eyebrow}</p><h1>{title}</h1><p className="site-page-promise">{promise}</p><div className="home-actions"><Link className="public-button public-button--primary" href={ctaHref ?? (officer ? "/join" : "/quote")}>{ctaLabel ?? (officer ? "Apply as an officer" : "Get a quote")}<Icon name="arrowUpRight" size={20} /></Link>{ctaHref && <Link className="site-light-link" href={ongoingHref}>Ongoing cover<Icon name="calendar" size={18} /></Link>}</div></div>{ctaHref && <div className="site-brief-panel"><div className="site-panel-top"><Icon name="clipboard" size={28} /><span className="site-tag">Your security brief</span></div><h2>Built around your site.</h2><div><span><Icon name="mapPin" />Your location</span><span><Icon name="clock" />On demand or ongoing</span><span><Icon name="badgeCheck" />PSIRA-verified officers</span></div><Link href={ctaHref}>Start your booking<Icon name="arrowUpRight" size={20} /></Link></div>}</section>
    {!ctaHref && <section className="public-proof-section" aria-label="The LOKD promise"><PublicProofPoints /></section>}{children}
  </main><PublicFooter /></div>;
}
