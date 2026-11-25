import { PublicPage, PublicSteps, OfficerRecruitment, PublicFeatureGrid } from "../components/public-site-shell";
import { Photo } from "../components/public-visuals";
import { publicMetadata } from "../lib/public-site";

export const metadata = publicMetadata("Security cover for clients", "Arrange guarding, armed security or VIP protection in Johannesburg. Get a clear quote and follow officers, shifts and check-ins in your LOKD account.", "/clients");
const cards = [["A brief that fits your site","Share your address, dates, access points and priorities. We use those details to plan the duties and staffing with you."],["A quote you can review","See the service, hours, officer requirements and cost before you accept. Your agreed terms stay with your booking."],["Updates where you need them","View assigned officers, follow check-ins and raise a service issue from your client account."]] as const;
export default function Page() {
  return <PublicPage active="clients" title="Your cover. Clearly organised." promise="Arrange security for your property, people or event and follow each shift in the Client Zone." ctaHref="/book" ctaLabel="Book officers" visual={<Photo name="event-booking" priority sizes="(max-width: 1060px) 100vw, 45vw" alt="A hand holding a phone at a live event, showing a LOKD booking with officers confirmed" />}>
    <PublicFeatureGrid title="Know what you are booking." white features={cards.map(([title, description]) => ({ title, description }))} />
    <PublicSteps />
    <OfficerRecruitment />
  </PublicPage>;
}
