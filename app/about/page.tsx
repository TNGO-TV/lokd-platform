import { BookingModels, OfficerRecruitment, PublicFeatureGrid, PublicPage } from "../components/public-site-shell";
import { Photo } from "../components/public-visuals";
import { publicMetadata } from "../lib/public-site";

export const metadata = publicMetadata("About LOKD Security", "LOKD connects Johannesburg clients with on-demand officers, ongoing contract cover and certified security training.", "/about");

export default function Page() {
  return <PublicPage active="about" title="Security that works around people." visual={<Photo name="officer-radio" priority sizes="(max-width: 1060px) 100vw, 45vw" alt="A uniformed security officer speaking on a two-way radio outside an office building" />} promise="A simpler way to arrange security in Johannesburg. Book verified officers when you need them, plan ongoing cover or take your next step through training." ctaHref="/book" ctaLabel="Book officers">
    <PublicFeatureGrid title="One LOKD. Built around your needs." intro="LOKD applies on-demand booking to security: verified officers when you need them, a roster when you need it every day, and training for the people doing the work." features={[
      {icon:"clock",title:"LOKD Bolt",description:"Urgent bookings with less than 72 hours’ notice, subject to verified officer availability.",detail:"Urgent cover"},
      {icon:"calendar",title:"LOKD Flex",description:"Temporary cover for 7+ service days within one calendar month, planned at least 72 hours ahead.",detail:"Temporary or flexible cover"},
      {icon:"calendar",title:"LOKD Fixed",description:"Ongoing security cover for three months or more, with an agreed site roster.",detail:"Contract cover"},
      {icon:"graduationCap",title:"LOKD Training",description:"LOKD is a certified training provider. Training is a paid service, from entry-level courses to grade upgrades, firearms and VIP protection.",detail:"Certified training"}
    ]} />
    <BookingModels /><OfficerRecruitment />
  </PublicPage>;
}
