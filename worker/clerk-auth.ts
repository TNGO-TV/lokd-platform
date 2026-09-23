import { createClerkClient } from "@clerk/backend";
import { cleanIdentityHeaders, verifiedPrimaryEmail } from "../app/lib/clerk-access";

import { clerkSecondFactorVerifiedAt } from "../app/lib/operations-mfa";

export interface ClerkEnv {
  CLERK_SECRET_KEY?: string;
  CLERK_PUBLISHABLE_KEY?: string;
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?: string;
  CLERK_AUTHORIZED_PARTIES?: string;
  CLERK_JWT_KEY?: string;
}

export async function authenticateClerkRequest(request: Request, env: ClerkEnv, createClient = createClerkClient) {
  const headers = cleanIdentityHeaders(request);
  const anonymous = new Request(request, { headers });
  const publishableKey = env.CLERK_PUBLISHABLE_KEY || env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  // Missing configuration never re-enables the previous header-based login.
  if (!publishableKey || !env.CLERK_SECRET_KEY) return { request: anonymous, headers: new Headers() };
  const clerk = createClient({ publishableKey, secretKey: env.CLERK_SECRET_KEY });
  const state = await clerk.authenticateRequest(anonymous.clone() as Request, {
    acceptsToken: "session_token",
    jwtKey: env.CLERK_JWT_KEY,
    authorizedParties: [
      "https://lokd.co.za", "https://www.lokd.co.za", "https://portal.lokd.co.za",
      "https://officers.lokd.co.za", "https://operations.lokd.co.za", "https://demo.lokd.co.za",
      ...(env.CLERK_AUTHORIZED_PARTIES || "").split(",").map((value) => value.trim()).filter(Boolean),
    ],
  });
  if (state.status === "handshake") {
    if (!state.headers.get("location")) throw new Error("Clerk handshake is missing its redirect.");
    return { response: new Response(null, { status: 307, headers: state.headers }) };
  }
  if (state.isAuthenticated) {
    const auth = state.toAuth();
    if (auth.userId && auth.sessionId) {
      // Both records are required on every authenticated request. Resolve them
      // concurrently, then validate the complete identity before exposing it.
      // No token or user cache may outlive authoritative session revocation.
      const [sessionResult, userResult] = await Promise.allSettled([
        clerk.sessions.getSession(auth.sessionId),
        clerk.users.getUser(auth.userId),
      ]);
      if (sessionResult.status === "rejected" || userResult.status === "rejected") {
        return { response: Response.json(
          { error: "Account verification is temporarily unavailable." },
          { status: 503, headers: { "cache-control": "private, no-store" } },
        ) };
      }
      const session = sessionResult.value;
      const user = userResult.value;
      if (
        session.id !== auth.sessionId || session.userId !== auth.userId ||
        session.status !== "active" || !Number.isFinite(session.expireAt) ||
        session.expireAt <= Date.now() || user.id !== auth.userId
      ) return { request: anonymous, headers: state.headers };
      const email = verifiedPrimaryEmail(user);
      if (email) {
        headers.set("x-lokd-verified-email", email);
        headers.set("x-lokd-verified-user-id", user.id);
        headers.set("x-lokd-verified-mfa-enrolled", String(user.twoFactorEnabled === true));
        const secondFactorAt = clerkSecondFactorVerifiedAt(auth.factorVerificationAge, auth.sessionClaims.iat, user.twoFactorEnabled === true);
        if (secondFactorAt) headers.set("x-lokd-verified-second-factor-at", secondFactorAt);
        const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
        if (name) {
          headers.set("x-lokd-verified-full-name", encodeURIComponent(name));
          headers.set("x-lokd-verified-full-name-encoding", "percent-encoded-utf-8");
        }
      }
    }
  }
  return { request: new Request(anonymous, { headers }), headers: state.headers };
}
