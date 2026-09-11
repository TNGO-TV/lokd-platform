# Paystack test callback and webhook

Owner supplied both test keys. Stored as protected Sites runtime settings in revision 8; no key values are saved in this checkpoint or source.

Callback: https://lokd.co.za/payments/paystack/test/callback
Webhook: https://lokd.co.za/api/paystack/test/webhook
Set these in Paystack Dashboard, test mode, Settings → API Keys & Webhooks.

Runtime secret: PAYSTACK_TEST_SECRET_KEY (sk_test_...). Optional public key: PAYSTACK_TEST_PUBLIC_KEY (pk_test_...). Public key is not needed to receive a webhook. Local handoff path `.env.paystack-test` is ignored by Git; never commit or print keys. Store the secret in Sites runtime and redeploy to apply it.

Receiver validates HMAC-SHA512 against the exact bounded request bytes using Web Crypto, before parsing or storing. It accepts only data.domain=test. Missing configuration returns 503; bad signatures 401; live or absent domain 422; oversized payload 413; storage failure 503 so Paystack retries. Successful durable storage returns 200. Exact-payload SHA256 primary key makes repeated identical deliveries idempotent. Minimal event metadata only is stored in paystack_test_deliveries (migration 0036), with received time; no card authorizations, customer identities or full payloads. No public read endpoint exposes these records.

This is delivery evidence, not payment reconciliation. It never credits bookings, activates service or pays officers. Unsupported/ambiguous-domain events remain unaccepted. Reordered/reformatted distinct signed bodies may create distinct delivery evidence; no financial side effects occur. Future canonical transaction processing must deduplicate by provider transaction/event identity and compare expected owner, amount, currency and reference with server-side verification.

Callback is an informational test return page, does not trust query parameters and does not claim success. Provider-to-provider webhook POST uses HMAC independently of Clerk browser authentication; all other Clerk and role controls remain intact.

Validation: three local tests passed with real SQLite and synthetic signed payloads: valid delivery/replay, invalid signatures/live-domain/configuration rejection, size and storage failure. TypeScript passed. No actual Paystack delivery or transaction has been tested without owner keys. Next: securely install test key, have owner save URLs in test dashboard, run controlled test checkout, verify actual delivery and transaction reference with Paystack's server API. Do not claim live financial acceptance.

Sources checked 11 September 2026:
- https://paystack.com/docs/payments/webhooks/ — raw-body HMAC SHA512, 200 acknowledgement, test retries.
- https://paystack.com/docs/payments/accept-payments/ — test/live callback configuration; keep secret server-side.
- https://paystack.com/docs/payments/verify-payments/ — transaction status must be verified separately.

## Activated release receipt

Version 46, source `03f69e2f867ecf8574be2c7ca9575b30dbf208eb`. Version ID `appgprj_6a88a08505548191b266e9b711562ae3~appgver_f4c604ae0540819190537a06a6bd795c`. Initial deployment succeeded with revision 7; activation deployment `appgdep_6aa3aa76aca881919670bc10692a9bbb` succeeded 2026-09-11T07:15:31.661364Z with environment revision 8. Clerk, live stage and temporary MFA-off setting preserved.

Paystack /balance authenticated the supplied test secret: HTTP 200, API status true. Balance data was not printed or stored. At 2026-09-11T07:16:03Z deployed callback returned 200; unsigned/invalid webhook returned 401; locally signed labelled `lokd.receiver_probe` test event and identical retry returned 200; signed live-domain event returned 422. The test-only delivery reference is `lokd-local-delivery-probe-20260911`, zero amount. This proves receiver wiring/storage and signature checks, NOT a Paystack-originated checkout or financial acceptance.

Next owner action: save the callback/webhook URLs in Paystack's TEST dashboard. Then run a controlled Paystack test checkout and confirm actual provider delivery and server-side transaction verification. Public key stored for future checkout wiring; hosted checkout is not added by this endpoint milestone.
