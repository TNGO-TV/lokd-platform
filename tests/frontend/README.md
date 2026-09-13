# Frontend checkpoint validation

Run from the repository root with dependencies installed:

1. `node_modules/.bin/vite --config tests/frontend/public-preview.config.mjs --host 127.0.0.1 --port 4178 --strictPort`
2. `node_modules/.bin/vite --config tests/frontend/vite.config.mjs`
3. `PLAYWRIGHT_BROWSERS_PATH=/home/ammosync/.cache/ms-playwright node_modules/.bin/playwright test --config tests/frontend/playwright.config.mjs`
4. `PLAYWRIGHT_BROWSERS_PATH=/home/ammosync/.cache/ms-playwright node_modules/.bin/playwright test --config tests/journeys/playwright.config.mjs --output outputs/frontend-checks/intake-results`

Use the installed Playwright browser path for your host. Servers use separate dependency caches. Stop the previews before the production build. The public preview runs actual application routes; role screenshots render actual production components inside the shared shell with synthetic browser API responses. Routing/Clerk adapters exist only in this fixture server. They are not authenticated acceptance, role-security tests, provider acceptance, or permission to operate. No test accounts, `.dev.vars`, production records or external API calls are required. Do not mount this harness as an app route or deploy it.
