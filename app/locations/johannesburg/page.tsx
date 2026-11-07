import { BookingModels, PublicFeatureGrid, PublicPage, PublicServices } from "../../components/public-site-shell";
import { ServiceJsonLd } from "../../components/seo-json-ld";
import { publicMetadata } from "../../lib/public-site";

const description = "Book verified officers for today, tomorrow or ongoing cover in Johannesburg. Officers are dispatched from the closest available pool; arrival time depends on location.";
export const metadata = publicMetadata("Security officers in Johannesburg", description, "/locations/johannesburg");

export default function Page() {
  return <PublicPage active="services" eyebrow="Johannesburg · South Africa" title="Local cover. On your terms." promise={description} ctaHref="/book" ctaLabel="Book officers">
    <ServiceJsonLd name="Security officers in Johannesburg" description={description} path="/locations/johannesburg" />
    <PublicFeatureGrid eyebrow="Start with your location" title="A brief built around your address." features={[
      {icon:"mapPin",title:"Your site or venue",description:"Provide the address, access points and instructions so the plan reflects the actual location.",detail:"Location"},
      {icon:"clock",title:"Your timing",description:"Choose today, tomorrow, a planned date or an ongoing roster. Availability is reviewed for the assignment.",detail:"Schedule"},
      {icon:"route",title:"Local dispatch",description:"Officers are dispatched from the closest available pool. Arrival time depends on location and availability.",detail:"Dispatch"}
    ]} />
    <BookingModels /><PublicServices />
  </PublicPage>;
}
