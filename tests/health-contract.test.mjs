import assert from "node:assert/strict";
import test from "node:test";

import { env } from "cloudflare:workers";
import { GET as live } from "../app/api/health/live/route.ts";
import { GET as ready } from "../app/api/health/ready/route.ts";

test("liveness is dependency-free and returns a non-cacheable response", async () => {
  const response = await live();
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(body.status, "live");
  assert.equal(body.service, "lokd-security");
});

test("readiness fails closed without a bound database", async () => {
  delete env.DB;
  const response = await ready();
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.equal(body.status, "unavailable");
  assert.equal(body.productionActivationAuthorized, false);
});

test("readiness verifies the Version 22 schema without authorising deployment", async () => {
  env.BUCKET = {};
  env.DB = {
    prepare(statement) {
      assert.match(statement, /sqlite_master/);
      assert.match(statement, /identity_case_transition_guard_v21/);
      assert.match(statement, /outbox_parent_provenance_v21/);
      assert.match(statement, /officer_conversion_cases/);
      assert.match(statement, /officer_conversion_completion_guard/);
      return { first: async () => ({ required_tables: 14, required_triggers: 9 }) };
    },
  };
  try {
    const response = await ready();
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.status, "ready");
    assert.equal(body.productionActivationAuthorized, false);
    assert.equal(body.softwareIntegrationReady, true);
    assert.deepEqual(body.remainingExternalProviders, ["iiDENTIFii", "payment processor"]);
    assert.deepEqual(body.checks, { requiredTables: 14, requiredTriggers: 9, evidenceStoreBound: true });
  } finally {
    delete env.DB;
    delete env.BUCKET;
  }
});

test("readiness fails closed when a required database guard is missing", async () => {
  env.BUCKET = {};
  env.DB = { prepare: () => ({ first: async () => ({ required_tables: 14, required_triggers: 8 }) }) };
  try {
    const response = await ready();
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.status, "unavailable");
    assert.equal(body.productionActivationAuthorized, false);
  } finally {
    delete env.DB;
    delete env.BUCKET;
  }
});

test("readiness fails closed when private evidence storage is not bound", async () => {
  env.DB = { prepare: () => ({ first: async () => ({ required_tables: 14, required_triggers: 9 }) }) };
  try {
    const response = await ready();
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.softwareIntegrationReady, false);
    assert.equal(body.checks.evidenceStoreBound, false);
  } finally {
    delete env.DB;
  }
});
