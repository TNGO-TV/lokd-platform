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

Pending terminal deployment; append the exact source, native version and deployment outcome after publication.
