# ID-PROVIDER-02 — missing inputs and acceptance boundary

14 September 2026. These are requested specifications/evidence, not invented values and not permission to obtain them by testing people.

## Provider sources consulted

- [Official integration guide](https://www.verifynow.co.za/api-docs/integration-guide): SAID POST body/authentication and full success envelope; describes a 72-hour idempotency window.
- [Official API reference](https://www.verifynow.co.za/white-label/api): SAID, photo, face and liveness are distinct products; its indexed reference says 30-day idempotency. Direct reference navigation redirects to a client-rendered documentation shell. The discrepancy requires provider confirmation; this implementation never relies on either duration to retry.
- [Official Africa verification guide](https://www.verifynow.co.za/api-docs/africa-verification): documented job recovery belongs to that separate product, not evidence of a South African SAID lookup API.
- [Official app integration guidance](https://www.verifynow.co.za/how-to-add-id-verification-to-an-app): separates core ID lookup from remote-person step-up checks. It does not establish LOKD's accepted capture ceremony, assurance policy or fallback decision.

Consulted public documentation/search only; no health, balance, sandbox, production verification or account calls. Search indexes may lag. No SAID read-only recovery contract was found in the consulted material; this is not a claim that the provider cannot supply one privately. No provider wording was accepted on the owner's behalf.

## Exact missing provider/configuration inputs

1. Named product/bundle and account entitlement for LOKD's actual remote applicant route: SAID versus HA photo/facematch, supplied-reference face match and/or liveness; required combinations and permitted fallback when a reference photo is unavailable. R350 registered-officer enrolment price was already approved in the September 11 checkpoint; it is not a missing price approval. Training packages/terms still need actual owner inputs.
2. Accepted capture protocol: hosted session/SDK/API if applicable, session creation/status endpoints, exact request/response schemas, authentication, session-to-owner/applicant/version/consent mapping, challenge/anti-replay binding, supported ID types, image formats/limits, session expiry, abandonment/withdrawal, data retention and deletion. Public POST image parameters alone are insufficient to claim a person-controlled capture ceremony.
3. Accepted composite decision rules: which signals establish the person/ID binding, genuine mismatch/manual/no-record handling, threshold/assurance policy, name/date matching, deceased/reference-unavailable treatment and independent human review scope. No thresholds or automatic fallback were invented. SAID alone remains review-only.
4. Exact production success/decline/manual/no-record/error envelopes for each selected product, including production provenance, request/case correlation, ID/person binding, provider request/transaction reference, source timestamp precision/skew guarantees and any signed receipt/digest fields. The current strict SAID success parser intentionally rejects missing/different fields.
5. **Read-only SAID uncertain-delivery recovery specification:** endpoint/method/authentication; lookup by the original idempotency key/case UUID when response requestId was never received; exact result binding; not-found versus pending versus definitive absence; consistency delay, retention, outage/rate semantics and finality. If webhook-based, supply event schema, signature verification/rotation, replay window/event IDs and correlation. No unsigned callback or invented GET is implemented.
6. Provider resolution of 72-hour versus 30-day idempotency retention; scope per account/product/key, conflict behavior and guarantee of no duplicate charge. No POST retry is enabled while unresolved, even when a key expires.
7. Accepted immutable private capture source and provider-response vault integration: storage backend, explicit allowed reader roles and case-level policy, audited reads, digest/immutability guarantees, withdrawal checks, approved retention/deletion, approved consent/privacy document versions and evidence lifetime/policy reference. Existing general artifact upload/integrity checks do not supply capture acceptance.
8. Later authorized account/product acceptance evidence and secure configuration ownership. This task neither reads nor changes credentials. Existing sandbox observations are not production account acceptance. Real-person/provider acceptance must be separately authorized after remaining build work is finished.

## Applicant-to-completed-service acceptance checklist

| Gate | Local evidence / implemented scope | Genuine input still required |
| --- | --- | --- |
| Account/intake/consent | Existing owner-bound versioned intake tests; new exact capture commitment tests | Intended applicant account, actual reviewed intake, approved consent/privacy versions and genuine capture/consent receipts; accepted capture UI/protocol |
| Identity submission/recovery | New injected transport/D1 tests; registry match stays manual review; uncertain delivery cannot duplicate | Items 1–8 above, actual production source receipt after later authorization, accepted remote-person proof, independent reviewer account |
| PSiRA/officer approval | Existing PSiRA and independent officer source checks; no bypass | Exact genuine registration/name/status/grade/certificate expiry/recheck source/hash and identity linkage; authorized distinct preparer/owner |
| Qualification/service scope | Existing current approved rules, assessments and officer opt-in | Approved rule IDs/versions, exact service/purpose, genuine qualifications/endorsements and assessments/expiry, actual officer's opt-in |
| Private passport/holds | Existing private delivery, currentness/revocation and immutable suspension/disposition tests | Intended officer device possession/recovery acceptance; distinct issuer/reviewer and actual investigation/source findings where applicable |
| Workforce/client/site/funding | Existing reviewed direct-flex connected fixture and activation denials | Owner-selected model/employer; actual current registration, payroll/benefit/insurance/bank/terms evidence as applicable; client/site/post/risk/induction/travel, signatory authority, exact agreements and reconciled funding |
| Activation/check-in | Existing complete-chain fixture and source-change races | Actual roster, availability/outside-work/rest inputs, real-device/site presence/support acceptance and separately authorized controlled enablement |
| Completed service/payroll | Connected fixture includes officer completion, client signoff, independent pay review and consumed payroll history | Actual attendance/completion, client signoff/dispute evidence, pay/tax/deduction/profile policy sources, distinct authorized reviewers and finance acceptance |

Fixture acceptance proves local controls only. It is not genuine provider, person, consent, PSiRA, account, workforce, settlement or service acceptance. All live locks and owner MFA configuration remain unchanged. SAST semantics are already implemented and decided; historical requests to choose UTC/SAST in older handoffs are superseded.

## Remaining build audit and next ownership

- `app/lib/production-evidence.ts:24–29` validates the model/employer type but writes both payroll/benefits statuses as `ready` for every model. `app/lib/workforce-core.ts:103–107` requires `partner_confirmed` for partner. This is a confirmed partner-route contract mismatch. Central should assign an explicit partner-responsibility evidence/action contract and independent tests, after confirming actual responsibility; do not silently switch status strings or choose the pilot model.
- `tests/production-identity-connected.test.mjs` uses Unarmed/commercial_access/direct_flex and seeds surrounding banking/scheduling/client authority fixtures. Its completed-service/payroll pass does not prove managed/partner, training, specialist scope, actual accounts or source acceptance. Current officer approval still needs owner-bound identity and PSiRA regardless of a selected intake label.
- Shared start/recovery routing is still provider-unconfigured; capture storage/UI, accepted biometric/composite decision, upstream recovery and narrower private evidence download remain unfinished build dependencies, not things closed by a synthetic success.
- No new shared UI/API edits or messages to other tasks were made. This durable endpoint pack is prepared for Central/frontend consumption, not represented as delivered coordination.

Next bounded assignment: Central integrates/reviews this dormant adapter and additive proposal, assigns independent offline QA, obtains the exact selected-product/capture/recovery specifications and local consent/currentness/access policy, then assigns ID-PROVIDER-03 to implement those concrete capture/composite/recovery dependencies and wire shared routing. Do not proceed to genuine provider/person/account acceptance while those build gaps remain. Workforce partner responsibility is a separate bounded Central assignment.

Learning record: public product documentation is enough for a conservative transport, but is not accepted remote-person proof or a lost-response lookup contract. Preserve unsupported responses privately and permanent dispatch claims; resolving uncertainty must never create another submission. Evaluate next against provider-supplied signed/versioned contracts and injected recovery fixtures.
