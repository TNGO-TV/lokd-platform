# LOKD period payroll milestone — 12 September 2026

Resumed the existing project after v54 (source 7c22465f906e1176c03b427d723e609bb538b223, receipt 25f3b99). Owner authorises continuing implementation and existing Sites releases with isolated test documents/fixtures. No external-project work, new infrastructure, changed provider credentials, live money dispatch or new dummy checkout.

## Built

- Independently reviewed production payroll calculation profiles, bound to officer/engagement/employer, versioned evidence and expiry. Secure tax/UIF/provident references only; payment destination remains null. Superseding/suspending a profile invalidates subsequent approvals.
- Completed employer-period payroll: explicit reviewed per-officer tax/deduction inputs, approved policy/frequency and wage-area checks, actual payable minutes and exact pay-reviewed gross. Unfinished, disputed, unreviewed, consumed, oversized and overlapping periods are blocked. Partner-company work is excluded from employee payroll.
- Immutable policy/input/calculation/source snapshots, request idempotency, source allocation, transactional rechecks of profiles, period contents and unfinished service. No provider request occurs.
- Independent preparer/reviewer/finance workflow with real production operator grants, limits and stale-version/hash checks. MFA follows the existing owner exception; server authorisation records distinguish the exception from verified MFA. No account is falsely marked MFA verified. Legacy financial locks remain.
- Controlled CSV calculation export, approval/source history, staff evidence review and officer-only approved calculation visibility. CSV explicitly says NOT_RELEASED and contains no secure payroll identity references. It is not a bank file, payslip or payment receipt.
- Pre-export void releases allocated service records for reopening/review/recalculation while retaining all previous calculations and decisions. Exported payroll cannot be silently voided or marked paid.

## Tested

- Full production build and all 263 regression tests passed, 0 failures/skips (`/tmp/lokd-period-payroll-full-test.log`).
- After adding restricted staff snapshot visibility, the affected payroll database test passed (`/tmp/lokd-period-payroll-final-targeted.log`); no repeated full regression run. Covers missing profiles, changed-profile transaction rollback, duplicate requests, consumed sources, correction/reopen/recalculation history, genuine approval separation, configured-MFA rejection, stale decisions, export, owner/officer access restrictions and settlement locks.
- Authenticated browser journey passed with four separate Clerk DEVELOPMENT accounts: preparer, reviewer, finance and officer. Browser verified exact saved input/source review, independent approval steps, maker self-approval rejection, actual CSV download, officer-own calculation visibility and denied Operations API access. Final run 1 passed in 31.3s (`/tmp/lokd-period-payroll-browser-evidence.log`). This is local browser acceptance with isolated fixtures, not acceptance by real production users.
- Initial browser fixture setup was rejected by the immutable identity-binding trigger. Corrected only the disposable fixture account relabelling in a transaction, restoring the exact trigger before application requests. Test runner deleted all temporary Clerk identities/configuration and restored the original local D1 database. Preserve this failure and method; never relax production identity binding for test convenience.
- The initial candidate policy correctly rejected unresolved health-cover treatment. Only the isolated test policy was explicitly marked source-verified. The real candidate and production policy approvals were not altered.
- Final TypeScript, changed-file ESLint and diff checks passed. Final build includes the evidence-screen follow-up (release result below).

## Not yet accepted / exact next work

The complete production build remains open. Next implement provider-backed booking collection/reconciliation and verified payment destinations, then employee/partner payment adapters, partner payables, payslip issuance and post-export adjustment recovery. Multi-engagement changes within a pay period still require a supported split/adjustment path and are currently blocked explicitly. Do not release old synthetic payment/settlement APIs to fill these gaps.

Keep identity, PSiRA, payment and work eligibility separate. Do not promote VerifyNow test fixtures to real identity evidence. Preserve Clerk controls, the MFA-off owner exception and LOKD_LIVE_SHIFT_SCAN=false. Real legal documents, entity/employer decisions, statutory source approval, first Operations identity, Google acceptance and live provider/GPS acceptance remain external inputs. These do not justify stopping available implementation work or inventing training packages.

Reuse the existing R350 dummy/test checkout and its saved receipts; the owner was already asked once to complete it. Do not make another checkout or repeat that question. Test financial results cannot fund production service. Consult PRODUCTION_COMPLETION_PLAN_2026-09-12.md and previous signing/service receipts; do not rebuild completed stages.

## Release

Sites publication succeeded at 2026-09-12T20:21:19.455700Z, environment revision 9 unchanged.
- Source: `130ecc0f67a834c98a0aba47f4f0d7155512be57`.
- Version 55: `appgprj_6a88a08505548191b266e9b711562ae3~appgver_0a593be979b88191977012117d515f26`.
- Deployment: `appgdep_6aa5b4174b208191bb170433c3c6316f`.
- Native returned URL: https://lokd-security.zenas-capetown.chatgpt.site
- Final build passed; archive validated with server, manifest and migration 0051, without test/environment files. Current public audience and existing domain configuration preserved.
- Local authenticated browser acceptance is recorded above. No real production payroll or live provider payment was accepted or released. Resume the next implementation step above; this payroll milestone is deployed, the full platform build is not complete.
