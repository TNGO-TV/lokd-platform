import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PublicHeader, PublicFooter } from "./components/public-site-shell";
import { Icon, type IconName } from "./components/icons";
import { BOOKINGS_EMAIL, publicMetadata, requestHostname, workspaceRoleForHost } from "./lib/public-site";

export const dynamic = "force-dynamic";
export const metadata = publicMetadata("Security on your terms", "Book PSIRA-verified officers for guarding, armed security and VIP protection in Johannesburg. Get a clear quote for a shift, event or ongoing cover.", "/");

const checks: ReadonlyArray<readonly [IconName, string, string]> = [
  ["shieldCheck", "PSIRA-verified officers", "Registration and grade checked against the official record."],
  ["userCheck", "Identity matched", "The officer who arrives is the person on their verified profile."],
  ["badgeCheck", "Qualified for the role", "Armed and VIP work needs extra qualifications and checks."],
  ["fileText", "A clear quote first", "Agree duties, dates and price before any cover starts."],
];

const steps: ReadonlyArray<readonly [IconName, string, string]> = [
  ["clipboard", "Tell us what you need", "Choose a service and share your site, dates, hours and number of officers."],
  ["fileText", "Agree your quote", "We review your requirements and send a clear scope and price to accept."],
  ["shieldCheck", "Your officers arrive", "Verified and briefed, with check-ins and patrols you can follow in your Client Zone."],
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
    <div className="home-ui home-shift">
      <div className="home-shift-head"><span className="home-site-icon"><Icon name="building" size={20} /></span><div><strong>Rosebank office park</strong><span>Night shift, 18:00 to 06:00</span></div><em><i />On site</em></div>
      <div className="home-officer"><span className="home-avatar">TM</span><div><strong>Thabo Mokoena</strong><span>PSIRA grade B</span></div><span className="home-time"><Icon name="clock" size={16} />17:52</span></div>
      <ol className="home-checkpoints">
        <li><Icon name="circleCheck" size={18} /><span>Main gate</span><b>21:00</b></li>
        <li><Icon name="circleCheck" size={18} /><span>Perimeter fence</span><b>21:20</b></li>
        <li><Icon name="circleCheck" size={18} /><span>Basement parking</span><b>21:45</b></li>
        <li className="is-next"><Icon name="clock" size={18} /><span>Next patrol</span><b>22:30</b></li>
      </ol>
    </div>
    <div className="home-ui home-toast"><span><Icon name="scan" size={20} /></span><div><strong>Passport verified</strong><small>Scanned at the main gate</small></div></div>
    <div className="home-ui home-route">
      <svg viewBox="0 0 220 120"><path className="home-street" d="M0 30H220M0 90H220M60 0V120M160 0V120" /><path className="home-path" d="M20 102 60 90 60 30 160 30 196 16" /><circle cx="196" cy="16" r="7" className="home-dest" /><circle cx="60" cy="62" r="6" className="home-car" /></svg>
      <div><strong>Relief officer en route</strong><small>Arrives in 8 minutes</small></div>
    </div>
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
        <p className="home-location"><Icon name="mapPin" size={18} />Johannesburg, South Africa</p>
        <h1>Security.<br />On your terms.</h1>
        <p className="home-lede">Book PSIRA-verified officers for a single shift, an event or ongoing cover. Agree the scope and price first, then see who is on site, when they arrived and what they checked.</p>
        <div className="home-actions"><Link className="home-button" href="/quote">Get a quote<Icon name="arrowUpRight" size={20} /></Link><Link className="home-link" href="/security-services">See our services</Link></div>
      </div>
      <HeroVisual />
    </section>

    <section className="home-checks" aria-label="How LOKD checks every officer">
      <ul>{checks.map(([icon, title, text]) => <li key={title}><span className="home-icon"><Icon name={icon} /></span><div><h2>{title}</h2><p>{text}</p></div></li>)}</ul>
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
      <h2 id="home-steps-title">From your request to reliable cover.</h2>
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

    <section className="home-close" aria-labelledby="home-close-title">
      <div><h2 id="home-close-title">Tell us about your site.</h2><p>Share your address, dates and the cover you need, and we will send a clear quote. Prefer email? Write to <a href={"mailto:" + BOOKINGS_EMAIL}>{BOOKINGS_EMAIL}</a>.</p></div>
      <div className="home-actions"><Link className="home-button" href="/quote">Start your quote<Icon name="arrowUpRight" size={20} /></Link><Link className="home-link" href="/locations/johannesburg"><Icon name="mapPin" size={20} />Security in Johannesburg</Link></div>
    </section>
  </main><PublicFooter /></div>;
}
