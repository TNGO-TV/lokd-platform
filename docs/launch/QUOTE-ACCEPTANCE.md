# Client quote acceptance — build specification and operator guide

Owner decision, 22 September 2026: a client accepts a quote and the linked standard terms using a required checkbox. Do not require a separate client contract per assigned officer.

## Use

1. In Operations → Agreements → Quotes and terms, upload the final terms PDF, a distinct version and the LOKD contracting entity ID.
2. The existing authorised owner reviews the downloaded file and approves that exact version. Uploading does not approve legal content.
3. Prepare the independently reviewed client's service order in Service operations, then issue its quote with matching approved terms and an expiry within 30 days. Issue assigns a public number `LOKD` + SAST year/month + a global two-digit monthly sequence (`LOKD260901`). The internal id stays `QUOTE-` plus a UUID for acceptance, foreign keys and the Books reference number. The linked invoice number is `INV-` plus that public number (`INV-LOKD260901`); there is no separate invoice counter, and this build does not create the Books invoice.
4. The named authenticated client opens the quote, reads/downloads its linked terms and checks acceptance before selecting Accept quote.
5. The retained record includes the precise quote, terms version and SHA-256, account, timestamp and acknowledgement. Clients can download the acceptance record and original terms.
6. Cancel with a reason before replacing an accepted quote. A replacement requires fresh acceptance. No cancellation action itself charges, refunds or issues an invoice.

## Invariants

Terms bytes and quote/receipt history are immutable. Version replacement cannot rewrite accepted terms. Superseded, expired, cancelled, withdrawn, changed-scope or wrong-account acceptance fails closed. A changed quote/client snapshot needs new acceptance. Database guards recheck source state at receipt insertion; acceptance and cancellation advance the activation evidence epoch.

One valid order acceptance satisfies CLIENT_MSA and SERVICE_ORDER activation checks for that order, independent of assigned officer and roster slot. Workforce agreements, current client review, funding, independent activation and safety checks remain required. Historical envelope records remain readable and their previous verification path is preserved for orders without the new quote flow.

Uploads use private R2 with protected downloads and byte-hash verification. Client quote responses exclude internal officer wages, cost floors and margins. Only the named client account can accept; Operations cannot accept for a client.

Quote notifications reuse the established outbox and current verified-account email lookup, including designated-source/recipient restrictions and receipt reconciliation. A queued notification is not proof of provider delivery. No email allowlist or financial gate is widened by this build.

## Verification boundaries

New automated tests use isolated SQLite/R2 substitutes, synthetic identities and non-contract PDF fixture bytes. Mobile/desktop UI tests use explicitly mocked API responses. They are not actual customer acceptance, legal review or provider delivery evidence.

Final contract files, authorised client identities and prepared business orders are still needed for a real hosted acceptance. Paystack provider checkout/webhook and independent settlement verification remain outstanding; real payments and invoices remain deferred.
