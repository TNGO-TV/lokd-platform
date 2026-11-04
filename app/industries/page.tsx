import { PublicPage, PublicSteps, OfficerRecruitment } from "../components/public-site-shell";
import { publicMetadata } from "../lib/public-site";

export const metadata = publicMetadata("Security for your industry", "Find security cover for workplaces, residential properties, retail, construction, logistics and events in Johannesburg with LOKD.", "/industries");
const cards = [["Workplaces and retail","Plan access control, visitor checks and patrols around staff, customers and operating hours."],["Residential properties","Arrange a visible presence at entrances and common areas, with clear instructions for visitors and residents."],["Construction and logistics","Set duties around deliveries, vehicle access, site boundaries and the areas you need watched."],["Events and venues","Plan arrivals, entrances and officer positions around your event timetable and expected attendance."]] as const;
export default function Page() {
  return <PublicPage active="industries" eyebrow="Industries" title="Different places. The same care." promise="Get security cover shaped around how people, vehicles and visitors move through your site.">

    <section className="public-section public-section--white"><div className="public-section-heading"><h2>Tell us how your place works.</h2></div><div className="public-detail-grid">{cards.map(([title, description]) => <article key={title}><h3>{title}</h3><p>{description}</p></article>)}</div></section>

    <PublicSteps />
    <OfficerRecruitment />
  </PublicPage>;
}
