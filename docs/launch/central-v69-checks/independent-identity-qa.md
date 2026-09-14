# ID-PROVIDER-02 independent QA — 14 September 2026

**Final disposition: ACCEPT corrected dormant adapter and canonical0069 local scope. All findings below were corrected and independently reverified; historical findings are retained.** The transport is dormant and cannot produce verified outcomes. These findings concern durable storage invariants, not a demonstrated public API exploit or live-provider submission.

Reviewed owner checkout `/home/ammosync/.codex/visualizations/2026/09/13/01a09c3c-0e07-7132-88c8-123a1dbfc216/id-provider-02`, commit `dd88326`, base `c358358d`. Read-only review; no owner source/config changes or network/provider/Sites calls.

## Findings

### P2 — permanent claims and immutable receipts can be replaced

`docs/launch/proposals/ID-PROVIDER-02.sql:22–27` relies on BEFORE UPDATE/DELETE triggers. With SQLite `recursive_triggers=0`, `INSERT OR REPLACE` removes conflicting rows without firing those DELETE triggers. Independent offline probe replaced both an existing claim's request hash/policy/lifetime and an existing receipt's provider reference. A unique provider-reference conflict also permits REPLACE to delete another case's receipt unless explicitly guarded before insertion.

Correction: explicit BEFORE INSERT conflict protection for both claim case ID and receipt case ID/provider reference, independent of recursive-trigger settings. Preserve adapter's expected duplicate claim behavior (`claim` false, no POST): a trigger may ignore an *exact existing claim* while rejecting conflicting binding/request/policy metadata, or adapt server insertion consistently. An exact duplicate claim must never change stored metadata. Receipt save can reject every duplicate; its interface does not require replacement.

Required fixtures under `PRAGMA recursive_triggers=OFF`: same-case claim REPLACE with changed hash/policy; same-case receipt REPLACE with changed reference; second-case receipt REPLACE with first-case providerReference; normal concurrent claim still produces one POST; UPDATE/DELETE still rejected. Assert original rows byte-for-byte unchanged after each attempt.

### P2 — claim SQL does not bind to the persisted production identity case

`ID-PROVIDER-02.sql:4–12` checks only valid JSON and optional equality of JSON caseId to FK case_id. `verifynow-receipts.ts:12` enforces exact source in its INSERT SELECT, but the database does not. The receipt trigger at proposal lines28–42 compares against the claim's JSON, so it accepts a receipt matching a forged claim even when claim applicant/version/owner/capture contradict the real case. The independent probe inserted this pair successfully.

Correction: null-safe BEFORE INSERT claim check joined to `production_identity_cases`, with exact mappings:

| Claim | Existing case |
| --- | --- |
| `case_id`, `binding_json.caseId` | `id` |
| `binding_json.applicantId` | `applicant_id` |
| integer `binding_json.applicantVersion` | `applicant_version` |
| `binding_json.ownerUserId` | `owner_user_id` |
| `binding_json.bindingHash` | `binding_hash` |
| `binding_json.captureReference` | `capture_reference` |
| expected literal provider `verifynow-said-production-v1` | `provider` |

Require non-null case PK, JSON object and required typed fields, positive integer applicant version, and complete SHA256 request/binding hashes. Consent version is committed inside bindingHash by the adapter; it is not separately present in IdentityBinding. Do not invent a new `binding_json.consentVersion` requirement without changing that port. If adding current-intake checks at this boundary, follow existing case join: `signup_cases.kind='officer'`, `source_id=case.applicant_id`, `version=case.applicant_version`, `owner_user_id=case.owner_user_id`, status not withdrawn; distinguish enduring historical receipt retention from authorization for a new dispatch.

Required direct-SQL fixtures: absent/wrong provider case, wrong/missing applicant/version/owner/hash/capture/caseId, JSON array instead of object, null PK and null required JSON fields. A FK proves the case exists; it does not prove the embedded person binding.

### P2 — malformed receipt can permanently occupy its one-shot slot

Proposal receipt shape checks/trigger omit required evidenceReference/evidenceHash/checkedAt/expiresAt. An object with bound person fields, production provider, manual_review and a providerReference but **no evidence or dates** was accepted. Missing JSON caseId can also evade a CHECK because SQLite CHECK permits NULL. Runtime `validReceipt` rejects these records later, so this does not promote bad evidence, but the immutable slot is already poisoned and cannot be repaired safely.

Correction: receipt insertion must require a complete typed IdentityResult, null-safe exact case/binding, production/provider/manual_review literals, opaque provider/evidence references,64-character lowercase hex evidence hash, parseable ordered timestamps and non-null recording timestamp. Persisted source-policy constraints should cap expiresAt by checkedAt plus claim evidence_lifetime_ms (allow appropriate SQLite timestamp precision), and checkedAt must not predate the originating case/dispatch. Keep historical expired rows immutable; do not make ongoing validity a storage UPDATE requirement. Runtime currentness/capture validation remains required at use time. Capture expiry is not separately available to SQL; do not invent it there or treat SQL checks as replacing trusted capture reads.

Required fixtures: omit/null/mistype each mandatory field; malformed hash/reference/dates; expiry before checkedAt or beyond claimed policy; verified promotion; correct complete receipt accepted once. SQL cannot verify raw vault contents; retain evidence-vault integrity/access prerequisites explicitly.

## Passing bounded behavior

- Adapter uses fixed HTTPS endpoint, no redirects,25-second abort signal,1 MiB streamed response cap, injected transport for fixtures and explicit policy configuration. Claim commits before network; concurrent submit test produces one POST. No provider retry or guessed upstream lookup is supplied.
- Capture fixed-field digest binds ID, applicant/version/owner/reference/consent/time; rereads before request, after response and on lookup. Trusted capture implementation must still enforce current ownership/intake/withdrawal; no capture ceremony is included.
- Strict success normalization checks product/production/echoed ID/status/reference/provider timestamp; result remains manual_review. Existing independent identity gate denies approve-to-verified. Registry match is not person proof.
- Local receipt recovery restores a result after projection crash without network. Missing/expired/unsupported capture/result remains held. Unknown delivery before durable receipt is explicitly unresolved.
- Raw response bytes are passed to private vault before normalization, including unsupported response; no raw ID or body enters normal result/claim fields. Vault/capture implementations and narrower private access are absent by design; no production route imports this adapter.

## Actual tests and evidence

Independent authorized offline command:

`node --experimental-loader=./tests/cloudflare-loader.mjs --test tests/verifynow-production.test.mjs tests/production-identity.test.mjs`

**23 named tests passed,0 failed/skipped/cancelled**,8.114 seconds. Log `/tmp/lokd-id-provider-02-independent-tests.log`. Existing tests do not cover the identified INSERT OR REPLACE/direct claim/receipt-shape gaps.

Independent Python SQLite probes used proposal unchanged, foreign_keys=ON, recursive_triggers=0, and the same minimal production_identity_cases shape used by owner's adapter fixture. They proved forged claim+receipt accepted, malformed receipt accepted, and both immutable tables replaceable. Results `/tmp/lokd-id-provider-02-sql-probes.json`. Initial probe completed SQL actions but failed writing its result due to a local Python Path-name typo; corrected identical isolated probe wrote the retained evidence. No fixture touched production data.

## Integration disposition

Central may import incremental source for local correction, but must not label checkpoint accepted until corrected migration proposal/canonical schema and meaningful negative tests receive independent QA. Assign additive migration after current integrated head; preserve earlier applied migrations, canonical schema/journal/snapshot and regenerate current readiness manifest. Verify proposal under restricted SQLite statement limits/foreign keys and immutable pre-existing data.

Keep production routing unconfigured. Accepted capture/person-composite contract, private capture/vault authorization/retention, upstream uncertain-delivery recovery and provider entitlement remain full-build blockers independently of these SQL fixes. No live testing or deployment is authorized by this report.

## Central correction first re-review

Canonical0069 initial correction closes initial forged-claim and REPLACE paths by insert-time guards. Restricted SQLite replay, table/snapshot column parity, expression index and journalidx69 checked successfully. Acceptance remains pending: null-safe receipt caseId/type, reference leading-character parity and immutable claim policy expiry bound still needed. Independent probe accepted a receipt missing caseId and expiry ten years beyond checkedAt under30second policy. Duplicate JSON keys also require rejection to avoid SQLite first-key versus JSON.parse last-key disagreement. These follow-ups were sent to Central before another test run; no redundant passing suite was rerun on an already known incomplete correction.

## Final Central correction acceptance

Reviewed Central checkout after imported checkpoint18394f1, with canonical0069 and latest ISO timestamp guards. All reported SQL findings are resolved in the reviewed scope: explicit insertion guards stop same-case/provider-reference REPLACE; claims bind exact case fields/provider; complete unique JSON key sets reject omission/duplicate/extra fields; receipt binding, opaque reference format, hash shape, canonical ISO dates and immutable claimed-policy expiry cap are enforced. Currentness remains a runtime use-time check, preserving historical expired receipts.

Independent results:

- Corrected canonical adapter/ID-01 suite:25 named tests passed,0 failed/skipped/cancelled,8.625s. `/tmp/lokd-id-provider-02-corrected-independent-tests.log`.
- Subsequent narrow ISO-date correction:2 affected named tests passed,0 failed/skipped,111ms. `/tmp/lokd-id-provider-02-iso-independent-tests.log`. This is a focused run, not another full suite claim.
- Independent final SQL probe script `/tmp/lokd-id-provider-02-final-probes.py` rejects all14 omitted receipt fields, forged claim, excessive expiry, malformed reference, duplicate key, Julian-date timestamps and claim/receipt REPLACE; original rows retained. Results `/tmp/lokd-id-provider-02-final-probes.json`.
- All70 canonical migrations replay under repository restricted SQLite limits. All7 proposed/canonical trigger definitions match exactly.
- Canonical tables/snapshot columns/FK/index declarations align; expression index is executable SQL rather than a quoted column-name string. Journalidx69/tag match. Readiness manifest check passed1,190 objects through0069.

Acceptance does not cover full build, runtime/provider wiring, capture ceremony/person proof, actual private vault integration, upstream uncertain-delivery lookup, deployment or live acceptance. Earlier external/specification blockers remain. No reviewer source/config changes or network calls occurred.

Final reviewed hashes:
- `drizzle/0069_verifynow_receipt_guards.sql`: `7a3a72417bd42b26c43ab2bbbf0528fedf3871f7519b3cc6fb55b35de59e9bb6`
- `docs/launch/proposals/ID-PROVIDER-02.sql`: `5380652386b9ca412f85aadb439163ec07088f4c5b6fa2399f1c165895333442`
- `db/schema.ts`: `b61652ec81d7ae24a969850a3071413ba36f3e0e0779bc0d7aea38ea9b8e4781`
- `drizzle/meta/0069_snapshot.json`: `d54f363af7d8f365d85a36f2282fa42c7466689fc523dad453df58e605af543b`
- `tests/verifynow-production.test.mjs`: `f939a2a6792f4d5ef82819112600ac8de959ba6837bca93da6374740a4f76584`
