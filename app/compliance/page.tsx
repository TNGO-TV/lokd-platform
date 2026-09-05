import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter, PublicHeader, PublicLaunchBar } from "../components/public-site-shell";

export const metadata: Metadata = { title: "Security Compliance and Operating Controls", description: "How LOKD gates registration, officer readiness, funding, payroll approval, deployment and service evidence in its Johannesburg launch.", alternates: { canonical: "/compliance" } };

const gates = [
  ["Provider readiness", "Required company, management, insurance and control-room evidence must be current before a production service can activate."],
  ["Officer readiness", "Identity, PSiRA status and grade, applicable training, purpose fit, site induction, schedule, rest and Passport evidence are checked independently."],
  ["Client funding", "Credit terms are fixed at zero. The approved service amount must clear and reconcile before matching, an offer or deployment."],
  ["Payroll controls", "Approved work is calculated under a versioned policy. Distinct maker, reviewer and finance approval apply; Version 29 settlement is database-locked."],
  ["Operational evidence", "Arrival, check-in, incidents, relief, timesheets, disputes and service review remain bound to the authorised site and shift."],
  ["Privacy boundary", "Client verification exposes only the minimum approved readiness result, not private identity, banking or credential documents."],
];

export default function CompliancePage() {
  return <main className="public-home marketing-page"><PublicLaunchBar /><PublicHeader active="about" />
    <section className="marketing-hero"><div><p className="public-kicker"><i /> Compliance by design</p><h1>A status label is never <span>enough evidence.</span></h1><p>LOKD separates the facts that authorise a service: provider readiness, client approval, cleared funding, officer eligibility, roster controls, payroll policy and operational proof. One green flag cannot stand in for another.</p><div className="public-hero-actions"><Link className="public-button public-button--dark" href="/clients">See the client controls <b>→</b></Link></div></div><aside className="marketing-control-card marketing-control-card--light"><span>FAIL-CLOSED PRINCIPLE</span><h2>Missing, expired or conflicting evidence blocks the action.</h2><p>Urgency, availability or a reported status cannot override a required gate. Production activation remains separately authorised.</p></aside></section>
    <section className="marketing-section"><header><p className="public-kicker">Control register</p><h2>Six boundaries the platform keeps separate.</h2></header><div className="compliance-grid">{gates.map(([title,text],index) => <article key={title}><span>{String(index+1).padStart(2,"0")}</span><h2>{title}</h2><p>{text}</p></article>)}</div></section>
    <section className="marketing-split marketing-split--dark"><div><p className="public-kicker">External verification</p><h2>Clients should verify security providers and officers.</h2><p>PSiRA provides official registration and consumer-verification services. LOKD&apos;s Passport is designed to add assignment-specific readiness without replacing the regulator&apos;s records or exposing private documents.</p></div><div className="marketing-link-list"><a href="https://www.psira.co.za/" target="_blank" rel="noreferrer"><strong>PSiRA</strong><span>Regulator and public information ↗</span></a><a href="https://digitalservices.psira.co.za/" target="_blank" rel="noreferrer"><strong>PSiRA digital services</strong><span>Official registration services ↗</span></a><Link href="/privacy"><strong>LOKD privacy notice</strong><span>Current intake and portal data ↗</span></Link></div></section>
    <section className="marketing-cta"><p className="public-kicker">Need the full workflow?</p><h2>Follow the client journey from site brief to service proof.</h2><Link className="public-button public-button--dark" href="/clients">Open the client guide <b>→</b></Link></section><PublicFooter />
  </main>;
}
