import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { BookingModels, OfficerRecruitment, PublicFooter, PublicHeader, PublicServices } from "./components/public-site-shell";
import { Icon, type IconName } from "./components/icons";
import { BOOKINGS_EMAIL, publicMetadata, requestHostname, workspaceRoleForHost } from "./lib/public-site";

export const dynamic = "force-dynamic";
export const metadata = publicMetadata("Security on your terms", "Book verified security officers for today, tomorrow or ongoing cover in Johannesburg. Choose LOKD Bolt, LOKD Flex, LOKD Fixed or certified security training.", "/");

const bookable: [IconName, string, string, string][] = [
  ["building", "Unarmed guarding", "Grade C minimum", "scheduled_unarmed_fixed_site"],
  ["shield", "Armed security", "Grade B minimum", "armed_static"],
  ["car", "VIP protection", "Grade B minimum", "vip_unarmed"],
];
const credentials: [IconName, string, string][] = [
  ["userCheck", "Identity", "Matched to the officer profile"],
  ["badgeCheck", "PSIRA registration", "Registration and grade checked"],
  ["shield", "Role qualifications", "Relevant to the assignment"],
  ["scan", "Current clearance", "Check the officer’s Passport"],
];
const courses: [IconName, string, string, string][] = [
  ["graduationCap", "Entry-level training", "Start your security career with the foundations.", "Start here"],
  ["badgeCheck", "Grade upgrades", "Build on your training and progress to your next grade.", "Progress"],
  ["shield", "Firearms training", "Develop the competency required for armed roles.", "Specialise"],
  ["car", "VIP protection", "Explore training for close-protection assignments.", "Specialise"],
];

function BookingPanel() {
  return <div className="home-booking-visual">
    <div className="home-orbits" aria-hidden="true"><i /><i /><i /></div>
    <div className="home-booking-panel">
      <div className="site-panel-top"><Image src="/brand/lokd-mark.svg" width={40} height={40} unoptimized alt="" /><span className="site-tag"><Icon name="mapPin" size={14} />Johannesburg</span></div>
      <p className="home-panel-eyebrow">Your security brief</p><h2>What do you need?</h2>
      <div className="home-service-picker">{bookable.map(([icon, label, detail, service]) => <Link key={service} href={"/book?service=" + service}><span className="site-icon"><Icon name={icon} /></span><span><strong>{label}</strong><small>{detail}</small></span><Icon name="arrowUpRight" size={19} /></Link>)}</div>
      <div className="home-when"><span>When do you need cover?</span><div><Link href="/book?when=today">Today</Link><Link href="/book?when=tomorrow">Tomorrow</Link><Link href="/book?when=ongoing">Ongoing</Link></div></div>
      <Link className="home-panel-action" href="/book">Build your booking<Icon name="arrowUpRight" size={20} /></Link>
      <p className="home-panel-foot"><Icon name="shieldCheck" size={16} />PSIRA-verified officers. A brief built around you.</p>
    </div>
    <div className="home-visual-caption"><Icon name="route" size={20} /><span>Local officers.<strong>Dispatched from the closest available pool.</strong></span></div>
  </div>;
}

function TrainingShowcase() {
  return <section className="site-section home-training" id="training" aria-labelledby="training-title"><div className="site-section-head"><div><p className="public-kicker">LOKD Training</p><h2 id="training-title">Your next grade.<br />Your next chapter.</h2></div><div><p>LOKD is a certified training provider. From your first course to specialist skills, take a practical next step.</p><span className="site-tag"><Icon name="graduationCap" size={16} />Certified training provider</span></div></div>
    <div className="home-course-grid">{courses.map(([icon, title, description, stage]) => <article key={title}><div className="site-panel-top"><span className="site-icon"><Icon name={icon} /></span><span className="site-tag">{stage}</span></div><h3>{title}</h3><p>{description}</p><Link href="/training">Explore training<Icon name="arrowUpRight" size={18} /></Link></article>)}</div>
    <div className="home-training-footer"><p>Training is a paid service. Enquire about course requirements and availability.</p><Link className="home-button" href="/training">Explore LOKD Training<Icon name="arrowUpRight" size={20} /></Link></div>
  </section>;
}

export default async function Home() {
  const role = workspaceRoleForHost(requestHostname((await headers()).get("host")));
  if (role) redirect(role === "operations" ? "/ops" : "/" + role);
  return <div className="public-site public-site--home"><PublicHeader /><main id="main-content" tabIndex={-1}>
    <section className="home-hero" aria-labelledby="home-title"><div className="home-hero-copy"><p className="home-location"><Icon name="mapPin" size={16} />On demand across Johannesburg</p><h1 id="home-title">Book officers.<br /><span>On your terms.</span></h1><p className="home-lede">Book verified security officers for today, tomorrow or ongoing cover. Your site. Your schedule. The right people for the role.</p><div className="home-actions"><Link className="home-button" href="/book">Book officers<Icon name="arrowUpRight" size={20} /></Link><Link className="home-button home-button--outline" href="/book?when=ongoing">Ongoing cover<Icon name="calendar" size={20} /></Link></div><p className="home-availability">Short-notice cover is subject to officer availability. Arrival time depends on your location.</p></div><BookingPanel /></section>
    <div className="home-pillars" aria-label="Four ways to work with LOKD"><Link href="/book"><span className="site-icon"><Icon name="clock" /></span><span><strong>LOKD Bolt</strong><small>Less than 72 hours’ notice</small></span><Icon name="arrowUpRight" size={20} /></Link><Link href="/book?model=flex"><span className="site-icon"><Icon name="calendar"/></span><span><strong>LOKD Flex</strong><small>7+ days · 72+ hours’ notice</small></span><Icon name="arrowUpRight" size={20}/></Link><Link href="/book?when=ongoing"><span className="site-icon"><Icon name="calendar" /></span><span><strong>LOKD Fixed</strong><small>Full-time · 3 months+</small></span><Icon name="arrowUpRight" size={20} /></Link><Link href="/training"><span className="site-icon"><Icon name="graduationCap" /></span><span><strong>LOKD Training</strong><small>Certified skills development</small></span><Icon name="arrowUpRight" size={20} /></Link></div>
    <BookingModels />
    <PublicServices />
    <section className="home-passport" aria-labelledby="passport-title"><div><p className="public-kicker">The LOKD Passport</p><h2 id="passport-title">Know who’s<br />at your gate.</h2><p>Scan the officer’s LOKD Passport QR code to check their profile, PSIRA grade and current clearance. An expired or revoked Passport cannot confirm clearance.</p><Link className="home-button home-button--outline" href="/verify">Verify a Passport<Icon name="scan" size={20} /></Link></div><div className="home-credential-panel"><div className="site-panel-top"><Image src="/brand/lokd-mark.svg" width={36} height={36} unoptimized alt="" /><span className="site-tag">LOKD Passport</span></div><div className="home-scan-title"><span><Icon name="scan" size={48} /></span><div><h3>One profile.<br />Clear credentials.</h3><p>Scan the officer’s QR code.</p></div></div><div className="home-credential-grid">{credentials.map(([icon, title, description]) => <div key={title}><Icon name={icon} size={20} /><strong>{title}</strong><span>{description}</span></div>)}</div></div></section>
    <TrainingShowcase />
    <OfficerRecruitment />
    <section className="home-close" aria-labelledby="closing-title"><div><p className="public-kicker">Your next move</p><h2 id="closing-title">Let’s get your<br />cover in place.</h2><p>One shift or an ongoing roster. Start with what you need.</p></div><div><div className="home-actions"><Link className="home-button" href="/book">Book officers<Icon name="arrowUpRight" size={20} /></Link><Link className="home-link" href="/book?when=ongoing">Ongoing cover<Icon name="arrowUpRight" size={18} /></Link></div><a className="home-contact-link" href={"mailto:" + BOOKINGS_EMAIL}><Icon name="messageSquare" size={18} />{BOOKINGS_EMAIL}</a></div></section>
  </main><PublicFooter /></div>;
}
