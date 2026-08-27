import assert from "node:assert/strict";
import test from "node:test";

import {
  ageInMinutes,
  deriveOperationalState,
  highestPriority,
  highestSeverity,
  projectGautengCoordinate,
  signalFreshness,
} from "../app/lib/operations-core.ts";

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
