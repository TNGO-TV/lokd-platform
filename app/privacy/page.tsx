import type { Metadata } from "next";
import Link from "next/link";
import { LegalDefs, LegalDocument, LegalList, LEGAL_NOTICES_ADDRESS, LEGAL_OPERATOR } from "../components/legal-document";

export const metadata: Metadata = {
  title: "Privacy Notice",
  description: "How Lokd Security (Pty) Ltd processes personal information for LOKD Security under POPIA, and how to contact us about your information.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalDocument
      kicker="Your information"
      title="Privacy notice."
      lede={`This Privacy Notice explains how ${LEGAL_OPERATOR} processes personal information for LOKD Security, in accordance with the Protection of Personal Information Act 4 of 2013 (POPIA) and other applicable law. It covers lokd.co.za and the related online services described below.`}
      asideNote="Privacy requests can be sent to the postal address above. This notice is not legal advice."
      links={[
        { href: "/terms", label: "Website terms of use" },
        { href: "/terms-and-conditions", label: "Service terms and conditions" },
      ]}
      sections={[
        {
          title: "Responsible party and contact",
          body: (
            <>
              <p>{LEGAL_OPERATOR} — LOKD Security. For privacy matters, write to <span>{LEGAL_NOTICES_ADDRESS}</span>, marked “Privacy request”.</p>
              <p>When we process visitor or employee personal information on a Client Site solely on the Client’s documented instructions, for example certain CCTV or visitor-log arrangements, the Client may be the responsible party and we an operator. Those roles are clarified in the service schedule or in data-processing clauses where needed.</p>
            </>
          ),
        },
        {
          title: "Scope",
          body: (
            <p>This notice covers website visitors, quote requesters, Clients, Client contacts, and, where applicable, Personnel administration related to LOKD engagements.</p>
          ),
        },
        {
          title: "What we collect",
          body: (
            <>
              <LegalDefs
                caption="Categories of personal information"
                rows={[
                  ["Client and enquirer", "Name, company, role, email, phone, Site address, and service requirements"],
                  ["Contract and billing", "Quotes, schedules, invoices, and payment references"],
                  ["Site operations", "Post orders, incident reports, shift logs, and emergency contacts you provide"],
                  ["Monitoring data", "If in scope: CCTV or access logs, only as agreed in writing"],
                  ["Technical", "IP address, device, cookies, and Platform logs"],
                  ["Personnel", "Handled under separate employment or contractor notices where applicable"],
                ]}
              />
              <p>We avoid collecting special personal information unless it is strictly necessary and lawful, for example limited health information for an occupational incident.</p>
            </>
          ),
        },
        {
          title: "Purposes and justification",
          body: (
            <>
              <p>We use personal information to respond to quotes, contract for and deliver Services, coordinate Site access, manage safety and incidents, bill for Services, improve operations, secure systems we operate, and meet legal duties, including private-security regulatory cooperation where that cooperation is lawful.</p>
              <p>Typical justifications are contract, legal obligation, and legitimate interests in security operations and fraud or abuse prevention, balanced against your rights. We rely on consent where it is required, for example certain cookies or optional marketing.</p>
            </>
          ),
        },
        {
          title: "Cookies and analytics",
          body: (
            <p>Essential and optional analytics cookies may be used on lokd.co.za. This notice does not name specific analytics products. Browser controls are available. Essential cookies may be required for portals.</p>
          ),
        },
        {
          title: "Sharing",
          body: (
            <>
              <LegalList
                items={[
                  "Personnel and subcontractors bound to confidentiality and, where applicable, POPIA operator duties",
                  "Providers that host systems we operate, and providers of email, authentication, and payments",
                  "Emergency services and authorities when required for safety or law",
                  "Professional advisers",
                  "A corporate successor, if the business is transferred",
                ]}
              />
              <p>We do not sell personal information. Licensing particulars, including any PSIRA registration number, appear only when they have been confirmed. They are not stated in this notice.</p>
            </>
          ),
        },
        {
          title: "International transfers",
          body: (
            <p>Primary operations focus is South Africa. Some providers may process information in other countries, including the United States or other cloud regions. We use appropriate transfer mechanisms where POPIA requires them. This notice does not include a country-by-country transfer map. Write to {LEGAL_OPERATOR} at <span>{LEGAL_NOTICES_ADDRESS}</span> if you need the safeguards relevant to your information.</p>
          ),
        },
        {
          title: "Retention",
          body: (
            <p>Quote records, contracts, invoices, and incident logs are retained for the engagement plus the legal and regulatory periods that apply. CCTV is retained as stated in the Client’s instructions or in the schedule for that engagement, and is often short-cycling. This notice does not state a single standard number of days for CCTV. Website logs are retained for security for a limited period.</p>
          ),
        },
        {
          title: "Security",
          body: (
            <p>We use reasonable organisational and technical measures appropriate to security-industry data, including access control, need-to-know limits, and secure transmission where applicable. Report a security incident to {LEGAL_OPERATOR} at <span>{LEGAL_NOTICES_ADDRESS}</span>.</p>
          ),
        },
        {
          title: "Your rights",
          body: (
            <>
              <p>Under POPIA you may request access, correction, or deletion, object to processing, ask for restriction, and withdraw consent where processing is based on consent. You may also complain to the <a href="https://inforegulator.org.za/contact-us/">Information Regulator</a>.</p>
              <p>Write to {LEGAL_OPERATOR} at <span>{LEGAL_NOTICES_ADDRESS}</span> with enough detail for us to verify your identity. If your information was collected only as a Site visitor under a Client’s responsible-party role, we may direct you to the Client and assist as operator.</p>
            </>
          ),
        },
        {
          title: "Children",
          body: (
            <p>Services and the Site are directed to businesses and adults. We do not knowingly collect children’s personal information through the marketing Site.</p>
          ),
        },
        {
          title: "Direct marketing",
          body: (
            <p>Business-contact marketing may occur under POPIA rules for electronic communications. You can opt out in the message or by writing to {LEGAL_OPERATOR} at <span>{LEGAL_NOTICES_ADDRESS}</span>.</p>
          ),
        },
        {
          title: "Changes and contact",
          body: (
            <>
              <p>We may update this notice by posting a new version with a new effective date. The date at the top of this page identifies the current notice.</p>
              <p>Write to {LEGAL_OPERATOR} at <span>{LEGAL_NOTICES_ADDRESS}</span>. Related documents: <Link href="/terms">Terms of Use</Link> and <Link href="/terms-and-conditions">Terms and Conditions</Link>.</p>
            </>
          ),
        },
      ]}
    />
  );
}
