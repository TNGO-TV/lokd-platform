import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { env } from "cloudflare:workers";

// Ephemeral test-only signing material. No Clerk account or network is used.
const keyPair = generateKeyPairSync("rsa", { modulusLength: 2048 });
export const testIssuer = "https://lokd-test.clerk.accounts.dev";
export const testPublishableKey = `pk_test_${Buffer.from("lokd-test.clerk.accounts.dev$").toString("base64")}`;
const jwtKey = keyPair.publicKey.export({ type: "spki", format: "pem" }).toString();

export function configureTestClerk() {
  env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = testPublishableKey;
  env.CLERK_SECRET_KEY = "sk_test_not_a_real_clerk_credential";
  env.CLERK_JWT_KEY = jwtKey;
}

export function testUserId(email) {
  return `user_${createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 24)}`;
}

export function signedSession(userId, origin, overrides = {}, signingKey = keyPair.privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT", kid: "lokd-test" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ v: 2, iss: testIssuer, sub: userId, sid: "sess_lokd_test", azp: origin, iat: now, nbf: now - 1, exp: now + 60, fva: [0, 0], ...overrides })).toString("base64url");
  const data = `${header}.${payload}`;
  return `${data}.${sign("RSA-SHA256", Buffer.from(data), signingKey).toString("base64url")}`;
}

// Existing business-workflow fixtures used the hosting email header. Convert
// those fixtures into real signed Clerk sessions, preserving their existing
// role assignments. Production code never imports this adapter.
export class ClerkTestRequest extends Request {
  constructor(input, init) {
    const original = new Request(input, init);
    const headers = new Headers(original.headers);
    const email = headers.get("oai-authenticated-user-email");
    headers.delete("oai-authenticated-user-email");
    if (email) {
      configureTestClerk();
      const issuer = env.LOKD_APP_STAGE === "production" ? "https://clerk.lokd.example" : testIssuer;
      if (env.LOKD_APP_STAGE === "production") {
        env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = `pk_live_${Buffer.from("clerk.lokd.example$").toString("base64")}`;
        env.CLERK_SECRET_KEY = "sk_live_not_a_real_clerk_credential";
      }
      const userId = testUserId(email);
      const config = JSON.parse(env.LOKD_PILOT_ACCESS_JSON || "{}");
      config.clerkUsers = { ...config.clerkUsers, [userId]: { principalEmail: email } };
      env.LOKD_PILOT_ACCESS_JSON = JSON.stringify(config);
      headers.set("authorization", `Bearer ${signedSession(userId, new URL(original.url).origin, { iss: issuer })}`);
    }
    super(original, { headers });
  }
}
