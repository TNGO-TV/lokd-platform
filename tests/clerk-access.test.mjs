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
  let twoFactorEnabled = true;
  let sessionStatus="active",sessionUser="user_fixture",sessionExpiry=Date.now()+60000;
  const factory = (options) => {
    const client = createClerkClient({ ...options, telemetry: { disabled: true } });
    return { ...client, sessions:{getSession:async(id)=>({id,userId:sessionUser,status:sessionStatus,expireAt:sessionExpiry})}, users: { ...client.users, getUser: async (userId) => {
      assert.equal(userId, "user_fixture");
      lookups++;
      return { id: "user_fixture", twoFactorEnabled, firstName: "Fixture", lastName: "Officer",
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
  for (const fva of [[0,0],[0,-1],undefined]) {
    const proof = await authenticateClerkRequest(request(token({fva})), environment, factory);
    assert.equal(proof.request.headers.has('x-lokd-verified-second-factor-at'), fva?.[1] === 0);
  }
  for(const state of ["revoked","ended","expired"]){sessionStatus=state;const rejected=await authenticateClerkRequest(request(token()),environment,factory);assert.equal(rejected.request.headers.has("x-lokd-verified-user-id"),false);}
  sessionStatus="active";sessionUser="wrong-person";assert.equal((await authenticateClerkRequest(request(token()),environment,factory)).request.headers.has("x-lokd-verified-user-id"),false);sessionUser="user_fixture";sessionExpiry=Date.now()-1;assert.equal((await authenticateClerkRequest(request(token()),environment,factory)).request.headers.has("x-lokd-verified-user-id"),false);sessionExpiry=Date.now()+60000;
  twoFactorEnabled = false;
  const unenrolled = await authenticateClerkRequest(request(token({fva:[0,0]})), environment, factory);
  assert.equal(unenrolled.request.headers.has('x-lokd-verified-second-factor-at'), false);
  lookups = 1;
  const other = generateKeyPairSync("rsa", { modulusLength: 2048 });
  for (const jwt of [token({ exp: now - 120 }), token({ azp: "https://evil.example" }), token({}, other.privateKey)]) {
    const rejected = await authenticateClerkRequest(request(jwt), environment, factory);
    assert.equal(rejected.request.headers.get("x-lokd-verified-email"), null);
  }
  assert.equal(lookups, 1, "invalid sessions must not resolve a user");
});

 test("safe workspace deep links preserve only record selectors without granting cross-workspace access", () => {
 assert.equal(signInDestination("officers.lokd.co.za", "/officer/readiness?applicantId=A&identityId=I&redirect=https://evil.example"), "/officer/readiness?applicantId=A&identityId=I");
 assert.equal(signInDestination("localhost", "/client/agreements"), "/client/agreements");
 assert.equal(signInDestination("operations.lokd.co.za", "/ops/intake?kind=officer"), "/ops/intake?kind=officer");
 for (const path of ["/ops/readiness", "/officer/../ops/readiness", "/officer/%2e%2e/ops", "/officer/unknown", "//evil.example", "/officer/readiness\\evil", "/officer/readiness\n"]) assert.equal(signInDestination("officers.lokd.co.za", path), "/officer");
 });

function identityFixture(overrides = {}) {
  const session = { id: 'sess_fixture', userId: 'user_fixture', status: 'active', expireAt: Date.now() + 60000 };
  const user = { id: 'user_fixture', twoFactorEnabled: false, firstName: 'Test', lastName: 'Client', primaryEmailAddressId: 'email_fixture', emailAddresses: [{ id: 'email_fixture', emailAddress: 'test@example.test', verification: { status: 'verified' } }] };
  return () => ({
    authenticateRequest: async () => ({ status: 'signed-in', isAuthenticated: true, headers: new Headers(), toAuth: () => ({ userId: 'user_fixture', sessionId: 'sess_fixture', sessionClaims: {} }) }),
    sessions: { getSession: overrides.getSession ?? (async () => session) },
    users: { getUser: overrides.getUser ?? (async () => user) },
  });
}
const fixtureEnv = { CLERK_PUBLISHABLE_KEY: 'fixture', CLERK_SECRET_KEY: 'fixture' };
const fixtureRequest = () => new Request('https://portal.lokd.co.za/client', { headers: { 'x-lokd-verified-email': 'forged@example.test' } });

test('identity resolution overlaps independent lookups but never forwards a partially verified identity', async () => {
  let releaseSession, userStarted;
  const sessionPending = new Promise(resolve => { releaseSession = resolve; });
  const userHasStarted = new Promise(resolve => { userStarted = resolve; });
  let complete = false;
  const result = authenticateClerkRequest(fixtureRequest(), fixtureEnv, identityFixture({
    getSession: () => sessionPending,
    getUser: async () => { userStarted(); return { id: 'user_fixture', primaryEmailAddressId: null, emailAddresses: [] }; },
  })).then(value => { complete = true; return value; });
  await userHasStarted;
  assert.equal(complete, false);
  releaseSession({ id: 'sess_fixture', userId: 'user_fixture', status: 'revoked', expireAt: Date.now() + 60000 });
  const denied = await result;
  assert.equal(denied.request.headers.has('x-lokd-verified-email'), false);
  assert.equal(denied.request.headers.has('x-lokd-verified-user-id'), false);
});

test('either authoritative provider failure fails closed without leaking error details', async () => {
  for (const name of ['getSession', 'getUser']) {
    const result = await authenticateClerkRequest(fixtureRequest(), fixtureEnv, identityFixture({ [name]: async () => { throw Error('private provider detail'); } }));
    assert.equal(result.response.status, 503);
    assert.equal(result.response.headers.get('cache-control'), 'private, no-store');
    assert.equal(await result.response.text(), JSON.stringify({ error: 'Account verification is temporarily unavailable.' }));
    assert.equal(result.request, undefined);
  }
});

test('a mismatched user lookup cannot acquire the token holder identity', async () => {
  const result = await authenticateClerkRequest(fixtureRequest(), fixtureEnv, identityFixture({
    getUser: async () => ({ id: 'another_user', primaryEmailAddressId: 'e', emailAddresses: [{ id: 'e', emailAddress: 'owner@example.test', verification: { status: 'verified' } }] }),
  }));
  assert.equal(result.request.headers.has('x-lokd-verified-email'), false);
  assert.equal(result.request.headers.has('x-lokd-verified-user-id'), false);
});
