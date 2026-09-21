# Frontend and perimeter hardening — 15 September 2026

## Implemented

### Evidence class authorization (FE-SEC-01)

`app/api/evidence/route.ts` now enforces the same class policy for uploads, metadata, bytes and independent verification:

| Classification | Access |
| --- | --- |
| operations | Authenticated Operations principal, including configured owners |
| owner | Configured owner only |
| finance / compliance | Denied to everyone until explicit supported assignments exist |
| Unknown stored class | Denied |

The current principal contract has no finance/compliance roles. Neither generic Operations membership nor owner status silently grants these unsupported classes. Denials happen before bucket put/get/head; wrong environments remain unavailable, and owner access does not bypass independent verification. Worker dormant-route guards are unchanged. This fixes the previously reproducible latent handler defect without enabling the route.

Evidence upload and verification now use Identity's shared bounded/deadline-aware UTF-8 request reader. This also closes the identified post-buffering request-size weakness on the retained upload route.

### Per-request CSP nonces

`app/lib/security-headers.ts` supplies shared baseline headers and policy. `worker/index.ts` generates a fresh 24-byte cryptographically random nonce per request, overwrites incoming CSP and nonce headers, and sends the nonce policy into the actual vinext renderer. Returned HTML receives the same policy and private/no-store caching. `next.config.ts` no longer permits script `unsafe-inline`; style allowance is retained for current styling.

The installed renderer's request-CSP parser, SSR bootstrap and streamed RSC paths explicitly support nonce propagation. Root layout passes the nonce to ClerkProvider; JSON-LD scripts receive it explicitly. The installed Clerk loader forwards its nonce option. No account or external-provider acceptance is implied.

A real Chromium run caught canonical favicon CSP violations on a noncanonical host. The image policy now permits the exact owned `https://lokd.co.za` origin already used by metadata, in addition to existing image sources.

### All Worker response paths receive baseline headers

The outer Worker wrapper applies no-referrer, nosniff, frame denial, Permissions Policy and HSTS to ordinary pages, early health/provider replies, authentication redirects, locked surfaces and failures. It preserves restrictive attachment-specific CSP. Early non-HTML responses without an existing policy receive `default-src 'none'` and frame/base/form restrictions. Authenticated responses and nonce-bearing HTML remain no-store.

## Verification

| Check | Result |
| --- | --- |
| Actual evidence routes + fully migrated SQLite + in-memory bucket | 3/3 passed; includes all classes, owner/non-owner, metadata/download/verification, denial before bucket access, independent decision and wrong environment |
| Policy and nonce behavior | 2/2 passed; attacker-selected headers replaced, nonce uniqueness, no inline-script allowance, attachments and early response headers |
| Actual Worker provider/health routing fixture | 1/1 passed; provider authentication still independent of browser auth failures, baseline response headers checked |
| Actual built Worker HTML | 2/2 passed; canonical HTML plus every SSR/bootstrap/RSC/JSON-LD script carrying the response nonce, attacker nonce rejected, unique response policies |
| Chromium against actual built Worker and local static assets | 360px and 1280px passed: hydration, client keyboard navigation without document reload, zero normal CSP violations, attempted unnonced inline script blocked |
| Required project build | Passed after final policy change |
| Focused ESLint over owned source/tests | Passed |

Logs are adjacent: `frontend-evidence.log`, `frontend-csp.log`, `frontend-worker-routing.log`, `frontend-rendered.log`, `frontend-browser.log`, `frontend-build.log`, `frontend-lint.log`.

The project-wide type scan initially encountered the concurrent shared-body-reader/finance typed-array integration; the remaining scan errors were confined to the finance owner's `paystack-test.ts`, and were sent to that owner. `frontend-types-integration-pending.log` retains that intermediate result. Root owns the final merged type check and checks after any subsequent dependency rebuild.

Browser reproduction: `TMPDIR=/dev/shm node --experimental-loader=./tests/cloudflare-loader.mjs tests/csp-rendered.browser.mjs`. It serves only ephemeral loopback assets and aborts external browser requests. Initial local execution required approval for loopback binding after sandbox EPERM. The initial pointer-based mobile navigation check hit existing hero overlap; the final test uses keyboard navigation for the hydration assertion. A subsequent initial CSP assertion exposed the favicon-origin issue above; after its policy fix, both viewports passed. These intermediate failures are described here rather than claimed as successful runs.

## Scope and remaining integration

No deployment, account provisioning, provider request, dependency or schema change was performed by this owner. Existing provider script origins remain constrained; actual hosted account flows are later validation as instructed. The build and browser checks here exercise the current installed renderer; rerun them after changing renderer/browser-facing dependencies. Root coordinates final merged validation and release.
