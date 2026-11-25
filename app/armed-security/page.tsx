import { BookingModels, OfficerRecruitment, PublicFeatureGrid, PublicPage, PublicSteps, ServiceRequirements } from "../components/public-site-shell";
import { ServiceJsonLd } from "../components/seo-json-ld";
import { Photo } from "../components/public-visuals";
import { publicMetadata } from "../lib/public-site";

export const metadata = publicMetadata("Armed security in Johannesburg", "Request armed officers on demand or for ongoing contract cover. The assignment, site risks and relevant qualifications guide your security plan.", "/armed-security");

export default function Page() {
  return <PublicPage active="services" title="Specialist cover. Clear requirements." visual={<Photo name="range-indoor" priority sizes="(max-width: 1060px) 100vw, 45vw" alt="An officer kneeling in a firing position during firearms training on an indoor range" />} promise="Request armed officers on demand or for ongoing contract cover. The assignment, site risks and relevant qualifications guide your security plan." ctaHref="/book?service=armed_static" ctaLabel="Book armed officers">
    <ServiceJsonLd name="Armed security in Johannesburg" description="Request armed officers on demand or for ongoing contract cover. The assignment, site risks and relevant qualifications guide your security plan." path="/armed-security" />
    <PublicFeatureGrid title="Cover shaped around the brief." intro="Armed cover starts with the assignment: the site, the risks and the qualifications the work needs." features={[{"icon":"building","title":"Armed site guarding","description":"Plan officer positions and duties around your premises, access points and site risks.","detail":"Site protection"},{"icon":"route","title":"Movement protection","description":"Share the route, purpose and requirements so LOKD can assess the right cover.","detail":"Planned movements"},{"icon":"clipboard","title":"A defined assignment","description":"Confirm the brief, responsibilities and relevant qualifications before cover starts.","detail":"Clear scope"}]} />
    <ServiceRequirements grade="B" specialist="armed" />
    <BookingModels />
    <PublicSteps />
    <OfficerRecruitment />
  </PublicPage>;
}
