import { PublicPage, PublicSteps, OfficerRecruitment } from "../components/public-site-shell";
import { publicMetadata } from "../lib/public-site";
import { ServiceJsonLd } from "../components/seo-json-ld";
export const metadata = publicMetadata("VIP protection in Johannesburg", "Arrange personal protection in Johannesburg for appearances, private engagements and movements, with a discreet plan and a clear LOKD quote.", "/vip-protection");
const cards = [["Personal protection","Tell us who needs protection, the nature of the engagement and any concerns so we can assess the right support."],["Movements and appearances","Plan cover around your itinerary, arrival and departure points, and the venues you will use."],["The right team","Close-protection qualifications and assignment requirements guide the choice of officers and any armed support."]] as const;
export default function Page() {
  return <PublicPage active="services" eyebrow="VIP protection" title="Your day. Thoughtfully protected." promise="Arrange personal protection around your schedule, movements and engagements in Johannesburg.">
    <ServiceJsonLd name="VIP protection in Johannesburg" description="Arrange personal protection in Johannesburg for appearances, private engagements and movements, with a discreet plan and a clear LOKD quote." path="/vip-protection" />
    <section className="public-section public-section--white"><div className="public-section-heading"><h2>Protection that starts with listening.</h2></div><div className="public-detail-grid">{cards.map(([title, description]) => <article key={title}><h3>{title}</h3><p>{description}</p></article>)}</div></section>

    <PublicSteps />
    <OfficerRecruitment />
  </PublicPage>;
}
