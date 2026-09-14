# LOKD Central independent QA04 security/privacy — 2026-09-14

Scope: read-only source review of /srv/ammosync/workspaces/lokd-security at c358358d6ad1ad59ba2f8e39513928c343e5736b plus current uncommitted Central schema-readiness edits. No Site operations, browser/account harness, live provider requests, deployments or source edits. Existing identity/frontend/finance owner implementations not duplicated. This is source/offline QA, not deployed acceptance.

## Actionable findings

1. P2 — Public passport verifier buffers an unbounded request before its 2,000-character check. app/api/passport/verify/route.ts:12 uses request.text() before rejecting oversized bodies. This endpoint accepts anonymous bearer-verification requests; a nonbrowser caller can omit Origin and Fetch-Metadata (pilot-access-core.ts:121-127), so invalid or absent token material does not prevent the full read. The advertised small input limit does not bound memory/CPU consumption. Replace with a byte-limited reader that cancels immediately above the limit, as the provider receivers already do. Test an oversized multi-chunk stream without Content-Length and assert cancellation before the rest is consumed. This is a confirmed application-level resource-bounding defect; actual edge body/rate limits and exploitable outage impact are unverified.

2. P2 — Live transfer webhook unnecessarily depends on Clerk authentication. worker/index.ts:62-65 bypasses browser authentication for booking/test webhooks but omits /api/paystack/transfers/live/webhook. A Clerk authentication exception or handshake prevents the HMAC receiver from running and instead produces 503/redirect, although app/lib/payment-execution.ts:116-128 already implements independent provider authentication. Route all intended provider callbacks consistently before Clerk and retain receiver HMAC/mode checks. Add a mounted Worker regression with Clerk throwing/handshaking: valid signed live transfer must reach its receiver, invalid signature must still fail. This is an availability/control-flow defect, not an authentication bypass or claim that normal cookie-free callbacks are currently rejected.

## Controls inspected

- Worker cleanIdentityHeaders removes forged identity before Clerk verification; configured roles use verified primary email and authoritative user ID. Operations mutation paths require fresh second factor when policy enables it. Same-origin JSON checks reject explicit hostile origins and cross-site fetch metadata; absence of these headers alone is not a browser CSRF vulnerability.
- Production identity endpoints enforce applicant ownership in their libraries and Operations scope/host authority; raw tokens/provider outcomes/actor authority are rejected from request JSON. Production identity adapter remains absent in this snapshot and fails closed; active owner is responsible for integration.
- Finance documents filter recipient_user, then recheck current production entity ownership (or representative binding) before exposing issued records. Operations reads additionally check amount-scoped operator authority. HTML output escapes content, is an attachment with sandbox CSP; report cells guard formula-prefix characters. Issuance separates preparer/approver/recipient. Current view-based financial state does not treat provider success alone as paid.
- Private passport delivery returns metadata only, binds the digest to current owner/case version, and keeps the raw token client-side. POST verification uses a body token, no-store/no-referrer/noindex headers, and reports productionAuthorized:false. Revoked-but-not-rotated tokens intentionally return red identity/readiness information; existing tests explicitly assert this behavior. Treat as retention/product policy requiring clarification if stronger revocation privacy is desired, not a newly proven authorization bypass.
- Legacy /api/evidence, /api/passport and /api/service-record are blocked by liveSurfaceResponse outside demo. Therefore evidence access_class labels not having separate ACL enforcement is not a currently mounted production data leak. Re-audit that route before enabling it: all Operations principals currently read every access class. Production readiness documents need their own integration/acceptance evidence.
- Booking/live-transfer callbacks verify SHA-512 HMAC and explicit test/live domain, stream-limit bodies to 262,144 bytes, ignore unknown references, and record observations rather than directly authorizing money movement. Observation inserts are idempotent with database uniqueness controls; API re-verification and independent reconciliation remain separate.
- Owner-backup route requires explicit enablement, SHA-256 token verifier and expiry within one hour, rejects browser Origin, and limits streamed bodies. Actual hosted enablement/expiry was not inspected.
- Central readiness changes check expected schema object names and kinds using aggregate SQL, return infrastructure status only, and explicitly leave operational/provider acceptance unassessed. They do not grant production authority. SQL definition equivalence is outside this check's stated scope.

## Offline validation

Ran node --experimental-loader=./tests/cloudflare-loader.mjs --test with clerk-access, operations-mfa, production-identity-route, finance-documents-contract, payment-execution-contract, collection-evidence, evidence-storage, passport-rules and public-demo-access. Seven file suites passed; two finance/payment suites failed after their internally configured 30-second Python migration timeout. No failed access-control assertion was reported. Log: /tmp/lokd-security-qa-tests.log.

Re-ran only HTTP authorization cases from the two timeout suites using --test-name-pattern='HTTP endpoints|deny anonymous'; both file suites passed. Log: /tmp/lokd-security-qa-http-tests.log. Full migration-contract completion remains unverified here; do not record the original run as all green or increase live access to compensate.

## Remaining independent acceptance gaps

- Mounted Worker callback regression across Clerk failure/handshake, not only direct route tests.
- Stream-cancellation test on the public passport endpoint and equivalent bounded readers on other exposed request.text() handlers.
- Complete migration/behavior fixtures for finance cross-recipient denial, representative reassignment, duplicate callbacks and conflicting callbacks after the finance owner's final checkpoint; current contract tests mostly verify denied-route/no-backend cases.
- Verify actual edge WAF/rate limits, origin isolation, R2 public-access settings, backup disablement, production MFA policy, payment flags/DB control, provider keys/modes and binding deployment only during separately authorized operational acceptance. These settings were not observed, so neither insecure nor accepted is claimed.
- Independent QA must be repeated on the integrated owner checkpoint delta; this snapshot precedes their final implementation.

Disposition: not full-build or live-testing sign-off. Address the two source findings and finish owner integrations/offline acceptance first.

## Independent remediation recheck — later 2026-09-14

Both original P2 findings are resolved in the current local source:

- app/api/passport/verify/route.ts now accumulates at most 2,000 bytes, cancels the reader as soon as a chunk exceeds the cap, and releases the reader lock in finally. JSON parsing follows the bounded read. The regression verifies cancellation after exactly two 1,100-byte chunks without Content-Length, multibyte byte counting, malformed/small request handling and unchanged private cache headers.
- worker/index.ts now routes /api/paystack/transfers/live/webhook before Clerk alongside the other provider receivers. Its mounted test bundles the actual Worker, replaces framework/auth services, forwards to the real route/HMAC receiver and checks valid callbacks during both Clerk failure and handshake, invalid HMAC never reaching storage, and ordinary requests retaining Clerk gating.

Independently reran node --experimental-loader=./tests/cloudflare-loader.mjs --test tests/passport-request-limit.test.mjs tests/worker-provider-routing.test.mjs. Both file suites passed (three declared cases), log /tmp/lokd-security-qa-remediation-tests.log. No new security concern was found in these changes. Source-only sign-off for these remediations; previously listed integration/configuration/acceptance gaps remain, and this does not assert deployed remediation.

Runbook source assertion correction: docs/launch/OPERATIONS-RECOVERY-RUNBOOK-2026-09-14.md:11 calls /api/health/live dependency-free process liveness. The route handler is dependency-free, but mounted requests still pass worker/index.ts:64 authenticateClerkRequest. Configured Clerk failure/handshake can therefore return 503/307 before the liveness handler. Either describe that boundary accurately or deliberately route liveness independently with a mounted regression. The suspension/hold action names listed in the runbook match production-operations dispatch; recovery staffing, off-host copies and live settings remain explicitly unaccepted or evidence-dependent. No backup/deployment claims were re-verified in this code-only review.

## Final narrow routing acceptance — 2026-09-14

Independently reviewed the final Worker delta: exact /api/health/live and /api/health/ready paths now dispatch before Clerk authentication. Neither handler uses client-supplied identity headers; readiness returns aggregate infrastructure/schema status, not private records or secrets. The prior runbook liveness boundary concern is resolved in local source. This does not assert that the older deployed v69 already contains the change.

The mounted regression now invokes actual liveness/readiness handlers during Clerk throw and handshake, verifies liveness 200 and readiness's own structured unavailable 503, and retains ordinary application authentication gating plus valid/invalid callback HMAC assertions. Independently reran both remediation file suites successfully (three declared cases), log /tmp/lokd-security-qa-final-routing-tests.log.

Final disposition for this bounded QA04 delta: ACCEPTED locally. Both P2 findings and the runbook/source liveness inconsistency are resolved. No new actionable security finding in the final changes. This acceptance covers the reviewed passport body limit, provider routing and health routing; it does not waive outstanding owner-integration QA, full migration-contract completion, hosted configuration verification, recovery acceptance or the user's build-before-live-testing boundary.
