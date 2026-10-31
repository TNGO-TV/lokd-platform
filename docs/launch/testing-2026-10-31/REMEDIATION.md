# Launch-test remediation — 2026-10-31

Base: `d27a9fec2f80abda07af03767a6ed6afd6f434c2` (PR33 merge).
Review branch: `codex/lokd-launch-test-remediation-20261031`.
This change is for review and isolated validation; it does not deploy or approve launch.

## Browser and application corrections

The actual-handler fixture previously used the production hostname and omitted the
explicit test-surface flag after reset. It now constructs in-process requests for
`https://demo.lokd.co.za` with test surfaces enabled. It sends no requests to that
host. The existing local opt-in, loopback binding, external-fetch denial, opaque
synthetic sessions and distinct primary/sandbox SQLite stores remain enforced.
The identity test's additional browser contexts inherit the configured base URL
instead of assuming the historical owner port.

The new merged Playwright config owns ports 4405/4406, refuses to reuse existing
servers, and stops its servers on completion. The security gate includes all 78
integrated cases on desktop and mobile, including supplemental mocked UI contracts.

Correcting the fixture exposed three genuine sandbox integration mismatches:

- A committed intake receipt omitted `saved: true`, which the UI now requires.
  That acknowledgement is added only to the receipt committed atomically with
  the source insert. Neutral/no-write responses remain unacknowledged. Tests
  cover first write, exact replay, original receipt recovery and honeypot handling.
- Raw service/orders response contracts required `owner`/`reviewClients`, which
  the UI adds from a separately validated operations response. The raw contracts
  now represent those actual responses; composition is unchanged. Tests validate
  actual handlers for three roles and reject missing required data and production
  eligibility claims. Generated contracts were regenerated, not edited manually.

- Sandbox presence sharing now obtains the current consent revision and starts a
  versioned session before sharing. It validates the exact mode, session and
  revision, preserves stop/re-consent behavior, and rejects malformed session
  receipts. Existing server consent and assignment guards are unchanged. The
  actual-handler map test covers sharing, stop and server expiry.

Older UI mocks now distinguish finance capabilities from record responses and
exercise the current consent protocol. The uncertain-correction test confirms
that the retry button is disabled and separately submits a stale API replay to
prove it cannot duplicate history.

No production-host guard, authorization, consent, provider boundary or accounting
rule is relaxed.

## Dependency findings

The initial locked audit had **22 findings: 1 critical, 2 high, 19 moderate**.
No root finding was dismissed as a false positive. The roots were Next.js,
Undici, Vite, minimatch and fast-uri; the other findings were metavulnerabilities.

| Dependency | Before | Candidate |
| --- | --- | --- |
| Next.js | 16.3.8 | 16.4.3 |
| Vite | 8.3.0 | 8.3.5 |
| Cloudflare Vite plugin | 1.64.0 | 1.66.0 |
| Wrangler | 4.151.0 | 4.154.0 |
| Workers types | 5.20261006.1 | 5.20261023.1 |
| Miniflare | 5.20261012.0-beta | 5.20261023.1-beta |
| Undici | 7.29.1 | 7.30.1 |
| fast-uri | 3.1.8 | 3.1.9 |
| minimatch (all consumers) | 3.1.5 / 10.2.6 | 11.0.3 |

The Next.js, Vite and Cloudflare updates stay within their existing major versions.
fast-uri resolves within its existing supported dependency range. The maintained
minimatch fix requires major 11, so four lint consumers have scoped overrides and
two have explicit local compatibility adaptations; there is no global override or
audit suppression. The installed Node 22.22.1 runtime satisfies minimatch 11.

The existing React compatibility package adapts five rule imports to the named
`minimatch` export. Import-x 4.17.1 is retained as a complete upstream vendor copy,
with its removed `makeRe` API usage changed to `Minimatch.match` in both ESM and
CJS. Each package records upstream provenance. All other import-x rules remain
upstream files. Focused tests exercise six consumers, both import-x module formats,
allow/forbid decisions, and all five changed React rules with valid/invalid options.
The repository vendor verifier checks installed executable files against source.

`baseline-findings.json` enumerates every original finding and its advisory links.

## Audit gate

npm's package-level severity can legitimately differ from the highest advisory
reachable through a transitive dependency (Miniflare moderate via Undici high).
Its ESLint dependency graph also contains cycles. The old parser rejected both
before classifying the actual findings.

The parser now validates all nodes and follows each graph with a visited set.
Cycles are accepted only when every node reaches an advisory root. Missing nodes,
rootless cycles, malformed records, array-shaped graphs and inconsistent totals
still fail closed. For enforcement, the greater of package and advisory severity
wins, so neither can hide a moderate/high/critical finding. Raw evidence is retained
when a parsed graph fails assessment. There are no development-only exemptions.

## Reproduce validation

Use Node 22.22.1 and the pinned npm 11.17.0. Do not inherit live Clerk credentials.

```sh
env -u CLERK_SECRET_KEY npm run install:ci
node scripts/verify-vendor.mjs
npm ls --all
# Requires a clean committed review branch; builds and validates, never deploys:
env -u CLERK_SECRET_KEY bash scripts/deploy-native-cf.sh --prepare
```

The prepare gate runs the locked audit, lint, 41 lint-policy fixtures, both type
checks, generated schemas/contracts, restore-order tests, native build and bundle
boundary checks, all Node tests, 14 offline browser cases and all 78 integrated
browser cases (actual handlers plus explicitly labelled supplemental UI mocks). The final PR records the exact validated source,
results, lock hash and candidate receipt. Raw logs remain in the saved cloud task.

## Connected stages and retained artifacts

Connected Clerk development-account testing, Paystack TEST collection and remote
DB/R2 document storage remain **not run**. The saved checkout has no verified
separate disposable remote stores or usable designated development-account
configuration. Existing Wrangler bindings identify production resources. Dummy
labels alone do not isolate writes. An owner must provide/identify an already
isolated test deployment with disposable DB/R2 bindings and designated Clerk
DEVELOPMENT accounts through the approved environment mechanism. No secret values
should be sent in chat. Any new credentials or access changes require separate
scope. No external payment, payout or email was sent.

The previous six read-only live health requests returned HTTP 403; they were not
retried or bypassed. PR33 records the historical accepted candidate, not current
live verification. The owner must make an authorized current release receipt or
supported read-only deployment inspection available to reconcile live state.

Synthetic PDF: `tests/fixtures/dummy-client-terms.pdf`, retained artifact name
`LOKD-DUMMY-TERMS-2026-09-24-v1.pdf`, SHA-256
`e3d57fe507e47a4fbab9d85dc2dbe1aaa4a34a3979e7f5eab169d90110a83afc`.
The baseline synthetic quote acceptance and receipt were verified in isolated
storage; no connected transaction is implied.

Baseline archive: `lokd-testing-2026-10-31-evidence.tar.gz`, 119438 bytes, SHA-256
`87a9fe0db1dd8eff693a42a4426c8ce3841f01bb5591ccb85ab4d37c33657f65`.
Its Library upload to `/LOKD Security/Launch` failed during service discovery with
HTTP 401, before upload preparation. No Library file IDs were issued. The archive
and PDF remain in the original cloud workspace; no upload retry was made without
new authentication evidence.
