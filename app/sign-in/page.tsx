import type { Metadata } from "next";
import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import ClerkLogin from "../components/clerk-login";
import { PublicHeader, PublicFooter } from "../components/public-site-shell";
import { getLokdUser } from "../lokd-auth";
import { signInDestination } from "../lib/clerk-access";
import { hasSignupSubmission } from "../lib/signup-server";
import { operationsEmailAllowed } from "../lib/signup-access";
import { publicMetadata, requestHostname, workspaceRoleForHost, workspaceRedirectForHost, type WorkspaceRole } from "../lib/public-site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { ...publicMetadata("Sign in to your account", "Sign in securely to your LOKD client, officer or operations account.", "/sign-in"), robots: { index: false, follow: false } };

async function Login({ searchParams }: { searchParams: Promise<{ return_to?: string }> }) {
  const requestHeaders = await headers();
  const hostname = requestHostname(requestHeaders.get("host"));
  const hostRole = workspaceRoleForHost(hostname);
  const runtime = env as unknown as Record<string, string | undefined>;
  const selection = await searchParams;
  const requested = selection.return_to && !/(?:sandbox|test-cycle|payment-test)/.test(selection.return_to) ? selection.return_to : undefined;
  const destination = signInDestination(hostname, requested);
  const user = await getLokdUser();
  if (user) {
    let role: WorkspaceRole = hostRole ?? (destination.startsWith("/ops") ? "operations" : destination.startsWith("/officer") ? "officer" : "client");
    if (!hostRole && destination === "/") {
      if (operationsEmailAllowed(user.email, runtime)) role = "operations";
      else if (env.DB) {
        const userId = requestHeaders.get("x-lokd-verified-user-id");
        if (userId && await hasSignupSubmission(env.DB, { userId, email: user.email, operations: false }, "officer")) role = "officer";
      }
    }
    const target = destination === "/" || destination.startsWith("/signup") ? (role === "operations" ? "/ops" : "/" + role) : destination;
    const host = workspaceRedirectForHost(hostname, role);
    redirect(host ? new URL(target, host).toString() : target);
  }
  const publishableKey = runtime.CLERK_PUBLISHABLE_KEY || runtime.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const label = hostRole === "operations" ? "Operations" : hostRole === "officer" ? "Officer" : hostRole === "client" ? "Client" : "LOKD";
  return <div className="public-site"><PublicHeader /><main id="main-content" className="public-auth" tabIndex={-1}><section className="public-auth-card"><p className="public-kicker">Your account</p><h1>{label} sign in</h1><p>Use the email linked to your LOKD application or booking.</p>
    {publishableKey && runtime.CLERK_SECRET_KEY ? <ClerkLogin destination={destination === "/" ? "/sign-in" : destination} /> : <p role="alert">Secure sign-in is temporarily unavailable. Please try again later or <Link href="/contact">contact LOKD</Link>.</p>}
    {!hostRole && <nav aria-label="Choose your account"><Link href="/sign-in?return_to=%2Fclient">Client account</Link><Link href="/sign-in?return_to=%2Fofficer">Officer account</Link><Link href="/sign-in?return_to=%2Fops">Operations account</Link></nav>}
  </section></main><PublicFooter /></div>;
}
export default function SignInPage(props: { searchParams: Promise<{ return_to?: string }> }) { return <Login {...props} />; }
