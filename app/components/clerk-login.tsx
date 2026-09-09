"use client";

import { ClerkProvider, SignIn, useClerk } from "@clerk/react";
import { useState } from "react";

function SignOutAction() {
  const clerk = useClerk();
  const [failed, setFailed] = useState(false);
  return <><button className="public-button public-button--dark" onClick={() => {
    setFailed(false);
    void clerk.signOut({ redirectUrl: "/sign-in" }).catch(() => setFailed(true));
  }}>Sign out</button>{failed && <p role="alert">Sign-out failed. Please try again.</p>}</>;
}

export default function ClerkLogin({ destination, signOut = false }: {
  destination: string; signOut?: boolean;
}) {
  return signOut ? <SignOutAction /> : <SignIn routing="hash" forceRedirectUrl={destination} signUpForceRedirectUrl={destination} />;
}

export function LokdClerkProvider({ publishableKey, children }: { publishableKey?: string; children: React.ReactNode }) {
  // Keep Clerk mounted after login so it refreshes the short-lived session
  // cookie used by the portals' existing same-origin fetch requests.
  return publishableKey ? <ClerkProvider publishableKey={publishableKey}>{children}</ClerkProvider> : children;
}
