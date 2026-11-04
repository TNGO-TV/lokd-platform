import {addOperator} from './fixtures/operations-db.mjs';
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
  return new Request(`https://operations.lokd.co.za${path}`, {
    ...init,
    headers: {
      "x-lokd-verified-user-id":init.headers?.["x-lokd-verified-email"]??"ops@lokd.example", "x-lokd-verified-mfa-enrolled":"true", "x-lokd-verified-second-factor-at":new Date(Date.now()-60000).toISOString(),
      "x-lokd-verified-email": "ops@lokd.example",
      ...init.headers,
    },
  });
}

test("unauthenticated users cannot upload private evidence", async () => {
  const database=migratedDatabase();
  env.DB=new D1Adapter(database);
  env.BUCKET={put(){throw Error('Unauthenticated bucket write');}};
  try {
    const response=await POST(new Request('https://operations.lokd.co.za/api/evidence',{method:'POST',headers:{origin:'https://operations.lokd.co.za','content-type':'application/json'},body:'{}'}));
    assert.equal(response.status,401);
  } finally {delete env.DB;delete env.BUCKET;database.close();}
});

test("authorised production evidence is privately stored, hashed and downloaded through the protected route", async () => {
  const database = migratedDatabase();
  const protectedKey="prelaunch/private/2026-10/production-object";
  const protectedObject={bytes:Buffer.from("protected primary bytes"),options:{}};
  const objects = new Map([[protectedKey,protectedObject]]);
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
  for(const email of ["ops@lokd.example","reviewer@lokd.example"])addOperator(database,email,["operations_controller"],1000000,email);

  try {
    const source = Buffer.from("controlled evidence", "utf8");
    const upload = await POST(request("/api/evidence", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://operations.lokd.co.za",
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
    assert.equal(objects.size, 2);
    assert.equal(objects.get(protectedKey),protectedObject);
    assert.ok([...objects.keys()].filter(key=>key!==protectedKey).every(key=>key.startsWith("operations/v1/production/")));
    assert.equal(database.prepare("SELECT COUNT(*) AS total FROM document_artifacts").get().total, 1);
    assert.equal(database.prepare("SELECT COUNT(*) AS total FROM audit_events WHERE event_type='evidence_stored'").get().total, 1);

    const selfReview = await PATCH(request("/api/evidence", {
      method: "PATCH",
      headers: { "content-type": "application/json", origin: "https://operations.lokd.co.za" },
      body: JSON.stringify({ artifactId: uploaded.artifact.id, expectedHash: uploaded.artifact.contentHash }),
    }));
    assert.equal(selfReview.status, 409);

    const review = await PATCH(request("/api/evidence", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        origin: "https://operations.lokd.co.za",
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
    // A corrupted artifact cannot expose unrelated objects outside its private namespace.
    database.prepare("UPDATE document_artifacts SET storage_reference=? WHERE id=?").run("BUCKET:"+protectedKey,uploaded.artifact.id);
    assert.equal((await GET(request(`/api/evidence?id=${uploaded.artifact.id}&download=1`))).status,404);
    assert.equal((await PATCH(request('/api/evidence',{method:'PATCH',headers:{'content-type':'application/json',origin:'https://operations.lokd.co.za','x-lokd-verified-email':'reviewer@lokd.example'},body:JSON.stringify({artifactId:uploaded.artifact.id,expectedHash:uploaded.artifact.contentHash})}))).status,404);
    assert.equal(objects.get(protectedKey),protectedObject);
  } finally {
    delete env.DB;
    delete env.BUCKET;
    delete env.LOKD_APP_STAGE;
    delete env.LOKD_PILOT_ACCESS_JSON;
    database.close();
  }
});

test("evidence classifications guard upload, metadata, bytes and verification before bucket access", async () => {
  const database = migratedDatabase(), objects = new Map();
  let reads = 0, writes = 0;
  env.DB = new D1Adapter(database);
  env.BUCKET = {
    async put(key, bytes, options) { writes++; objects.set(key, { bytes, options }); },
    async get(key) { reads++; return { body: objects.get(key).bytes }; },
    async head(key) { reads++; const value=objects.get(key); return {size:value.bytes.byteLength,customMetadata:value.options.customMetadata}; },
    async delete(key) { objects.delete(key); },
  };
  for(const email of ["ops@lokd.example","reviewer@lokd.example"])addOperator(database,email,["operations_controller"],1000000,email);
  for(const email of ["owner@lokd.example","owner2@lokd.example"])addOperator(database,email,["operations_owner"],1000000,email);
  const as = (email, path, method="GET", body) => request(path,{method,headers:{"x-lokd-verified-email":email,...(body?{"content-type":"application/json",origin:"https://operations.lokd.co.za"}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const upload = (email, accessClass) => POST(as(email,"/api/evidence","POST",{kind:"private_record",mimeType:"text/plain",retentionClass:"temporary_90d",accessClass,contentBase64:Buffer.from("classified fixture bytes").toString("base64")}));
  try {
    for (const accessClass of ["finance","compliance"]) for (const email of ["owner@lokd.example","ops@lokd.example"]) {
      const before=writes;assert.equal((await upload(email,accessClass)).status,403);assert.equal(writes,before);
    }
    assert.equal((await upload("ops@lokd.example","owner")).status,403);
    const ownerUpload=await upload("owner@lokd.example","owner");assert.equal(ownerUpload.status,201);const {artifact}=await ownerUpload.json();
    const verify=(email)=>PATCH(as(email,"/api/evidence","PATCH",{artifactId:artifact.id,expectedHash:artifact.contentHash}));
    for(const accessClass of ["owner","finance","compliance"]){
      database.prepare("UPDATE document_artifacts SET access_class=? WHERE id=?").run(accessClass,artifact.id);
      for(const email of ["ops@lokd.example",...(accessClass==='owner'?[]:["owner@lokd.example"])]) {
        const before=reads;
        assert.equal((await GET(as(email,`/api/evidence?id=${artifact.id}`))).status,403);
        assert.equal((await GET(as(email,`/api/evidence?id=${artifact.id}&download=1`))).status,403);
        assert.equal((await verify(email)).status,403);assert.equal(reads,before,"denied classes never fetch bucket bytes or metadata");
      }
    }
    database.prepare("UPDATE document_artifacts SET access_class='owner' WHERE id=?").run(artifact.id);
    assert.equal((await GET(as("owner2@lokd.example",`/api/evidence?id=${artifact.id}`))).status,200);
    assert.equal(await (await GET(as("owner2@lokd.example",`/api/evidence?id=${artifact.id}&download=1`))).text(),"classified fixture bytes");
    assert.equal((await verify("owner@lokd.example")).status,409,"classification must not bypass independent verification");
    assert.equal((await verify("owner2@lokd.example")).status,200);
    database.prepare("UPDATE document_artifacts SET environment='demo' WHERE id=?").run(artifact.id);const before=reads;
    assert.equal((await GET(as("owner2@lokd.example",`/api/evidence?id=${artifact.id}&download=1`))).status,404);
    assert.equal((await verify("owner2@lokd.example")).status,404);assert.equal(reads,before,"wrong environment never touches bucket");
  } finally {for(const key of ['DB','BUCKET','LOKD_APP_STAGE','LOKD_PILOT_ACCESS_JSON'])delete env[key];database.close();}
});
