# EX01-REVIEW independent QA — 14 September 2026

**ACCEPT the reviewed non-monetary correction-record workflow and canonical0072. No actionable finding remains in this bounded review.** EX-01 actual pay adjustments remain incomplete; evidence_reviewed does not approve wages, recover money, issue corrected payslips or move funds.

Reviewed imported checkpoint732955b plus Central canonical0072 in `/srv/ammosync/workspaces/lokd-security`. No source edits, provider/Sites/account calls or live activity. Supplemental assertions injected into existing connected fixture in memory only.

## Assessment

- Sources require exported original payroll with an export reference, current canonical finance-document source and payment snapshot. Original gross amount controls preparer/reviewer financial authority.
- Prepare snapshots original source/financial/export and canonical request digest. Same user/operator and identical request key retries return original review; changed request/user/key reuse rejects. Idempotency preserves original snapshot rather than silently refreshing it.
- Evidence-reviewed decision requires current matching source/payment/export, active maker authority and a distinct current finance operator and user. Recipient cannot review own correction. Rejection remains available for stale evidence without erasing original records.
- One immutable decision per review. Follow-up parent must be decided and belong to same original item; unique successor preserves linear history. Database insert guards cover PK,request_key,parent successor and decision review_id collisions, including INSERT OR REPLACE with recursive_triggersOFF. UPDATE/DELETE denied.
- API uses existing authenticated Operations/host/MFA contract, same-origin JSON, bounded body and private/no-store/nosniff/no-referrer responses. Reads are item-scoped and reauthorize gross amount each page. Numeric page range is bounded; it is a sequence continuation, not an authorization token.
- Every successful read/write explicitly marks payChanged/paymentReleased/originalPayslipChanged=false and calculationStatus=awaiting_company_rules. No payroll/payment/document writer is called by this library.
- Canonical0072 contains only additive tables/indexes/view/guards. Physical table column order was independently compared against positional INSERT VALUES handlers and0072 snapshot: both reviews12 columns and decisions9 columns exactly match. No proposal doubleload remains in executed tests.

## Actual independent tests

1. Connected identity→service→payroll→payment/reversal/workforce suspension test with supplemental EX01 assertions: **1 named test passed,0 failed/skipped**,1.051s. `/tmp/lokd-ex01-independent-connected.log`.
2. Canonical constrained-SQLite and HTTP access tests: **2 named tests passed,0 failed/skipped**,0.334s. `/tmp/lokd-ex01-independent-contract.log`. Current canonical chain applied under existing hosted SQLite limits, FKs checked, payment/refund controls remained disabled.
3. Supplemental fixture loader `/tmp/lokd-ex01-independent-loader.mjs` explicitly proved alternate-key REPLACE denial with new PKs, evidence-reviewed→rejected replacement denial, pending-parent/duplicate-successor rejection and cross-user request-key denial. Review/decision rows and original payroll/service/documents/payment records remained unchanged. The `QA_EX01` marker in retained log proves injection executed.
4. Existing connected scenario proves request recorded while paid cannot be evidence-reviewed after signed reversal; stale request can be rejected. Original paid-at-recording versus current reversed remains distinct and review/payment history survives actual guarded workforce suspension.

Counts are separate bounded runs, not a full regression/build/browser claim. No skipped case was treated as acceptance. Independent reviewer authored no implementation changes.

## Remaining scope

Frontend review UI and actual approved company rules for underpayments/overpayments, tax/benefit handling and within-period employer changes remain separate. This review does not approve invented rules, a new adjustment calculation, liability/payment modification or whole-build completion. Continue EX01 monetary ledger/calculation only against concrete accepted rules; retain original source allocations and immutable export history.

Reviewed hashes:
- `app/lib/payroll-correction-reviews.ts`: `535927f01457c8375bcc6cbdc78587bb7ed79ecdd39f7110799b28c06e36e836`
- `app/api/payroll-correction-reviews/route.ts`: `fdcdea9d21e462306dbbd4e2958a47e816de140ae260be5f4efa51a5a1dbcd2b`
- `drizzle/0072_payroll_correction_reviews.sql`: `6f4d1408b0e54ed2094c212f136e3382ebe29844a343707a2642cb702585ebde`
- `tests/payroll-correction-reviews.test.mjs`: `d4d59fd6e16a55f45fe862d82412d225010c24875922ba0016c11435dc7c83cc`
