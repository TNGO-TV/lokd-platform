import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter, PublicHeader, PublicLaunchBar } from "../components/public-site-shell";

export const metadata: Metadata = { title: "Security Services for Clients", description: "How to request security, review your quote and linked terms, and prepare for service with LOKD across South Africa.", alternates: { canonical: "/clients" } };
const steps = [
  ["Tell us what you need", "Send your location, site or movement details, hours and preferred dates. We assess local availability and the security requirements."],
  ["Review your quote and terms", "Your quote sets out the agreed scope and price, with a link to its terms and conditions. Review both before accepting. Accepting the quote also accepts those linked terms."],
  ["Prepare for service", "We confirm the required checks and site instructions. An enquiry or accepted quote alone does not confirm deployment."],
  ["Manage your service", "Use your client portal to follow progress and respond to requests. Agree changes with Operations before changing hours, duties or the service location."],
];
const questions = [
  ["Where can I enquire?", "Across South Africa. We assess availability for your location, service type, dates and the officers or equipment required."],
  ["Which services can I request?", "Unarmed guarding, armed security and VIP protection. Each request is assessed for its risks, duties and the qualifications and permissions needed."],
  ["When does service start?", "An enquiry does not set a start date. Operations confirms the scope and a deployment window with you before service is scheduled."],
  ["Can I change an accepted quote?", "Contact Operations with the change you need. A revised offer must be reviewed and accepted with its own linked terms where applicable; your earlier acceptance does not automatically accept a replacement."],
  ["How do I follow up?", "Sign in to the client portal with the email used for your enquiry, or contact bookings@lokd.co.za. Keep your enquiry or quote reference handy."],
];
export default function ClientsPage() {
  return <main className="public-home marketing-page"><PublicLaunchBar /><PublicHeader active="clients" />
    <section className="marketing-hero"><div><p className="public-kicker">For clients</p><h1>Your security needs.<br /><span>A clear plan.</span></h1><p>From your first enquiry to service delivery, know what is included, what it costs and what needs to happen next.</p><div className="public-hero-actions"><Link className="public-button public-button--dark" href="/contact">Request a security plan</Link><Link className="public-button public-button--outline-dark" href="/security-services">Explore services</Link></div></div><aside className="marketing-quote-card"><span>ACROSS SOUTH AFRICA</span><blockquote>Security starts with understanding your location.</blockquote><p>We assess local availability and requirements before confirming a quote or deployment.</p></aside></section>
    <section className="marketing-section"><header><p className="public-kicker">How it works</p><h2>From enquiry to service.</h2></header><div className="marketing-card-grid">{steps.map(([title, text], index) => <article key={title}><span>{String(index + 1).padStart(2, "0")}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section>
    <section className="marketing-split marketing-split--dark"><div><p className="public-kicker">Before deployment</p><h2>Agree the details up front.</h2><p>Your service scope identifies the location, duties, hours, reporting needs and any specialist requirements. Pricing and the applicable terms are supplied with your quote.</p></div><div className="marketing-check-list"><p>Scope and site instructions agreed</p><p>Quote and linked terms accepted</p><p>Required officer and service checks completed</p><p>Deployment confirmed by Operations</p></div></section>
    <section className="marketing-section"><header><p className="public-kicker">Common questions</p><h2>Know what happens next.</h2></header><div className="client-guide-faq">{questions.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></section>
    <section className="marketing-cta"><p className="public-kicker">Ready to start</p><h2>Tell us about your security needs.</h2><Link className="public-button public-button--dark" href="/contact">Start an enquiry</Link></section><PublicFooter />
  </main>;
}
