import assert from "node:assert/strict";
import test from "node:test";

import { advanceFundingDecision, operatorControlDecision } from "../app/lib/operator-controls.ts";

const now = new Date("2026-09-01T12:00:00.000Z");

test("payroll approval requires the role, recent MFA, amount authority and a different maker", () => {
  const base = {
    actionCode: "payroll.first_approve",
    actorId: "reviewer@example.test",
    roles: ["payroll_reviewer"],
    accountStatus: "active",
    mfaStatus: "verified",
    mfaVerifiedAt: "2026-09-01T11:50:00.000Z",
    amountCents: 2_000_000,
    makerId: "maker@example.test",
    now,
  };
  assert.equal(operatorControlDecision(base).allowed, true);
  assert.match(operatorControlDecision({ ...base, makerId: base.actorId }).blockers.join(" "), /maker cannot approve/i);
  assert.match(operatorControlDecision({ ...base, mfaVerifiedAt: "2026-09-01T11:44:00.000Z" }).blockers.join(" "), /refreshed within 15 minutes/i);
  assert.match(operatorControlDecision({ ...base, amountCents: 50_000_001 }).blockers.join(" "), /exceeds/i);
});

test("second approval must be a distinct finance approver", () => {
  const decision = operatorControlDecision({
    actionCode: "payroll.second_approve",
    actorId: "reviewer@example.test",
    roles: ["finance_approver"],
    accountStatus: "active",
    mfaStatus: "verified",
    mfaVerifiedAt: "2026-09-01T11:50:00.000Z",
    amountCents: 2_000_000,
    makerId: "maker@example.test",
    firstApproverId: "reviewer@example.test",
    now,
  });
  assert.equal(decision.allowed, false);
  assert.match(decision.blockers.join(" "), /first and second approvers/i);
});

test("advance funding accepts only exact, reconciled, evidence-backed payment with zero credit days", () => {
  const base = {
    creditTermsDays: 0,
    fundingModel: "advance_only",
    bookingAmountCents: 1_400_000,
    expectedAmountCents: 1_400_000,
    clearedAmountCents: 1_400_000,
    status: "cleared_reconciled",
    evidenceReference: "provider:clearing:verified",
  };
  assert.equal(advanceFundingDecision(base).ready, true);
  const blocked = advanceFundingDecision({ ...base, creditTermsDays: 30, clearedAmountCents: 700_000 });
  assert.equal(blocked.ready, false);
  assert.match(blocked.blockers.join(" "), /does not offer credit terms/i);
  assert.match(blocked.blockers.join(" "), /full booking amount has not cleared/i);
});
