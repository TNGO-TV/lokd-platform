import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter, PublicHeader, PublicLaunchBar } from "../components/public-site-shell";
import { COMPANY_NAME, HEAD_OFFICE_ADDRESS, BOOKINGS_EMAIL } from "../lib/public-site";

export const metadata: Metadata = { title: "Terms of Use", description: "Terms for using the LOKD Security website and online portals. Service quotes include their own linked terms and conditions.", alternates: { canonical: "/terms" } };
const sections = [
  ["About these terms", "These terms apply to use of our website and online portals. They do not replace the terms and conditions linked to an individual quote or any applicable employment, training or service agreement."],
  ["Enquiries, quotes and service", "Website descriptions and price indications are general information, not a confirmed booking. An enquiry lets us assess your location, requirements and availability. Review your quote and its linked terms and conditions before accepting. Accepting that quote also accepts those linked terms. Deployment remains subject to the required approvals, cleared advance funding and confirmation by Operations."],
  ["Applications and training interest", "Submitting an officer application or training enquiry does not guarantee admission, registration, qualification, employment or an assignment. Training centres described as opening soon are not represented as open. Course dates, providers, entry requirements and fees must be confirmed before enrolment."],
  ["Your account and submissions", "Provide accurate information and use an account you are authorised to access. Keep sign-in credentials secure and tell us if you suspect unauthorised access. Submit information or documents only where you have the right to do so. Account access does not authorise you to act or accept a quote on another person's behalf."],
  ["Acceptable use", "Do not attempt to bypass access controls, disrupt the service, introduce malicious software, impersonate others or access, copy or disclose information without authorisation. We may restrict access where reasonably necessary to investigate misuse or protect the service and its users."],
  ["Website content and external links", "Website material and branding may be protected by intellectual-property rights. Using the site does not grant ownership of that material. External links, including social platforms, are provided for convenience; those services apply their own terms and privacy practices."],
  ["Availability and changes", "We work to keep information accurate and the website available, but errors, maintenance and interruptions can occur. Confirm service details in your quote or directly with Operations. Changes to these website terms will be dated here; they do not automatically replace the terms attached to a quote you have already accepted."],
  ["Your rights", "Nothing in these website terms excludes rights or remedies that cannot lawfully be excluded under applicable South African law. Personal information is handled as described in our privacy notice."],
];
export default function TermsPage() {
  return <main className="public-home marketing-page"><PublicLaunchBar /><PublicHeader active="about" />
    <section className="legal-hero"><p className="public-kicker">Using our website</p><h1>Terms of use.</h1><p>These terms cover the website and online portals operated by {COMPANY_NAME}. Your service quote has its own linked terms and conditions.</p><span>Updated 25 September 2026 · Version website-terms-v1</span></section>
    <section className="legal-content"><aside><strong>{COMPANY_NAME}</strong><p>Head Office: {HEAD_OFFICE_ADDRESS}</p><a href={`mailto:${BOOKINGS_EMAIL}`}>{BOOKINGS_EMAIL}</a><p>For questions about these terms or your enquiry, contact us using your reference where available.</p><Link href="/privacy">Read our privacy notice</Link></aside><div>{sections.map(([title,text],index) => <section key={title}><span>{String(index+1).padStart(2,"0")}</span><div><h2>{title}</h2><p>{text}</p></div></section>)}</div></section><PublicFooter />
  </main>;
}
