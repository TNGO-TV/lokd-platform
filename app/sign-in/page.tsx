import Image from "next/image";
import type { Metadata } from "next";
import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import ClerkLogin from "../components/clerk-login";
import { getLokdUser } from "../lokd-auth";
import { signInDestination } from "../lib/clerk-access";
import { requestHostname, workspaceRoleForHost } from "../lib/public-site";

export const dynamic = "force-dynamic";

function signInLabel(role: ReturnType<typeof workspaceRoleForHost>) {
  if (role === "operations") return "Operations";
  if (role === "officer") return "Officer";
  if (role === "client") return "Client";
  return "LOKD";
}

export async function generateMetadata(): Promise<Metadata> {
  const hostname = requestHostname((await headers()).get("host"));
  const role = workspaceRoleForHost(hostname);
  const label = signInLabel(role);
  return {
    title: `${label} sign in`,
    description: role
      ? `Sign in to the LOKD ${label.toLowerCase()} portal.`
      : "Sign in to LOKD Security.",
    robots: { index: false, follow: false },
  };
}

async function Login({ searchParams }: { searchParams: Promise<{ return_to?: string }> }) {
  const hostname = requestHostname((await headers()).get("host"));
  const destination = signInDestination(hostname, (await searchParams).return_to);
  if (await getLokdUser()) redirect(destination);
  const runtime = env as unknown as Record<string, string | undefined>;
  const publishableKey = runtime.CLERK_PUBLISHABLE_KEY || runtime.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const role = workspaceRoleForHost(hostname);
  const label = signInLabel(role);
  return <main className="pilot-access-shell"><section className="pilot-access-card">
    <a href="https://lokd.co.za"><Image width={1096} height={333} unoptimized loading="eager" style={{height:"auto"}} src="/lokd-logo.png" alt="LOKD home" /></a>
    <p className="public-kicker">{role ? `${label} portal` : "Account access"}</p>
    <h1>{label} sign in</h1>
    {publishableKey && runtime.CLERK_SECRET_KEY
      ? <ClerkLogin destination={destination} />
      : <p role="status">Sign-in is being configured. Please try again later.</p>}
  </section></main>;
}

export default function SignInPage(props: { searchParams: Promise<{ return_to?: string }> }) {
  return <Login {...props} />;
}
