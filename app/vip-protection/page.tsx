import { BookingModels, OfficerRecruitment, PublicFeatureGrid, PublicPage, PublicSteps, ServiceRequirements } from "../components/public-site-shell";
import { ServiceJsonLd } from "../components/seo-json-ld";
import { publicMetadata } from "../lib/public-site";

export const metadata = publicMetadata("VIP protection in Johannesburg", "Arrange discreet personal protection for a single engagement or ongoing contract cover. Your itinerary and assignment requirements shape the plan.", "/vip-protection");

export default function Page() {
  return <PublicPage active="services" eyebrow="VIP protection" title="Your movements. Thoughtfully protected." promise="Arrange discreet personal protection for a single engagement or ongoing contract cover. Your itinerary and assignment requirements shape the plan." ctaHref="/book?service=vip_unarmed" ctaLabel="Book VIP protection">
    <ServiceJsonLd name="VIP protection in Johannesburg" description="Arrange discreet personal protection for a single engagement or ongoing contract cover. Your itinerary and assignment requirements shape the plan." path="/vip-protection" />
    <PublicFeatureGrid eyebrow="Your assignment" title="Cover shaped around the brief." features={[{"icon":"users","title":"Personal protection","description":"Share who needs protection, the nature of the engagement and any concerns.","detail":"People first"},{"icon":"car","title":"Movements and appearances","description":"Plan around arrival and departure points, venues and your itinerary.","detail":"Your itinerary"},{"icon":"badgeCheck","title":"The right team","description":"Relevant close-protection qualifications are required. Armed assignments also require firearm competency.","detail":"Role requirements"}]} />
    <ServiceRequirements grade="B" specialist="vip" />
    <BookingModels />
    <PublicSteps />
    <OfficerRecruitment />
  </PublicPage>;
}
