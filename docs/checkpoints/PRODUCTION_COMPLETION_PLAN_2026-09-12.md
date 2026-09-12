# LOKD production completion — active

Owner asked to complete now after v49. Do not repeat the test-only milestone or call the complete build finished while production wiring remains absent. Test documents and fixtures are authorised for development and validation. Live approvals, live money and work activation still require their real evidence. Existing Clerk role controls, MFA exception, provider credentials and separate identity/PSiRA/payment/work states remain unchanged.

Implementation sequence in this existing task:
1. Production intake-to-entity binding, approved-document delivery/signing and activation receipt linkage using existing policy modules; include document withdrawal, signer authority and exact scope/version checks.
2. Production-scoped Operations/participant commands around existing readiness, activation, service evidence and payroll policies, without re-enabling synthetic APIs or copying demo records.
3. Provider-backed collection/reconciliation/payment adapters with explicit test/live separation and idempotency; retain external acceptance gates. Do not claim a simulated payment proves Paystack acceptance.
4. Connected browser acceptance, current deployment and authoritative completion matrix distinguishing code/test/production acceptance.

Unknown business inputs are owner-supplied documents, entity/employer decisions, training packages and first Operations identity; build forms and guarded interfaces rather than inventing these values. No duplicate implementation task or external-project edits.

## Current checkpoint after v54, 12 September 2026
Read SIGNED_TERMS_PAYROLL_POLICY_2026-09-12.md and SERVICE_EVIDENCE_SCHEDULING_2026-09-12.md first. Do not repeat already-deployed client review/orders, source-evidence reviews, scheduling, actual check-in/checkout, client disputes, service-pay review/reopen, bound employment signature projection or production payroll-policy configuration. Latest deployed source is 7c22465f906e1176c03b427d723e609bb538b223, with 262 regression tests passing. The complete build remains open.
Next implementation: payroll profiles/destination verification and period-based payroll processing with independent approval/export/payslip and post-payroll adjustment recovery; partner payables; provider-backed booking collection and officer-payment reconciliation. Preserve older financial locks until exact command authorisation/evidence is integrated. Separate the unfinished code from external real-identity, legal, owner, Google, saved checkout and live financial/GPS acceptance inputs. No new test checkout or repeated manual-completion request.

## Current checkpoint after v55, 12 September 2026
Read PERIOD_PAYROLL_2026-09-12.md before further work. Payroll calculation profiles, immutable complete-period calculations, independent approvals, restricted review, controlled CSV export and pre-export correction recovery are now implemented, tested and deployed in v55 (source 130ecc0f67a834c98a0aba47f4f0d7155512be57). Do not rebuild them. Remaining code: provider collection/reconciliation, verified destinations and payment adapters, partner payables, payslips and post-export adjustments. Production financial acceptance remains distinct.

## Booking collection evidence follow-up
Read BOOKING_COLLECTION_2026-09-12.md for the next source milestone after v55. Durable requests, independent approval, client checkout, API/signed-webhook evidence agreement and mismatch/timeout recovery are implemented. These do not yet project cleared settlement into canonical funding. Provider settlement/refund/dispute recovery and all payout workflows remain open; consult its terminal release receipt before claiming deployment.
