import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter, PublicHeader, PublicLaunchBar } from "../components/public-site-shell";
import { ServiceJsonLd } from "../components/seo-json-ld";

export const metadata: Metadata = {
  title: "Unarmed Security Guarding Services",
  description: "Scheduled Unarmed fixed-site guarding in Johannesburg with site assessment, verified rosters, controlled attendance, incident handling and service records.",
  alternates: { canonical: "/security-services" },
};

const controls = [
  ["01", "Assess the site", "We record the risk, access points, operating hours, incidents, people and outcome before defining the post."],
  ["02", "Approve the post", "Duties, exclusions, escalation contacts, hours, equipment and reporting are agreed in controlled post orders."],
  ["03", "Build an eligible roster", "Identity, PSiRA status, grade, training, site induction, Passport, rest and schedule evidence must all pass."],
  ["04", "Operate and prove", "Attendance, relief, incidents, exceptions and client review remain connected to the exact service record."],
];

export default function SecurityServicesPage() {
  return <main className="public-home marketing-page">
    <ServiceJsonLd name="Scheduled Unarmed Security Guarding" description="A controlled fixed-site security service for approved Johannesburg sites." path="/security-services" />
    <PublicLaunchBar /><PublicHeader active="services" />
    <section className="marketing-hero marketing-hero--dark"><div><p className="public-kicker"><i /> Scheduled Unarmed guarding</p><h1>A managed security post.<br /><span>Not an anonymous guard hour.</span></h1><p>LOKD combines the officer with the controls around the work: a clear risk brief, approved post orders, verified eligibility, Operations supervision, relief planning and evidence of service.</p><div className="public-hero-actions"><Link className="public-button public-button--lime" href="/contact">Request a site assessment <b>→</b></Link><Link className="public-button public-button--outline" href="/clients">Read the client guide <b>→</b></Link></div></div><aside className="marketing-control-card"><span>PHASE 1 SERVICE</span><h2>Scheduled fixed-site guarding</h2><dl><div><dt>Service</dt><dd>Unarmed</dd></div><div><dt>Area</dt><dd>Johannesburg launch zone</dd></div><div><dt>Funding</dt><dd>Cleared in advance</dd></div><div><dt>Control</dt><dd>Operations-managed</dd></div></dl><p>Armed, VIP, immediate dispatch and high-risk work are not offered in the first controlled phase.</p></aside></section>

    <section className="marketing-section"><header><p className="public-kicker">The operating model</p><h2>Four controls before service becomes a promise.</h2><p>An enquiry can progress only when LOKD can define the job, control the risk and support the roster properly.</p></header><div className="marketing-card-grid">{controls.map(([number,title,text]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section>

    <section className="marketing-split marketing-split--lime"><div><p className="public-kicker">Typical Phase 1 duties</p><h2>Clear duties make a stronger post.</h2><p>The approved scope may include visible presence, visitor and delivery logging, access-control support, patrol observations, keys, alarms, hazards and immediate escalation. The client cannot expand duties informally during a shift.</p></div><div className="marketing-check-list"><p>Visible security presence</p><p>Access and visitor controls</p><p>Patrol and observation routines</p><p>Incident reporting and escalation</p><p>Relief and continuity planning</p><p>Client service evidence</p></div></section>

    <section className="marketing-section marketing-section--dark"><header><p className="public-kicker">Commercial boundary</p><h2>No credit terms. No uncontrolled deployment.</h2><p>The approved quotation and service period must be fully funded with cleared, reconciled payment before an officer offer is released or a deployment is activated. LOKD does not finance a client&apos;s security service.</p></header><div className="marketing-rule-row"><span>Risk approved</span><b>→</b><span>Scope agreed</span><b>→</b><span>Funding cleared</span><b>→</b><span>Roster eligible</span></div></section>

    <section className="marketing-cta"><p className="public-kicker">Start with the site</p><h2>Tell us what must be protected and when.</h2><Link className="public-button public-button--dark" href="/contact">Request a security plan <b>→</b></Link></section>
    <PublicFooter />
  </main>;
}
