import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import { signInDestination, cleanIdentityHeaders } from "../app/lib/identity-access.ts";
import { authenticateRequest } from "../worker/identity.ts";
import { recordVerifiedIdentity, directoryEmail } from "../app/lib/identity-directory.ts";

test("each portal returns to its own workspace regardless of a supplied redirect", () => {
  for (const [host, destination] of [["portal.lokd.co.za", "/client"], ["officers.lokd.co.za", "/officer"], ["operations.lokd.co.za", "/ops"]]) {
    for (const requested of [undefined, "/ops", "//evil.example", "https://evil.example", "/sign-in", "/\\evil.example"]) {
      assert.equal(signInDestination(host, requested), destination);
    }
  }
  assert.equal(signInDestination("localhost", "/officer"), "/officer");
  assert.equal(signInDestination("localhost", "https://evil.example"), "/");
});

test("the Worker removes forged identity headers when no identity provider is connected", async () => {
  const request = new Request("https://operations.lokd.co.za/api/operations", { method: "POST", body: "{}", headers: {
    "x-lokd-verified-email": "owner@example.test", "x-lokd-verified-user-id": "user_forged",
    "x-lokd-verified-mfa-enrolled": "true", "x-lokd-verified-second-factor-at": new Date().toISOString(),
    "oai-authenticated-user-email": "owner@example.test", "content-type": "application/json",
  }});
  assert.equal(cleanIdentityHeaders(request).get("content-type"), "application/json");
  const result = await authenticateRequest(request);
  for (const name of ["x-lokd-verified-email", "x-lokd-verified-user-id", "x-lokd-verified-mfa-enrolled", "x-lokd-verified-second-factor-at", "oai-authenticated-user-email"])
    assert.equal(result.request.headers.get(name), null, name);
  assert.equal(await result.request.text(), "{}", "the request body reaches the route unchanged");
  assert.equal(result.response, undefined);
});

class Db { constructor(){ this.sql=new DatabaseSync(":memory:"); this.sql.exec(fs.readFileSync("drizzle/0180_identity_directory.sql","utf8")); }
  prepare(q){ const s=this.sql.prepare(q); let a=[]; return { bind(...v){ a=v; return this; }, run: async()=>({meta:{changes:s.run(...a).changes}}), first: async()=>s.get(...a) ?? null }; } }

test("verified identities are recorded once and resolve notification emails", async () => {
  const db = new Db();
  const headers = new Headers({ "x-lokd-verified-user-id": "user_a", "x-lokd-verified-email": "Officer@Example.test",
    "x-lokd-verified-full-name": encodeURIComponent("Thandi Mokoena"), "x-lokd-verified-full-name-encoding": "percent-encoded-utf-8" });
  await recordVerifiedIdentity(db, headers);
  assert.equal(await directoryEmail(db, "user_a"), "officer@example.test");
  await recordVerifiedIdentity(db, new Headers({ "x-lokd-verified-user-id": "user_a", "x-lokd-verified-email": "new@example.test" }));
  assert.equal(await directoryEmail(db, "user_a"), "new@example.test");
  await recordVerifiedIdentity(db, new Headers({ "x-lokd-verified-email": "nouser@example.test" }));
  assert.equal(await directoryEmail(db, "missing"), null);
  db.sql.exec("UPDATE identity_directory SET status='disabled' WHERE user_id='user_a'");
  assert.equal(await directoryEmail(db, "user_a"), null);
});

test("safe workspace deep links preserve only record selectors without granting cross-workspace access", () => {
 assert.equal(signInDestination("officers.lokd.co.za", "/officer/readiness?applicantId=A&identityId=I&redirect=https://evil.example"), "/officer/readiness?applicantId=A&identityId=I");
 assert.equal(signInDestination("localhost", "/client/agreements"), "/client/agreements");
 assert.equal(signInDestination("operations.lokd.co.za", "/ops/intake?kind=officer"), "/ops/intake?kind=officer");
 for (const path of ["/ops/readiness", "/officer/../ops/readiness", "/officer/%2e%2e/ops", "/officer/unknown", "//evil.example", "/officer/readiness\\evil", "/officer/readiness\n"]) assert.equal(signInDestination("officers.lokd.co.za", path), "/officer");
 });

