import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import test from 'node:test';
import {requiredSchemaCounts} from '../app/lib/schema-readiness.ts';
import {runPlatformMaintenance} from '../app/lib/platform-jobs.ts';
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

function run(database, sql, ...values) { return database.prepare(sql).run(...values); }
function one(database, sql, ...values) { return database.prepare(sql).get(...values); }

test("platform maintenance records controls and dispatches internal outbox events idempotently", async () => {
  const database = migratedDatabase();
  const db = new D1Adapter(database);
  const requestId='production-request';
  database.prepare(`INSERT INTO service_requests
    (id,requested_by_role,requested_by_id,category,summary,detail,environment,integrity_state,created_at,updated_at)
    VALUES (?,'operations','fixture-owner','change_request','Notify Operations','Production outbox fixture','production','production_verified','2020-01-01','2020-01-01')`).run(requestId);
  database.prepare(`INSERT INTO domain_outbox_events
    (id,aggregate_type,aggregate_id,event_type,payload_hash,payload_version,status,environment,integrity_state,available_at,created_at)
    VALUES ('production-event','service_request',?,'service.requested','fixture-hash','1','pending','production','production_verified','2020-01-01','2020-01-01')`).run(requestId);

  const first = await runPlatformMaintenance(db, {
    actorId: "ops@example.test",
    trigger: "operator",
    evidenceStoreBound: true,
  });
  const second = await runPlatformMaintenance(db, {
    actorId: "ops@example.test",
    trigger: "operator",
    evidenceStoreBound: true,
  });

  assert.equal(first.status, "completed");
  assert.equal(first.requiredTables, requiredSchemaCounts.requiredTables);
  assert.equal(first.requiredTriggers, requiredSchemaCounts.requiredTriggers);
  assert.equal(first.processedEvents, 1);
  assert.equal(second.processedEvents, 0);
  assert.equal(one(database, `SELECT COUNT(*) AS total FROM platform_readiness_controls WHERE status='ready'`).total, 5);
  assert.equal(one(database, `SELECT COUNT(*) AS total FROM operator_notifications WHERE source_event_id=(
    SELECT id FROM domain_outbox_events WHERE aggregate_id=? LIMIT 1)`, requestId).total, 1);
  assert.equal(one(database, `SELECT status FROM domain_outbox_events WHERE aggregate_id=? LIMIT 1`, requestId).status, "dispatched");
  assert.equal(one(database, `SELECT COUNT(*) AS total FROM scheduled_job_runs WHERE status='completed'`).total, 2);
  database.close();
});

