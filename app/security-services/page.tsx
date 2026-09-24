import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter, PublicHeader, PublicLaunchBar } from "../components/public-site-shell";
import { ServiceJsonLd } from "../components/seo-json-ld";
import { indicativeSingleShiftPrice } from "../lib/specialist-pricing";

export const metadata: Metadata = {
  title: "Security Services in South Africa",
  description: "Controlled Unarmed guarding, Armed site and movement protection, and VIP protection services in South Africa with verified readiness and advance funding.",
  alternates: { canonical: "/security-services" },
};

const controls = [
  ["01", "Assess the site", "We record the risk, access points, operating hours, incidents, people and outcome before defining the post."],
  ["02", "Approve the post", "Duties, exclusions, escalation contacts, hours, equipment and reporting are agreed in controlled post orders."],
  ["03", "Build an eligible roster", "Identity, PSiRA status, grade, training, site induction, Passport, rest and schedule evidence must all pass."],
  ["04", "Operate and prove", "Attendance, relief, incidents, exceptions and client review remain connected to the exact service record."],
];

function money(cents: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(cents / 100);
}

export default function SecurityServicesPage() {
  return <main className="public-home marketing-page">
    <ServiceJsonLd name="LOKD Security Services" description="Controlled Unarmed, Armed and VIP protection services for approved South Africa assignments." path="/security-services" />
    <PublicLaunchBar /><PublicHeader active="services" />
    <section className="marketing-hero marketing-hero--dark"><div><p className="public-kicker"><i /> Security matched to the assessed risk</p><h1>A managed protection service.<br /><span>Not an anonymous guard hour.</span></h1><p>LOKD combines the officer with the controls around the work: a clear risk brief, approved orders, verified role eligibility, Operations supervision, relief planning and evidence of service.</p><div className="public-hero-actions"><Link className="public-button public-button--lime" href="/contact">Request an assessment <b>→</b></Link><Link className="public-button public-button--outline" href="/clients">Read the client guide <b>→</b></Link></div></div><aside className="marketing-control-card"><span>CONTROLLED SERVICE RANGE</span><h2>Unarmed · Armed · VIP</h2><dl><div><dt>Area</dt><dd>Assessed nationwide</dd></div><div><dt>Pricing</dt><dd>Quoted after assessment</dd></div><div><dt>Funding</dt><dd>VAT total in advance</dd></div><div><dt>Control</dt><dd>Operations-managed</dd></div></dl><p>Specialist work remains subject to service-specific regulatory, competency, equipment, partner and operational evidence.</p></aside></section>

    <section className="marketing-section"><header><p className="public-kicker">Service portfolio</p><h2>Three categories. Seven controlled models.</h2><p>Starting figures are VAT-inclusive planning indications for an ordinary single shift. Site, risk, calendar, team, movement and supplier inputs determine the final approved quote.</p></header><div className="service-portfolio-grid"><article><span>UNARMED</span><h3>Scheduled fixed-site guarding</h3><p>Access, patrol, observation and reporting against approved post orders.</p><strong>From {money(indicativeSingleShiftPrice("standard_unarmed").totalCents)}</strong><Link href="/clients">Client model →</Link></article><article><span>ARMED</span><h3>Site &amp; movement protection</h3><p>Separate static and movement models with Armed evidence and equipment controls.</p><strong>From {money(indicativeSingleShiftPrice("armed_static").totalCents)}</strong><Link href="/armed-security">Armed services →</Link></article><article><span>VIP</span><h3>Close protection &amp; drivers</h3><p>Unarmed or Armed protection, protective driving and coordinated teams.</p><strong>From {money(indicativeSingleShiftPrice("vip_unarmed").totalCents)}</strong><Link href="/vip-protection">VIP protection →</Link></article></div></section>

    <section className="marketing-section"><header><p className="public-kicker">The operating model</p><h2>Four controls before service becomes a promise.</h2><p>An enquiry can progress only when LOKD can define the job, control the risk and support the roster properly.</p></header><div className="marketing-card-grid">{controls.map(([number,title,text]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section>

    <section className="marketing-split marketing-split--lime"><div><p className="public-kicker">Scope discipline</p><h2>Clear duties make a stronger service.</h2><p>Every fixed post, movement or protection detail is governed by its approved orders. A client cannot expand duties, change a route or add an Armed requirement informally during a shift.</p></div><div className="marketing-check-list"><p>Defined outcome and exclusions</p><p>Site, route or itinerary controls</p><p>Role-matched officer readiness</p><p>Incident reporting and escalation</p><p>Relief and continuity planning</p><p>Client service evidence</p></div></section>

    <section className="marketing-section marketing-section--dark"><header><p className="public-kicker">Commercial boundary</p><h2>No credit terms. No uncontrolled deployment.</h2><p>The complete VAT-inclusive quotation and service period must be fully funded with cleared, reconciled payment before an officer offer is released or a deployment is activated. LOKD does not finance a client&apos;s security service.</p></header><div className="marketing-rule-row"><span>Risk approved</span><b>→</b><span>Quote accepted</span><b>→</b><span>Funding cleared</span><b>→</b><span>Roster eligible</span></div></section>

    <section className="marketing-cta"><p className="public-kicker">Start with the site</p><h2>Tell us what must be protected and when.</h2><Link className="public-button public-button--dark" href="/contact">Request a security plan <b>→</b></Link></section>
    <PublicFooter />
  </main>;
}
