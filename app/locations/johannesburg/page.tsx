import { PublicPage, PublicSteps, OfficerRecruitment } from "../../components/public-site-shell";
import { publicMetadata } from "../../lib/public-site";
import { ServiceJsonLd } from "../../components/seo-json-ld";
export const metadata = publicMetadata("Security officers in Johannesburg", "Book verified security officers in Johannesburg for unarmed guarding, armed security and VIP protection. Get a quote for your site, event or shift.", "/locations/johannesburg");
const cards = [["Give us the address","Share the property or venue address and access instructions so we can plan around the actual location."],["Choose your dates","Tell us whether you need a single shift, event cover or an ongoing schedule, with the hours for each day."],["Agree the details","We review availability, officer requirements and duties with you before confirming the service."]] as const;
export default function Page() {
  return <PublicPage active="services" eyebrow="Johannesburg, South Africa" title="Security close to where you need it." promise="Arrange guarding, armed security or VIP protection for your Johannesburg site, event or daily schedule.">
    <ServiceJsonLd name="Security officers in Johannesburg" description="Book verified security officers in Johannesburg for unarmed guarding, armed security and VIP protection. Get a quote for your site, event or shift." path="/locations/johannesburg" />
    <section className="public-section public-section--white"><div className="public-section-heading"><h2>Start with your location.</h2></div><div className="public-detail-grid">{cards.map(([title, description]) => <article key={title}><h3>{title}</h3><p>{description}</p></article>)}</div></section>

    <PublicSteps />
    <OfficerRecruitment />
  </PublicPage>;
}
