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

function publicRequest(body) {
  return new Request("https://lokd.co.za/api/enquiries", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://lokd.co.za", "sec-fetch-site": "same-origin" },
    body: JSON.stringify(body),
  });
}

function operationsRequest(method, body) {
  return new Request("https://operations.lokd.co.za/api/enquiries", {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      origin: "https://operations.lokd.co.za",
      "sec-fetch-site": "same-origin",
      "x-lokd-verified-email": "owner@lokd.example",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const validEnquiry = {
  organisationName: "Controlled Client",
  contactName: "Client Contact",
  email: "client.contact@example.test",
  mobile: "082 555 0123",
  siteArea: "Midrand",
  siteType: "logistics_industrial",
  requiredStart: "one_to_three_months",
  message: "We need a planned access-control post for an approved Johannesburg logistics site.",
  advanceFundingAcknowledged: true,
  privacyConsent: true,
  company: "",
};

test("public client intake stays prelaunch, zero-credit and separate from bookings", async () => {
  const database = migratedDatabase();
  env.DB = new D1Adapter(database);
  env.LOKD_APP_STAGE = "demo";
  env.LOKD_PILOT_ACCESS_JSON = JSON.stringify({ owners: ["owner@lokd.example"] });
  const enquiries = await import("../app/api/enquiries/route.ts");

  const submitted = await enquiries.POST(publicRequest(validEnquiry));
  assert.equal(submitted.status, 202, await submitted.clone().text());
  const body = await submitted.json();
  assert.match(body.reference, /^ENQ-/);
  const saved = database.prepare(`SELECT environment,integrity_state AS integrityState,service_type AS serviceType,
    funding_model AS fundingModel,credit_terms_days AS creditTermsDays,status,version FROM client_enquiries WHERE id=?`).get(body.reference);
  assert.deepEqual({ ...saved }, {
    environment: "prelaunch",
    integrityState: "user_submitted",
    serviceType: "scheduled_unarmed_fixed_site",
    fundingModel: "advance_only",
    creditTermsDays: 0,
    status: "new",
    version: 1,
  });
  assert.equal(database.prepare("SELECT COUNT(*) AS total FROM bookings").get().total, 0);
  assert.equal(database.prepare("SELECT COUNT(*) AS total FROM audit_events WHERE entity_id=?").get(body.reference).total, 1);
  assert.throws(() => database.prepare("UPDATE client_enquiries SET credit_terms_days=30 WHERE id=?").run(body.reference), /controlled_transition_required/);
  assert.throws(() => database.prepare("DELETE FROM client_enquiries WHERE id=?").run(body.reference), /history_required/);

  const duplicate = await enquiries.POST(publicRequest(validEnquiry));
  assert.equal(duplicate.status, 202);
  assert.equal(database.prepare("SELECT COUNT(*) AS total FROM client_enquiries").get().total, 1);
  database.close();
  delete env.DB;
});

test("only signed-in Operations can own and close a client enquiry, including same-millisecond reviews", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date() });
  const database = migratedDatabase();
  env.DB = new D1Adapter(database);
  env.LOKD_APP_STAGE = "demo";
  env.LOKD_PILOT_ACCESS_JSON = JSON.stringify({ owners: ["owner@lokd.example"] });
  const enquiries = await import("../app/api/enquiries/route.ts");
  const submitted = await enquiries.POST(publicRequest({ ...validEnquiry, email: "second@example.test" }));
  const { reference } = await submitted.json();

  const anonymous = await enquiries.GET(new Request("https://operations.lokd.co.za/api/enquiries"));
  assert.equal(anonymous.status, 401);
  const queue = await enquiries.GET(operationsRequest("GET"));
  assert.equal(queue.status, 200, await queue.clone().text());
  assert.equal((await queue.json()).enquiries[0].id, reference);

  const triaged = await enquiries.PATCH(operationsRequest("PATCH", { id: reference, action: "triage", version: 1 }));
  assert.equal(triaged.status, 200, await triaged.text());
  const closed = await enquiries.PATCH(operationsRequest("PATCH", { id: reference, action: "close", version: 2, resolution: "Approved for a controlled site review." }));
  assert.equal(closed.status, 200, await closed.text());
  assert.deepEqual({ ...database.prepare("SELECT status,owner_id AS ownerId,resolution,version FROM client_enquiries WHERE id=?").get(reference) }, {
    status: "closed",
    ownerId: "owner@lokd.example",
    resolution: "Approved for a controlled site review.",
    version: 3,
  });
  const stale = await enquiries.PATCH(operationsRequest("PATCH", { id: reference, action: "close", version: 2, resolution: "Stale write" }));
  assert.equal(stale.status, 409);
  assert.equal(database.prepare("SELECT COUNT(*) AS total FROM audit_events WHERE entity_id=?").get(reference).total, 3);
  database.close();
  delete env.DB;
});
