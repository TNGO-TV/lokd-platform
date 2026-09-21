# Identity backend/frontend coordination — 14 September

Backend owner is implementing in `/tmp/lokd-id-usable`, branch `codex/id-usable-backend`, preserving Central's combined tree. This coordination note is the only shared-tree addition. No frontend files will be edited. Backend implementation and tests are complete. The final contract is `/tmp/lokd-id-usable/docs/launch/ID-USABLE-01-ENDPOINTS.md`; acceptance checklist and handoff are beside it. Frontend integration/signoff remains outstanding. No thread-message tool is available; this shared note is the coordination channel, not a claim of delivered task messaging.

Use `/api/production-identity?scope=operations` for Operations and `/api/production-identity` on the Officer workspace. Existing verified-session, host, Operations/MFA policy and same-origin JSON checks remain. All responses private/no-store.

Implemented additions (see the final contract for complete response shapes):
- GET `kind=cases&offset=0`: bounded case discovery; Operations sees officer intake, participant sees only their own linked intake. Returns `{cases,nextOffset}` plus contract version.
- GET `kind=case&id=<applicantId>`: owner/Operations status bundle, current intake version, linked officer ID, identity IDs/outcomes, owner PSiRA IDs, readiness and disposition status. No private evidence or bearer hashes for participants.
- GET `kind=review_queue&recordType=identity|officer|rule|review|passport|disposition|workforce&state=pending|all&offset=0`: Operations-only review references and summary metadata.
- GET `kind=review_detail&recordType=<same>&id=<recordId>`: Operations-only protected evidence pointers, source snapshots, decisions, holds and attributable human audit. Evidence references are data, never automatically fetched or rendered as executable content. Decisions still recheck authoritative currentness/separation at commit.
- POST `correct_intake`: `{applicantId,expectedVersion,changes}` (applicant only); `review_intake`: `{applicantId,expectedVersion,status:'reviewed'|'needs_information',note}` (Operations); `withdraw_intake`: `{applicantId,expectedVersion}`; `prepare_entity`: `{applicantId,applicantVersion}`. Existing correction/intake services remain authoritative.
- Existing request_information, prepare_disposition, decide_disposition, identity/officer/readiness decision and suspension actions remain; exact request fields follow existing exported backend types.

Private passport possession/delivery:
1. Officer browser generates `lokd_live_` plus 64 lowercase hex characters from 32 Web Crypto random bytes. Keep raw token private; do not send it to Operations or save it in analytics, URLs or generic record components. Compute SHA-256 over the exact UTF-8 token.
2. Officer POST `request_passport_delivery` with `{officerId,requestKey:<uuid>,tokenHash:<sha256 hex>}`. Only hash crosses this endpoint. Same key/payload is retryable after a lost response. Response includes `deliveryId` and request expiry; no raw token. Retain raw token securely for the officer; no backend retrieval of plaintext exists.
3. Operations POST existing `prepare_passport` plus `deliveryId`; endpoint now requires it and does not return a bearer token. Ordinary separate approval via decide_readiness is still required.
4. GET `kind=deliveries&id=<officerId>` returns metadata/status only. Officer activates the public passport link locally using their token only after issuance is current. A lost local token requires a fresh request/new sequence/independent approval. Expired or stale requests cannot issue; revoked or superseded tokens never revive.

Frontend owner: use this file and final backend endpoint contract in the isolated checkout to align field names. Do not present fixture acceptance as genuine identity/PSiRA/pilot eligibility. The actual provider adapter remains unavailable (503); no client-supplied outcome is accepted.

Final additions: GET `kind=holds&id=<applicantId>&offset=0` gives Operations paginated human provenance. `app/lib/production-identity-contract.ts` supplies browser-safe request types and `createPrivatePassportMaterial()`. POST `/api/passport/verify` accepts `{token,bookingId?,shiftId?}` in its body and has no mutations; use `/verify#token=...` and frontend fragment handling, not the legacy server-visible token query. The existing production `/verify` placeholder is frontend-owned and was not changed. This is the dedicated verifier exception to never sending raw material to the identity API.

Delivery receipt: backend commit `5e5e9c078c5c6287b75727532bef1fd22fdbdeef`; integration patch `/tmp/lokd-id-usable-01.patch`. Read-only `git apply --check` passed against Central's current combined tree. All 582 original snapshotted source files remained unchanged. Backend checkpoint stopped; frontend implementation and independent integrated acceptance remain with their owners.
