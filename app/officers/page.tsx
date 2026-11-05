import Link from "next/link";
import { PublicPage, PublicSteps } from "../components/public-site-shell";
import { publicMetadata } from "../lib/public-site";

export const metadata = publicMetadata("Security officer opportunities", "Apply to LOKD for security work in Johannesburg. Complete PSIRA and identity checks, find suitable shifts and manage your work through the app.", "/officers");
const cards = [["A profile that represents you","Add your location, PSIRA registration, grade and service interests so LOKD can review the work you are qualified to do."],["Know the assignment","Review the location, hours and duties before accepting a shift. Armed and VIP work require the qualifications for that role."],["Manage work in the app","Follow your application, respond to requests, see your shifts and record your arrival and departure."]] as const;
export default function Page() {
  return <PublicPage active="officers" eyebrow="Work with LOKD" title="Put your skills to work." promise="Apply as a security officer, complete your verification and find shifts that match your qualifications and availability." officer>

    <section className="public-section public-section--white"><div className="public-section-heading"><h2>Your work, clearly organised.</h2></div><div className="public-detail-grid">{cards.map(([title, description]) => <article key={title}><h3>{title}</h3><p>{description}</p></article>)}</div><p className="public-note">Applications are reviewed individually. Submitting an application does not guarantee work or a training place.</p></section>

    <PublicSteps officer />
    <section className="public-section public-section--white"><h2>Already applied?</h2><p>Open the Officer Zone with the email you used to apply to follow your next steps.</p><Link className="public-text-link" href="/sign-in?return_to=%2Fofficer">Open the Officer Zone →</Link></section>
  </PublicPage>;
}
