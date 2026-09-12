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

## Terminal release receipt

- Source: 227bc6ed9e31e7d829e9fb7229990ec3c23e0e6c, pushed to the existing Sites repository.
- Version 56: appgprj_6a88a08505548191b266e9b711562ae3~appgver_38d0d4604ffc8191adc6acdbf27269ee.
- Deployment appgdep_6aa5b968c524819191d47085d537b148 succeeded at 2026-09-12T20:43:38.021508+00:00, environment revision 9 unchanged.
- Native URL: https://lokd-security.zenas-capetown.chatgpt.site.
- Final production build passed. Archive validated with server, hosting manifest and migration 0052, excluding environment/test files. Existing public audience retained. No new domain/DNS acceptance claim.

| Workflow | Built | Tested | Deployed | Browser acceptance | Live operational/provider acceptance |
| --- | --- | --- | --- | --- | --- |
| Payroll calculation/approval/CSV | Yes, prior milestone | Prior 263 + current regression | v55, retained in v56 | Prior local DEV fixture journey | Open |
| Booking request/approval/checkout/evidence verification | Yes | Isolated database and mocked provider tests | v56 | Not performed in this milestone | Open; live dispatch disabled |
| Canonical cleared settlement/funding/refund recovery | Incomplete | Existing guards retained | No new settlement implementation | Open | Open |
| Verified destinations and employee/partner payouts | Incomplete | Existing financial locks retained | No release adapters claimed | Open | Open |
| Partner payables/payslips/post-export adjustments/engagement splits | Incomplete | Existing unsupported transitions remain blocked | Not claimed | Open | Open |

This receipt is documentation only and does not require rebuilding or redeploying application source. Next work starts with exact settlement and recovery, then destination verification and payment adapters.
