# Independent connected payroll/payment QA — 14 September 2026

PASS for the bounded local connected-payment extension. No actionable defect found. Read/test-only review; no source edits.

Reviewed author handoff `/tmp/lokd-connected-payment-consumption-handoff.md`, both assigned fixture files, the named production-identity-connected test, original identity intake fixture, D1 adapter and finance-document journey.

Evidence of continuity:
- Original identity fixture creates the applicant through `/api/applications`, links it with writeSignup, then produces identity/PSiRA/entity/readiness records. The connected test activates that officer, checks in, records actual fixture-clock completed service, obtains client signoff and independent pay review.
- consumeConnectedPayroll allocates that exact shift_timesheet into pay_item_sources and asserts its version, minutes and gross amount. The payroll snapshot binds the same officer, engagement and timesheet; approved/exported payroll creates the payslip used downstream.
- consumeConnectedPayment SELECTs the existing payroll item by that run and officer. It asserts existing production_entity_links owner equals the original applicant, destination source caseId equals the same linkage case, instruction run/officer/owner agree, and amount equals item.net_pay_cents. No new/replacement signup_cases or payroll items are inserted in this payment fixture. Byte comparisons prove original signup rows, payroll item and issued document version unchanged through the payment scenario.

Exercised financial behavior:
- Independent destination, instruction, reserve and release decisions; maker rejection and applicant Operations denial.
- Dispatch denied with default gates, runtime-only flag and DB-only gate. Only the disposable scenario enables both.
- Exactly one injected transfer POST times out; durable claim blocks resubmission. Signed success replay and exact API response remain held until an independently approved bank receipt.
- Current projection becomes paid while as-issued payslip stays unpaid. Signed reversal immediately holds it, then exact API evidence and independent returned-funds receipt establish reversed. Historical paid decision is retained; reserve remaining balance is still zero. This uses actual application handlers and SQL guards, not a raw paid/reversed SQL update.

Restoration verified:
- All payment scenario mutations are inside SAVEPOINT connected_payment. Its temporary db.batch implementation preserves nested atomic operations with a savepoint and restores the original adapter in finally.
- Finally rolls back/releases the payment savepoint. Explicit assertions prove DB live gate restored to0, employee instructions removed and original payslip current state returned to unpaid.
- Only then the existing workforce suspension runs. It compares the original activation/workforce/service/payroll/document histories and asserts exported payroll and approved timesheet retained. The independent named test executed all these assertions successfully.

Independent execution:
`node --experimental-strip-types --experimental-loader=./tests/cloudflare-loader.mjs --test-name-pattern='completed linked service' tests/production-identity-connected.test.mjs`

Result:1 named test passed;0 failed, skipped, cancelled;928ms total. Log `/tmp/lokd-connected-payment-independent.log`. Warnings concern Node experimental loader/SQLite/mock timers only. File SHA-256 values match the author handoff:
- connected-payment-consumption.mjs:5d93f586a2f49ec17bd3c1262a93693aa5916b8aa67098955b83bc47b3feb23d
- connected-payroll-consumption.mjs:34e209e7eed8d97c1d1129a4e8859e554a7a0e3975f9ee443c855e06ceee577b

Coverage limits: one synthetic Unarmed/commercial_access/direct_flex route; surrounding client/site/funding/banking/scheduling remain fixtures. Provider transport and bank evidence are injected, not genuine. Upstream actual collection is not connected into this same identity test. Other commercial/training/partner/managed/specialist paths and browser/account/device acceptance are outside scope. Because payment changes roll back before workforce suspension, this test does NOT demonstrate retained paid/reversed payment history after suspension; it demonstrates payment lifecycle before rollback and preserved service/payroll/issued-document history after suspension separately. No full regression or live acceptance claimed.
