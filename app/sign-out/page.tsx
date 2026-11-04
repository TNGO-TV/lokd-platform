import Link from "next/link";
import { PublicHeader, PublicFooter } from "../components/public-site-shell";
import { publicMetadata } from "../lib/public-site";
export const dynamic = "force-dynamic";
export const metadata = { ...publicMetadata("Sign out of your account", "Sign out securely from your LOKD account.", "/sign-out"), robots: { index: false, follow: false } };
export default function SignOutPage() {
  // Sign-out for the connected identity provider is handled at worker/identity.ts.
  return <div className="public-site"><PublicHeader /><main id="main-content" className="public-auth" tabIndex={-1}><section className="public-auth-card"><h1>Signed out</h1><p>You are not signed in to LOKD on this device.</p><p><Link href="/">Return to LOKD</Link></p></section></main><PublicFooter /></div>;
}
