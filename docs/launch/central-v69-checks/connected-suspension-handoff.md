# Connected payment/workforce suspension extension

Only tests/fixtures/connected-payment-consumption.mjs changed. After actual handler-generated paid and reversed reconciliation decisions exist, the fixture locates the original payroll item's approved engagement review and calls suspendOfficerWorkforce. It asserts workforce suspended, immutable workforce hold retained and current readiness passports absent.

Exact snapshots of18 payment/payroll/issued-document history tables remain unchanged across that guarded suspension, including transfer observations, instructions, commands, claims, reserves, releases, reconciliation reviews/decisions, payroll sources/snapshots/decisions and document versions/decisions/issues. Approved disposition history explicitly contains success then reversed. The actual SQL contract correctly keeps current financial/payslip state reversed and as-issued state unpaid; suspension revokes work eligibility without pretending reconciled returned money disappeared.

All this remains within the payment savepoint. Rollback still restores original gate0, no payment instructions and unpaid original payslip before the outer workforce suspension and historical preservation checks.

Named test `completed linked service is consumed by independently approved payroll and preserves history after workforce suspension`:1 passed0 failed/skipped/cancelled,986ms; /tmp/lokd-connected-suspension-payment.log. Focused ESLint passed. Root owns independent review of this extension. Synthetic provider/bank/client/site/funding fixtures remain; no live acceptance claimed.
