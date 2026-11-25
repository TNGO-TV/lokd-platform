import Link from "next/link";
import { PublicPage, PublicSteps, OfficerRecruitment, PublicFeatureGrid } from "../components/public-site-shell";
import { PassportCredential } from "../components/public-visuals";
import { publicMetadata } from "../lib/public-site";

export const metadata = publicMetadata("Officer checks and verification", "Learn how LOKD checks PSIRA registration, identity and role qualifications. Verify an officer’s LOKD Passport before your Johannesburg assignment.", "/compliance");
const cards = [["PSIRA registration","An officer’s registration is checked against the official record, including the status and grade relevant to the work."],["Identity","Identity checks connect the registered person to their LOKD officer profile."],["Role qualifications","Armed and VIP assignments require additional qualifications and checks specific to those duties."],["LOKD Passport","Use the officer’s current Passport QR code to check their status. An expired or revoked Passport cannot confirm current clearance."]] as const;
export default function Page() {
  return <PublicPage active="about" title="Know who is protecting you." promise="LOKD checks an officer’s registration, identity and role qualifications before approving them for an assignment." visual={<div className="page-hero-visual--passport"><PassportCredential /></div>}>
    <PublicFeatureGrid title="Checks that support each assignment." white features={cards.map(([title, description]) => ({ title, description }))} />
    <section className="band"><div className="site-wrap site-actions"><Link className="btn btn--line" href="/verify">Check a LOKD Passport</Link><p className="t-soft">Scan the QR code on the officer’s Passport, or paste the link they share with you.</p></div></section>
    <PublicSteps />
    <OfficerRecruitment />
  </PublicPage>;
}
