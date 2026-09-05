import { ClerkTestRequest } from "./clerk-request.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { env } from "cloudflare:workers";

class Prepared {
  constructor(owner, sql, values = []) { this.owner = owner; this.sql = sql; this.values = values; }
  bind(...values) { return new Prepared(this.owner, this.sql, values); }
  async first() { return this.owner.database.prepare(this.sql).get(...this.values) ?? null; }
  async all() { return { results: this.owner.database.prepare(this.sql).all(...this.values) }; }
  async run() { return this.runSync(); }
  runSync() {
    const result = this.owner.database.prepare(this.sql).run(...this.values);
    return { meta: { changes: Number(result.changes) } };
  }
}

class D1Adapter {
  constructor(database) { this.database = database; }
  prepare(sql) { return new Prepared(this, sql); }
  async batch(statements) {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const results = statements.map((statement) => statement.runSync());
      this.database.exec("COMMIT");
      return results;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
}

function migratedDatabase() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys=ON");
  for (const file of fs.readdirSync(new URL("../drizzle", import.meta.url)).filter((name) => name.endsWith(".sql")).sort()) {
    database.exec(fs.readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8").replaceAll("--> statement-breakpoint", ""));
  }
  return database;
}

function row(database, sql, ...values) { return database.prepare(sql).get(...values); }

function actionRequest(scope, action) {
  return new ClerkTestRequest(`https://demo.lokd.co.za/api/pilot?scope=${scope}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://demo.lokd.co.za",
      "sec-fetch-site": "same-origin",
      "oai-authenticated-user-email": "owner@lokd.example",
    },
    body: JSON.stringify(action),
  });
}

test("client request reaches funded offer and connected synthetic roster assignment", async () => {
  const database = migratedDatabase();
  env.DB = new D1Adapter(database);
  env.LOKD_APP_STAGE = "demo";
  env.LOKD_PILOT_ACCESS_JSON = JSON.stringify({ owners: ["owner@lokd.example"] });
  const pilotRoute = await import("../app/api/pilot/route.ts");

  const startDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const createAction = {
    action: "create_booking",
    commandId: "test-booking-command-0001",
    siteName: "Connected Rosebank Site",
    siteArea: "Rosebank",
    addressLabel: "1 Test Avenue, Rosebank, Johannesburg",
    serviceType: "Unarmed",
    engagementModel: "fixed",
    term: "1",
    rosterPattern: "monday_saturday",
    purposeCode: "commercial_access",
    riskInput: {
      assetExposure: "standard",
      publicAccess: "controlled",
      incidentHistory: "none",
      existingControls: "strong",
      nightOperation: false,
      vulnerablePeople: false,
    },
    startDate,
    shift: "day",
    postName: "Connected north gate",
    instructions: "Verify visitors against the authorised access list.",
  };
  const createResponse = await pilotRoute.POST(actionRequest("client", createAction));
  assert.equal(createResponse.status, 200, await createResponse.text());
  const booking = row(database, `SELECT * FROM bookings WHERE id LIKE 'BK-DEMO-%' ORDER BY rowid DESC LIMIT 1`);
  assert.ok(booking);
  assert.equal(booking.status, "site_review");
  assert.equal(booking.site_name, createAction.siteName);
  assert.equal(booking.site_area, createAction.siteArea);
  assert.equal(row(database, `SELECT COUNT(*) AS total FROM operational_sites WHERE booking_id=?`, booking.id).total, 1);
  assert.equal(row(database, `SELECT COUNT(*) AS total FROM site_posts WHERE booking_id=?`, booking.id).total, 1);
  assert.equal(row(database, `SELECT COUNT(*) AS total FROM roster_slots WHERE booking_id=?`, booking.id).total, booking.shift_count);
  assert.equal(booking.shift_count, booking.service_day_count * booking.headcount);
  assert.equal(row(database, `SELECT COUNT(*) AS total FROM site_risk_assessments risk JOIN operational_sites site ON site.id=risk.site_id WHERE site.booking_id=? AND risk.status='review_required'`, booking.id).total, 1);
  assert.equal(row(database, `SELECT status FROM payment_orders WHERE booking_id=?`, booking.id).status, "requires_action");
  assert.equal(row(database, `SELECT COUNT(*) AS total FROM domain_outbox_events WHERE aggregate_id=? AND event_type='payment.order.created'`, booking.id).total, 1);

  const repeatedCreate = await pilotRoute.POST(actionRequest("client", createAction));
  assert.equal(repeatedCreate.status, 200, await repeatedCreate.text());
  assert.equal(row(database, `SELECT COUNT(*) AS total FROM bookings WHERE id=?`, booking.id).total, 1);
  const changedCreate = await pilotRoute.POST(actionRequest("client", { ...createAction, siteArea: "Sandton" }));
  assert.equal(changedCreate.status, 409, await changedCreate.text());

  const approvalResponse = await pilotRoute.POST(actionRequest("operations", { action: "approve_risk_plan", bookingId: booking.id }));
  assert.equal(approvalResponse.status, 200, await approvalResponse.text());
  assert.equal(row(database, `SELECT status FROM bookings WHERE id=?`, booking.id).status, "awaiting_payment");

  const paymentResponse = await pilotRoute.POST(actionRequest("operations", { action: "confirm_booking_payment", bookingId: booking.id }));
  assert.equal(paymentResponse.status, 200, await paymentResponse.text());
  assert.equal(row(database, `SELECT status FROM payment_orders WHERE booking_id=?`, booking.id).status, "reconciled");
  assert.equal(row(database, `SELECT COUNT(*) AS total FROM booking_funding_reconciliations WHERE booking_id=? AND status='cleared_reconciled'`, booking.id).total, 1);
  const offer = row(database, `SELECT id,status,position_index AS positionIndex FROM offers WHERE booking_id=? ORDER BY rowid DESC LIMIT 1`, booking.id);
  assert.equal(offer.status, "open");
  assert.equal(offer.positionIndex, 1);

  const acceptResponse = await pilotRoute.POST(actionRequest("officer", { action: "accept_offer", offerId: offer.id }));
  assert.equal(acceptResponse.status, 200, await acceptResponse.text());
  const assignment = row(database, `SELECT assignment.id,assignment.status,assignment.active_key AS activeKey,
    slot.id AS slotId,shift.id AS shiftId FROM roster_assignments assignment
    JOIN roster_slots slot ON slot.id=assignment.roster_slot_id
    JOIN shifts shift ON shift.id=assignment.shift_id WHERE slot.booking_id=? ORDER BY slot.starts_at LIMIT 1`, booking.id);
  assert.equal(assignment.status, "confirmed");
  assert.equal(assignment.activeKey, assignment.slotId);
  assert.equal(row(database, `SELECT COUNT(*) AS total FROM shifts WHERE booking_id=?`, booking.id).total, booking.service_day_count);
  assert.equal(row(database, `SELECT COUNT(*) AS total FROM roster_assignments assignment JOIN roster_slots slot ON slot.id=assignment.roster_slot_id WHERE slot.booking_id=? AND slot.position_index=1`, booking.id).total, booking.service_day_count);
  assert.equal(row(database, `SELECT COUNT(*) AS total FROM shifts shift JOIN roster_assignments assignment ON assignment.shift_id=shift.id JOIN roster_slots slot ON slot.id=assignment.roster_slot_id WHERE slot.booking_id=? AND shift.earnings_cents=slot.officer_offer_cents`, booking.id).total, booking.service_day_count);
  assert.equal(row(database, `SELECT COUNT(*) AS total FROM officer_site_inductions induction
    JOIN operational_sites site ON site.id=induction.site_id WHERE site.booking_id=? AND induction.officer_id='OFF-001'`, booking.id).total, 1);
  assert.equal(row(database, `SELECT COUNT(*) AS total FROM assignment_workforce_snapshots snapshot JOIN roster_assignments assignment ON assignment.id=snapshot.roster_assignment_id JOIN roster_slots slot ON slot.id=assignment.roster_slot_id WHERE slot.booking_id=? AND snapshot.decision='synthetic_rehearsal'`, booking.id).total, booking.service_day_count);
  assert.equal(row(database, `SELECT status FROM roster_slots WHERE id=?`, assignment.slotId).status, "scheduled");

  const arrivalResponse = await pilotRoute.POST(actionRequest("client", { action: "record_demo_arrival_check", shiftId: assignment.shiftId }));
  assert.equal(arrivalResponse.status, 200, await arrivalResponse.text());
  assert.equal(row(database, `SELECT passport_verification_status AS status FROM shifts WHERE id=?`, assignment.shiftId).status, "green");
  const checkInResponse = await pilotRoute.POST(actionRequest("officer", { action: "check_in", shiftId: assignment.shiftId }));
  assert.equal(checkInResponse.status, 200, await checkInResponse.text());
  const completionResponse = await pilotRoute.POST(actionRequest("officer", { action: "complete_shift", shiftId: assignment.shiftId }));
  assert.equal(completionResponse.status, 200, await completionResponse.text());
  const signoffResponse = await pilotRoute.POST(actionRequest("client", { action: "client_signoff", shiftId: assignment.shiftId }));
  assert.equal(signoffResponse.status, 200, await signoffResponse.text());
  assert.equal(row(database, `SELECT status,client_signoff_status AS signoff FROM shifts WHERE id=?`, assignment.shiftId).status, "verified");
  database.close();
});
