import assert from "node:assert/strict";
import test from "node:test";
const rawConfig = JSON.stringify({
  owners: ["owner@lokd.example"],
  operations: ["ops@lokd.example"],
  clients: { "client@lokd.example": "CL-001" },
  officers: { "officer@lokd.example": "OFF-001" },
  reviewers: ["reviewer@lokd.example"],
});

const access = await import("../app/lib/pilot-access-core.ts");

test("pilot access is default-deny and owner access spans every role", () => {
  const unknown = access.principalForEmailFromConfig("unknown@lokd.example", "Unknown", rawConfig);
  assert.deepEqual(unknown.roles, []);
  const owner = access.principalForEmailFromConfig("OWNER@lokd.example", "Owner", rawConfig);
  assert.equal(owner.owner, true);
  for (const role of ["operations", "client", "officer", "reviewer"]) assert.equal(access.principalHasRole(owner, role), true);
});

test("configured pilot users receive only their assigned role and entity", () => {
  const client = access.principalForEmailFromConfig("client@lokd.example", "Client", rawConfig);
  assert.deepEqual(client.roles, ["client"]);
  assert.equal(client.clientId, "CL-001");
  assert.equal(access.principalHasRole(client, "operations"), false);
  const officer = access.principalForEmailFromConfig("officer@lokd.example", "Officer", rawConfig);
  assert.deepEqual(officer.roles, ["officer"]);
  assert.equal(officer.officerId, "OFF-001");
});

test("public demo principal is isolated to the synthetic pilot entities", () => {
  const principal = access.publicDemoPrincipal();
  assert.equal(principal.owner, false);
  assert.equal(principal.email, "public-demo@lokd.invalid");
  assert.equal(principal.clientId, "CL-001");
  assert.equal(principal.officerId, "OFF-001");
  for (const role of ["operations", "client", "officer", "reviewer"]) {
    assert.equal(access.principalHasRole(principal, role), true);
  }
});

test("pilot action roles prevent cross-role mutations", () => {
  assert.equal(access.roleForPilotAction("create_booking"), "client");
  assert.equal(access.roleForPilotAction("accept_offer"), "officer");
  assert.equal(access.roleForPilotAction("confirm_booking_payment"), "operations");
  assert.equal(access.roleForPilotAction("create_client_service_request"), "client");
  assert.equal(access.roleForPilotAction("create_officer_service_request"), "officer");
  assert.equal(access.roleForPilotAction("reset_demo"), "operations");
});

test("JSON mutations must be same-origin", () => {
  assert.doesNotThrow(() => access.requireSameOriginJson(new Request("https://demo.lokd.co.za/api/pilot", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://demo.lokd.co.za", "sec-fetch-site": "same-origin" },
  })));
  assert.throws(() => access.requireSameOriginJson(new Request("https://demo.lokd.co.za/api/pilot", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://attacker.example", "sec-fetch-site": "cross-site" },
  })), /Cross-site/);
});
