# LOKD v85 cleanup — 23 September 2026

Published successfully at 2026-09-23T06:42:10Z. PR https://github.com/zenascapetown-code/lokd-platform/pull/13; tested head 977618b7489dfdec255b86e5301bac553733209f; merge 12f5f0cedc5c4f9b6cbed35bcad7613d57d0cd7f; CI 35827236930; identical trees verified. Canonical checkout integrated while preserving local handovers.

Removed 252 obsolete files: 246 raw historical logs, three unused starter icons, superseded V34 root release note, unused integration prototype and its two self-tests. Verified historical archive hash 8500cdcf167b0ee81b7dca6583808cc142847fefe9a457b86b0b2a7170656a1d; Windows copy matches. The two retired prototype files remain in pre-cleanup Git history and v84 backup. Import audit: 304 source modules, 301 reachable from app entry points; retained maintenance and deferred-provider modules after checking non-web consumers.

Authentication uses concurrent authoritative session/user lookups with complete validation before forwarding identity; no revocation cache. User ID mismatch fails closed. Service failures are distinguished from sign-in failures. No new roles or payment permissions in this release.

All 549 isolated tests passed, zero failures, with locked dependencies, dependency audit, lint, TypeScript, schema, build and tracked-source-cleanliness gate. These are isolated tests, not real provider payment or signed-in acceptance proof.

Actual hosted checks: homepage 200 with zero redirects; health 200; client, Operations and officer portals each one expected sign-in redirect; retired file.svg 404; forged identity-header request to quotes API 401. Version Worker 92b8722e-f520-4285-b96c-1d4755fd106b. Client chain remained 8.072389s overall with Worker invocations 9ms and 42ms. Operations chain 7.369335s overall with invocations 4ms and 14ms. Performance remains unresolved outside the logged invocation. No hosting dispatch/startup trace tool is available. See HOSTING-LATENCY-EVIDENCE.md and sanitized logs.

Domain cleanup: retired demo.lokd.co.za to free the host's five-domain slot and registered www.lokd.co.za (appgdom_6ab36fcf84fc819192d11e05cb7f8d89). Certificate/provider active, app ownership pending; www currently returns 404. Required DNS TXT: _openai-site-verification.www.lokd.co.za = openai-site-verification=5Y7pvGsMAqJ8LtG5wkYyXWEUfHcOsUJXer97INqntTU. Existing www CNAME points to lokd.co.za. DNS panel URL/access requested; none available in connected browser. Main site and three portals unchanged. Do not claim www fixed until activation and hosted request succeed.

Operations supplemental mapping remains env31; final owner approvals still need implementation and verification. Final client terms files, signed-in hosted acceptance, layout/demo-copy review, and both EFT/card Friday paid-test readiness remain open. No real payment or customer communication performed.

