> Dated transport record only. Email is SMTP or disabled. Accounting inspect is Odoo company 4. See `docs/launch/ODOO-CO4-INSPECT.md`.

# Worker provider transport correction — 22 September 2026

The authenticated hosted Operations panel showed CRM ENQ-F5BAD219 waiting to retry after one attempt with `provider_transport_unknown`, and its team email uncertain after one attempt with a mail-acceptance-unknown code. No resend was initiated during diagnosis.

A local actual workerd/Miniflare probe using the deployed compatibility date (2026-09-11) reproduced the failure: `redirect: "error"` throws a TypeError before network I/O. The error explicitly requires `manual` or `follow`. The same non-credentialed request with manual mode reached the token endpoint and returned HTTP 200 with `invalid_client`. This establishes runtime transport compatibility, not valid OAuth or provider acceptance. Current Cloudflare Request documentation lists `error`, so the runtime reproduction is retained as the decisive evidence.

The shared fetch helper forces manual redirects, cancels 3xx response bodies and throws without following Location. Paystack and VerifyNow adapters use the same boundary. Credentials and bodies remain on the original endpoint. Provider response parsing, timeout, source/recipient gates, retry rules, uncertain claims, role controls and live gates remain unchanged.

Validation includes an actual Worker runtime with a synthetic outbound service: one original request succeeds, while 302/307/308 responses cause exactly one request and no forwarded credentials. Separate boundary tests cover every relevant 3xx status. These automated tests are simulations, not payment, identity or email-provider acceptance.

Existing uncertain email remains held for reconciliation. The transport fix does not authorize replay or establish historical delivery. Hosted CRM recovery and provider email reconciliation must be recorded separately after release.
