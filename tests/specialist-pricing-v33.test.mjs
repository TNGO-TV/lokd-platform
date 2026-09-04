import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  defaultSpecialistConfiguration,
  indicativeSingleShiftPrice,
  normalizeSpecialistConfiguration,
  priceSpecialistCostFloor,
  specialistProfiles,
  SPECIALIST_PRICING_VERSION,
  ZA_VAT_RATE_BASIS_POINTS,
} from "../app/lib/specialist-pricing.ts";
import { defaultRiskInput, quoteBooking } from "../app/lib/pilot-pricing.ts";

const specialistCodes = [
  "armed_static",
  "armed_movement",
  "vip_unarmed",
  "vip_armed",
  "vip_protective_driver",
  "vip_team",
];

test("Version 33 defines one base model and six distinct Armed/VIP models", () => {
  assert.deepEqual(Object.keys(specialistProfiles), ["standard_unarmed", ...specialistCodes]);
  assert.equal(specialistProfiles.armed_static.serviceType, "Armed");
  assert.equal(specialistProfiles.armed_movement.serviceType, "Armed");
  assert.equal(specialistProfiles.vip_team.minimumTeamSize, 2);
  assert.equal(indicativeSingleShiftPrice("vip_team").listSubtotalCents, 2_300_000);
});

test("every indicative quote applies the stored margin floor before 15% VAT", () => {
  for (const code of Object.keys(specialistProfiles)) {
    const price = indicativeSingleShiftPrice(code);
    assert.equal(price.version, SPECIALIST_PRICING_VERSION);
    assert.equal(price.vatRateBasisPoints, ZA_VAT_RATE_BASIS_POINTS);
    assert.equal(price.vatCents, Math.round(price.subtotalCents * 0.15));
    assert.equal(price.totalCents, price.subtotalCents + price.vatCents);
    assert.equal(price.marginCents, price.subtotalCents - price.costFloorCents);
    assert.ok(price.marginBasisPoints >= price.minimumMarginBasisPoints, code);
  }
});

test("Armed static and movement are priced as separate operating models", () => {
  const staticPrice = indicativeSingleShiftPrice("armed_static");
  const movementPrice = indicativeSingleShiftPrice("armed_movement");
  assert.ok(movementPrice.totalCents > staticPrice.totalCents);
  assert.ok(movementPrice.planningCents > staticPrice.planningCents);
  assert.ok(movementPrice.commandAndSupervisionCents > staticPrice.commandAndSupervisionCents);
  assert.equal(specialistProfiles.armed_static.allowedVehicles.includes("standard_suv"), false);
  assert.equal(specialistProfiles.armed_movement.allowedVehicles.includes("standard_suv"), true);
});

test("VIP role, team and movement inputs change the controlled cost floor", () => {
  const unarmed = indicativeSingleShiftPrice("vip_unarmed");
  const armed = indicativeSingleShiftPrice("vip_armed");
  const driver = indicativeSingleShiftPrice("vip_protective_driver");
  const team = indicativeSingleShiftPrice("vip_team");
  assert.ok(armed.totalCents > unarmed.totalCents);
  assert.ok(driver.totalCents > unarmed.totalCents);
  assert.ok(team.totalCents > unarmed.totalCents);

  const configured = priceSpecialistCostFloor({
    serviceCode: "vip_protective_driver",
    serviceDayCount: 2,
    shiftCount: 2,
    officerTotalCents: 1_000_000,
    calendarAdjustedListSubtotalCents: 2_700_000,
    configuration: normalizeSpecialistConfiguration("VIP", {
      serviceCode: "vip_protective_driver",
      teamSize: 1,
      vehicleClass: "standard_suv",
      travelKmPerServiceDay: 120,
      planningHours: 4,
      overnightDays: 1,
    }),
  });
  assert.equal(configured.vehicleAndPartnerCents, 440_000);
  assert.equal(configured.travelCents, 216_000);
  assert.equal(configured.overnightCents, 180_000);
  assert.ok(configured.marginBasisPoints >= 3_600);
});

test("armoured partner estimates cannot become authoritative prices", () => {
  const configuration = normalizeSpecialistConfiguration("VIP", {
    ...defaultSpecialistConfiguration.VIP,
    serviceCode: "vip_unarmed",
    vehicleClass: "armoured_partner",
  });
  const result = priceSpecialistCostFloor({
    serviceCode: "vip_unarmed",
    serviceDayCount: 1,
    shiftCount: 1,
    officerTotalCents: 450_000,
    calendarAdjustedListSubtotalCents: 1_150_000,
    configuration,
  });
  assert.equal(result.pricingStatus, "partner_review_required");
  assert.match(result.reviewReasons.join(" "), /verified armoured-vehicle partner quote/i);
});

test("configuration rejects cross-service, undersized-team and unsupported-vehicle inputs", () => {
  assert.throws(() => normalizeSpecialistConfiguration("Armed", { serviceCode: "vip_armed" }), /valid Armed service model/);
  assert.throws(() => normalizeSpecialistConfiguration("VIP", { serviceCode: "vip_team", teamSize: 1 }), /Team size/);
  assert.throws(() => normalizeSpecialistConfiguration("Armed", { serviceCode: "armed_static", vehicleClass: "standard_suv" }), /does not support/);
});

test("client quote stores the specialist decision and funds the VAT-inclusive total", () => {
  const quote = quoteBooking({
    serviceType: "VIP",
    engagementModel: "flex",
    term: "single",
    purposeCode: "executive_protection",
    startDate: "2026-09-14",
    shift: "day",
    rosterPattern: "daily",
    riskInput: defaultRiskInput,
    specialistConfiguration: {
      serviceCode: "vip_team",
      teamSize: 2,
      vehicleClass: "client_vehicle",
      travelKmPerServiceDay: 80,
      planningHours: 6,
      overnightDays: 0,
    },
    now: new Date("2026-09-01T00:00:00.000Z"),
  });
  assert.equal(quote.version, SPECIALIST_PRICING_VERSION);
  assert.equal(quote.specialistServiceCode, "vip_team");
  assert.equal(quote.headcount, 2);
  assert.equal(quote.shiftCount, 2);
  assert.equal(quote.clientPriceCents, quote.subtotalCents + quote.vatCents);
  assert.equal(quote.pricingStatus, "authoritative");
  assert.ok(quote.requiredSpecialistControls.includes("Named team leader"));
});

test("public specialist routes and database fail-closed controls ship together", () => {
  const armed = fs.readFileSync(new URL("../app/armed-security/page.tsx", import.meta.url), "utf8");
  const vip = fs.readFileSync(new URL("../app/vip-protection/page.tsx", import.meta.url), "utf8");
  const migration = fs.readFileSync(new URL("../drizzle/0027_marvelous_big_bertha.sql", import.meta.url), "utf8");
  assert.match(armed, /Armed static guarding/);
  assert.match(armed, /Armed movement protection/);
  assert.match(vip, /vip_protective_driver/);
  assert.match(vip, /vip_team/);
  assert.match(migration, /specialist_pricing_floor_invalid/);
  assert.match(migration, /S1_ARMED_SERVICE_AUTHORITY/);
  assert.match(migration, /S2_VIP_SERVICE_AUTHORITY/);
  assert.match(migration, /specialist_full_cleared_advance_funding_required/);
});
