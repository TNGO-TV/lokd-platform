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

test("readiness verifies the Version 32 onboarding and shadow-payroll schema without authorising paid deployment", async () => {
  env.BUCKET = {};
  env.DB = {
    prepare(statement) {
      assert.match(statement, /sqlite_master/);
      assert.match(statement, /identity_case_transition_guard_v21/);
      assert.match(statement, /outbox_parent_provenance_v21/);
      assert.match(statement, /officer_conversion_cases/);
      assert.match(statement, /officer_conversion_completion_guard/);
      assert.match(statement, /operator_approval_requests/);
      assert.match(statement, /booking_zero_credit_update_guard_v28/);
      assert.match(statement, /payroll_run_second_approval_guard_v28/);
      assert.match(statement, /payroll_shadow_validation_insert_guard_v29/);
      assert.match(statement, /payroll_settlement_lock_v29/);
      assert.match(statement, /payroll_disbursement_update_lock_v29/);
      assert.match(statement, /payroll_payslip_insert_lock_v29/);
      assert.match(statement, /client_enquiries/);
      assert.match(statement, /client_enquiry_insert_guard_v30/);
      assert.match(statement, /client_enquiry_delete_guard_v30/);
      assert.match(statement, /onboarding_cases/);
      assert.match(statement, /contract_envelopes/);
      assert.match(statement, /workspace_access_insert_guard_v32/);
      assert.match(statement, /controlled_pilot_rehearsal_insert_guard_v32/);
      return { first: async () => ({ required_tables: 28, required_triggers: 53 }) };
    },
  };
  try {
    const response = await ready();
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.status, "ready");
    assert.equal(body.productionActivationAuthorized, false);
    assert.equal(body.payrollMode, "shadow_settlement_locked");
    assert.equal(body.onboardingMode, "controlled_demo_rehearsal");
    assert.equal(body.softwareIntegrationReady, true);
    assert.deepEqual(body.remainingExternalProviders, ["iiDENTIFii", "payment processor"]);
    assert.deepEqual(body.checks, { requiredTables: 28, requiredTriggers: 53, evidenceStoreBound: true });
  } finally {
    delete env.DB;
    delete env.BUCKET;
  }
});

test("readiness fails closed when a required database guard is missing", async () => {
  env.BUCKET = {};
  env.DB = { prepare: () => ({ first: async () => ({ required_tables: 28, required_triggers: 52 }) }) };
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
  env.DB = { prepare: () => ({ first: async () => ({ required_tables: 28, required_triggers: 53 }) }) };
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
