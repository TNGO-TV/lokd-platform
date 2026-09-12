# Client verification review and production service orders — 12 September 2026

Receipt: owner said “Continue building.” Same LOKD task and checkout, baseline clean 3408bf3 / deployed v51. No changes to other projects, keys, infrastructure, production account grants or owner-authorised MFA exception.

## Built
- Operations records a manual source-document review of client identity, company registration and representative signing authority against exact current client details and intake version. Source check time, expiry and findings are mandatory. This is a recorded human review, not a claim of automated provider verification.
- An independently assigned Operations owner approves or rejects. Preparer and applicant cannot approve their own review. Approval requires explicit independent source checking. Immutable review/decision records are retained. Exact current intake/details, expiry and suspension checks are enforced at database commit. Raw candidate promotion remains rejected without a valid independent approval.
- This resolves the previous candidate-account dead end using a specific reviewed transition, not by marking preparation itself verified. Rejections retain history; another review can be prepared. Suspended accounts can reconcile current independently reviewed corrections and obtain a new decision. Intake/detail changes suspend approval. Expired reviews fail service readiness; commit-time guards also reject activation/check-in after approval expiry or invalidation.
- Operations can price and prepare a production service order for a currently approved client. Uses the existing pricing, risk, specialist and cost-floor modules. Client-supplied clocks or totals are not authoritative. Repricing/hash mismatch, reused references with different details, self-preparation and stale client approval are rejected.
- Preparation atomically stores exact source request/quote, booking, actual site coordinates/address, post instructions and audit. Sites/posts remain pending_review, booking stays draft and unfunded, and no service is activated or payment initiated. Draft risk input is not presented as independently verified site-risk evidence.
- Roster preparation adds the next 20 missing shifts using authoritative per-shift economics and South Africa timing. Deterministic slot references deduplicate retries. It does not silently overwrite existing shifts. Client approval is rechecked at commit. Clients can see their own service orders; other accounts cannot see them.
- Account screens are connected at /ops/service and /client/service. Existing Clerk roles and approved-agreement signing remain intact. Training packages were not invented. Test inputs stay in disposable test databases.

## Checks and lessons
- Full build and 257 regression tests passed. Existing integration test expanded through candidate preparation, independent verification decision, suspension/reconciliation, priced order and roster creation, duplicate/reference conflict, access isolation, expiry and unfunded/pending-review assertions.
- Initial order fixture exposed missing flattened payroll cost components required by the existing pricing guard. Corrected the stored breakdown to include the existing pricing decision fields; did not relax the pricing guard. Focused workflow and subsequent full regression passed.
- TypeScript and whitespace checks passed. Browser acceptance and publication appended after completion.
- SQL uses parenthesised CASE expressions in triggers, retaining the successful v51 deployment-parser lesson.

## Remaining work and resume
Next implementation is reviewed site/post/workforce preparation and production service completion/timesheet/dispute/payroll commands, then the Paystack collection and officer-payment adapters. These are still code integration gaps, not all external dependencies. Preserve established policy modules and disabled live-operating acceptance flags rather than exposing synthetic APIs.
Real owner assignment, approved legal wording and entities/employer decisions, provider financial/identity acceptance, Google account acceptance and actual PSiRA identity matching remain separate inputs/checks. No real client approval, contract, service, money movement or provider dispatch was performed by this build. Existing R350 test checkout remains the same pending owner test; no duplicate checkout or repeated request.

Logs: /tmp/lokd-client-review-test.log, /tmp/lokd-client-order-test.log, /tmp/lokd-client-order-regression.log, /tmp/lokd-client-order-browser.log, /tmp/lokd-client-order-final-ts.log. Preserve failure evidence and rerun only checks affected by a repair.

## Browser acceptance and final validation
- Authenticated Client, Operations reviewer and separate owner development sessions passed: 1 test, 24.8 seconds / 30.7 seconds total. The browser exercised independent source review approval, priced order preparation, roster creation and the Client's own draft/unfunded order, alongside existing negative privileged-access and test-document approval checks. Mobile client view had no horizontal overflow.
- The first run timed out. A bounded diagnostic rerun identified the Approved client selector's implicit accessible name as the stopping point. Added explicit accessible names to all order selectors, retained the same acceptance assertions, and passed the full browser journey. Test cleanup now retains the original failure rather than masking it with a context-close exception.
- All temporary development users/configuration were removed and original local D1 restored. No synthetic data was inserted into production. Final TypeScript and targeted ESLint checks passed. Fresh build passed after the accessibility change. Build output was checked for exact development Clerk key values: none present.
- Initial lint command resolved the system ESLint instead of the project version. Used the existing project's explicit ESLint executable; no installation/configuration change was needed.
- Earlier 257 regression tests apply to the unchanged backend. No unnecessary full backend rerun after the selector-only change.
