import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument, LEGAL_NOTICES_ADDRESS, LEGAL_OPERATOR } from "../components/legal-document";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Terms for using the LOKD Security website, quote forms, and online portals operated by Lokd Security (Pty) Ltd. Security services have their own terms and conditions.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalDocument
      kicker="Using our website"
      title="Terms of use."
      lede={`These Terms of Use govern access to the LOKD Security website, quote-request forms, client and operations informational pages, and related online portals operated by ${LEGAL_OPERATOR} (“Company,” “we,” “us,” or “our”). Guarding, inspections, and other security services are governed by the Terms and Conditions. If there is a conflict about performed services, the Terms and Conditions control.`}
      asideNote="Questions about website use can be sent to the postal address above. These terms are not legal advice."
      links={[
        { href: "/terms-and-conditions", label: "Service terms and conditions" },
        { href: "/privacy", label: "Privacy notice" },
      ]}
      sections={[
        {
          title: "Definitions",
          body: (
            <p><strong>Platform</strong> means lokd.co.za and related LOKD Security web apps and portals we operate. <strong>Content</strong> means text, images, logos, software, and materials on the Platform. <strong>Services</strong> means security services under the <Link href="/terms-and-conditions">Terms and Conditions</Link>.</p>
          ),
        },
        {
          title: "Acceptance",
          body: (
            <p>By using the Platform, you agree to these Terms of Use. If you do not agree, do not use the Platform.</p>
          ),
        },
        {
          title: "Eligibility and accounts",
          body: (
            <p>You must be authorised to request quotes or access portals for your organisation. Portal accounts, including client, operations, or officer tools if offered, are for authorised users only. Provide accurate account information, protect credentials, and notify {LEGAL_OPERATOR} at <span>{LEGAL_NOTICES_ADDRESS}</span> of unauthorised access. We may suspend accounts for abuse or security risk.</p>
          ),
        },
        {
          title: "No automatic contract",
          body: (
            <p>Marketing content, service descriptions, and online quote forms do not themselves create a security services contract. Contracts form only under the <Link href="/terms-and-conditions">Terms and Conditions</Link> when a quote or schedule is accepted.</p>
          ),
        },
        {
          title: "Licence and restrictions",
          body: (
            <>
              <p>We grant a limited, revocable, non-exclusive, non-transferable licence to access the Platform for lawful business enquiries and authorised portal use.</p>
              <p>You may not scrape at scale, reverse engineer except as mandatory law allows, bypass access controls, probe for vulnerabilities without permission, introduce malware, overload infrastructure, or harvest personal information.</p>
            </>
          ),
        },
        {
          title: "Quote requests",
          body: (
            <p>Information you submit in quote or contact forms must be accurate and complete. Misleading Site descriptions may affect later Services terms and how liability is allocated under the <Link href="/terms-and-conditions">Terms and Conditions</Link>.</p>
          ),
        },
        {
          title: "Intellectual property",
          body: (
            <p>LOKD Security names, logos, Content, and software are owned by the Company or its licensors. You may not use the marks commercially without written permission.</p>
          ),
        },
        {
          title: "User content",
          body: (
            <p>Feedback or uploads must be lawful and non-infringing. You grant us a worldwide, non-exclusive, royalty-free licence to use them to operate and improve LOKD Security online services, consistent with the <Link href="/privacy">Privacy Notice</Link>. We may remove content that violates these terms.</p>
          ),
        },
        {
          title: "Prohibited uses",
          body: (
            <p>You may not use the Platform for unlawful activity, impersonation, harvesting personal information, interfering with other users, or planning criminal activity, and you may not misrepresent the PSIRA or other licensing status of any party. These terms do not state PSIRA registration numbers.</p>
          ),
        },
        {
          title: "Third-party tools",
          body: (
            <p>The Platform may use hosting, authentication, and communications providers. Operational systems we operate may support quoting and portal access. We are not responsible for third-party outages beyond reasonable control.</p>
          ),
        },
        {
          title: "Privacy",
          body: (
            <p>Personal information is processed under the <Link href="/privacy">Privacy Notice</Link> and POPIA where applicable.</p>
          ),
        },
        {
          title: "Disclaimers",
          body: (
            <p>The Platform is provided “as is” and “as available.” We do not warrant uninterrupted access. Online content is general information, not a Site-specific security guarantee. Mandatory rights under the Consumer Protection Act are preserved where applicable.</p>
          ),
        },
        {
          title: "Limitation of liability",
          body: (
            <p>Subject to non-excludable South African law, liability arising from Platform use, as distinct from performed Services, is limited to ZAR 1,000. We are not liable for indirect or consequential loss. Liability for Services is governed by the <Link href="/terms-and-conditions">Terms and Conditions</Link>. Nothing excludes liability that cannot lawfully be limited.</p>
          ),
        },
        {
          title: "Indemnification",
          body: (
            <p>You will indemnify the Company against claims arising from your misuse of the Platform or false information you submit online, except to the extent caused by our unlawful conduct.</p>
          ),
        },
        {
          title: "Termination",
          body: (
            <p>We may suspend Platform access for breach, risk, or operational reasons. You may stop using the Platform at any time. Intellectual property, disclaimers, liability, indemnity, and governing-law clauses survive.</p>
          ),
        },
        {
          title: "Governing law and disputes",
          body: (
            <p>These terms are governed by the laws of the Republic of South Africa. Disputes are handled by good-faith negotiation, then the South African courts of competent jurisdiction, without limiting mandatory consumer rights.</p>
          ),
        },
        {
          title: "Changes",
          body: (
            <p>We may post updated Terms of Use with a new effective date. Continued use after that date constitutes acceptance of the updated terms.</p>
          ),
        },
        {
          title: "Notices and contact",
          body: (
            <>
              <p>Notices under these terms may be addressed to {LEGAL_OPERATOR} at <span>{LEGAL_NOTICES_ADDRESS}</span>.</p>
              <p>{LEGAL_OPERATOR} — LOKD Security.</p>
            </>
          ),
        },
        {
          title: "General",
          body: (
            <p>If any clause is invalid, the rest remains. These Terms of Use are the entire agreement for use of the Platform. Services remain under the <Link href="/terms-and-conditions">Terms and Conditions</Link>. Electronic notices are permitted. A waiver must be in writing. We may assign these terms to a capable affiliate or successor.</p>
          ),
        },
        {
          title: "Company identification",
          body: (
            <p>The Platform is operated by {LEGAL_OPERATOR}, at <span>{LEGAL_NOTICES_ADDRESS}</span>.</p>
          ),
        },
      ]}
    />
  );
}
