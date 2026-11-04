import { env } from "cloudflare:workers";
import Link from "next/link";
import ClerkLogin from "../components/clerk-login";
import { PublicHeader, PublicFooter } from "../components/public-site-shell";
import { publicMetadata } from "../lib/public-site";
export const dynamic = "force-dynamic";
export const metadata = { ...publicMetadata("Sign out of your account", "Sign out securely from your LOKD account.", "/sign-out"), robots: { index: false, follow: false } };
export default function SignOutPage() {
  const runtime = env as unknown as Record<string, string | undefined>;
  const publishableKey = runtime.CLERK_PUBLISHABLE_KEY || runtime.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return <div className="public-site"><PublicHeader /><main id="main-content" className="public-auth" tabIndex={-1}><section className="public-auth-card"><h1>Sign out of LOKD</h1><p>End your session on this device.</p>{publishableKey ? <ClerkLogin destination="/" signOut /> : <p role="alert">Secure sign-out is temporarily unavailable. Reload this page to try again.</p>}<p><Link href="/">Return to LOKD</Link></p></section></main><PublicFooter /></div>;
}
