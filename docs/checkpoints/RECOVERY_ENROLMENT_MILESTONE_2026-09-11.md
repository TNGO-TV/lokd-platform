# LOKD recovery and applicant-bound test enrolment — 2026-09-11

Owner/Central release instruction received; resumed the existing LOKD task only. Baseline was clean d2881cd and deployed v47; no newer runtime changes were found. R350 price approval is already complete. Clerk controls and owner-approved MFA setting remain unchanged. No credentials, infrastructure, AmmoSync or TNGO changes.

## Built
- VerifyNow dispatch claims serialize in-flight work and respect provider Retry-After/cooldown across applicants. Repeated requests reuse the saved check. Operations retries require current application version, expected attempt count, a review note and elapsed retry time; maximum three dispatches. Unknown delivery cannot retry until another Operations reviewer records that external provider review found no completed result. Stale pending delivery requires at least 60 seconds before review; authorisation imposes a further minimum 60-second cooldown. A retry retains the same logical provider idempotency key.
- Immutable dated history preserves prior verification state, attempts, response hash, HTTP status, retry timing and reviewer evidence. Current outcomes remain available independently.
- Applicant-only R350 TEST checkout is bound to authenticated applicant, application/version, fixed approved package/version, 35000 minor units and ZAR. One atomic claim initializes the checkout. Existing orders are reused, including failed/abandoned/uncertain initialization. Earlier application versions with unresolved or paid orders prevent replacement checkouts (only a provider-confirmed reversed order can cease blocking).
- Reconciliation requires Paystack's server-verified test transaction to agree with an HMAC-authenticated charge.success inbox event: reference, provider transaction ID, applicant/application/version/package metadata, amount, currency and success. Conflicts and changed eligibility/version remain review_required; missing webhook stays awaiting_webhook. Duplicate webhook delivery and repeated unchanged reconciliation do not duplicate acceptance.
- Applicant and Operations interfaces expose saved payment references, reconciliation, cooldowns and history. Old application orders remain accessible for review after a correction. Training applicants receive no registered-officer checkout. Identity, PSiRA, payment and work eligibility remain separate; paid_test grants no live work approval.

## Tested
- `npm test`: production build and all 251 named regression tests passed (including added recovery, concurrent claim, ownership, metadata/amount/currency/transaction mismatch, signed event conflict, abandonment, immutable history, changed application, training exclusion and uncertain initialization cases).
- TypeScript and diff whitespace checks passed.
- Existing saved VerifyNow fixtures reused. No fresh VerifyNow probe or real identity submission.
- Authenticated local Playwright journey passed using disposable Clerk development identities and a temporary fully migrated local database: applicant versus Operations access, ownership isolation, disabled cooldown, explicit checkout acknowledgement, missing-provider failure remaining unpaid, and retained previous-version payment reconciliation. Database restored; development identities and temporary configuration removed.
- Browser evidence uses locally seeded provider outcomes; it is not proof that the new bound checkout has completed at Paystack or that a provider retry has been accepted externally. Backend success/negative cases use controlled provider transports and real signed-webhook verification.

## Exact pending dependency
Existing dummy R350 checkout was rechecked at 2026-09-11 14:09 UTC: provider transaction 6547465426, reference lokd-enrolment-test-424cc6792d644a55, test domain, abandoned, 35000 ZAR, no paid timestamp. Manual completion was requested once in this resumed turn; awaiting owner reply. Reuse https://checkout.paystack.com/zs1bg04jiry5bni. Do not initialize another dummy.

That legacy dummy predates applicant/package binding and must never be imported as an applicant's paid enrolment. Its completion proves the existing provider test checkout/callback/webhook separately. After that, an authenticated applicant must complete their bound test order and Operations must observe matching server verification and signed webhook. Live identity, live financial acceptance and owner-supplied package terms/signing remain separate gates; no training packages invented.

## Recovery boundaries and resume
- On unknown initialization: retain reference; reconcile with provider. Do not automatically create a replacement. If provider cannot find the transaction, Operations/provider support must establish its final disposition; automated reinitialization remains intentionally unavailable.
- On webhook delay: retain awaiting_webhook, let provider retry delivery, then explicitly reconcile. No automatic polling/job infrastructure was added.
- On conflicting events, stale application, or failed/unknown provider responses: remain unverified/review_required. Review the retained evidence and provider reference. No manual paid override exists.
- VerifyNow's fixed idempotency header is implemented; provider-side deduplication guarantees and recovery from an actual production delivery outage are not externally accepted by this fixture milestone.
- Browser reproduction: back up the existing local D1 SQLite database with SQLite backup, prepare a disposable database from all committed drizzle SQL migrations, run `LOKD_ACCOUNT_TEST_STAGE=production npm run test:accounts -- --grep 'authenticated applicant and Operations retain'`, stop the runner and restore the original database. Never seed production. No private credentials belong in the receipt.

Deployment receipt follows below after publication. Stop this bounded milestone after deployment/smoke; do not start a new implementation task or repeat the manual checkout request.

## Publication and stop receipt — 14:28 UTC
- Built/tested source: c64a40196dc4fe0f598a540231a0e670d5bfa854, pushed successfully.
- Published v48: appgprj_6a88a08505548191b266e9b711562ae3~appgver_b4b5a6f5a98c8191a52f5e06c1e9e6dd.
- Deployment appgdep_6aa40f82ef488191a10324c807b15bfe succeeded 2026-09-11T14:26:28.848355Z; existing environment revision 9 retained.
- Canonical live site https://lokd.co.za; returned origin https://lokd-security.zenas-capetown.chatgpt.site.
- At 14:28 UTC production homepage and updated callback returned 200; Officer and Operations enrolment APIs rejected anonymous requests with 401; webhook rejected GET with 405. An initial smoke assertion used an abbreviated callback label; inspecting the published text confirmed the correct Officer link, and the corrected assertion passed. No deployment repair was needed.
- Local authenticated browser acceptance passed as described above. Production authenticated bound-checkout/provider acceptance remains pending; no claim of live financial acceptance.
- Central resumed this as a background project task, so no extra user-facing Site tab was opened. Existing site hosting continues.
- Milestone complete within the first checkpoint window. Resume only at the dependency above; no further provider polling or implementation started. This final documentation-only receipt does not change the deployed runtime source.
