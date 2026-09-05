import assert from "node:assert/strict";
import test from "node:test";

import { evaluateReadiness } from "../app/lib/passport-rules.ts";

function endorsement(overrides) {
  return {
    id: "END-1",
    code: "core_ready",
    label: "LOKD Ready",
    category: "core",
    serviceType: null,
    purposeCode: null,
    status: "current",
    assessedAt: "2026-08-01T08:00:00Z",
    expiresAt: "2027-08-31",
    nextDueAt: "2027-08-31",
    ...overrides,
  };
}

function readyInput() {
  return {
    assignmentDate: "2026-09-06",
    fundingStatus: "paid_in_full",
    approvalStatus: "approved",
    psiraGrade: "Grade B",
    minimumGrade: "Grade C",
    psiraExpiry: "2027-12-31",
    passportStatus: "active",
    passportNextReviewAt: "2027-08-31",
    serviceType: "Unarmed",
    serviceQualified: true,
    serviceOptedIn: true,
    requireServiceOptIn: true,
    qualificationExpiry: "2027-12-31",
    purposeCode: "commercial_access",
    endorsements: [
      endorsement({ id: "END-CORE" }),
      endorsement({ id: "END-SERVICE", code: "service_unarmed", label: "Unarmed", category: "service", serviceType: "Unarmed" }),
      endorsement({ id: "END-PURPOSE", code: "purpose_commercial", label: "Commercial access", category: "purpose", purposeCode: "commercial_access" }),
    ],
  };
}

test("current PSiRA, Passport, service and purpose evidence enables a matching offer", () => {
  const result = evaluateReadiness(readyInput());
  assert.equal(result.eligible, true);
  assert.equal(result.displayStatus, "active");
  assert.deepEqual(result.blockers, []);
});

test("Passport suspension fails closed even when all other evidence is current", () => {
  const input = readyInput();
  input.passportStatus = "suspended";
  const result = evaluateReadiness(input);
  assert.equal(result.eligible, false);
  assert.equal(result.displayStatus, "suspended");
  assert.match(result.blockers.join(" "), /Passport is suspended/);
});

test("assignment-date checks reject expiring registration, qualifications and endorsements", () => {
  const input = readyInput();
  input.psiraExpiry = "2026-09-05";
  input.qualificationExpiry = "2026-09-05";
  input.endorsements[2].expiresAt = "2026-09-05";
  const result = evaluateReadiness(input);
  assert.equal(result.eligible, false);
  assert.match(result.blockers.join(" "), /PSiRA registration/);
  assert.match(result.blockers.join(" "), /qualification expires/);
  assert.match(result.blockers.join(" "), /purpose endorsement/);
});

test("a current Passport approaching review remains eligible but shows an expiring warning", () => {
  const input = readyInput();
  input.passportNextReviewAt = "2026-09-20";
  const result = evaluateReadiness(input);
  assert.equal(result.eligible, true);
  assert.equal(result.displayStatus, "expiring");
  assert.equal(result.warnings.length, 1);
});
