import assert from "node:assert/strict";
import test from "node:test";
import { signInDestination, cleanIdentityHeaders, verifiedPrimaryEmail } from "../app/lib/clerk-access.ts";
import { authenticateClerkRequest } from "../worker/clerk-auth.ts";
import { principalForEmailFromConfig, principalHasRole } from "../app/lib/pilot-access-core.ts";

test("each Clerk portal returns to its own workspace regardless of a supplied redirect", () => {
  for (const [host, destination] of [["portal.lokd.co.za", "/client"], ["officers.lokd.co.za", "/officer"], ["operations.lokd.co.za", "/ops"]]) {
    for (const requested of [undefined, "/ops", "//evil.example", "https://evil.example", "/sign-in", "/\\evil.example"]) {
      assert.equal(signInDestination(host, requested), destination);
    }
  }
  assert.equal(signInDestination("localhost", "/officer"), "/officer");
  assert.equal(signInDestination("localhost", "https://evil.example"), "/");
});

test("the Worker removes forged Clerk and legacy identity headers even without configuration", async () => {
  const request = new Request("https://operations.lokd.co.za/api/operations", { headers: {
    "x-lokd-verified-email": "owner@example.test", "x-lokd-verified-user-id": "user_forged",
    "oai-authenticated-user-email": "owner@example.test", "oai-authenticated-user-full-name": "Owner",
    "content-type": "application/json",
  }});
  assert.equal(cleanIdentityHeaders(request).get("content-type"), "application/json");
  const result = await authenticateClerkRequest(request, {});
  assert.equal(result.request.headers.get("x-lokd-verified-email"), null);
  assert.equal(result.request.headers.get("x-lokd-verified-user-id"), null);
  assert.equal(result.request.headers.get("oai-authenticated-user-email"), null);
});

test("only a verified primary Clerk email can resolve existing account permissions", () => {
  const verified = { id: "email_a", emailAddress: "client@example.test", verification: { status: "verified" } };
  assert.equal(verifiedPrimaryEmail({ primaryEmailAddressId: "email_b", emailAddresses: [verified] }), null);
  assert.equal(verifiedPrimaryEmail({ primaryEmailAddressId: "email_a", emailAddresses: [{ ...verified, verification: { status: "unverified" } }] }), null);
  const email = verifiedPrimaryEmail({ primaryEmailAddressId: "email_a", emailAddresses: [verified] });
  const config = JSON.stringify({ clients: { "client@example.test": "CL-A" }, owners: ["owner@example.test"] });
  const client = principalForEmailFromConfig(email, "Client", config);
  assert.equal(client.clientId, "CL-A");
  assert.equal(principalHasRole(client, "operations"), false);
  assert.deepEqual(principalForEmailFromConfig("new@example.test", "New", config).roles, []);
});

// Exercise the real Clerk verifier with a locally signed fixture token; no
// production account, session, credentials or network access is involved.
test("Clerk verifies signatures, expiry and trusted origins before forwarding identity", async () => {
  const { createClerkClient } = await import("@clerk/backend");
  const { generateKeyPairSync, sign } = await import("node:crypto");
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const now = Math.floor(Date.now() / 1000);
  const environment = {
    CLERK_PUBLISHABLE_KEY: `pk_test_${Buffer.from("clerk.fixture.example$").toString("base64")}`,
    CLERK_SECRET_KEY: "sk_test_fixture_only_not_a_real_secret",
    CLERK_JWT_KEY: publicKey.export({ type: "spki", format: "pem" }),
  };
  let lookups = 0;
  const factory = (options) => {
    const client = createClerkClient({ ...options, telemetry: { disabled: true } });
    return { ...client, users: { ...client.users, getUser: async (userId) => {
      assert.equal(userId, "user_fixture");
      lookups++;
      return { id: "user_fixture", firstName: "Fixture", lastName: "Officer",
        primaryEmailAddressId: "email_fixture", emailAddresses: [{ id: "email_fixture", emailAddress: "officer@example.test", verification: { status: "verified" } }] };
    } } };
  };
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = (overrides = {}, signingKey = privateKey) => {
    const data = `${encode({ alg: "RS256", typ: "JWT", kid: "fixture" })}.${encode({ sub: "user_fixture", sid: "sess_fixture", iss: "https://clerk.fixture.example", azp: "https://officers.lokd.co.za", iat: now, nbf: now - 1, exp: now + 60, v: 2, sts: "active", ...overrides })}`;
    return `${data}.${sign("RSA-SHA256", Buffer.from(data), signingKey).toString("base64url")}`;
  };
  const request = (jwt) => new Request("https://officers.lokd.co.za/api/pilot", { headers: { authorization: `Bearer ${jwt}`, "x-lokd-verified-email": "owner@example.test" } });
  const postBody = JSON.stringify({ action: "submit", psiraNumber: "1234567" });
  const post = await authenticateClerkRequest(new Request("https://officers.lokd.co.za/api/psira", {
    method: "POST", body: postBody, headers: { authorization: `Bearer ${token()}`, "content-type": "application/json" },
  }), environment, factory);
  assert.equal(await post.request.text(), postBody, "Clerk verification must preserve the POST body for the route");
  lookups = 0;
  const valid = await authenticateClerkRequest(request(token()), environment, factory);
  assert.equal(valid.request.headers.get("x-lokd-verified-email"), "officer@example.test");
  assert.equal(valid.request.headers.get("x-lokd-verified-user-id"), "user_fixture");
  assert.equal(lookups, 1);
  const other = generateKeyPairSync("rsa", { modulusLength: 2048 });
  for (const jwt of [token({ exp: now - 120 }), token({ azp: "https://evil.example" }), token({}, other.privateKey)]) {
    const rejected = await authenticateClerkRequest(request(jwt), environment, factory);
    assert.equal(rejected.request.headers.get("x-lokd-verified-email"), null);
  }
  assert.equal(lookups, 1, "invalid sessions must not resolve a user");
});
