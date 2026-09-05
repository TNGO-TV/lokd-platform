import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  applyOperationsAction,
  ensureOperationsDemoData,
  readOperationsState,
} from "../app/lib/operations-server.ts";

class Prepared {
  constructor(owner, sql, values = []) {
    this.owner = owner;
    this.sql = sql;
    this.values = values;
  }

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
    database.exec(fs.readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8")
      .replaceAll("--> statement-breakpoint", ""));
  }
  return database;
}

function run(database, sql, ...values) {
  return database.prepare(sql).run(...values);
}

function rows(database, sql, ...values) {
  return database.prepare(sql).all(...values).map((row) => ({ ...row }));
}

const actor = {
  email: "ops-isolation@example.test",
  displayName: "Operations isolation test",
  owner: true,
  roles: ["operations"],
  clientId: null,
  officerId: null,
};

const capturedAt = "2026-08-28T08:00:00.000Z";

function seedPredictableProductionIdentities(database) {
  run(database, `INSERT INTO clients
    (id,organisation_name,contact_name,contact_email,approval_status,environment,integrity_state)
    VALUES ('CL-001','PRODUCTION SENTINEL CLIENT','Production Contact','production-sentinel@example.test',
      'approved','production','production_verified')`);
  run(database, `INSERT INTO officers
    (id,full_name,mobile,email,city,psira_number,psira_grade,psira_expiry,approval_status,banking_status,
     flex_available,external_work_acknowledged,rest_window_confirmed,created_at)
    VALUES ('OFF-004','PRODUCTION SENTINEL OFFICER','+27110000001','production-officer@example.test',
      'Johannesburg','PSIRA-PRODUCTION-SENTINEL','Grade B','2040-12-31','approved','verified',0,0,0,?)`, capturedAt);
  run(database, `INSERT INTO officer_passports
    (officer_id,passport_number,public_token_hash,status,readiness_label,issued_at,last_reviewed_at,next_review_at,
     updated_at,environment,integrity_state,evidence_reference)
    VALUES ('OFF-004','PASS-PRODUCTION-SENTINEL','HASH-PRODUCTION-SENTINEL','active','LOKD Ready',?,?,?, ?,
      'production','verified','production:passport:evidence')`, capturedAt, capturedAt, "2040-12-31T23:59:59.999Z", capturedAt);
}

function capturePredictableProductionRows(database) {
  return {
    client: rows(database, `SELECT * FROM clients WHERE id='CL-001'`),
    officer: rows(database, `SELECT * FROM officers WHERE id='OFF-004'`),
    passport: rows(database, `SELECT * FROM officer_passports WHERE officer_id='OFF-004'`),
  };
}

function seedProductionActivationCard(database) {
  run(database, `INSERT INTO clients
    (id,organisation_name,contact_name,contact_email,approval_status,environment,integrity_state)
    VALUES ('CL-PROD','Production Client','Production Contact','client-prod@example.test','approved',
      'production','production_verified')`);
  run(database, `INSERT INTO bookings
    (id,client_id,site_name,site_area,post_name,service_type,purpose_code,purpose_label,engagement_model,
     calendar_category,calendar_label,minimum_grade,contract_months,start_date,end_date,shift_start,shift_end,
     client_price_cents,officer_rate_cents,pricing_version,environment,integrity_state,funding_status,release_cadence,status)
    VALUES ('BK-PROD','CL-PROD','Production Site','Johannesburg','Production Gate','Unarmed',
      'commercial_access','Commercial access','flex','ordinary','Ordinary Monday-Saturday','Grade C',0,
      '2039-08-29','2039-08-29','08:00','20:00',160000,80000,'LOKD-PREMIUM-2026.09',
      'production','production_verified','paid_in_full','Weekly','matching')`);
  run(database, `INSERT INTO operational_sites
    (id,client_id,booking_id,name,area,address_label,latitude_e6,longitude_e6,risk_band,service_type,
     geofence_radius_meters,geofence_version,telemetry_mode,sensitivity_classification,status,version,updated_by,
     created_at,updated_at,environment,integrity_state)
    VALUES ('SITE-PROD','CL-PROD','BK-PROD','Production Site','Johannesburg','Production address withheld',
      -26100000,28100000,'Standard','Unarmed',120,1,'live','restricted','active',1,'production-system',?,?,
      'production','production_verified')`, capturedAt, capturedAt);
  run(database, `INSERT INTO site_posts
    (id,site_id,booking_id,name,service_type,purpose_code,minimum_grade,post_orders_version,status,
     created_at,updated_at,environment,integrity_state)
    VALUES ('POST-PROD','SITE-PROD','BK-PROD','Production Gate','Unarmed','commercial_access','Grade C',
      'PROD-PO-v1','active',?,?,'production','production_verified')`, capturedAt, capturedAt);
  run(database, `INSERT INTO roster_slots
    (id,site_id,post_id,booking_id,service_date,starts_at,ends_at,arrival_due_at,check_in_due_at,status,version,
     created_at,updated_at,environment,integrity_state)
    VALUES ('SLOT-PROD','SITE-PROD','POST-PROD','BK-PROD','2039-08-29','2039-08-29T06:00:00.000Z',
      '2039-08-29T18:00:00.000Z','2039-08-29T05:45:00.000Z','2039-08-29T06:10:00.000Z',
      'uncovered',1,?,?,'production','production_verified')`, capturedAt, capturedAt);
  run(database, `INSERT INTO officers
    (id,full_name,mobile,email,city,psira_number,psira_grade,psira_expiry,approval_status,banking_status,created_at)
    VALUES ('OFF-PROD','Production Officer','+27110000999','officer-prod@example.test','Johannesburg',
      'PSIRA-PROD','Grade B','2040-12-31','approved','verified',?)`, capturedAt);
  run(database, `INSERT INTO booking_funding_reconciliations
    (id,booking_id,environment,integrity_state,provider,provider_reference,currency,expected_amount_cents,
     cleared_amount_cents,status,cleared_at,reconciled_at,evidence_reference,evidence_verified_at,evidence_expires_at,
     version,active_key,created_at)
    VALUES ('FR-PROD','BK-PROD','production','verified','bank_api','BANK-PROD-SECRET','ZAR',160000,160000,
      'cleared_reconciled',?,?,'bank:evidence:production:secret:123456789',?,'2040-12-31T23:59:59.999Z',
      1,'BK-PROD',?)`, capturedAt, capturedAt, capturedAt, capturedAt);
  run(database, `INSERT INTO assignment_activation_commands
    (id,activation_key,request_hash,roster_slot_id,officer_id,expected_slot_version,environment,integrity_state,
     state,roster_assignment_id,shift_id,requested_by,requested_at,completed_at,version)
    VALUES ('AC-PROD','production:activation:key:must-not-leak','request-hash-prod','SLOT-PROD','OFF-PROD',1,
      'production','production_candidate','blocked',NULL,NULL,'production-controller@example.test',?,?,1)`, capturedAt, capturedAt);
  run(database, `INSERT INTO assignment_activation_decisions
    (id,command_id,sequence,checkpoint,decision,environment,summary,evaluation_hash,evaluated_at)
    VALUES ('AD-PROD','AC-PROD',1,'activation','blocked','production',
      'Production activation remains blocked.','evaluation-hash-prod',?)`, capturedAt);
  run(database, `INSERT INTO assignment_activation_blockers
    (id,decision_id,code,category,detail,created_at)
    VALUES ('AB-PROD','AD-PROD','LAUNCH_GATE:G2_CONTROL_ROOM_INSPECTION','launch',
      'Control-room inspection evidence remains pending.',?)`, capturedAt);
}

function captureProductionActivationRows(database) {
  return {
    clients: rows(database, `SELECT * FROM clients WHERE environment='production' ORDER BY id`),
    bookings: rows(database, `SELECT * FROM bookings WHERE environment='production' ORDER BY id`),
    sites: rows(database, `SELECT * FROM operational_sites WHERE environment='production' ORDER BY id`),
    posts: rows(database, `SELECT * FROM site_posts WHERE environment='production' ORDER BY id`),
    slots: rows(database, `SELECT * FROM roster_slots WHERE environment='production' ORDER BY id`),
    funding: rows(database, `SELECT * FROM booking_funding_reconciliations WHERE environment='production' ORDER BY id`),
    commands: rows(database, `SELECT * FROM assignment_activation_commands WHERE environment='production' ORDER BY id`),
    decisions: rows(database, `SELECT d.* FROM assignment_activation_decisions d
      JOIN assignment_activation_commands c ON c.id=d.command_id WHERE c.environment='production' ORDER BY d.id`),
    blockers: rows(database, `SELECT b.* FROM assignment_activation_blockers b
      JOIN assignment_activation_decisions d ON d.id=b.decision_id
      JOIN assignment_activation_commands c ON c.id=d.command_id WHERE c.environment='production' ORDER BY b.id`),
  };
}

test("public demo bootstrap leaves predictable production identities byte-for-byte unchanged and hidden", async () => {
  const database = migratedDatabase();
  seedPredictableProductionIdentities(database);
  const before = capturePredictableProductionRows(database);
  const db = new D1Adapter(database);

  let bootstrapError = null;
  try {
    await ensureOperationsDemoData(db);
  } catch (error) {
    bootstrapError = error;
  }

  assert.deepEqual(capturePredictableProductionRows(database), before);
  if (!bootstrapError) {
    const state = await readOperationsState(db);
    assert.equal(state.sites.some((site) => site.clientName === "PRODUCTION SENTINEL CLIENT"), false);
    assert.equal(state.workforce.officers.some((officer) => officer.officerName === "PRODUCTION SENTINEL OFFICER"), false);
  }
  database.close();
});

test("demo bootstrap refuses to attach synthetic records to predictable production identities", async () => {
  const database = migratedDatabase();
  seedPredictableProductionIdentities(database);
  const db = new D1Adapter(database);

  await assert.rejects(
    () => ensureOperationsDemoData(db),
    /synthetic Operations dataset could not be isolated/i,
  );
  const syntheticChildren = Number(database.prepare(`SELECT
    (SELECT COUNT(*) FROM bookings WHERE client_id='CL-001' AND environment='demo' AND integrity_state='synthetic')
    + (SELECT COUNT(*) FROM workforce_engagements WHERE officer_id='OFF-004' AND environment='demo') AS total`).get().total);
  assert.equal(syntheticChildren, 0);
  database.close();
});

test("database rejects a synthetic booking whose parent client is production", () => {
  const database = migratedDatabase();
  run(database, `INSERT INTO clients
    (id,organisation_name,contact_name,contact_email,approval_status,environment,integrity_state)
    VALUES ('CL-PARENT-PROD','Production Parent','Production Contact','parent-prod@example.test','approved',
      'production','production_verified')`);

  assert.throws(() => {
    run(database, `INSERT INTO bookings
      (id,client_id,site_name,site_area,post_name,service_type,minimum_grade,contract_months,start_date,end_date,
       shift_start,shift_end,client_price_cents,officer_rate_cents,release_cadence,environment,integrity_state)
      VALUES ('BK-SYNTH-CHILD','CL-PARENT-PROD','Synthetic child','Johannesburg','Gate','Unarmed','Grade C',0,
        '2039-08-29','2039-08-29','08:00','20:00',160000,80000,'Weekly','demo','synthetic')`);
  }, /booking_client_provenance_mismatch/);
  assert.equal(Number(database.prepare(`SELECT COUNT(*) AS total FROM bookings WHERE id='BK-SYNTH-CHILD'`).get().total), 0);
  database.close();
});

test("mixed activation queue exposes production only as redacted read-only state and demo evaluation cannot mutate it", async () => {
  const database = migratedDatabase();
  const db = new D1Adapter(database);
  await ensureOperationsDemoData(db);
  seedProductionActivationCard(database);
  const before = captureProductionActivationRows(database);

  const firstState = await readOperationsState(db);
  const productionCard = firstState.activation.queue.find((item) => item.commandId === "AC-PROD");
  assert.ok(productionCard);
  assert.equal(productionCard.environment, "production");
  assert.equal(productionCard.recordKind, "production");
  assert.equal(productionCard.activationKey, null);
  assert.equal(productionCard.productionAuthorised, false);
  assert.equal(productionCard.databaseProtected, false);
  assert.equal(productionCard.fundingReference, "verified:456789");
  assert.deepEqual(productionCard.blockers.map((blocker) => blocker.code), ["LAUNCH_GATE:G2_CONTROL_ROOM_INSPECTION"]);
  assert.equal(JSON.stringify(productionCard).includes("production:activation:key:must-not-leak"), false);
  assert.equal(JSON.stringify(productionCard).includes("bank:evidence:production:secret:123456789"), false);

  await assert.rejects(() => applyOperationsAction(db, {
    action: "evaluate_assignment_activation",
    rosterSlotId: productionCard.rosterSlotId,
    officerId: productionCard.officerId,
    expectedSlotVersion: productionCard.slotVersion,
  }, actor), /unavailable/i);
  assert.deepEqual(captureProductionActivationRows(database), before);

  const preview = firstState.activation.queue.find((item) => item.environment === "demo_synthetic"
    && item.recordKind === "synthetic_rehearsal" && item.commandId === null);
  assert.ok(preview, "A synthetic rehearsal preview must be available for the safe demo action.");
  await applyOperationsAction(db, {
    action: "evaluate_assignment_activation",
    rosterSlotId: preview.rosterSlotId,
    officerId: preview.officerId,
    expectedSlotVersion: preview.slotVersion,
  }, actor);

  assert.deepEqual(captureProductionActivationRows(database), before);
  const secondState = await readOperationsState(db);
  const persistedDemo = secondState.activation.queue.find((item) => item.environment === "demo_synthetic"
    && item.commandId !== null);
  assert.ok(persistedDemo);
  assert.equal(persistedDemo.recordKind, "synthetic_rehearsal");
  assert.equal(persistedDemo.productionAuthorised, false);
  assert.equal(secondState.activation.queue.filter((item) => item.commandId === "AC-PROD").length, 1);
  assert.deepEqual(captureProductionActivationRows(database), before);
  database.close();
});
