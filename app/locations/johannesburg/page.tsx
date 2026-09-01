import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter, PublicHeader, PublicLaunchBar } from "../../components/public-site-shell";
import { ServiceJsonLd } from "../../components/seo-json-ld";

export const metadata: Metadata = {
  title: "Security Guarding Company in Johannesburg",
  description: "Controlled scheduled Unarmed guarding for approved Johannesburg commercial, industrial, logistics and construction sites.",
  alternates: { canonical: "/locations/johannesburg" },
};

export default function JohannesburgPage() {
  return <main className="public-home marketing-page"><ServiceJsonLd name="Johannesburg Scheduled Unarmed Security Guarding" description="Controlled fixed-site security guarding for approved Johannesburg sites." path="/locations/johannesburg" /><PublicLaunchBar /><PublicHeader active="services" />
    <section className="marketing-hero marketing-hero--location"><div><p className="public-kicker"><i /> Johannesburg, Gauteng</p><h1>Build local density.<br /><span>Protect service continuity.</span></h1><p>LOKD&apos;s first operating area is intentionally narrow. Concentrating approved sites, officers and relief capacity in Johannesburg supports realistic travel, supervision and replacement planning.</p><div className="public-hero-actions"><Link className="public-button public-button--lime" href="/contact">Check my Johannesburg site <b>→</b></Link></div></div><aside className="location-panel"><span>CONTROLLED LAUNCH ZONE</span><h2>Johannesburg first</h2><p>Each enquiry is assessed against the actual address, mobilisation window, operating hours, travel assumptions and available roster capacity. “In Gauteng” does not automatically mean accepted.</p><dl><div><dt>Time zone</dt><dd>SAST</dd></div><div><dt>Service</dt><dd>Scheduled Unarmed</dd></div><div><dt>Mobilisation</dt><dd>Planned, not immediate</dd></div></dl></aside></section>
    <section className="marketing-section"><header><p className="public-kicker">Why the launch area matters</p><h2>Coverage quality depends on more than recruitment.</h2></header><div className="marketing-card-grid"><article><span>01</span><h3>Travel is tested</h3><p>Roster decisions account for the site, shift start, declared availability and a realistic travel window.</p></article><article><span>02</span><h3>Relief is planned</h3><p>A dependable post needs eligible replacement capacity, not an improvised substitution after a missed check-in.</p></article><article><span>03</span><h3>Supervision stays reachable</h3><p>A focused area supports Operations review, escalation ownership and site-specific follow-up.</p></article><article><span>04</span><h3>Growth follows evidence</h3><p>LOKD expands only after the employment, coverage, service and control standard is proven.</p></article></div></section>
    <section className="marketing-split marketing-split--lime"><div><p className="public-kicker">Suitable first conversations</p><h2>Planned fixed-site posts with a clear operating need.</h2><p>Commercial property, logistics, industrial and selected construction environments may fit after site review. Armed, VIP, high-risk and immediate-dispatch requests remain outside Phase 1.</p></div><div className="marketing-check-list"><p>Johannesburg site address</p><p>Planned start window</p><p>Defined operating hours</p><p>Authorised site contacts</p><p>Known risks and incidents</p><p>Advance-funding readiness</p></div></section>
    <section className="marketing-cta"><p className="public-kicker">Is your site in scope?</p><h2>Send the brief before you assume the answer.</h2><Link className="public-button public-button--dark" href="/contact">Start a Johannesburg site review <b>→</b></Link></section><PublicFooter />
  </main>;
}
