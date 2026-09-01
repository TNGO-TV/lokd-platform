import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter, PublicHeader, PublicLaunchBar } from "../components/public-site-shell";

export const metadata: Metadata = {
  title: "How LOKD Works for Clients",
  description: "A complete guide to LOKD client onboarding, risk assessment, pricing, officer readiness, roster control, attendance evidence and service records.",
  alternates: { canonical: "/clients" },
};

const journey = [
  { number: "01", label: "Qualify", title: "Tell us what must be protected", text: "We establish the client, site, operating hours, people, assets, access points, known incidents and the result you need from the post." },
  { number: "02", label: "Assess", title: "Build the site risk picture", text: "After activation, LOKD will combine your answers, site evidence and Operations review to identify the suitable service, headcount, post controls and supervision plan." },
  { number: "03", label: "Define", title: "Agree the post—not just a guard", text: "The proposal records the duties, exclusions, hours, escalation contacts, post orders, equipment, reporting and measurable service standard." },
  { number: "04", label: "Contract", title: "Approve and pre-fund the service", text: "The final quotation, applicable tax treatment and service agreement will be approved first. LOKD offers no credit terms: cleared client payment for the approved service term must be confirmed before matching." },
  { number: "05", label: "Roster", title: "Match eligible employed officers", text: "Operations will fill each dated roster slot only with an officer whose identity, PSiRA registration status and grade, training, site induction, Passport and lawful rest window all pass." },
  { number: "06", label: "Verify", title: "Confirm the right officer arrived", text: "The planned arrival control checks the officer against the exact shift and captures approved time and site evidence. A physical uniform or patch never replaces live verification." },
  { number: "07", label: "Operate", title: "Manage the post and exceptions", text: "Briefings, attendance, relief, incidents, safety issues, complaints and supervisor actions sit in one controlled operating record." },
  { number: "08", label: "Prove", title: "Close the service record", text: "The client will be able to review delivery and raise a dispute. LOKD or its approved TES will resolve employment records separately from the client service review." },
];

const riskInputs = [
  "Site type and public exposure",
  "People, vulnerable groups and visitor volume",
  "Asset value, stock attractiveness and loss history",
  "Operating hours, night work and lone-worker conditions",
  "Entrances, perimeter, lighting, alarms and CCTV",
  "Incident history, threats and local response time",
  "Post duties, escalation powers and required equipment",
  "Notice period, continuity and replacement requirements",
];

const clientDuties = [
  "Provide accurate site and risk information",
  "Nominate authorised contacts and escalation people",
  "Approve realistic post orders and site rules",
  "Provide safe access, welfare and agreed site facilities",
  "Report material risk changes promptly",
  "Review service records and raise disputes with evidence",
];

const lokdDuties = [
  "Contract as the accountable security service provider",
  "Use the approved employer or compliant TES structure",
  "Verify officer eligibility before every assignment",
  "Create and maintain the roster and relief plan",
  "Supervise attendance, incidents and service exceptions",
  "Administer employment and payroll directly or through an approved compliant TES",
];

const faqs = [
  ["Is LOKD a marketplace where I hire a guard directly?", "No. The production model makes LOKD the accountable contracting principal. The client buys a managed security service from LOKD; the officer is not paid by the client and does not bid for the lowest rate."],
  ["Why will LOKD cost more than the cheapest guarding quote?", "LOKD is designed around verified readiness, stronger officer pay, training, supervision, replacement capacity, insurance, technology and auditable service delivery. The aim is lower operational risk and better proof—not the lowest visible hourly rate."],
  ["Does the risk assessment automatically decide what I must buy?", "No. The model assists with consistency, but Operations reviews the result. Higher-risk or unusual assignments require a human plan and may be declined or deferred if LOKD cannot control the risk properly."],
  ["Can I choose a particular officer?", "Continuity and client feedback can inform rostering, but no preference can override eligibility, rest, employment, fairness or safety controls. LOKD remains responsible for the lawful assignment decision."],
  ["What can I verify about an officer?", "The client-facing Passport is designed to show the approved minimum: current readiness, appropriate service and purpose fit, and the exact assignment. Private identity documents and unnecessary personal information remain protected."],
  ["Does my shift confirmation determine whether the officer is paid?", "No. Client confirmation is important service evidence, but it is not a wage switch. LOKD must resolve attendance and disputes through its own timesheet and payroll process."],
  ["What happens if an officer is late or does not arrive?", "A missed attendance event becomes an Operations exception. LOKD contacts the officer, informs the authorised client contact and follows the approved relief or escalation plan. The exception and response remain part of the service record."],
  ["What happens when there is a serious incident?", "The officer follows the approved post and emergency instructions, contacts the appropriate emergency service or response partner where required, and alerts Operations. LOKD records, escalates and reviews the event with the client."],
  ["Does better training guarantee that a loss will not occur?", "No security service can guarantee that crime, injury or loss will never occur. Better preparation, suitable matching, clear duties, supervision and timely escalation are intended to reduce avoidable operational failures."],
  ["How do Sundays and public holidays affect pricing?", "The quotation will state the client-facing calendar category. Employment and payroll treatment must follow the applicable law and sector collective agreement; any separate Easter or Christmas commercial scarcity premium will be identified clearly in the client quotation."],
  ["When would the client pay?", "Before matching or activation. LOKD offers no credit terms and does not finance client security services. The production service will use an approved quotation, service agreement and valid invoice with the applicable VAT or tax treatment stated, and the full required payment must clear first. The current demo cannot take or verify real payment."],
  ["How much mobilisation time is required?", "Phase 1 is a scheduled fixed-site service, not immediate dispatch. The final lead time will depend on site approval, post orders, induction, roster capacity and funding. LOKD will not compress those controls merely to accept a booking."],
  ["What if the site or duties change?", "A material change in hours, people, assets, hazards, duties or access can change the risk and price. LOKD will reassess and agree the revised scope before an officer is instructed to perform it."],
  ["Can I book Armed, VIP or immediate Flex cover now?", "Not in Phase 1. The first controlled service is scheduled Unarmed fixed-site guarding in one Gauteng operating area. Armed, VIP, high-risk and Flex services remain future, separately gated products."],
];

export default function ClientGuidePage() {
  return (
    <main className="public-home client-guide-page">
      <PublicLaunchBar />
      <PublicHeader active="clients" />

      <section className="client-guide-hero">
        <div>
          <p className="public-kicker"><i /> The complete client guide</p>
          <h1>From risk to roster.<br /><span>One accountable service.</span></h1>
          <p>LOKD is not designed to send the cheapest available person to a post. The production model will understand the risk, define the job properly, deploy an eligible and purpose-ready officer, manage the shift and give the client evidence of delivery.</p>
          <div className="public-hero-actions">
            <a className="public-button public-button--lime" href="#journey">Follow the client journey <b>↓</b></a>
            <a className="public-button public-button--outline" href="#phase-one">See Phase 1 scope <b>→</b></a>
          </div>
        </div>
        <aside className="client-guide-snapshot" aria-label="LOKD Phase 1 snapshot">
          <span>PHASE 1 · CONTROLLED PILOT</span>
          <h2>Scheduled Unarmed fixed-site security</h2>
          <dl>
            <div><dt>Operating area</dt><dd>One approved Gauteng area</dd></div>
            <div><dt>Service model</dt><dd>LOKD contracts and operates</dd></div>
            <div><dt>Officer model</dt><dd>LOKD directly or an approved compliant TES</dd></div>
            <div><dt>Activation</dt><dd>Blocked until launch gates pass</dd></div>
          </dl>
          <p>Armed, VIP, high-risk and on-demand Flex work remain outside the first paid pilot.</p>
        </aside>
      </section>

      <nav className="client-guide-index" aria-label="Client guide sections">
        <a href="#service">What you buy</a><a href="#journey">Eight steps</a><a href="#risk">Risk assessment</a><a href="#pricing">Pricing</a><a href="#responsibility">Responsibilities</a><a href="#questions">Questions</a>
      </nav>

      <section className="client-guide-service" id="service">
        <div className="client-guide-heading">
          <p className="public-kicker">What the client buys</p>
          <h2>A security outcome—not an anonymous labour hour.</h2>
          <p>The planned service includes the controls around the officer: risk planning, verification, rostering, supervision, relief, incident handling, compliant payroll administration and proof.</p>
        </div>
        <div className="client-service-grid">
          <article><span>01</span><h3>Accountability</h3><p>One contract with LOKD, one operating standard and one responsible service provider.</p></article>
          <article><span>02</span><h3>Purpose fit</h3><p>The required skills and site-specific preparation follow from the post—not simply the officer&apos;s grade.</p></article>
          <article><span>03</span><h3>Continuity</h3><p>Approved rosters, relief planning and exception controls reduce last-minute gaps and unmanaged substitutions.</p></article>
          <article><span>04</span><h3>Evidence</h3><p>Readiness, assignments, attendance, incidents, complaints and service review form a controlled record.</p></article>
        </div>
      </section>

      <section className="client-guide-journey" id="journey">
        <div className="client-guide-heading client-guide-heading--light">
          <p className="public-kicker">Intended production workflow</p>
          <h2>Eight controlled steps from first brief to service proof.</h2>
          <p>Every step has a gate. A booking cannot jump from a quote to deployment merely because an officer appears available.</p>
        </div>
        <div className="client-journey-grid">{journey.map((step) => <article key={step.number}><span>{step.number}</span><i>{step.label}</i><h3>{step.title}</h3><p>{step.text}</p></article>)}</div>
      </section>

      <section className="client-risk-section" id="risk">
        <div className="client-risk-copy">
          <p className="public-kicker">Assisted risk assessment</p>
          <h2>The quote starts with the risk—not a generic rate card.</h2>
          <p>The client provides structured information. LOKD uses it to produce a consistent first assessment, but Operations remains accountable for the final plan. The system may recommend more controls, a different service or a manual review; it can never make an unsafe booking acceptable.</p>
          <div className="risk-output-card"><span>ASSESSMENT OUTPUT</span><strong>Risk band · Suitable service · Headcount · Required readiness · Supervision · Price factors</strong><p>Higher risk changes the operating plan before it changes the price.</p></div>
        </div>
        <div className="risk-input-list"><span>Inputs considered</span>{riskInputs.map((item, index) => <div key={item}><b>{String(index + 1).padStart(2, "0")}</b><p>{item}</p></div>)}</div>
      </section>

      <section className="client-scenarios">
        <div className="client-guide-heading">
          <p className="public-kicker">Different sites. Different preparation.</p>
          <h2>“Unarmed” does not mean “one standard fits all.”</h2>
        </div>
        <div className="client-scenario-grid">
          <article><span>SAFEGUARDING-SENSITIVE EXAMPLE</span><h3>School access post</h3><p>Potentially Unarmed, but the safeguarding exposure makes visitor control, communication and child-sensitive conduct mandatory.</p><em>Enhanced review · may fit Phase 1</em></article>
          <article><span>CONTROLLED COMMERCIAL EXAMPLE</span><h3>Office or industrial access</h3><p>Post orders may include visitor checks, vehicle control, keys, perimeter observations and escalation procedures.</p><em>Phase 1 may be suitable after review</em></article>
          <article><span>HIGHER-RISK EXAMPLE</span><h3>Jewellery or high-value retail</h3><p>High-value stock, public access and robbery exposure may require a specialist plan or service outside Unarmed Phase 1.</p><em>Manual review · may be declined</em></article>
        </div>
      </section>

      <section className="client-phase-section" id="phase-one">
        <div><p className="public-kicker">Phase 1 boundary</p><h2>Start narrow. Prove the standard.</h2><p>The first paid pilot is deliberately limited so LOKD can prove lawful employment, dependable coverage, client service and evidence quality before adding complexity.</p></div>
        <div className="phase-scope-grid"><article><span>IN</span><strong>Scheduled Unarmed fixed-site posts</strong><p>Approved clients, sites, post orders, rosters and employed officers in one Gauteng operating area.</p></article><article><span>NOT YET</span><strong>Armed, VIP, immediate Flex and high-risk work</strong><p>Each requires separate regulatory, competency, insurance, equipment and operating controls.</p></article></div>
      </section>

      <section className="client-duty-boundary">
        <div className="client-guide-heading"><p className="public-kicker">The Unarmed service boundary</p><h2>Clear duties protect the client and the officer.</h2><p>Every post is governed by its approved agreement and post orders. The client cannot expand the role informally during a shift.</p></div>
        <div className="duty-boundary-grid"><article><span>TYPICAL APPROVED DUTIES</span><ul><li>Visible security presence</li><li>Approved access-control support</li><li>Visitor and delivery logging</li><li>Patrols within the contracted property</li><li>Observation of alarms, hazards and suspicious activity</li><li>Immediate reporting and escalation</li></ul></article><article><span>NOT AN UNARMED GUARDING DUTY</span><ul><li>Armed intervention or armed response</li><li>Cash-in-transit or high-value escort</li><li>Personal protection or dangerous pursuit</li><li>Unapproved off-site errands</li><li>Unrelated cleaning, loading or general labour</li><li>Any instruction outside lawful training and post orders</li></ul></article></div>
      </section>

      <section className="client-pricing-section" id="pricing">
        <div className="client-guide-heading client-guide-heading--light">
          <p className="public-kicker">How pricing works</p>
          <h2>Premium, explainable and never built on bidding officers down.</h2>
          <p>LOKD&apos;s lawful loaded-cost floor must cover the real cost of a controlled deployment. Phase 1 is scheduled fixed-site work and does not use an immediate-dispatch multiplier. Any future Flex dispatch premium will be a separately governed product rule.</p>
        </div>
        <div className="pricing-factor-grid">
          <article><span>01</span><strong>Rostered hours</strong><p>Number of posts, shifts, term and relief requirement.</p></article>
          <article><span>02</span><strong>Calendar requirements</strong><p>Payroll follows applicable law and the sector agreement; client-facing peak premiums are stated separately.</p></article>
          <article><span>03</span><strong>Risk controls</strong><p>Site exposure, headcount, skills, supervision and required equipment.</p></article>
          <article><span>04</span><strong>Mobilisation and continuity</strong><p>Lead time, location, replacement capacity, site induction and operational support.</p></article>
        </div>
        <div className="pricing-rule-strip"><strong>The client will contract and prepay LOKD.</strong><span>No credit terms. Cleared payment will be confirmed before matching.</span><span>Employment and payroll will be administered by LOKD or its approved compliant TES.</span><span>Never by the security client; no lowest-bid auction.</span></div>
      </section>

      <section className="client-responsibility-section" id="responsibility">
        <div className="client-guide-heading">
          <p className="public-kicker">Clear ownership</p>
          <h2>What LOKD will own—and what the client must provide.</h2>
        </div>
        <div className="responsibility-grid">
          <article><span>THE CLIENT</span><h3>Creates a truthful, workable brief</h3><ul>{clientDuties.map((item) => <li key={item}>{item}</li>)}</ul></article>
          <article className="responsibility-lokd"><span>LOKD</span><h3>Owns the security-service delivery</h3><ul>{lokdDuties.map((item) => <li key={item}>{item}</li>)}</ul></article>
        </div>
      </section>

      <section className="client-proof-section">
        <div className="client-guide-heading client-guide-heading--light"><p className="public-kicker">What the client sees</p><h2>A living service record—not a monthly mystery.</h2></div>
        <div className="client-proof-flow"><article><span>BEFORE</span><strong>Approved plan and roster</strong><p>Site, post, duties, officer eligibility and funding gates.</p></article><i>→</i><article><span>DURING</span><strong>Attendance and exceptions</strong><p>Approved check-in evidence, incidents, relief and Operations actions.</p></article><i>→</i><article><span>AFTER</span><strong>Service review and resolution</strong><p>Completed record, client feedback, disputes and retained evidence.</p></article></div>
        <p className="client-proof-note">The production LOKD Passport is designed to prove current readiness for the assignment. It will not expose private officer documents, and it will never replace supervision or a lawful employment process.</p>
      </section>

      <section className="client-faq-section" id="questions">
        <div className="client-guide-heading"><p className="public-kicker">Client questions</p><h2>The important answers before you buy.</h2></div>
        <div className="client-faq-list">{faqs.map(([question, answer], index) => <details key={question} open={index === 0}><summary>{question}<span>＋</span></summary><p>{answer}</p></details>)}</div>
      </section>

      <section className="client-guide-cta">
        <p className="public-kicker">Controlled Johannesburg launch</p>
        <h2>Tell us about the site. We will tell you whether Phase 1 fits.</h2>
        <p>Client enquiries are open for planned, scheduled Unarmed fixed-site security. An enquiry is not an accepted booking: LOKD reviews the site, post, mobilisation window, workforce capacity and production gates before making any service commitment.</p>
        <div><Link className="public-button public-button--lime" href="/contact">Request a security plan <b>→</b></Link><a className="public-button public-button--outline" href="https://portal.lokd.co.za">Client portal <b>→</b></a></div>
      </section>
      <PublicFooter />
    </main>
  );
}
