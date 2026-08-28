import assert from "node:assert/strict";
import test from "node:test";

import {
  assessRisk,
  calendarCategoryForDate,
  defaultRiskInput,
  officerShiftEconomicsForRoster,
  quoteBooking,
} from "../app/lib/pilot-pricing.ts";

const base = {
  serviceType: "Unarmed",
  purposeCode: "commercial_access",
  startDate: "2026-09-01",
  shift: "day",
  rosterPattern: "monday_saturday",
  riskInput: defaultRiskInput,
};

test("Fixed ordinary Unarmed uses R1,400 client and R800 officer units", () => {
  const quote = quoteBooking({ ...base, engagementModel: "fixed", term: "1" });
  assert.equal(quote.clientShiftCents, 140_000);
  assert.equal(quote.officerRateCents, 80_000);
  assert.equal(quote.dispatchPremiumCents, 0);
  assert.equal(quote.releaseCadence, "Weekly");
  assert.ok(quote.shiftCount >= 25 && quote.shiftCount <= 27);
});

test("Scheduled Flex charges R1,600 while the ordinary officer offer stays R800", () => {
  const quote = quoteBooking({
    ...base,
    engagementModel: "flex",
    term: "single",
    startDate: "2026-08-11",
    now: new Date("2026-08-01T00:00:00.000Z"),
  });
  assert.equal(quote.noticeWindow, "standard");
  assert.equal(quote.clientPriceCents, 160_000);
  assert.equal(quote.officerRateCents, 80_000);
});

test("Immediate Flex charges R2,400 without urgency inflating the officer offer", () => {
  const quote = quoteBooking({
    ...base,
    engagementModel: "flex",
    term: "single",
    startDate: "2026-09-01",
    now: new Date("2026-09-01T02:00:00.000Z"),
  });
  assert.equal(quote.noticeWindow, "immediate");
  assert.equal(quote.clientPriceCents, 240_000);
  assert.equal(quote.officerRateCents, 80_000);
});

test("Flex Sunday applies the ad-hoc Sunday burden to both sides before urgency", () => {
  const quote = quoteBooking({
    ...base,
    engagementModel: "flex",
    term: "single",
    startDate: "2026-08-16",
    now: new Date("2026-08-01T00:00:00.000Z"),
  });
  assert.equal(quote.firstCalendarCategory, "sunday");
  assert.equal(quote.clientPriceCents, 320_000);
  assert.equal(quote.officerRateCents, 160_000);
});

test("Peak calendar categories take precedence over Sunday", () => {
  assert.equal(calendarCategoryForDate("2026-04-03"), "easter");
  assert.equal(calendarCategoryForDate("2026-04-05"), "easter");
  assert.equal(calendarCategoryForDate("2026-12-25"), "christmas");
  assert.equal(calendarCategoryForDate("2026-08-10"), "public_holiday");
});

test("roster economics derive Christmas from the Johannesburg start instant", () => {
  const economics = officerShiftEconomicsForRoster({
    serviceType: "Unarmed",
    riskBand: "Standard",
    engagementModel: "flex",
    serviceDate: "2039-12-25",
    startsAt: "2039-12-24T22:30:00.000Z",
  });
  assert.deepEqual(economics, {
    serviceDate: "2039-12-25",
    serviceDateMatchesStart: true,
    calendarCategory: "christmas",
    calendarLabel: "Christmas peak day",
    ordinaryWageCents: 80000,
    holidayPremiumCents: 120000,
    officerOfferCents: 200000,
  });
});

test("roster economics report a stored service-date mismatch", () => {
  const economics = officerShiftEconomicsForRoster({
    serviceType: "Unarmed",
    riskBand: "Standard",
    engagementModel: "flex",
    serviceDate: "2039-12-24",
    startsAt: "2039-12-24T22:30:00.000Z",
  });
  assert.equal(economics?.serviceDate, "2039-12-25");
  assert.equal(economics?.serviceDateMatchesStart, false);
  assert.equal(economics?.calendarCategory, "christmas");
});

test("High-value retail requires Armed cover and Operations review", () => {
  const risk = assessRisk("high_value_retail", defaultRiskInput);
  assert.equal(risk.recommendedService, "Armed");
  assert.equal(risk.manualReview, true);
  assert.throws(() => quoteBooking({ ...base, purposeCode: "high_value_retail", engagementModel: "flex", term: "single" }), /Armed is the minimum/);
});

test("School risk retains an Unarmed recommendation while requiring safeguarding", () => {
  const risk = assessRisk("school", defaultRiskInput);
  assert.equal(risk.recommendedService, "Unarmed");
  assert.ok(risk.requiredEndorsements.includes("Safeguarding"));
  assert.match(risk.reasons.join(" "), /Safeguarding/i);
});

test("Long Fixed terms use monthly release and require managed review", () => {
  const quote = quoteBooking({ ...base, engagementModel: "fixed", term: "6" });
  assert.equal(quote.releaseCadence, "Monthly");
  assert.equal(quote.manualReview, true);
});
