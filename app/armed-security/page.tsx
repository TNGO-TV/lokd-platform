import { PublicPage, PublicSteps, OfficerRecruitment } from "../components/public-site-shell";
import { publicMetadata } from "../lib/public-site";
import { ServiceJsonLd } from "../components/seo-json-ld";
export const metadata = publicMetadata("Armed security in Johannesburg", "Request armed security in Johannesburg for your site or movements. LOKD reviews the risks, officer qualifications and duties before quoting.", "/armed-security");
const cards = [["Armed site guarding","Define the property, hours and access arrangements so the armed role fits your site and its procedures."],["Movement protection","Share your locations, dates and requirements so LOKD can assess suitable armed cover for planned movements."],["Qualified for the assignment","PSIRA registration, identity, firearm competency and the requirements for the role are checked before assignment."]] as const;
export default function Page() {
  return <PublicPage active="services" eyebrow="Armed security" title="Specialist cover for higher-risk needs." promise="Request armed security for your site or movements, with duties and officer qualifications matched to the assessed risk.">
    <ServiceJsonLd name="Armed security in Johannesburg" description="Request armed security in Johannesburg for your site or movements. LOKD reviews the risks, officer qualifications and duties before quoting." path="/armed-security" />
    <section className="public-section public-section--white"><div className="public-section-heading"><h2>Plan the protection around the risk.</h2></div><div className="public-detail-grid">{cards.map(([title, description]) => <article key={title}><h3>{title}</h3><p>{description}</p></article>)}</div></section>

    <PublicSteps />
    <OfficerRecruitment />
  </PublicPage>;
}
