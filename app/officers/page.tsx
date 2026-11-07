import Link from "next/link";
import { Icon, type IconName } from "../components/icons";
import { PublicFooter, PublicHeader } from "../components/public-site-shell";
import { publicMetadata } from "../lib/public-site";
import { newOfficerSteps } from "../lib/psira-pathway";
import "../styles/officers.css";

export const metadata = publicMetadata("Security work and officer training", "Join LOKD for on-demand and contract security work, PSIRA renewal support or certified entry-level and specialist training.", "/officers");
const work: Array<{ icon: IconName; title: string; description: string }> = [
  { icon: "bell", title: "Offers in your Officer Zone", description: "See the location, duties, shift times and requirements before you accept an assignment." },
  { icon: "calendar", title: "On-demand and roster work", description: "Share your availability for individual shifts, recurring rosters and contract security work." },
  { icon: "badgeCheck", title: "Work matched to your grade", description: "Assignments are matched to your current registration, grade, qualifications and completed checks." },
];

export default function OfficersPage() {
  return <div className="public-site officers-site"><PublicHeader active="officers" /><main id="main-content" tabIndex={-1}>
    <section className="officers-hero officers-container"><p className="public-kicker">Security work · South Africa</p><h1>Put your skills to work.</h1><p className="officers-lead">LOKD recruits officers for on-demand shifts and contract security work. Whether you are registered, renewing your registration or starting out, choose the route that fits you.</p>
      <div className="officers-options" aria-label="Choose your application route">
        <Link className="officers-option" href="/join?path=registered" aria-label="PSIRA Registered or renewal"><Icon name="badgeCheck" size={32} /><h2>PSIRA Registered or renewal</h2><p>Apply with your PSIRA number and grade. Tell us your work interests and availability, or ask for renewal and refresher support.</p><span className="officers-option-action">Continue <Icon name="arrowUpRight" size={20} /></span></Link>
        <Link className="officers-option" href="/join?path=new" aria-label="New Application"><Icon name="graduationCap" size={32} /><h2>New Application</h2><p>Not yet registered? Start with your details and training interests. LOKD guides you from your ID check through training and registration.</p><span className="officers-option-action">Continue <Icon name="arrowUpRight" size={20} /></span></Link>
      </div>
      <Link className="public-text-link" href="/sign-in?return_to=%2Fofficer">Already applied? Open the Officer Zone</Link>
    </section>
    <section className="officers-section officers-section--white"><div className="officers-container"><p className="public-kicker">How work works</p><h2>Clear offers. Suitable work.</h2><div className="officers-three-grid">{work.map(item => <article className="officers-card" key={item.title}><Icon name={item.icon} size={30} /><h3>{item.title}</h3><p>{item.description}</p></article>)}</div><p className="officers-note">Applying does not guarantee an assignment. Work is offered only when the registration, identity and role requirements have been met.</p></div></section>
    <section className="officers-section"><div className="officers-container officers-split"><div><p className="public-kicker">What LOKD checks</p><h2>Ready for the role.</h2><p>Before work is offered, LOKD checks identity, current PSIRA registration, grade and the qualifications needed for the assignment. Armed and specialist work require the appropriate additional checks.</p><Link className="public-text-link" href="/compliance">Understand our checks</Link></div><div className="officers-card"><Icon name="shieldCheck" size={32} /><h3>Your LOKD Passport</h3><p>Your Passport brings your checked officer profile and relevant status together. A current Passport supports verification; it does not replace PSIRA registration.</p><Link className="public-text-link" href="/verify">Check a LOKD Passport</Link></div></div></section>
    <section className="officers-section officers-section--white"><div className="officers-container"><p className="public-kicker">The training pathway</p><h2>From your application to your first shifts.</h2><p className="officers-lead">LOKD is a certified security training provider. Entry-level training starts with Grades E and D, with grade upgrades and specialist development available as you progress.</p><ol className="officers-steps">{newOfficerSteps.map(([title, detail], index) => <li key={title}><span className="officers-step-number">{String(index + 1).padStart(2, "0")}</span><h3>{title}</h3><p>{detail}</p></li>)}</ol><p>Already registered but due for renewal? LOKD can help with renewal and refresher training before work is offered.</p><Link className="public-text-link" href="/training#training-booking">Book Now</Link></div></section>
  </main><PublicFooter /></div>;
}
