import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { env } from "cloudflare:workers";

class Prepared {
  constructor(owner, sql, values = []) {
    this.owner = owner;
    this.sql = sql;
    this.values = values;
  }
  bind(...values) {
    return new Prepared(this.owner, this.sql, values);
  }
  async first() {
    return this.owner.database.prepare(this.sql).get(...this.values) ?? null;
  }
  async all() {
    return { results: this.owner.database.prepare(this.sql).all(...this.values) };
  }
  async run() {
    return this.runSync();
  }
  runSync() {
    const result = this.owner.database.prepare(this.sql).run(...this.values);
    return { meta: { changes: Number(result.changes) } };
  }
}

class D1Adapter {
  constructor(database) {
    this.database = database;
  }
  prepare(sql) {
    return new Prepared(this, sql);
  }
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
  for (const file of fs
    .readdirSync(new URL("../drizzle", import.meta.url))
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    database.exec(
      fs
        .readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8")
        .replaceAll("--> statement-breakpoint", ""),
    );
  }
  return database;
}

function request(host, path, method = "GET", body, email = "owner@lokd.example") {
  return new Request(`https://${host}${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      origin: `https://${host}`,
      "sec-fetch-site": "same-origin",
      "x-lokd-verified-email": email,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

test("the controlled onboarding API rehearses all three workspaces and preserves hard locks", async () => {
  const database = migratedDatabase();
  env.DB = new D1Adapter(database);
  env.LOKD_APP_STAGE = "demo";
  env.LOKD_PILOT_ACCESS_JSON = JSON.stringify({
    owners: ["owner@lokd.example"],
    clients: {
      "client@lokd.example": "CL-001",
      "other-client@lokd.example": "CL-999",
    },
    officers: { "officer@lokd.example": "OFF-001" },
  });
  const pilot = await import("../app/api/pilot/route.ts");
  const onboarding = await import("../app/api/onboarding/route.ts");

  try {
    const pilotSeed = await pilot.GET(
      request("operations.lokd.co.za", "/api/pilot?scope=operations"),
    );
    assert.equal(pilotSeed.status, 200, await pilotSeed.clone().text());

    const operationsState = await onboarding.GET(
      request("operations.lokd.co.za", "/api/onboarding?scope=operations"),
    );
    assert.equal(operationsState.status, 200, await operationsState.clone().text());
    const initial = (await operationsState.json()).state;
    assert.equal(initial.productionLocked, true);
    assert.equal(initial.summary.completedCases, 3);
    assert.equal(initial.summary.preparedTemplates, 4);
    assert.equal(initial.summary.signedDemoEnvelopes, 4);
    assert.equal(initial.summary.activeDemoInvitations, 3);
    assert.equal(initial.summary.latestRehearsalStatus, "not_run");

    const rehearsed = await onboarding.POST(
      request(
        "operations.lokd.co.za",
        "/api/onboarding?scope=operations",
        "POST",
        { action: "run_controlled_pilot_rehearsal" },
      ),
    );
    assert.equal(rehearsed.status, 200, await rehearsed.clone().text());
    const state = (await rehearsed.json()).state;
    assert.equal(state.summary.latestRehearsalStatus, "passed");
    assert.equal(state.rehearsals[0].creditTermsDays, 0);
    assert.equal(state.rehearsals[0].fundingModel, "advance_only");
    assert.equal(state.rehearsals[0].settlementLocked, true);
    assert.equal(state.rehearsals[0].productionAuthorised, false);
    assert.equal(state.rehearsals[0].steps.length, 8);

    const stored = database
      .prepare(`SELECT status,credit_terms_days AS creditTermsDays,
        funding_model AS fundingModel,settlement_locked AS settlementLocked,
        production_authorised AS productionAuthorised,length(steps_hash) AS hashLength
        FROM controlled_pilot_rehearsals ORDER BY created_at DESC LIMIT 1`)
      .get();
    assert.deepEqual({ ...stored }, {
      status: "passed",
      creditTermsDays: 0,
      fundingModel: "advance_only",
      settlementLocked: 1,
      productionAuthorised: 0,
      hashLength: 64,
    });
    assert.throws(
      () =>
        database
          .prepare("UPDATE controlled_pilot_rehearsals SET production_authorised=1")
          .run(),
      /append_only/,
    );
    assert.throws(
      () =>
        database
          .prepare("UPDATE workspace_access_invitations SET status='production_active'")
          .run(),
      /append_only/,
    );

    const client = await onboarding.GET(
      request(
        "portal.lokd.co.za",
        "/api/onboarding?scope=client",
        "GET",
        undefined,
        "client@lokd.example",
      ),
    );
    assert.equal(client.status, 200, await client.clone().text());
    const clientState = (await client.json()).state;
    assert.deepEqual(clientState.cases.map((item) => item.subjectType), ["client"]);
    assert.equal(clientState.templates.length, 0);
    assert.equal(clientState.productionLocked, true);

    const officer = await onboarding.GET(
      request(
        "officers.lokd.co.za",
        "/api/onboarding?scope=officer",
        "GET",
        undefined,
        "officer@lokd.example",
      ),
    );
    assert.equal(officer.status, 200, await officer.clone().text());
    assert.deepEqual(
      (await officer.json()).state.cases.map((item) => item.subjectType),
      ["officer"],
    );

    const otherClient = await onboarding.GET(
      request(
        "portal.lokd.co.za",
        "/api/onboarding?scope=client",
        "GET",
        undefined,
        "other-client@lokd.example",
      ),
    );
    assert.equal(otherClient.status, 200);
    assert.deepEqual((await otherClient.json()).state.cases, []);

    const wrongHost = await onboarding.GET(
      request("portal.lokd.co.za", "/api/onboarding?scope=operations"),
    );
    assert.equal(wrongHost.status, 403);
    const clientWrite = await onboarding.POST(
      request(
        "portal.lokd.co.za",
        "/api/onboarding?scope=client",
        "POST",
        { action: "run_controlled_pilot_rehearsal" },
      ),
    );
    assert.equal(clientWrite.status, 403);
  } finally {
    database.close();
    delete env.DB;
    delete env.LOKD_APP_STAGE;
    delete env.LOKD_PILOT_ACCESS_JSON;
  }
});

test("Version 32 migration rejects production onboarding records", () => {
  const database = migratedDatabase();
  try {
    database.exec(`INSERT INTO operator_accounts
      (id,email,display_name,status,mfa_status,mfa_verified_at,approval_limit_cents,
       environment,integrity_state,version,created_at,updated_at)
      VALUES ('prod-owner','prod-owner@example.test','Prod owner','active','verified',datetime('now'),0,
       'production','authoritative',1,datetime('now'),datetime('now'))`);
    assert.throws(
      () =>
        database.exec(`INSERT INTO onboarding_cases
          (id,subject_type,subject_id,display_name,contact_email_normalized,status,current_stage,
           owner_id,identity_status,compliance_status,contract_status,banking_status,access_status,
           environment,integrity_state,version,created_at,updated_at,completed_at)
          VALUES ('ONB-PROD','operations','prod-owner','Production owner','prod-owner@example.test',
           'complete','ready_for_pilot','prod-owner','verified_demo','verified_demo','not_required',
           'not_required','active_demo','production','authoritative',1,datetime('now'),datetime('now'),datetime('now'))`),
      /controlled_onboarding_case_invalid/,
    );
  } finally {
    database.close();
  }
});
