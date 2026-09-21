# Connected payroll-to-payment local QA extension — 14 September 2026

Implemented bounded QA-02 fixture extension in the assigned two files only. No backend, migrations, configuration, credentials, provider/Sites or real-account changes.

Entry is the existing `tests/production-identity-connected.test.mjs` named `completed linked service is consumed by independently approved payroll and preserves history after workforce suspension`. Its real locally produced chain remains identity/PSiRA/readiness→reviewed direct_flex workforce→activation/check-in→completed service→client signoff→independent pay review→approved/exported payroll→private issued payslip. New payment fixture consumes the exact run/item/profile and existing production_entity_links/signup_cases applicant, asserting owner/case/run/officer/net-amount correspondence. No replacement applicant, payroll item, synthetic paid SQL mutation or guard bypass is introduced.

New connected checks:

- Approved live-mode synthetic recipient linked through the existing current payroll profile; independently reviewed destination and employee instruction. Wrong role and maker approvals denied.
- Independently prepared/approved reserve and release with exact amount and fee ceiling.
- Default lock, runtime-only flag and database-only gate each deny dispatch. Enabling both occurs only in disposable in-memory savepoint.
- Injected timeout after exactly one synthetic POST leaves durable dispatch claim. Retry denied; signed duplicate success callback and exact API lookup remain held without bank reconciliation.
- Independent bank debit review/approval creates canonical paid projection. Existing payslip now shows current paid while immutable as-issued unpaid remains true.
- Signed reversal immediately holds current payment/documents; exact API evidence and a distinct independently approved return receipt produce reversed projection. Historical paid receipt/decision retained; allocated reserve not silently replenished; original payroll and issued document unchanged.
- Entire payment scenario rolls back before existing workforce-suspension test. Payment gate returns disabled, instructions disappear and existing issued payslip returns unpaid for the original history-preservation assertions. Signup records are byte-for-byte unchanged throughout payment.

Actual verification:

`node --experimental-strip-types --experimental-loader=./tests/cloudflare-loader.mjs --test-name-pattern='completed linked service' tests/production-identity-connected.test.mjs`

**1 named connected test passed,0 failed/skipped/cancelled**,0.953s, first run. Log `/tmp/lokd-connected-payment-first.log`. Changed-file ESLint passed without diagnostics. No full broad regression rerun claimed; Central owns merged candidate validation. Reviewer who authored this extension cannot provide its independent final acceptance; obtain a separate bounded review.

Scope remains Unarmed/commercial_access/direct_flex, injected provider and synthetic banking/authority records. It does not complete upstream collection as part of this same identity fixture, genuine account/provider/person/financial acceptance, partner/managed/specialist/training routes or remaining commercial product requirements. Original surrounding client/site/funding fixtures retain their existing boundaries. It closes the prior disconnected payroll-item-to-payment/documents gap for this selected local route.

Source hashes:
- `tests/fixtures/connected-payment-consumption.mjs`: `5d93f586a2f49ec17bd3c1262a93693aa5916b8aa67098955b83bc47b3feb23d`
- `tests/fixtures/connected-payroll-consumption.mjs`: `34e209e7eed8d97c1d1129a4e8859e554a7a0e3975f9ee443c855e06ceee577b`
