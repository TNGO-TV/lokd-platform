import type { Metadata } from "next";
import ClientEnquiryForm from "../components/client-enquiry-form";
import { PublicFooter, PublicHeader, PublicLaunchBar } from "../components/public-site-shell";

export const metadata: Metadata = { title: "Contact LOKD Security", description: "Request a controlled site review for scheduled Unarmed fixed-site security in Johannesburg.", alternates: { canonical: "/contact" } };

export default function ContactPage() {
  return <main className="public-home marketing-page"><PublicLaunchBar /><PublicHeader active="contact" />
    <section className="contact-layout"><div className="contact-intro"><p className="public-kicker"><i /> Johannesburg launch enquiries</p><h1>Start with a truthful site brief.</h1><p>LOKD is reviewing planned, scheduled Unarmed fixed-site posts in its Johannesburg launch area. We do not accept Armed, VIP, immediate-dispatch or uncontrolled high-risk work in Phase 1.</p><div className="contact-facts"><article><span>01</span><strong>We assess before quoting</strong><p>The site, duties, risk, mobilisation and roster capacity must fit.</p></article><article><span>02</span><strong>No credit terms</strong><p>Cleared advance funding is required before matching or deployment.</p></article><article><span>03</span><strong>No instant booking</strong><p>An enquiry does not bypass regulatory, employment or operating gates.</p></article></div></div><ClientEnquiryForm /></section>
    <PublicFooter />
  </main>;
}
