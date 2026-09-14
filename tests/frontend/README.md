# Frontend checkpoint validation

Run from the repository root with dependencies installed:

1. `node_modules/.bin/vite --config tests/frontend/public-preview.config.mjs --host 127.0.0.1 --port 4178 --strictPort`
2. `node_modules/.bin/vite --config tests/frontend/vite.config.mjs`
3. `PLAYWRIGHT_BROWSERS_PATH=/home/ammosync/.cache/ms-playwright node_modules/.bin/playwright test --config tests/frontend/playwright.config.mjs`
4. `PLAYWRIGHT_BROWSERS_PATH=/home/ammosync/.cache/ms-playwright node_modules/.bin/playwright test --config tests/journeys/playwright.config.mjs --output outputs/frontend-checks/intake-results`

Use the installed Playwright browser path for your host. Servers use separate dependency caches. Stop the previews before the production build. The public preview runs actual application routes; role screenshots render actual production components inside the shared shell with synthetic browser API responses. Routing/Clerk adapters exist only in this fixture server. They are not authenticated acceptance, role-security tests, provider acceptance, or permission to operate. No test accounts, `.dev.vars`, production records or external API calls are required. Do not mount this harness as an app route or deploy it.

The 14 September finish adds a fully local, synthetic manual preview:
`http://127.0.0.1:4181/ops/readiness?preview=1` (start the fixture server with `--port 4181`). The banner links Client and Officer views and conflict/unavailable scenarios. No production keys or accounts are used. `LOKD_FRONTEND_BASE_URL` selects the test server; the browser runner defaults to installed full Chromium. `LOKD_BROWSER_CHANNEL` can select another installed compatible channel. Read `docs/launch/FRONTEND-FINISH-HANDOFF-2026-09-14.md` for supported contracts and explicit delivery/audit blockers.

For a bundled local preview, build with `node node_modules/vite/bin/vite.js build --config tests/frontend/vite.config.mjs --outDir /tmp/lokd-frontend-finish-preview-dist`, then serve with `node node_modules/vite/bin/vite.js preview --config tests/frontend/vite.config.mjs --outDir /tmp/lokd-frontend-finish-preview-dist --host 127.0.0.1 --port 4181 --strictPort`. Both browser executables experienced resource failures on long multi-navigation runs in this environment; bounded screenshots and a fresh browser per manual review page were reliable. Consult the final evidence report rather than assuming the full suite passed.

Central runner correction: on this host `/dev/shm` has ample space while the temporary filesystem is constrained. Set `LOKD_BROWSER_NATIVE_SHM=true` to let Chromium use native shared memory. This retains the full suite, assertions and screenshots; it is a test-runner setting, not an application change. Do not enable it on hosts without sufficient shared memory. Earlier failed runs remain historical evidence.
