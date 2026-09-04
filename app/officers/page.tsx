import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter, PublicHeader, PublicLaunchBar } from "../components/public-site-shell";

export const metadata: Metadata = { title: "Security Officer Careers and Applications", description: "Join the LOKD officer pathway in Gauteng: register your interest, prepare your evidence and understand the controlled route to eligible work.", alternates: { canonical: "/officers" } };

const pathway = [
  ["Apply", "Share your current location, PSiRA position and work or training interests. Do not send identity or banking documents through the public form."],
  ["Verify", "Identity, registration, grade and credentials move through separate secure checks before an officer profile can progress."],
  ["Prepare", "Service readiness, purpose endorsements, site induction and current evidence determine which posts may fit."],
  ["Activate", "A lawful employment route, approved terms, payroll readiness, availability, rest and travel must pass before paid work."],
];

export default function OfficersPage() {
  return <main className="public-home marketing-page"><PublicLaunchBar /><PublicHeader active="officers" />
    <section className="marketing-hero marketing-hero--dark"><div><p className="public-kicker"><i /> Build a professional security career</p><h1>Your grade opens a door.<br /><span>Your readiness keeps it open.</span></h1><p>LOKD is building an employer-led route for officers who want clear terms, properly controlled assignments, transparent payroll calculations and continuous development.</p><div className="public-hero-actions"><Link className="public-button public-button--lime" href="/join?path=qualified">I&apos;m already qualified <b>→</b></Link><Link className="public-button public-button--outline" href="/join?path=training">I need training <b>→</b></Link></div></div><aside className="marketing-control-card"><span>CONTROLLED JOHANNESBURG PATHWAYS</span><h2>Unarmed · Armed · VIP</h2><p>Registering interest is not an offer of employment or a guarantee of work. LOKD verifies the evidence required for the exact role before onboarding or matching.</p><dl><div><dt>Area</dt><dd>Johannesburg</dd></div><div><dt>Route</dt><dd>Direct employment</dd></div><div><dt>Pay view</dt><dd>Itemised calculation</dd></div></dl></aside></section>
    <section className="marketing-section"><header><p className="public-kicker">The officer pathway</p><h2>One doorway. Four controlled stages.</h2></header><div className="marketing-card-grid">{pathway.map(([title,text],index) => <article key={title}><span>{String(index+1).padStart(2,"0")}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section>
    <section className="marketing-split marketing-split--lime"><div><p className="public-kicker">What the LOKD Passport means</p><h2>Current for this post—not approved forever.</h2><p>The Passport is designed to show the minimum assignment-specific readiness result. If an underlying requirement expires, conflicts or cannot be evidenced, the affected offer or assignment is blocked.</p></div><div className="marketing-check-list"><p>Identity workflow complete</p><p>PSiRA status and grade current</p><p>Service and purpose fit</p><p>Site induction current</p><p>Availability and rest pass</p><p>Exact shift match</p></div></section>
    <section className="marketing-section marketing-section--dark"><header><p className="public-kicker">Payroll transparency</p><h2>A calculated balance—not a wallet.</h2><p>The officer workspace shows approved earnings, itemised lawful deductions, calculated net pay and downloadable detail. It does not create credit, stored value, an IOU or an uncontrolled payout instruction.</p></header><div className="marketing-rule-row"><span>Approved work</span><b>→</b><span>Policy calculation</span><b>→</b><span>Maker/checker review</span><b>→</b><span>Controlled settlement</span></div></section>
    <section className="marketing-cta"><p className="public-kicker">Start where you are</p><h2>Qualified already or still preparing—choose the right path.</h2><Link className="public-button public-button--dark" href="/join">Start an officer application <b>→</b></Link></section><PublicFooter />
  </main>;
}
