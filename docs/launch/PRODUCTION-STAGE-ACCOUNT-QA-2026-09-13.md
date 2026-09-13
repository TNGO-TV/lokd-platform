# Production-stage account rehearsal — 13 September 2026

This checkpoint extends the existing `npm run test:accounts` function. It uses real Clerk **development** identities and sessions against localhost with `LOKD_APP_STAGE=production`, isolated synthetic SQLite fixtures and no configured payment provider. It does not create production accounts or certify independent-human operating acceptance.

## Repeatable commands

Use an isolated checkout with installed dependencies, `.env.clerk-test` containing development keys, and the local D1 database initialized by the development server. Stop that server before running the harness. The harness requires exactly one application SQLite database, refuses an occupied local acceptance port and refuses production Clerk keys. Do not use the hosted database or `.env.local`.

```bash
LOKD_ACCOUNT_TEST_STAGE=production LOKD_ACCOUNT_TEST_INTAKE=true npm run test:accounts -- signup.spec.mjs
LOKD_ACCOUNT_TEST_STAGE=production LOKD_ACCOUNT_TEST_RECOVERY=true LOKD_ACCOUNT_TEST_PAYMENTS=true npm run test:accounts -- payment-recovery.spec.mjs
LOKD_ACCOUNT_TEST_STAGE=production LOKD_ACCOUNT_TEST_RECOVERY=true LOKD_ACCOUNT_TEST_PARTNER_PAYMENTS=true npm run test:accounts -- payment-recovery.spec.mjs
```

Run serially: each command owns localhost port 4177 and temporarily swaps the local database. The harness restores that database and deletes the temporary Clerk identities and `.dev.vars` after each run. Never combine the empty intake fixture with financial fixtures. Recovery requires production stage and exactly one employee/partner fixture.

## Scope

- Intake: new local Officer/Client submissions, authenticated ownership linkage, Operations request for corrections, applicant resubmission, review outcome and officer PSiRA submission that remains unverified. The applicant viewport is 390×844; Operations uses desktop.
- Employee and partner FI-05: sign in separate proposer and finance sessions; deny Client/Officer callers; reject stale versions, invented evidence and unreviewed evidence; reject proposer self-approval and mismatched approval evidence; accept independent approval with `paymentReleased:false`; reject duplicate approval; retain the original claim until replacement preparation; return the same child on request replay and reject a second child.
- Final local database checks require the replacement to remain `prepared` in test mode with the original source hash, exactly one replacement, no new dispatch command and zero disbursement items. The one original dispatch command is synthetic fixture history, generated with an injected transport. No provider transfer, checkout or network financial request is made.
- Recovery is exercised through authenticated API requests because this checkpoint does not add FI-05 recovery UI controls. The local production-stage tests retain the existing owner MFA exception; separate development MFA testing was completed at the previous checkpoint.

## Test-harness corrections

The first intake attempt used an empty local database and returned 500. `LOKD_ACCOUNT_TEST_INTAKE=true` now creates a fresh database from all repository migrations, then uses the existing save/restore mechanism. The next intake run exposed the old Client enquiries button locator; the UI now uses a durable link and `aria-current`, so the account test was aligned with that contract.

The first employee recovery account run reached successful replacement preparation, then failed because the new test read `reference` at the response root. The production Operations API returns it under `result`; the test now checks that shape and requires a string reference before SQLite verification. Those failures needed test-harness corrections. A further Client rerun exposed an application defect: selecting an already-active intake link cleared records without triggering a fetch. The component now clears/reset records only when changing intake kind; the authenticated Client journey and a mobile/desktop navigation regression cover the fix.

The original recovery fixture suites also run without export mode to ensure the new export branch does not replace normal regression coverage. Browser export builds matching signed failed-event and fresh verification evidence using the existing injected transports, then exports the local SQLite fixture before any recovery proposal is inserted.

## Results

- Officer and Client production-stage intake account journeys: **2 passed**.
- Employee and partner authenticated recovery API journeys: **1 passed each**.
- Mobile/desktop active-intake-link regressions: **2 passed**.
- Original employee/partner recovery unit journeys without browser export: **4 tests passed**.
- Every account run restored the original local database and deleted its development identities/configuration, including failed attempts.

## Handoff boundaries

The release contains the small active-intake-link fix plus the test runner, tests, fixtures and this receipt. Release source and deployment receipts are recorded in the separate checkpoint handoff. No schema change, hosted setting or backup-reader window is needed. Migration 0060's prior complete production readback still applies.

Remaining operating acceptance: named production-user role mappings and participant records, genuine independent finance review of existing safe test evidence, and off-host backup storage at an owner-designated destination. Live dispatch, FI-02 and pilot launch remain locked.

Reusable lesson: initialize a fresh migrated fixture before interpreting localhost HTTP failures as product defects, and update real-account test locators alongside navigation semantics. Keep development-session rehearsal, production schema verification and real-user operating acceptance as separate evidence.
