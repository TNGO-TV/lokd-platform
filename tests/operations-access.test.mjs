import assert from "node:assert/strict";
import test from "node:test";
import { env } from "cloudflare:workers";
import { requireApiRole } from "../app/lib/platform-runtime.ts";

test("supplemental Operations configuration retains authentication, workspace, MFA and role boundaries", () => {
  const keys = ["LOKD_APP_STAGE", "LOKD_ROLE_ACCESS_JSON", "LOKD_OPERATIONS_ACCESS_JSON", "LOKD_OPERATIONS_MFA_REQUIRED"];
  const previous = Object.fromEntries(keys.map(key => [key, env[key]]));
  try {
    env.LOKD_APP_STAGE = "production";
    env.LOKD_ROLE_ACCESS_JSON = JSON.stringify({ operations: ["existing@example.test"] });
    env.LOKD_OPERATIONS_ACCESS_JSON = '["new@example.test"]';
    env.LOKD_OPERATIONS_MFA_REQUIRED = "true";
    // These headers represent the Worker boundary in a local simulated test only.
    const request = (email, method = "GET", host = "operations.lokd.co.za") => new Request(`https://${host}/api/operational-delivery`, {
      method, headers: email ? { "x-lokd-verified-email": email, "x-lokd-verified-user-id": "user_test" } : {},
    });
    for (const email of ["existing@example.test", "new@example.test"]) {
      const principal = requireApiRole(request(email), "operations");
      assert.equal(principal.owner, false);
      assert.deepEqual(principal.roles, ["operations"]);
    }
    assert.throws(() => requireApiRole(request(null), "operations"), /Sign in/);
    assert.throws(() => requireApiRole(request("other@example.test"), "operations"), /does not have access/);
    assert.throws(() => requireApiRole(request("new@example.test", "POST"), "operations"), /second factor/);
    assert.throws(() => requireApiRole(request("new@example.test", "GET", "portal.lokd.co.za"), "operations"), /correct LOKD workspace/);
    assert.throws(() => requireApiRole(request("new@example.test", "GET", "localhost"), "reviewer"), /does not have access/);
    env.LOKD_OPERATIONS_ACCESS_JSON = "[]";
    assert.throws(() => requireApiRole(request("new@example.test"), "operations"), /does not have access/);
    assert.equal(requireApiRole(request("existing@example.test"), "operations").email, "existing@example.test");
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete env[key]; else env[key] = previous[key];
    }
  }
});

test('supplemental owner authority retains authentication, workspace and MFA checks', () => {
  const keys=['LOKD_APP_STAGE','LOKD_ROLE_ACCESS_JSON','LOKD_OPERATIONS_ACCESS_JSON','LOKD_OWNER_ACCESS_JSON','LOKD_OPERATIONS_MFA_REQUIRED'];
  const previous=Object.fromEntries(keys.map(k=>[k,env[k]]));
  try {
    Object.assign(env,{LOKD_APP_STAGE:'production',LOKD_ROLE_ACCESS_JSON:'{}',LOKD_OPERATIONS_ACCESS_JSON:'["ordinary@example.test"]',LOKD_OWNER_ACCESS_JSON:'["approver@example.test"]',LOKD_OPERATIONS_MFA_REQUIRED:'true'});
    const request=(email,method='GET',host='operations.lokd.co.za')=>new Request(`https://${host}/api/quotes?scope=operations`,{method,headers:email?{'x-lokd-verified-email':email,'x-lokd-verified-user-id':'fixture'}:{}});
    assert.equal(requireApiRole(request('approver@example.test'),'operations').owner,true);
    assert.equal(requireApiRole(request('ordinary@example.test'),'operations').owner,false);
    assert.throws(()=>requireApiRole(request(null),'operations'),/Sign in/);
    assert.throws(()=>requireApiRole(request('unknown@example.test'),'operations'),/does not have access/);
    assert.throws(()=>requireApiRole(request('approver@example.test','POST'),'operations'),/second factor/);
    assert.throws(()=>requireApiRole(request('approver@example.test','GET','portal.lokd.co.za'),'operations'),/correct LOKD workspace/);
    env.LOKD_OWNER_ACCESS_JSON='[]';
    assert.throws(()=>requireApiRole(request('approver@example.test'),'operations'),/does not have access/);
  } finally {for(const k of keys){if(previous[k]===undefined)delete env[k];else env[k]=previous[k];}}
});
