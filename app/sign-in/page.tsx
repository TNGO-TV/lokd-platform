import type { Metadata } from "next";
import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PublicHeader, PublicFooter } from "../components/public-site-shell";
import { getLokdUser } from "../lokd-auth";
import { signInDestination } from "../lib/identity-access";
import { hasSignupSubmission } from "../lib/signup-server";
import { operationsEmailAllowed } from "../lib/signup-access";
import { publicMetadata, requestHostname, workspaceRoleForHost, workspaceRedirectForHost, type WorkspaceRole } from "../lib/public-site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { ...publicMetadata("LOKD Zone", "The LOKD Zone for clients, officers and operations.", "/sign-in"), robots: { index: false, follow: false } };

async function Login({ searchParams }: { searchParams: Promise<{ return_to?: string }> }) {
  const requestHeaders = await headers();
  const hostname = requestHostname(requestHeaders.get("host"));
  const hostRole = workspaceRoleForHost(hostname);
  const runtime = env as unknown as Record<string, string | undefined>;
  const selection = await searchParams;
  const requested = selection.return_to;
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
  const label = hostRole === "operations" ? "Operations" : hostRole === "officer" ? "Officer" : hostRole === "client" ? "Client" : "LOKD";
  return <div className="public-site"><PublicHeader /><main id="main-content" className="public-auth" tabIndex={-1}><section className="public-auth-card"><p className="public-kicker">LOKD Zone</p><h1>{label === "LOKD" ? "LOKD Zone" : `${label} Zone`}</h1><p>Use the email linked to your LOKD application or booking.</p>
    {/* The sign-in form for the connected identity provider renders here (see worker/identity.ts). */}
    <p role="status">The LOKD Zone is not yet open. To request cover or apply as an officer, use the forms on this site or <Link href="/contact">contact LOKD</Link>.</p>
    {!hostRole && <nav aria-label="Choose your Zone"><Link href="/sign-in?return_to=%2Fclient">Client Zone</Link><Link href="/sign-in?return_to=%2Fofficer">Officer Zone</Link><Link href="/sign-in?return_to=%2Fops">Operations Zone</Link></nav>}
  </section></main><PublicFooter /></div>;
}
export default function SignInPage(props: { searchParams: Promise<{ return_to?: string }> }) { return <Login {...props} />; }
