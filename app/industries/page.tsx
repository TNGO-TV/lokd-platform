import { BookingModels, OfficerRecruitment, PublicFeatureGrid, PublicPage } from "../components/public-site-shell";
import { Photo } from "../components/public-visuals";
import { publicMetadata } from "../lib/public-site";

export const metadata = publicMetadata("Security for your industry", "On-demand security and ongoing contract cover for workplaces, retail, residential properties, construction, logistics and events in Johannesburg.", "/industries");

export default function Page() {
  return <PublicPage active="industries" title="Your place. Your kind of protection." visual={<Photo name="site-roster" priority sizes="(max-width: 1060px) 100vw, 45vw" alt="A construction site desk with a hard hat, radio and a laptop showing a LOKD Fixed roster" />} promise="Book for one shift or plan an ongoing roster. Match the security brief to the way people, vehicles and visitors move through your site." ctaHref="/book" ctaLabel="Book officers">
    <PublicFeatureGrid title="Different sites. Considered cover." intro="Each site moves differently. The brief sets where officers stand, what they check and who they report to." features={[
      {icon:"building",title:"Workplaces and retail",description:"Arrange access control, visitor checks and patrols around operating hours, staff and customers.",detail:"Commercial"},
      {icon:"users",title:"Residential properties",description:"Plan a professional presence at entrances and common areas, with clear visitor and resident instructions.",detail:"Residential"},
      {icon:"clipboard",title:"Construction and logistics",description:"Set duties around deliveries, vehicle access, site boundaries and the areas that need observation.",detail:"Sites and depots"},
      {icon:"calendar",title:"Events and venues",description:"Request officers for entrances, arrivals and agreed positions around your event timetable.",detail:"Events"}
    ]} />
    <BookingModels /><OfficerRecruitment />
  </PublicPage>;
}
