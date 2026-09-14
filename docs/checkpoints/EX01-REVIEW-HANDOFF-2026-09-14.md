# Payslip correction review — local checkpoint

## Plain English

The refund work is already integrated. This next change lets the payroll team record a problem with a payslip after payroll has been finalised. It keeps the original payslip, service records and payment history. A different authorised person reviews the supporting records. If payment evidence changes, the earlier review cannot be accepted against the old facts. Earlier requests and decisions cannot be overwritten or deleted.

**This is the review step, not the finished pay-correction feature.** It cannot change wages, recover an overpayment, recalculate tax, send money or issue a corrected payslip. Those steps still need the company's rules for underpayments, overpayments and changes of employer. The latest Central register explicitly says those rules have not been supplied. No approval was inferred from the user's request to continue or their request for plain English.

## Exact baseline and ownership

Base: `8b5a9b509cb1c43c1bd8ae6be539df94450b9a06`, the latest combined local Central checkpoint, including reviewed refund/credit UI and independently corrected 0070/0071 contracts. Isolated branch: `codex/ex01-review-controls`. Commit, file list, patch hashes and final validation counts are in the accompanying durable receipt. Shared checkout, existing components, existing API routes, `db/schema.ts`, numbered migrations/journal/readiness inventory and configuration were not edited.

Relevant read: `CENTRAL-INTEGRATED-CHECKPOINT-2026-09-14.md`, `CENTRAL-DISPATCH-RECEIPT-2026-09-14.md`, `CENTRAL-REMAINING-BUILD-INPUTS-2026-09-14.md` and the current FI/EX task register. Earlier FI-BUILD-06 deficiencies that Central corrected are not reopened. In particular, this new history also rejects conflicting INSERT OR REPLACE, not just UPDATE/DELETE.

## Backend and frontend contract

New endpoint: `/api/payroll-correction-reviews`. Operations access and the existing MFA policy are required before private reads/writes. The original gross pay must fit the operator's limit. The preparer needs payroll_preparer; the independent reviewer needs finance_approver. A recipient cannot review their own correction. The existing verified-user middleware contract is reused; this patch does not create authentication trust headers or change shared routing.

- GET requires `itemId` from the existing payroll list. Optional `after` is a nonnegative review sequence and `pageSize` is 1–100 (default25). Returns exact current exported source, scoped review history with original and current payment states, reviewer identity/findings/time and `nextAfter`. Pagination always rechecks current authority and remains scoped to that item. There is no unscoped global dump.
- POST `action:prepare`: `itemId`, stable `requestKey`, `originalReviewed:true`, `findings`, `requestedCorrection`, `evidenceReference`, exact SHA-256 `evidenceHash`, optional `parentId`. Records the original source, export reference and financial evidence. Repeating the same request returns its original ID. Changed facts/owner under the same key fail. A follow-up may reference only a previously decided review of the same original item, with one successor per parent.
- POST `action:decide`: `reviewId`, `payloadHash`, `originalReviewed:true`, `findings`, `decision:evidence_reviewed|rejected`. Independent operator AND user required. An evidence-reviewed decision requires current original source/payment evidence and current maker authority. Stale evidence can be rejected without deleting history. Concurrent decisions produce one durable decision.
- Every success response explicitly includes `payChanged:false`, `paymentReleased:false`, `originalPayslipChanged:false`, `calculationStatus:awaiting_company_rules`. An `approved` pay decision is not supported. UI must call this a review of supporting records, not approval of corrected pay.
- Errors:401 unsigned;403 access/role/independence;404 source/review absent;409 stale/conflicting facts;413 oversized request;503 storage unavailable. Same-origin JSON and bounded bodies are required. Private/no-store, nosniff and no-referrer headers apply.

Frontend integration remains Central/frontend-owned and is not claimed complete. Recommended labels: “Report a payslip problem”, “What needs checking?”, “Supporting record”, “Records reviewed”, “Needs a new review”. Preserve the original/current payment distinction. Do not expose pay-change or transfer buttons based on `evidence_reviewed`.

## Additive schema proposal

Apply existing canonical history through0071, then the unnumbered `docs/migration-proposals/payroll-correction-reviews.sql`. Central assigns the canonical number and merges schema/journal/snapshots/readiness inventory.

- `payroll_correction_sources`: view limited to exported original payroll items, linking the original export and canonical finance-document/current-payment snapshots. Gross review limit comes from the original payroll item.
- `payroll_correction_reviews`: immutable request key, original item, predecessor, original source/payment/export snapshot, supporting request JSON/digest, operator/user/time.
- `payroll_correction_decisions`: one immutable independent decision per request, exact digest, reviewer/findings/auth context/time.
- Commit guards recheck source and authority, forbid cross-item lineage, and prevent history replacement through primary/unique-key collisions. UPDATE and DELETE are rejected. No payroll/payment/source allocation table is changed.

Generator: `node docs/migration-proposals/generate-payroll-correction-reviews.mjs`. SQL is the exact proposed schema contract; no approved calculation policy is encoded. The production-identity fixture loader applies the proposal only when loading the current complete chain. Remove that explicit load when Central canonicalizes the migration. The new constrained-SQLite test independently applies the canonical chain plus proposal.

## Verification and limits

Production build and full regression passed: **406 tests, zero failed/skipped**, 25.404 seconds (`full-tests.log`). The earlier targeted run passed11 tests. TypeScript without incremental cache, changed-file lint and whitespace passed. Logs are retained beside the handoff.

Tests cover: only exported sources allowed; exact retries and mismatched keys; wrong recipient/role and maker separation; unsupported approval of changed pay; revoked maker; concurrent decisions; follow-up lineage and history pages; UPDATE/DELETE/INSERT OR REPLACE denial; no mutation of original payroll, service consumption, issued documents or payment instructions. The existing connected fixture records a request while paid, denies review after a signed reversal, rejects the stale request, then preserves that history through actual guarded workforce suspension. Original paid-at-recording and current reversed state remain distinct.

The fixture uses existing synthetic service, payroll and payment transport. No new checkout, account, provider submission, real money, deployment, communication or runtime change occurred. Both payment locks, refund locks, live shift scan and the owner's existing MFA exception remain unchanged. No browser run or independent QA is claimed for this backend-only checkpoint.

## Remaining EX-01 work and next assignment

1. Obtain the company's approved handling of underpayments and overpayments: when adjustments are paid/recovered, lawful deductions/consent and limits, tax/benefit correction treatment and responsible approvers.
2. Obtain rules for a worker changing employer/engagement during the pay period: effective dates, liability ownership, calculation boundaries and allocation of deductions. Existing production payroll still rejects mixed engagement periods; this patch does not remove that guard.
3. Build the actual adjustment ledger/calculation and payment reconciliation against those rules; connect resulting amounts to corrected private payslips without consuming service twice or reopening the original export. Evidence-reviewed requests from this checkpoint are inputs, not monetary authority.
4. Central integrates and independently reviews this bounded change; frontend wires its review controls. Continue EX-02, EX-03 and FI-07 under the existing gap register. No historical “later” label excludes them.

This checkpoint advances the work possible without inventing company rules. It does not close EX-01 or certify the whole finance build. Prepared handoff is not a delivered task message.

## Learning

Observation: “approved specification” was unclear to the user. Action: explain it as the company's rules for incorrect pay and employer changes. Keep technical detail in the handoff and user updates in plain English. No missing rule was silently supplied by the assistant.

Observation: reviewing source records can be built independently from deciding corrected wages. Action: make review status explicitly non-monetary and preserve original/current payment evidence. Result: local stale-evidence and history-preservation tests pass while all financial execution remains unchanged. The next review must verify the actual approved calculation contract before adding any monetary effect.

## Central canonical integration

Central assigned0072_payroll_correction_reviews after0071, with db/schema.ts, snapshot/journal and generated readiness inventory updated. Apply the canonical chain only; the proposal must not be loaded a second time. Independent backend review accepted physical column order, review/decision source authority and immutable lineage/history. Central frontend integration and final combined verification are recorded separately. No monetary calculation policy is introduced.
