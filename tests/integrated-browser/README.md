# Local actual-handler browser rehearsal

Never imported by the application or deploy build. Loopback-only, explicit opt-in, opaque fictional sessions, external provider network denied. No Clerk acceptance is implied. Keep two distinct databases in combined mode: unmarked primary DB and marked versioned SANDBOX_DB. Never alias the bindings. The actual candidate files are read from explicit absolute roots and hashed into `test-results/integrated-browser/*-candidate-manifest.json`.

From this checkout:

```sh
LOKD_LOCAL_HANDLER_FIXTURE=enabled LOKD_FINANCE_CANDIDATE_ROOT=/srv/ammosync/workspaces/lokd-security LOKD_IDENTITY_CANDIDATE_ROOT=/home/ammosync/.codex/visualizations/2026/09/13/01a09c3c-0e07-7132-88c8-123a1dbfc216/identity-sandbox-completion node --experimental-loader=./tests/cloudflare-loader.mjs tests/integrated-browser/server.mjs
node node_modules/vite/bin/vite.js --config tests/integrated-browser/vite.config.mjs --host 127.0.0.1 --strictPort
TMPDIR=/dev/shm/lokd-frontend-browser PLAYWRIGHT_TEST_CACHE_DIR="$PWD/../playwright-cache" node node_modules/@playwright/test/cli.js test finance.spec.mjs identity.spec.mjs --config tests/integrated-browser/playwright.config.mjs
```

The commands above describe the historical owner-candidate mode. Current Central acceptance uses merged mode below, which supersedes that setup and supports running every spec serially in one suite: original `intake.spec.mjs` reads the distinct primary store, while sandbox journeys use SANDBOX_DB. `sandbox-contract.spec.mjs` remains supplemental response-mocked UI coverage even when run in the same suite. Create the temporary directory first if absent. Tests reset the isolated stores; never run alongside manual review. Stop fixture servers before building to serialize cache/database operations.

The fixture only emulates verified middleware headers after an opaque server-held local cookie session. Caller headers are discarded. Provider fetch is denied. Hosted Clerk DEVELOPMENT testing belongs to the supplied identity owner's harness; never repurpose this test toolbar as a production login.

## Central merged handler expansion

Use `LOKD_MERGED_HANDLER_FIXTURE=enabled` with the explicit local fixture opt-in to import only this root checkout. Canonical sorted drizzle migrations and all sorted sandbox-migrations are installed once; primary and sandbox databases remain separate. Set `LOKD_HANDLER_PORT=4406` for the server and both `LOKD_UI_PORT=4405 LOKD_HANDLER_PORT=4406` for Vite. Set `LOKD_UI_PORT=4405` for Playwright. Central owns server startup/shutdown; keep owner ports4395/4396 untouched.

`connected-governance.spec.mjs`, `connected-service.spec.mjs`, and `connected-payroll.spec.mjs` use `/__fixture/scenario` only to construct prerequisites through existing sandbox identity/readiness, independently reviewed client, workforce and finance service fixtures. There are no mocked API responses or raw approved applicant/timesheet/payroll inserts in the new tests. Existing surrounding fixtures supply explicitly fictional site, roster, account, settlement and qualification evidence; these are not claimed as browser-created or external-provider verified. The period scenario follows the existing real two-employer service fixture, including actual transitions/dispositions, renewed terms, independent service pay review and an eight-hour rest interval; the browser performs the target payroll preparation and review.

The route fixture installs opaque local cookie sessions, including separate maker/reviewer/assessor/representative actors. The scenario clock advances both JavaScript and SQLite time, resets on scenario cleanup, and is never part of application builds. Run these specs serially: every scenario replaces the isolated fixture store. Snapshots are read-only assertion receipts and must not be used to seed replacement approved sources. The training browser case uses the actual guarded readiness-decision HTTP route for its final independent decision; this step is HTTP acceptance, not coverage of a readiness-decision UI.

Final expansion also includes `guided-accessibility.spec.mjs`: keyboard navigation into saved-source review, one main landmark after embedded readiness opens, 200% CSS zoom and viewport overflow checks, and actual assignment-gated presence share/stop/server-expiry readback. `/__fixture/advance` advances only the current disposable scenario clock (maximum24hours); no stored evidence dates are rewritten. Existing primary-route intake tests inspect `/__fixture/state?scope=primary`, preserving original public handler coverage while keeping sandbox and primary databases separate.
