import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { env } from "cloudflare:workers";
import { readinessSchema } from "../app/lib/readiness-schema-generated.ts";
import { GET as live } from "../app/api/health/live/route.ts";
import { GET as ready } from "../app/api/health/ready/route.ts";

function bindMigratedDatabase() {
  const db = new DatabaseSync(":memory:");
  for (const file of fs.readdirSync(new URL("../drizzle", import.meta.url)).filter(name => name.endsWith(".sql")).sort()) {
    db.exec(fs.readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8"));
  }
  env.DB = { prepare: sql => ({ first: async () => db.prepare(sql).get() }) };
  env.BUCKET = {};
  return db;
}
function cleanup(db) { db.close(); delete env.DB; delete env.BUCKET; }

test("liveness is dependency-free and returns a non-cacheable response", async () => {
  const response = await live();
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(body.status, "live");
  assert.equal(body.service, "lokd-security");
});

test("readiness fails closed without a bound database", async () => {
  delete env.DB;
  const response = await ready();
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.equal(body.status, "unavailable");
  assert.equal(body.productionActivationAuthorized, false);
});

test("the migrated schema passes current object checks without asserting provider or operational readiness", async () => {
  const db = bindMigratedDatabase();
  try {
    const response = await ready();
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(body.status, "ready");
    assert.equal(body.productionActivationAuthorized, false);
    assert.equal(body.payrollMode, "shadow_settlement_locked");
    assert.equal(body.readinessScope, "current_schema_objects_and_evidence_binding");
    assert.equal(body.infrastructureReady, true);
    assert.equal(body.providerConnectivity, "not_assessed");
    assert.equal(body.operationalAcceptance, "not_assessed");
    assert.equal("softwareIntegrationReady" in body, false);
    assert.equal("remainingExternalProviders" in body, false);
    assert.equal("onboardingMode" in body, false);
  } finally { cleanup(db); }
});

test("readiness rejects a missing payroll lock, specialist gate or validation view", async () => {
  const db = bindMigratedDatabase();
  try {
    for (const [type, name] of [
      ["TRIGGER", "payroll_settlement_lock_v29"],
      ["TRIGGER", "specialist_pricing_update_guard_v33"],
      ["TRIGGER", "specialist_revalidation_pack_v34"],
      ["VIEW", "specialist_pack_validation_v34"],
      ["TRIGGER", "id_usable_delivery_approval_guard"],
      ["TRIGGER", "finance_document_issue_guard"],
      ["INDEX", "finance_document_invoice_booking_once"],
      ["TABLE", "production_passport_deliveries"],
      ["VIEW", "current_production_passport_deliveries"],
    ]) {
      db.exec("SAVEPOINT missing_guard");
      db.exec(`DROP ${type} ${name}`);
      const response = await ready();
      assert.equal(response.status, 503, name);
      assert.equal((await response.json()).productionActivationAuthorized, false);
      db.exec("ROLLBACK TO missing_guard; RELEASE missing_guard");
    }
  } finally { cleanup(db); }
});

test("readiness fails closed when private evidence storage is not bound", async () => {
  const db = bindMigratedDatabase();
  delete env.BUCKET;
  try {
    const response = await ready();
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.infrastructureReady, false);
    assert.equal(body.checks.evidenceStoreBound, false);
  } finally { cleanup(db); }
});

// This fails after any additive migration until Central regenerates the manifest.
test("readiness inventory exactly matches the final canonical migrations", () => {
  const db = bindMigratedDatabase();
  try {
    const actual = db.prepare("SELECT type,name FROM sqlite_master WHERE type IN ('table','trigger','view','index') AND name NOT LIKE 'sqlite_%' AND sql IS NOT NULL ORDER BY type,name").all().map(row => ({ ...row }));
    assert.deepEqual(readinessSchema.objects, actual);
    const files = fs.readdirSync(new URL("../drizzle", import.meta.url)).filter(name => name.endsWith(".sql")).sort();
    assert.equal(readinessSchema.migration, files.at(-1));
  } finally { cleanup(db); }
});

test("an unrelated guard cannot compensate for a missing required guard", async () => {
  const db = bindMigratedDatabase();
  try {
    db.exec("DROP TRIGGER id_usable_delivery_approval_guard");
    db.exec("CREATE TRIGGER unrelated_guard BEFORE INSERT ON production_passport_deliveries BEGIN SELECT 1; END");
    assert.equal((await ready()).status, 503);
  } finally { cleanup(db); }
});
