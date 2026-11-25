"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import { Photo } from "./public-visuals";
import { COMPANY_NAME, BOOKINGS_EMAIL, QUOTES_EMAIL } from "../lib/public-site";

export type PublicSection = "home" | "services" | "industries" | "clients" | "officers" | "training" | "about" | "contact";
const navigation = [
  ["Book", "/book"], ["Security services", "/security-services"], ["For clients", "/clients"],
  ["For officers", "/officers"], ["Training", "/training"], ["About", "/about"], ["Contact", "/contact"],
] as const;

export function PublicHeader({ active = "home", overlay = false }: { active?: PublicSection; overlay?: boolean }) {
  const pathname = usePathname();
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    if (!overlay) return;
    const update = () => setSolid(window.scrollY > 24);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [overlay]);
  const links = navigation.map(([label, href]) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} onClick={event => event.currentTarget.closest("details")?.removeAttribute("open")}>{label}</Link>);
  return <header className="site-header" data-section={active} data-overlay={overlay ? "" : undefined} data-solid={solid ? "" : undefined}>
    <a className="public-skip" href="#main-content">Skip to content</a>
    <div className="site-header-inner">
      <Link className="public-logo" href="/" aria-label="LOKD home"><Image src="/lokd-logo-reverse.svg" width={2202} height={713} unoptimized priority alt="LOKD" /></Link>
      <nav aria-label="Main navigation">{links}</nav>
      <div className="public-header-actions"><Link className="public-login" href="/sign-in">Zone</Link><Link className="btn btn--red public-header-book" href="/book">Book officers</Link></div>
      <details className="public-mobile-menu" onKeyDown={event => { if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); } }}>
        <summary>Menu<span className="site-menu-icon" aria-hidden="true"><i /><i /></span></summary>
        <nav aria-label="Mobile navigation">{links}<Link href="/sign-in">Zone</Link><Link href="/book?when=ongoing">Ongoing cover</Link></nav>
      </details>
    </div>
  </header>;
}

export function PublicFooter() {
  return <footer className="site-footer">
    <div className="site-footer-inner">
      <div className="site-footer-top">
        <div><Link href="/" aria-label="LOKD home"><Image src="/lokd-logo-reverse.svg" width={2202} height={713} unoptimized alt="LOKD" /></Link><p>Security on your terms.</p></div>
        <div className="site-footer-mail"><a href={"mailto:" + BOOKINGS_EMAIL}>{BOOKINGS_EMAIL}</a><a href={"mailto:" + QUOTES_EMAIL}>{QUOTES_EMAIL}</a><span className="site-footer-location">South Africa</span></div>
      </div>
      <nav aria-label="Site">
        <Link href="/book">Book officers</Link><Link href="/book?when=ongoing">Ongoing cover</Link><Link href="/security-services">Unarmed guarding</Link><Link href="/armed-security">Armed security</Link><Link href="/vip-protection">VIP protection</Link><Link href="/industries">Industries</Link><Link href="/contact">Service areas</Link><Link href="/about">About us</Link><Link href="/compliance">Our checks</Link><Link href="/verify">Verify a Passport</Link><Link href="/officers">For officers</Link><Link href="/training">Training</Link><Link href="/contact">Contact LOKD</Link>
      </nav>
      <nav aria-label="Zones"><Link href="/sign-in?return_to=%2Fclient">Client Zone</Link><Link href="/sign-in?return_to=%2Fofficer">Officer Zone</Link><Link href="/sign-in?return_to=%2Fops">Operations Zone</Link></nav>
      <div className="site-footer-bottom"><small>© {new Date().getFullYear()} {COMPANY_NAME}</small><nav aria-label="Legal"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms and conditions</Link></nav></div>
    </div>
  </footer>;
}

/* ---------- Hero sentence builder: a plain GET form that opens /book prefilled ---------- */
export const heroAreas = ["Sandton", "Rosebank", "Randburg", "Fourways", "Midrand", "Bryanston", "Melrose"] as const;

export function HeroBuilder() {
  const [count, setCount] = useState(2);
  const one = count === 1;
  return <form className="hero-builder" action="/book" method="get">
    <p className="hero-sentence">
      <span>I need</span>
      <label><span className="sr-only">Number of officers</span><span className="hero-select"><select name="officers" value={count} onChange={event => setCount(Number(event.target.value))}>{Array.from({ length: 20 }, (_, index) => <option key={index} value={index + 1}>{index + 1}</option>)}</select></span></label>
      <label><span className="sr-only">Service</span><span className="hero-select"><select name="service" defaultValue="scheduled_unarmed_fixed_site"><option value="scheduled_unarmed_fixed_site">{one ? "unarmed officer" : "unarmed officers"}</option><option value="armed_static">{one ? "armed officer" : "armed officers"}</option><option value="vip_unarmed">{one ? "VIP protection officer" : "VIP protection officers"}</option></select></span></label>
      <span>in</span>
      <label><span className="sr-only">Area</span><span className="hero-select"><select name="area" defaultValue="Sandton">{heroAreas.map(area => <option key={area}>{area}</option>)}<option value="">another area</option></select></span></label>
      <label><span className="sr-only">When</span><span className="hero-select"><select name="when" defaultValue="today"><option value="today">today</option><option value="tomorrow">tomorrow</option><option value="date">on a date</option><option value="ongoing">ongoing</option></select></span></label>
    </p>
    <div className="hero-submit"><button className="btn btn--red" type="submit">Book officers</button><p className="hero-note">PSIRA-verified officers. Arrival time depends on your location.</p></div>
  </form>;
}

/* ---------- Booking models as a time scale ---------- */
type Model = "bolt" | "flex" | "fixed";
const models: { key: Model; name: string; span: string; start: number; end: number; detail: string; facts: [string, string][]; href: string; link: string }[] = [
  { key: "bolt", name: "LOKD Bolt", span: "Under 72 hours", start: 0, end: 15, detail: "Urgent cover with less than 72 hours’ notice, subject to verified officer availability. Officers are dispatched from the closest available pool, and arrival time depends on your location.", facts: [["Notice", "Less than 72 hours"], ["Suited to", "Gaps, incidents and events"]], href: "/book?model=bolt", link: "Book urgent cover" },
  { key: "flex", name: "LOKD Flex", span: "7+ days in a month", start: 15, end: 40, detail: "Temporary cover for seven or more service days within one calendar month, planned at least 72 hours ahead. Set the dates, duties and shift pattern for your site.", facts: [["Notice", "72 hours or more"], ["Service days", "7+ in a calendar month"]], href: "/book?model=flex", link: "Plan LOKD Flex cover" },
  { key: "fixed", name: "LOKD Fixed", span: "3, 6 or 12 months", start: 58, end: 100, detail: "Ongoing contract cover on an agreed roster for 3, 6 or 12 months, with officers matched to your site and its duties.", facts: [["Term", "3, 6 or 12 months"], ["Suited to", "Sites, depots and estates"]], href: "/book?model=fixed", link: "Plan ongoing cover" },
];
const ticks: [string, number][] = [["Now", 0], ["72 hours", 15], ["1 month", 40], ["3 months", 58], ["6 months", 76], ["12 months", 100]];

export function BookingScale({ headingId = "booking-models-title", title = "Cover on your timeline." }: { headingId?: string; title?: string }) {
  const [selected, setSelected] = useState<Model>("bolt");
  return <section className="band band--white" aria-labelledby={headingId}><div className="site-wrap">
    <div className="band-head"><h2 id={headingId} className="t-section">{title}</h2><p className="t-lead scale-intro">Book for today, tomorrow or ongoing cover. LOKD supplies verified officers directly, from one urgent shift to a 12-month roster.</p></div>
    <div className="scale">
      <div className="scale-axis">
        <div className="scale-rail" aria-hidden="true" />
        {ticks.map(([label, at]) => <span key={label} className="scale-tick" style={{ left: at + "%" }} aria-hidden="true">{label}</span>)}
        {models.map(model => <h3 key={model.key} className={"scale-span scale-span--" + model.key} style={{ left: model.start + "%", width: (model.end - model.start) + "%" }}>
          <button type="button" aria-label={model.name} aria-describedby={"scale-span-" + model.key} aria-expanded={selected === model.key} aria-controls={"scale-panel-" + model.key} onClick={() => setSelected(model.key)}>{model.name}<small id={"scale-span-" + model.key}>{model.span}</small></button>
        </h3>)}
      </div>
      {models.map(model => <div key={model.key} id={"scale-panel-" + model.key} className="scale-detail" hidden={selected !== model.key}>
        <div className="scale-copy">
          <p className="t-title" aria-hidden="true">{model.name}</p>
          <p className="t-lead">{model.detail}</p>
          <dl>{model.facts.map(([term, value]) => <div key={term}><dt>{term}</dt><dd>{value}</dd></div>)}</dl>
          <Link className="btn btn--red" href={model.href}>{model.link}</Link>
        </div>
        <figure className={"scale-figure" + (model.key === "fixed" ? "" : " scale-figure--phone")}>
          {model.key === "fixed"
            ? <Photo name="site-roster" sizes="(max-width: 1060px) 100vw, 680px" alt="A laptop on a construction site desk beside a hard hat and radio, showing a LOKD Fixed 12-month roster with day and night shifts" />
            : <Photo name="event-booking" sizes="(max-width: 1060px) 100vw, 680px" alt="A hand holding a phone at a live event, showing a LOKD Bolt booking with officers confirmed" />}
          <figcaption>{model.key === "fixed" ? "Your roster in the Client Zone" : "Book and follow cover from your phone"}</figcaption>
        </figure>
      </div>)}
    </div>
  </div></section>;
}

/** Kept for pages that still name the booking models block. */
export function BookingModels() { return <BookingScale headingId="booking-models-heading" title="Three ways to book." />; }

/* ---------- Services as editorial panels ---------- */
export function PublicServices({ headingId = "services-title" }: { headingId?: string }) {
  return <section className="band" aria-labelledby={headingId}><div className="site-wrap">
    <div className="band-head"><h2 id={headingId} className="t-section">The right cover for your kind of day.</h2><p className="t-lead">From one shift to a contracted roster. Every officer is checked for the grade and qualifications the work needs.</p></div>
    <div className="services">
      <article className="service-panel service-panel--lead">
        <Photo name="night-patrol" sizes="(max-width: 1060px) 100vw, 60vw" alt="A security officer checking a dark doorway with a torch on a night patrol" />
        <h3><Link href="/security-services">Unarmed guarding</Link></h3>
        <p>Access control, patrols and a professional presence at your premises or event. Day, night or around the clock.</p>
        <div className="service-meta"><span className="grade-mark">Minimum grade <b>C</b></span><Link className="service-book" href="/book?service=scheduled_unarmed_fixed_site">Book unarmed officers</Link></div>
      </article>
      <article className="service-panel service-panel--slate">
        <h3><Link href="/armed-security">Armed security</Link></h3>
        <p>Qualified armed officers for site duties and planned movements, matched to the assignment.</p>
        <div className="service-meta"><span className="grade-mark">Minimum grade <b>B</b></span><Link className="service-book" href="/book?service=armed_static">Book armed officers</Link></div>
      </article>
      <article className="service-panel service-panel--white">
        <h3><Link href="/vip-protection">VIP protection</Link></h3>
        <p>Discreet close protection planned around people, venues and movements.</p>
        <div className="service-meta"><span className="grade-mark">Minimum grade <b>B</b></span><Link className="service-book" href="/book?service=vip_unarmed">Book VIP protection</Link></div>
      </article>
    </div>
    <p className="services-more t-soft">Workplaces and retail, residential estates, construction and logistics, events and venues. <Link className="site-arrow-link" href="/industries">Security by industry<Icon name="arrowUpRight" size={18} /></Link></p>
  </div></section>;
}

/* ---------- Officer doors ---------- */
export function OfficerRecruitment({ headingId = "officer-paths-title" }: { headingId?: string }) {
  return <section aria-labelledby={headingId}>
    <h2 id={headingId} className="sr-only">Work with LOKD as an officer</h2>
    <div className="doors">
      <Link className="door door--photo" href="/join?path=registered">
        <Photo name="officer-radio-portrait" sizes="(max-width: 760px) 100vw, 50vw" alt="" />
        <h3>PSIRA Registered or renewal</h3>
        <p>Already registered, or renewing? Apply with your PSIRA number and grade, and share when you can work.</p>
        <span className="door-go">Apply as a registered officer<Icon name="arrowUpRight" size={22} /></span>
      </Link>
      <Link className="door door--canvas" href="/join?path=new">
        <h3>New Application</h3>
        <p>Starting out in security? LOKD guides you from your ID check through training and PSIRA registration.</p>
        <span className="door-go">Start a new application<Icon name="arrowUpRight" size={22} /></span>
      </Link>
    </div>
  </section>;
}

/* ---------- Editorial building blocks for inner pages ---------- */
export type PublicFeature = { icon?: IconName; title: string; description: string; detail?: string };

export function PublicFeatureGrid({ title, intro, features, white = false }: { eyebrow?: string; title: string; intro?: string; features: PublicFeature[]; white?: boolean }) {
  return <section className={"band" + (white ? " band--white" : "")}><div className="site-wrap editorial">
    <div><h2 className="t-section">{title}</h2>{intro && <p className="t-lead" style={{ marginTop: 20 }}>{intro}</p>}</div>
    <ul className="editorial-list">{features.map(feature => <li key={feature.title}><h3>{feature.title}{feature.detail && <small>{feature.detail}</small>}</h3><p>{feature.description}</p></li>)}</ul>
  </div></section>;
}

export function ServiceRequirements({ grade, specialist }: { grade: "B" | "C"; specialist?: "armed" | "vip" }) {
  const items: [string, string][] = [
    ["PSIRA grade " + grade + " minimum", "Current registration and the required grade are checked."],
    ["Identity and Passport", "Identity is matched to the officer profile and LOKD Passport."],
    [specialist === "armed" ? "Firearm competency" : specialist === "vip" ? "Close-protection qualifications" : "Assignment readiness", specialist === "armed" ? "Relevant firearm competency and assignment requirements apply." : specialist === "vip" ? "Relevant VIP qualifications apply. Armed roles also require firearm competency." : "Duties, access instructions and the site brief guide the assignment."],
  ];
  return <section className="band band--white" aria-labelledby="requirements-title"><div className="site-wrap spec">
    <div className="spec-grade" aria-hidden="true"><b>{grade}</b><span>Minimum PSIRA grade</span></div>
    <div><h2 id="requirements-title" className="t-section">The credentials behind your cover.</h2>
      <ul>{items.map(([title, description]) => <li key={title}><Icon name="badgeCheck" size={24} /><strong>{title}</strong><p>{description}</p></li>)}</ul>
      <p className="site-note">Check any officer at your gate with their <Link className="site-inline-link" href="/verify">LOKD Passport</Link>.</p>
    </div>
  </div></section>;
}

export function PublicSteps({ officer = false }: { officer?: boolean }) {
  const steps: [string, string][] = officer ? [
    ["Apply online", "Share your contact details, registration and work interests."],
    ["Complete your checks", "Complete the identity, PSIRA and role checks for your pathway."],
    ["Find your shifts", "Once approved, manage suitable work through your Officer Zone."],
  ] : [
    ["Set your brief", "Choose your location, service, dates and number of officers."],
    ["Confirm your cover", "LOKD reviews availability, duties and officer requirements with you."],
    ["Know who arrives", "Check the officer’s LOKD Passport and follow your cover in the Client Zone."],
  ];
  return <section className="band" aria-labelledby={officer ? "officer-steps-title" : "client-steps-title"}><div className="site-wrap">
    <div className="band-head"><h2 id={officer ? "officer-steps-title" : "client-steps-title"} className="t-section">{officer ? "Your next shift starts here." : "A clear brief. The right cover."}</h2></div>
    <ol className="sequence">{steps.map(([title, description]) => <li key={title}><h3>{title}</h3><p>{description}</p></li>)}</ol>
  </div></section>;
}

export function PublicProofPoints() {
  return <ul className="public-inline-proof"><li>PSIRA-verified officers</li><li>Identity matched to the profile</li><li>Role qualifications checked</li><li>LOKD Passport at your gate</li></ul>;
}

export function PublicPage({ active, title, promise, officer = false, ctaHref, ctaLabel, visual, light = false, children }: { active?: PublicSection; eyebrow?: string; title: string; promise: string; officer?: boolean; ctaHref?: string; ctaLabel?: string; visual?: ReactNode; light?: boolean; children: ReactNode }) {
  const ongoingHref = ctaHref?.includes("?") ? ctaHref + "&when=ongoing" : "/book?when=ongoing";
  return <div className="public-site"><PublicHeader active={active} /><main id="main-content" tabIndex={-1}>
    <section className={"page-hero" + (light ? " page-hero--light" : "") + (visual ? "" : " page-hero--compact")}><div className="page-hero-inner">
      <div>
        <h1>{title}</h1>
        <p className="t-lead">{promise}</p>
        <div className="site-actions"><Link className="btn btn--red" href={ctaHref ?? (officer ? "/join" : "/book")}>{ctaLabel ?? (officer ? "Apply as an officer" : "Book officers")}</Link>{ctaHref && <Link className={"btn " + (light ? "btn--line" : "btn--line-light")} href={ongoingHref}>Ongoing cover</Link>}</div>
        {!ctaHref && <PublicProofPoints />}
      </div>
      {visual && <div className="page-hero-visual">{visual}</div>}
    </div></section>
    {children}
  </main><PublicFooter /></div>;
}
