# Identity, authentication and authorization security review

15 September 2026. Review baseline: `eccd48b`, application source inherited from accepted `d2e877c`. Product edits by the other release owners are outside this report. This was a substantive source/security review, separate from the earlier build closeout.

## Confirmed finding

### ID-SEC-01 — P2: reject oversized public request bodies before buffering them

Locations: `app/api/enquiries/route.ts:66` and `app/api/applications/route.ts:282`. Related authenticated entry points include `app/api/production-identity/route.ts:49`, `app/api/signup/route.ts:34` and `app/api/agreements/production/route.ts:13`.

Both public intake handlers call `await request.text()` before applying their 14,000/16,000-character limit. That consumes the entire body into memory; the eventual 413 does not bound input buffering or time spent waiting for a slow body. These public handlers reach the read without an account or database access. A caller can satisfy the JSON/origin check directly; it is a browser cross-site protection, not authentication or a resource limit.

**Isolated reproduction:** [identity-body-repro.mjs](identity-body-repro.mjs) invokes the actual enquiry handler with a stream of sixteen 65,536-byte chunks and no authentication. The handler consumes all **1,048,576 bytes**, never cancels the stream before EOF, then returns 413. [identity-body-repro.log](identity-body-repro.log) records the measured result. No provider, network request or database was used. No production outage or concurrency/load threshold was tested or claimed.

Impact: unnecessarily large/slow requests can consume isolate memory and request resources, creating an availability/resource-exhaustion exposure. Severity is P2 because the local reproduction establishes ineffective application limits, not demonstrated service-wide denial of service. Hosting-level limits may reduce the maximum request size but were not inspected by this reviewer.

Recommended fix: use a shared streaming byte-limit reader with an absolute read timeout and cancellation on excess/error, before JSON parsing. The existing `readFinanceBody` in `app/lib/finance-workflow-request.ts:5` already implements this pattern; preserve each route's public error contract when reusing/generalizing it. Cover omitted/misleading Content-Length, chunked over-limit bodies, timeout and multibyte input. Apply the same correction to other `request.text()`-then-length entry points. Reported to Central; this reviewer did not alter product code.

## Coverage and observations

| Area inspected | Result / security boundary |
| --- | --- |
| Worker authentication dispatch | `worker/index.ts` routes ordinary requests through Clerk before app dispatch. Explicit health/HMAC webhook and owner-backup exceptions were identified; finance/backup owners cover their separate authentication. Legacy synthetic APIs are denied outside demo by `live-surface.ts`. |
| Trusted headers and session verification | `clerk-access.ts` removes caller-supplied `x-lokd-verified-*` and legacy authenticated-user headers. `worker/clerk-auth.ts` uses the actual Clerk verifier, session-token restriction and configured authorized parties. It checks authoritative session ID/user/status/expiry, then requires a verified primary email before forwarding identity. Session lookup failure returns private/no-store 503. No direct forged-header bypass found at this boundary. |
| Roles, CSRF and host scopes | Server configuration resolves Operations/owner roles. Production identity/signup actor helpers require the correct workspace hostname and server-derived Operations authority; JSON/origin/fetch-site checks reject browser cross-site writes. Missing Origin alone was not classified as CSRF because JSON content type and fetch metadata/CORS still constrain browser requests. |
| Session loss and MFA | No authenticated fallback occurs after invalid/expired/revoked sessions. MFA proof derives from verified session claims and fresh second-factor age, and is checked at protected mutation boundaries when the existing policy enables it. Existing owner-authorized MFA configuration was not changed. |
| Object binding and independent reviews | Production identity start binds authenticated user, applicant/version and private capture; status reads deny another participant. Review/recovery require Operations, current outcome/version and actor separation; immutable database-backed claims prevent automatic resubmission after uncertain delivery. Officer/readiness/signing/passport and rereview source paths were inspected for ownership and independent approval boundaries. No new bypass identified in this bounded review. |
| Sandbox separation | Identity/application APIs require the guarded separate database, prelaunch enablement and policy/version/hash marker. Client actor/provider authority is rejected. `sandbox-application.ts` invokes actual protected services on the isolated database. No caller-selectable database/production promotion path found. |
| Identity private evidence | `production-identity-evidence-reader.ts:31` requires Operations plus explicit server-owned policy. It verifies binding/currentness/opaque references, applies a 1 MiB and five-second vault-read bound, hashes bytes, rechecks receipt and policy, and requires a durable audit before release. File response uses attachment/no-store/nosniff/CSP. Sandbox grants are case/reader/version/expiry-bound and revocable. Participant identity status omits private pointers and digests. |
| Private passport | Delivery requests require the linked officer owner and digest-only token input. Private sandbox reads require the owning delivery and current usable passport, with the raw token submitted in a body. Review projections remove token hashes. |
| Network/file input, SQL and logging | VerifyNow production transport uses a fixed endpoint, disabled redirects, timeout, bounded response and opaque vault references; browser JSON cannot install it. Examined identity/workforce queries bind values and derive dynamic identifiers from fixed maps. Examined failure/audit paths do not emit credentials or raw provider bodies. Generic `/api/evidence` access-class review belongs to the frontend security reviewer and is not endorsed by these identity-reader observations. |

## Fresh targeted checks

- [identity-targeted-security.log](identity-targeted-security.log): three test-file executions passed, zero failed/skipped: Clerk access, production identity HTTP boundary and private identity evidence reader. This runner reports file-level totals; they are not represented as three individual assertions.
- [identity-clerk-direct.log](identity-clerk-direct.log): direct Clerk file execution reports **5 passed, 0 failed/skipped**, overlapping the first file above. Actual locally signed JWT verification covers signature, expiry, origin, revoked/incorrect/expired sessions, primary email and forged headers. Clerk Backend lookups are injected local fixtures; no real accounts or provider requests.
- Private-reader suite exercises participant/absent-policy denial, wrong owner/version/receipt, changed grants while reading, oversized/stalled streams, wrong hash/object and audit-write failure. Its fixture database is in memory and touches no shared runtime data.
- The new 1 MiB public-body reproduction confirms ID-SEC-01 independently of previously accepted tests. Source/report-only work; no production mutations, deployment or credentials accessed.

## Hardening considerations, not confirmed exploits

1. Privileged roles currently follow a verified email allowlist (`pilot-access-core.ts:90`). Bind long-lived privileged assignments to immutable Clerk user IDs as well if mailbox reassignment/account recreation must not transfer privileges. An attacker with an arbitrary unverified email cannot exploit this; no mailbox/account takeover was attempted.
2. Document an explicit authentication dependency budget for authoritative session and user lookups (`worker/clerk-auth.ts:40–43`) and retain fail-closed behavior under dependency exhaustion. No claim is made that Clerk's SDK lacks internal timeout handling or that an actual upstream outage was observed.
3. Verify edge request-rate controls for anonymous intake alongside the body-limit fix. Per-input duplicate lookup/honeypot handling is not a global request quota. Edge configuration/load testing was outside this reviewer scope.

## Untested boundaries

No real accounts, hosted sign-in changes, provider compatibility calls, production permissions/settings, physical devices, high-volume load or deployment were exercised. Dependency CVEs, backup/deployment/migrations, general file access and finance-specific permissions are handled by the other release reviewers. A bounded source review and passing regression are not a guarantee that no vulnerabilities remain.
