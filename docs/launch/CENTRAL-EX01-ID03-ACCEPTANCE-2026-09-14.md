# Central EX01 / ID-PROVIDER-03 local acceptance

Both user-delivered checkpoints are integrated after be2423d. Full product build remains incomplete. No deployment, live provider/person/account activity, payment or runtime configuration change occurred. Reviewv69 remains the last verified deployment.

## Provenance and scope

- Payroll owner732955b3130dfcf5f04a3a392bde036691f6d262; delivered payroll-review.patch SHA256392d519e0a5aeb532edbfb3d63661b1a68fef34612c72b8d021c36f7373408af. Canonical0072 now owns its tables, indexes, view and immutable guards; proposal loading removed from canonical fixtures. Central added a lazy per-exported-item Operations UI. Reports and independent evidence decisions retain original payslip/payment history through reversal and suspension. They never change pay, release money or replace a payslip.
- Identity ownerb5a935b3f37bde05066fb3892b429b8e36bf174c; delivered ID-PROVIDER-03.patch SHA2561cefc9982ac117d4f355c772fdf83978c21290742b7ffbc8ee75de3bb9ec3cab. Private evidence reading requires explicit injected server policy and storage, exact current case/consent, bounded bytes, hash verification and attributable audit. Central normalized expected missing/reassigned/withdrawn source errors to documented generic409. No route or production vault/policy wiring was enabled.
- Credit ownera7a710e was already integrated in be2423d; repeated user delivery was not imported again. Actual owner receipts remain distinct from prepared assignments.

## Validation

Evidence directory: central-ex01-id03-checks.

- Full backend regression415/415 passed, zero failed/skipped/cancelled,56.729seconds; focused integration17/17 passed.
- Independent payroll canonical/API/connected review accepted, including alternate-key REPLACE, lineage, authority and preserved originals. Independent identity reader review accepted after source-error correction;8 focused and12 canonical checks passed. These overlap backend coverage and are not added to415.
- UI author22/22 passed; separate independent38/38 passed in28.9seconds:22 new review cases,10 payroll recovery and6 workspace navigation. Zero failures/flaky/skips. Synthetic APIs only; nonlocal requests aborted. Earlier fixture failures retained, assertions preserved. This is not a repeat of the preceding full170-case browser suite.
- Final TypeScript noEmit/incrementalfalse and full lint passed. Drizzle reports no schema changes. Readiness drift check passes1272 required objects through0072. Historical migrations unchanged.
- Required Sites build-site.mjs production bundle build passed with exit0 after isolated browser fixture stopped and port4294 closed. Build output retains its existing static route-classification limitation. Compilation is not product completion.

The UI verifies all unchanged-pay/payment/payslip response flags, preserves exact unknown request bodies/keys and transient drafts, clears private records on GET/POST401/403, and requires renewed source acknowledgment after evidence changes. Exported eligibility uses the actual payroll item joined run status, avoiding the separate capped run-list omission.

## Remaining build gate

Approved underpayment/overpayment, recovery, employer-change, tax/deduction, split/liability and authority rules are still required for actual corrections and corrected documents. Production identity still requires approved capture/composite, consent, entitlement, recovery, private storage and policy contracts/wiring. Wider partner/allocation/training/enrolment/dispute/legal/recovery requirements remain in the43-row LOKD-LAUNCH-TASKS.csv and CENTRAL-REMAINING-BUILD-INPUTS-2026-09-14.md. No unsupported policy was invented. Full build and independent local QA must precede live testing.
