# LOKD handover — 13 September 2026

## Payment-destination continuation

The payment-destination implementation described below as next work has now been completed and validated. Read `PAYMENT_DESTINATIONS_2026-09-13.md` first for the current scope, acceptance limits and terminal release receipt. Employee recipient review, independent approval/rejection, test/live isolation, suspension and replacement history are built. Partner destinations/payables and actual payment instructions/adapters remain next work. The original v57 handover below is retained as historical context, not an instruction to repeat this implementation.


Owner requested continuation, a handover at the next checkpoint, and research into Akta. Stop here for the new task. Hosting continues normally. This handover supersedes the 12 September new-thread entry point, which stopped at v55 payroll. Do not repeat the collections and settlement work completed since then.

## Start here

Workspace: `/srv/ammosync/workspaces/lokd-security`.
Read `/srv/ammosync/AGENTS.md`, this file, `SETTLEMENT_REVIEW_2026-09-12.md`, `BOOKING_COLLECTION_2026-09-12.md`, `PERIOD_PAYROLL_2026-09-12.md` and `PRODUCTION_COMPLETION_PLAN_2026-09-12.md` in this checkpoint directory. Read `AKTA_ASSESSMENT_2026-09-13.md` for the new vendor research.

At handover preparation, HEAD was documentation receipt `79583d0`; deployed application source is `48b2ebb6c125274c548e52006ac9051c5feecd0e`. This handover is a local documentation-only commit, with no application changes, rebuild or new release. The remote source was last pushed at that deployed application commit.

## Deployed and accepted

- Sites project `appgprj_6a88a08505548191b266e9b711562ae3`, public audience.
- v57 `appgprj_6a88a08505548191b266e9b711562ae3~appgver_f9017a7bf3d481918657addb3211f911`.
- Deployment `appgdep_6aa5c06a3e9081919f9e463c0908445e` succeeded at `2026-09-12T21:13:34.921148+00:00`, environment revision 9 unchanged.
- Review at https://lokd.co.za/ ; workspaces https://portal.lokd.co.za/client/service , https://officers.lokd.co.za/officer/service and https://operations.lokd.co.za/ops/service require their existing sign-in and role.
- Native URL https://lokd-security.zenas-capetown.chatgpt.site . Existing five custom domains retain the same Worker association. Sites' current_live_url may show demo.lokd.co.za; do not recreate DNS because of this.
- Fresh handover metadata read on 13 September reports active, latest version 57, public. Post-deployment domain checks from the previous release returned homepage 200, correct role-host sign-in redirects, and anonymous Operations API 401. These are separate from real owner-account acceptance.

v55 completed immutable complete-period payroll calculation, independent approvals, controlled CSV export and pre-export void. v56 added durable, independently approved booking collections, bound client checkout, signed-webhook/API matching and uncertain-delivery recovery. v57 added independent provider settlement/bank receipt review, canonical live funding, separate guarded funding application and durable refund/dispute holds, including provider events arriving before collection binding. Test payments never fund production.

Validation already completed: 269 named regression tests passed; after the source-readiness view correction all 45 affected tests passed; final early-recovery change passed its affected database journey and three webhook tests. TypeScript, changed-file ESLint, production build and archive checks passed. Local authenticated settlement browser journey passed with four separate disposable Clerk DEVELOPMENT accounts, including independent review and Client/Officer evidence isolation. See the settlement receipt for failures, repairs and exact logs. Temporary users, fixture database and .dev.vars were cleaned up/restored. No tests were rerun for these documentation-only changes.

## Current checkpoint and next implementation

Akta research is complete. Recommendation: defer integration for LOKD's current payment work; consider it later for a specified video/training use case. The report distinguishes vendor claims, possible applications and procurement gaps. No vendor contact, purchase or integration occurred.

Independently verified payment destinations were selected as the next development milestone. Preliminary provider documentation/code review began, but **no destination implementation or destination tests were added in this continuation**. Do not report this as built or deployed.

Suggested bounded next milestone:

1. Prepare recipient evidence bound to the exact officer/employer/current engagement and explicit provider test/live mode. Inspect existing workforce and payroll schemas first. Employee payroll profiles currently intentionally have no payment destination; partner-company binding needs its own scope.
2. Use read-only Paystack recipient retrieval, with minimal immutable provider snapshots and hashes; avoid raw account details in logs or ordinary client responses. Official API reference: https://paystack.com/docs/api/transfer-recipient/ . A recipient code, account name or successful lookup alone does not prove ownership or authorise salary payment. Verify South African ZAR/basa support and actual configured account capability rather than inferring it from other-country examples.
3. Require ownership/mandate source evidence and independent review under real production grants. Guard mode, stale/changed recipient data, inactive/deleted recipients, source revisions and duplicate approvals. Determine suspension/supersession behavior before binding a verified destination to payable instructions. Test evidence must never produce a production-ready destination.
4. Test exact binding, maker/reviewer separation, restricted visibility and stale/change/recovery behavior with isolated fixtures. No transfer dispatch, recipient creation or live money movement is implied by this preparation milestone.
5. After the guarded workflow passes meaningful checks and browser acceptance, release through existing native Sites tooling and record the actual deployment result. Stop at the next agreed checkpoint if the owner requests it.

Useful files: `app/lib/production-operations.ts`, `production-operator-control.ts`, `operator-controls.ts`, `production-evidence.ts`, `production-payroll.ts`, `booking-collections.ts`, `booking-settlements.ts`, `settlement-evidence.ts`; `app/components/production-operations-panel.tsx`; `db/schema.ts`; latest applied migration `drizzle/0054_large_lord_hawal.sql`. Existing disbursement rows are not authority to release synthetic payouts. Add a new migration; never rewrite applied migrations.

Remaining after destinations: employee/partner payment adapters; partner payables; payslip issuance; invoice receipt allocation/issuance; post-export corrections and engagement splits; refund/dispute resolution and safe held-funding review/replacement-charge policy. Current financial holds are deliberately irreversible through the shipped controls. Never delete history or relax old locks to simulate completion.

## Owner decisions and outstanding real acceptance

- Preserve Clerk Client/Officer/Operations isolation and real production operator grants. `LOKD_OPERATIONS_MFA_REQUIRED=false` is the explicit owner exception; never fabricate MFA verification.
- `LOKD_LIVE_SHIFT_SCAN=false` stays. Identity, PSiRA, payment and work eligibility are separate. Real officer/provider/bank acceptance is not supplied by test fixtures.
- The owner's review sign-in email remains unanswered, so owner-specific production access and Google sign-in acceptance remain unresolved. Do not falsely mark either complete or repeatedly reopen old assumptions.
- Legal/entity/employer decisions and statutory source approvals remain real external inputs. Continue guarded interfaces using authorised isolated documents; never promote them into genuine production approvals.
- Read `VERIFYNOW_INTEGRATION_2026-09-11.md`, `VERIFYNOW_ENROLMENT_APPROVAL_2026-09-11.md` and `DUMMY_R350_ENROLMENT_2026-09-11.md` before changing enrolment. The dummy R350 checkout is already saved and its completion was already requested. Do not create another or ask again.
- Do not change provider credentials/infrastructure, send messages to others, edit AmmoSync/TNGO, or spawn duplicate implementation agents. No live payment was moved in this work.

## Reliable execution and release method

Read Sites skills for app edits/releases; reuse `.openai/hosting.json` and existing project/audience. Run the execution-profile script before builds. Never build while the account test runner has temporary Clerk `.dev.vars` installed. `npm test` includes a build; Node's child test runner requires the working escalated environment here. Check named test counts, not just process exit. Targeted direct Node tests can run without child isolation. Use installed TypeScript/ESLint executables.

Database tests are in `tests/assignment-activation-db.test.mjs`; settlement browser acceptance is in `tests/accounts/booking-settlement.spec.mjs`. `LOKD_ACCOUNT_TEST_STAGE=production LOKD_ACCOUNT_TEST_COLLECTIONS=true npm run test:accounts -- booking-settlement.spec.mjs` uses isolated fixture export and disposable DEV users. The runner restores the original local D1 database using a backup on the same filesystem (cross-filesystem rename previously failed with EXDEV). Do not repurpose that fixture for destinations without adding the new journey.

SQL guards must use `SELECT (CASE ... END);` for the hosted migration parser. Restore only generated `tsconfig.tsbuildinfo` changes if typechecking updates it. Do not repeat passing broad checks without a new change or unresolved concern.

Commit/push metadata may need execution escalation. Git identity is available with per-command `-c user.name=Codex -c user.email=codex@openai.com`. Acquire a fresh native Sites source write credential only when ready; push with an ephemeral per-command auth header and never print it. Package the exact tested/pushed commit; validate archive server, manifest and new migrations with no environment/test secrets. Save and deploy once, then poll the exact returned deployment ID to terminal. Receipt-only commits do not require rebuilding.

## Opening instruction for the new task

Read `/srv/ammosync/workspaces/lokd-security/docs/checkpoints/NEW_THREAD_RESUME_2026-09-13.md` and continue LOKD from the deployed v57 settlement milestone. Implement the next guarded payment-destination workflow, test the connected journey, and publish the validated update on LOKD.co.za. Preserve existing role, evidence, recovery and test/live boundaries. Use the saved Akta assessment for any follow-up; do not repeat completed collections/settlement work.
