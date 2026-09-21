# ID-01 — Central Command integration handoff

Checkpoint: implementation and isolated-fixture validation complete; genuine production provider/person acceptance remains outstanding. No production identity or eligibility has been granted. Stop here; ID-02 is not implemented.

Base: `14448dd15fa80fc19a3f2052462ae566ab35a2fd`. Isolated clone: `/tmp/lokd-id01`, branch `codex/id-01-production-identity`. Original checkout and its five frontend edits/untracked launch documents were left intact. Repository ancestor instructions and the launch plan/handoffs were read before implementation.

## Delivered code and integration boundary

- `app/lib/production-identity.ts`: server-only commands to start/read/reconcile/review/suspend identity and retrieve the current evidence contract. Reuses `identityCase`, `SignupActor`, `SignupError`, and the existing hash helper. The sandbox adapter and all PSiRA controls remain separate and unchanged.
- `migrations/pending/ID-01-production-identity.sql`: additive proposal, deliberately outside the applied migration directory. Four immutable ledger tables, source/sequence/independence/freshness/replay guards and `current_production_identity_evidence` view. Central allocates the migration number, Drizzle schema and journal entries, and shared routing. No applied migration was edited or executed on persistent storage.
- `tests/production-identity.test.mjs`: in-memory SQLite/D1 fixtures apply the existing migration chain plus this proposal. Synthetic provider implements only the injected test port. No provider network, account fixtures, production database or credentials are used.

No public API or frontend was mounted: shared routing is release-owned. Wire these commands behind the existing middleware-authenticated actor, same-origin JSON protection, request-size limits, private/no-store replies and Operations authorization. Never accept an actor, provider object, normalized outcome, hash, provider URL or evidence conclusion from request JSON. Map database CAS/guard failures to a safe conflict response. The default missing adapter returns 503. No live adapter, configuration flag or credential has been installed.

## Behavior

Applicant capture binds the authenticated owner, exact intake ID/version, immutable private capture reference, consent version and capture digest. The trusted provider adapter must verify that binding before returning a capture digest. The ledger stores opaque private references and digests, not ID numbers, images or biometrics. Participant reads omit evidence references and digests; internal evidence retrieval is server-only.

The atomic case + pending outcome insert is the sole dispatch claim. One case per application/version and one use per provider/capture prevent duplicate dispatch. Concurrent starts return the winning case. Crash, timeout, malformed/mismatched response and failed persistence retain a durable held claim. Repeated start never resubmits it. Unresolved prior-version cases also block new-version submission.

Recovery is an Operations-only exact-case lookup, never a submission or a caller's `noResultConfirmed` override. Null/404/timeout never proves no delivery and never permits replacement. Old-version/withdrawn cases may be looked up to settle uncertainty but cannot become current evidence. Recovery attempts retain actor/outcome references in the existing audit ledger. Result successors use sequence CAS; concurrent recovery commits one successor. Reconciliation creates a new outcome needing fresh review. A provider reference cannot be reused by another case under the same provider.

Only explicitly normalized production `verified` results can be approved. `declined`, `no_record`, `manual_review`, `unavailable`, `pending` and `delivery_unknown` remain unverified. Sandbox/unsupported outcomes and wrong owner/application/version/case/capture/digest/provider are rejected. Evidence must have a valid digest, private source reference, provider reference, check time at or after case creation and a future expiry. Provider timestamps must therefore describe this specific capture/check, not an older identity lookup.

Independent Operations review binds an exact outcome ID. Neither the applicant nor the actor who recorded the outcome (including recovery operator) may approve it. Source changes, withdrawal, expiry, superseding outcomes and suspension remove the current evidence view. Database guards enforce source/version and outcome freshness at review commit. Suspension is retained permanently for that case; no history is deleted or overwritten.

## ID-02 consumption contract — `lokd.production-identity.v1`

`productionIdentityEvidence(db, applicantId, applicantVersion, ownerUserId, deadline)` returns null unless the exact tuple has current approval valid through the requested future deadline. Otherwise it returns the view row, a deterministic digest of that returned row, contract version and `workEligible:false`.

The view row contains identity case ID, applicant ID/version, owner user ID, provider key, binding hash, private capture reference, consent version, creation time, latest outcome ID/sequence, provider reference, private evidence reference/hash, check/expiry time, independent reviewer ID/time. This is identity evidence only: no registration, officer approval, assessment, qualification, workforce readiness, passport or activation conclusion.

ID-02 must join `current_production_identity_evidence` **inside its guarded commit**, matching the exact applicant/version/owner and the selected outcome ID and checking validity through its deadline. An earlier helper response/hash is not a commit authorization. Bind the current reviewed intake and production entity link at that same commit. Reuse current `psira_verification_cases.latest_event_id`, `verificationState` and existing grade/certificate/recheck controls; additionally bind the exact PSiRA owner user ID and number to the applicant, rather than treating email matching alone as person identity. Require a distinct bridge reviewer and retain identity outcome and PSiRA event IDs in the bridge evidence. Do not create readiness from a registration declaration.

When the bridge starts producing activation-consumed records, Central must connect identity changes/suspension and PSiRA/intake changes to the existing activation evidence epoch and suspension controls. This checkpoint creates no operational records, so no activation gate was changed here.

## Genuine inputs and acceptance still required

1. Approved provider production API contract: authenticated capture, exact subject binding, affirmative consent version, private immutable evidence access, production-vs-sandbox provenance, outcome mapping, stable request reference and read-only reconciliation semantics. Existing VerifyNow sandbox classifications are not evidence of these production capabilities.
2. Accepted adapter and actual account entitlement. Verify real capture, wrong-person denial, negative/review outcomes, timeout/replay recovery and evidence access with intended accounts. Never pass fixture output to production or infer acceptance from these tests.
3. Authorized evidence validity/refresh and retention rules, provider/privacy review and real applicant consent text. The engine checks supplied temporal validity but does not invent a legal or provider-approved maximum age.
4. Intended applicant, recovery operator and independent reviewer accounts. Fixture separation does not accept real provisioning or least privilege.
5. Central integration and independent QA of routing, database guards and protected evidence retrieval. No browser/live-provider acceptance was run. Permanent case suspension and same-version reissuance need the bounded ID-04 lifecycle design; no override/retry UI is supplied.

## Next bounded assignment

ID-02: implement the independent officer approval bridge consuming this exact identity contract, current reviewed intake and current owner-bound PSiRA event. Prepare additive migration intent and isolated stale/mismatch/expiry/racing-commit tests. Do not issue qualifications/passports, enable live check-in, fabricate evidence or deploy. Central first accepts the proposed contract and integration order.

## Validation receipt

- Production identity fixtures: **10 passed, 0 failed, 0 skipped**.
- Existing applicant identity/related sandbox workflows: **10 passed, 0 failed, 0 skipped**.
- Existing PSiRA verification fixtures: **5 passed, 0 failed, 0 skipped**.
- `npx tsc --noEmit --pretty false`: passed.
- Targeted ESLint for the new module and fixture suite: passed.

Run each fixture file with `node --experimental-loader=./tests/cloudflare-loader.mjs tests/<name>.test.mjs` from this checkout. Full release build/browser/regression acceptance belongs to Central after integration; these results do not assert it. All fixture databases were in memory. The first implementation run exposed a SQL placeholder-count defect; it was fixed before the passing receipt. Adversarial review also added cross-version uncertain-delivery blocking and recovery-maker separation. Reusable lesson: a fresh intake version must not serve as a retry key for an unresolved external operation.
