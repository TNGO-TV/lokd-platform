import type { Metadata } from "next";
import ClientEnquiryForm from "../components/client-enquiry-form";
import { PublicFooter, PublicHeader, PublicLaunchBar } from "../components/public-site-shell";

export const metadata: Metadata = { title: "Contact LOKD Security", description: "Request a controlled assessment for Unarmed, Armed or VIP protection services in Johannesburg.", alternates: { canonical: "/contact" } };

export default function ContactPage() {
  return <main className="public-home marketing-page"><PublicLaunchBar /><PublicHeader active="contact" />
    <section className="contact-layout"><div className="contact-intro"><p className="public-kicker"><i /> Johannesburg launch enquiries</p><h1>Start with a truthful operating brief.</h1><p>LOKD reviews planned Unarmed, Armed and VIP requirements in Johannesburg. Specialist enquiries are welcome, but no request bypasses service authority, competency, evidence, partner or Operations controls.</p><div className="contact-facts"><article><span>01</span><strong>We assess before quoting</strong><p>The site or movement, duties, threat, mobilisation and roster capacity must fit.</p></article><article><span>02</span><strong>No credit terms</strong><p>The full VAT-inclusive amount must clear before matching or deployment.</p></article><article><span>03</span><strong>No instant booking</strong><p>An enquiry does not bypass regulatory, employment or operating gates.</p></article></div></div><ClientEnquiryForm /></section>
    <PublicFooter />
  </main>;
}
