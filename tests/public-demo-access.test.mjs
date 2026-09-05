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

test("the client, officer and Operations hosts require real sign-in and configured roles", () => {
  env.LOKD_APP_STAGE = "demo";
  env.LOKD_PILOT_ACCESS_JSON = JSON.stringify({
    owners: ["owner@lokd.example"],
    clients: { "client@lokd.example": "CL-001" },
    officers: { "officer@lokd.example": "OFF-001" },
  });

  assert.throws(
    () => runtime.requirePilotApiRole(new Request("https://portal.lokd.co.za/api/pilot?scope=client"), "client"),
    /Sign in/i,
  );
  assert.throws(
    () => runtime.requirePilotApiRole(new Request("https://operations.lokd.co.za/api/operations", {
      headers: { "oai-authenticated-user-email": "client@lokd.example" },
    }), "operations"),
    /does not have access/i,
  );
  assert.throws(
    () => runtime.requirePilotApiRole(new Request("https://officers.lokd.co.za/api/pilot?scope=officer"), "officer"),
    /Sign in/i,
  );
  assert.throws(
    () => runtime.requirePilotApiRole(new Request("https://officers.lokd.co.za/api/pilot?scope=client", {
      headers: { "oai-authenticated-user-email": "client@lokd.example" },
    }), "client"),
    /correct LOKD workspace/i,
  );

  const client = runtime.requirePilotApiRole(new Request("https://portal.lokd.co.za/api/pilot?scope=client", {
    headers: { "oai-authenticated-user-email": "client@lokd.example" },
  }), "client");
  assert.equal(client.clientId, "CL-001");
  const owner = runtime.requirePilotApiRole(new Request("https://operations.lokd.co.za/api/operations", {
    headers: { "oai-authenticated-user-email": "owner@lokd.example" },
  }), "operations");
  assert.equal(owner.owner, true);
  const officer = runtime.requirePilotApiRole(new Request("https://officers.lokd.co.za/api/pilot?scope=officer", {
    headers: { "oai-authenticated-user-email": "officer@lokd.example" },
  }), "officer");
  assert.equal(officer.officerId, "OFF-001");
});
