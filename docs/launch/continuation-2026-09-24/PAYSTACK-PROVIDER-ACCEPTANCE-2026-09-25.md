# Paystack provider acceptance — 25 September 2026

Version 96 is published. Three genuine hosted Paystack TEST transactions were exercised through the existing Operations owner session. No real card, live charge, invoice, client verification or service approval was used.

| Scenario | Saved reference | Actual hosted result |
| --- | --- | --- |
| Success | lokd-provider-test-5373d6ca-f732-4b7c-be0b-e341fcb22a07 | `verified_test`; Paystack verification reports success and a matching HMAC-verified success webhook was received. Checked 2026-09-25T01:25:30.207Z. |
| Decline | lokd-provider-test-901ce0f2-db0d-4407-9a11-9969bc4e7a83 | Paystack checkout visibly reported Declined; subsequent provider verification returned failed. No success credited. Checked 2026-09-25T01:26:29.069Z. |
| Cancel | lokd-provider-test-50a5badd-721b-4df2-bd87-d1079871b8c8 | Closed the TEST checkout without submitting payment. Provider verification returned abandoned. No success credited. Checked 2026-09-25T01:27:20.540Z. |

Each request was fixed at 100 ZAR cents and used only the server's existing TEST secret. Paystack's hosted page displayed TEST and provided its Success/Declined test controls. The success return navigated to the Operations test page; return alone left the record awaiting checkout until the separate authenticated verification checked provider data and the signed webhook.

The new owner-only route is https://operations.lokd.co.za/ops/payment-test. It preserves one original reference per owner/version/scenario. Its records are separate from production orders, invoices, accounting and eligibility. This proves provider TEST connectivity, the success webhook and declined/abandoned handling. It does not establish customer quote-to-invoice reconciliation, payment email receipt delivery, settlement or readiness for live-card payments.

## Release evidence

- PR 24: https://github.com/zenascapetown-code/lokd-platform/pull/24
- Tested head: a6697667b453b8f6c2e587f4fa728f4c362b54fb.
- Fresh base: 1e4d2cae00a851e240d5a5741cb06b5ebf2510f1.
- Security CI 36081162755 passed every job and step; 570 tests passed, zero failed. Dependency audit reported zero vulnerabilities.
- Four targeted mobile/desktop Playwright checks passed; mobile screenshot inspected with no overlapping controls or horizontal overflow.
- Expected-head merge: 6fb4c9c23e5e4112cb0bf57d9cb75e8055354431. Merged content equals tested candidate; tree a5031703287f7f3b56067e6089d8f90cefcd7e73. Canonical checkout fast-forwarded with existing notes preserved.
- Saved version: appgprj_6a88a08505548191b266e9b711562ae3~appgver_dacb9aee02b88191b9bc7bdd6611079e.
- Deployment: appgdep_6ab5cd0e77a48191821fb448d024e813; succeeded 2026-09-25T01:23:52.570464+00:00, environment revision 34.
- Local/VPS archive SHA256: 508441f024761b25b51ce5b21fa02f0e0bd224c84e093e345f2a860ead6a6858.
- Sites normalized archive SHA256: 45163893b5088bdf42546cbe8bbd71136f3a28301a1c166a6c78e5a24ea322ba; 44,083,200 bytes, 285 files.

Validation failures retained: initial TypeScript check required explicit response typing; corrected before the candidate commit. No hosted provider failure was suppressed or manually overridden. No payment callback was synthesized in production.
