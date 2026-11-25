import { BookingModels, OfficerRecruitment, PublicFeatureGrid, PublicPage, PublicSteps, ServiceRequirements } from "../components/public-site-shell";
import { Photo } from "../components/public-visuals";
import { ServiceJsonLd } from "../components/seo-json-ld";
import { publicMetadata } from "../lib/public-site";

export const metadata = publicMetadata("Security services in Johannesburg", "Book unarmed officers for today, tomorrow or ongoing contract cover. Plan access control, patrols and site duties around your property or event.", "/security-services");

export default function Page() {
  return <PublicPage active="services" title="A professional presence. On your schedule." visual={<Photo name="night-patrol-portrait" priority sizes="(max-width: 1060px) 100vw, 45vw" alt="A security officer on a night patrol, checking a doorway with a torch" />} promise="Book unarmed officers for today, tomorrow or ongoing contract cover. Plan access control, patrols and site duties around your property or event." ctaHref="/book?service=scheduled_unarmed_fixed_site" ctaLabel="Book unarmed officers">
    <ServiceJsonLd name="Security services in Johannesburg" description="Book unarmed officers for today, tomorrow or ongoing contract cover. Plan access control, patrols and site duties around your property or event." path="/security-services" />
    <PublicFeatureGrid title="Cover shaped around the brief." intro="Unarmed officers for access points, patrols and events, briefed on your site before they start." features={[{"icon":"doorOpen","title":"Access control","description":"Set clear instructions for entrances, visitors and deliveries at your premises.","detail":"Your access points"},{"icon":"route","title":"Patrols and observation","description":"Agree the areas, boundaries and responsibilities officers need to cover.","detail":"Your site brief"},{"icon":"calendar","title":"Events and temporary cover","description":"Request officers for a shift, an event or short-notice gaps in your security.","detail":"Your schedule"}]} />
    <ServiceRequirements grade="C" />
    <BookingModels />
    <PublicSteps />
    <OfficerRecruitment />
  </PublicPage>;
}
