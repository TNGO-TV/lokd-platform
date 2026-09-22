import assert from "node:assert/strict";
import test from "node:test";
import { env } from "cloudflare:workers";
import { requirePilotApiRole } from "../app/lib/pilot-runtime.ts";

test("supplemental Operations configuration retains authentication, workspace, MFA and role boundaries", () => {
  const keys = ["LOKD_APP_STAGE", "LOKD_PILOT_ACCESS_JSON", "LOKD_OPERATIONS_ACCESS_JSON", "LOKD_OPERATIONS_MFA_REQUIRED"];
  const previous = Object.fromEntries(keys.map(key => [key, env[key]]));
  try {
    env.LOKD_APP_STAGE = "production";
    env.LOKD_PILOT_ACCESS_JSON = JSON.stringify({ operations: ["existing@example.test"] });
    env.LOKD_OPERATIONS_ACCESS_JSON = '["new@example.test"]';
    env.LOKD_OPERATIONS_MFA_REQUIRED = "true";
    // These headers represent the Worker boundary in a local simulated test only.
    const request = (email, method = "GET", host = "operations.lokd.co.za") => new Request(`https://${host}/api/operational-delivery`, {
      method, headers: email ? { "x-lokd-verified-email": email, "x-lokd-verified-user-id": "user_test" } : {},
    });
    for (const email of ["existing@example.test", "new@example.test"]) {
      const principal = requirePilotApiRole(request(email), "operations");
      assert.equal(principal.owner, false);
      assert.deepEqual(principal.roles, ["operations"]);
    }
    assert.throws(() => requirePilotApiRole(request(null), "operations"), /Sign in/);
    assert.throws(() => requirePilotApiRole(request("other@example.test"), "operations"), /does not have access/);
    assert.throws(() => requirePilotApiRole(request("new@example.test", "POST"), "operations"), /second factor/);
    assert.throws(() => requirePilotApiRole(request("new@example.test", "GET", "portal.lokd.co.za"), "operations"), /correct LOKD workspace/);
    assert.throws(() => requirePilotApiRole(request("new@example.test", "GET", "demo.lokd.co.za"), "reviewer"), /does not have access/);
    env.LOKD_OPERATIONS_ACCESS_JSON = "[]";
    assert.throws(() => requirePilotApiRole(request("new@example.test"), "operations"), /does not have access/);
    assert.equal(requirePilotApiRole(request("existing@example.test"), "operations").email, "existing@example.test");
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete env[key]; else env[key] = previous[key];
    }
  }
});
