import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {unstable_splitSqlQuery} from 'wrangler';

test('Post-v69 migrations survive the hosted SQL splitter as complete individual statements', () => {
  const directory = new URL('../drizzle/', import.meta.url);
  const files = fs.readdirSync(directory).filter(name => name.endsWith('.sql')).sort();
  const expected = new DatabaseSync(':memory:');
  const actual = new DatabaseSync(':memory:');
  try {
    for (const name of files) {
      const sql = fs.readFileSync(new URL(name, directory), 'utf8');
      expected.exec(sql);
      if (name < '0069') {
        // Already deployed history is not changed or reparsed by this release.
        actual.exec(sql);
        continue;
      }
      const statements = unstable_splitSqlQuery(sql);
      // The deployed historical migrations wrap SELECT CASE expressions. Keep
      // that shape: an END; boundary must close the trigger, not an inner CASE.
      // This is a conservative compatibility rule, not the opaque host parser.
      for (const part of sql.split('--> statement-breakpoint')) {
        const unquoted = part.replace(/'(?:''|[^'])*'/g, 'literal').replace(/--[^\n]*/g, '');
        if (/CREATE\s+TRIGGER\b/i.test(unquoted)) {
          assert.equal((unquoted.match(/\bEND\s*;/g) ?? []).length, 1,
            `${name}: preserve the historical single bare END; trigger boundary`);
        }
      }
      assert.equal(statements.length, sql.split('--> statement-breakpoint').filter(part => part.trim()).length,
        `${name}: splitter must neither truncate triggers nor combine separate statements`);
      for (const [index, statement] of statements.entries()) {
        assert.doesNotThrow(() => actual.prepare(statement).run(), `${name}: hosted statement ${index + 1}`);
      }
    }
    const schema = db => db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all()
      .map(row => ({...row, sql: row.sql?.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').trim().replace(/;$/, '')}));
    assert.deepEqual(schema(actual), schema(expected), 'hosted statement execution must create the complete canonical schema');
    assert.equal(actual.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    assert.deepEqual(actual.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    actual.close();
    expected.close();
  }
});
