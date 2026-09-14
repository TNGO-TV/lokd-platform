# Sandbox evidence retention execution

The guarded maintenance service `app/lib/sandbox-retention.ts` clears overdue payload text in sandbox_identity_objects. It requires the separate marked sandbox database, matching immutable installed retention policy/hash, owner Operations authority and batch limit1–100. It exposes no override clock or retention duration.

Sandbox0003 inserts an immutable exact-object tombstone and clears body in one transaction. Both the object expiry and capturedAt+retentionDays must have elapsed according to SQLite's clock. Reference, digest, expiry and policy metadata remain unchanged. The audit records former UTF-8 byte count, capture/expiry dates, policy hash/days, actor and purge time. Existing update/delete/replace protection remains; the only object update exception is nonempty body→empty with exact matching tombstone. The private reader excludes purged objects even if its application clock moves backwards. This clears active database payloads; historical backups remain governed by their separate retention procedures.

Local-only invocation (no servers, Cloudflare/R2 APIs or provider credentials):

```
node --experimental-strip-types --experimental-loader=./tests/cloudflare-loader.mjs scripts/purge-sandbox-evidence.mjs --primary /absolute/primary.sqlite --sandbox /absolute/sandbox.sqlite --actor local-maintenance-owner --limit 50
```

Both files must exist and be distinct. Primary opens read-only. The runtime rechecks that primary is not marked sandbox. For an installation with supported policy overrides, supply the original matching LOKD_SANDBOX_POLICY_JSON; incompatible policy cannot purge. Output contains counts/bytes/policy only, never body or evidence references. A full batch returns possiblyMore:true; another bounded invocation handles the next eligible batch. A completed rerun reports0.

Actual local result: tests/sandbox-retention.test.mjs3/3 pass, zero failures/skips, about2.01seconds; retention-tests.log. Tests create evidence through the existing capture/provider/case service. They distinguish access expiry at2days from the configured30-day retention deadline; purge at31days, exact metadata/audit preservation, wrong actor/limit/source/hash/bytes/deadline denial, immutable replacement/deletion, no resurrection after Date rewind, and real CLI execution on copied local files. CLI clears the actual payload and leaves primary without retention tables. Early syntax and fixture-clock assertion errors were corrected before this passing run; they are not additional accepted tests.

No production data, live provider or R2 object was accessed. Independent security review is separate.
