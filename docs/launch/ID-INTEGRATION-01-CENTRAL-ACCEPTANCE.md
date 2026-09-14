# ID-INTEGRATION-01 — Central integration and independent local QA

Accepted local checkpoint from `bd230108a393e67a1a7338b4a152c3458db46a46`. Applied only the delivered delta onto the combined frontend/identity/finance working tree; no earlier owner patch replayed. Not a combined release commit or deployment.

## Migration

Canonical `drizzle/0066_id_integration_activation_clock.sql` replaces the existing activation final-hardening trigger. Exactly17 `julianday(CURRENT_TIMESTAMP)` comparisons become `julianday('now')`, preserving fractional timestamp precision. No grace period or other guard change. Historical migrations remain unchanged. Drizzle custom migration journal/snapshot generated; all schema metadata remains unchanged and regeneration reports no drift.

SHA-256: `a6a1f9d417121c7bbfa508e1b44a01e045819dbad9e4810e656327521b4a9f84`.

Both test suites now use canonical migration history once. The deterministic regression explicitly reinstalls the historical0008 trigger in a disposable database, reproduces the old rejection, then applies0066 and proves successful activation. Its future-time predicate remains rejecting. The pending proposal is historical intent, not a second production migration.

## Independent QA

Read-only reviewer `/root/clock_independent_qa`: no actionable findings. Independently passed9 connected tests; applied all67 canonical migrations0000–0066; verified exact17 clock substitutions, journal continuity and unchanged schema snapshot. Applicant linkage precedes activation, all three source-change races roll back final records, later changes block check-in, and service/pay-review records remain unchanged after workforce suspension.

The fixture connects identity, owner-bound PSiRA, independent readiness, reviewed workforce, activation, check-in, completed service, client signoff and independent service-pay review. Surrounding funding/site/client/terms evidence remains synthetic fixture data. Direct-flex/Unarmed/commercial-access is a test scenario, not a confirmed pilot selection.

## Remaining gates

Connected payroll consumption is still outstanding: the new route leaves payroll_runs empty. Prior legacy payroll/payment regression does not satisfy this connected acceptance. Workforce/finance owners must extend the linked fixture through policy/profile-based payroll consumption and verify history preservation after suspension.

Genuine provider/person/consent/PSiRA acceptance, approved policies and sources, independent accounts, selected pilot route, usable review/disposition interfaces and private token delivery remain outstanding. No fixture is production evidence. No deployment, credentials change, live check-in, real transfer or new checkout occurred; all live locks remain unchanged.

## Central validation

Connected suite9 passed. TypeScript, changed-test lint and whitespace passed. No application source or UI changed in this checkpoint; build/browser results remain those of the preceding combined integration. Full combined regression: **346 passed, 1 failed, 0 skipped**. The failure is the existing period-payroll fixture at `tests/assignment-activation-db.test.mjs:1867`: it expected a missing-profile denial but received the future-period denial. At this run's UTC21:52 boundary, the fixture scheduled service ten minutes ahead on the following South African calendar date, completed it immediately in simulation, and attempted payroll for that future period. Independent QA confirmed this is separate from0066. The fixture needs a coherent deterministic scheduling/service/payroll clock; the production UTC-versus-SAST payroll date convention also requires finance-owner review. No payroll guard or evidence timestamp was altered to force a pass. This broader run is not a release-validation pass. Logs retained in `docs/launch/identity-connected-central-checks/`.
