import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import path from "node:path";
import { Miniflare } from "miniflare";

// Exercise the compiled Worker, including Next/Vinext middleware, using only
// disposable test bindings and test signatures. All external calls are denied.
const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const issuer = "https://clerk.lokd.example";
const origin = "https://operations.lokd.co.za";
const userId = "user_worker_smoke_owner";
function token(subject = userId) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT", kid: "worker-smoke" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ v: 2, iss: issuer, sub: subject, sid: "sess_worker_smoke", azp: origin, iat: now, nbf: now - 1, exp: now + 60, fva: [0, 0] })).toString("base64url");
  const input = `${header}.${payload}`;
  return `${input}.${sign("RSA-SHA256", Buffer.from(input), keys.privateKey).toString("base64url")}`;
}
const options = {
  modules: true,
  scriptPath: path.resolve("dist/server/index.js"),
  modulesRoot: path.resolve("dist/server"),
  modulesRules: [{ type: "ESModule", include: ["**/*.js", "**/*.mjs"], fallthrough: true }],
  compatibilityDate: "2026-05-15",
  compatibilityFlags: ["nodejs_compat", "nodejs_compat_populate_process_env"],
  assets: { directory: path.resolve("dist/client"), binding: "ASSETS" },
  d1Databases: ["DB"],
  r2Buckets: ["BUCKET"],
  outboundService: () => new Response("External calls are disabled in this test.", { status: 503 }),
};

const worker = new Miniflare({ ...options, bindings: {
  LOKD_APP_STAGE: "pilot",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: `pk_live_${Buffer.from("clerk.lokd.example$").toString("base64")}`,
  CLERK_SECRET_KEY: "sk_live_worker_smoke_only_not_a_real_credential",
  CLERK_JWT_KEY: keys.publicKey.export({ type: "spki", format: "pem" }).toString(),
  LOKD_PILOT_ACCESS_JSON: JSON.stringify({ owners: ["owner@lokd.example"], clerkUsers: { [userId]: { principalEmail: "owner@lokd.example" } } }),
} });

try {
  const signed = { authorization: `Bearer ${token()}` };
  const allowed = await worker.dispatchFetch(`${origin}/ops`, { headers: signed, redirect: "manual" });
  const html = await allowed.text();
  assert.equal(allowed.status, 200, html.slice(0, 800));
  assert.match(html, /LOKD account/);
  assert.doesNotMatch(html, /sk_live_worker_smoke_only_not_a_real_credential/);

  const named = await worker.dispatchFetch(`${origin}/api/operations`, { headers: signed, redirect: "manual" });
  assert.equal(named.status, 423, await named.text());
  const unknown = await worker.dispatchFetch(`${origin}/api/operations`, { headers: { authorization: `Bearer ${token("user_unassigned")}` }, redirect: "manual" });
  assert.equal(unknown.status, 403, await unknown.text());
  const forged = await worker.dispatchFetch(`${origin}/api/operations`, { headers: { "oai-authenticated-user-email": "owner@lokd.example", "x-clerk-auth-status": "signed-in", "x-clerk-auth-user-id": userId }, redirect: "manual" });
  assert.equal(forged.status, 401, await forged.text());
  console.log("Compiled Worker: signed-in page, explicit role binding, closed production controls and forged-header rejection passed.");
} finally {
  await worker.dispose();
}
