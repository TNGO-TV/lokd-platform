import { BookingModels, OfficerRecruitment, PublicFeatureGrid, PublicPage } from "../components/public-site-shell";
import { publicMetadata } from "../lib/public-site";

export const metadata = publicMetadata("About LOKD Security", "LOKD connects Johannesburg clients with on-demand officers, ongoing contract cover and certified security training.", "/about");

export default function Page() {
  return <PublicPage active="about" eyebrow="About LOKD" title="Security that works around people." promise="A simpler way to arrange security in Johannesburg. Book verified officers when you need them, plan ongoing cover or take your next step through training." ctaHref="/book" ctaLabel="Book officers">
    <PublicFeatureGrid eyebrow="Four ways forward" title="One LOKD. Built around your needs." features={[
      {icon:"clock",title:"LOKD Bolt",description:"Urgent bookings with less than 72 hours’ notice, subject to verified officer availability.",detail:"Urgent cover"},
      {icon:"calendar",title:"LOKD Flex",description:"7+ Days in a calendar month.",detail:"Temporary / Flexible Service"},
      {icon:"calendar",title:"LOKD Fixed",description:"Ongoing security cover for three months or more, with an agreed site roster.",detail:"Contract cover"},
      {icon:"graduationCap",title:"LOKD Training",description:"LOKD is a certified training provider. Training is a paid service, from entry-level courses to grade upgrades, firearms and VIP protection.",detail:"Certified training"}
    ]} />
    <BookingModels /><OfficerRecruitment />
  </PublicPage>;
}
