import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import ClerkLogin from "../components/clerk-login";
import { getLokdUser } from "../lokd-auth";
import { signInDestination } from "../lib/clerk-access";
import { requestHostname, workspaceRoleForHost } from "../lib/public-site";

export const dynamic = "force-dynamic";

async function Login({ searchParams }: { searchParams: Promise<{ return_to?: string }> }) {
  const hostname = requestHostname((await headers()).get("host"));
  const destination = signInDestination(hostname, (await searchParams).return_to);
  if (await getLokdUser()) redirect(destination);
  const runtime = env as unknown as Record<string, string | undefined>;
  const publishableKey = runtime.CLERK_PUBLISHABLE_KEY || runtime.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const role = workspaceRoleForHost(hostname);
  return <main className="pilot-access-shell"><section className="pilot-access-card">
    <a href="https://lokd.co.za"><img src="/lokd-logo.png" alt="LOKD home" /></a>
    <h1>{role === "operations" ? "Operations" : role === "officer" ? "Officer" : role === "client" ? "Client" : "LOKD"} sign in</h1>
    {publishableKey && runtime.CLERK_SECRET_KEY
      ? <ClerkLogin destination={destination} />
      : <p role="status">Sign-in is being configured. Please try again later.</p>}
  </section></main>;
}

export default function SignInPage(props: { searchParams: Promise<{ return_to?: string }> }) {
  return <Login {...props} />;
}
