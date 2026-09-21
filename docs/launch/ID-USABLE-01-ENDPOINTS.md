# ID-USABLE-01 endpoint contract — frontend integration

Contract version: `lokd.identity-workspace.v1`. Implemented in `/tmp/lokd-id-usable`. Browser-safe types and token generation helper: `app/lib/production-identity-contract.ts`. Frontend retains UI ownership; backend owns these routes and guarded transitions. The shared coordination note is `docs/launch/IDENTITY-BACKEND-FRONTEND-CONTRACT-2026-09-14.md` in Central's tree. This document is the tested specification; neither publishing the note nor owner-run tests imply independent/frontend signoff.

## Transport and access

Use `/api/production-identity?scope=operations` on the Operations workspace, and `/api/production-identity` on the Officer workspace. Append GET query parameters with `&` or `?` as applicable. Verified user/email and Operations/owner authority come from the existing server session/principal policy, never client JSON. Operations uses existing MFA controls and the current owner exception; no new exception or account is configured.

POST requires same-origin JSON, at most 64,000 decoded characters. `actor`, `provider`, `operations`, `owner`, `userId`, `outcome`, `bindingHash`, `token` and `rawToken` are rejected as top-level fields. No provider adapter or outcome can be supplied by a browser. All responses use `Cache-Control: private, no-store`, `Referrer-Policy: no-referrer`, and `X-Content-Type-Options: nosniff`.

Errors are `{error:string}`: 400 invalid input; 401 missing session; 403 forbidden role/workspace/origin/MFA; 404 absent or another participant's record; 409 stale, consumed, expired, independent-review or database conflict; 413 oversized request; 503 unavailable storage/accepted provider. Preserve an uncertain request's client key/material until its status is known. Refresh versioned records after conflicts; do not automatically repeat a decision or provider dispatch.

## GET contracts

| Query | Access | Response |
| --- | --- | --- |
| `kind=cases&offset=0` | Operations or exact linked participant | `{contract,cases,nextOffset,workEligible:false}`. At most 50; offset 0–100000. A case has `applicantId`, `ownerUserId`, `applicantVersion`, `intakeStatus`, `publicNote`, `corrections`, current `fullName`, `email`, `city`, `officerId`, `linkedVersion`. Participants see only their linked cases. |
| `kind=case&id=<applicantId>` | Operations or exact linked participant | `{contract,case,identities,psira,intakeEvents,readiness,rereview,deliveries,workEligible:false}`. `case.details` merges validated corrections with original fullName/mobile/city/province/pathway/PSiRA fields and array-valued services/purposes/training. Operations additionally gets `holds`. |
| `kind=review_queue&recordType=<type>&state=pending&offset=0` | Operations | `{contract,recordType,records,nextOffset,workEligible:false}`. `state` is `pending` or `all`; 50 per page. Types: identity, officer, rule, review, passport, disposition, workforce. Summaries include IDs, applicable applicant/officer IDs, preparer/time and decision/state. `pending` means undecided, not necessarily still approvable. |
| `kind=review_detail&recordType=<type>&id=<id>` | Operations | `{contract,recordType,record,decisions,related,holds,current,limits,viewer,workEligible:false}`. `record` uses the existing ledger's snake_case names; `*_json` fields become parsed objects under the suffix-free name (`source`, `evidence`, `payload`, `items`, `optins`, `requirements`). `token_hash` is always omitted. |
| `kind=holds&id=<applicantId>&offset=0` | Operations | `{contract,applicantId,holds,nextOffset,workEligible:false}`; 100 per page. Use this to inspect older holds beyond the first detail page. |
| `kind=deliveries&id=<officerId>` | Exact officer or Operations | `{officerId,deliveries,workEligible:false}`; newest 50. No bearer material or token hash. |

Existing GET kinds remain: `identity` with identity-case ID, `officer` with operational officer ID, `readiness` with operational officer ID, `rereview` with applicant ID.

Review-detail relationships: identity includes newest 50 outcomes and their decisions; officer includes its committed source snapshot and PSiRA event; review includes its policy; passport includes all selected assessment rows and delivery binding; rule/review/passport include direct holds; disposition includes its decision; workforce includes suspension audit events. Source references and hashes are protected Operations data. Fetch another detail by its exact reference where deeper inspection is required. Do not auto-fetch arbitrary evidence URLs or render reference strings as HTML. Blob/capture inspection still needs the accepted protected evidence system.

`current` is the presently accepted/usable state, not a permission to decide a pending proposal. Pending proposals normally have `current:false`; ordinary independent approval remains available when the authoritative guards permit it. `viewer` supplies server-derived `{userId,owner}` for presentation; it is not accepted back as authority. Detail reads are audited immutably as `identity_review_data_access`. Responses are read-time information; every mutation rechecks currentness at commit.

Hold fields are existing `kind`, `hold_id`, `subject_id`, `applicant_id`, `owner_user_id`, `officer_id`, `held_at`, `held_by`, `reason`, plus `attribution` and `humanAudit`. Attribution is `direct_actor`, `linked_human_action`, or `system_only`. For linked workforce actions, humanAudit contains `auditEventId`, `actorId`, `recordedAt` and parsed `detail:{reason,engagementId,sourceVersion}`. The automatic hold's original `system` actor remains unchanged. Older unlinked workforce audit events appear separately in `related.suspensionAudit`; show them as related review history, not a proven cause of that hold. System invalidation may have no attributable human, such as a stale-source cascade; never invent one.

## Added and completed POST actions

| Action | Request fields besides action | Authority / effect |
| --- | --- | --- |
| `correct_intake` | `applicantId, expectedVersion, changes` | Exact applicant in Officer workspace; existing correction whitelist. Returns refreshed case bundle. |
| `withdraw_intake` | `applicantId, expectedVersion` | Exact applicant; irreversible withdrawn intake remains closed. Returns case bundle. |
| `review_intake` | `applicantId, expectedVersion, status, note` | Independent Operations; status reviewed or needs_information. Returns case bundle. |
| `prepare_entity` | `applicantId, applicantVersion` | Independent Operations; existing production intake reconciliation. Returns entityId, grantsAccess:false, workEligible:false. |
| `request_information` | `applicantId, expectedVersion, message` | Existing independently authorized intake review action; refresh case afterwards. |
| `request_passport_delivery` | `officerId, requestKey, tokenHash` | Exact officer in Officer workspace; current reviewed linked version. Returns delivery metadata and workEligible:false. |
| `prepare_passport` | `officerId, officerReviewId, reviewIds, expectedSequence, deliveryId` | Operations preparer. **deliveryId is now mandatory at HTTP boundary.** Returns id, sequence, deliveryId, expiresAt, pendingIndependentApproval:true, workEligible:false. Never returns token. |

Correction fields follow existing signup validation: fullName, mobile, city, province, pathway, psiraStatus, psiraNumber, psiraGrade. Email, roles, identity outcomes, service eligibility and approval cannot be corrected through this action. Initial application and linking still use existing application/signup routes: POST `/api/signup?scope=officer` with `{action:'link',kind:'officer',id,expectedVersion:0}`. Unlinked intake does not have an operational identity approval.

Existing decision/action contracts are unchanged:

| Action | Fields |
| --- | --- |
| `start_identity` | applicantId, applicantVersion, captureReference, consentVersion — accepted provider absent, currently 503 |
| `recover_identity` | id, expectedOutcomeId — read-only accepted-provider lookup, currently unavailable |
| `decide_identity` | id, outcomeId, decision approve/reject, independentlyChecked:true, reason |
| `suspend_identity` | id, reason |
| `prepare_officer` | officerId, applicantVersion, identityOutcomeId, psiraEventId, reason |
| `decide_officer` | reviewId, decision approve/reject, independentlyChecked:true, reason |
| `suspend_officer` | officerId, reason |
| `prepare_rule` | code, label, category core/service/purpose, applicable serviceType/purposeCode, requirements:string[], maxDays, evidenceReference, expiresAt |
| `prepare_review` | officerId, officerReviewId, ruleId, evidence[], sourcesActuallyInspected:true. Each evidence item: requirement, ownerUserId, reference, sha256, checkedAt, expiresAt. |
| `decide_readiness` | kind rule/review/passport, id, decision approve/reject, independentlyInspected:true, reason |
| `set_opt_in` | officerId, serviceType, expectedRevision, optedIn:boolean — exact officer only |
| `hold_readiness` | kind rule/review/passport, id, disposition suspend/revoke, reason |
| `prepare_disposition` | kind identity/officer/workforce/review/passport, holdId, applicantVersion, evidenceReference, evidenceHash, checkedAt, expiresAt, actuallyInvestigated:true |
| `decide_disposition` | proposalId, decision allow_replacement/keep_held, independentlyInvestigated:true, reason |
| `suspend_workforce` | reviewId of approved engagement evidence, reason |

An independent Operations owner is required for officer, readiness and disposition decisions. Identity decisions use the established independent Operations guard. Makers, applicants and other prohibited source reviewers cannot approve themselves. Newly attributable human workforce suspenders also cannot decide the resulting workforce/passport disposition. Disposition permits fresh reviews; it never removes a hold or restores old approval/token material.

## Private token possession and delivery

1. In the signed-in Officer UI call `createPrivatePassportMaterial()`. It generates 32 random bytes with Web Crypto, constructs `lokd_live_` plus 64 hex characters, computes SHA-256 over the exact UTF-8 token, and generates a request UUID.
2. Retain raw `token` privately in the officer's in-memory flow. POST only `{action:'request_passport_delivery',officerId,requestKey,tokenHash}`. Do not put token material in query strings, generic record displays, request-error details, analytics, localStorage/sessionStorage or Operations messages. The backend rejects top-level raw token fields.
3. A request is bound to exact owner, officer and reviewed applicant version, and lasts 24 hours for preparation/approval. Retrying the same key/hash after a lost response returns the same delivery ID. A changed key payload or consumed token hash cannot mint another passport. No credential or encryption key is needed because plaintext is never stored server-side.
4. Operations selects the delivery ID, prepares the exact reviewed passport, and a separate owner approves it. The officer alone has the token. Before approval, it cannot resolve a usable passport. Present the private link only after delivery status becomes `available`. The frontend should use `/verify#token=<token>` (fragment, not query), read/clear the fragment locally, and POST its body to the new read-only verifier described below. Do not send an email or notification from this workflow.
5. Delivery statuses: awaiting_preparation, awaiting_approval, available, unavailable, expired_or_stale. Status has no work authorization meaning. Preparation bindings are immutable and one-use; expired/stale requests and racing corrections or holds fail closed.
6. If raw material is lost, generate new material/request, then prepare a new sequence and independently approve it. There is no plaintext retrieval endpoint. A successfully approved newer passport supersedes the old token; holds and revocation make it unusable. If compromise is suspected, Operations uses hold_readiness immediately. Existing holds still require disposition before replacement. A request's 24-hour expiry does not invalidate an already approved passport; its evidence and hold/revocation rules govern it.

The legacy internal prepareReadinessPassport helper retains its fixture-compatible one-time token return when no deliveryId is supplied. This mode is unreachable through the production HTTP route. Existing historical bearer tokens are not silently changed by this migration; new HTTP issuance must use private delivery.


## Read-only verification without a bearer URL

POST `/api/passport/verify` with `{token,bookingId?,shiftId?}`. This is the deliberate exception to keeping bearer material out of requests: it goes only in this dedicated verifier body, never in the identity endpoint or a server-visible URL. Requires same-origin JSON; token must be `lokd_live_` plus 64 lowercase hex characters; at most 2,000 decoded characters. It returns the existing `{passport}` public summary (including explicit red/revoked status), 404 when absent/superseded/unavailable, 400 malformed, 403 cross-origin and 503 storage failure. All responses are private/no-store, no-referrer, nosniff and noindex/nofollow. There is no audit/scan/arrival mutation or live-enable operation here.

Existing GET `/api/passport?token=...` and its legacy POST scan route remain unchanged for compatibility. New private-delivery UI must use the body verifier. `/verify` currently has a production-stage placeholder and the older component consumes a query parameter; frontend owns updating that presentation to handle the fragment and POST verifier. Backend completion does not assert that this UI change has occurred. Do not use general request-body logging on this dedicated route. No third-party token delivery or production capture call is made.
