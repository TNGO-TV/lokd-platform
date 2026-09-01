import assert from "node:assert/strict";
import test from "node:test";

import {
  CONTRACT_TEMPLATE_SPECS,
  CONTROLLED_ONBOARDING_FLOW_VERSION,
  DEMO_CONTRACT_WATERMARK,
  PRODUCTION_ONBOARDING_BLOCKERS,
  evaluateControlledPilotRehearsal,
} from "../app/lib/onboarding-core.ts";

const passingFacts = {
  completedCases: 3,
  requiredCases: 3,
  preparedTemplates: 4,
  requiredTemplates: 4,
  signedEnvelopes: 4,
  requiredEnvelopes: 4,
  activeInvitations: 3,
  requiredInvitations: 3,
  criticalDatabaseGuards: 6,
  requiredDatabaseGuards: 6,
};

test("Version 32 passes a complete synthetic rehearsal without enabling production or settlement", () => {
  const result = evaluateControlledPilotRehearsal(passingFacts);
  assert.equal(CONTROLLED_ONBOARDING_FLOW_VERSION, "LOKD-CONTROLLED-ONBOARDING-2026.09-v1");
  assert.equal(result.status, "passed");
  assert.equal(result.steps.length, 8);
  assert.equal(result.steps.every((item) => item.status === "passed"), true);
  assert.equal(result.creditTermsDays, 0);
  assert.equal(result.fundingModel, "advance_only");
  assert.equal(result.settlementLocked, true);
  assert.equal(result.productionAuthorised, false);
  assert.deepEqual(result.blockers, [...PRODUCTION_ONBOARDING_BLOCKERS]);
});

test("the rehearsal blocks on incomplete access or missing database guards", () => {
  const result = evaluateControlledPilotRehearsal({
    ...passingFacts,
    activeInvitations: 2,
    criticalDatabaseGuards: 5,
  });
  assert.equal(result.status, "blocked");
  assert.deepEqual(
    result.steps.filter((item) => item.status === "blocked").map((item) => item.code),
    ["WORKSPACE_ACCESS", "DATABASE_GUARDS"],
  );
  assert.equal(result.settlementLocked, true);
  assert.equal(result.productionAuthorised, false);
});

test("contract preparation uses explicit variables and an unambiguous simulation watermark", () => {
  assert.equal(CONTRACT_TEMPLATE_SPECS.length, 4);
  assert.equal(new Set(CONTRACT_TEMPLATE_SPECS.map((item) => item.code)).size, 4);
  assert.equal(DEMO_CONTRACT_WATERMARK, "SIMULATION ONLY — NOT A CONTRACT");
  const serviceOrder = CONTRACT_TEMPLATE_SPECS.find((item) => item.code === "SERVICE_ORDER");
  assert.ok(serviceOrder);
  assert.ok(serviceOrder.variables.includes("creditTermsDays"));
  assert.ok(serviceOrder.variables.includes("paymentReference"));
});
