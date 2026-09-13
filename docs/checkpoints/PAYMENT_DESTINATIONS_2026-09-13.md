# Employee payment-destination milestone — 13 September 2026

Continued from deployed v57 and handover 6aeaf15. Existing Sites project, public audience and custom domains retained. No provider settings, keys, infrastructure, live payment, recipient creation or external messages changed.

## Implemented

- Employee destination preparation binds a current independently reviewed payroll profile to its exact officer, employer, engagement and reviewed signup owner/revision. Partner-company recipients are deliberately outside employee payroll and need their own payable scope.
- Read-only Paystack recipient retrieval requires explicit test/live credentials, active non-deleted `basa` / ZAR bank data, integration identity, safe recipient IDs and valid timestamps. Fixed provider URL, GET only, no redirects, bounded timeout and sanitized errors. This is recipient verification, not transfer dispatch or proof of transfer capability by itself.
- Maker supplies versioned secure ownership, salary mandate and configured-provider capability references with SHA-256 digests and explicit review confirmations. Provider integration must match capability evidence. Both maker and independent reviewer enter the account from ownership evidence; the backend matches it to the provider account. Full account numbers and names stay transient; immutable snapshots retain keyed HMAC fingerprints and masked account endings. Free-text findings should contain no bank numbers.
- Real production payroll-preparer and payroll-reviewer grants, distinct operator and user identities, beneficiary separation, active authority checks and the existing owner MFA exception. Client, Officer and ungranted Operations accounts receive no destination candidates or evidence.
- Append-only preparation, final decisions and suspension history. Database guards recheck source binding, grants, holds, mode, immutable provider hash, review expiry and exact replacement predecessor at decision time. Duplicate requests cannot change their evidence; duplicate same decisions return the existing current status. Recipient/account evidence cannot be approved for another officer in the same mode.
- Fresh recipient retrieval during approval. Changed/inactive recipient data creates a durable hold. Read failures leave pending approval retryable; recheck failures hold an existing review. Holds cannot be erased. New independent evidence is required for recovery.
- Readiness is limited to the original 30-minute provider review window and source evidence expiry (at most 30 days). Recheck never extends that window. Changed profile/intake/employer/engagement or revoked review authority invalidates the derived status. Explicit replacement retains all history and never revives an older approved destination when the replacement is held.
- Operations UI extends existing service controls with preparation, masked evidence review, independent approval/rejection, provider recheck and suspension. Test confirmation cannot become live readiness. Existing payroll payment-destination tokens remain null; no payable instruction, payment adapter, bank file or salary release was added.

## Validation

- Production build passed after the account runner restored the normal environment.
- Full regression: 273 named tests passed, zero failures/skips (`/tmp/lokd-destination-regression.log`). Includes 3 new recipient-evidence tests and a connected destination database journey.
- Final additional assertions for evidence expiry, revoked preparer authority, fresh review recovery and a suspension arriving during provider approval passed the affected database journey (`/tmp/lokd-destination-final-db.log`). These test-only additions followed the full regression; no application source changed and no redundant full rerun/build was needed.
- TypeScript, changed-file ESLint and diff checks passed. Existing generated tsconfig build state restored before commit.
- Authenticated local browser acceptance: 1 passed in 27.6 seconds including server startup, four separate Clerk DEVELOPMENT sessions (`/tmp/lokd-destination-browser.log`). Verified masked evidence display, maker rejection, missing-provider-key approval rejection, independent final rejection, suspension of an already test-confirmed fixture, supersession preservation, and Client/Officer API/UI isolation. Successful provider approval is covered by the connected database test with mocked transport; browser acceptance does not claim a real provider approval.
- Runner uses a separately selected destination fixture and actual disposable account IDs; original local D1 data restored, temporary development accounts and `.dev.vars` deleted. No synthetic production data was inserted.
- Initial fixture omitted the actual officer application behind its signup record; the existing source trigger correctly rejected it. Added the isolated submitted application, without weakening any production trigger. Subsequent journey and browser acceptance passed.

## Provider evidence and limits

Official sources checked 13 September: https://paystack.com/docs/api/transfer-recipient/ and https://paystack.com/docs/transfers/creating-transfer-recipients/ . They document recipient fetch and South African `basa` / ZAR support; deletion makes recipients inactive. The implementation fails closed if required recipient fields are absent. No actual configured LOKD provider account capability or bank ownership was probed or accepted. Production capability, ownership and mandate evidence remain operator-supplied real acceptance inputs, independently reviewed; a successful lookup or name is never treated as sufficient authority. Clerk testing followed https://clerk.com/docs/guides/development/testing/playwright/overview using existing development keys.

Next implementation: exact employee payable instructions and payment adapter with fresh destination/provider checks at dispatch; partner payables and separately scoped partner destinations; payslips, invoice allocation/issuance, post-export corrections and engagement splits. Refund/dispute resolution remains separately guarded. Existing owner legal/entity/source decisions, real account acceptance, Google sign-in and live shift acceptance remain open. Preserve LOKD_OPERATIONS_MFA_REQUIRED=false and LOKD_LIVE_SHIFT_SCAN=false.

Release receipt is recorded below only after terminal deployment.

## Terminal release receipt

- Tested application source `2a5be4a4a32beb66232421dc42f06fa542b5972a` pushed to the existing Sites repository.
- Version 58: `appgprj_6a88a08505548191b266e9b711562ae3~appgver_fb1e337f7ae48191af0708e78a8dd25a`.
- Deployment `appgdep_6aa6a2dadbbc8191ab5e7c9d75989546` succeeded at `2026-09-13T13:19:43.748378+00:00`; environment revision 9 unchanged.
- Native URL https://lokd-security.zenas-capetown.chatgpt.site ; requested review URL https://lokd.co.za/ . Browser opening queued in this Codex task.
- Archive validated with Worker, hosting manifest and new migration 0055; environment and test files excluded. Public audience and existing domain association retained.
- Custom-domain delivery/access checks passed: homepage 200, Client/Officer/Operations service pages 307 to the corresponding host's sign-in with the correct return path, anonymous Operations API 401. Results: `/tmp/lokd-v58-domain-acceptance.json`. Python's default urllib client initially received 403; curl succeeded and completed the bounded checks. This is client-specific observed behavior, not evidence of an application failure or real-user acceptance.
- This receipt and updated resume pointer are documentation-only. No rebuild or deployment is required for them. Real owner-account and bank/provider operational acceptance remain open.
