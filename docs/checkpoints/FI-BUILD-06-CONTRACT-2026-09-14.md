# FI-BUILD-06 — backend integration contract

Base: `c358358d6ad1ad59ba2f8e39513928c343e5736b`, the combined v69 review release. Local implementation only. Central owns canonical migrations, shared routing integration and publication; frontend owns shared components. No component, existing route, runtime configuration, credential or applied migration is changed here. The existing collection library preserves normalized refund evidence after its existing signature verification.

## Provider evidence contract

Reviewed 14 September 2026 against [Paystack Refund API](https://paystack.com/docs/api/refund/) and [refund lifecycle/webhooks](https://paystack.com/docs/payments/refunds/). POST `/refund` specifies original transaction, minor-unit amount, currency and merchant note. Recovery uses GET `/refund/{id}`. The documented retry endpoint needs customer bank details; this checkpoint deliberately supplies no bank-details retry action. Provider-specific entitlement and actual account evidence are not accepted by this implementation exercise.

API observations bind refund ID, integration, original transaction ID, mode, positive integer ZAR amount, status and merchant note; deduction fields must establish the exact amount. Customer/account fields are discarded. Documented sparse webhooks may contain a string amount and transaction reference without an API refund ID. They are matched by transaction, integration, mode, amount and event/status; a transaction reference is never treated as a refund ID. The app requires a fresh API observation after the event watermark, an independent bank-debit receipt and approval. Processed status alone is insufficient; customer receipt timing is not asserted.

Sparse events for locally submitted refunds must postdate the claim. Identical event replay is deduplicated; ambiguous/reused evidence remains held. Existing provider refunds are adopted read-only against an independently approved provider ID and original transaction. Adoption retains a claim and never calls POST. Unknown outcomes, failed GETs, 404s, malformed evidence, wrong integration/mode/amount/identity, failed/needs-attention events, disputes and contradictions remain held. Later success cannot erase contradictory observations. There is no automatic hold deletion or automatic retry of a POST.

## Endpoints for frontend integration

All JSON responses use `private, no-store`. The existing trusted verified-user middleware contract remains required. Operations hosts/scopes require configured Operations access and the existing MFA policy, including the owner's unchanged exception. Each original amount must fit the operator's limit; funding_reconciler authorizes refund work and finance_approver authorizes credit work. Recipient/maker and reviewer identities must differ. Errors: 401 unsigned user; 403 scope/role/independence; 404 private record missing; 409 stale/conflicting evidence or source; 413 oversized input; 423 locked dispatch; 503 storage/provider unavailable. Frontend must retain drafts and refresh after conflicts, never silently retry a dispatch.

### `/api/booking-refunds`

GET (Operations only) returns authorized `sources`, `refundCases`, `refundReceipts`, `refundObservations`, `refundStates`, `liveRefundsEnabled`. IDs are existing collection references and linked records; discovery is capped at 500 sources/100 cases/100 receipts/200 observations. Pagination beyond these caps is a recorded follow-up, not complete large-history discovery. Exact stored history is not deleted.

POST always includes `reference` and `action`:

- `prepare_refund_case`: `requestKey`, `intent` (`refund` or `investigate`), `note`, `policyReference`, `policyHash`, `evidenceHash`, `liabilityPlan`, `evidenceReviewed:true`, `liabilitiesReviewed:true`; monetary intent also requires `creditNoteId`. Optional `externalRefundId` prepares adoption of a provider-originated refund. Amount is derived from the independently issued positive credit, not a free refund input. Returns `caseId`.
- `approve_refund_case` / `reject_refund_case`: `caseId`, `payloadHash`, `note`, `evidenceReviewed:true`. Source snapshot includes holds, funding, service, payroll and partner liabilities. Changed evidence or authority invalidates approval.
- `dispatch_refund`: `caseId`, `payloadHash`, `evidenceReviewed:true`. One durable claim precedes one POST. A timeout returns uncertain and keeps that claim. A second POST for the case/credit is prohibited. Unresolved earlier claims block further partial refunds. Live dispatch requires **both existing payment gates** (`LOKD_LIVE_PAYMENTS_ENABLED` and `payment_live_control.enabled`) plus the new default-off refund environment/database gates. No enable endpoint exists.
- `adopt_refund`: same approval fields; requires the approved `externalRefundId`. GET-only recovery, no new monetary submission. Cannot adopt an already claimed external ID or count a provider refund twice.
- `verify_refund`: `caseId`, numeric `refundId`. Fetches the original refund; never creates another. Missing outcomes are stored as held evidence.
- `prepare_refund_receipt`: `caseId`, `bankReference`, `bankHash`, `bankAmountMinor`, `note`, `evidenceReviewed:true`. Exact case amount, fresh signed/API evidence and current source required. Returns `receiptId`.
- `approve_refund_receipt` / `reject_refund_receipt`: `caseId`, `receiptId`, `payloadHash`, `note`, `evidenceReviewed:true`. Different current reviewer, distinct original maker, one approval and unique bank/provider evidence.

`refundStates` includes `reconciled_minor`, original `amount_minor`, `currently_held`, `funding_available:0`, `liabilities_cancelled:0`. State values: `investigation_held`, `refund_claimed_held`, `reconciled_history_currently_held`, `test_refund_confirmed`, `partially_refunded_funding_held`, `refunded_funding_held`. Test confirmation is not real money refunded. A fully reconciled live refund changes the canonical invoice projection to `reversed`; a partial refund keeps the invoice `held` with its exact reconciled amount available in this endpoint. Original document facts and issued status do not change.

### `/api/credit-notes`

GET `?invoiceId=...` permits only the bound client and returns issued notes. GET with `scope=operations` permits current independent finance authority and includes drafts. Cross-client and officer-host access is denied. Returns `invoice` (original source and `credited_cents`), `creditNotes` (source/payload JSON, decisions, issue numbers and timestamps), `moneyMoved:false`, `liabilitiesCancelled:false`.

POST requires `scope=operations` and `invoiceId`:

- `prepare_credit_note`: `requestKey`, `netCents`, `taxCents`, `policyReference`, `policyHash`, `taxReference`, `taxHash`, `liabilityPlan`, `note`, `evidenceReviewed:true`, `liabilitiesReviewed:true`. Exact reviewed net/tax inputs are capped independently against original invoice components; no tax rate, cancellation percentage or fee rule is invented. Returns `creditId`.
- `approve_credit_note` / `reject_credit_note`: `creditId`, `payloadHash`, `note`, `evidenceReviewed:true`. Atomic independent approval and unique `LOKD-CN-<UUID>` issue; concurrent credits cannot exceed invoice capacity.
- For correction, prepare a new note with `reversesId` pointing to an issued positive note and the exact original net/tax amounts. Approval issues a separate negative credit, retaining both records. Only an unclaimed credit may be reversed. Then prepare a corrected positive credit under a new request key. Once a credit backs a durable refund claim it cannot be reversed or reused, even if delivery is uncertain. Subsequent payment/credit reconciliation needs a distinct approved accounting workflow; the UI must not offer a free edit.

Frontend assignment: wire the existing finance workspace to these endpoints; use issued/current state separately, distinct issue-versus-refund buttons and stable keys. Render a private credit-note layout with original invoice source, signed credit direction, net/tax/total, issue number, predecessor, reason and independently recorded evidence. No printable credit frontend or financial communication is silently claimed complete here. Do not modify the existing shared UI concurrently from this backend patch.

## Migration ordering and shared schema

Apply the existing canonical chain through 0068, then **unnumbered** `docs/migration-proposals/fi-build-06-credit-notes.sql`, then `docs/migration-proposals/fi06-refund-dispute.sql`. Central assigns canonical numbers and schema/journal/snapshots. Earlier FI-06 SQL is not a prerequisite. Generators reproduce both proposals; the refund generator reads the current 0067 invoice-view definition and adds the reversal overlay, retaining all other cases.

Credit schema: credit_notes (immutable original source, request key, direction, original/reversal linkage, net/tax, reviewed policy/tax payload, hash, operator/user/time); credit_note_decisions (one per note, independent identity/auth context); credit_note_issues (one number per approved note). Credit source/balance views and prepare/decision/issue/capacity/immutability guards.

Refund schema: booking_refund_control (seeded off); booking_refund_cases, decisions, claims, observations, receipts, receipt_decisions. Request-key and case-claim uniqueness; reference may have multiple sequential partial claims. Commit guards prevent cumulative excess, credit reuse, unresolved competing claims, duplicate external/provider identity and reused bank evidence. All histories reject UPDATE/DELETE. Sources/current approval/final evidence/accounting/state views; replaces only document_invoice_payment_states additively. Neither historical funding rows nor issued finance rows are rewritten.

The existing assignment fixture explicitly loads the two proposals after the canonical chain. The contract test applies the same order with restricted SQLite limits and checks locks. Remove those two explicit loads when Central adds canonical migrations. Do not import old snapshot commits or overwrite Central's schema.
