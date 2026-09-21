# Independent Central readiness QA — 14 September 2026

**Accept the reviewed local readiness scope. No actionable findings remain in the inspected changes.** This is not full-build, live readiness, provider acceptance, deployment or operational approval.

Base checkout: `/srv/ammosync/workspaces/lokd-security`, c358358d6ad1ad59ba2f8e39513928c343e5736b plus Central working-tree changes. Reviewer did not edit checkout or browser/config and made no Site/provider calls.

## Verified

- Generator replays all69 canonical SQL migrations through0068, then inventories surviving explicit tables/triggers/views/indexes. This correctly accounts for dropped/replaced objects; SQLite internal/automatic indexes are deliberately excluded. `node scripts/generate-readiness-schema.mjs --check` passed.
- Manifest contains1,180 required objects:185 tables,654 triggers,55 views,286 explicit indexes. The aggregate query compares exact names and object kinds; unrelated guards cannot compensate. It returns one row, avoiding inventory pagination.
- Independently reconstructed runtime aggregate query is41,544 UTF-8 bytes. All migrations and query executed under the repository's restricted SQLite limits:SQL length100,000, columns100, bound variables100, compound selects5 and function arguments32. No hosted D1 query was performed or claimed.
- Public response exposes counts, migration label and booleans, no object names, SQL errors, secrets or participant records. Missing DB/objects/bucket and thrown errors fail closed. Scope explicitly says current schema objects and evidence binding; provider connectivity/operational acceptance remain not assessed; production activation remains false. Presence of schema objects does not claim SQL-definition integrity, bucket write success, legal/person acceptance or enabled payment authority.
- Platform maintenance reuses exactly the same manifest check and reports current migration provenance instead of v30 inventory. Existing maintenance/integration test passes without changing synthetic/live separation.
- Automated test compares exact final SQLite inventory and last migration filename with checked-in manifest; this fails on new additive schema until regeneration. Generator --check additionally enforces deterministic file contents. Standard full regression includes health-contract.test.mjs; build alone does not run this test, so preserve Central's full release validation contract.
- Missing-object tests now include latest private-delivery table/view/guard, finance issuance guard and invoice uniqueness index, alongside historical payroll/specialist guards. Unrelated replacement-guard test passes.

## Actual independent tests

`node --experimental-loader=./tests/cloudflare-loader.mjs --test tests/health-contract.test.mjs tests/integration-workflow-db.test.mjs`

Authorized escalated execution: **17 named tests passed, zero failed/skipped/cancelled**, 2.510 seconds. Log `/tmp/lokd-central-readiness-independent-tests-escalated.log`.

Initial sandbox execution returned only two wrapper summaries; it is not counted as named-test acceptance. Retained `/tmp/lokd-central-readiness-independent-tests.log`.

Restricted SQLite/migration/query verification and generator check passed as described above. This scoped review did not rerun full build, types/lint, broad regression, browser or deployment. Central remains responsible for integrated release checks after owner merges; regenerate manifest after new canonical migrations.

## Exact reviewed file SHA256

- `app/api/health/ready/route.ts`: `e41f153ad00278e66e270cb194ca0324c9c3184098d394f8dbf08851cb52ec21`
- `app/lib/platform-jobs.ts`: `1978f70eed15468314abb2c53e678424574bb85e324bcd6ed1128a419ad5a9fa`
- `app/lib/schema-readiness.ts`: `dcfef420443fa96d4d41c39fb308082524ea255329ec3f63daf5128e5f79aa21`
- `app/lib/readiness-schema-generated.ts`: `a77f98ce482ecd2626269c3b32d57b4403d7a35967add95185808929891d6ebc`
- `scripts/generate-readiness-schema.mjs`: `c6bd2269d2ce783507891ba572cea578402eb12794cb1824b66e8ac268d40e37`
- `tests/health-contract.test.mjs`: `dc0f82292a41c91d1b9973d6b466734571f4d4ae9b766c8a38e8c452d86f218b`
- `tests/integration-workflow-db.test.mjs`: `bc0c8bce222f6fc810680de8301068a2aeea719aa4b46eb59daebd2bade299e6`
