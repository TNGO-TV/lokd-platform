import Link from "next/link";
import { PublicPage, PublicSteps } from "../components/public-site-shell";
import { publicMetadata } from "../lib/public-site";

export const metadata = publicMetadata("Security officer training pathways", "Find your next step in security training, grade upgrades or specialist work. Tell LOKD about your registration and training interests.", "/training");
const cards = [["Starting out","Tell us if you are new to the industry or working towards registration. We will review your training interests with you."],["Building your grade","Share your current PSIRA position and grade so your application reflects the training you have already completed."],["Specialist skills","Register your interest in firearms training, armed work or close protection. Each route has its own qualification requirements."]] as const;
export default function Page() {
  return <PublicPage active="officers" eyebrow="Training and development" title="Take your next step in security." promise="Share your training goals so LOKD can help you understand the pathway to registered, qualified security work." officer>

    <section className="public-section public-section--white"><div className="public-section-heading"><h2>Start with the skills you need.</h2></div><div className="public-detail-grid">{cards.map(([title, description]) => <article key={title}><h3>{title}</h3><p>{description}</p></article>)}</div><p className="public-note">Applications are reviewed individually. Submitting an application does not guarantee work or a training place.</p></section>

    <PublicSteps officer />
    <section className="public-section public-section--white"><h2>Already applied?</h2><p>Open the Officer Zone with the email you used to apply to follow your next steps.</p><Link className="public-text-link" href="/sign-in?return_to=%2Fofficer">Open the Officer Zone →</Link></section>
  </PublicPage>;
}
