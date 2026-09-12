# Connected LOKD test build — 12 September 2026

## Receipt and scope
Owner resumed the existing LOKD implementation and asked to finish the build. Owner confirmed approved agreements, training packages and first Operations email are not supplied, then explicitly authorised building functions with test documents. This authorises test wording, not fabricated training packages, production signatures, live work or financial acceptance. Baseline was clean 8a3fff6 / deployed v48. No other project, provider credentials, infrastructure, Clerk configuration or account grants changed.

## Implemented and connected
- Account-delivered test agreements for Client and Officer submissions: Operations issues exact immutable wording/version/context to the bound Clerk user; the account holder reads, downloads and affirmatively signs; independent Operations review follows. Download contains the test text and signature record. It is plainly labelled NOT A LIVE CONTRACT. There is no automatic legal or identity approval.
- Seven-day expiry, application-version invalidation, immutable dated issue/sign/review/cancellation history, rejection of stale writes and self-review, and controlled reissue after cancellation/expiry. Repeated issue requests reuse the current envelope. Existing production legal receipt/activation tables are untouched; test signatures cannot satisfy those gates.
- A complete authenticated test operating cycle at `/client/test-cycle`, `/officer/test-cycle`, `/ops/test-cycle`, linked from the portals. Independent reviewed client/officer intake and test signatures precede creation. Operations supplies the test service/timing brief and test ZAR amounts; no package benefits or wages are invented by the system.
- Client accepts the exact immutable test booking; Operations records simulated collection; Officer starts/completes simulated service; Client signs off or disputes; Operations resolves disputes, prepares and records simulated officer payment; Officer acknowledges the test receipt. Cancellation before test funding closes the booking; cancellation after test funding requires a recorded simulated refund. Version checks and immutable history prevent stale transition replay. Changed/withdrawn intake or cancelled/expired signatures block further progression, including commit-time checks. Training applicants cannot enter the registered-officer service cycle.
- These financial steps are explicit fixtures, not Paystack API calls. They coexist with the existing applicant-bound Paystack R350 TEST checkout and its signed-webhook reconciliation. They never become production financial evidence.
- Homepage officer-presence map with locally stored Natural Earth South Africa outline. Public API returns aggregate approximate areas, never names/user IDs/exact coordinates. Public markers require an opted-in assigned officer on a checked-in production assignment with current snapshot validity; signals expire after 180 seconds. Public map refreshes every 30 seconds. No production markers were manufactured.
- Officer sharing controls request browser location only after explicit consent, round to approximately 11 km areas before sending, refresh each minute while visible, and provide stop sharing. Private synthetic test sharing uses fixed test coordinates and cannot enter the public query. Denied permission/missing assignment/storage failure do not publish a marker. Map request timeout clears unconfirmed results. It is self-reported presence, not proof of availability or an emergency dispatch system.

## Acceptance evidence
- Full production build and **254 regression tests passed**, including existing Clerk/PSiRA/identity/payment/activation tests and new signing, complete cycle, dispute/refund, stale-binding and presence-isolation tests. No skipped tests.
- TypeScript and whitespace checks passed. Final production build passed after the UI-only hydration/timeout corrections; already-passing backend tests were not repeated unnecessarily.
- Real Clerk development identities and persistent disposable local D1 were used for the authenticated browser journey. Client and Officer signed their own test agreements; Operations prepared the test booking; each account performed its assigned steps through completed officer receipt. Mobile Client view had no horizontal overflow. Private synthetic presence stayed absent from public results.
- Initial browser run reached completed payment receipt, then lost an early click on the SSR-visible presence button before hydration. Added a ready guard, reran the journey successfully: **1 passed, 39.0s test / 44.9s total**. Non-blocking native details hydration warnings observed; no acceptance expectation was relaxed. No screenshot or production synthetic record was created.
- Temporary Clerk users/configuration removed and original local database restored through SQLite backup. Browser test is `tests/accounts/complete-cycle.spec.mjs`; run with the existing account runner in production-routing mode and a disposable fully migrated local database.
- Logs: `/tmp/lokd-complete-build-tests.log`, `/tmp/lokd-complete-browser.log` (failure retained), `/tmp/lokd-complete-browser-final.log`, `/tmp/lokd-complete-final-build.log`, `/tmp/lokd-complete-final-ts.log`.

## What this does not complete
The connected test build is usable for walkthroughs. It is not a claim that replacing text and keys alone enables production service. Live signing/provider adapter selection and approved legal evidence must be bound to production activation; real applicant-to-operational-record conversion and the real booking/service/collection/officer-payment operating acceptance remain gated. Existing mature internal activation/payroll policy tests are not substituted with this simpler test-cycle state machine.

Production Google account acceptance and named Operations ownership remain pending. Training commercial packages remain owner-supplied; no training payment package was invented. VerifyNow remains sandbox-only; live identity/PSiRA identity matching and provider failure acceptance remain independent. Existing R350 dummy completion and an applicant-bound checkout's actual transaction/webhook agreement remain outstanding; no repeated checkout request or provider dispatch was made in this turn.

Live GPS marker acceptance needs a real authorised, checked-in production officer and explicit location consent. Automated tests establish test isolation/denial, not real officer location or a completed production activation. No background GPS tracking is claimed when the page is closed; expiry removes old signals from public responses.

## Resume method
1. Reuse deployed code and fixtures; do not recreate the site or duplicate the task.
2. For a walkthrough: submit/link separate Client and registered Officer accounts, complete Operations intake review, issue/sign/review each test document, then open Test operating cycle from Operations and proceed through each role. Test money remains simulated. The R350 Paystack checkout is a separate provider test.
3. Owner supplies the first Operations email, approved legal documents and actual training packages. Complete production account/Google acceptance and approved signing/provider linkage before enabling real operations. Keep identity, PSiRA, signing, payment and work eligibility distinct.
4. Keep the recorded R350 checkout; do not generate another dummy merely because completion is pending. Resume provider acceptance from the v48 receipt.
5. Preserve this build's failure/success evidence. Use hydration-ready controls for actions rendered before client handlers attach; never mask lost actions with arbitrary test sleeps.

Release receipt follows after deployment.

## Release receipt
- Source 61f81f73e4b8078106063d945dd7681885d12b26 pushed; published **v49**.
- Version: appgprj_6a88a08505548191b266e9b711562ae3~appgver_f34eccd889b4819183e86eb746199f73.
- Deployment: appgdep_6aa569c42ca081919edf454e1fb31471, succeeded 2026-09-12T15:04:07.255194Z, existing environment revision **9** retained.
- Returned production URL: https://lokd-security.zenas-capetown.chatgpt.site. Existing canonical LOKD.co.za audience/domain configuration preserved.
- Archive validated for worker, project identity, migrations 0039–0041 and exclusion of environment files, tests and private artifacts. Current Sites 0.1.62 packager worked directly; no LF workaround or infrastructure installation needed.
- Local browser acceptance and production publication are separate evidence: no production accounts, real GPS positions, signatures, services or payments were created for acceptance. No new live provider acceptance is claimed.
- Final handoff uses the existing lokd-site tab. Working tree is clean after this documentation-only receipt. The connected test milestone is accepted; the production readiness requirements above remain open.
