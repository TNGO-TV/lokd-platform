import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter, PublicHeader, PublicLaunchBar } from "../components/public-site-shell";

export const metadata: Metadata = { title: "Privacy Notice", description: "How LOKD handles public enquiries, officer interest, authenticated workspace activity and controlled evidence during its launch programme.", alternates: { canonical: "/privacy" } };

const sections = [
  ["What we collect", "Public enquiry and officer-interest forms collect the contact and planning information shown on the form. Authenticated workspaces also record the user identity supplied by Clerk sign-in and the actions attributed to that account."],
  ["What stays out of public forms", "Do not submit identity documents, certificates, banking details, passwords or unnecessary sensitive information through public forms. Secure evidence workflows are separate and access-controlled."],
  ["Why we use it", "LOKD uses submitted information to respond, assess launch fit, route an officer or training pathway, operate authorised workspaces, prevent abuse and retain an accountable audit record."],
  ["Who can access it", "Access is limited by purpose and role. Clients, officers and Operations users have different server-enforced views. LOKD does not expose private officer documents through public Passport verification."],
  ["Retention and review", "Public intake records carry a scheduled retention-review date. Operational, payroll and audit records may need longer retention where an applicable legal, employment, tax, safety or dispute requirement applies."],
  ["Your choices", "You may ask LOKD to correct or review information you submitted. Some records cannot be removed immediately when they must be retained for security, legal, employment, tax, dispute or audit reasons."],
];

export default function PrivacyPage() {
  return <main className="public-home marketing-page"><PublicLaunchBar /><PublicHeader active="about" />
    <section className="legal-hero"><p className="public-kicker"><i /> Current launch notice</p><h1>Privacy at LOKD.</h1><p>This plain-language notice explains the current public forms and authenticated workspaces. It will be expanded with the formal legal-entity and Information Officer particulars before broader production processing.</p><span>Effective 1 September 2026 · Version launch-privacy-v1</span></section>
    <section className="legal-content"><aside><strong>Keep sensitive documents out of public forms.</strong><p>Identity, credential, banking and payroll evidence belongs only in the relevant authenticated and access-controlled workflow.</p><Link href="/contact">Submit a privacy request →</Link></aside><div>{sections.map(([title,text],index) => <section key={title}><span>{String(index+1).padStart(2,"0")}</span><div><h2>{title}</h2><p>{text}</p></div></section>)}<section><span>07</span><div><h2>Security and boundaries</h2><p>LOKD uses role checks, same-origin request controls, private evidence storage, append-only records and separate demo and production provenance. No system can promise absolute security; suspected misuse is investigated and access may be suspended.</p></div></section></div></section>
    <PublicFooter />
  </main>;
}
