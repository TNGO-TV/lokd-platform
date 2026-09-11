# LOKD live signup and Operations intake — 11 September 2026

Owner instruction: proceed with working signup/account linking; remove public demo experiences and prepare live deployment. This supersedes the old public rehearsal presentation. Clerk authentication and actual role grants remain authoritative. Operations MFA remains temporarily disabled by the owner's prior instruction.

## Implemented behaviour

- Officer applications and client enquiries persist in D1. Receipts lead to the corresponding Clerk portal. A verified matching email can link a submission to its stable Clerk user ID; a reference alone grants no access. A later email change does not transfer a linked record to another account.
- Applicants can view dated status/activity, correct allowed fields, resubmit and withdraw. Operations can request information or mark intake reviewed with an applicant-visible explanation. Operations cannot review its own submission. Intake review grants no operational role, deployment eligibility, identity verification, contract or payment approval.
- Migration 0035 adds signup cases, immutable event history, source guards and stable owner binding. Updates use expected versions to reject stale writes. Original submissions remain intact; the signup correction overlay is authoritative for the reviewed details. Future conversion must consume these amendments rather than copy stale original fields.
- Registered officer applicants require a numeric PSiRA number and can access their own verification case after account linking. Official registration evidence, identity matching and recheck dates remain separate. Training and unregistered paths do not require a registration lookup. Changed numbers do not inherit verification.
- Production portals show real intake records and useful empty/error states. Homepage no longer shows invented work offers, earnings, passports or officer locations. Historical synthetic workflow APIs and passport views are unavailable in live mode. Pilot feedback is only rendered in local rehearsal mode.
- Live stage must be `production`. The internal `prelaunch`/`user_submitted` provenance on genuine intake is retained to avoid relabelling synthetic data as real. Historical fixtures and rehearsal code remain isolated for regression tests.

## Acceptance and recovery

- Final build/regression run: 241 tests passed after the pilot-feedback and intake-tab loading changes.
- TypeScript passed; changed-file lint passed with image optimisation warnings only.
- Eight mobile/desktop form journeys passed, including failure/retry preservation, validation and training/unregistered exemptions. These use intercepted form responses; they do not prove provider acceptance.
- Nine existing Clerk development account/PSiRA/MFA journeys passed. New live-routing browser coverage exercises persisted submissions, account linking, Operations correction requests, applicant resubmission and review. Final outcome recorded below after completion.
- Test runner provisions and deletes isolated Clerk development identities without inboxes. `LOKD_ACCOUNT_TEST_STAGE=production npm run test:accounts -- --grep 'real persisted signup'` tests live routing with development credentials only. Never use production keys in this runner.
- Use `.sites-runtime/browser-libs/usr/lib/x86_64-linux-gnu` as LD_LIBRARY_PATH for standalone Playwright runs on this machine. The account runner supplies it automatically.
- Isolate review identities from MFA-enrolment tests. Use explicit visible status locators (a review select option has the same text as its displayed outcome). Wait for the PSiRA form before selecting the registration pathway.
- Local browser DB was backed up to `/tmp/lokd-before-signup-browser.sqlite`; full migrations were used for the disposable local run. Restore by SQLite backup with the local server closed, not cross-device rename or raw copying over an active database. Temporary users and `.dev.vars` are removed by the account runner.

## Still required for service launch

- Owner must name the first Operations account and complete a real Google sign-in. Google is configured, but development email-code automation does not prove a person's production Google OAuth journey. No email is promoted based on CLI identity or Sites ownership alone.
- iiDENTIFii credentials and accepted failure/manual-review/eligibility behaviour.
- Supported payment provider credentials and accepted collection, reconciliation and officer-payment paths; no live financial acceptance is claimed.
- Approved client/officer documents, signing provider and verified signed-document binding/activation.
- Real booking-to-service-to-payment operating acceptance. Historical controlled cycles are synthetic, not live financial evidence.
- A consented live officer-presence map is not implemented; no synthetic map is presented as real time.

This milestone opens real intake and review. It does not certify readiness to take money or deploy security services.

## Predeployment acceptance completed

Both live-routing signed-in browser journeys passed with Clerk development identities and persistent local D1: Officer including PSiRA submission (20.7 seconds), Client including Operations review (18.3 seconds). Eight mobile/desktop form journeys passed. Client tab switching is disabled during loading to avoid overlapping initial-list requests. Original local database restored and integrity checked; temporary Clerk users/configuration cleaned up. Production deployment receipt follows after publishing.

## Deployed release receipt

- Sites version: **45**, public; succeeded **2026-09-11 00:59:54 UTC / 02:59:54 SAST**.
- Source: `8fd1e1dde9f9799bd27f592cce497469002ebf7a`.
- Project: `appgprj_6a88a08505548191b266e9b711562ae3`.
- Version ID: `appgprj_6a88a08505548191b266e9b711562ae3~appgver_b1bb3804440881918da5bb2ebafbc78c`.
- Deployment: `appgdep_6aa35277459c819180db3dcb9585fdf9`.
- Environment revision **7**: `LOKD_APP_STAGE=production`; `LOKD_OPERATIONS_MFA_REQUIRED=false` and `LOKD_LIVE_SHIFT_SCAN=false` retained. Clerk keys and access configuration preserved.
- Archive SHA-256: `2fc840b2e0dc26cd34c45cf26824ba121c413b6c7507e45774c9025c8803211d`. Archive includes migration 0035; no environment files, private PSiRA test number or provider secret keys found.

Live checks on 11 September from 01:00 UTC confirmed LOKD.co.za homepage, /join and /contact return 200; homepage contains the real-account presentation and no demo label or invented R800 offer. Client, Officer and Operations domain roots redirect to /client, /officer and /ops respectively; each protected page redirects an anonymous visitor to its own sign-in page, and all three sign-in pages return 200 with the correct role heading. Signup API returns 401 anonymously. Historical pilot/application-list APIs return 401; passport API returns 423 and /verify explicitly states live passport verification is unavailable. Recent error-only Worker log query returned no events.

Default Python user-agent requests received edge 403 responses; identified release-check requests succeeded without configuration or access-policy changes. This is an HTTP smoke check, not a completed Google OAuth or authenticated production intake acceptance. No production synthetic applications or financial records were created by these checks.

Final local evidence: 241 regression tests, TypeScript, changed-file lint (image optimisation warnings only), eight form browser journeys and both Clerk development live-routing signup journeys passed. The prior nine account/PSiRA/MFA checks also passed. Test accounts and temporary local configuration were cleaned up and the original local D1 database restored.

Resume: obtain explicit first Operations owner email and complete that person's production Google sign-in/account assignment. Then finish provider/document acceptance as listed above. Do not restore synthetic portal data, enable transactional endpoints, or represent intake review as service approval.
