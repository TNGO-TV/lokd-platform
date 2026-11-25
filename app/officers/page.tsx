import Link from "next/link";
import { Icon } from "../components/icons";
import { PublicFooter, PublicHeader } from "../components/public-site-shell";
import { GradeLadder, PassportCredential, Photo } from "../components/public-visuals";
import { publicMetadata } from "../lib/public-site";
import { newOfficerSteps } from "../lib/psira-pathway";

export const metadata = publicMetadata("Security work and officer training", "Join LOKD for on-demand and contract security work, PSIRA renewal support or certified entry-level and specialist training.", "/officers");
const work: Array<{ title: string; description: string }> = [
  { title: "Offers in your Officer Zone", description: "See the location, duties, shift times and requirements before you accept an assignment." },
  { title: "On-demand and roster work", description: "Share your availability for individual shifts, recurring rosters and contract security work." },
  { title: "Work matched to your grade", description: "Assignments are matched to your current registration, grade, qualifications and completed checks." },
];

export default function OfficersPage() {
  return <div className="public-site officers-site"><PublicHeader active="officers" /><main id="main-content" tabIndex={-1}>
    <section className="page-hero"><div className="page-hero-inner">
      <div>
        <h1>Put your skills to work.</h1>
        <p className="t-lead">LOKD recruits officers for on-demand shifts and contract security work. Whether you are registered, renewing your registration or starting out, choose the route that fits you.</p>
        <p><Link className="site-arrow-link" href="/sign-in?return_to=%2Fofficer">Already applied? Open the Officer Zone<Icon name="arrowUpRight" size={18} /></Link></p>
      </div>
      <div className="page-hero-visual"><Photo name="officer-radio-portrait" priority sizes="(max-width: 1060px) 100vw, 45vw" alt="A uniformed security officer speaking on a two-way radio outside an office building" /></div>
    </div></section>

    <section aria-label="Choose your application route">
      <div className="officers-options doors">
        <Link className="door door--photo" href="/join?path=registered" aria-label="PSIRA Registered or renewal">
          <Photo name="night-patrol-portrait" sizes="(max-width: 760px) 100vw, 50vw" alt="" />
          <h2 className="t-section">PSIRA Registered or renewal</h2>
          <p>Apply with your PSIRA number and grade. Tell us your work interests and availability, or ask for renewal and refresher support.</p>
          <span className="door-go">Continue<Icon name="arrowUpRight" size={22} /></span>
        </Link>
        <Link className="door door--canvas" href="/join?path=new" aria-label="New Application">
          <h2 className="t-section">New Application</h2>
          <p>Not yet registered? Start with your details and training interests. LOKD guides you from your ID check through training and registration.</p>
          <span className="door-go">Continue<Icon name="arrowUpRight" size={22} /></span>
        </Link>
      </div>
    </section>

    <section className="band band--white" aria-labelledby="work-title"><div className="site-wrap editorial">
      <div><h2 id="work-title" className="t-section">Clear offers. Suitable work.</h2><p className="t-lead" style={{ marginTop: 20 }}>Applying does not guarantee an assignment. Work is offered only when the registration, identity and role requirements have been met.</p></div>
      <ul className="editorial-list">{work.map(item => <li key={item.title}><h3>{item.title}</h3><p>{item.description}</p></li>)}</ul>
    </div></section>

    <section className="band" aria-labelledby="checks-title"><div className="site-wrap passport-band">
      <div>
        <h2 id="checks-title" className="t-section">Ready for the role.</h2>
        <p className="t-lead">Before work is offered, LOKD checks identity, current PSIRA registration, grade and the qualifications needed for the assignment. Armed and specialist work require the appropriate additional checks.</p>
        <p className="t-soft" style={{ marginBottom: 24 }}>Your LOKD Passport brings your checked officer profile and status together. A current Passport supports verification; it does not replace PSIRA registration.</p>
        <div className="site-actions"><Link className="site-arrow-link" href="/compliance">Understand our checks<Icon name="arrowUpRight" size={18} /></Link><Link className="site-arrow-link" href="/verify">Check a LOKD Passport<Icon name="arrowUpRight" size={18} /></Link></div>
      </div>
      <PassportCredential grade="Grade C" />
    </div></section>

    <section className="band band--white" aria-labelledby="pathway-title"><div className="site-wrap">
      <div className="band-head"><h2 id="pathway-title" className="t-section">From your application to your first shifts.</h2><p className="t-lead">LOKD is a certified security training provider. Entry-level training starts with Grades E and D, with grade upgrades and specialist development as you progress.</p></div>
      <ol className="sequence sequence--six officers-steps">{newOfficerSteps.map(([title, detail]) => <li key={title}><h3>{title}</h3><p>{detail}</p></li>)}</ol>
    </div></section>

    <section className="band training-band" aria-labelledby="officer-training-title">
      <Photo name="range-outdoor" sizes="100vw" alt="" />
      <div className="site-wrap training-grid">
        <div>
          <h2 id="officer-training-title" className="t-section">Renewing, or ready for the next grade?</h2>
          <p className="t-lead">Already registered but due for renewal? LOKD can help with renewal and refresher training before work is offered. Training is a paid service.</p>
          <Link className="btn btn--light" href="/training#training-booking">Book now</Link>
        </div>
        <GradeLadder />
      </div>
    </section>
  </main><PublicFooter /></div>;
}
