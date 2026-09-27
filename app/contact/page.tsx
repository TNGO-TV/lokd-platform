import type { Metadata } from "next";
import ClientEnquiryForm from "../components/client-enquiry-form";
import { PublicFooter, PublicHeader, PublicLaunchBar } from "../components/public-site-shell";
import { COMPANY_NAME, HEAD_OFFICE_ADDRESS, TRAINING_CENTRES, BOOKINGS_EMAIL, QUOTES_EMAIL, INVOICE_EMAIL } from "../lib/public-site";

export const metadata: Metadata = { title: "Contact LOKD Security", description: "Contact LOKD Security (Pty) Ltd for unarmed guarding, armed security and VIP protection enquiries across South Africa.", alternates: { canonical: "/contact" } };

export default function ContactPage() {
  return <main className="public-home marketing-page"><PublicLaunchBar /><PublicHeader active="contact" />
    <section className="contact-layout"><div className="contact-intro"><p className="public-kicker">Security enquiries across South Africa</p><h1>Tell us what you need protected.</h1><p>Share your location, security needs and preferred dates. We assess local availability and the requirements for your site or movement before preparing a quote.</p><div className="contact-facts"><article><span>01</span><strong>A plan for your requirements</strong><p>We review the location, duties, hours and risk before quoting.</p></article><article><span>02</span><strong>Clear terms before you accept</strong><p>Your quote sets out the scope, price and linked terms and conditions.</p></article><article><span>03</span><strong>Confirmed before deployment</strong><p>Service starts after Operations confirms the plan and readiness checks.</p></article></div>
      <div className="contact-company"><h2>{COMPANY_NAME}</h2><address><strong>Head Office</strong><br />{HEAD_OFFICE_ADDRESS}</address><p>Bookings &amp; general enquiries<br /><a href={`mailto:${BOOKINGS_EMAIL}`}>{BOOKINGS_EMAIL}</a></p><p>Quotes<br /><a href={`mailto:${QUOTES_EMAIL}`}>{QUOTES_EMAIL}</a></p><p>Invoices<br /><a href={`mailto:${INVOICE_EMAIL}`}>{INVOICE_EMAIL}</a></p><p><strong>Training centres opening soon</strong><br />{TRAINING_CENTRES.join(", ")}</p></div>
    </div><ClientEnquiryForm /></section><PublicFooter />
  </main>;
}
