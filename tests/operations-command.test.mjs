import assert from "node:assert/strict";
import test from "node:test";

import {
  ageInMinutes,
  coverageStateLabel,
  deriveCoverageState,
  deriveOperationalState,
  highestPriority,
  highestSeverity,
  projectGautengCoordinate,
  minutesUntil,
  signalFreshness,
} from "../app/lib/operations-core.ts";

const coverageBase = {
  status: "scheduled",
  startsAt: "2026-08-27T10:00:00.000Z",
  arrivalDueAt: "2026-08-27T09:45:00.000Z",
  checkInDueAt: "2026-08-27T10:10:00.000Z",
  checkInAt: null,
  officerId: "OFF-001",
  activeRelief: false,
};

test("fresh on-post evidence produces an operational site", () => {
  assert.equal(deriveOperationalState({
    active: true,
    shiftStatus: "on_post",
    signalAgeMinutes: 4,
    highestIncidentSeverity: null,
    highestExceptionPriority: null,
  }), "operational");
});

test("a stale on-post signal becomes attention rather than a false location conclusion", () => {
  assert.equal(signalFreshness(16), "stale");
  assert.equal(deriveOperationalState({
    active: true,
    shiftStatus: "on_post",
    signalAgeMinutes: 16,
    highestIncidentSeverity: null,
    highestExceptionPriority: null,
  }), "attention");
});

test("critical incidents and P0 exceptions override otherwise healthy coverage", () => {
  assert.equal(deriveOperationalState({
    active: true,
    shiftStatus: "on_post",
    signalAgeMinutes: 2,
    highestIncidentSeverity: "critical",
    highestExceptionPriority: null,
  }), "critical");
  assert.equal(deriveOperationalState({
    active: true,
    shiftStatus: "confirmed",
    signalAgeMinutes: 2,
    highestIncidentSeverity: null,
    highestExceptionPriority: "P0",
  }), "critical");
});

test("severity and exception ordering always returns the worst active condition", () => {
  assert.equal(highestSeverity(["low", "high", "medium"]), "high");
  assert.equal(highestPriority(["P3", "P1", "P2"]), "P1");
});

test("signal age rejects invalid values and never returns negative minutes", () => {
  const now = new Date("2026-08-27T12:00:00.000Z");
  assert.equal(ageInMinutes("2026-08-27T11:56:00.000Z", now), 4);
  assert.equal(ageInMinutes("2026-08-27T12:05:00.000Z", now), 0);
  assert.equal(signalFreshness(ageInMinutes(null, now)), "unavailable");
});

test("Gauteng coordinate projection remains inside the command canvas", () => {
  const rosebank = projectGautengCoordinate(-26.1468, 28.0417);
  assert.ok(rosebank.x > 4 && rosebank.x < 96);
  assert.ok(rosebank.y > 4 && rosebank.y < 96);
  assert.deepEqual(projectGautengCoordinate(-90, 180), { x: 96, y: 96 });
});

test("arrival assurance uses stored deadlines and preserves a check-in grace window", () => {
  assert.equal(deriveCoverageState({ ...coverageBase, now: new Date("2026-08-27T09:44:00.000Z") }), "confirmed");
  assert.equal(deriveCoverageState({ ...coverageBase, now: new Date("2026-08-27T09:45:00.000Z") }), "arrival_at_risk");
  assert.equal(deriveCoverageState({ ...coverageBase, now: new Date("2026-08-27T10:09:00.000Z") }), "arrival_at_risk");
  assert.equal(deriveCoverageState({ ...coverageBase, now: new Date("2026-08-27T10:11:00.000Z") }), "check_in_missing");
});

test("check-in evidence overrides arrival risk and never creates an automatic no-show conclusion", () => {
  assert.equal(deriveCoverageState({ ...coverageBase, checkInAt: "2026-08-27T10:08:00.000Z", now: new Date("2026-08-27T10:20:00.000Z") }), "on_post");
  assert.equal(coverageStateLabel("check_in_missing"), "Check-in not recorded");
  assert.ok(!coverageStateLabel("check_in_missing").toLowerCase().includes("no-show"));
});

test("a required slot can be uncovered without manufacturing a shift or officer", () => {
  assert.equal(deriveCoverageState({ ...coverageBase, status: "uncovered", officerId: null, now: new Date("2026-08-27T08:00:00.000Z") }), "uncovered");
  assert.equal(deriveCoverageState({ ...coverageBase, activeRelief: true, now: new Date("2026-08-27T09:50:00.000Z") }), "relief_active");
});

test("coverage time helpers retain exact UTC interval semantics for night shifts", () => {
  const now = new Date("2026-08-27T16:00:00.000Z");
  assert.equal(minutesUntil("2026-08-27T18:00:00.000Z", now), 120);
  assert.equal(minutesUntil("2026-08-28T06:00:00.000Z", now), 840);
});
