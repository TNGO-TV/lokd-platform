import { BookingModels, PublicFeatureGrid, PublicPage, PublicServices } from "../../components/public-site-shell";
import { ServiceJsonLd } from "../../components/seo-json-ld";
import { DispatchMap } from "../../components/public-visuals";
import { publicMetadata } from "../../lib/public-site";

const description = "Book verified officers for today, tomorrow or ongoing cover in Johannesburg. Officers are dispatched from the closest available pool; arrival time depends on location.";
export const metadata = publicMetadata("Security officers in Johannesburg", description, "/locations/johannesburg");

export default function Page() {
  return <PublicPage active="services" title="Local cover. On your terms." visual={<div className="page-hero-visual--map"><DispatchMap id="jhb-map" /></div>} promise={description} ctaHref="/book" ctaLabel="Book officers">
    <ServiceJsonLd name="Security officers in Johannesburg" description={description} path="/locations/johannesburg" />
    <PublicFeatureGrid title="A brief built around your address." white features={[
      {icon:"mapPin",title:"Your site or venue",description:"Provide the address, access points and instructions so the plan reflects the actual location.",detail:"Location"},
      {icon:"clock",title:"Your timing",description:"Choose today, tomorrow, a planned date or an ongoing roster. Availability is reviewed for the assignment.",detail:"Schedule"},
      {icon:"route",title:"Local dispatch",description:"Officers are dispatched from the closest available pool. Arrival time depends on location and availability.",detail:"Dispatch"}
    ]} />
    <BookingModels /><PublicServices headingId="jhb-services-title" />
  </PublicPage>;
}
