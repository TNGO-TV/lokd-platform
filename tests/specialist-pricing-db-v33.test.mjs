import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { defaultRiskInput, quoteBooking } from "../app/lib/pilot-pricing.ts";

function migratedDatabase(beforeNoVat = false) {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys=ON");
  for (const file of fs.readdirSync(new URL("../drizzle", import.meta.url)).filter((name) => name.endsWith(".sql")).sort()) {
    if (beforeNoVat && file >= "0079") continue;
    database.exec(fs.readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8")
      .replaceAll("--> statement-breakpoint", ""));
  }
  return database;
}

function run(database, sql, ...values) {
  return database.prepare(sql).run(...values);
}

function quoteArmedStatic() {
  return quoteBooking({
    serviceType: "Armed",
    engagementModel: "flex",
    term: "single",
    purposeCode: "high_value_retail",
    startDate: "2039-12-27",
    shift: "day",
    rosterPattern: "daily",
    riskInput: defaultRiskInput,
    specialistConfiguration: {
      serviceCode: "armed_static",
      teamSize: 1,
      vehicleClass: "none",
      travelKmPerServiceDay: 0,
      planningHours: 1,
      overnightDays: 0,
    },
    now: new Date("2039-12-01T00:00:00.000Z"),
  });
}

function insertSpecialistBooking(database, id, quote, overrides = {}) {
  const breakdown = {
    baseClientCents: quote.baseClientCents,
    calendarPremiumCents: quote.calendarPremiumCents,
    dispatchPremiumCents: quote.dispatchPremiumCents,
    riskPremiumCents: quote.riskPremiumCents,
    marginFloorAdjustmentCents: quote.marginFloorAdjustmentCents,
    subtotalCents: quote.subtotalCents,
    vatCents: quote.vatCents,
    payrollBurdenCents: quote.pricingDecision.payrollBurdenCents,
    readinessAndEquipmentCents: quote.pricingDecision.readinessAndEquipmentCents,
    commandAndSupervisionCents: quote.pricingDecision.commandAndSupervisionCents,
    planningCents: quote.pricingDecision.planningCents,
    travelCents: quote.pricingDecision.travelCents,
    vehicleAndPartnerCents: quote.pricingDecision.vehicleAndPartnerCents,
    overnightCents: quote.pricingDecision.overnightCents,
  };
  const record = {
    id,
    client_id: "CL-V33",
    site_name: "Specialist Site",
    site_area: "Johannesburg",
    post_name: "Controlled specialist post",
    service_type: "Armed",
    purpose_code: "high_value_retail",
    purpose_label: "High-value retail",
    engagement_model: quote.engagementModel,
    notice_window: quote.noticeWindow,
    roster_pattern: "daily",
    calendar_category: quote.firstCalendarCategory,
    calendar_label: quote.firstCalendarLabel,
    risk_band: quote.risk.band,
    risk_score: quote.risk.score,
    risk_reasons: JSON.stringify(quote.risk.reasons),
    required_endorsements: JSON.stringify(quote.risk.requiredEndorsements),
    manual_review: 1,
    headcount: quote.headcount,
    service_day_count: quote.serviceDayCount,
    shift_count: quote.shiftCount,
    officer_total_cents: quote.officerTotalCents,
    gross_platform_contribution_cents: quote.grossPlatformContributionCents,
    pricing_version: quote.version,
    pricing_breakdown: JSON.stringify(breakdown),
    specialist_service_code: quote.specialistServiceCode,
    specialist_configuration: JSON.stringify(quote.specialistConfiguration),
    quote_subtotal_cents: quote.subtotalCents,
    vat_rate_basis_points: quote.vatRateBasisPoints,
    vat_cents: quote.vatCents,
    cost_floor_cents: quote.costFloorCents,
    margin_cents: quote.marginCents,
    margin_basis_points: quote.marginBasisPoints,
    minimum_margin_basis_points: quote.minimumMarginBasisPoints,
    pricing_status: quote.pricingStatus,
    minimum_grade: quote.minimumGrade,
    contract_months: quote.contractMonths,
    start_date: quote.startDate,
    end_date: quote.endDate,
    shift_start: "06:00",
    shift_end: "18:00",
    client_price_cents: quote.clientPriceCents,
    officer_rate_cents: quote.officerRateCents,
    environment: "demo",
    integrity_state: "synthetic",
    funding_model: "advance_only",
    credit_terms_days: 0,
    funding_status: "site_review",
    release_cadence: quote.releaseCadence,
    status: "site_review",
    ...overrides,
  };
  const columns = Object.keys(record);
  database.prepare(`INSERT INTO bookings (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`)
    .run(...Object.values(record));
}

function seedAssignmentPlan(database, bookingId, quote) {
  const past = "2025-01-01T00:00:00.000Z";
  const expiry = "2040-12-31T23:59:59.999Z";
  run(database, `INSERT INTO operational_sites
    (id,client_id,booking_id,name,area,address_label,latitude_e6,longitude_e6,timezone,risk_band,service_type,
     geofence_radius_meters,geofence_version,telemetry_mode,sensitivity_classification,environment,integrity_state,
     status,version,updated_by,created_at,updated_at)
    VALUES ('SITE-V33','CL-V33',?,'Specialist Site','Johannesburg','Controlled test address',-26100000,28100000,
     'Africa/Johannesburg',?,'Armed',120,1,'simulated','operational','demo','synthetic','active',1,'fixture',?,?)`,
  bookingId, quote.risk.band, past, past);
  run(database, `INSERT INTO site_posts
    (id,site_id,booking_id,name,service_type,purpose_code,minimum_grade,post_orders_version,post_orders_content,
     environment,integrity_state,status,created_at,updated_at)
    VALUES ('POST-V33','SITE-V33',?,'Armed post','Armed','high_value_retail',?,'PO-V33-v1','Controlled armed orders',
     'demo','synthetic','active',?,?)`, bookingId, quote.minimumGrade, past, past);
  quote.serviceDates.forEach((serviceDate, dateIndex) => {
    for (let position = 1; position <= quote.headcount; position += 1) {
      run(database, `INSERT INTO roster_slots
        (id,site_id,post_id,booking_id,service_date,starts_at,ends_at,arrival_due_at,check_in_due_at,position_index,
         calendar_category,officer_offer_cents,environment,integrity_state,status,version,created_at,updated_at)
        VALUES (?, 'SITE-V33','POST-V33',?,?,?,? ,?,?,?, ?,?,'demo','synthetic','uncovered',1,?,?)`,
      `SLOT-V33-${dateIndex + 1}-${position}`, bookingId, serviceDate,
      `${serviceDate}T04:00:00.000Z`, `${serviceDate}T16:00:00.000Z`,
      `${serviceDate}T03:45:00.000Z`, `${serviceDate}T04:10:00.000Z`, position,
      quote.firstCalendarCategory, quote.officerRateCents, past, past);
    }
  });
  run(database, `INSERT INTO site_risk_assessments
    (id,site_id,risk_rules_version,risk_band,status,environment,integrity_state,evidence_reference,approved_by,
     approved_at,valid_from,expires_at,version,active_key,created_at)
    VALUES ('RISK-V33','SITE-V33','RISK-V33',?,'approved','demo','synthetic','risk:evidence:v33','reviewer',
     ?,?,?,1,'SITE-V33',?)`, quote.risk.band, past, past, expiry, past);
  run(database, `INSERT INTO post_order_approvals
    (id,post_id,post_orders_version,status,environment,integrity_state,evidence_reference,approved_by,
     approved_at,valid_from,expires_at,version,active_key,created_at)
    VALUES ('POA-V33','POST-V33','PO-V33-v1','approved','demo','synthetic','orders:evidence:v33','reviewer',
     ?,?,?,1,'POST-V33',?)`, past, past, expiry, past);
}

function passSpecialistGates(database) {
  run(database, `UPDATE launch_controls SET status='passed',evidence_level='independently_verified',
    evidence_reference='specialist:evidence:v33',verified_by='board-and-compliance',
    verified_at='2025-01-01T00:00:00.000Z',expires_at='2040-12-31T23:59:59.999Z',version=version+1,
    updated_at='2025-01-01T00:00:00.000Z' WHERE code IN
    ('S1_ARMED_SERVICE_AUTHORITY','S3_SPECIALIST_INSURANCE','S4_SPECIALIST_BOARD_APPROVAL')`);
}

test("database validates the specialist cost floor, VAT and margin contract", () => {
  const database = migratedDatabase();
  try {
    run(database, `INSERT INTO clients
      (id,organisation_name,contact_name,contact_email,approval_status,environment,integrity_state)
      VALUES ('CL-V33','V33 Client','Client','client-v33@example.test','approved','demo','synthetic')`);
    const quote = quoteArmedStatic();
    insertSpecialistBooking(database, "BK-V33", quote);
    assert.equal(database.prepare(`SELECT valid FROM specialist_pricing_validation_v33 WHERE id='BK-V33'`).get().valid, 1);
    assert.throws(() => run(database, `UPDATE bookings SET vat_cents=vat_cents-1 WHERE id='BK-V33'`), /specialist_pricing_floor_invalid/);
    assert.throws(() => run(database, `UPDATE bookings SET margin_basis_points=minimum_margin_basis_points-1 WHERE id='BK-V33'`), /specialist_pricing_floor_invalid/);
  } finally {
    database.close();
  }
});

test("Armed progress requires plan, authority and exact cleared VAT-inclusive funding", () => {
  const database = migratedDatabase();
  try {
    run(database, `INSERT INTO clients
      (id,organisation_name,contact_name,contact_email,approval_status,environment,integrity_state)
      VALUES ('CL-V33','V33 Client','Client','client-v33@example.test','approved','demo','synthetic')`);
    const quote = quoteArmedStatic();
    insertSpecialistBooking(database, "BK-V33", quote);
    seedAssignmentPlan(database, "BK-V33", quote);

    assert.throws(() => run(database, `UPDATE bookings SET status='awaiting_payment',funding_status='awaiting_payment' WHERE id='BK-V33'`), /specialist_service_authority_not_current/);
    passSpecialistGates(database);
    run(database, `UPDATE bookings SET status='awaiting_payment',funding_status='awaiting_payment' WHERE id='BK-V33'`);
    assert.throws(() => run(database, `UPDATE bookings SET status='matching',funding_status='paid_in_full' WHERE id='BK-V33'`), /specialist_full_cleared_advance_funding_required/);

    run(database, `INSERT INTO booking_funding_reconciliations
      (id,booking_id,environment,integrity_state,provider,provider_reference,currency,expected_amount_cents,
       cleared_amount_cents,status,cleared_at,reconciled_at,evidence_reference,evidence_verified_at,
       evidence_expires_at,version,active_key,created_at)
      VALUES ('FUND-V33','BK-V33','demo','synthetic','bank_test','BANK-V33','ZAR',?,?,
       'cleared_reconciled','2025-01-01T00:00:00.000Z','2025-01-01T00:00:00.000Z',
       'funding:evidence:v33','2025-01-01T00:00:00.000Z','2040-12-31T23:59:59.999Z',1,'BK-V33',
       '2025-01-01T00:00:00.000Z')`, quote.clientPriceCents, quote.clientPriceCents);
    run(database, `UPDATE bookings SET status='matching',funding_status='paid_in_full' WHERE id='BK-V33'`);
    run(database, `INSERT INTO officers
      (id,full_name,mobile,email,city,psira_number,psira_grade,psira_expiry,approval_status,banking_status,created_at)
      VALUES ('OFF-V33','Specialist Officer','+27110000000','officer-v33@example.test','Johannesburg',
       'PSIRA-V33','Grade B','2040-12-31','approved','verified','2025-01-01T00:00:00.000Z')`);
    run(database, `INSERT INTO offers
      (id,booking_id,officer_id,position_index,amount_cents,status,expires_at)
      VALUES ('OF-V33','BK-V33','OFF-V33',1,?,'open','2040-01-01T00:00:00.000Z')`, quote.officerRateCents);
    assert.equal(database.prepare(`SELECT status FROM offers WHERE id='OF-V33'`).get().status, "open");
  } finally {
    database.close();
  }
});

test("a partner-review quote cannot advance to a payment request", () => {
  const database = migratedDatabase();
  try {
    run(database, `INSERT INTO clients
      (id,organisation_name,contact_name,contact_email,approval_status,environment,integrity_state)
      VALUES ('CL-V33','V33 Client','Client','client-v33@example.test','approved','demo','synthetic')`);
    const quote = quoteBooking({
      serviceType: "VIP", engagementModel: "flex", term: "single", purposeCode: "executive_protection",
      startDate: "2039-12-27", shift: "day", rosterPattern: "daily", riskInput: defaultRiskInput,
      specialistConfiguration: { serviceCode: "vip_unarmed", teamSize: 1, vehicleClass: "armoured_partner",
        travelKmPerServiceDay: 0, planningHours: 2, overnightDays: 0 },
      now: new Date("2039-12-01T00:00:00.000Z"),
    });
    insertSpecialistBooking(database, "BK-V33-PARTNER", quote, {
      service_type: "VIP", purpose_code: "executive_protection", purpose_label: "Executive protection",
    });
    assert.equal(quote.pricingStatus, "partner_review_required");
    assert.throws(() => run(database, `UPDATE bookings SET status='awaiting_payment',funding_status='awaiting_payment'
      WHERE id='BK-V33-PARTNER'`), /specialist_partner_or_pricing_review_required/);
  } finally {
    database.close();
  }
});


test("no-VAT migration preserves historical amounts and prevents cross-version tax changes", () => {
  const database = migratedDatabase(true);
  try {
    run(database, "INSERT INTO clients (id,organisation_name,contact_name,contact_email,approval_status,environment,integrity_state) VALUES ('CL-V33','Historical fixture','Client','old@example.test','approved','demo','synthetic')");
    const current = quoteArmedStatic();
    const vat = Math.round(current.subtotalCents * 0.15);
    const historical = {...current, version:'LOKD-SPECIALIST-2026.09-v1', vatRateBasisPoints:1500, vatCents:vat, clientPriceCents:current.subtotalCents+vat};
    insertSpecialistBooking(database, 'BK-HISTORICAL', historical);
    const before = database.prepare("SELECT * FROM bookings WHERE id='BK-HISTORICAL'").get();
    database.exec(fs.readFileSync(new URL('../drizzle/0079_owner_no_vat_pricing.sql', import.meta.url),'utf8'));
    assert.deepEqual(database.prepare("SELECT * FROM bookings WHERE id='BK-HISTORICAL'").get(), before);
    assert.equal(database.prepare("SELECT valid FROM specialist_pricing_validation_v33 WHERE id='BK-HISTORICAL'").get().valid,1);
    assert.throws(()=>run(database,"UPDATE bookings SET vat_cents=0 WHERE id='BK-HISTORICAL'"),/specialist_pricing_floor_invalid/);
    assert.throws(()=>run(database,"UPDATE bookings SET pricing_version=? WHERE id='BK-HISTORICAL'",current.version),/specialist_pricing_version_immutable/);
    insertSpecialistBooking(database,'BK-NO-VAT',current);
    assert.equal(database.prepare("SELECT valid FROM specialist_pricing_validation_v33 WHERE id='BK-NO-VAT'").get().valid,1);
    assert.equal(database.prepare("SELECT vat_cents FROM bookings WHERE id='BK-NO-VAT'").get().vat_cents,0);
    assert.throws(()=>run(database,"UPDATE bookings SET vat_rate_basis_points=1500 WHERE id='BK-NO-VAT'"),/specialist_pricing_floor_invalid/);
    assert.throws(()=>run(database,"UPDATE bookings SET client_price_cents=client_price_cents+1 WHERE id='BK-NO-VAT'"),/specialist_pricing_floor_invalid/);
    assert.throws(()=>run(database,"UPDATE bookings SET pricing_version='LOKD-SPECIALIST-2026.09-v1' WHERE id='BK-NO-VAT'"),/specialist_pricing_version_immutable/);
  } finally { database.close(); }
});
