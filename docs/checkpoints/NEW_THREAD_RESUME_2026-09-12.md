# LOKD — new task handover, 12 September 2026

Owner requested this checkpoint before opening a new task. Implementation is stopped at the deployed payroll milestone. Hosting continues normally. This is a handover of the existing LOKD project, not a request to create another implementation agent or repeat completed work.

## Start here

Workspace: `/srv/ammosync/workspaces/lokd-security`.
Read `/srv/ammosync/AGENTS.md`, this file, `docs/checkpoints/PERIOD_PAYROLL_2026-09-12.md`, and `docs/checkpoints/PRODUCTION_COMPLETION_PLAN_2026-09-12.md`. For preceding work consult `SIGNED_TERMS_PAYROLL_POLICY_2026-09-12.md`, `SERVICE_EVIDENCE_SCHEDULING_2026-09-12.md`, and the VerifyNow/enrolment receipts below. Reconcile any newer owner instructions or source changes first.

At handover preparation the worktree was clean, local HEAD `1adf0a2` was a documentation-only receipt after deployed source `130ecc0f67a834c98a0aba47f4f0d7155512be57`. This handover is another documentation-only commit; no rebuild or deployment is needed for it. The source remote was last pushed at the deployed source. Do not mistake local receipt commits for unshipped application changes.

## Deployed state

- Sites project: `appgprj_6a88a08505548191b266e9b711562ae3` (reuse `.openai/hosting.json`).
- v55: `appgprj_6a88a08505548191b266e9b711562ae3~appgver_0a593be979b88191977012117d515f26`.
- Deployment: `appgdep_6aa5b4174b208191bb170433c3c6316f`, succeeded `2026-09-12T20:21:19.455700Z`, environment revision 9.
- Native URL: https://lokd-security.zenas-capetown.chatgpt.site
- Existing LOKD.co.za and portal/officer/Operations domain configuration retained; no fresh domain/DNS acceptance claim in this handover.
- The latest user-facing update accurately said payroll was deployed, but the full build remains unfinished. No live money was released.

## Completed — do not rebuild

Production intake/entity binding, independent client approval/suspension, priced orders and pending funding, site/post/roster setup, independently reviewed workforce/source evidence, officer availability/outside-work declarations, assignment readiness, real check-in/checkout commands, immutable service evidence, client signoff/dispute and Operations resolution, service-pay review/reopen, account-bound employment agreement signing/projection/withdrawal, reviewed payroll policies, calculation profiles, complete-period immutable payroll calculations, independent approvals, restricted evidence review, controlled CSV export and pre-export void/correction recovery.

Last full regression suite: 263 passed, none failed/skipped. Final restricted snapshot-read change additionally passed its affected database test, TypeScript, ESLint and final production build. Authenticated local browser journey passed using separate Clerk DEVELOPMENT preparer/reviewer/finance/officer identities, including source review, self-approval rejection, CSV download and officer access boundaries. These temporary identities/configuration were removed; the original local database was restored. Browser acceptance was local with fixtures, not real production account/provider acceptance.

Details, failed attempts and validation evidence locations are in PERIOD_PAYROLL_2026-09-12.md. Tests are committed; `/tmp` logs/fixtures are expendable and must not be the only resume dependency.

## Next implementation

1. Provider-backed booking collection and reconciliation with exact order/applicant/source/version, amount, currency, provider mode and transaction binding. Preserve signed-webhook/API agreement and immutable evidence. Persist a request/reference before dispatch; uncertain responses must reconcile rather than dispatch duplicate charges. Test outcomes must never fund production bookings.
2. Independently verified payment destinations and employee/partner payment adapters, with approval, duplicate/failure/reversal recovery and exact settlement evidence. Existing payroll calculation profiles intentionally have no payment destination. A controlled payroll CSV is not a payment instruction, payslip or receipt.
3. Partner-company payables, payslip issuance, post-export adjustment recovery and supported split handling when an officer changes engagement within a period. Existing code explicitly blocks unsupported transitions; do not remove old financial locks to imply completion.
4. Connected acceptance and completion matrix distinguishing built, tested, deployed, browser-accepted and live provider/operational acceptance. Keep implementing available functions with authorised isolated test documents rather than waiting for final legal text.

Useful code: `app/lib/production-payroll.ts`, `app/components/production-payroll-controls.tsx`, `app/lib/production-operations.ts`, `app/api/production-operations/route.ts`, `app/lib/production-evidence.ts`, `app/lib/paystack-test.ts`, `app/lib/test-enrolment.ts`, `app/lib/production-operator-control.ts`, `db/schema.ts`, and latest migration `drizzle/0051_ambitious_lady_ursula.sql`. Existing funding reconciliation/settlement guards must be reused, not bypassed. The test webhook currently does not imply production financial acceptance.

## Preserve owner decisions and dependencies

- Clerk authentication and Client/Officer/Operations role isolation stay intact. MFA is OFF by explicit owner exception; do not reopen an assumed Clerk billing problem or mark accounts falsely MFA verified.
- Google sign-in was important to the owner. Its acceptance remains unresolved in these receipts; inspect actual current evidence before saying it is disabled or complete. Never silently drop it.
- `LOKD_LIVE_SHIFT_SCAN=false` remains. Do not claim live GPS/service acceptance from local fixture tests.
- Identity, PSiRA, payment and work eligibility remain separate. Registered officers require PSiRA verification; nonregistered/training applicants must not be sent through a guaranteed-failure registered-officer check. Lookup success is not proof of the applicant's identity. Keep unavailable/ambiguous evidence unverified.
- VerifyNow fixtures and sandbox outcomes are not production identity proof. Read `VERIFYNOW_INTEGRATION_2026-09-11.md`, `VERIFYNOW_ENROLMENT_APPROVAL_2026-09-11.md` and `DUMMY_R350_ENROLMENT_2026-09-11.md` before touching enrolment. R350 approval already exists. Reuse the saved dummy checkout/fixtures; its manual completion has already been requested once. Do not create another checkout or repeat that question.
- Real approved legal documents, entity/employer decisions, statutory policy source approvals, first Operations owner identity and live provider acceptance are not supplied/accepted in this checkpoint. Build guarded interfaces and isolated fixtures; do not invent real training packages or promote test documents/policies to approved production evidence.
- Do not change credentials, install infrastructure, expose secrets, send messages to others, or edit AmmoSync/TNGO. Use existing LOKD release authority. Do not create duplicate tasks or subagents without explicit authority.

## Working/release method

Run meaningful tests for changed code once, then only repeat affected checks after a repair. `npm test` includes the production build and Node database tests. Node SQLite tests require a working execution environment; inspect actual named tests, not only process exit. Use `node node_modules/eslint/bin/eslint.js` for the installed linter. Never build while the account runner has temporary `.dev.vars` installed. The account runner uses disposable Clerk DEV identities without mailboxes/invitations.

Read the Sites hosting skill before release. Preserve the existing public audience/project, use native connector tools, push exact tested source with ephemeral per-command credentials, validate the built archive and generated migrations, save/deploy once, and reconcile the returned deployment ID until terminal. SQL triggers use parenthesised `SELECT (CASE ... END);` because the hosted migration parser previously mishandled bare CASE form. Never print provider or repository tokens. The source write credential from the previous task is ephemeral; obtain a new one only when needed.

## Suggested opening instruction

Read `/srv/ammosync/workspaces/lokd-security/docs/checkpoints/NEW_THREAD_RESUME_2026-09-12.md` and continue LOKD from the deployed v55 payroll milestone. Reconcile newer changes first, then implement the next unfinished collection/reconciliation and payment workflows. Preserve all role, evidence and test/live boundaries. Report actual build, test, deployment and acceptance results separately; do not repeat completed work or claim the complete platform is finished while production wiring remains open.
