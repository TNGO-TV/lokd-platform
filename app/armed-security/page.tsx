import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter, PublicHeader, PublicLaunchBar } from "../components/public-site-shell";
import { ServiceJsonLd } from "../components/seo-json-ld";
import { indicativeSingleShiftPrice } from "../lib/specialist-pricing";

export const metadata: Metadata = {
  title: "Armed Security Services in South Africa",
  description: "Planned Armed static guarding and movement protection in South Africa with assessed risk, verified competency, controlled equipment and Operations oversight.",
  alternates: { canonical: "/armed-security" },
};

function money(cents: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(cents / 100);
}

const staticPrice = indicativeSingleShiftPrice("armed_static");
const movementPrice = indicativeSingleShiftPrice("armed_movement");

export default function ArmedSecurityPage() {
  return <main className="public-home marketing-page specialist-public-page">
    <ServiceJsonLd name="Armed Security Services in South Africa" description="Controlled Armed static guarding and planned movement protection for approved South Africa assignments." path="/armed-security" />
    <PublicLaunchBar /><PublicHeader active="services" />
    <section className="marketing-hero marketing-hero--dark specialist-hero"><div><p className="public-kicker"><i /> Armed security · South Africa</p><h1>Armed capability.<br /><span>Controlled before deployment.</span></h1><p>LOKD separates fixed-site Armed guarding from movement protection. Each assignment needs a documented risk reason, lawful provider and firearm controls, current officer evidence, approved post or movement orders and Operations ownership.</p><div className="public-hero-actions"><Link className="public-button public-button--lime" href="/contact">Request an Armed assessment <b>→</b></Link><Link className="public-button public-button--outline" href="/vip-protection">Explore VIP protection <b>→</b></Link></div></div><aside className="specialist-price-card"><span>INDICATIVE STARTING PRICE</span><strong>{money(staticPrice.totalCents)}</strong><small>No VAT charged · ordinary 12-hour static shift · one officer · minimum planning</small><dl><div><dt>Final price</dt><dd>After assessment</dd></div></dl></aside></section>

    <section className="marketing-section"><header><p className="public-kicker">Two different operating models</p><h2>Static protection is not movement work.</h2><p>The service type determines the workforce, equipment, planning, supervision and evidence that must be costed and approved.</p></header><div className="specialist-service-grid"><article><span>01 · FIXED SITE</span><h3>Armed static guarding</h3><p>A controlled Armed post at one approved site. Post orders define duties, exclusions, issue-and-return controls, escalation and supervision.</p><strong>From {money(staticPrice.totalCents)} · no VAT charged</strong><small>Ordinary single shift · final price depends on risk, calendar and roster</small></article><article><span>02 · MOVEMENT</span><h3>Armed movement protection</h3><p>A planned route, timing window and handover for valuable assets or exposed movements. This is not an armed-response subscription.</p><strong>From {money(movementPrice.totalCents)} · no VAT charged</strong><small>Client vehicle · ordinary single movement · minimum planning</small></article></div></section>

    <section className="pricing-anatomy-section"><div><p className="public-kicker">How the quote is built</p><h2>No single “guard rate” hides the real service.</h2><p>Your quote reflects the role, operating hours, equipment, planning and supervision required, with no VAT added to the final total.</p></div><ol><li><span>01</span><strong>Officer earnings</strong><small>Role-specific pay plus Sunday, holiday and risk treatment</small></li><li><span>02</span><strong>Employer burden</strong><small>UIF, PSSPF, SDL and a controlled insurance/COIDA reserve</small></li><li><span>03</span><strong>Readiness &amp; equipment</strong><small>Competency, recurring readiness and controlled equipment provision</small></li><li><span>04</span><strong>Planning &amp; command</strong><small>Risk review, post or route plan, supervision and handover</small></li><li><span>05</span><strong>Service price</strong><small>Final scope and price shown in your quote; no VAT charged</small></li></ol></section>

    <section className="marketing-split marketing-split--lime"><div><p className="public-kicker">Non-negotiable controls</p><h2>Evidence must remain current through the shift.</h2><p>An Armed interest, high PSiRA grade or previous experience never bypasses LOKD&apos;s assignment gate. If required evidence expires or a control changes, the affected offer or activation blocks.</p></div><div className="marketing-check-list"><p>Approved business and service authority</p><p>Current PSiRA and firearm competency</p><p>Monthly Armed readiness evidence</p><p>Assignment-specific risk and orders</p><p>Controlled equipment issue and return</p></div></section>

    <section className="marketing-section marketing-section--dark"><header><p className="public-kicker">Pricing boundary</p><h2>Partner and vehicle costs cannot be guessed.</h2><p>Travel, supplied vehicles, armoured partner capacity, overnight work and urgent mobilisation are priced separately. An armoured-vehicle estimate remains held for Operations review until a current supplier quote is attached; payment cannot clear against the placeholder.</p></header><div className="marketing-rule-row"><span>Risk assessed</span><b>→</b><span>Cost floor verified</span><b>→</b><span>Evidence rechecked</span></div></section>
    <section className="marketing-cta"><p className="public-kicker">Start with the risk</p><h2>Tell us what must be protected, where it moves and when.</h2><Link className="public-button public-button--dark" href="/contact">Request an Armed security plan <b>→</b></Link></section>
    <PublicFooter />
  </main>;
}
