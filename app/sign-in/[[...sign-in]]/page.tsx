import { SignIn } from "@clerk/nextjs";
import AuthScreen, { AuthUnavailable } from "../../components/auth-screen";
import { clerkSettings } from "../../lib/clerk-config";
import { safeAuthReturnPath } from "../../lib/auth-paths";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in", robots: { index: false, follow: false } };

async function SignInForm({ searchParams }: { searchParams: Promise<{ return_to?: string }> }) {
  const returnTo = safeAuthReturnPath((await searchParams).return_to);
  return <SignIn routing="path" path="/sign-in" signUpUrl={`/sign-up?return_to=${encodeURIComponent(returnTo)}`} forceRedirectUrl={returnTo} />;
}

export default function SignInPage(props: { searchParams: Promise<{ return_to?: string }> }) {
  return <AuthScreen>{clerkSettings().ready ? <SignInForm {...props} /> : <AuthUnavailable />}</AuthScreen>;
}
