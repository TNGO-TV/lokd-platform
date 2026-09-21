# Settlement review and LOKD.co.za review handoff — 12 September 2026

Owner requested the next payment task, connected workflow validation and loading LOKD.co.za for study and amendments tomorrow. Continued this existing LOKD task from v56/source 227bc6ed9e31e7d829e9fb7229990ec3c23e0e6c and receipt 3080901. No new task, subagent, infrastructure or payment-provider configuration was created.

## Built

- Server-only Paystack settlement and transaction-list retrieval with bounded complete pagination, explicit test/live mode, exact saved collection/transaction/source binding, fresh transaction API/signed-webhook agreement and immutable settlement snapshot/hash.
- Settlement review checks all transaction gross amounts and fees against the full successful provider settlement and the reviewed bank receipt's net amount. Unsupported fee splits, deductions, partial lists, duplicate transaction IDs, malformed amounts, wrong modes and mismatches fail closed. Only minimal target transaction evidence is stored; unrelated customers/card/bank details are omitted.
- Independent funding-reconciler preparation/approval under real production grants and limits. Bank evidence and findings require separate reviewer confirmation within the 30-minute review window. Test confirmation never funds production.
- Live approval creates exact canonical booking_funding_reconciliations using the original collection reference and immutable review receipt. The gross client amount is reconciled as bank net plus explicit provider fees, retained in the settlement evidence; fees are not treated as unpaid client debt.
- Applying cleared funding to a booking is a separate guarded Operations action. Existing pricing/site/service-authority checks remain mandatory. Funding validity covers the current roster horizon, with new provider/recovery evidence able to hold funding immediately. Neither settlement nor applying funding activates shifts or releases payroll.
- Append-only refund/dispute recovery inbox and per-collection holds, including nested transaction envelopes and events received before transaction ID binding. Signature-selected mode remains authoritative; explicit domain conflicts are rejected. Turning off new live collection does not disable authenticated live recovery receipt when its secret remains configured.
- New conflicting collection evidence, provider recovery or manual investigation invalidates canonical funding. Old receipts and confirmed decisions remain; holds cannot silently be removed. No automatic refund, replacement charge or service cancellation.
- Operations settlement/bank evidence controls, independent decisions, explicit funding application and hold controls. Client sees own settlement outcome/holds; Officer cannot access another party's collection or settlement evidence. Internal bank evidence and Operations findings stay restricted.

## Connected workflow correction

The existing specialist booking readiness view expected site risk/post-order integrity labels to equal the booking's production_verified label, while the deployed independently reviewed evidence command intentionally produces verified source evidence. Funding application therefore correctly failed on unreviewed sites but would also reject properly reviewed source evidence. Migration 0053 adds a narrow acceptance path for verified source rows tied to their exact approved production_evidence_reviews entry, site and post. Legacy paths and all other guards remain. It also compares review timestamps with SQLite's fractional current time to avoid rejecting a same-second review.

The connected database journey now demonstrates: intake review → priced order → collection approval/unknown-delivery recovery → signed/API match → exact settlement and bank review → self-approval rejection → independent live settlement confirmation with mocked transport → funding blocked before site review → approved site/post evidence → funding application succeeds → signed refund holds the original funding. This is isolated fixture evidence, not a real payment.

## Tested / acceptance

- Full regression: 269 named tests passed, 0 failures/skips (/tmp/lokd-settlement-regression.log).
- Following the readiness-view correction: all 45 affected specialist/site/intake tests passed (/tmp/lokd-settlement-final-affected.log).
- Final early-recovery inbox follow-up: affected intake/collection/settlement database test passed, plus all 3 existing Paystack webhook tests (/tmp/lokd-settlement-recovery-targeted.log and /tmp/lokd-settlement-webhook-final.log). TypeScript, changed-file ESLint and diff checks passed.
- Authenticated local browser journey passed using four distinct Clerk DEVELOPMENT accounts, 1 passed in 27.6 seconds including startup (/tmp/lokd-settlement-browser-final.log). Verified settlement evidence display, maker rejection, independent confirmation, Client outcome visibility, Client/Officer Operations API denial, Officer collection isolation and funding hold visibility. A test confirmation leaves the booking unfunded.
- Account runner generated the fixture from committed database tests using actual disposable DEV account IDs, with no identity-trigger relaxation. It restored the original local database and deleted temporary Clerk identities and .dev.vars. Never build while those temporary variables exist.
- Initial browser fixture backup hit EXDEV across filesystems; moved the temporary backup under the same local D1 directory and verified restoration. First browser attempt reached the hold control but its implicit select label was not located reliably; added an explicit accessible label and bounded action timeout. The repaired journey passed. No production provider checkout was created.
- Before publication, read-only domain checks returned 200 at https://lokd.co.za/ and Client/Officer/Operations sign-in pages; anonymous Operations API returned 401. Sites reports all five existing custom domains active with active SSL. No DNS recreation or credential changes.
- The owner's review-email question is pending; do not claim account-specific production role acceptance without their identity. Google sign-in acceptance remains separately unresolved. Preserve the owner MFA-off exception and LOKD_LIVE_SHIFT_SCAN=false.

## Still open

Verified payment destinations and employee/partner release adapters, partner payables, payslip issue, invoice receipt allocation/issuance, post-export adjustments and engagement splits. Refund/dispute resolution, safe held-funding reapproval and replacement-charge policy remain guarded follow-up work; current recovery records and holds cannot be erased to force progress. No live release or real provider/bank acceptance was performed. Owner legal/entity/employer/source approvals and real identities remain separate dependencies. This review release is not completion of the entire platform.

Review URLs: https://lokd.co.za/ ; https://portal.lokd.co.za/client/service ; https://officers.lokd.co.za/officer/service ; https://operations.lokd.co.za/ops/service . Workspace pages require their existing sign-in and role. No synthetic records were loaded into production for study.

Provider references checked: https://paystack.com/docs/api/settlement/ and https://paystack.com/docs/payments/webhooks/ . Clerk test flow follows https://clerk.com/docs/guides/development/testing/playwright/overview using existing installed SDKs and development credentials.

Terminal build/deployment receipt follows separately.

## Terminal release receipt

- Final production build passed; archive validated with server, manifest and migrations 0053/0054 and no environment/test files.
- Source 48b2ebb6c125274c548e52006ac9051c5feecd0e pushed to the existing Sites repository.
- Version 57: appgprj_6a88a08505548191b266e9b711562ae3~appgver_f9017a7bf3d481918657addb3211f911.
- Deployment appgdep_6aa5c06a3e9081919f9e463c0908445e succeeded at 2026-09-12T21:13:34.921148+00:00, environment revision 9 unchanged.
- Native deployment URL: https://lokd-security.zenas-capetown.chatgpt.site.
- Existing LOKD.co.za, portal, officers, operations and demo domains retain their association with the same published Worker. Public audience preserved. LOKD.co.za browser handoff was queued in Codex.
- Final early-event recovery follow-up passed the affected database journey and existing webhook tests. The prior full 269-test regression and 45 affected readiness tests are recorded above; no passing full suite was rerun merely for release.
- Documentation receipt only; no rebuild is required for these receipt lines.
- Post-deployment custom-domain acceptance passed: LOKD.co.za homepage 200; Client/Officer/Operations service pages 307 to each correct host's sign-in with the requested return path; anonymous Operations API 401. Exact results: /tmp/lokd-v57-domain-acceptance.json. These confirm domain delivery and anonymous boundaries, not owner-specific production account acceptance.
