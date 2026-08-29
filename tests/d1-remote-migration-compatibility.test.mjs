import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const migrationsDirectory = new URL("../drizzle/", import.meta.url);
const migrationFiles = fs.readdirSync(migrationsDirectory)
  .filter((name) => /^\d{4}_.*\.sql$/.test(name))
  .sort();
const targetSequences = Array.from({ length: 14 }, (_, index) => String(index + 7).padStart(4, "0"));
const targetFiles = migrationFiles.filter((name) => targetSequences.includes(name.slice(0, 4)));
const statementBreakpoint = "--> statement-breakpoint";

function readMigration(file) {
  return fs.readFileSync(new URL(file, migrationsDirectory));
}

function migrationChunks(file) {
  return readMigration(file).toString("utf8")
    .split(statementBreakpoint)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

test("activation and integration migrations preserve the D1 remote SQL formatting contract", () => {
  assert.deepEqual(targetFiles.map((name) => name.slice(0, 4)), targetSequences,
    "migrations 0007 through 0020 must each be present exactly once");

  for (const file of targetFiles) {
    const source = readMigration(file);
    const sql = source.toString("utf8");

    assert.equal(source.includes(0x0d), false, `${file} must use LF line endings only`);
    assert.doesNotMatch(sql, /\bSELECT\s+CASE\b/i,
      `${file} must parenthesize CASE when it is the direct SELECT expression`);

    for (const [index, chunk] of migrationChunks(file).entries()) {
      if (!/\bCREATE\s+TRIGGER\b/i.test(chunk)) continue;

      const beginTokens = chunk.match(/\bbegin\b/gi) ?? [];
      assert.ok(beginTokens.length > 0, `${file} chunk ${index + 1} must contain its complete trigger body`);
      assert.ok(beginTokens.every((token) => token === "BEGIN"),
        `${file} chunk ${index + 1} must spell trigger BEGIN in uppercase for D1 remote migrations`);
    }
  }
});

test("every guarded statement-breakpoint chunk applies after the existing schema", () => {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys=ON");

  try {
    for (const file of migrationFiles.filter((name) => Number(name.slice(0, 4)) < 7)) {
      for (const chunk of migrationChunks(file)) database.exec(chunk);
    }

    for (const file of targetFiles) {
      const chunks = migrationChunks(file);
      assert.ok(chunks.length > 0, `${file} must contain at least one applicable SQL chunk`);

      for (const [index, chunk] of chunks.entries()) {
        assert.doesNotThrow(() => database.exec(chunk),
          `${file} statement-breakpoint chunk ${index + 1} must be complete and applicable in sequence`);
      }
    }
  } finally {
    database.close();
  }
});
