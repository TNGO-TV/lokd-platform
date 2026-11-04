import Link from "next/link";
import { PublicHeader, PublicFooter } from "./components/public-site-shell";
export const metadata = { title: { absolute: "Page not found | LOKD" }, description: "This LOKD page could not be found. Return home to arrange security cover or contact our team.", robots: { index: false, follow: false } };
export default function NotFound() {
  return <div className="public-site"><PublicHeader /><main id="main-content" className="public-system" tabIndex={-1}><p className="public-kicker">404</p><h1>We couldn’t find that page.</h1><p>The address may have changed. Find security cover from our home page or contact the team for help.</p><Link className="public-button public-button--primary" href="/">Back to LOKD</Link><p><Link className="public-text-link" href="/contact">Contact LOKD →</Link></p></main><PublicFooter /></div>;
}
