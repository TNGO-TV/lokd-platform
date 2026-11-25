import Link from "next/link";
import ClientEnquiryForm from "../components/client-enquiry-form";
import { PublicPage } from "../components/public-site-shell";
import { publicMetadata, BOOKINGS_EMAIL, QUOTES_EMAIL, INVOICE_EMAIL, VERIFICATION_EMAIL } from "../lib/public-site";

import "../styles/booking.css";

export const metadata = publicMetadata("Contact LOKD Security", "Contact LOKD about on-demand security, ongoing contract cover or certified training. Share your requirements with the right team.", "/contact");
const channels: [string, string][] = [
  ["Quotes and sales", QUOTES_EMAIL], ["Bookings", BOOKINGS_EMAIL],
  ["Accounts and support", INVOICE_EMAIL],
  ["Officer verification", VERIFICATION_EMAIL],
];

export default function ContactPage() {
  return <PublicPage active="contact" title="Let’s plan your next step." promise="Book officers for your site, discuss an ongoing roster or enquire about training. LOKD serves Johannesburg and its surrounds; arrival time depends on your location." ctaHref="/book" ctaLabel="Book officers" light>
    <section className="public-contact-layout" id="enquiry" aria-label="Contact the LOKD team">
      <aside>
        <div><h2>Contact LOKD</h2><p className="t-soft">For a new booking, use the booking form. For a detailed site brief or a question, send an enquiry or email the right team.</p></div>
        <div className="site-contact-channels">{channels.map(([label, email]) => <a key={label} href={"mailto:" + email}><strong>{label}</strong><small>{email}</small></a>)}<Link href="/training#training-booking"><strong>Training</strong><small>Book now</small></Link></div>
        <div><h2>Looking for security work?</h2><p className="t-soft">Find the right pathway for registered officers, renewals and new applications.</p><p style={{ marginTop: 18 }}><Link className="site-arrow-link" href="/officers">Explore officer pathways</Link></p></div>
      </aside>
      <ClientEnquiryForm />
    </section>
  </PublicPage>;
}
