import { PublicPage, PublicSteps, OfficerRecruitment } from "../components/public-site-shell";
import { publicMetadata } from "../lib/public-site";

export const metadata = publicMetadata("About LOKD Security", "Meet LOKD, the South African platform connecting clients with verified security officers for shifts, events and ongoing cover in Johannesburg.", "/about");
const cards = [["For clients","Tell us what you need protected. We help you agree the right cover, understand your quote and follow the service from your account."],["For officers","Apply once, complete your verification and manage suitable shifts through the LOKD app."],["For every shift","Clear duties, a known officer and recorded check-ins make it easier to know who is on site and what is happening."]] as const;
export default function Page() {
  return <PublicPage active="about" eyebrow="About LOKD" title="Security that keeps people connected." promise="LOKD brings clients, verified officers and service updates together in one place, starting in Johannesburg.">

    <section className="public-section public-section--white"><div className="public-section-heading"><h2>Protection with a personal connection.</h2></div><div className="public-detail-grid">{cards.map(([title, description]) => <article key={title}><h3>{title}</h3><p>{description}</p></article>)}</div></section>

    <PublicSteps />
    <OfficerRecruitment />
  </PublicPage>;
}
