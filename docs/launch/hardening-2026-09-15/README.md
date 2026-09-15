# Security remediation — 15 September 2026

## Completed changes

- ID-SEC-01: public and authenticated JSON handlers now read bounded bytes with an absolute deadline, cancellation and strict UTF-8 decoding.
- FIN-SEC-01: signed webhook bodies now have a five-second deadline; HMAC verification still uses the original bytes. Provider JSON responses have byte and time limits.
- FE-SEC-01: evidence class authorization is consistent across upload, metadata, content and verification. Dormant production routes remain closed.
- Browser hardening: per-response script nonces, no inline-script allowance, and consistent baseline Worker headers. Built Chromium checks confirm hydration, navigation and blocked untrusted inline script execution.
- Dependency remediation: Next/eslint-config-next16.3.5, React/DOM/RSC19.2.8, Vite8.3.0, Cloudflare plugin1.54.9, Wrangler4.131.2 and matching Worker types; compatible transitive patches. Scoped overrides patch vinext's image-size2.0.4 and the legacy migration loader's esbuild0.28.2. No forced migration-tool downgrade.
- `npm run check:security` provides an explicit release gate: npm audit, lint, types, canonical schema, build and isolated regression tests. It does not deploy or run account tests. It sends package metadata to npm, as authorized.
- Verified encrypted v72 production/source backups and sanitized audit evidence were uploaded to an owner-only Google Drive folder. See OFFHOST-BACKUP.json. The recovery key was not uploaded.

## Validation

- Installed dependency audit: zero known vulnerabilities (previously24 affected entries). See npm-audit-final.json. This is an advisory snapshot, not a proof that no vulnerabilities exist.
- Full combined regression suite:513 passed, zero failed/skipped. Includes actual migrated SQLite fixtures and built Worker HTML.
- Build passed; final complete TypeScript scan passed.
- Lint: zero errors, three warnings (two existing navigation patterns newly flagged by Next's updated lint rule and one historical reproduction import).
- Chromium:360px and1280px, hydration/client navigation passed; zero normal CSP violations; untrusted inline script blocked.
- Patched legacy migration loader synchronous/asynchronous transformations passed. Drizzle schema generation succeeded in an isolated temporary directory; no canonical migration files changed.
- Canonical readiness schema still matches1,340 objects through0074.

Initial failing integration/lock-resolution reports are retained beside final results. npm9 retained an invalid old nested esbuild entry until that generated subtree was rebuilt; final `npm ls esbuild --all` and npm audit validate the installed override.

## Operational recommendations retained

Owner-approved MFA and real-account/provider acceptance remain deferred. Stable provider-user-ID role assignments require the future account mapping; no fabricated identities were added. Edge quotas/rate policies should be set with expected traffic and hosting controls; no unverified edge configuration is claimed. Large-module refactoring and wiring the release gate into a repository CI runner remain maintenance work. The confirmed findings above are fixed; these recommendations are not represented as completed changes.

Production publication and refreshed backup receipts will be recorded in RELEASE.json after successful deployment.
