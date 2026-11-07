import Link from "next/link";
import ClientEnquiryForm from "../components/client-enquiry-form";
import { Icon, type IconName } from "../components/icons";
import { PublicPage } from "../components/public-site-shell";
import { publicMetadata, BOOKINGS_EMAIL, QUOTES_EMAIL, INVOICE_EMAIL, TRAINING_EMAIL, VERIFICATION_EMAIL } from "../lib/public-site";

import "../styles/booking.css";

export const metadata = publicMetadata("Contact LOKD Security", "Contact LOKD about on-demand security, ongoing contract cover or certified training. Share your Johannesburg requirements with the right team.", "/contact");
const channels: [IconName, string, string][] = [
  ["messageSquare","Quotes and sales",QUOTES_EMAIL], ["calendar","Bookings",BOOKINGS_EMAIL],
  ["fileText","Accounts and support",INVOICE_EMAIL], ["graduationCap","Training",TRAINING_EMAIL],
  ["scan","Officer verification",VERIFICATION_EMAIL],
];

export default function ContactPage() {
  return <PublicPage active="contact" eyebrow="Contact LOKD" title="Let’s plan your next step." promise="Book officers for your site, discuss an ongoing roster or enquire about training. Start with what you need." ctaHref="/book" ctaLabel="Book officers">
    <section className="public-contact-layout" id="enquiry" aria-label="Contact the LOKD team"><aside><div className="site-contact-intro"><span className="site-icon"><Icon name="messageSquare" /></span><h2>Contact LOKD</h2><p>For a new booking, use the booking flow. For a detailed site brief or a question, send an enquiry.</p><div className="home-actions"><Link className="home-link" href="/book?when=ongoing">Ongoing cover<Icon name="arrowUpRight" size={18} /></Link></div></div><div className="site-contact-channels">{channels.map(([icon,label,email]) => <a key={label} href={"mailto:"+email}><span className="site-icon"><Icon name={icon} size={22} /></span><span><strong>{label}</strong><small>{email}</small></span></a>)}</div><div className="site-contact-intro"><h2>Looking for security work?</h2><p>Find the right pathway for registered officers, renewals and new applications.</p><Link className="home-link" href="/officers">Explore officer pathways<Icon name="arrowUpRight" size={18} /></Link></div></aside><ClientEnquiryForm /></section>
  </PublicPage>;
}
