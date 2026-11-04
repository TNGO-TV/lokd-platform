import { PublicPage, PublicSteps, PublicServices, OfficerRecruitment } from "../components/public-site-shell";
import { publicMetadata } from "../lib/public-site";
import { ServiceJsonLd } from "../components/seo-json-ld";
export const metadata = publicMetadata("Security services in Johannesburg", "Explore unarmed guarding, armed security and VIP protection in Johannesburg. Book verified officers for a shift, an event or ongoing cover.", "/security-services");
const cards = [["Access control","A visible presence at entrances, with visitor and vehicle checks based on your site instructions."],["Patrols and observation","Scheduled patrols, attention to agreed areas and reporting of incidents or concerns."],["Events and temporary cover","Plan security around arrival times, access points and the hours you need officers on site."]] as const;
export default function Page() {
  return <PublicPage active="services" eyebrow="Security services" title="Cover for the way you live and work." promise="Choose verified security officers for your property, event or personal protection, with a quote built around your requirements.">
    <ServiceJsonLd name="Security services in Johannesburg" description="Explore unarmed guarding, armed security and VIP protection in Johannesburg. Book verified officers for a shift, an event or ongoing cover." path="/security-services" />
    <section className="public-section public-section--white"><div className="public-section-heading"><h2>Unarmed guarding that fits your day.</h2></div><div className="public-detail-grid">{cards.map(([title, description]) => <article key={title}><h3>{title}</h3><p>{description}</p></article>)}</div></section>
    <PublicServices />
    <PublicSteps />
    <OfficerRecruitment />
  </PublicPage>;
}
