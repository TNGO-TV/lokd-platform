# ID-PROVIDER-03 — private provider evidence reader

Local continuation of ID-PROVIDER-02 after Central integrated and hardened canonical0069. Based on Central's clean combined `8b5a9b5` checkout, not the earlier provider branch. Work is isolated on `codex/id-provider-03`. The adjacent durable `ID-PROVIDER-03-DELIVERY.json` records exact base/commit, changed files, patch hash and applicability. Stop here for Central integration.

## Implemented and locally verified

`app/lib/production-identity-evidence-reader.ts` adds a server-only reader for an existing canonical VerifyNow manual-review receipt. It requires an authenticated Operations actor and an explicit injected access policy. It cannot submit checks, recover outcomes, approve identities or change holds. It uses the existing owner/version/current-intake validator, canonical case/receipt records, identity suspension ledger and audit table.

The browser supplies only a case ID to a future Central-owned route. The reader resolves the exact private reference and digest from the receipt, rejects nonproduction/mismatched/expired/future evidence, checks current applicant ownership/version and denies withdrawn or suspended cases. The approved policy must separately authorize this reader, case and purpose and check capture consent/withdrawal. No default policy is supplied. Registry evidence still does not establish remote-person identity.

Before private storage access, an attributable audit records the policy/decision references. The backend receives a server-resolved opaque reference and abort signal; no user URL is fetched. Object case/reference must match, streaming is bounded to1MiB and5seconds, and the returned bytes must match the receipt SHA-256. The full bounded body is buffered before disclosure. Source/currentness and policy are checked again after storage access. A second durable audit is required before returning bytes; failed access after the start audit records a sanitized failure. Logs contain no raw ID, body, vault pointer or credential. `read_ready` means the server prepared a response, not that the human received/read it.

Downloads use an attachment with a constant filename, octet-stream MIME, no-store/private, no-referrer, nosniff and sandbox CSP. They expose no private storage URL. Policy denial before storage is403; absent reader configuration503; missing/mismatched/stale/failed/oversized/timed-out evidence409. Mid-read revocation returns409 without bytes. The enclosing route must retain generic handling of unexpected internal failures.

This is an **active-review reader only**. Suspended/expired/withdrawn historical investigation access is not silently granted. Raw unsupported provider responses that never produced a canonical receipt are also outside this reader's scope. Those require an explicit accepted investigation/retention/access contract. A reference upload or integrity-verified document remains insufficient to create accepted capture/person evidence.

## Central/frontend endpoint contract — proposed, not installed

Reserve a separate same-origin JSON POST `/api/production-identity/evidence` with body `{caseId}` if Central accepts this route shape. Require the existing authenticated Operations host/session/MFA boundary; reject additional fields, actor/provider/URL/evidenceReference/digest assertions. Call `readPrivateIdentityEvidence` only with server-owned policy and private backend. Return its binary Response directly, not through the existing JSON reply wrapper. Keep authentication-loss handling and private cache clearing in the frontend. Do not persist returned bytes in analytics, local/session storage or public object URLs.

The normal identity workspace endpoints and public passport verifier are unchanged. No route currently calls this reader; no policy/backend is configured by this patch. The existing general `/api/evidence` route is not modified or treated as narrower identity authorization. Central/frontend coordination is this published contract; no message delivery is claimed.

Required `IdentityEvidenceReader` dependencies:

- `authorize({actor,binding,evidenceHash,purpose:'identity_review'})` returns an actual server-owned permission decision with `allowed`, opaque approved `policyReference` and `decisionReference`. It must re-evaluate case-scoped reader assignment, current capture consent/withdrawal and the approved purpose at each call. A request-body boolean cannot implement it.
- `open(reference,signal)` resolves the private stored object and returns exact `caseId`, `reference`, and byte stream; it must honor aborts, preserve immutable bytes and never proxy a browser URL. This is storage access, not a provider API lookup. Its production implementation still needs the accepted vault contract.

## Verification and migration intent

Logs under `acceptance/id-provider-03/`:

- `tests.tap`: **43 passed**,0 failed/skipped. Includes8 new adversarial reader tests and existing identity/usable/VerifyNow tests. Cases include exact policy/case binding, no vault access on denial, malformed/stale/sandbox receipts, intake change/withdrawal/holds, wrong object/hash, oversized/stalled streams, policy/source revocation during reads and audit-write failures.
- `canonical.tap`: **12 passed**,0 failed/skipped. Existing ID-01 plus a new actual adapter→canonical receipt→private reader test, attributable audit, unchanged identity verification and suspension denial. Uses the full current canonical migrations. Overlaps the earlier run; do not add counts as a unique suite total.
- `types.log`: TypeScript noEmit/incrementalfalse passed. `lint.log`: targeted ESLint passed without warnings. No build/browser/person/provider/account acceptance claimed.

No migration is required. No canonical schema, applied migration, shared routing, frontend, credential, environment or live gate changed. Central's0069 immutable binding/REPLACE/expiry guards are preserved. No source object or audit history is rewritten. Raw-data backend, consent/access policy and genuine evidence are injected fixtures in the tests only.

## Remaining inputs and next bounded assignment

The latest Central integrated checkpoint and remaining-input register still have no accepted replacement provider/capture contracts. ID-PROVIDER-02-INPUTS.md remains the exact source: selected product/entitlement, accepted remote-person capture/composite decision, full production outcome envelopes, original-key read-only uncertain-delivery lookup, idempotency retention resolution, approved consent/currentness/private storage policies and later genuine account/person/PSiRA evidence. R350 is already approved; no price question is reopened. SAST is decided. Partner responsibility is still a separate Central workstream, not chosen here.

Next: Central independently reviews/integrates this module and obtains the exact private vault/access policy. Then wire the concrete storage/policy backend and the protected route/frontend download, with access-loss and device/privacy QA. Capture/composite identity and upstream recovery remain separate unfinished build dependencies; this reader does not make the provider integration complete. No live testing until the agreed build is complete and separately authorized.

Learning: ordinary Ops document access and possession of a provider reference do not establish permission to disclose identity material. Resolve sources server-side, buffer and verify before releasing any bytes, audit attempted/ready states accurately, and repeat authorization after slow private I/O. Future evaluation must use the actual approved policy/backend, not infer acceptance from these fixtures.

## Central review correction

Expected source-domain errors during initial receipt validation now return the documented generic409 instead of leaking the identity helper's404 wording. Independent focused8 tests passed after this correction. Unexpected internal errors still require the enclosing route's generic handling. No route or policy/backend was installed.
