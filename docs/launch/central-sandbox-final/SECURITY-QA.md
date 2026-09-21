# Independent identity/session sandbox QA — 15 September 2026

Verdict: ACCEPTED for the reviewed identity isolation, private evidence, finance-training source/hold, session-revocation and intake/webhook boundaries. No actionable defect found in this bounded review. Central owns remaining selectors, canonical wage migration, installation isolation, complete frontend and whole-build acceptance.

## Reviewed source

Delivered identity candidate6f8857e and merged root source: worker/clerk-auth.ts; sandbox identity/application routes; sandbox-completion-policy, sandbox-identity, sandbox-identity-store, sandbox-training-finance, sandbox-read/application; production-identity-evidence-reader; finance webhook boundary; dedicated sandbox migration guards. Existing finance review findings and fixes remain separately recorded.

Identity actions select guarded SANDBOX_DB explicitly and never replace global DB. Prelaunch, enablement, separate binding and exact installation policy hash are required. The primary marker blocks aliasing to the installed sandbox. Production-shaped records are reused only inside the isolated sandbox; endpoint results explicitly label simulator and deny production identity/work eligibility. Private capture accepts a fixed synthetic field set, binds current owner/applicant/version/consent, and refuses real-data field additions. Withdrawal, expiry, mismatched binding and uncertain dispatch retain fail-closed behavior.

Evidence source extension is injected server-side, not accepted from request JSON. Case-scoped independent owner grants, reader Operations permission, consent/currentness/retention checks, hash verification, bounded buffering and repeated postread authorization precede byte release. Download stays attachment/private/no-store and carries simulator mode. Reusing the production reader does not make simulated identity evidence production proof.

Finance training import requires the applicant's current usable paid entitlement plus a separately approved matching completion and current officer link. Purchase alone remains unqualified. A distinct practical assessor and readiness reviewer are required. The insertion fence covers finance records/evidence/conflict changes; subsequent linked versions, observations or conflicts atomically revoke imported qualification sources and create retained readiness holds. Fixture tests prove no primary finance records are created.

Clerk still verifies signed token, expiry and trusted origin before checking authoritative session ID/user/status/expiry. Revoked, ended, expired, mismatched and malformed sessions cannot forward caller identity. Backend session lookup failure returns private no-store503; it does not fall back to token-only authentication. Forged headers are stripped before verification. This introduces an authenticated-request Backend API dependency; local and owner-hosted evidence establish correctness, not production capacity/latency.

Sandbox intake accepts the signed-in designated synthetic email only and passes the isolated database explicitly to reused intake handlers. Server identity fields are rejected; privileged operations retain existing role/host/MFA checks. Anonymous finance callback remains simulator-HMAC authenticated, environment/config gated before body read and bounded in bytes. No external Paystack mapping is implied.

## Fresh independent local checks

Direct Node strip-types plus tests/cloudflare-loader.mjs, no browser/provider/account execution:

- tests/clerk-access.test.mjs:5 named tests passed.
- tests/sandbox-identity.test.mjs:5 named tests passed, including actual mounted identity route/privacy and negative isolation/currentness cases.
- tests/sandbox-training-finance.test.mjs:2 named tests passed, including finance revocation and later payment evidence atomically holding assessed readiness.
- Three additional injected-client branches passed: authoritative session lookup outage returns503, different session ID is anonymous, nonfinite expiry is anonymous; zero user lookups/network calls in these failures. These supplement existing revoked/user/expiry assertions.

Total12 named tests, zero failures/skips, plus3 explicit negative branch checks. No source edits or fixture servers by this reviewer.

## Owner-supplied historical external evidence verified

Evidence root: identity-sandbox-completion/acceptance/sandbox-completion in the delivered owner checkout. Verified named passing entries and runner source, not fresh remote execution:

-13 distinct hosted development scenarios:7 portal/security,3 sign-up/revocation/actual token expiry,1 connected UI,1 private identity journey,1 local virtual-host routing. The final hosted-central-final.log5passed rerun overlaps those scenarios and is not added to the count. The7 include an anonymous forged-header scenario; this is13 scenarios, not13 separate accounts. Earlier failed runs remain present.
- verifynow-external.json contains8 distinct actual-provider-sandbox attempts with timestamps, HTTP statuses and receipt hashes: id-found200/mock_approved, id-no-record502/no_record, id-unavailable502/unavailable, face-reference200/mock_approved, face-upload200/manual_review, liveness200/mock_approved, document-ocr200/mock_approved, drivers-licence200/mock_approved. Runner uses fixed VerifyNow external endpoint paths, forces sandbox body mode, synthetic inputs and one request per scenario without automatic retry.
-74 published acceptance files scanned for long secret-key and JWT patterns; zero matching credential patterns. This is a bounded artifact scan, not proof of every possible sensitive string being absent.

These are owner-supplied historical tests. They support development session/revocation behavior and reachable VerifyNow sandbox product responses. They do not establish production identity accuracy, genuine capture/person/qualification evidence, external Paystack acceptance or live domain/device acceptance. Simulator capture/composite/recovery and bank/finance evidence remain explicitly simulated. No external call, deployment or live testing was performed during this review.

## Command journal/discovery followup — review underway

Initial source review of sandbox-command.ts, sandbox-discovery.ts, route adapters and dedicated sandbox-migrations/0002_command_journal.sql found no concrete defect. Claims bind owner, scope, original key, canonical input and policy hash; durable uncertainty is not re-executed. Current target INSERT arguments match reconstructed receipt fields, and each target write plus receipt shares a batch. Discovery scopes participants to owner records, uses strict query keys/offset and returns no raw identity evidence pointer or passport token/hash in reviewed projections. Waiting for owner stabilized focused tests before independent replay/concurrency/privacy validation.


### Final command journal/discovery disposition

ACCEPTED, no actionable finding. Stabilized tests/sandbox-discovery-command.test.mjs independently passed3/3 named tests in1.95seconds. Five additional independent in-memory probes passed: failure immediately after committed real capture target returns original durable receipt; reordering input object keys returns identical receipt without invoking execution again; conflicting concurrent input yields exactly one winner and409 loser; identical scope/key under distinct owners yields isolated receipts; UPDATE of either immutable table is denied. Exactly two real capture rows existed after the postcommit/replay and conflicting-concurrency probes, proving no replay insert.

The pending-only claim semantics are intentional: if execution fails before a target commit and no receipt exists, repeating the key does not execute again or pretend completion. The caller must inspect original status; elapsed time cannot establish absence. Receipt recovery returns source metadata, not private document bytes. Discovery returns strict owner-filtered metadata and existing protected readiness/history projections; raw evidence digests/objects and passport credentials remain absent. Private token reads require owned current delivery, usable passport, token in POST body only and no extra fields. Three named tests include private no-store response, cross-account404, stripped binding hash, real reviewed officer history, invalid token404 and rejected token query parameter.

Dedicated0002 journal remains sandbox-only. Both primary/alternate claim uniqueness and receipt key are protected against REPLACE, UPDATE and DELETE; source-target commit plus receipt is atomic. No product edits, browser fixtures or external requests by this reviewer. These checks supplement the earlier identity/session review and do not substitute for Central's full browser/build acceptance.

## Saved-source UI and recovery review — 15 September 2026

Independent source review identified these corrections for Central:

- Identity discovery responses needed an access epoch fence: an authorized response delayed until after a denied command could restore cleared private selectors. Central added separate access/request generations and command response guards; actual delayed-response regression is prepared.
- Original-command recovery must distinguish an existing pending claim from a completed receipt. `recorded:false` does not mean no command exists. Central now labels pending explicitly and treats POST202/null as pending across capture/intake/import; a real stale-source/lost-response regression is prepared.
- Saved-review clear must release its busy state when invalidating the loading generation. Central had already added the correction by review time. The denied-clear/re-authentication regression checks this.
- Saved-review history needs request/source epoch checking so a delayed history response cannot be displayed under a different selected submission. Recommended to Central; final disposition awaits its change.

New safe read-adapter validation: independently ran tests/sandbox-discovery-command.test.mjs, all5 named cases passed, zero failures/skips (3.97 seconds). This extends prior journal coverage with actual intake/import receipt recovery and independently issued passport recipient reads. Review/detail excludes raw identity evidence; existing authorized readers enforce participant ownership and Ops review access. ReadinessWorkspace and PrivatePassportControls default `sandbox=false`, retaining production route selection; explicit sandbox props use the gated dedicated sandbox database. No external service requests.

New browser regression file: tests/integrated-browser/security-recovery.spec.mjs. Execution awaits shared fixture handoff and final UI freeze; prepared tests are not yet passing evidence.

History recommendation clarification: current busy state disables source selection and refresh while history loads. No user-reachable history source-switch race has been demonstrated; its proposed epoch check is defensive consistency, not a confirmed privacy defect or acceptance blocker. The separate identity discovery race remains covered by the prepared actual-response regression.

### Final saved-source UI/recovery verdict

ACCEPTED for the frozen UI and handler revision before the later retention0003 change. Independent tests/integrated-browser/security-recovery.spec.mjs passed16/16 (eight scenarios in mobile and desktop), zero failures/skips/retries,54.9seconds. Evidence: security-recovery-browser-clean.log. Actual local handlers and SQLite, synthetic actors only; external browser destinations aborted and handler external fetch disabled.

Covered: saved intake selection→account link→correction→separate Operations review with exact version/event history; lost intake receipt recovery; exact original intake request body/key replay with one application; lost capture receipt recovery→one original identity case; denied review clear plus working refresh after re-authentication; delayed authorized identity discovery after denied command cannot restore private selectors; client lost-response denial clears private form while saved owner source remains discoverable; definitive stale-capture rejection recovers failed receipt and unlocks corrected draft without inventing a capture. Primary intake/link tables stay empty.

Initial run12passed/4failed because the new test recorder included unrelated service:read presence POSTs. Corrected only recorder predicate to capture officer_application; no product assertion weakened. Initial evidence remains security-recovery-browser.log.

Central replaced the former forever-pending pre-write rejection with immutable failed receipts. Independent source inspection accepts the narrow classifier: explicit SignupError4xx before any attempted batch may become failed; attempted writes and other uncertainty stay pending. Two additional in-memory probes injected Error and SignupError409 at the target batch attempt: both remained pending, neither replay invoked execution again, zero captures inserted. Terminal failed keys remain immutable and rejected on POST replay; recovery lets the user prepare a corrected request with a new key.

Browser ownership transferred to frontend_qa after completion. Handler PID1833687/session13063 was left running for its controlled restart; no further browser/reset by this reviewer. Later retention delta initially prevented current backend import at sandbox-identity-store.ts:17 due unescaped SQL quote; notified Central, evidence security-command-final.log. This16-case acceptance does not claim that later handler revision was loaded. Frontend owner owns final merged integrated run after restart.

## Retention0003 and backup-cap final independent review

ACCEPTED, no actionable defect found in the finalized delta. The earlier SQL quoting error is corrected; current command/discovery suite6/6 passed4.44seconds. Stabilized retention suite3/3 passed1.99seconds, including actual CLI invocation against disposable copied SQLite files, denied/early purge, current byte counts, immutable audit/metadata, and no private reader resurrection after JavaScript-clock rewind. These are synthetic local tests, not remote execution.

Added tests/sandbox-retention-independent.test.mjs:1/1 passed0.62seconds. It rejects a future forged purge timestamp without changing payload; races two owner purges and proves exactly one audit and one cleared payload; confirms safe repeat returns zero; rejects alternate-reference REPLACE on audit and object tables and immutable policy replacement. Concurrent loser may fail closed and be retried as maintenance; it cannot duplicate audit or restore bytes.

Retention requires resolved sandbox policy hash/days, owner maintenance actor and batch1–100. SQL independently binds case/reference/digest/exact byte count/capture/expiry, checks both elapsed retention and expired evidence, inserts immutable audit and clears bytes in the same transaction. CLI requires explicit distinct existing local files; primary opens read-only. There is no new public retention route or request-provided clock. Cleared payloads remain unavailable despite clock rollback, and identity metadata/audit survive. This clears stored live payload bytes; it does not erase historical external backups or claim physical filesystem secure deletion.

Owner backup256-table cap independently exercised through actual ownerBackup implementation with canonical schemas: primary210 application tables plus sqlite_sequence=211; sandbox235 plus sqlite_sequence=236. Both snapshots returned200 and complete table lists. Exactly256 total tables returned200;257 returned422 without a partial-success response. Existing byte/row/schema restrictions and authorization remain. Initial count probe expected210 without sqlite_sequence and failed its own assertion; corrected accounting confirms the implementation preserves sequence metadata. No provider capacity or remote backup execution is claimed.

The16 browser cases above still refer to the pre-retention handler; the frontend reviewer owns the final restarted merged browser run. Independent review added tests/reports only, no product implementation edits.

## Finance refresh rejection attachment — final correction verified

Confirmed a current transient unhandled-rejection defect in sandbox-finance-workspace.tsx:356. The old Promise.all array started readWorkspaceResponse for the first fetched response, then awaited the second fetch before attaching Promise.all handlers. An isolated probe extracted the actual source expression and actual response-reader/class code, supplied first403 and second20ms-delayed responses, and observed unhandledRejection followed by rejectionHandled; the surrounding catch eventually ran. The quoted Revoked sandbox membership text originates the mocked contract test, but the delayed handler attachment was actual product code.

Central changed both entries to fetch(...).then(readWorkspaceResponse), attaching aggregate handlers immediately. Independently reran the exact current source extraction with the same first403/secondslow ordering: both requests started, denial reached the surrounding catch, and zero unhandledRejection or rejectionHandled events occurred after the delayed response settled. Fix accepted. No browser/reset/network or product edits by this reviewer; frontend reviewer owns the additional browser regression.
