import { env } from "cloudflare:workers";
import Link from "next/link";
import ClerkLogin from "../components/clerk-login";

export const dynamic = "force-dynamic";

export default function SignOutPage() {
  const runtime = env as unknown as Record<string, string | undefined>;
  const publishableKey = runtime.CLERK_PUBLISHABLE_KEY || runtime.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return <main className="pilot-access-shell"><section className="pilot-access-card"><h1>Sign out of LOKD</h1>
    {publishableKey ? <ClerkLogin destination="/" signOut /> : <Link href="/">Return to LOKD</Link>}
  </section></main>;
}
