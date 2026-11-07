import { BookingModels, OfficerRecruitment, PublicFeatureGrid, PublicPage } from "../components/public-site-shell";
import { publicMetadata } from "../lib/public-site";

export const metadata = publicMetadata("Security for your industry", "On-demand security and ongoing contract cover for workplaces, retail, residential properties, construction, logistics and events in Johannesburg.", "/industries");

export default function Page() {
  return <PublicPage active="industries" eyebrow="Industries" title="Your place. Your kind of protection." promise="Book for one shift or plan an ongoing roster. Match the security brief to the way people, vehicles and visitors move through your site." ctaHref="/book" ctaLabel="Book officers">
    <PublicFeatureGrid eyebrow="Where we work" title="Different sites. Considered cover." features={[
      {icon:"building",title:"Workplaces and retail",description:"Arrange access control, visitor checks and patrols around operating hours, staff and customers.",detail:"Commercial"},
      {icon:"users",title:"Residential properties",description:"Plan a professional presence at entrances and common areas, with clear visitor and resident instructions.",detail:"Residential"},
      {icon:"clipboard",title:"Construction and logistics",description:"Set duties around deliveries, vehicle access, site boundaries and the areas that need observation.",detail:"Sites and depots"},
      {icon:"calendar",title:"Events and venues",description:"Request officers for entrances, arrivals and agreed positions around your event timetable.",detail:"Events"}
    ]} />
    <BookingModels /><OfficerRecruitment />
  </PublicPage>;
}
