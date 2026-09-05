import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";
import { env } from "cloudflare:workers";
import { configureTestClerk, signedSession, testUserId } from "./clerk-request.mjs";
import { requirePilotApiRole } from "../app/lib/pilot-runtime.ts";
import { safeAuthReturnPath } from "../app/lib/auth-paths.ts";

const origin = "https://operations.lokd.co.za";
const ownerId = testUserId("owner@lokd.example");
function setup() {
  configureTestClerk();
  env.LOKD_APP_STAGE = "pilot";
  env.LOKD_PILOT_ACCESS_JSON = JSON.stringify({ owners: ["owner@lokd.example"], clerkUsers: { [ownerId]: { principalEmail: "owner@lokd.example" } } });
}
function request(token, extra = {}) {
  return new Request(`${origin}/api/operations`, { headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra } });
}

test("a verified, explicitly linked Clerk subject retains the existing LOKD principal", async () => {
  setup();
  const principal = await requirePilotApiRole(request(signedSession(ownerId, origin)), "operations");
  assert.equal(principal.owner, true);
  assert.equal(principal.email, "owner@lokd.example");
  assert.equal(principal.authUserId, ownerId);
});

test("hosting headers and forged Clerk headers cannot impersonate the owner", async () => {
  setup();
  await assert.rejects(requirePilotApiRole(request(null, { "oai-authenticated-user-email": "owner@lokd.example", "x-clerk-auth-status": "signed-in", "x-clerk-auth-user-id": ownerId }), "operations"), error => error.status === 401);
});

test("a matching email or client-supplied role cannot replace an explicit Clerk subject link", async () => {
  setup();
  const token = signedSession("user_unassigned", origin, { email: "owner@lokd.example", email_verified: true, role: "owner", public_metadata: { role: "owner" } });
  await assert.rejects(requirePilotApiRole(request(token), "operations"), error => error.status === 403);
});

test("invalid, expired, future, wrong-origin and wrong-issuer tokens fail closed", async () => {
  setup();
  const now = Math.floor(Date.now() / 1000);
  const otherKey = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
  const tokens = [
    "not-a-session",
    signedSession(ownerId, origin, {}, otherKey),
    signedSession(ownerId, origin, { exp: now - 120 }),
    signedSession(ownerId, origin, { nbf: now + 120 }),
    signedSession(ownerId, "https://untrusted.example"),
    signedSession(ownerId, origin, { iss: "https://another-app.clerk.accounts.dev" }),
    signedSession(ownerId, origin, { sts: "pending" }),
    signedSession(ownerId, origin, { act: { sub: "user_impersonator" } }),
  ];
  for (const token of tokens) await assert.rejects(requirePilotApiRole(request(token), "operations"), error => error.status === 401);
});

test("removing the server-side link revokes access despite an otherwise valid session", async () => {
  setup();
  const token = signedSession(ownerId, origin);
  env.LOKD_PILOT_ACCESS_JSON = JSON.stringify({ owners: ["owner@lokd.example"] });
  await assert.rejects(requirePilotApiRole(request(token), "operations"), error => error.status === 403);
});

test("unconfigured authentication and development keys cannot activate production access", async () => {
  setup();
  const token = signedSession(ownerId, origin);
  delete env.CLERK_SECRET_KEY;
  await assert.rejects(requirePilotApiRole(request(token), "operations"), error => error.status === 401);
  configureTestClerk();
  env.LOKD_APP_STAGE = "production";
  await assert.rejects(requirePilotApiRole(request(token), "operations"), error => error.status === 401);
});

test("auth redirects retain safe workspace paths and reject external and looping destinations", () => {
  assert.equal(safeAuthReturnPath("/ops?tab=roster"), "/ops?tab=roster");
  for (const value of ["https://evil.example", "//evil.example", "/\\evil.example", "/sign-in", "/sign-up/verify-email", "/__clerk/client", "/signin-with-chatgpt", "/callback"]) assert.equal(safeAuthReturnPath(value), "/account");
});
