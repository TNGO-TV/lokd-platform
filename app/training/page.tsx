import Link from "next/link";
import { PublicFooter, PublicHeader } from "../components/public-site-shell";
import { Icon } from "../components/icons";
import { publicMetadata } from "../lib/public-site";
import { trainingCourses } from "../lib/training-courses";
import TrainingBookingForm from "./booking-form";
import "../styles/officers.css";

export const metadata = publicMetadata("Certified security training", "Train at LOKD, a certified security training provider. Explore Grades E to A, firearms competency, armed readiness and VIP / close protection, and request a training place.", "/training");

export default function TrainingPage() {
  return <div className="public-site officers-site"><PublicHeader active="officers" /><main id="main-content" tabIndex={-1}>
    <section className="officers-hero officers-container"><p className="public-kicker">Certified security training provider</p><h1>Security training at LOKD.</h1><p className="officers-lead">Build the skills your next role needs. LOKD is a certified security training provider, offering entry-level courses, grade upgrades and specialist development for security officers.</p><p>Choose a course and request your preferred intake month. Our training team will confirm the entry requirements, available dates and next steps.</p><a className="public-text-link" href="mailto:training@lokd.co.za">training@lokd.co.za</a></section>
    {(["Entry level", "Grade upgrades", "Specialist training"] as const).map(category => <section className="officers-section officers-section--white" key={category} aria-labelledby={category.replaceAll(" ", "-")}><div className="officers-container"><p className="public-kicker">Training at LOKD</p><h2 id={category.replaceAll(" ", "-")}>{category === "Entry level" ? "Start with Grades E and D." : category === "Grade upgrades" ? "Progress through Grades C, B and A." : "Develop specialist skills."}</h2><div className="officers-course-grid">{trainingCourses.filter(course => course.category === category).map(course => <article className="officers-course" key={course.id}><Icon name={category === "Specialist training" ? "shieldCheck" : "graduationCap"} size={30} /><h3>{course.name}</h3><dl><dt>Who it is for</dt><dd>{course.audience}</dd><dt>What it covers</dt><dd>{course.covers}</dd><dt>The outcome</dt><dd>{course.outcome}</dd></dl><Link className="public-button public-button--primary" href={"/training?course=" + course.id + "#training-booking"} aria-label={"Book a place — " + course.name}>Book a place</Link></article>)}</div></div></section>)}
    <section className="officers-section"><div className="officers-container"><h2>Renewal and refresher support</h2><p className="officers-lead">If your PSIRA registration needs renewal, LOKD can help you understand the renewal process and the refresher training you may need before work is offered.</p><Link className="public-text-link" href="/join?path=registered">Apply with a registration that needs renewal</Link></div></section>
    <section id="training-booking" className="public-form-section officers-booking"><TrainingBookingForm /></section>
    <section className="officers-section officers-section--white"><div className="officers-container"><h2>Training is a step towards the work.</h2><p>Completing training does not guarantee an assignment. PSIRA registration, identity checks and the qualifications required for a role must be confirmed before security work is offered.</p><Link className="public-text-link" href="/join?path=new">Apply as an officer</Link></div></section>
  </main><PublicFooter /></div>;
}
