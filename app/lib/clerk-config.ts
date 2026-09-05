import { env } from "cloudflare:workers";

// Runtime configuration stays on the server. Only the publishable key is
// passed to Clerk's browser components; no workspace/CLI credential is used.
export function authRuntimeValue(key: string): string {
  const runtime = env as unknown as Record<string, unknown>;
  const value = runtime[key];
  return typeof value === "string" ? value : process.env[key] ?? "";
}

export function clerkSettings() {
  const publishableKey = authRuntimeValue("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY").trim();
  const secretKey = authRuntimeValue("CLERK_SECRET_KEY").trim();
  const jwtKey = authRuntimeValue("CLERK_JWT_KEY").trim();
  const production = authRuntimeValue("LOKD_APP_STAGE").trim().toLowerCase() === "production";
  const authorizedParties = [
    "https://lokd.co.za", "https://www.lokd.co.za", "https://portal.lokd.co.za",
    "https://officers.lokd.co.za", "https://operations.lokd.co.za", "https://demo.lokd.co.za",
    ...(production ? [] : ["http://terminal.local:4173", "http://localhost:4173", "https://app.local"]),
  ];
  let issuer = "";
  try {
    const host = atob(publishableKey.replace(/^pk_(test|live)_/, "")).replace(/\$$/, "");
    if (/^[a-z0-9.-]+$/i.test(host) && !host.startsWith(".")) issuer = `https://${host}`;
  } catch { /* An incomplete configuration must not authenticate anyone. */ }
  const ready = Boolean(issuer && /^pk_(test|live)_/.test(publishableKey)
    && /^sk_(test|live)_/.test(secretKey)
    && publishableKey.startsWith("pk_live_") === secretKey.startsWith("sk_live_")
    && (!production || publishableKey.startsWith("pk_live_")));
  return { ready, publishableKey, secretKey, jwtKey, issuer, authorizedParties };
}
