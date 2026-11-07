import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PublicHeader, PublicFooter } from "./components/public-site-shell";
import { Icon, type IconName } from "./components/icons";
import { BOOKINGS_EMAIL, publicMetadata, requestHostname, workspaceRoleForHost } from "./lib/public-site";

export const dynamic = "force-dynamic";
export const metadata = publicMetadata("Security on your terms", "On-demand security in Johannesburg. Book PSIRA-verified officers for tonight, tomorrow or next month, and follow them from dispatch to your gate.", "/");

const checks: ReadonlyArray<readonly [IconName, string, string]> = [
  ["shieldCheck", "PSIRA-verified officers", "Registration and grade checked against the official record."],
  ["userCheck", "Identity matched", "The officer who arrives is the person on their verified profile."],
  ["badgeCheck", "Qualified for the role", "Armed and VIP work needs extra qualifications and checks."],
  ["fileText", "A clear quote first", "Agree duties, dates and price before any cover starts."],
];

const steps: ReadonlyArray<readonly [IconName, string, string]> = [
  ["mapPin", "Tell us where and when", "Your address, the hours you need and how many officers. It takes about two minutes."],
  ["userCheck", "We match verified officers", "LOKD confirms officers with the right grade and role for your site and sends your price."],
  ["route", "Track them to your gate", "See who is coming, follow them en route and get their arrival time."],
  ["scan", "Check them in on arrival", "Scan their LOKD Passport at your gate, then follow check-ins and patrols in your Client Zone."],
];

const bookable: ReadonlyArray<readonly [IconName, string, string, string]> = [
  ["shieldCheck", "A guard tonight", "Unarmed, from 6 hours' notice", "/quote?service=scheduled_unarmed_fixed_site&when=today#quote-form"],
  ["calendar", "Event security", "Access, crowds and VIP arrivals", "/quote?service=scheduled_unarmed_fixed_site#quote-form"],
  ["shield", "Armed guard", "Armed site security", "/quote?service=armed_static#quote-form"],
  ["car", "VIP protection", "Close protection and drivers", "/quote?service=vip_unarmed#quote-form"],
];

const notice: ReadonlyArray<readonly [string, string]> = [
  ["Under 6 hours", "Immediate cover for an incident, a no-show or a last-minute need."],
  ["6 to 24 hours", "Tonight, tomorrow morning or this weekend."],
  ["1 to 3 days", "Events, deliveries and short projects."],
  ["3 days or more", "Planned shifts and ongoing rosters at your contracted rate."],
];

const pathway: ReadonlyArray<readonly [IconName, string]> = [
  ["clipboard", "Apply"], ["graduationCap", "Train"], ["badgeCheck", "Register with PSIRA"], ["shieldCheck", "Get verified"], ["calendar", "Work shifts"], ["arrowUpRight", "Grow your grade"],
];

function Perimeter() {
  return <svg className="home-perimeter" viewBox="0 0 640 640" aria-hidden="true" focusable="false">
    <circle className="home-ring" cx="320" cy="320" r="312" />
    <circle className="home-ring home-ring--dash" cx="320" cy="320" r="236" />
    <circle className="home-ring" cx="320" cy="320" r="160" />
    <circle className="home-ping" cx="320" cy="8" r="7" />
    <circle className="home-ping" cx="487" cy="487" r="7" />
    <circle className="home-ping" cx="84" cy="320" r="7" />
  </svg>;
}

function HeroVisual() {
  return <div className="home-visual" aria-hidden="true">
    <Perimeter />
    <div className="home-ui home-dispatch">
      <div className="home-map">
        <svg viewBox="0 0 380 170" preserveAspectRatio="xMidYMid slice"><path className="home-street" d="M0 40H380M0 120H380M90 0V170M230 0V170M320 0V170M0 160 380 10" /><path className="home-path" d="M40 150 90 120 90 40 230 40 300 22" /><circle cx="300" cy="22" r="9" className="home-dest" /><circle cx="150" cy="40" r="8" className="home-car" /></svg>
        <span className="home-eta"><b>24</b> min away</span>
      </div>
      <div className="home-dispatch-body">
        <div className="home-officer"><span className="home-avatar">TM</span><div><strong>Thabo Mokoena</strong><span>PSIRA grade B, Passport verified</span></div><em><i />En route</em></div>
        <ol className="home-timeline">
          <li className="is-done"><b>19:02</b><span>Cover requested, Rosebank</span></li>
          <li className="is-done"><b>19:06</b><span>Officer confirmed</span></li>
          <li className="is-done"><b>19:10</b><span>Dispatched to your site</span></li>
          <li className="is-next"><b>19:34</b><span>Arriving at the main gate</span></li>
        </ol>
      </div>
    </div>
    <div className="home-ui home-toast"><span><Icon name="bell" size={20} /></span><div><strong>Cover booked for tonight</strong><small>2 officers, 20:00 to 06:00</small></div></div>
  </div>;
}

function GuardingPanel() {
  return <div className="home-tile-ui" aria-hidden="true">
    <div className="home-log-row"><Icon name="doorOpen" size={18} /><span>Visitor signed in, delivery bay</span><b>09:14</b></div>
    <div className="home-log-row"><Icon name="route" size={18} /><span>Patrol complete, north wing</span><b>10:00</b></div>
    <div className="home-log-row is-blue"><Icon name="bell" size={18} /><span>Gate left open, closed by officer</span><b>10:22</b></div>
  </div>;
}

function ArmedPanel() {
  return <div className="home-tile-ui home-requirements" aria-hidden="true">
    <p>Assignment requirements</p>
    <span><Icon name="clipboard" size={18} />Site risk assessed<b>Done</b></span>
    <span><Icon name="shieldCheck" size={18} />PSIRA grade A or B<b>Matched</b></span>
    <span><Icon name="badgeCheck" size={18} />Firearm competency<b>Current</b></span>
    <span><Icon name="userCheck" size={18} />Identity matched<b>Verified</b></span>
  </div>;
}

function VipPanel() {
  return <ol className="home-tile-ui home-itinerary" aria-hidden="true">
    <li><b>07:30</b><span>Pick-up, Sandhurst</span></li>
    <li><b>08:15</b><span>Arrival, Sandton conference centre</span></li>
    <li><b>13:00</b><span>Lunch, Melrose Arch</span></li>
  </ol>;
}

export default async function Home() {
  const role = workspaceRoleForHost(requestHostname((await headers()).get("host")));
  if (role) redirect(role === "operations" ? "/ops" : "/" + role);
  return <div className="public-site public-site--home"><PublicHeader /><main id="main-content" tabIndex={-1}>
    <section className="home-hero">
      <div className="home-hero-copy">
        <p className="home-location"><Icon name="clock" size={18} />On demand across Johannesburg</p>
        <h1>Security.<br />On demand.</h1>
        <p className="home-lede">Book PSIRA-verified security officers the way you book any other service: choose what you need, get matched with verified officers, and follow them from dispatch to your gate.</p>
        <div className="home-book">
          <p>What do you need?</p>
          <ul>{bookable.map(([icon, title, detail, href]) => <li key={title}><Link href={href}><span className="home-icon"><Icon name={icon} /></span><span><strong>{title}</strong><small>{detail}</small></span></Link></li>)}</ul>
        </div>
        <div className="home-actions"><Link className="home-button" href="/quote">Get a quote<Icon name="arrowUpRight" size={20} /></Link><Link className="home-link" href="/security-services">See our services</Link></div>
      </div>
      <HeroVisual />
    </section>

    <section className="home-checks" aria-label="How LOKD checks every officer">
      <ul>{checks.map(([icon, title, text]) => <li key={title}><span className="home-icon"><Icon name={icon} /></span><div><h2>{title}</h2><p>{text}</p></div></li>)}</ul>
    </section>

    <section className="home-notice" aria-labelledby="home-notice-title">
      <div className="home-head"><h2 id="home-notice-title">On demand, or every day.</h2><p>Book one-off cover at any notice with LOKD Flex, or set up permanent officers on a fixed roster with LOKD Fixed. Short-notice Flex bookings include a dispatch premium, always shown before you confirm.</p></div>
      <div className="home-models"><div className="home-model"><h3><Icon name="clock" />LOKD Flex</h3><p>One-off and short-notice cover.</p><ol className="home-notice-scale">{notice.map(([title, text], index) => <li key={title} className={index === 0 ? "is-hot" : undefined}><span className="home-notice-bar" /><h3>{title}</h3><p>{text}</p></li>)}</ol></div><div className="home-model home-model--fixed"><h3><Icon name="users" />LOKD Fixed</h3><p>Permanent officers on a planned roster at your contracted rate.</p><ul><li><Icon name="circleCheck" size={18} />The same verified officers, shift after shift</li><li><Icon name="circleCheck" size={18} />Weekday, six-day or daily rosters</li><li><Icon name="circleCheck" size={18} />Relief officers dispatched when someone is off</li></ul><Link className="home-link" href="/quote?service=scheduled_unarmed_fixed_site#quote-form">Set up permanent cover</Link></div></div>
    </section>

    <section className="home-services" aria-labelledby="home-services-title">
      <div className="home-head"><h2 id="home-services-title">Choose the cover you need.</h2><p>For a single shift, an event or ongoing cover across Johannesburg, staffed by officers checked for the role.</p></div>
      <div className="home-bento">
        <article className="home-tile home-tile--wide"><span className="home-icon home-icon--red"><Icon name="building" /></span><h3>Unarmed guarding</h3><p>Access control, visitor checks and patrols at your property or event, with every entry recorded.</p><GuardingPanel /><Link href="/security-services">Explore guarding<Icon name="arrowUpRight" size={18} /></Link></article>
        <article className="home-tile home-tile--dark"><span className="home-icon home-icon--blue"><Icon name="shield" /></span><h3>Armed security</h3><p>Armed site guarding and movement protection, matched to the risk.</p><ArmedPanel /><Link href="/armed-security">Explore armed security<Icon name="arrowUpRight" size={18} /></Link></article>
        <article className="home-tile"><span className="home-icon home-icon--slate"><Icon name="car" /></span><h3>VIP protection</h3><p>Close protection and protective drivers, planned around your day.</p><VipPanel /><Link href="/vip-protection">Explore VIP protection<Icon name="arrowUpRight" size={18} /></Link></article>
        <article className="home-tile home-tile--sectors"><h3>Who we protect</h3><ul><li><Icon name="building" size={18} />Workplaces and retail</li><li><Icon name="users" size={18} />Residential estates</li><li><Icon name="clipboard" size={18} />Construction and logistics</li><li><Icon name="calendar" size={18} />Events and venues</li></ul><Link href="/industries">See industries<Icon name="arrowUpRight" size={18} /></Link></article>
      </div>
    </section>

    <section className="home-passport" aria-labelledby="home-passport-title">
      <div className="home-passport-copy">
        <h2 id="home-passport-title">Know who is at your gate.</h2>
        <p>Every LOKD officer carries a LOKD Passport. Scan its QR code when they arrive to confirm their name, PSIRA grade and current clearance. An expired or revoked Passport cannot confirm clearance.</p>
        <Link className="home-link home-link--light" href="/verify">Verify a Passport</Link>
      </div>
      <div className="home-pass" aria-hidden="true">
        <div className="home-pass-top"><Image src="/brand/lokd-mark-reverse.svg" width={40} height={40} alt="" unoptimized /><span>LOKD Passport</span><em><Icon name="circleCheck" size={16} />Verified</em></div>
        <div className="home-pass-body">
          <div className="home-pass-person"><span className="home-avatar home-avatar--lg">TM</span><div><strong>Thabo Mokoena</strong><span>Security officer</span></div></div>
          <Image className="home-pass-qr" src="/lokd-passport-qr.svg" width={112} height={112} alt="" unoptimized />
        </div>
        <dl><div><dt>PSIRA grade</dt><dd>B</dd></div><div><dt>Role</dt><dd>Unarmed guarding</dd></div><div><dt>Valid until</dt><dd>31 Mar 2027</dd></div></dl>
      </div>
    </section>

    <section className="home-steps" aria-labelledby="home-steps-title">
      <h2 id="home-steps-title">From request to officers at your gate.</h2>
      <ol>{steps.map(([icon, title, text], index) => <li key={title}><span className="home-step-icon"><Icon name={icon} /><b>{index + 1}</b></span><h3>{title}</h3><p>{text}</p></li>)}</ol>
    </section>

    <section className="home-officers" aria-labelledby="home-officers-title">
      <div className="home-officers-copy">
        <h2 id="home-officers-title">Your skills. Your next shift.</h2>
        <p>Apply to LOKD, complete your verification and accept shifts that match your grade and availability. New to the industry? We can help you plan your training.</p>
        <div className="home-actions"><Link className="home-button" href="/join">Apply as an officer<Icon name="arrowUpRight" size={20} /></Link><Link className="home-link home-link--light" href="/training"><Icon name="graduationCap" size={20} />Training and development</Link></div>
      </div>
      <div className="home-phone" aria-hidden="true">
        <div className="home-phone-screen">
          <p className="home-phone-title">New shift offer</p>
          <div className="home-offer"><strong>Melrose Arch retail centre</strong><span><Icon name="calendar" size={16} />Sat 14 Nov, 07:00 to 19:00</span><span><Icon name="badgeCheck" size={16} />Grade C or above</span><span><Icon name="doorOpen" size={16} />Access control, main entrance</span></div>
          <div className="home-offer-actions"><span>Decline</span><span>Accept shift</span></div>
        </div>
      </div>
    </section>

    <section className="home-pathway" aria-labelledby="home-pathway-title">
      <div className="home-head"><h2 id="home-pathway-title">From first application to specialist work.</h2><p>New to security or ready for your next grade, LOKD takes you through every step: training, PSIRA registration, verification and your first shifts.</p></div>
      <ol className="home-pathway-track">{pathway.map(([icon, title]) => <li key={title}><span className="home-icon"><Icon name={icon} /></span><span>{title}</span></li>)}</ol>
      <Link className="home-link" href="/training"><Icon name="graduationCap" size={20} />See the full training pathway</Link>
    </section>

    <section className="home-close" aria-labelledby="home-close-title">
      <div><h2 id="home-close-title">Tell us about your site.</h2><p>Share your address, dates and the cover you need, and we will send a clear quote. Prefer email? Write to <a href={"mailto:" + BOOKINGS_EMAIL}>{BOOKINGS_EMAIL}</a>.</p></div>
      <div className="home-actions"><Link className="home-button" href="/quote">Start your quote<Icon name="arrowUpRight" size={20} /></Link><Link className="home-link" href="/locations/johannesburg"><Icon name="mapPin" size={20} />Security in Johannesburg</Link></div>
    </section>
  </main><PublicFooter /></div>;
}
