import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PublicHeader, PublicFooter, PublicProofPoints, PublicServices, PublicSteps, OfficerRecruitment } from "./components/public-site-shell";
import { publicMetadata, requestHostname, workspaceRoleForHost } from "./lib/public-site";

export const dynamic = "force-dynamic";
export const metadata = publicMetadata("Security on your terms", "Book PSIRA-verified officers for guarding, armed security and VIP protection in Johannesburg. Get a clear quote for a shift, event or ongoing cover.", "/");

export default async function Home() {
  const role = workspaceRoleForHost(requestHostname((await headers()).get("host")));
  if (role) redirect(role === "operations" ? "/ops" : "/" + role);
  return <div className="public-site"><PublicHeader /><main id="main-content" tabIndex={-1}>
    <section className="public-home-hero"><div className="public-home-copy"><p className="public-kicker">Johannesburg · South Africa</p><h1>Security.<br />On your terms.</h1><p>Book verified security officers for a shift, an event or ongoing cover, with LOKD keeping you connected every step of the way.</p><div className="public-actions"><Link className="public-button public-button--primary" href="/quote">Get a quote <span aria-hidden="true">↗</span></Link><Link className="public-secondary-link" href="/security-services">Explore our services <span aria-hidden="true">→</span></Link></div><p className="public-hero-caption">Unarmed guarding · Armed security · VIP protection</p></div><div className="public-hero-art" aria-hidden="true"><div className="public-orbit public-orbit--outer" /><div className="public-orbit public-orbit--inner" /><Image src="/brand/lokd-mark.svg" width={518} height={521} alt="" unoptimized priority /><span className="public-art-label">People. Protection. Peace of mind.</span></div></section>
    <section className="public-proof-section" aria-label="The LOKD promise"><PublicProofPoints /></section>
    <PublicServices /><PublicSteps /><OfficerRecruitment />
    <section className="public-section public-section--white public-location"><div><p className="public-kicker">Local cover</p><h2>Built for Johannesburg.</h2><p>From workplaces and residential properties to events and personal protection, tell us where you need cover and we will help you plan it.</p></div><Link href="/locations/johannesburg">Security in Johannesburg <span aria-hidden="true">↗</span></Link></section>
  </main><PublicFooter /></div>;
}
