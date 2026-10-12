# Dummy quote acceptance — 25 September 2026

## Outcome

The owner-authorized dummy agreement completed actual browser acceptance against the unchanged v97 application in an isolated local environment, using separately authenticated Clerk development accounts. No manual login, real identity/company documents or live card were needed. Hosted sessions and production records were untouched.

The actual dummy PDF was uploaded, independently approved by a separate test account, downloaded by the client and checked against its SHA256. The client checked the acceptance box, accepted the quote, and downloaded the receipt. The downloaded receipt hash matched the stored receipt; repeat acceptance retained it. Wrong-account access, missing affirmation, wrong offer hash, cancellation and a fresh unaccepted revision were checked.

Browser result: 1 passed (49.3 seconds including startup). The development identities and temporary local runtime configuration were cleaned up; the original isolated local database was restored. Development-account separation is test coverage, not an independent human business decision.

A continuous actual-handler journey also bound one dummy quote through simulated notification acceptance, PDF download, client acceptance and exact Books comparison. All 15 quote/accounting tests passed. They cover mismatched customer, currency, amount, tax and revision, immutable links, authorization and network races. Email/Books transports in this handler suite are explicitly simulated. No external email was sent, no Books document was created, and no collection was dispatched by this run.

## Reproducible test repairs

The account runner now initializes its missing local database using the installed Miniflare compatibility API and explicit project-local persistence. The existing browser test now uses the current inline approval forms instead of relying on retired native dialogs. It saves the actual downloaded receipt and mobile screenshot. No application or production approval control was weakened or changed.

Run from the isolated checkout with existing development-only .env.clerk-test:

    LOKD_ACCOUNT_TEST_INTAKE=true LOKD_ACCOUNT_TEST_STAGE=production PLAYWRIGHT_BROWSERS_PATH=/home/ammosync/.cache/ms-playwright LOKD_BROWSER_NATIVE_SHM=true node scripts/test-accounts.mjs production-connections.spec.mjs
    LOKD_DUMMY_JOURNEY_EVIDENCE=/tmp/lokd-dummy-linked-journey.json node --experimental-loader=./tests/cloudflare-loader.mjs tests/quote-acceptance.test.mjs

The stage value exercises production application checks only against the runner's isolated local DB/R2 and development authentication; it does not connect to the hosted production database. The run creates disposable example.com development identities and deletes only those identities afterward.

## Remaining external acceptance

Actual quote-email delivery, an external Books document comparison for an accepted test quote, and order-linked Paystack TEST collection/settlement remain incomplete. Browser notification evidence is queued only. The provider-only Paystack TEST evidence from v96 remains preserved. The isolated acceptance receipt is not an acceptance of hosted ENQ-A499FA3E, and must not be attached to that production client's record.

These remaining steps require safe external test bindings and designated recipients, not real contracts, real identity documents or live credit cards. Follow WORKING-MANDATE.md. Live-card readiness remains unproven. No application deployment was needed for these test-only repairs.

## Browser acceptance references

- Quote: QUOTE-686ec79a-f0db-4075-98dd-0c57a09c3e30
- Order: ORDER-browser-order
- Receipt SHA256: acfb4d7de08612b7fa38217305f2dfc1e8aed5edd058021c23bee0ae896ccc46
- Terms SHA256: e3d57fe507e47a4fbab9d85dc2dbe1aaa4a34a3979e7f5eab169d90110a83afc
