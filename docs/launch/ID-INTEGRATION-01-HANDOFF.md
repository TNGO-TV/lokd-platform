# ID-INTEGRATION-01 — connected identity acceptance fixture and activation clock fix

Checkpoint complete; return to Central Command. No deployment, credential change, provider request, real evidence creation or live enablement. This is the identity owner's connected implementation validation, not independent QA signoff.

## Source and ownership

Central had already integrated ID-01–04 into its uncommitted working tree, including canonical migrations 0061–0064, finance through 0065 and the production identity API. See `IDENTITY-FINANCE-CENTRAL-INTEGRATION-2026-09-13.md`. Reapplying the earlier cumulative patch would duplicate that work.

This checkpoint uses an isolated snapshot at `/tmp/lokd-id-connected`, branch `codex/id-connected-acceptance`, base `8f639a87164000d32071afc33538bc6aa1b0ed68`. `central-source-manifest.json` records SHA-256 hashes of 557 source files copied from Central, excluding credentials, dependency/build directories and generated TypeScript build metadata. This snapshot base is not Central's Git HEAD or a released source revision. The shared source remains untouched. Only this checkpoint's delta should be integrated.

## Finding and fix

The first connected attempt failed with `production_officer_evidence_invalid` despite current approved identity, PSiRA, scoped readiness and workforce evidence. The recorded passport review was `2026-09-13T21:23:49.903Z`. The old guard considered it future evidence because SQLite `CURRENT_TIMESTAMP` truncates to whole seconds; the same source passed comparison with `julianday('now')`. The initial failure log is retained.

`migrations/pending/ID-INTEGRATION-01-activation-evidence-clock.sql` recreates the existing `activation_command_final_hardening_v2` trigger, changing only its 17 comparisons from `julianday(CURRENT_TIMESTAMP)` to `julianday('now')`. Every other condition and error is retained. It adds no grace period, table, evidence row or default permission. No applied migration is modified. Central must allocate the next available migration number after its current history and preserve this custom trigger during schema integration; do not assume 0066 is still free.

The deterministic regression holds the disposable SQLite seconds-only clock at the approval's second while its fractional clock runs normally. It demonstrates rejection under the original trigger and successful activation after applying the proposal to that same database. It also verifies that the complete trigger SQL differs only in the 17 clock comparisons and that future time is still outside the accepted predicate. No evidence timestamps are backdated to pass.

## Connected fixture contract

`tests/production-identity-connected.test.mjs` loads Central's entire numbered migration history once, then the clock proposal. Its reusable helpers are `tests/fixtures/production-identity-journey.mjs` and `tests/fixtures/identity-activation-environment.mjs`, extracted from the established ID-03 and activation fixtures. They never disable guards.

The new officer uses the application route, exact account linking, independent intake review, injected fixture-only identity provider, identity decision, production entity preparation, owner-bound PSiRA review, independent ID-02 approval, approved core/service/purpose policies, independent assessments, officer opt-in and independent passport issuance. A new direct-flex engagement is prepared and independently approved through the existing production evidence workflow. The officer is linked before activation and check-in; this does not reuse the legacy check-in-before-linking workaround.

The surrounding site, funding, employer controls, terms, banking, schedule, travel, induction and client authority remain explicit isolated fixtures. Agreement receipts use existing preparation/storage helpers with synthetic wording. Unarmed/commercial-access/direct-flex is a test scenario, not a confirmed pilot selection. No source is imported from a sandbox identity result or promoted into a real production database.

The positive path reaches activation, scheduled revalidation, simulated check-in, officer completion, client signoff and independent service-pay review. The completed service and consumed assignment/workforce snapshots remain byte-for-byte unchanged after workforce suspension. The engagement becomes suspended; the reviewed timesheet remains historical evidence. Payroll run count remains zero: this proves preservation of service and pay-review inputs, not a consumed payroll run or money movement.

Three commit races independently withdraw identity, correct intake or suspend workforce after activation reads and before its atomic write. All final assignment, shift, snapshot and hour-reservation writes roll back. The same three source changes after activation block subsequent check-in.

## Validation

- Connected suite: **9 passed**, zero failed/skipped.
- Existing activation/service/payroll regression with the clock proposal: **68 passed**, zero failed/skipped. Its legacy consumed-service finance cases remain legacy coverage, not a new connected identity-to-paid-payroll proof.
- TypeScript `npx tsc --noEmit --pretty false`: passed.
- ESLint on all three new test/helper files: passed without warnings.
- Whitespace: passed.

Commands:

```sh
node --experimental-loader=./tests/cloudflare-loader.mjs tests/production-identity-connected.test.mjs
LOKD_IDENTITY_INTEGRATION_FIXTURES=true node --experimental-loader=./tests/cloudflare-loader.mjs tests/assignment-activation-db.test.mjs
```

The latter fixture flag is the only change to the existing activation suite. It loads the pending migration only when explicitly selected. Once Central numbers/applies the proposal in its canonical test history, remove this extra load and the connected suite's proposal load to avoid duplicate application. Preserve the old-trigger regression by using its explicit historical trigger setup when adapting the test.

Logs: `docs/launch/identity-connected-checks/connected.log`, `activation.log`, and `initial-failure.log`. No broad build/browser rerun was needed for a trigger-only implementation change; hosted migration execution, integrated browser acceptance and independent review remain Central/QA work.

## Remaining inputs and next bounded assignment

1. Central integrates the additive clock migration and adapts fixture loading to canonical history, then independent QA reviews the fix and connected evidence. This owner's tests are not independent approval.
2. The workforce/finance owners confirm the pilot model and extend the new linked path through real policy/profile-based payroll consumption, preserving historical records across subsequent suspension. The existing legacy payroll regression is not a substitute for that new connected acceptance.
3. The identity/front-end owners still need usable review/disposition interfaces, human suspension audit provenance alongside system holds, and private passport-token delivery. Central's route exists; a route alone is not a completed human workflow.
4. Genuine provider capture/consent/identity acceptance, real PSiRA evidence, approved assessment rules, independent accounts, employer/payroll/benefit sources and the selected service/purpose remain unavailable. No fixture satisfies these prerequisites. Live check-in and payment locks remain unchanged.

Reusable lesson: connecting freshly produced evidence to an older commit guard exposed a timestamp precision mismatch that static readiness and legacy seeded-service tests did not exercise. Keep the connected path and deterministic clock regression in release validation. Stop at this checkpoint; do not deploy or begin another owner's lane.
