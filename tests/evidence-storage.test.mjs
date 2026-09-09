import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { env } from "cloudflare:workers";
import { GET, PATCH, POST } from "../app/api/evidence/route.ts";

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

function request(path, init = {}) {
  return new Request(`https://demo.lokd.co.za${path}`, {
    ...init,
    headers: {
      "x-lokd-verified-user-id":"user_fixture", "x-lokd-verified-mfa-enrolled":"true", "x-lokd-verified-second-factor-at":new Date(Date.now()-60000).toISOString(),
      "x-lokd-verified-email": "ops@lokd.example",
      ...init.headers,
    },
  });
}

test("public demo visitors cannot upload evidence objects", async () => {
  env.LOKD_APP_STAGE = "demo";
  env.LOKD_PILOT_ACCESS_JSON = "";
  const response = await POST(request("/api/evidence", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  }));
  assert.equal(response.status, 423);
  assert.match((await response.json()).error, /disabled in the public demo/i);
});

test("authorised prelaunch evidence is privately stored, hashed and downloaded through the protected route", async () => {
  const database = migratedDatabase();
  const objects = new Map();
  env.DB = new D1Adapter(database);
  env.BUCKET = {
    async put(key, value, options) { objects.set(key, { bytes: new Uint8Array(value), options }); },
    async get(key) {
      const object = objects.get(key);
      return object ? { body: object.bytes } : null;
    },
    async head(key) {
      const object = objects.get(key);
      return object ? { size: object.bytes.byteLength, customMetadata: object.options.customMetadata } : null;
    },
    async delete(key) { objects.delete(key); },
  };
  env.LOKD_APP_STAGE = "pilot";
  env.LOKD_PILOT_ACCESS_JSON = JSON.stringify({ operations: ["ops@lokd.example", "reviewer@lokd.example"] });

  try {
    const source = Buffer.from("controlled evidence", "utf8");
    const upload = await POST(request("/api/evidence", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://demo.lokd.co.za",
        "sec-fetch-site": "same-origin",
      },
      body: JSON.stringify({
        kind: "incident_photo",
        mimeType: "text/plain",
        retentionClass: "incident_10y",
        accessClass: "operations",
        contentBase64: source.toString("base64"),
      }),
    }));
    const uploaded = await upload.json();
    assert.equal(upload.status, 201);
    assert.equal(uploaded.artifact.sizeBytes, source.byteLength);
    assert.match(uploaded.artifact.contentHash, /^[0-9a-f]{64}$/);
    assert.equal(objects.size, 1);
    assert.equal(database.prepare("SELECT COUNT(*) AS total FROM document_artifacts").get().total, 1);
    assert.equal(database.prepare("SELECT COUNT(*) AS total FROM audit_events WHERE event_type='evidence_stored'").get().total, 1);

    const selfReview = await PATCH(request("/api/evidence", {
      method: "PATCH",
      headers: { "content-type": "application/json", origin: "https://demo.lokd.co.za" },
      body: JSON.stringify({ artifactId: uploaded.artifact.id, expectedHash: uploaded.artifact.contentHash }),
    }));
    assert.equal(selfReview.status, 409);

    const review = await PATCH(request("/api/evidence", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        origin: "https://demo.lokd.co.za",
        "x-lokd-verified-email": "reviewer@lokd.example",
      },
      body: JSON.stringify({ artifactId: uploaded.artifact.id, expectedHash: uploaded.artifact.contentHash }),
    }));
    assert.equal(review.status, 200);
    assert.equal((await review.json()).artifact.status, "verified");
    assert.equal(database.prepare("SELECT COUNT(*) AS total FROM audit_events WHERE event_type='evidence_verified'").get().total, 1);

    const metadata = await GET(request(`/api/evidence?id=${uploaded.artifact.id}`));
    assert.equal(metadata.status, 200);
    const metadataBody = await metadata.json();
    assert.equal(metadataBody.artifact.storageReference, undefined);
    assert.equal(metadataBody.artifact.status, "verified");

    const download = await GET(request(`/api/evidence?id=${uploaded.artifact.id}&download=1`));
    assert.equal(download.status, 200);
    assert.equal(download.headers.get("cache-control"), "no-store, private");
    assert.equal(await download.text(), "controlled evidence");
  } finally {
    delete env.DB;
    delete env.BUCKET;
    delete env.LOKD_APP_STAGE;
    delete env.LOKD_PILOT_ACCESS_JSON;
    database.close();
  }
});
