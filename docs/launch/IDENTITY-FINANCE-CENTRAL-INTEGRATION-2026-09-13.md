# Central Command — identity and finance integration

Local integration checkpoint accepted. No deployment, real provider/person submission, credential change, production evidence creation, real transfer, new checkout or live check-in enablement. Genuine acceptance remains outstanding. This record supersedes earlier FI-02-unassigned status; the owner subsequently delivered completed development for local integration.

## Sources and preservation

- Identity ID-01–04: `75c9a46d69e0208746a9235c1477732f8f6a4ade`, cumulative patch from `/tmp/lokd-id01`, handoff `docs/launch/ID-04-HANDOFF.md`.
- Finance FI-02: `1208119663ef3665c743586cbf90f275c4830ee8`, feature delta from `03e5ca410c6479ba963674ff73a4f0163148e256` in `/tmp/lokd-fi02`.
- Existing frontend through `f561dfa47be41f6ab1f7366c375f03192f17cd60` and FI-05 integration retained. Operations panel merge preserves shared request errors, loaded forms/drafts and readable records while adding finance routing and controls.
- Work is integrated in the local working tree, not committed as a combined release or deployed. Owner commits identify input packages, not a deployed combined revision.

## Canonical schema and routes

Allocated0061–0064 for ID-01–04 (17 new ledger tables), then0065 for FI-02 (9 tables). Canonical schema, journal and snapshots updated; historical numbered migration files untouched. Test suites load numbered history once, not proposal SQL. Proposal files are historical design sources, never an additional deployment input.

Identity migrations preserve124 custom statements; trigger CASE expressions use the established parenthesized form. Finance retains64 custom statements. Fixed a malformed expression index emitted by Drizzle in new0065 SQL, using the proposal's correct expression. Regeneration reports no drift. Canonical FI-02 starts with `payment_live_control.enabled=0`; environment flag `LOKD_LIVE_PAYMENTS_ENABLED` must also be exactly true for dispatch. Neither lock was enabled.

Mounted `/api/production-identity` with server-derived participant/Operations/owner authority, existing workspace and MFA policy, same-origin bounded JSON and private/no-store responses. Identity start receives only the four accepted capture fields; no provider adapter or normalized outcome is accepted from clients. No trusted live adapter is installed, so start/recovery remain503. Existing sandbox identity UI stays separate. New identity review/policy/disposition UI and private token delivery remain to be completed; the route alone does not establish usable pilot workflows.

## Validation and independent review

- Combined regression: **339 passed**, zero failed/skipped (23.86 seconds).
- Production build and TypeScript passed. Lint: zero errors,19 warnings. Whitespace passed.
- Local finance Chromium harness passed recovery/approval/canceled replacement, stable retry keys, keyboard refresh, disabled live dispatch and360/390/1280px layouts.
- Independent identity reviewer:40 ID checkpoint tests plus1 HTTP boundary test passed; no remaining actionable finding in reviewed scope. Identified and verified the route's start-input fix.
- Independent schema verification: identity history1247 chunks,17 new tables and35 views; hosted SQLite limits, foreign keys and integrity passed. Full chain including0065 also passed the constrained migration contract; nine added tables and all preceding170 table snapshots verified.
- Independent FI-02 review:11 focused migration/HTTP/reconciliation tests and browser harness passed; no actionable safety defect found in dual locks, one-shot claims, authority separation, bank-backed receipts or ancestor recovery holds.

Activation coverage is deliberately precise: linked-officer denial is exercised under canonical identity guards. Downstream employee/partner completion and finance scenarios remain explicitly labelled legacy service-history fixtures, checking in before participant linking. No database guard is removed or disabled. This preserves regression coverage but does NOT establish a positive new identity-to-workforce-to-activation-to-completed-service route.

Logs: `docs/launch/identity-finance-integration-checks/`. Final combined frontend browser suite: **54 passed** (41.3 seconds). The initial run failed because the synthetic harness lacked the new finance endpoint response; the mock was corrected and the full suite rerun. The failed log is retained and not counted as a pass. Preview processes were stopped after testing.

## Acceptance gaps and next ownership

1. Identity/Operations: genuine production provider/capture/consent, exact applicant binding and current PSiRA; approved core/service/purpose rules and protected source evidence; identity review/disposition UI, human audit provenance alongside automatic system holds, private token delivery and intended independent accounts.
2. Workforce/independent QA: confirm selected service/purpose and direct-employee versus partner workforce route; run its positive complete chain, correction/suspension races and real-device acceptance. Unarmed/commercial-access fixtures are not a user-approved pilot selection.
3. Finance documents: integrate payslip/invoice/remittance/report consumers with canonical financial-state views. Provider success is not paid; bank-backed approved reconciliation is required. Genuine funds/mandate/provider acceptance and real testing remain deferred until the site is ready.
4. Release: later combined revision/backup/rollback/hosted-migration verification and explicit deployment authorization. No deployment or live acceptance is implied by this checkpoint.

Central Command retains coordination. No owner task message or new assignment was sent or claimed delivered.
