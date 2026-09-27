import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter, PublicHeader, PublicLaunchBar } from "../../components/public-site-shell";
import { ServiceJsonLd } from "../../components/seo-json-ld";

export const metadata: Metadata = {
  title: "Security Guarding Company in Johannesburg",
  description: "Unarmed guarding, armed protection and VIP security services for assessed Johannesburg assignments.",
  alternates: { canonical: "/locations/johannesburg" },
};

export default function JohannesburgPage() {
  return <main className="public-home marketing-page"><ServiceJsonLd name="Johannesburg Security Services" description="Unarmed, armed and VIP protection services for assessed Johannesburg assignments." path="/locations/johannesburg" /><PublicLaunchBar /><PublicHeader active="services" />
    <section className="marketing-hero marketing-hero--location"><div><p className="public-kicker"><i /> Johannesburg, Gauteng</p><h1>Security for Johannesburg.<br /><span>Planned for your location.</span></h1><p>Tell us about your Johannesburg site or movement. We assess the location, operating hours, travel, specialist needs and local capacity before confirming service.</p><div className="public-hero-actions"><Link className="public-button public-button--lime" href="/contact">Check my Johannesburg requirement <b>→</b></Link></div></div><aside className="location-panel"><span>LOCAL SERVICE ASSESSMENT</span><h2>Johannesburg</h2><p>Each enquiry is assessed against the address or movement, mobilisation window, operating hours, travel assumptions and available role-qualified roster. “In Gauteng” does not automatically mean accepted.</p><dl><div><dt>Time zone</dt><dd>SAST</dd></div><div><dt>Services</dt><dd>Unarmed · Armed · VIP</dd></div><div><dt>Mobilisation</dt><dd>Assessment first</dd></div></dl></aside></section>
    <section className="marketing-section"><header><p className="public-kicker">Planning local coverage</p><h2>Coverage quality depends on more than recruitment.</h2></header><div className="marketing-card-grid"><article><span>01</span><h3>Travel is tested</h3><p>Roster decisions account for the site, shift start, declared availability and a realistic travel window.</p></article><article><span>02</span><h3>Relief is planned</h3><p>A dependable post needs eligible replacement capacity, not an improvised substitution after a missed check-in.</p></article><article><span>03</span><h3>Supervision stays reachable</h3><p>A focused area supports Operations review, escalation ownership and site-specific follow-up.</p></article><article><span>04</span><h3>Readiness comes first</h3><p>Officer readiness and a service plan are part of every assignment.</p></article></div></section>
    <section className="marketing-split marketing-split--lime"><div><p className="public-kicker">Suitable first conversations</p><h2>Planned protection with a clear operating need.</h2><p>Commercial property, logistics, industrial, high-value retail and executive movement may fit after assessment. Immediate or uncontrolled high-risk requests are never accepted through an instant-booking route.</p></div><div className="marketing-check-list"><p>Johannesburg site or movement area</p><p>Planned start and operating window</p><p>Required service and team roles</p><p>Authorised client contacts</p><p>Known threats, risks and incidents</p></div></section>
    <section className="marketing-cta"><p className="public-kicker">Is your site in scope?</p><h2>Send the brief before you assume the answer.</h2><Link className="public-button public-button--dark" href="/contact">Start a Johannesburg site review <b>→</b></Link></section><PublicFooter />
  </main>;
}
