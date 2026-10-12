# Testing round — 24 September 2026

## Actual hosted results on v89

- 15 homepage-linked URLs passed in mobile Chromium: HTTP200, no horizontal overflow, no page/console errors. URLs were extracted from actual links rather than guessed. HOSTED-LINKS.json.
- Client, Operations and Officer sign-in forms render with an email input, no browser errors and no overflow. No credentials were submitted in this hosted check. HOSTED-SIGN-IN.json and screenshots.
- Presence returns200 and an empty area list. Readiness returns200 with all218 tables,794 triggers,68 views and311 indexes, plus evidence storage binding. This is schema readiness, not provider or operational acceptance. HOSTED-DIAGNOSTICS.json.
- Six negative requests passed: anonymous quote/delivery/production-operation reads denied401; unsigned test webhooks denied401; missing booking-webhook mode denied422. These are our rejection probes, not genuine provider callbacks. HOSTED-NEGATIVE.json.
- The bounded30minute error log returned these six expected denials, two incorrect guessed paths from the first diagnostic, and an unrelated404 WordPress probe. No5xx in that bounded result. WORKER-ERRORS-SANITIZED.json contains no request headers/IPs.
- Initial guesses /services and /login were incorrect probe paths; actual public navigation links pass. The local presence503 and nonce warning were not reproduced on the hosted homepage. Do not present the guessed404s as site navigation defects.

## Actual authentication provider with local application

Read-only Clerk production lookup verified the existing Operations, testclient and testreviewer identities, verified emails, password availability and prior sign-ins. No account registration or access grant was needed. CLI administrator OAuth is expired, but the configured backend key supports reads. Production sessions were not impersonated, exported or modified.

The isolated account regression initially failed because email-code sign-in is disabled in the development instance. Password experimentation returned without establishing a session; a resolved helper call was insufficient proof. Browser request-failure diagnostics then established CSP-denied Clerk development UI chunks. The Worker always generated the production Clerk origin policy, despite the local development keys. Temporarily testing the correct development policy established actual sessions and progressed the application. That experiment stayed in /tmp/lokd-account-qa and was never published.

Permanent candidate in /tmp/lokd-clerk-test-fix chooses the existing development CSP only for NODE_ENV=development. Production and an unset environment still use the production-only origin. Focused policy tests pass. The browser test uses the official Clerk development sign-in helper for its newly provisioned synthetic users and explicitly verifies an active user. It also replaces an obsolete agreement-page assertion with the current quotes empty state.

Expanded regression PASS: CLERK-QUOTE-BROWSER.log,40.4seconds test time,47.5seconds run. Actual Clerk development sessions, actual local application handlers and disposable local D1/R2; no mocked HTTP application responses. It covers client intake linking, independent review, service order/site preparation, permission separation, dummy PDF UI upload and exact-hash download, quote issue, wrong-account file/acceptance denial, Operations acceptance denial, missing checkbox/wrong hash rejection, browser checkbox acceptance, immutable receipt replay, cancellation, and replacement without inherited acceptance. Quote notification state was queued only. No Books or mail transport, provider payment, live customer or legal approval occurred.

Every runner reported temporary development user/configuration cleanup and local database restoration. The subsequent independent backend cleanup read is recorded in CLERK-CLEANUP.json. Existing canonical local databases and owner ports4395/4396 were untouched.

PR18: https://github.com/zenascapetown-code/lokd-platform/pull/18 . Candidate6ba9e98ab8004908a6196fda8e4598bcefcc5392; exact-head CI36014440171 pending at this entry. No change to v89 deployment or environment34 yet. Full release result will supersede this pending note.

Gate completed successfully:557 isolated tests passed, every job step successful. Fresh base/head verified and expected-head guarded merge completed. Merge452951992c5f8d336d34be734c669902b75fed04 has identical treecb0b1cf73a9ae1ed7d78a7adb0d1aefdae66f4bf to tested6ba9e98. Production build passed. Canonical checkout fast-forwarded with existing launch edits retained. Temporary development-key copies removed from both disposable checkouts. Independent Clerk read confirms zero remaining test identities. Sites publication is in progress; final deployment receipt will follow.

Final publication state: v90 saved with matching archive, but NOT DEPLOYED. Save initially failed at the tool serialization layer; readback confirmed no new version before one successful retry. All three deployment calls failed with `failed to serialize JavaScript value: expected value at line 1 column 1`. Saved-version reads between attempts and after the final attempt show deployment_id=null. Fresh site metadata confirms active/public, current owner, latest saved90. v89 remains the last successful deployment at environment34. No duplicate saved version, private/public visibility change, or alternative publication bypass was used. See PUBLICATION.json. Next release action is deployment of the existing saved90 after the tool recovers, not rebuild/resave.

Encrypted v90 source/build/evidence backup is also locally restored and verified; see BACKUP-v90.json for current hash. It includes the accepted merged source and built release, not a production data snapshot. No fresh off-host upload succeeded. Performance samples and a bounded inference are in HOSTING-DIAGNOSTIC.md; hosting latency remains unresolved.

## Recovery and outstanding work

Encrypted v89 source/build/evidence archive successfully decrypted and restored:37 file hashes and Git head verified. BACKUP.json records scope and SHA256b665a0cd8320e60f34a92c3bed63ea16a8c22d885e329c466e5fcf308612f3e3. No runtime secrets/recovery key included. Production data snapshot remains historicalv73.

Drive upload rejected by automatic approval review. The first reason was unverified folder access. Metadata then verified the existing backup folder private (shared=false) with Zenas as sole returned owner. The second review still requires explicit user authorisation for this payload and destination. A specific asynchronous approval question is pending; no upload succeeded and no indirect route was attempted.

Still open: actual production-hosted synthetic client/quote acceptance, booking/quote/agreement email delivery, actual Books document reconciliation and Paystack TEST checkout plus genuine provider callback. Existing enquiry delivery is already proven. Native tools still expose no control of existing authenticated desktop tabs; fresh Chromium remains usable. Dummy terms, missing registrations and live card details are not blockers. Real payments remain prohibited.

## Lessons and next evaluation

Validate the browser's authenticated user/session, not merely successful completion of a testing helper. Capture browser request-failure reasons to distinguish CSP denial from a provider outage. Keep development-origin allowances out of production. Test current quote acceptance through real development identities while explicitly separating local storage/queued notifications from hosted delivery. Next: complete exact-head gate/release, then continue the outstanding actual-provider/hosted matrix without resetting working accounts or resending delivered notifications.

References: https://clerk.com/docs/guides/development/testing/playwright/overview and https://paystack.com/docs/payments/test-payments/ . Provider test cards/EFT fixtures are documented independently of real card payments.


## Publication and approved backup completed — 24 September 2026

Owner confirmed “yes please deploy” after the repeated encrypted-v89 backup approval question. Uploaded the exact authorised v89 archive to the existing private Drive folder. File1DO3RvRP9c8lzi3wn91yQZ8APYMSetm7l readback confirms19760353bytes, expected filename/parent, shared=false and owner Zenas only. Local SHA256 remainsb665a0cd8320e60f34a92c3bed63ea16a8c22d885e329c466e5fcf308612f3e3. Provider checksum is not exposed by this metadata projection; downloaded-byte verification is not claimed. See DRIVE-UPLOAD-v89.json. The previous approval blocker is resolved. v90 encrypted backup remains locally verified; this upload was specifically v89.

Existing saved v90 successfully deployed as appgdep_6ab53eb0a7148191b87dff4059ab34f1 at2026-09-24T15:16:48.863874Z, environment34 unchanged. This supersedes all earlier v90-not-deployed notes. No rebuild or duplicate saved version. Actual hosted Client/Operations/Officer sign-in forms pass with no errors or overflow, nonce policy present, production Clerk origin allowed and development host excluded. See DEPLOYMENT-v90.json and V90-HOSTED-SIGN-IN.json. Real payments remain disabled; actual hosted client acceptance and remaining provider test journeys are still open.
