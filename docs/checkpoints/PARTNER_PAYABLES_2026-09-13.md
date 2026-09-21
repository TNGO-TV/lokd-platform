# Partner-company payables — 13 September 2026

## Implemented scope

Continues deployed v59 employee payment instructions. Operations can prepare an actual partner invoice line against exact completed, client-confirmed and independently pay-reviewed partner service, employer and engagement. The amount is the reviewed company invoice net plus invoice tax, not officer gross wages. Secure invoice/agreement/tax references and exact document digests are retained in restricted operations records. This implementation does not calculate or certify statutory tax treatment.

Real production operations-controller and finance-approver grants/limits apply. Independent approval binds the immutable source and payload; the maker and service participants cannot approve. Database guards recheck source, authority, evidence expiry and duplicate invoice-line allocation at write time. Approval atomically records an `approved_unpaid` canonical partner payable. Controlled CSV requires current approval, a durable export receipt and current finance authority, is labelled `NOT_PAID`, and excludes secure source references. A durable suspension blocks subsequent export. Canonical production payables cannot be marked paid, rewritten or deleted. Rejected reviews retain history; an approved allocation requires a future correction workflow rather than service reopening or deletion.

Migration: `0057_misty_valeria_richards.sql`. Previous migrations remain unchanged. New tables store reviews, decisions, exports and holds; bounded JSON source view is compatible with hosted SQLite limits. Employee payroll/payment behavior, provider configuration, infrastructure, MFA owner exception and live-scan setting remain unchanged. No real money, recipient creation, messages, new enrolment checkout or genuine production approval was generated.

## Validation and retained lessons

- Full regression: 277 tests passed, zero failures (`/tmp/lokd-partner-regression.log`). Includes migration compatibility under hosted SQLite limits.
- Partner DB journey: actual partner service lifecycle; amount separate from wage; authorization/privacy; integer amounts/secure refs; idempotent preparation and conflicting retry; maker separation; exact digest; source-change race rolls back approval; rejected decision remains final; unpaid canonical allocation; source-change/export block; durable hold; immutable history and post-allocation service-reopen denial.
- Authenticated browser: one journey passed (22.8 seconds; 28.8 total), four distinct disposable Clerk DEVELOPMENT accounts. Maker self-approval returns 403; independent finance approves and downloads NOT_PAID CSV; suspension blocks download; Client/Officer cannot see review data. `/tmp/lokd-partner-browser.log`. Original local database restored; development users and temporary `.dev.vars` removed.
- TypeScript and changed-file ESLint passed. Repository-wide lint reports seven existing errors and 19 warnings in other components; retain this limitation rather than claiming global lint passes. `/tmp/lokd-partner-types.log`, `/tmp/lokd-partner-changed-lint.log`, `/tmp/lokd-partner-lint.log`.
- Initial restricted Node test worker failed before test output; reran with authorized execution permissions. Initial partner fixture linked the client before check-in without the full signup review chain, causing CLIENT_NOT_APPROVED. Corrected fixture order to match the existing completed-service journey; no production guard was weakened. CSV link includes operations scope and was exercised through the browser.
- Reusable lesson: company invoice allocation is separate from employee wages and from payment release. Preserve an immutable unpaid liability and suspend downstream use when evidence changes. Do not turn export or provider test evidence into paid status.

## Remaining work

Partner-company payment destinations/mandates, guarded payment instructions/adapters, payslips, client invoice issuance/allocation and post-export adjustments remain separate milestones. Live salary dispatch stays locked pending actual controlled-pilot legal/employer/provider/bank/owner acceptance and its guarded implementation. Actual source documents and production operator grants must be supplied by authorized people; fixtures are not those approvals. Owner-specific production email/Google sign-in acceptance remains unresolved.

## Release receipt

Published v60 from source `67a072a46092362ec9786d70f11e167690152c78`.

- Project: `appgprj_6a88a08505548191b266e9b711562ae3`, existing public audience preserved.
- Version: `appgprj_6a88a08505548191b266e9b711562ae3~appgver_42413635b4f081918883f54956fe2a5f`.
- Deployment: `appgdep_6aa6c5ca190081919ab6e73edaecc535`, succeeded `2026-09-13T15:48:57.592454+00:00`; environment revision 9 unchanged.
- Production build passed. Archive `/tmp/lokd-partner-payables-v60.tar.gz` validated with exact source migration, expected Worker/hosting metadata, and no local credentials/fixtures. Saved archive SHA-256 `6c456b9d3743c8077f1f51867d40375116b9da882126b81994bcebbf7871f5ab`.
- https://lokd.co.za/ and https://lokd-security.zenas-capetown.chatgpt.site/ returned 200 after terminal success. Client/Officer/Operations service hosts returned 307 to their own sign-in with correct return paths. Anonymous Operations API returned 401. Evidence: `/tmp/lokd-v60-domain-acceptance.json`.
- This final receipt is documentation-only; it does not require another build/deployment. Actual owner-account acceptance remains separate from these route checks.
