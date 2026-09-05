import { auth } from "@clerk/nextjs/server";
import { cache } from "react";
import { redirect } from "next/navigation";
import { authRuntimeValue, clerkSettings } from "./lib/clerk-config";
import { principalForClerkUserFromConfig } from "./lib/pilot-access-core";
import { lokdSignInPath } from "./lib/auth-paths";

export { lokdSignInPath };
export type LOKDUser = { id: string; displayName: string; email: string; fullName: string | null };

export const getLOKDUser = cache(async (): Promise<LOKDUser | null> => {
  const settings = clerkSettings();
  if (!settings.ready) return null;
  const session = await auth();
  if (!session.userId || !session.sessionId || session.actor
    || session.sessionClaims?.iss !== settings.issuer) return null;
  const principal = principalForClerkUserFromConfig(session.userId, authRuntimeValue("LOKD_PILOT_ACCESS_JSON"));
  return { id: session.userId, displayName: principal.displayName, email: principal.email, fullName: null };
});

export async function requireLOKDUser(returnTo: string): Promise<LOKDUser> {
  const user = await getLOKDUser();
  if (user) return user;
  redirect(lokdSignInPath(returnTo));
}
