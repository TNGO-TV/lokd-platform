import Link from "next/link";
import ClientEnquiryForm from "../components/client-enquiry-form";
import { PublicHeader, PublicFooter, PublicProofPoints } from "../components/public-site-shell";
import { publicMetadata, BOOKINGS_EMAIL, QUOTES_EMAIL, INVOICE_EMAIL } from "../lib/public-site";
export const metadata = publicMetadata("Contact LOKD Security", "Talk to LOKD about security cover in Johannesburg. Send your service requirements, dates and contact details to get a quote.", "/contact");
export default function ContactPage() {
  return <div className="public-site"><PublicHeader active="contact" /><main id="main-content" tabIndex={-1}>
    <section className="public-page-hero"><p className="public-kicker">Contact LOKD</p><h1>Let’s talk about your cover.</h1><p>Tell us what you need protected in Johannesburg and we will help you plan the next step.</p><a className="public-button public-button--primary" href="#enquiry">Get a quote <span aria-hidden="true">↗</span></a></section>
    <section className="public-proof-section" aria-label="The LOKD promise"><PublicProofPoints /></section>
    <section className="public-contact-layout" id="enquiry"><aside><h2>Speak to the right team.</h2><dl className="public-contact-details"><dt>Quotes</dt><dd><a href={"mailto:" + QUOTES_EMAIL}>{QUOTES_EMAIL}</a></dd><dt>Bookings and enquiries</dt><dd><a href={"mailto:" + BOOKINGS_EMAIL}>{BOOKINGS_EMAIL}</a></dd><dt>Invoices</dt><dd><a href={"mailto:" + INVOICE_EMAIL}>{INVOICE_EMAIL}</a></dd></dl><h2>Looking for security work?</h2><p>Send your officer application through our application form.</p><Link className="public-text-link" href="/join">Apply as an officer →</Link></aside><ClientEnquiryForm /></section>
  </main><PublicFooter /></div>;
}
