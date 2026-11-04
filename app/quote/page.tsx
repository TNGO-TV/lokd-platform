import ClientEnquiryForm from "../components/client-enquiry-form";
import { PublicHeader, PublicFooter, PublicProofPoints } from "../components/public-site-shell";
import { publicMetadata } from "../lib/public-site";
export const metadata = publicMetadata("Get a security quote", "Request guarding, armed security or VIP protection in Johannesburg. Share your site, dates, hours and number of officers for a clear LOKD quote.", "/quote");
export default function QuotePage() {
  return <div className="public-site"><PublicHeader active="contact" /><main id="main-content" tabIndex={-1}>
    <section className="public-page-hero"><p className="public-kicker">Your next step</p><h1>Get a quote for your cover.</h1><p>Share your site, dates and security requirements for a quote that fits the job.</p><a className="public-button public-button--primary" href="#quote-form">Get a quote <span aria-hidden="true">↗</span></a></section>
    <section className="public-proof-section" aria-label="The LOKD promise"><PublicProofPoints /></section>
    <section className="public-form-section" id="quote-form"><ClientEnquiryForm /></section>
  </main><PublicFooter /></div>;
}
