# Partner-company destinations — 13 September 2026

Extends deployed v60 with a restricted Operations company bank-destination/mandate workflow. Exact legal employer ID/name/version and all seven current compliance evidence records are snapshotted. Separate secure references and SHA-256 digests bind company registration, representative identity/payment authority, company bank ownership, signed mandate and provider capability. The actual representative sign-in user ID is bound to the review and excluded from preparation/decision. This is evidence reviewed by authorized humans, not automatic proof of company identity or signatory authority.

An operations controller prepares; independent finance reviews the exact payload and independently re-enters the ownership account. Existing read-only Paystack GET recipient validation binds integration, recipient, ZAR, mode, bank, account fingerprint and provider revision. Full account/name values remain transient; keyed fingerprints and last four digits are retained. No recipient creation, transfer, checkout or paid-state writes occur. A separate guarded partner instruction/adapter remains next work.

Migration `0058_slimy_slapstick.sql` adds immutable reviews/decisions/holds and current/source views. Commit-time checks cover current sources, active production authority, expiry, maker/representative separation, mode, provider digest and replacement ordering. Approval expires after 30 minutes or earlier evidence expiry. Provider rechecks never extend authority; changed/unavailable recipients become durably held. Recovery prepares new evidence and explicitly replaces the last approved review. Historical cross-company recipient/account reuse is blocked, as is employee/company reuse in both approval directions. A suspended or expired prior record is not deleted to bypass these safeguards.

## Validation

- 278 regression tests passed, zero failures, including hosted SQLite compatibility. `/tmp/lokd-partner-destination-regression.log`.
- New DB journey: real migrated schema and production grants; secure references; representative exclusion; masked retention; exact account/mode/integration checks; idempotency/conflicting retries; provider outage/mismatch; independent approval; explicit replacements; cross-company reuse rejection; company version race; authority suspension; expiry; hold during provider-read race; immutable history; no money/payment allocation.
- Additional employee-to-company recipient conflict assertion passed in the existing destination journey after full regression. `/tmp/lokd-partner-destination-separation.log`.
- Authenticated browser passed: 21.6 seconds (27.4 total), four distinct Clerk DEVELOPMENT sessions. Maker approval rejected; secure reference/masked account shown; approval blocked without provider key; independent rejection and suspension work; Client/Officer isolation verified. Mocked provider approval is tested in DB, not claimed as real acceptance. Original local database restored; temporary users and `.dev.vars` removed. `/tmp/lokd-partner-destination-browser.log`.
- TypeScript, changed-file ESLint and production build passed. Global lint retains the handover's seven existing errors and 19 warnings; no global-clean claim.
- Initial restricted test command returned only a file-level summary; reran with authorized execution and verified named tests. Initial browser network attempt failed before identities were created; authorized execution completed with cleanup. Local helper initially used unavailable `python`/unqualified `tsc`; corrected to `python3` and installed compiler. No source/financial guard was weakened.

## Boundaries and next work

`LOKD_OPERATIONS_MFA_REQUIRED=false` and `LOKD_LIVE_SHIFT_SCAN=false` remain unchanged. No provider credential, infrastructure, DNS, audience, owner account or genuine production approval was changed. Legal/employer/representative/provider ownership/capability and controlled-pilot acceptance remain real external inputs. All other remaining implementation and recovery items in `NEW_THREAD_RESUME_2026-09-13.md` remain, except the completed partner destination milestone. Next bounded milestone: partner payment instructions bound to an approved unheld payable and this exact current destination, starting with isolated test behavior and durable recovery. Live employee/partner dispatch and paid-state projections remain locked/unbuilt as described in the handover.

Reusable lesson: reuse recipient evidence primitives while keeping personal and company authority separate; source freshness and replacement checks belong at database commit as well as in the UI. A provider lookup does not establish account ownership or authority, and a successful test does not establish live acceptance.

## Release receipt

Published **v61** from exact source `9e198066cafad78a79ede733ef288f4fd7fb4876`.

- Version: `appgprj_6a88a08505548191b266e9b711562ae3~appgver_41defa2a229481919e65345beef40bb5`.
- Deployment: `appgdep_6aa6c991c69481918c56953c5e0cb41c`, succeeded `2026-09-13T16:04:54.043386+00:00`; environment revision 9 unchanged, existing public audience preserved.
- Native production URL: https://lokd-security.zenas-capetown.chatgpt.site . Existing LOKD.co.za and role-domain associations retained.
- Archive `/tmp/lokd-partner-destinations-v61.tar.gz`: validated Worker/manifest/exact new migration and private-file exclusions. Local gzip SHA-256 `7ea5d430104f350c2e16528e14950257690ec854fc1c6607df47fa84bcb69f30`; Sites stored archive hash `sha256:fb3cbf4193953a757a510acd4ab1929d6bf58a071da5584cacc8c358172628c6` (normalized archive).
- Post-publication Python urllib requests received HTTP 403; curl successfully reached the custom homepage. Record HTTP-client differences when diagnosing route acceptance; do not infer a failed deployment from one client's response.

This receipt-only update requires no rebuild. Source and prior local handover history were pushed together to the existing Sites branch. The remaining-work entry point is the original full handover plus this completed milestone and release receipt.

Final curl route acceptance passed: custom/native homepages 200; Client/Officer/Operations service routes 307 to the correct same-host sign-in and return path; anonymous Operations API 401. Evidence: `/tmp/lokd-v61-domain-acceptance.json`. These are route checks, not actual owner sign-in or live financial acceptance.
