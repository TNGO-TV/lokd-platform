# EX01 payslip-problem review UI — 14 September 2026

Owned files: new app/components/payroll-correction-review-controls.tsx, existing app/components/production-payroll-controls.tsx integration, new tests/frontend/payroll-correction-reviews.spec.mjs. No backend/schema/runtime/deployment changes.

The widget mounts lazily only for Operations and an actual exported payroll item. Payroll list item.status is the authoritative joined run status; the mount does not depend on the separately capped100-run list. Opening the per-item details requests only that item’s private history. Officer/client/unopened/non-exported items make no new review requests.

Operations can report a payslip problem with original review acknowledgment, findings, requested check, supporting record/hash and stable request key. Unknown outcome retries preserve the exact initial body/key; transient read/page errors preserve the original draft and history. Source/payment changes require renewed acknowledgment before retry. Explicit401/403 on either GET or POST clears private records and source-bound drafts. No sensitive draft storage was added.

Independent decisions use only evidence_reviewed/rejected and exact review digest. The user-visible labels say supporting records reviewed, never approval of changed pay. Stale evidence disables positive review while rejection remains available. Exact original source/export/payment evidence and current payment state are shown separately with maker, reviewer findings/time and parent review. Paged history merges by immutable review ID, replays loaded pages during refresh, and refreshes all prior pages if a newly loaded page sees changed source evidence. Follow-up forms appear only after all history is loaded and no successor is present.

Every accepted response is checked for payChanged:false, paymentReleased:false, originalPayslipChanged:false and calculationStatus:awaiting_company_rules. Inconsistent responses are reported as unconfirmed; no pay-change, transfer or corrected-payslip action exists.

Validation: final focused22 synthetic mobile/desktop cases in /tmp/lokd-payroll-review-ui-browser-clean.log. Covers scoped/lazy mount, exact original/current states, unknown retries, independent outcomes, stale rejection/follow-up, paged lineage/draft retention, GET/POST401/403 clearing, changed evidence with original-key preservation and malformed monetary outcome rejection. TypeScript noEmit/incrementalfalse and focused ESLint pass: /tmp/lokd-payroll-review-ui-types.log and /tmp/lokd-payroll-review-ui-lint.log.

Earlier diagnostic failures were fixture issues: missing payment-execution arrays in an unrelated panel, then changing mocked run state while navigating to the identical URL without a refresh. Both fixtures corrected; no assertions weakened. Final test models actual payrollItems.status contract.

security_qa owns independent final22+relevant navigation/recovery checks and stopping fixture4294 (session92109) after handoff. No live services/accounts/provider traffic; synthetic tests abort non-local requests. Company rules and actual pay adjustment/ledger/tax/payment/payslip correction remain outside this review-only checkpoint.
