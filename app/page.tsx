import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { BookingScale, HeroBuilder, OfficerRecruitment, PublicFooter, PublicHeader, PublicServices } from "./components/public-site-shell";
import { DispatchMap, GradeLadder, PassportCredential, Photo } from "./components/public-visuals";
import { BOOKINGS_EMAIL, publicMetadata, requestHostname, workspaceRoleForHost } from "./lib/public-site";

export const dynamic = "force-dynamic";
export const metadata = publicMetadata("Security on your terms", "Book verified security officers for today, tomorrow or ongoing cover in Johannesburg. Choose LOKD Bolt, LOKD Flex, LOKD Fixed or certified security training.", "/");

const passportChecks: [string, string][] = [
  ["Identity", "Matched to the officer profile"],
  ["PSIRA registration", "Registration and grade checked"],
  ["Role qualifications", "Relevant to the assignment"],
  ["Current clearance", "Valid, expired or revoked"],
];

export default async function Home() {
  const role = workspaceRoleForHost(requestHostname((await headers()).get("host")));
  if (role) redirect(role === "operations" ? "/ops" : "/" + role);
  return <div className="public-site public-site--home"><PublicHeader overlay /><main id="main-content" tabIndex={-1}>
    <section className="hero" aria-labelledby="home-title">
      <div className="hero-map"><DispatchMap id="hero-map" /></div>
      <div className="hero-inner">
        <h1 id="home-title" className="t-hero">Book officers.<br /><span>On your terms.</span></h1>
        <HeroBuilder />
      </div>
    </section>

    <BookingScale />
    <PublicServices />

    <section className="band band--white" aria-labelledby="passport-title"><div className="site-wrap passport-band">
      <div>
        <h2 id="passport-title" className="t-section">Know who’s at your gate.</h2>
        <p className="t-lead">Every LOKD officer carries a Passport. Scan its QR code to check the officer’s profile, PSIRA grade and current clearance. An expired or revoked Passport cannot confirm clearance.</p>
        <Link className="btn btn--line" href="/verify">Verify a Passport</Link>
        <ul className="passport-checks" aria-label="What a Passport confirms">{passportChecks.map(([title, detail]) => <li key={title}><strong>{title}</strong><span>{detail}</span></li>)}</ul>
      </div>
      <PassportCredential />
    </div></section>

    <section className="band training-band" aria-labelledby="training-title">
      <Photo name="range-outdoor" sizes="100vw" alt="" />
      <div className="site-wrap training-grid">
        <div>
          <h2 id="training-title" className="t-section">Your next grade starts here.</h2>
          <p className="t-lead">LOKD Training takes officers from Grade E to Grade A, with specialist courses beyond. LOKD is a certified training provider. Training is a paid service.</p>
          <Link className="btn btn--light" href="/training">Explore LOKD Training</Link>
        </div>
        <GradeLadder />
      </div>
    </section>

    <OfficerRecruitment />

    <section className="close-band" aria-labelledby="closing-title"><div className="site-wrap close-grid">
      <h2 id="closing-title">Let’s get your cover in place.</h2>
      <div className="close-aside">
        <p className="t-lead">One shift or an ongoing roster. Start with what you need, and LOKD Operations confirms the officers and price with you.</p>
        <div className="site-actions"><Link className="btn btn--red" href="/book">Book officers</Link><Link className="btn btn--line" href="/book?when=ongoing">Ongoing cover</Link></div>
        <a className="close-mail" href={"mailto:" + BOOKINGS_EMAIL}>{BOOKINGS_EMAIL}</a>
      </div>
    </div></section>
  </main><PublicFooter /></div>;
}
