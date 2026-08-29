import assert from "node:assert/strict";
import test from "node:test";
import { env } from "cloudflare:workers";

const runtime = await import("../app/lib/pilot-runtime.ts");

test("anonymous visitors receive the synthetic principal only in demo", () => {
  env.LOKD_APP_STAGE = "demo";
  env.LOKD_PILOT_ACCESS_JSON = "";
  const principal = runtime.requirePilotApiRole(
    new Request("https://demo.lokd.co.za/api/pilot?scope=client"),
    "client",
  );
  assert.equal(principal.email, "public-demo@lokd.invalid");
  assert.equal(principal.clientId, "CL-001");
  assert.equal(principal.owner, false);

  env.LOKD_APP_STAGE = "pilot";
  assert.throws(
    () => runtime.requirePilotApiRole(
      new Request("https://demo.lokd.co.za/api/pilot?scope=client"),
      "client",
    ),
    /Sign in/i,
  );
});

test("unassigned signed-in visitors fall back to public demo without gaining production access", () => {
  env.LOKD_APP_STAGE = "demo";
  env.LOKD_PILOT_ACCESS_JSON = JSON.stringify({ owners: ["owner@lokd.example"] });
  const publicPrincipal = runtime.requirePilotApiRole(
    new Request("https://demo.lokd.co.za/api/operations", {
      headers: { "oai-authenticated-user-email": "visitor@example.test" },
    }),
    "operations",
  );
  assert.equal(publicPrincipal.email, "public-demo@lokd.invalid");
  assert.equal(publicPrincipal.owner, false);

  env.LOKD_APP_STAGE = "pilot";
  assert.throws(
    () => runtime.requirePilotApiRole(
      new Request("https://demo.lokd.co.za/api/operations", {
        headers: { "oai-authenticated-user-email": "visitor@example.test" },
      }),
      "operations",
    ),
    /does not have access/i,
  );
});
