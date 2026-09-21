# Finance sandbox completion — active work

Assignment: FINANCE-PROMPT.md delivered by user; sandbox assumptions/test transactions explicitly authorized. Do not stop at incremental checkpoints. No production mutation, live money, deployment or shared frontend edits.
Base213f0e99ffbe142f4718624ef38c127f05366fb1. Branchcodex/finance-sandbox-completion. Isolated durable checkout under finance-sandbox/source.

Implement application finance services with tenant/sandbox separation, immutable versioned policy, double-entry conservation, independent commands/approvals, source-version guards, durable provider claims/evidence and private reads. Reuse existing canonical order/service/payroll/document sources through explicit source links. Extend rather than overwrite production history. User explicitly permits fictional calculation/terms branches; do not gate sandbox work on company policy.

Work packages:
1. Provider configuration/read-only evidence and official contract. Native Sites environment revision15 has test-named Paystack secrets but values are redacted; local checkout/process has no Paystack key. Cannot authenticate actual provider test calls; do not claim mode/capability compatibility from key names alone. Full simulator must run; provide opt-in external test runner rejecting non-test key prefixes. Settlements unavailable in Paystack test mode per official authentication docs.
2. Immutable operational journal/command/source/policy/approval/record store; finance_workspace envsandbox enforced; sandbox data never feeds production funding, eligibility or documents.
3. Connected orders/invoices, partial receipts, allocations/reserves, actual service source liability, employee/partner payouts and reconciliation, private documents; one linked cycle with canonical service fixtures.
4. Adjustment ledger: under/overpay, fictional tax/deductions, employer splits, correction documents; partner line replacement chains; no reused service.
5. Refund/dispute/chargeback, residual funds/liabilities, recipient correction/retry, unknown/failed/reversed replacement.
6. R350 applicant/version enrolment; versioned training catalogue/order/refund/entitlements/expiry/revocation/provider completion; identity hooks independent from eligibility.
7. Real route/canonical DB tests, races/replay/amount conservation/access and alternative policies; complete regression/build/type/lint. Early frontend contract and integration patch; independent Central QA remains required.

Native environment response was filtered: values not printed or saved. No settings changed. Current official references: https://paystack.com/docs/payments/test-payments/ ; https://paystack.com/docs/api/authentication/ ; https://paystack.com/docs/api/transaction/ ; https://paystack.com/docs/api/refund/ ; https://paystack.com/docs/api/transfer/ . Never submit real people/cards/accounts.

Completed backend implementation is described in HANDOFF.md and exact frontend/identity requests in CONTRACT.md. The post-export bridge retains canonical item/export/snapshot references. Both full service-produced and focused database scenarios now run, including denied uncertainty/replay/races. Source is ready for Central review after the final recorded verification. Provider calls remain unexecuted; network-free inventory was used after automatic review rejected a credential-bearing probe. Frontend and merged-candidate QA remain with their assigned owners.
