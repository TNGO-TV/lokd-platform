import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

function migratedDatabase() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys=ON");
  for (const file of fs.readdirSync(new URL("../drizzle", import.meta.url)).filter((name) => name.endsWith(".sql")).sort()) {
    const sql = fs.readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8")
      .replaceAll("--> statement-breakpoint", "");
    database.exec(sql);
  }
  return database;
}

function run(database, sql, ...values) {
  return database.prepare(sql).run(...values);
}

function seedChain(database, suffix, environment, integrityState) {
  const clientId = `CLIENT-${suffix}`;
  const bookingId = `BOOKING-${suffix}`;
  const siteId = `SITE-${suffix}`;
  const postId = `POST-${suffix}`;
  const slotId = `SLOT-${suffix}`;
  const officerId = `OFFICER-${suffix}`;
  const shiftId = `SHIFT-${suffix}`;
  const assignmentId = `ASSIGNMENT-${suffix}`;
  const exceptionId = `EXCEPTION-${suffix}`;
  const reliefId = `RELIEF-${suffix}`;
  const timestamp = "2035-06-01T08:00:00.000Z";

  run(database, `INSERT INTO clients
    (id,organisation_name,contact_name,contact_email,approval_status,environment,integrity_state)
    VALUES (?,?,?,?, 'approved',?,?)`, clientId, `Client ${suffix}`, "Contact", `${suffix.toLowerCase()}@example.test`, environment, integrityState);
  run(database, `INSERT INTO bookings
    (id,client_id,site_name,site_area,post_name,service_type,minimum_grade,contract_months,start_date,end_date,
     shift_start,shift_end,client_price_cents,officer_rate_cents,environment,integrity_state,release_cadence)
    VALUES (?,?,?,?,?,'Unarmed','Grade C',1,'2035-06-01','2035-06-30','08:00','20:00',140000,80000,?,?,'Weekly')`,
  bookingId, clientId, `Site ${suffix}`, "Johannesburg", "Gate", environment, integrityState);
  run(database, `INSERT INTO operational_sites
    (id,client_id,booking_id,name,area,address_label,latitude_e6,longitude_e6,environment,integrity_state)
    VALUES (?,?,?,?,?,'Test address',-26100000,28100000,?,?)`,
  siteId, clientId, bookingId, `Site ${suffix}`, "Johannesburg", environment, integrityState);
  run(database, `INSERT INTO site_posts
    (id,site_id,booking_id,name,environment,integrity_state)
    VALUES (?,?,?,'Gate',?,?)`, postId, siteId, bookingId, environment, integrityState);
  run(database, `INSERT INTO roster_slots
    (id,site_id,post_id,booking_id,service_date,starts_at,ends_at,arrival_due_at,check_in_due_at,environment,integrity_state)
    VALUES (?,?,?,?,'2035-06-02','2035-06-02T06:00:00.000Z','2035-06-02T18:00:00.000Z',
      '2035-06-02T05:45:00.000Z','2035-06-02T06:10:00.000Z',?,?)`,
  slotId, siteId, postId, bookingId, environment, integrityState);
  run(database, `INSERT INTO officers
    (id,full_name,mobile,email,city,psira_number,psira_grade,psira_expiry)
    VALUES (?,?,?,?,'Johannesburg',?,'Grade C','2036-12-31')`,
  officerId, `Officer ${suffix}`, `+270000${suffix}`, `${suffix.toLowerCase()}-officer@example.test`, `PSIRA-${suffix}`);
  run(database, `INSERT INTO shifts
    (id,booking_id,officer_id,scheduled_date,environment,integrity_state,status,earnings_cents)
    VALUES (?,?,?,'2035-06-02',?,?,'reserved',80000)`, shiftId, bookingId, officerId, environment, integrityState);
  run(database, `INSERT INTO roster_assignments
    (id,roster_slot_id,officer_id,shift_id,environment,integrity_state,status,assigned_by,assigned_at)
    VALUES (?,?,?,?,?,?,'reserved','fixture',?)`,
  assignmentId, slotId, officerId, shiftId, environment, integrityState, timestamp);
  run(database, `INSERT INTO operational_exceptions
    (id,site_id,post_id,shift_id,exception_type,priority,summary,detected_at,sla_due_at)
    VALUES (?,?,?,?,'absence','P1','Fixture exception',?,?)`,
  exceptionId, siteId, postId, shiftId, timestamp, "2035-06-01T08:15:00.000Z");
  run(database, `INSERT INTO relief_dispatches
    (id,roster_slot_id,site_id,exception_id,replacement_officer_id,environment,integrity_state,status,
     reason_code,requested_by,requested_at,response_due_at)
    VALUES (?,?,?,?,?,?,?,'case_open','absence','fixture',?,?)`,
  reliefId, slotId, siteId, exceptionId, officerId, environment, integrityState, timestamp, "2035-06-01T08:15:00.000Z");

  return { clientId, bookingId, siteId, postId, slotId, officerId, shiftId, assignmentId, exceptionId, reliefId };
}

test("complete demo and production operational graphs preserve one provenance domain", () => {
  const database = migratedDatabase();
  seedChain(database, "DEMO", "demo", "synthetic");
  seedChain(database, "PROD", "production", "production_verified");

  for (const table of ["clients", "bookings", "operational_sites", "site_posts", "roster_slots", "shifts", "roster_assignments", "relief_dispatches"]) {
    assert.equal(database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count, 2, table);
  }
  database.close();
});

test("cross-environment inserts are rejected at every guarded parent-child edge", () => {
  const database = migratedDatabase();
  const demo = seedChain(database, "DEMO", "demo", "synthetic");
  const production = seedChain(database, "PROD", "production", "production_verified");

  assert.throws(() => run(database, `INSERT INTO bookings
    (id,client_id,site_name,site_area,post_name,service_type,minimum_grade,contract_months,start_date,end_date,
     shift_start,shift_end,client_price_cents,officer_rate_cents,environment,integrity_state,release_cadence)
    VALUES ('BOOKING-BAD',?,'Bad','Bad','Bad','Unarmed','Grade C',1,'2035-06-01','2035-06-30',
      '08:00','20:00',1,1,'demo','synthetic','Weekly')`, production.clientId), /booking_client_provenance_mismatch/);

  assert.throws(() => run(database, `INSERT INTO operational_sites
    (id,client_id,booking_id,name,area,address_label,latitude_e6,longitude_e6,environment,integrity_state)
    VALUES ('SITE-BAD',?,?,'Bad','Bad','Bad',0,0,'demo','synthetic')`,
  production.clientId, production.bookingId), /site_parent_provenance_mismatch/);

  assert.throws(() => run(database, `INSERT INTO site_posts
    (id,site_id,booking_id,name,environment,integrity_state)
    VALUES ('POST-BAD',?,?,'Bad','demo','synthetic')`, production.siteId, production.bookingId), /post_parent_provenance_mismatch/);

  assert.throws(() => run(database, `INSERT INTO roster_slots
    (id,site_id,post_id,booking_id,service_date,starts_at,ends_at,arrival_due_at,check_in_due_at,environment,integrity_state)
    VALUES ('SLOT-BAD',?,?,?,'2035-06-03','2035-06-03T06:00:00.000Z','2035-06-03T18:00:00.000Z',
      '2035-06-03T05:45:00.000Z','2035-06-03T06:10:00.000Z','demo','synthetic')`,
  production.siteId, production.postId, production.bookingId), /slot_parent_provenance_mismatch/);

  assert.throws(() => run(database, `INSERT INTO shifts
    (id,booking_id,officer_id,scheduled_date,environment,integrity_state,status,earnings_cents)
    VALUES ('SHIFT-BAD',?,?,'2035-06-02','demo','synthetic','reserved',1)`,
  production.bookingId, demo.officerId), /shift_booking_provenance_mismatch/);

  assert.throws(() => run(database, `INSERT INTO roster_assignments
    (id,roster_slot_id,officer_id,environment,integrity_state,status,assigned_by,assigned_at)
    VALUES ('ASSIGNMENT-BAD',?,?,'demo','synthetic','reserved','fixture','2035-06-01T08:00:00.000Z')`,
  production.slotId, demo.officerId), /assignment_parent_provenance_mismatch/);

  assert.throws(() => run(database, `INSERT INTO relief_dispatches
    (id,roster_slot_id,site_id,replacement_officer_id,environment,integrity_state,status,reason_code,
     requested_by,requested_at,response_due_at)
    VALUES ('RELIEF-BAD',?,?,?,'demo','synthetic','case_open','absence','fixture',
      '2035-06-01T08:00:00.000Z','2035-06-01T08:15:00.000Z')`,
  production.slotId, production.siteId, demo.officerId), /relief_parent_provenance_mismatch/);

  database.close();
});

test("cross-environment relinking updates are rejected and leave the graph unchanged", () => {
  const database = migratedDatabase();
  const demo = seedChain(database, "DEMO", "demo", "synthetic");
  const production = seedChain(database, "PROD", "production", "production_verified");

  for (const [sql, value, message] of [
    [`UPDATE bookings SET client_id=? WHERE id='${demo.bookingId}'`, production.clientId, /booking_client_provenance_mismatch/],
    [`UPDATE operational_sites SET booking_id=? WHERE id='${demo.siteId}'`, production.bookingId, /site_parent_provenance_mismatch/],
    [`UPDATE site_posts SET site_id=? WHERE id='${demo.postId}'`, production.siteId, /post_parent_provenance_mismatch/],
    [`UPDATE roster_slots SET site_id=? WHERE id='${demo.slotId}'`, production.siteId, /slot_parent_provenance_mismatch/],
    [`UPDATE shifts SET booking_id=? WHERE id='${demo.shiftId}'`, production.bookingId, /shift_booking_provenance_mismatch/],
    [`UPDATE roster_assignments SET roster_slot_id=? WHERE id='${demo.assignmentId}'`, production.slotId, /assignment_parent_provenance_mismatch/],
  ]) assert.throws(() => run(database, sql, value), message);

  assert.throws(() => run(database, `UPDATE relief_dispatches SET roster_slot_id=?,site_id=? WHERE id=?`,
    production.slotId, production.siteId, demo.reliefId), /relief_parent_provenance_mismatch/);

  assert.deepEqual({ ...database.prepare(`SELECT client_id AS clientId FROM bookings WHERE id=?`).get(demo.bookingId) }, { clientId: demo.clientId });
  assert.deepEqual({ ...database.prepare(`SELECT roster_slot_id AS slotId,site_id AS siteId FROM relief_dispatches WHERE id=?`).get(demo.reliefId) },
    { slotId: demo.slotId, siteId: demo.siteId });
  database.close();
});

test("same-environment records cannot bypass exact site, booking, officer, or exception bindings", () => {
  const database = migratedDatabase();
  const first = seedChain(database, "ONE", "demo", "synthetic");
  const second = seedChain(database, "TWO", "demo", "synthetic");

  run(database, `INSERT INTO bookings
    (id,client_id,site_name,site_area,post_name,service_type,minimum_grade,contract_months,start_date,end_date,
     shift_start,shift_end,client_price_cents,officer_rate_cents,environment,integrity_state,release_cadence)
    VALUES ('BOOKING-ONE-OTHER',?,'Other','Johannesburg','Other gate','Unarmed','Grade C',1,
      '2035-06-01','2035-06-30','08:00','20:00',140000,80000,'demo','synthetic','Weekly')`, first.clientId);
  assert.throws(() => run(database, `INSERT INTO site_posts
    (id,site_id,booking_id,name,environment,integrity_state)
    VALUES ('POST-SAME-CLIENT-WRONG-BOOKING',?,'BOOKING-ONE-OTHER','Gate','demo','synthetic')`, first.siteId),
  /post_parent_provenance_mismatch/);

  assert.throws(() => run(database, `INSERT INTO roster_slots
    (id,site_id,post_id,booking_id,service_date,starts_at,ends_at,arrival_due_at,check_in_due_at,environment,integrity_state)
    VALUES ('SLOT-MIXED',?,?,?,'2035-06-03','2035-06-03T06:00:00.000Z','2035-06-03T18:00:00.000Z',
      '2035-06-03T05:45:00.000Z','2035-06-03T06:10:00.000Z','demo','synthetic')`,
  first.siteId, second.postId, first.bookingId), /slot_parent_provenance_mismatch/);

  assert.throws(() => run(database, `INSERT INTO roster_assignments
    (id,roster_slot_id,officer_id,shift_id,environment,integrity_state,status,assigned_by,assigned_at)
    VALUES ('ASSIGNMENT-MIXED',?,?,?,'demo','synthetic','reserved','fixture','2035-06-01T08:00:00.000Z')`,
  first.slotId, first.officerId, second.shiftId), /assignment_parent_provenance_mismatch/);

  assert.throws(() => run(database, `INSERT INTO relief_dispatches
    (id,roster_slot_id,site_id,exception_id,replacement_officer_id,environment,integrity_state,status,
     reason_code,requested_by,requested_at,response_due_at)
    VALUES ('RELIEF-MIXED',?,?,?,?,'demo','synthetic','case_open','absence','fixture',
      '2035-06-01T08:00:00.000Z','2035-06-01T08:15:00.000Z')`,
  first.slotId, first.siteId, second.exceptionId, first.officerId), /relief_parent_provenance_mismatch/);

  database.close();
});

test("assignment, shift, and relief provenance cannot be relabelled after insertion", () => {
  const database = migratedDatabase();
  const demo = seedChain(database, "DEMO", "demo", "synthetic");

  assert.throws(() => run(database, `UPDATE roster_assignments
    SET environment='production',integrity_state='production_verified' WHERE id=?`, demo.assignmentId),
  /assignment_provenance_(immutable|mismatch)/);
  assert.throws(() => run(database, `UPDATE shifts
    SET environment='production',integrity_state='production_verified' WHERE id=?`, demo.shiftId),
  /shift_(provenance_immutable|booking_provenance_mismatch)/);
  assert.throws(() => run(database, `UPDATE relief_dispatches
    SET environment='production',integrity_state='production_verified' WHERE id=?`, demo.reliefId),
  /relief_(provenance_immutable|parent_provenance_mismatch)/);

  assert.deepEqual({ ...database.prepare(`SELECT environment,integrity_state AS integrityState
    FROM roster_assignments WHERE id=?`).get(demo.assignmentId) }, { environment: "demo", integrityState: "synthetic" });
  assert.deepEqual({ ...database.prepare(`SELECT environment,integrity_state AS integrityState
    FROM shifts WHERE id=?`).get(demo.shiftId) }, { environment: "demo", integrityState: "synthetic" });
  assert.deepEqual({ ...database.prepare(`SELECT environment,integrity_state AS integrityState
    FROM relief_dispatches WHERE id=?`).get(demo.reliefId) }, { environment: "demo", integrityState: "synthetic" });
  database.close();
});
