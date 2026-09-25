import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter, PublicHeader, PublicLaunchBar } from "../components/public-site-shell";
import { ServiceJsonLd } from "../components/seo-json-ld";
import { indicativeSingleShiftPrice, specialistProfiles, type SpecialistServiceCode } from "../lib/specialist-pricing";

export const metadata: Metadata = {
  title: "VIP Protection and Protective Drivers South Africa",
  description: "Assessed VIP protection in South Africa: unarmed or armed close protection, protective drivers, vehicles and protective teams with controlled planning and advance funding.",
  alternates: { canonical: "/vip-protection" },
};

function money(cents: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(cents / 100);
}

const vipCodes: SpecialistServiceCode[] = ["vip_unarmed", "vip_armed", "vip_protective_driver", "vip_team"];

export default function VipProtectionPage() {
  const opening = indicativeSingleShiftPrice("vip_unarmed");
  return <main className="public-home marketing-page specialist-public-page">
    <ServiceJsonLd name="VIP Protection Services in South Africa" description="Controlled close protection, protective drivers and protective teams for assessed South Africa assignments." path="/vip-protection" />
    <PublicLaunchBar /><PublicHeader active="services" />
    <section className="marketing-hero marketing-hero--dark specialist-hero vip-hero"><div><p className="public-kicker"><i /> VIP protection · South Africa</p><h1>Protection built around<br /><span>the person and movement.</span></h1><p>LOKD prices VIP work as a protection operation—not a generic hourly guard. Threat, itinerary, team role, planning, travel, vehicle, accommodation, working time and command ownership are assessed separately.</p><div className="public-hero-actions"><Link className="public-button public-button--lime" href="/contact">Request a protection assessment <b>→</b></Link><Link className="public-button public-button--outline" href="/armed-security">Explore Armed security <b>→</b></Link></div></div><aside className="specialist-price-card"><span>INDICATIVE STARTING PRICE</span><strong>{money(opening.totalCents)}</strong><small>No VAT charged · unarmed specialist · ordinary single shift · minimum planning · no vehicle</small><dl><div><dt>Threat review</dt><dd>Required</dd></div><div><dt>Advance funding</dt><dd>100% cleared</dd></div><div><dt>Deployment</dt><dd>After approval</dd></div></dl></aside></section>

    <section className="marketing-section"><header><p className="public-kicker">Choose the operating requirement</p><h2>Four models, each with its own floor.</h2><p>These are planning indications, not instant-booking promises. Operations confirms the final team and cost evidence before any payment request is released.</p></header><div className="vip-model-grid">{vipCodes.map((code, index) => { const profile = specialistProfiles[code]; const price = indicativeSingleShiftPrice(code); return <article key={code}><span>0{index + 1}</span><h3>{profile.label}</h3><p>{profile.description}</p><strong>From {money(price.totalCents)} · no VAT charged</strong><small>{profile.minimumTeamSize} operator{profile.minimumTeamSize === 1 ? "" : "s"} · minimum planning · ordinary single shift</small></article>; })}</div></section>

    <section className="pricing-anatomy-section vip-pricing-anatomy"><div><p className="public-kicker">VIP pricing inputs</p><h2>The itinerary changes the cost.</h2><p>Your quote reflects the team, itinerary, travel and planning needed for the assignment. Confirm the full scope before accepting.</p></div><ol><li><span>01</span><strong>Protection role</strong><small>Unarmed, Armed, protective driver or coordinated team</small></li><li><span>02</span><strong>Team size</strong><small>One to six role-matched operators</small></li><li><span>03</span><strong>Threat &amp; planning</strong><small>Risk band and mandatory advance planning hours</small></li><li><span>04</span><strong>Movement inputs</strong><small>Distance, vehicle class, handovers and overnight person-days</small></li><li><span>05</span><strong>Final quote</strong><small>Agreed scope and full total</small></li></ol></section>

    <section className="marketing-split marketing-split--lime"><div><p className="public-kicker">Protective readiness</p><h2>One qualification does not cover every role.</h2><p>A close-protection specialist, Armed protector and protective driver require different current evidence. The assignment also needs an approved threat and movement plan that remains valid through the service window.</p></div><div className="marketing-check-list"><p>Verified identity and current PSiRA status</p><p>Protective Operations qualification</p><p>Role-specific Armed or driving evidence</p><p>Current first-aid readiness</p><p>Named itinerary and command owner</p><p>Fatigue, relief and working-time checks</p></div></section>

    <section className="marketing-section marketing-section--dark"><header><p className="public-kicker">Commercial boundary</p><h2>No withdrawal against a pending client payment.</h2><p>LOKD requires the full approved service period to clear before matching or deployment. Officer earnings remain separate: completed work moves from awaiting approval to available for withdrawal only after attendance and payroll controls pass.</p></header><div className="marketing-rule-row"><span>Plan approved</span><b>→</b><span>Total funded</span><b>→</b><span>Team eligible</span><b>→</b><span>Service evidenced</span></div></section>
    <section className="marketing-cta"><p className="public-kicker">Plan before movement</p><h2>Share the operating window through the controlled enquiry route.</h2><Link className="public-button public-button--dark" href="/contact">Request a VIP protection plan <b>→</b></Link></section>
    <PublicFooter />
  </main>;
}
