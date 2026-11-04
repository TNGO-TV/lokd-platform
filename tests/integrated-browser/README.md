# Production intake integration

The required release report remains `test-results/integrated-browser/browser.json` and must contain 78 passing checks (39 cases in mobile and desktop projects). The browser harness mounts the production enquiry component and actual API handlers with a fully migrated local SQLite database. Outbound provider fetches are denied, identity headers are stripped, and the fixture server binds only loopback. Coverage includes all offered services, validation, body limits, same-origin enforcement, authenticated access denial, durable receipt retries, data integrity, retention deadlines and responsive rendering. Retired screen specifications have been removed.

Run `node node_modules/@playwright/test/cli.js test --config tests/integrated-browser/merged.config.mjs` after a production build.
