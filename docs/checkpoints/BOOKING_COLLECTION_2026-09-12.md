# Booking collection evidence — 12 September 2026

Resumed the clean v55 payroll checkpoint (handover commit bad4637). Existing LOKD authority retained; no new task/agent, infrastructure, credentials, provider configuration, live money or dummy checkout was created.

## Implemented

- Client booking collection requests bind the exact production service order, client, applicant/account, intake version, order request hash, server price, ZAR and explicit Paystack test/live mode. One permanent reference per order/mode prevents duplicate or replacement charges after uncertain delivery.
- Production funding-reconciler grants and amount limits govern preparation, independent approval and verification. The bound Client alone opens checkout after approval. Current client/order evidence and approver authority are rechecked before dispatch. Owner MFA exception remains unchanged.
- The database claims initialization before provider dispatch. Timeouts/crashes retain the reference for verification; initialization is never automatically repeated. Provider URLs are fixed, redirects rejected and returned checkout URLs restricted to Paystack.
- Signed webhooks and authenticated API verification must agree on transaction ID, order/applicant/source/version, amount, currency, mode and payment time. Missing/ambiguous/mismatched evidence stays unverified. Contradictory webhooks invalidate previous matches; concurrent webhook arrival rolls back stale API verification. First validated transaction identity cannot be rebound.
- Immutable evidence, database binding/history guards, transition audit receipts, Operations evidence review and account-bound Client controls. Test events reuse the existing configured test webhook, including contradictory metadata routed by saved booking-reference prefix. Existing enrolment processing and dummy R350 reference are preserved. Dedicated booking webhook endpoint also exists with explicit mode.

## Financial boundary and remaining implementation

`matched_test` and `matched_live_unsettled` are collection evidence states, not cleared funding. This milestone does not write booking_funding_reconciliations, mark a booking paid, allocate an invoice, activate work or release payroll. Live initialization/verification requires PAYSTACK_LIVE_SECRET_KEY and LOKD_COLLECTION_LIVE_ENABLED=true; neither was configured here. Existing test secret is reused without reading or changing it.

Next: implement exact provider settlement/reconciliation evidence and guarded projection into the existing canonical funding and invoice allocation controls; refund/dispute/chargeback settlement recovery and supported replacement policy. Current permanent per-order/mode reference deliberately prevents replacement even after reversal; do not bypass it by creating a new order to charge again. Transaction failure/reversal is recorded but this is not refund execution. Full refund/dispute webhook object support remains open.

Then independently verified payment destinations, employee/partner payment adapters, partner payables, payslip issue, post-export adjustments and engagement-split handling. Payroll v55 and all old financial locks remain. Keep production live provider/legal/identity/Google/GPS acceptance separate; those owner dependencies are unchanged.

## Validation and lessons

- Production build and all 267 named regression tests passed, no failures/skips, using isolated databases and mocked provider transports. Log: /tmp/lokd-collections-regression.log. Four new evidence tests plus extended existing intake/order database journey cover binding dimensions, provider mode, unsafe IDs, malformed events, conflicting transaction/time, timeout persistence, no repeat dispatch, maker separation, account privacy, signed/duplicate webhooks, concurrent evidence invalidation, live gate and unchanged unfunded booking.
- Final shared-test-webhook routing follow-up passed the affected intake/collection database test (1) and existing Paystack webhook tests (3), TypeScript and changed-file ESLint. Final production build follows this source change.
- Initial fixture issues: SQL double quotes were correctly rejected as an identifier; corrected to a string literal. Isolated operator fixture initially lacked MFA headers and correctly failed closed; added verified fixture headers without changing the production MFA exception.
- Restricted Node child test runner stalled and was stopped. Direct named tests worked; full regression completed in the authorised unrestricted execution environment. Do not treat an empty process exit or file-only output as named-test evidence.
- No new authenticated browser acceptance and no real provider checkout/settlement acceptance in this milestone. Local fixture coverage is not production operational acceptance. No provider requests were dispatched by this task.

Sources checked: https://paystack.com/docs/api/transaction/ and https://paystack.com/docs/payments/webhooks/ (12 September 2026). Reuse the saved implementation/tests; do not repeat provider probes or the saved R350 completion request.

Release receipt will record terminal deployment separately. Full platform completion remains open.
