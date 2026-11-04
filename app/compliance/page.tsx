import Link from "next/link";
import { PublicPage, PublicSteps, OfficerRecruitment } from "../components/public-site-shell";
import { publicMetadata } from "../lib/public-site";

export const metadata = publicMetadata("Officer checks and verification", "Learn how LOKD checks PSIRA registration, identity and role qualifications. Verify an officer’s LOKD Passport before your Johannesburg assignment.", "/compliance");
const cards = [["PSIRA registration","An officer’s registration is checked against the official record, including the status and grade relevant to the work."],["Identity","Identity checks connect the registered person to their LOKD officer profile."],["Role qualifications","Armed and VIP assignments require additional qualifications and checks specific to those duties."],["LOKD Passport","Use the officer’s current Passport QR code to check their status. An expired or revoked Passport cannot confirm current clearance."]] as const;
export default function Page() {
  return <PublicPage active="about" eyebrow="Our checks" title="Know who is protecting you." promise="LOKD checks an officer’s registration, identity and role qualifications before approving them for an assignment.">

    <section className="public-section public-section--white"><div className="public-section-heading"><h2>Checks that support each assignment.</h2></div><div className="public-detail-grid">{cards.map(([title, description]) => <article key={title}><h3>{title}</h3><p>{description}</p></article>)}</div><Link className="public-text-link" href="/verify">Check a LOKD Passport →</Link></section>

    <PublicSteps />
    <OfficerRecruitment />
  </PublicPage>;
}
