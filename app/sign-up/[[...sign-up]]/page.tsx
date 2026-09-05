import { SignUp } from "@clerk/nextjs";
import AuthScreen, { AuthUnavailable } from "../../components/auth-screen";
import { clerkSettings } from "../../lib/clerk-config";
import { safeAuthReturnPath } from "../../lib/auth-paths";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create your account", robots: { index: false, follow: false } };

async function SignUpForm({ searchParams }: { searchParams: Promise<{ return_to?: string }> }) {
  const returnTo = safeAuthReturnPath((await searchParams).return_to);
  return <SignUp routing="path" path="/sign-up" signInUrl={`/sign-in?return_to=${encodeURIComponent(returnTo)}`} forceRedirectUrl={returnTo} />;
}

export default function SignUpPage(props: { searchParams: Promise<{ return_to?: string }> }) {
  return <AuthScreen>{clerkSettings().ready ? <SignUpForm {...props} /> : <AuthUnavailable />}</AuthScreen>;
}
