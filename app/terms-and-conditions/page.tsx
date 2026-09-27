import type { Metadata } from "next";
import Link from "next/link";
import { LegalDefs, LegalDocument, LegalList, LEGAL_NOTICES_EMAIL, LEGAL_OPERATOR } from "../components/legal-document";

export const metadata: Metadata = {
  title: "Terms and Conditions",
  description: "Terms and conditions for LOKD Security quotes, inspections, guarding, and related private security services operated by The Tactical Nation, Inc.",
  alternates: { canonical: "/terms-and-conditions" },
};

export default function TermsAndConditionsPage() {
  return (
    <LegalDocument
      kicker="Security services"
      title="Terms and conditions."
      lede={`These Terms and Conditions govern quotes, inspections, guarding, and related private security services offered under the LOKD Security brand by ${LEGAL_OPERATOR} (“Company,” “we,” “us,” or “our”) on lokd.co.za. For a services engagement, these terms and any signed service schedule, quote acceptance, or order form control.`}
      asideNote="Notices for these terms go to the email above. These terms are not legal advice."
      links={[
        { href: "/terms", label: "Website terms of use" },
        { href: "/privacy", label: "Privacy notice" },
      ]}
      sections={[
        {
          title: "Definitions",
          body: (
            <LegalDefs
              caption="Defined terms"
              rows={[
                ["Agreement", "These Terms and Conditions, accepted quotes, statements of work, service schedules, and site-specific instructions agreed in writing"],
                ["Client / you", "The person or organisation requesting or receiving Services"],
                ["Services", "Security-related services we agree to provide, which may include quotations, site inspections or assessments, guarding, access monitoring support, reporting, and related coordination"],
                ["Site", "Premises, event location, or other location where Services are performed"],
                ["Personnel", "Officers, supervisors, and other persons we assign to perform Services"],
                ["Systems", "Operational, scheduling, quoting, and client-communication systems we operate"],
              ]}
            />
          ),
        },
        {
          title: "Acceptance",
          body: (
            <>
              <p>2.1 A binding services contract is formed when you accept a quote in writing (including email or portal acceptance), sign a schedule, or otherwise expressly authorise us to proceed, and we confirm.</p>
              <p>2.2 Website quote requests are invitations to treat until we issue and you accept a quote.</p>
              <p>2.3 If you accept on behalf of an entity, you warrant authority to bind it.</p>
            </>
          ),
        },
        {
          title: "Licensing",
          body: (
            <>
              <p>3.1 Private security services in South Africa may require registration and compliance under the Private Security Industry Regulation Act and related PSIRA requirements, as well as other applicable laws.</p>
              <p>3.2 We will only provide Services that we are lawfully permitted to provide. These terms do not state a PSIRA registration number. Where a Service requires a licensed security service provider, we will not knowingly perform that Service without appropriate authorisation.</p>
              <p>3.3 You acknowledge that certain functions (for example armed response, cash-in-transit, or specialised categories) may fall outside a given engagement unless expressly included in your schedule and lawfully authorised.</p>
              <p>3.4 We make no claim in these terms to certifications, accreditations, or registration numbers that have not been confirmed in writing for the relevant engagement.</p>
            </>
          ),
        },
        {
          title: "Quotes, inspections, and scope",
          body: (
            <>
              <p>4.1 Quotes are based on information you provide and any inspection we conduct. Quotes may expire on the date stated, or after thirty (30) days if no date is stated.</p>
              <p>4.2 Inspections and assessments, if included, are limited observational or consultative inputs to scoping Services. They are not engineering, fire, or occupational-health certifications unless expressly stated.</p>
              <p>4.3 The scope of Services is only what is written in the accepted quote or schedule, including posts, hours, duties, reporting cadence, and equipment. Work outside scope requires a written change order and may adjust fees.</p>
              <p>4.4 We may decline or withdraw from engagements that present unlawful instructions, unsafe conditions we cannot reasonably mitigate, or inaccurate Site information that materialises as unacceptable risk.</p>
            </>
          ),
        },
        {
          title: "Client obligations",
          body: (
            <>
              <p>You must:</p>
              <LegalList
                items={[
                  "provide accurate, complete Site information, including layouts, access points, hazards, keys and codes procedures, emergency contacts, known threats, and occupancy patterns;",
                  "disclose special risks, including construction, public events, VIP presence, and prior incidents, before mobilisation;",
                  "ensure lawful authority for us to access the Site and process personal information of visitors and staff as needed for the Services;",
                  "maintain safe working conditions and not instruct Personnel to break the law;",
                  "provide facilities reasonably required, such as post shelter, power, toilets, and parking, as specified in the schedule;",
                  "pay fees on time;",
                  "not solicit our Personnel for direct employment to circumvent this Agreement during the term and for six (6) months after, except with our written consent or as mandatory labour law allows.",
                ]}
              />
              <p>Failure to provide accurate Site information may delay Services, increase fees, or limit our liability to the extent losses arise from that inaccuracy.</p>
            </>
          ),
        },
        {
          title: "Performance of Services",
          body: (
            <>
              <p>6.1 We will perform Services with reasonable skill and care expected of a private security provider in South Africa, using Personnel we consider suitable.</p>
              <p>6.2 Security is risk reduction, not elimination. We do not guarantee that theft, intrusion, assault, vandalism, fire, or other incidents will not occur. Presence of Personnel or procedures does not create an insurer relationship.</p>
              <p>6.3 Unless the schedule expressly includes a duty, we are not responsible for structural safety; firefighting beyond basic emergency notification duties stated; IT or cyber security of Client systems; cash handling; medical treatment beyond calling emergency services; or policing functions reserved to the State.</p>
              <p>6.4 Personnel follow post orders derived from the agreed scope. You must not require Personnel to perform domestic work, illegal searches, or unlawful use of force.</p>
              <p>6.5 We may replace Personnel for operational reasons. We aim for continuity but do not guarantee named individuals unless agreed in writing.</p>
              <p>6.6 Force majeure, including severe weather, riots, load-shedding impacting agreed electronic systems, labour unrest beyond reasonable control, or government action, may suspend affected Services without liability for the suspension period. Fees may be equitably adjusted.</p>
            </>
          ),
        },
        {
          title: "Fees, payment, and taxes",
          body: (
            <>
              <p>7.1 Fees, billing cycles, call-out rates, public-holiday premiums, and equipment charges are as stated in the quote or schedule, typically in ZAR.</p>
              <p>7.2 Invoices are due within the period stated, or fourteen (14) days if no period is stated. Late amounts may attract interest at the prescribed legal rate or as stated in the quote, plus reasonable collection costs.</p>
              <p>7.3 You are responsible for VAT and other taxes as applicable.</p>
              <p>7.4 We may suspend Services for non-payment after notice, without prejudice to amounts owed. Remobilisation may incur fees.</p>
            </>
          ),
        },
        {
          title: "Keys and access media",
          body: (
            <p>Keys, remotes, access cards, and codes entrusted to us remain your property. We will take reasonable care of them and return them on request or at the end of the engagement, subject to operational handover. You must rotate codes after Personnel changes when prudent. Loss caused by your failure to disclose who may hold copies is your risk.</p>
          ),
        },
        {
          title: "Confidentiality",
          body: (
            <>
              <p>9.1 Each party will keep the other’s non-public operational, commercial, and personal information confidential and use it only to perform this Agreement.</p>
              <p>9.2 We may share necessary information with Personnel and operators of systems we operate on a need-to-know basis under confidentiality obligations.</p>
              <p>9.3 Exceptions are information that is public, independently developed, compelled by law (with notice where lawful), or shared with professional advisers.</p>
              <p>9.4 Confidentiality survives for three (3) years after termination. Trade secrets and personal information remain protected for as long as the law requires.</p>
            </>
          ),
        },
        {
          title: "Privacy and POPIA",
          body: (
            <p>Personal information, including CCTV images, visitor logs, or staff details if processed in connection with Services, is handled under the <Link href="/privacy">Privacy Notice</Link> and the Protection of Personal Information Act (POPIA). You must ensure your instructions to us regarding monitoring and data capture are lawful. Where you are the responsible party for Site monitoring, you must meet your POPIA duties, including notices, justification, and retention.</p>
          ),
        },
        {
          title: "Intellectual property",
          body: (
            <p>Our methods, documents, quote templates, and software remain our intellectual property. You receive a limited licence to use deliverables, such as inspection notes and post orders we draft, for your internal security management. You may not resell them.</p>
          ),
        },
        {
          title: "Disclaimers",
          body: (
            <p>Except for express written warranties and non-excludable rights under the Consumer Protection Act where you are a consumer, Services are provided with reasonable care but without a guarantee of particular security outcomes. Assessments are opinion based on observed conditions at the time.</p>
          ),
        },
        {
          title: "Limitation of liability",
          body: (
            <>
              <p>13.1 Nothing excludes liability for fraud, death or personal injury caused by our gross negligence to the extent that liability cannot be excluded, or other liability that South African law does not allow to be limited. Consumer Protection Act rights remain where applicable.</p>
              <p>13.2 Subject to clause 13.1, our aggregate liability arising out of or related to this Agreement and the Services in any twelve (12) month period is limited to the total fees you paid us for the Services giving rise to the claim during that period. If no such fees were paid, the limit is the fees for the first month of the schedule.</p>
              <p>13.3 Subject to clause 13.1, we are not liable for indirect, consequential, or pure economic loss, including lost profits, lost business, reputational harm, or loss of data, whether in contract, delict, or otherwise.</p>
              <p>13.4 To the extent loss arises from inaccurate Site information, Client instructions contrary to law or post orders, third-party criminal acts despite reasonable performance of scoped Services, or Client failure to implement recommended measures outside our scope, our liability is reduced proportionately.</p>
              <p>13.5 You are encouraged to maintain appropriate insurance, including property, public liability, and business interruption cover. We are not your insurer.</p>
            </>
          ),
        },
        {
          title: "Indemnification",
          body: (
            <p>You will indemnify the Company and Personnel against third-party claims, damages, and reasonable legal costs arising from your breach of this Agreement, unsafe Site conditions you failed to disclose, unlawful instructions you gave, or personal information processing you directed that violates POPIA, except to the extent caused by our wilful misconduct or gross negligence.</p>
          ),
        },
        {
          title: "Term, termination, and suspension",
          body: (
            <>
              <p>15.1 The term is as stated in the schedule, whether fixed or month-to-month.</p>
              <p>15.2 Either party may terminate for material breach that is not cured within fourteen (14) days after written notice. Termination may be immediate for non-payment after any shorter notice stated in the schedule, or for a serious safety or legal breach.</p>
              <p>15.3 Either party may terminate for convenience on thirty (30) days’ written notice unless the schedule sets a different notice period for a fixed term. Early-termination fees may apply if the schedule states them.</p>
              <p>15.4 We may suspend Services for safety, illegality, or non-payment. Fees owed, confidentiality, liability, indemnity, intellectual property, and dispute clauses survive termination.</p>
            </>
          ),
        },
        {
          title: "Non-solicitation of Personnel",
          body: (
            <p>During the term and for six (6) months afterwards, you will not knowingly solicit Personnel who materially served your Site to leave us for your direct employ to perform substantially the same duties, without our consent. This does not restrict general public job advertisements. Mandatory labour law prevails if it conflicts with this clause.</p>
          ),
        },
        {
          title: "Disputes and governing law",
          body: (
            <>
              <p>17.1 This Agreement is governed by the laws of the Republic of South Africa.</p>
              <p>17.2 The parties will try to resolve a dispute by negotiation, then mediation in South Africa, then the courts of competent jurisdiction in South Africa, unless the parties agree to arbitration, for example under AFSA rules.</p>
              <p>17.3 Urgent interdictory relief may be sought where appropriate. Consumer Protection Act dispute mechanisms remain available to consumers where applicable.</p>
            </>
          ),
        },
        {
          title: "Changes",
          body: (
            <p>We may update these standard terms for future engagements by posting a new version. An active schedule changes only by written agreement, except where the law requires a change.</p>
          ),
        },
        {
          title: "Notices and contact",
          body: (
            <>
              <p>Notices under these terms may be sent to <a href={`mailto:${LEGAL_NOTICES_EMAIL}`}>{LEGAL_NOTICES_EMAIL}</a>.</p>
              <p>{LEGAL_OPERATOR} — LOKD Security.</p>
            </>
          ),
        },
        {
          title: "General",
          body: (
            <p>If any clause is unenforceable, the rest remains in force. These terms and the applicable schedule are the entire agreement for the Services. We may assign this Agreement to an affiliate or successor capable of lawful performance. You need our consent to assign. Personnel are independent of you and are not your employees. Nothing creates a partnership. Electronic acceptance is valid. A waiver must be in writing. References to systems are generic — systems we operate — and do not depend on any particular third-party brand name.</p>
          ),
        },
        {
          title: "Sister brands",
          body: (
            <p>LOKD Security is operated by {LEGAL_OPERATOR}. Custom Nation, Tervory AI, and Shot Bonus are separate offerings operated by {LEGAL_OPERATOR} and are not part of this Agreement. Website use is also subject to the <Link href="/terms">Terms of Use</Link> and the <Link href="/privacy">Privacy Notice</Link>.</p>
          ),
        },
      ]}
    />
  );
}
