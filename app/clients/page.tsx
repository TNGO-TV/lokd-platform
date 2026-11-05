import { PublicPage, PublicSteps, OfficerRecruitment } from "../components/public-site-shell";
import { publicMetadata } from "../lib/public-site";

export const metadata = publicMetadata("Security cover for clients", "Arrange guarding, armed security or VIP protection in Johannesburg. Get a clear quote and follow officers, shifts and check-ins in your LOKD account.", "/clients");
const cards = [["A brief that fits your site","Share your address, dates, access points and priorities. We use those details to plan the duties and staffing with you."],["A quote you can review","See the service, hours, officer requirements and cost before you accept. Your agreed terms stay with your booking."],["Updates where you need them","View assigned officers, follow check-ins and raise a service issue from your client account."]] as const;
export default function Page() {
  return <PublicPage active="clients" eyebrow="For clients" title="Your cover. Clearly organised." promise="Arrange security for your property, people or event and follow each shift in the Client Zone.">

    <section className="public-section public-section--white"><div className="public-section-heading"><h2>Know what you are booking.</h2></div><div className="public-detail-grid">{cards.map(([title, description]) => <article key={title}><h3>{title}</h3><p>{description}</p></article>)}</div></section>

    <PublicSteps />
    <OfficerRecruitment />
  </PublicPage>;
}
