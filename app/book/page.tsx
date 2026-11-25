import ClientEnquiryForm from "../components/client-enquiry-form";
import { PublicHeader, PublicFooter } from "../components/public-site-shell";
import { publicMetadata } from "../lib/public-site";
import "../styles/booking.css";

export const metadata = publicMetadata("Request security cover", "Request PSIRA-verified officers in Johannesburg. Choose urgent LOKD Bolt, temporary LOKD Flex or ongoing LOKD Fixed cover. Operations confirms your officers and price.", "/book");

export default function BookPage() {
  return <div className="public-site booking-page"><PublicHeader active="contact" /><main id="main-content" tabIndex={-1}>
    <section className="page-hero page-hero--compact page-hero--light"><div className="page-hero-inner">
      <div><h1>Book the cover you need.</h1><p className="t-lead">Urgent cover, temporary cover for 7+ days in a calendar month, or an ongoing roster for at least three months. Three short steps, then LOKD Operations confirms your officers and price.</p></div>
    </div></section>
    <section className="booking-form-section" id="booking-form" aria-label="Booking request"><span id="quote-form" aria-hidden="true" /><ClientEnquiryForm /></section>
  </main><PublicFooter /></div>;
}
