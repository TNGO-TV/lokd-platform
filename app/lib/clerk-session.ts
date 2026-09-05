import { createClerkClient } from "@clerk/backend";
import { clerkSettings } from "./clerk-config";

export type LOKDSession = { userId: string; sessionId: string };

// API requests verify the actual session token themselves. Forwarded identity
// headers, including former ChatGPT headers, never establish a Clerk identity.
export async function verifiedClerkSession(request: Request): Promise<LOKDSession | null> {
  const settings = clerkSettings();
  if (!settings.ready) return null;
  try {
    const client = createClerkClient({
      publishableKey: settings.publishableKey,
      secretKey: settings.secretKey,
      jwtKey: settings.jwtKey || undefined,
      telemetry: { disabled: true },
    });
    const state = await client.authenticateRequest(request, {
      acceptsToken: "session_token",
      authorizedParties: settings.authorizedParties,
    });
    if (state.status !== "signed-in") return null;
    const session = state.toAuth({ treatPendingAsSignedOut: true });
    if (!session.userId || !session.sessionId || session.actor
      || session.sessionClaims.iss !== settings.issuer) return null;
    return { userId: session.userId, sessionId: session.sessionId };
  } catch {
    // Never echo tokens, SDK diagnostics or secret configuration to the client.
    return null;
  }
}
