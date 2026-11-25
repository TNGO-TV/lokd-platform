import Link from "next/link";
import { PublicFooter, PublicHeader } from "../components/public-site-shell";
import { GradeLadder, Photo } from "../components/public-visuals";
import { publicMetadata } from "../lib/public-site";
import { trainingCourses } from "../lib/training-courses";
import TrainingBookingForm from "./booking-form";

export const metadata = publicMetadata("Certified security training", "Train at LOKD, a certified security training provider. Explore Grades E to A, firearms competency, armed readiness and VIP / close protection, and book your training.", "/training");

const groups = [
  ["Entry level", "Start with Grades E and D."],
  ["Grade upgrades", "Progress through Grades C, B and A."],
  ["Specialist training", "Develop specialist skills."],
] as const;

export default function TrainingPage() {
  return <div className="public-site officers-site"><PublicHeader active="training" /><main id="main-content" tabIndex={-1}>
    <section className="page-hero officers-hero"><div className="page-hero-inner">
      <div>
        <h1>Security training at LOKD.</h1>
        <p className="t-lead">Build the skills your next role needs. LOKD is a certified security training provider, offering entry-level courses, grade upgrades and specialist development for security officers. Training is a paid service.</p>
        <p className="t-soft" style={{ color: "var(--on-dark-soft)", marginBottom: 30 }}>Choose a course and complete the booking form. Our training team confirms the entry requirements, available dates and next steps.</p>
        <a className="btn btn--red" href="#training-booking">Book now</a>
      </div>
      <div className="page-hero-visual">
        <video className="training-video" autoPlay muted loop playsInline preload="metadata" poster="/images/range-video-poster-1280.jpg" aria-hidden="true">
          <source src="/video/range-1280.webm" type="video/webm" />
          <source src="/video/range-1280.mp4" type="video/mp4" />
        </video>
        <Photo name="range-video-poster" className="training-video-still" priority sizes="(max-width: 1060px) 100vw, 45vw" alt="" />
      </div>
    </div></section>

    <section className="band band--white" aria-labelledby="ladder-title"><div className="site-wrap training-grid">
      <div>
        <h2 id="ladder-title" className="t-section">From Grade E to Grade A, and beyond.</h2>
        <p className="t-lead" style={{ color: "var(--ink-soft)" }}>Each grade builds on the last. Specialist courses branch off once you have the grade and registration the work requires. LOKD is a SAPS-certified training provider for firearms competency.</p>
      </div>
      <GradeLadder light />
    </div></section>

    {groups.map(([category, title], index) => <section className={"course-group" + (index === 1 ? "" : "")} key={category} aria-labelledby={category.replaceAll(" ", "-")}><div className="site-wrap">
      {index === 2 && <div className="training-photo-strip" style={{ marginBottom: 56 }}>
        <Photo name="range-indoor" sizes="(max-width: 760px) 100vw, 55vw" alt="An officer kneeling in a firing position during firearms training on an indoor range" />
        <Photo name="range-outdoor" sizes="(max-width: 760px) 100vw, 45vw" alt="A trainee wearing ear protection aims a pistol at targets on an outdoor range" />
      </div>}
      <h2 id={category.replaceAll(" ", "-")} className="t-section">{title}</h2>
      <div className="course-list">{trainingCourses.filter(course => course.category === category).map(course => <article className="officers-course" key={course.id}>
        <h3>{course.name}{course.id === "firearms-competency" && <span className="saps">SAPS-certified</span>}</h3>
        <dl><div><dt>Who it is for</dt><dd>{course.audience}</dd></div><div><dt>What it covers</dt><dd>{course.covers}</dd></div><div><dt>The outcome</dt><dd>{course.outcome}</dd></div></dl>
        <Link className="btn btn--red" href={"/training?course=" + course.id + "#training-booking"} aria-label={"Book now — " + course.name}>Book now</Link>
      </article>)}</div>
    </div></section>)}

    <section className="band band--white" aria-labelledby="renewal-title"><div className="site-wrap editorial">
      <h2 id="renewal-title" className="t-section">Renewal and refresher support</h2>
      <div><p className="t-lead">If your PSIRA registration needs renewal, LOKD can help you understand the renewal process and the refresher training you may need before work is offered.</p><p style={{ marginTop: 22 }}><Link className="site-arrow-link" href="/join?path=registered">Apply with a registration that needs renewal</Link></p></div>
    </div></section>

    <section id="training-booking" className="public-form-section officers-booking"><TrainingBookingForm /></section>

    <section className="band band--dark" aria-labelledby="training-work-title"><div className="site-wrap editorial">
      <h2 id="training-work-title" className="t-section">Training is a step towards the work.</h2>
      <div><p className="t-lead" style={{ color: "var(--on-dark-soft)" }}>Completing training does not guarantee an assignment. PSIRA registration, identity checks and the qualifications required for a role must be confirmed before security work is offered.</p><p style={{ marginTop: 26 }}><Link className="btn btn--light" href="/join?path=new">Apply as an officer</Link></p></div>
    </div></section>
  </main><PublicFooter /></div>;
}
