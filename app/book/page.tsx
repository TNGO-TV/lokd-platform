import ClientEnquiryForm from "../components/client-enquiry-form";
import { PublicHeader, PublicFooter, PublicProofPoints } from "../components/public-site-shell";
import { Icon } from "../components/icons";
import { publicMetadata } from "../lib/public-site";
import "../styles/booking.css";

export const metadata = publicMetadata("Request security cover", "Request PSIRA-verified officers in Johannesburg. Choose urgent LOKD Bolt, temporary LOKD Flex or ongoing LOKD Fixed cover. Operations confirms your officers and price.", "/book");

export default function BookPage() {
  return <div className="public-site booking-page"><PublicHeader active="contact" /><main id="main-content" tabIndex={-1}>
    <section className="public-page-hero booking-hero"><p className="public-kicker">LOKD Bolt · LOKD Flex · LOKD Fixed</p><h1>Book the cover you need.</h1><p>Need urgent cover, temporary cover for 7+ days in a calendar month, or an ongoing roster for at least three months? Send your requirements to LOKD Operations.</p><a className="public-button public-button--primary" href="#booking-form">Start your booking request <Icon name="arrowUpRight" size={20} /></a></section>
    <section className="public-proof-section" aria-label="The LOKD promise"><PublicProofPoints /></section>
    <section className="public-form-section booking-form-section" id="booking-form"><span id="quote-form" aria-hidden="true" /><ClientEnquiryForm /></section>
  </main><PublicFooter /></div>;
}
