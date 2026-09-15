# LOKD code and security review — 15 September 2026

## Executive assessment

Release and backup completed successfully; see [the release receipt](RELEASE.md). The hosted migration failure was resolved and deployed in version 72, with the backup window revoked afterward.

The implemented workflows have substantial authorization, immutable-history and recovery controls, but **the security hardening work is not closed**. The dependency scan found affected packages, including runtime React Server Components, and isolated tests confirmed weak request-body resource limits. A retained evidence handler also contains a latent access-class defect, currently blocked by the Worker perimeter.

This review covers application source, selected compiled-runtime paths, dependencies, migration delivery, current configuration metadata and backup/recovery. It is not a certification that every line is correct or that no vulnerabilities remain. No real accounts, payments, identity submissions, destructive production payloads or load testing were used.

## Prioritized findings

| Priority | Finding | Evidence / exposure | Recommendation |
| --- | --- | --- | --- |
| First | Affected dependency versions, including runtime RSC | npm reports 24 affected package entries: 1 critical, 16 high, 6 moderate, 1 low. RSC 19.2.6 is present in the compiled Worker. Some Next critical alerts concern Windows or sharp/libheif paths absent from this Worker; those are package alerts, not confirmed deployed RCE. | Upgrade aligned React/RSC packages first, then compatible framework/build dependencies; validate the adapter and re-scan. Do not blindly apply forced major upgrades. See DEPENDENCIES.md. |
| P2 / medium | Public intake buffers the entire request before checking size | Actual enquiry handler consumed all 1 MiB of a synthetic stream before 413; application/request limits therefore do not bound memory or read duration. | Shared streaming byte cap, absolute deadline and cancellation before parsing, across public and authenticated routes. See IDENTITY-SECURITY.md. |
| P3 / low | Public HMAC webhook readers have no body-read deadline | Bounded-byte readers wait until the stream closes before verification; locally reproduced without writes. | Reuse a byte-and-time-bounded raw reader while preserving exact HMAC bytes. See FINANCE-SECURITY.md. |
| Latent medium | Legacy evidence reader ignores owner/finance/compliance classification | Non-owner Operations reads owner-class metadata and bytes through the direct handler. Current Worker blocks this route outside demo; demo handler also rejects it. | Enforce per-artifact read/verify policy before any future enablement; retain perimeter block. See FRONTEND-SECURITY.md. |
| Release defect | New migrations parse locally but initially fail hosted deployment | Both failed deployment snapshots match the pre-deployment schema and all rows. An installed-Wrangler parser regression catches one lexical issue, but the hosted retry also failed. | Preserve prior migrations, normalize only unapplied expressions to the established form, test and record actual hosted result separately. See FAILED-DEPLOYMENT.json and release receipt. |

## Code quality and hardening plan

### Round 1 — security fixes and upgrade validation

1. Extract a shared bounded body reader with byte limits, timeout, cancellation and predictable public errors. Retain raw bytes for webhook signatures. Add cases for missing/misleading Content-Length, multibyte input, over-limit chunks and stalled streams; prove rejection happens before reading all input.
2. Upgrade React/ReactDOM/RSC as a compatible family to patched versions, then Next/tooling/adapter dependencies deliberately. The advisory scan's suggested drizzle-kit downgrade and vinext major transition need review; automatic `--force` is inappropriate. Verify the deployed bundle, not just package.json development labels.
3. Close evidence access-class checks before the dormant route can become reachable. Require tests for metadata, content and verification under each supported role/class combination.

### Round 2 — defense in depth

4. Replace inline-script CSP allowance with a renderer-compatible nonce/hash policy; validate the actual UI and authentication widgets before removing it. Apply baseline headers consistently to early Worker responses too.
5. Establish edge quotas/rate controls for anonymous intake and public webhooks. No high-volume production test was performed; existing duplicate/honeypot checks are not a general quota.
6. Bind privileged access to stable user IDs as well as verified emails where account recreation/mailbox reassignment must not transfer authority. Preserve the current owner-authorized MFA exception until the owner changes it; do not silently override it during this review.
7. Cap provider response sizes in addition to existing URL/redirect/time limits, and document an authentication dependency timeout budget.
8. Move verified encrypted backups to an owner-selected independent destination, with separate key custody and periodic isolated restoration. Same-VPS archives protect against some failures but do not establish disaster recovery from loss of the VPS.

### Round 3 — maintainability and repeatable checks

9. Reduce review complexity in large hand-written modules: `app/api/pilot/route.ts` (~3,975 lines), `operations-server.ts` (~2,375), `officer-app.tsx` (~2,072), `integration-server.ts` (~1,594), and `client-app.tsx` (~1,568). Extract coherent authorization/validation/service units behind existing tests; do not split generated readiness code by hand or rewrite working flows merely for style.
10. Keep the 43-requirement acceptance matrix current, and archive/supersede earlier pending language so build status does not repeatedly reopen completed work. Keep source, build, deployed, tested and externally accepted states distinct.
11. Add an explicit automated release gate for types/lint, migration splitter compatibility, schema/financial-integrity tests, security regressions and dependency advisories. No checked-in `.github` workflow was found; external CI may exist and was not inspected. No new automation is enabled by this report.

## Review scope and validation

- Three separate reviewers covered frontend/HTTP perimeter, identity/auth/workforce, and finance/accounting/replay boundaries. Their detailed reports list inspected modules, protections, preconditions and untested areas.
- Current tracked-text secret-pattern scan: **1,084 files**, no matches for the specified private-key/provider/GitHub/AWS credential patterns. It is not an entropy scan or deleted-history secret audit. Source inventory: **290 application/Worker/build files, 37,262 lines**; inventory counts are not a claim that every line received equal manual scrutiny.
- New isolated evidence: public body over-read, latent evidence access-class read, and stalled webhook stream. A reproduction that successfully demonstrates a flaw is not a passing security guarantee.
- Targeted identity/auth test-file executions passed; direct five-case Clerk execution overlaps those files. Existing full-suite, financial-integrity and browser evidence was reused where code was unchanged, not counted as newly executed.
- npm scan ran only after explicit user approval to disclose dependency names/versions. No application source, customer data or secrets were submitted by the scan.
- Fresh encrypted database captures were restored in isolation with schema, typed-cell, integrity and foreign-key checks; failed deployment snapshots were compared exactly. Source/release and post-deployment capture receipts are recorded separately.

## Supporting reports

- [Dependency findings and applicability](DEPENDENCIES.md)
- [Frontend and HTTP perimeter](FRONTEND-SECURITY.md)
- [Identity, authentication and authorization](IDENTITY-SECURITY.md)
- [Finance and immutable accounting](FINANCE-SECURITY.md)
- [Current tracked-text scan](SOURCE-SCAN.json)

Framework advisory sources are linked in DEPENDENCIES.md. Worker review also used [Cloudflare's current best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/), emphasizing bounded reads, request-local state, protected secrets and reliable background work. No claim is made about uninspected external WAF, account policies, secret rotation, staffed monitoring or provider infrastructure.
