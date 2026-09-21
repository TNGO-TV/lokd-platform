# FI-05 — claimed test-transfer terminal disposition

Checkpoint complete locally; ready for Central Command integration and independent QA. Not deployed. No real transfer, new checkout, provider recipient, browser-account fixture, credential change, live dispatch enablement or financial paid-state projection.

Base: `14448dd15fa80fc19a3f2052462ae566ab35a2fd`. Isolated checkout: `/tmp/lokd-fi05`; branch: `codex/fi05-payment-recovery`. The original LOKD checkout and its frontend/launch-plan changes were left untouched. The delivery commit and portable bundle are identified in the accompanying final receipt.

## Central Command integration boundary

Task discovery identified **AmmoSync Central Command & Website** (`01a08237-b9c1-7740-b3cc-79d222509dd8`). This session has read/list tools but no task-message/handoff tool. No dispatch or acknowledgement is claimed. This document is the shared-contract handoff, not evidence of Central approval.

No changes to `db/schema.ts`, Drizzle numbering/journal, shared production router, operator policy registry or shared webhook router. Central should:

1. Review and integrate `docs/migration-proposals/fi05-schema.ts` declarations into the canonical schema.
2. Allocate the next migration after the existing migration history. Use `docs/migration-proposals/fi05-payment-recovery.sql`; preserve its triggers/views when generating journal/snapshot metadata. Do not rewrite any applied migration. The deterministic `generate-fi05.mjs` reproduces the SQL proposal from the existing instruction guards.
3. Remove the explicit proposal application in `tests/assignment-activation-db.test.mjs` once this SQL is a numbered migration, so tests do not apply it twice. Update the contract test's migration loading at that time too.
4. Integrate the new `/api/payment-recovery` route and the two payment-module changes with that migration as one release unit. Existing production router actions handle replacement preparation; no shared-router patch is needed.
5. Run independent QA, integrated migration checks and release checks. This handoff does not authorize deployment or live payouts.

## Source and API contract

- `app/lib/payment-recovery.ts`: proposal/approval command service, immutable replacement reservation, scoped history read.
- `app/api/payment-recovery/route.ts`: same-origin JSON, verified identity, Operations workspace and role/MFA boundary; private no-store responses. It uses existing Worker authentication, which strips caller-supplied identity headers.
- `app/lib/employee-payments.ts`, `app/lib/partner-payments.ts`: existing preparation accepts explicit recovery links in the same atomic D1 batch. Authorized reads include `recovery` history/terminal evidence/chain hold. Verification captures the webhook watermark **before** its provider GET, and each successful verification is a new immutable observation; signed webhook replay remains deduplicated.

`POST /api/payment-recovery` accepts:

- `action: propose_test_disposition`, `kind: employee | partner`, original `reference`, exact instruction `version`, `sourceHash`, `evidenceId`, `disposition: failed | reversed`, `evidenceReviewed: true`, and `note`.
- `action: approve_test_disposition`, the same exact fields, plus `proposalId`. Returns `approvalId`.

Use the existing `prepare_employee_payment` or `prepare_partner_payment` action with its existing source/destination fields, a new request key, and `replacesReference` plus `recoveryApprovalId`. It returns one new **prepared** instruction. Independent instruction approval and the existing explicit test dispatch remain required. Ordinary retry with the same request key returns the same instruction; changed bindings conflict. Recovery commands return `paymentReleased: false`.

Authority reuses existing policies: employee `payment.prepare` (payroll preparer), partner `partner_payment.prepare` (operations controller), and the respective `.approve` policy (finance approver). Both operator identity and authenticated user identity must differ between the recovery proposer and approver and between the original instruction preparer and approver. Payment participants cannot decide. Active production-verified accounts/roles and amount limits are checked again at database commit. The original submitter may approve a disposition only if those independent-maker/participant rules are satisfied; no new role grant is inferred.

## Final evidence and duplicate-payment contract

Only a claimed **test** instruction is eligible. Its latest observation must be a same-reference API verification no older than five minutes, with the current signed-webhook count and a matching signed `transfer.failed` or `transfer.reversed` event. All observed transfers must agree on provider transfer ID/code, original reference, test mode, exact amount/ZAR, integration and recipient. More than 500 observations remains held.

The five-minute local review window is an intentionally conservative implementation policy, not a provider settlement deadline. Timeouts, 404s, no event, API-only failure, missing/malformed identity, pending/OTP and contradictory evidence do not establish replacement eligibility. Historical pending states can precede a terminal result. Success may precede reversal; success combined with failure, or a nonterminal/conflicting status observed after the final state, stays held. Every newly stored observation invalidates an unconsumed proposal/approval's evidence snapshot. Identical signed delivery retries do not create new observations.

Provider basis: [Paystack — How Transfers Work](https://paystack.com/docs/transfers/how-transfers-work/) and [Single Transfers](https://paystack.com/docs/transfers/single-transfers/), consulted 13 September 2026. Paystack describes failed/reversed as conclusive and directs uncertain retries to retain the same reference. This implementation accepts the narrower failed/reversed intersection with matching signed and API evidence; it does not release abandoned/blocked/rejected transfers.

Approval alone does not release the active payment slot. A replacement reservation, new instruction and audit event are one atomic batch. The database revalidates the approval and exact unchanged/current source, then releases the predecessor's slot while inserting its successor. A unique predecessor and approval consumption allow one successor only. The original remains `dispatch_claimed`; its reference, submission command, source, amount and destination are retained. Only its active slot, version and update timestamp advance. Proposals, approvals, links, commands and observations cannot be updated or deleted.

Every ancestor is checked before another recovery proposal, approval, replacement or instruction approval/dispatch. A later contradiction, stale verification or revoked review authority holds the chain. Same-reference verification remains available for original claimed records after replacement. A fresh agreeing verification can renew a consumed ancestor's freshness; it cannot erase a contradiction. A late event after a durable successor submission claim preserves that claim and requires reconciliation; the system cannot retract a transfer already delivered to the provider.

Unlinked preparation cannot bypass a released claim. Cancelled, never-submitted successor instructions remain auditable; automatic replacement of such a cancelled successor is conservatively held in this checkpoint. There is no manual claim deletion/reset or emergency paid override.

## Validation

- Full regression: **286 passed, 0 failed, 0 skipped**, 20.9 seconds, `/tmp/lokd-fi05-final-regression.log`.
- Final SQL tightening additionally blocks recovery of a descendant with a held ancestor: focused connected employee/partner journeys **4 passed**, `/tmp/lokd-fi05-targeted.log`; final migration and HTTP contracts **2 passed**, `/tmp/lokd-fi05-contract-final.log`.
- Existing payroll/export and approved partner invoice journeys are extended in `tests/fixtures/payment-recovery-journey.mjs`; no new checkout fixture. Injected provider transports exercise failed and reversed replacement, one successor POST, no redispatch, two generations, signed replay, competing approvals/replacements, authority revocation before and during commit, changed source/amount, stale evidence, event-during-GET, wrong person/role/identity, missing events/404, late original conflicts and immutable history. Original liabilities remain unpaid/exported, with no settlement/remittance/disbursement projection.
- `tests/payment-recovery-contract.test.mjs`: migrations applied after the full existing history under restricted SQLite function/variable/column/SQL/compound-select limits; new views queried; HTTP anonymous, cross-origin, wrong-role/workspace and missing-storage handling.
- TypeScript and changed-file ESLint pass; `/tmp/lokd-fi05-types.log`, `/tmp/lokd-fi05-lint.log`. No global-lint-clean claim.
- Production build passes and includes `/api/payment-recovery`; `/tmp/lokd-fi05-build.log`. No browser fixture or `.dev.vars` was introduced. No deployment command ran.

Validation corrections retained: nested fixture transactions initially needed savepoints; the new HTTP test initially omitted valid MFA fixture headers; the first full test invocation preceded the required rendered-page build. Corrected checks passed. Sandbox child-process restrictions produced `EPERM`; the broad suite/build ran successfully with approved process-sandbox escalation. No provider or infrastructure access was used to fix these failures.

## Remaining gaps and next assignment

FI-05 implements a test-transfer recovery control, not provider/business acceptance. Central integration, numbered migration metadata, independent QA and operator-facing recovery controls remain. The API is implemented; frontend work belongs to its dedicated owner. Existing controls can still verify original references. Cancelled-successor recovery, evidence overflow, irreconcilable contradictions and changed historical instruction sources require a later bounded exception workflow and remain held.

**Next assignment for Central Command:** integrate and independently validate this FI-05 contract, then assign FI-02's controlled live payment/reconciliation design against it. Keep live employee/company dispatch, paid-state projection and service flags locked until their separate genuine provider, mandate, finance and pilot acceptance. No FI-02 implementation or deployment is part of this checkpoint.

Reusable lesson: preserve the original claim; use fresh provider evidence and an independent decision; consume replacement authority only in the same transaction that creates its exact successor; recheck the complete ancestor chain at the next irreversible claim. A test success or an accepted recovery proposal never means a real liability was paid.
