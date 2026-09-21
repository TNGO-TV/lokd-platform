# ID-PROVIDER-02 — server and frontend contract

14 September 2026. Base: `c358358d6ad1ad59ba2f8e39513928c343e5736b` (v69 review release). **Partial provider implementation, not completed production integration or person acceptance.** Central owns routing and canonical schema. Existing provider-unconfigured 503 stays in place.

## Implemented server port

`createVerifyNowProductionProvider` in `app/lib/verifynow-production.ts` implements the existing `ProductionIdentityProvider` port under key `verifynow-said-production-v1`. It supports the documented SAID POST with explicit production mode, fixed host, no redirects, a 25-second abort signal and a 1 MiB streamed response limit. It never imports the sandbox adapter/fixtures. Its transport is injected in tests; no provider request was performed.

The capture store returns a private immutable record: exact applicant ID/version, owner user ID, capture reference, consent version and evidence reference, production environment, 13-digit ID, capture time and expiry. The fixed-order SHA-256 commitment includes every field. Capture is reread before submission, after response and at recovery. The store contract requires checking current ownership/intake, consent withdrawal and access authority on every read. This port does not implement a capture ceremony or establish remote-person proof. A user-uploaded artifact, Ops integrity check or browser assertion cannot supply that proof.

Configuration requires server-owned `apiKey`, `captures`, `receipts`, `evidence`, an accepted `policyReference` and explicit positive `evidenceLifetimeMs`. No policy lifetime, consent wording, provider endpoint or capture store is taken from JSON. The current runtime is not configured by this change. An existing key used for sandbox does not establish product entitlement or acceptance.

The durable D1 receipt store checks the exact persisted ID-01 case/provider and atomically inserts one permanent claim before network I/O. The claim stores binding metadata, the explicit policy reference/lifetime and a request/policy hash, not the ID or response. Its stable idempotency key is the existing case UUID. A duplicate, expired provider key, timeout, crash, 409 or failure cannot create a second POST. Claims do not expire. Unique immutable receipts prevent replacing a provider reference or attaching it to another case.

The evidence vault must durably retain the bounded response bytes under an opaque private reference before a result is normalized. This includes unsupported response bodies for later reconciliation. It must support authorised access, digest verification and immutable case association; no public/signed download URL is returned by the port. Raw ID/response/key never enters the identity ledger or exception text. Oversized bodies are stopped and not persisted.

Only the documented full SAID success envelope is normalized: success, product, production mode and nested environment, exact echoed ID, nonempty requestId, registry statuses, and provider timestamp within the request interval. The requestId is not assumed to echo the idempotency key. Expiry is the earlier of capture expiry and provider timestamp plus the explicit local policy lifetime. This expiry is a local currentness cap, not an invented provider expiration. Clock skew, missing timestamp and other envelopes remain held; no undocumented tolerance is supplied.

**Registry success becomes `manual_review`, never `verified`.** The port deliberately cannot supply the remote-person identity assertion required by the ID-01 approval gate. The existing gate also prevents an operator manually approving this review-only outcome. Decline, in-review and no-record shapes from other products or sandbox are tested as unsupported; they do not become accepted production negatives without an exact product envelope. HTTP errors and unsupported bodies leave `delivery_unknown` through the existing start workflow. These distinctions must be visible to Operations, not described as a completed identity check.

## Recovery

`lookup(binding)` reads the durable local receipt only. A stored result can restore ID-01 projection after a crash between receipt save and outcome append. Missing receipt returns null; invalid/expired capture or receipt rejects; existing recovery catches lookup failures without erasing prior evidence. Neither path uses network or resubmits. A timeout after the provider accepted a request but before a receipt was saved is **not resolved** by this code. It remains held pending an accepted upstream read-only recovery contract. A persisted raw body without a normalized receipt also requires reconciliation, not an automatic status upgrade.

Do not borrow the Africa product's job lookup, repeat SAID POST as lookup, turn an HTTP error into a fabricated no-record result, or change the case/provider reference to escape uncertainty. Existing independent recovery authority, outcome compare-and-swap, immutable holds, corrections, officer/PSiRA currentness and token revocation stay in force.

## Frontend and Central routing

No new public endpoint or request field is introduced. Keep `docs/launch/ID-USABLE-01-ENDPOINTS.md` as the integrated workspace contract.

| Existing endpoint/action | Input/response and UI handling |
| --- | --- |
| `POST /api/production-identity`, `start_identity` | Applicant session; `applicantId`, `applicantVersion`, opaque `captureReference`, exact `consentVersion`. Server-owned capture must exist first. Current route returns 503 because no trusted capture/provider is installed. Preserve entered state; never offer sandbox verification as a replacement. |
| `GET /api/production-identity?kind=identity&id=…` | Existing summary: `id`, applicant ID/version, production mode, outcome/outcomeId, identityVerified and workEligible. No raw ID, vault object, credentials or bearer token. |
| `POST /api/production-identity?scope=operations`, `recover_identity` | Independent Ops; `id`, `expectedOutcomeId`. Current route remains 503. With accepted configuration, lookup-only recovery returns the existing summary; unresolved stays unresolved. Refresh on conflict. |
| Protected `review_detail` for identity | Reuse current audited Ops review metadata access. A reference is not the underlying provider evidence. Do not add public links or treat reference possession as authorization. |
| `decide_identity` and later officer/readiness/passport actions | Existing independent/current-source checks unchanged. A SAID manual-review result has no approve-to-verified shortcut. Never show work eligibility from registry success alone. |

Central wiring, **only after the dependencies and product scope are accepted**: instantiate `verifyNowD1Receipts(env.DB)` and the provider with server-owned capture/vault/config; pass that same provider to the existing final optional argument of `startProductionIdentity` and `recoverProductionIdentity`. Resolve it inside those two action branches, not globally, so missing config cannot break unrelated reads/corrections/holds. Preserve the current same-origin/session/role/MFA/error boundary. Do not pass any provider/config/outcome from request JSON. No routing patch is supplied that could enable chargeable partial checks by merely finding an existing credential.

Existing `/api/evidence` is reusable infrastructure, but its current GET requires Ops generally, does not enforce the stored access class, and does not record a per-download audit. It accepts user-submitted uploads and verifies object integrity, not capture/person authenticity. Central must provide the accepted narrower private capture/provider-evidence storage/access integration before using it for this material. This checkpoint does not relabel those artifacts as identity evidence.

## Additive migration intent

`docs/launch/proposals/ID-PROVIDER-02.sql` is unnumbered. Apply after the existing production identity case schema, already in the base's 69 numbered migrations. Central adds canonical Drizzle definitions and journal/snapshot entries. Tables: permanent claims (`case_id` PK/FK, binding JSON, request/policy hash, policy reference/lifetime, claim time); immutable receipts (`case_id` PK/FK, normalized result JSON, recorded time), unique provider-reference index, exact binding trigger and no-update/delete triggers. No raw ID/biometric/body/key column, data backfill, seed evidence, changed existing table or applied-migration rewrite. Deploying the schema alone must not configure a provider or enable submissions.
