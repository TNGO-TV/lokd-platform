# Connected merged browser QA — final acceptance

2026-09-15. All 76 current distinct integrated-browser cases have passing evidence: 48 actual-handler cases and 28 supplementary response-mocked contract cases. The original74-case acceptance and subsequent two-case regression addition are recorded separately below. Independent security recovery (16), connected business journeys (12), and guided accessibility (4) are subsets, not additional totals.

## Results and evidence

- Full integrated suite: 70 passed, 4 failed in 4.6 minutes. All four failures were the same two supplementary mock cases on mobile and desktop: a localhost allowlist called `continue()` before discovery/presence mocks could run. Corrected it to `fallback()`; no product assertions were loosened.
- Complete supplementary contract rerun: 26/26 passed in 19.7 seconds. This closes all four failures; the original failed log is retained.
- Guided review/presence accessibility: 4/4 passed in 18.8 seconds and passed again inside the full suite. Covers 360px mobile and 1280px desktop, keyboard navigation, retained review draft, one main landmark, normal and 200% CSS zoom without page overflow, and actual assignment-gated presence sharing, explicit stop and server-clock expiry.
- Existing frontend suite: 176 passed and 30 public-fixture connection failures in the initial 206-case run. The exact 30 public cases passed on the correctly configured port4407 in 11.1 seconds. All 206 distinct cases therefore have passing evidence; the initial run was not a single206-pass run.
- Following the shared navigation wrapping fix, the affected existing navigation/direct-link/keyboard and200%layout subset passed 8/8 in13.3 seconds. These overlap the206 existing cases.
- Focused ESLint over `tests/integrated-browser/*.mjs` passed. Root owns final project lint, type checking and production build.

Durable logs and four mobile/desktop guided review/presence screenshots are in `docs/launch/central-sandbox-final/browser/`. That directory also contains exact finance and identity handler source manifests, including the sandbox discovery route and sorted sandbox migrations.

## Connected behavior proved

The12 new connected cases cover actual paid-finance training import and separate assessment; company representative responsibility and independent owner decision; assignment incident lifecycle; officer checkout, client dispute, separate resolution and pay review; separately prepared/approved specialist activation; and actual two-employer completed service consumed by one independently reviewed payroll with conserved employer splits and private printable download. Original identity, attendance, engagement and immutable source history are asserted. Primary and sandbox stores remain separate.

Root corrected the service workspace projection to use authoritative operations reviewClients/owner data, changed embedded sandbox readiness to a section, constrained the sandbox map grid, and fixed shared navigation text wrapping at200%zoom. These are tested in the final evidence. A suspected desktop draft loss was a test locator issue: React textarea contents changed exact getByLabel matching while the accessible textbox name and draft remained intact. Tests now use the correct accessible-role locator.

## Scope and boundaries

Tests import the current merged root, install canonical sorted drizzle and all sorted sandbox migrations, and use real route/service implementations against disposable SQLite stores. Opaque local cookie sessions emulate verified identity; caller-supplied trusted headers are rejected. No hosted authentication, external payment/identity provider, production dispatch, or real account acceptance is claimed. External provider fetch is denied.

Scenario helpers construct source chains through existing services rather than inserting replacement approved applicants, timesheets or payroll records. Existing fixtures supply explicitly fictional supporting sites, rosters, accounts, settlement and qualification evidence. Those prerequisites are not claimed as browser-created or externally verified. The final independent training readiness decision uses the actual guarded HTTP route; it is not browser coverage of that particular decision control. Fault tests deliberately hide or replace responses after actual handler work to verify recovery and immutable history.

Presence expiry is verified using a disposable server/SQLite clock advance. Browser wall-clock countdown screenshots are illustrative and are not an assertion of synchronized device/server clocks. The200%check uses CSS zoom, not an operating-system magnifier or physical device test.

## Handoff

All browser execution is complete. Verified root-owned handler4406 PID1870499/session90419 and public fixture4407 PID1852366/session62530 were stopped; both ports were confirmed closed. Root-owned UI4405 remains for root to stop before its build. Owner preview ports4395/4396 were not touched. After building, start a fresh merged handler/UI baseline for review instead of retaining an expired test scenario.

## Final finance rejection regression — subsequent source fix

Independent security review reproduced a transient unhandled rejection when records returned403 before the capabilities fetch settled. Root changed both fetch/read chains to attach rejection handlers immediately. Added one test on each viewport: records403 immediately, capabilities200 delayed100ms; assert response ordering, private record and draft removal, and no pageerror or browser unhandledrejection after the late response settles.

The existing finance denial and new early-denial cases passed4/4 in3.5seconds on mobile/desktop. Evidence: `docs/launch/central-sandbox-final/browser/finance-early-denial.log`. Focused test ESLint passed. This adds two distinct mocked cases (current total76=48actual+28mocked); the two rerun existing denial cases overlap earlier coverage. No full-suite rerun is claimed.

The scoped-run UI4405 PID1881548/session2134 and handler4406 PID1881471/session15827 were stopped after verification; both ports were confirmed closed. Root repeats the final build after this product fix.
