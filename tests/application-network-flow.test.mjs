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

function ownerRequest(method, body) {
  return new Request("https://demo.lokd.co.za/api/applications", {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      origin: "https://demo.lokd.co.za",
      "sec-fetch-site": "same-origin",
      "x-lokd-verified-user-id":"user_fixture", "x-lokd-verified-mfa-enrolled":"true", "x-lokd-verified-second-factor-at":new Date(Date.now()-60000).toISOString(),
      "x-lokd-verified-email": "owner@lokd.example",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

test("evidenced demo onboarding creates a restricted Network profile without employment", async () => {
  const database = migratedDatabase();
  env.DB = new D1Adapter(database);
  env.LOKD_APP_STAGE = "demo";
  env.LOKD_PILOT_ACCESS_JSON = JSON.stringify({ owners: ["owner@lokd.example"] });
  const applications = await import("../app/api/applications/route.ts");

  const initial = await applications.GET(ownerRequest("GET"));
  assert.equal(initial.status, 200, await initial.text());
  for (const action of ["start_demo_identity", "complete_demo_identity", "approve_assessment", "issue_demo_network_profile"]) {
    const response = await applications.PATCH(ownerRequest("PATCH", { id: "APP-DEMO-001", action }));
    assert.equal(response.status, 200, `${action}: ${await response.text()}`);
  }

  const application = database.prepare(`SELECT officer_id AS officerId,status FROM officer_applications WHERE id='APP-DEMO-001'`).get();
  assert.equal(application.status, "network_profile_created");
  assert.ok(application.officerId);
  assert.equal(database.prepare(`SELECT approval_status AS status FROM officers WHERE id=?`).get(application.officerId).status, "network_demo_only");
  assert.equal(database.prepare(`SELECT status FROM officer_passports WHERE officer_id=?`).get(application.officerId).status, "restricted");
  assert.equal(database.prepare(`SELECT officer_id AS officerId FROM identity_verification_cases WHERE application_id='APP-DEMO-001'`).get().officerId, application.officerId);
  assert.equal(database.prepare(`SELECT COUNT(*) AS total FROM workforce_engagements WHERE officer_id=?`).get(application.officerId).total, 0);
  database.close();
});

test("public interest stays prelaunch, consent-pending and outside the synthetic Operations queue", async () => {
  const database = migratedDatabase();
  env.DB = new D1Adapter(database);
  env.LOKD_APP_STAGE = "demo";
  env.LOKD_PILOT_ACCESS_JSON = JSON.stringify({ owners: ["owner@lokd.example"] });
  const applications = await import("../app/api/applications/route.ts");
  const publicRequest = new Request("https://demo.lokd.co.za/api/applications", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://demo.lokd.co.za", "sec-fetch-site": "same-origin" },
    body: JSON.stringify({
      pathway: "qualified", fullName: "Public Applicant", mobile: "082 555 0199",
      email: "public.applicant@example.test", city: "Johannesburg", province: "Gauteng",
      psiraStatus: "active", psiraNumber: "1234567", psiraGrade: "Grade C",
      services: ["Unarmed"], purposes: ["Commercial access"], training: [],
      over18Confirmed: true, eligibilityAcknowledged: true, contactConsent: true,
    }),
  });
  const submitted = await applications.POST(publicRequest);
  assert.equal(submitted.status, 202, await submitted.text());
  const record = database.prepare(`SELECT id,environment,integrity_state AS integrityState,
    identity_verification_status AS identityStatus,identity_consent_version AS consentVersion,
    identity_consented_at AS consentedAt FROM officer_applications WHERE mobile_normalized='+27825550199'`).get();
  assert.deepEqual({ environment: record.environment, integrityState: record.integrityState, identityStatus: record.identityStatus,
    consentVersion: record.consentVersion, consentedAt: record.consentedAt },
  { environment: "prelaunch", integrityState: "user_submitted", identityStatus: "consent_pending", consentVersion: null, consentedAt: null });

  const queueResponse = await applications.GET(ownerRequest("GET"));
  const queue = await queueResponse.json();
  assert.equal(queue.applications.some((item) => item.id === record.id), false);
  database.close();
});


test("Operations identity failure and review actions never bypass assessment eligibility", async () => {
  const database = migratedDatabase();
  env.DB = new D1Adapter(database);
  env.LOKD_APP_STAGE = "demo";
  env.LOKD_PILOT_ACCESS_JSON = JSON.stringify({ owners: ["owner@lokd.example"] });
  const applications = await import("../app/api/applications/route.ts");
  await applications.GET(ownerRequest("GET"));
  const act = (action) => applications.PATCH(ownerRequest("PATCH", { id: "APP-DEMO-001", action }));
  assert.equal((await act("start_demo_identity")).status, 200);
  assert.equal((await act("demo_identity_rejected")).status, 200);
  assert.equal((await act("complete_demo_identity")).status, 409);
  assert.equal((await act("approve_assessment")).status, 404);
  assert.equal((await act("issue_demo_network_profile")).status, 409);
  assert.equal((await act("demo_identity_manual_review")).status, 200);
  assert.equal((await act("demo_identity_expired")).status, 200);
  assert.equal((await act("start_demo_identity")).status, 200);
  assert.equal((await act("complete_demo_identity")).status, 200);
  assert.equal(database.prepare("SELECT status FROM officer_applications WHERE id='APP-DEMO-001'").get().status, "credentials_review");
  env.LOKD_APP_STAGE = "production";
  assert.equal((await act("demo_identity_manual_review")).status, 423);
  database.close();
});
