import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter, PublicHeader, PublicLaunchBar } from "../components/public-site-shell";

export const metadata: Metadata = {
  title: "Security Guarding for Johannesburg Sites",
  description: "LOKD plans controlled Unarmed guarding, Armed protection and VIP security for assessed commercial, logistics, industrial and specialist requirements in Johannesburg.",
  alternates: { canonical: "/industries" },
};

const industries = [
  ["Commercial property", "Reception interfaces, staff and visitor access, keys, after-hours routines and escalation need a post-specific operating plan.", "Potential Phase 1 fit"],
  ["Logistics and industrial", "Vehicle movement, loading areas, perimeter observations, contractor access and shift handovers require disciplined records.", "Potential Phase 1 fit"],
  ["Construction", "Changing access, tools, materials, subcontractors and site hazards require current post orders and induction evidence.", "Potential Phase 1 fit after review"],
  ["Residential estates", "Visitor controls, resident expectations, deliveries and emergency escalation require clear authority and privacy boundaries.", "Case-by-case review"],
  ["Schools and education", "Safeguarding exposure and child-sensitive conduct require enhanced review, communication and tightly bounded duties.", "Enhanced review"],
  ["High-value retail", "Robbery exposure and valuable stock may require separately assessed Armed static or movement protection, with current authority and equipment evidence.", "Specialist review required"],
];

export default function IndustriesPage() {
  return <main className="public-home marketing-page"><PublicLaunchBar /><PublicHeader active="industries" />
    <section className="marketing-hero"><div><p className="public-kicker"><i /> Different sites, different preparation</p><h1>Security designed around <span>the actual requirement.</span></h1><p>One service label never describes the whole job. The people, assets, movement, access patterns, hazards and escalation duties determine the role, readiness, supervision and evidence required.</p><div className="public-hero-actions"><Link className="public-button public-button--dark" href="/contact">Discuss my site <b>→</b></Link><Link className="public-button public-button--outline-dark" href="/security-services">See the service <b>→</b></Link></div></div><aside className="marketing-quote-card"><span>THE LOKD QUESTION</span><blockquote>What must this assignment achieve—and what must never be left to assumption?</blockquote><p>The answer shapes duties, officer readiness, roster capacity, supervision, escalation and price.</p></aside></section>
    <section className="marketing-section"><header><p className="public-kicker">Industries and environments</p><h2>Service fit is decided by risk, not a label.</h2><p>These are planning categories, not automatic acceptance. LOKD may add controls, require a specialist model, narrow the scope, extend mobilisation or decline work it cannot control properly.</p></header><div className="industry-grid">{industries.map(([title,text,status],index) => <article key={title}><span>{String(index+1).padStart(2,"0")}</span><h2>{title}</h2><p>{text}</p><em>{status}</em></article>)}</div></section>
    <section className="marketing-split marketing-split--dark"><div><p className="public-kicker">What changes by site</p><h2>The post order is where the promise becomes specific.</h2><p>LOKD records who may instruct the officer, access rules, patrol points, prohibited duties, escalation contacts, emergency actions, evidence expectations and relief arrangements.</p></div><div className="marketing-check-list"><p>Public and visitor exposure</p><p>Operating hours and lone work</p><p>Asset value and loss history</p><p>Entrances, perimeter and systems</p><p>Hazards and emergency response</p><p>Continuity and replacement needs</p></div></section>
    <section className="marketing-cta"><p className="public-kicker">Johannesburg launch</p><h2>Let the site brief determine the next step.</h2><Link className="public-button public-button--dark" href="/contact">Request a fit review <b>→</b></Link></section><PublicFooter />
  </main>;
}
