# Finance sandbox independent QA — 2026-09-14

Scope: candidate e4fd8f4b7e2e07c3d78efc32a09fc7a4b4144617, imported root canonical0073. Offline synthetic SQLite only; no live service, external transaction, server or publication.

## Decision: accept corrected training/accounting scope, with coverage boundary below

Root corrected both findings below. Four independent synthetic regression tests now pass: repeated issuance denied; stale application completion denied; evidence-held completion denied; correction between preparation and reviewer approval rejected atomically. Original vulnerability proof is retained below. Durable regression module: /home/ammosync/.codex/visualizations/2026/09/14/01a0a08a-d726-7613-9ede-d0e24c452c1b/lokd-finance-sandbox-regressions.mjs. It uses actual application and signup handlers then sandbox finance commands on canonical migrations. Current SQL object count changed to1340 after other reviewer fixes; route/MFA and cumulative recovery review remains owned by security_qa.

### Original findings, now corrected

1. Reusing a settled training order with a new issue_entitlement request creates a new entitlement version and extends issuedAt/expiresAt without new consideration. Reproduction: run existing EX03/04 setup, issue_entitlement(course) again. Observed expiry2027-09-14T20:14:33.594Z→.595Z; two immutable versions. Return existing issuance unchanged or reject; explicit renewal requires a distinct paid order.
2. record_completion accepts an entitlement bound to stale signup application. Existing actual application handler+signup link, funded course and issuance; writeSignup correct(city) version1→2 makes financeReadiness.training.usable=false, yet record_completion succeeds. Add current signup source binding at preparation AND approval, matching order applicationVersion/owner and permitted status. Evidence-held completion already fails in canonical SQL; retain that protection.

Probe: /tmp/lokd-finance-sandbox-probes.mjs; observed output /tmp/lokd-finance-sandbox-probes.log. Two vulnerability confirmations pass; third expected-vulnerability probe fails because canonical SQL correctly prevents held completion. This is not three passing safety checks.

## Verified scope

Direct execution tests/finance-workflows.test.mjs:14 named tests pass, canonical migrations only. Output /tmp/lokd-finance-sandbox-suite.log. Independent full-chain SQLite probe verifies all11 canonical0073 tables have physical columns in exact0073_snapshot order, each has insert-time replacement protection, and foreign_key_check is empty. Hosted-limit migration test also passes.

Source review of canonical0073 no_replace triggers covers all table PK/alternate unique conflicts: policy digest; record sequence+logical version; command request key; journal command; provider claim reference+attempt; provider evidence sequence+source-event; global provider-identity source claim. Original append-only journals, records and claim rows reject UPDATE, DELETE and conflicting REPLACE. Existing named tests exercise unchanged rows; not a complete combinatorial proof.

Canonical booking/timesheet/exported payroll sources are read and claimed; exact source versions rechecked at reviewer approval. Immutable original payroll snapshots remain unchanged. Double-entry integer journaling, current reviewer/maker independence, source uniqueness and provider claims are represented in canonical guards and local tests.

Independent extension rerun: the single named `completed linked service is consumed by independently approved payroll and preserves history after workforce suspension` test passed (1 test, 0 failures, 0 skipped; 1111 ms). Evidence: `docs/finance-sandbox/central-checks/exported-payroll-independent.log`. Source-reviewed extension: `tests/fixtures/finance-workflow-connected.mjs`, `exportedPayrollAdjustment`. Accepted narrowly for the source-linked exported-item correction and simulator settlement described below. This adds no UI acceptance.

## Coverage boundary

finance_* is a separate explicitly sandbox-only workflow ledger. Tests/fixtures/finance-workflow-connected.mjs consumes actual local service produced by existing handlers then simulates collections, fictional payroll, correction and payout. Its exportedPayrollAdjustment separately adopts the same actual exported payroll item, corrects it, collects the canonical booking amount through the simulator, allocates funding to its source employer, and settles corrected employee net plus separate simulated tax/deduction/levy liability. A synthetic timeout is recovered with one submission, final liability/tax balances are zero, the corrected statement reads paid, and the original production payroll snapshot remains byte-for-byte unchanged. This is isolated sandbox settlement; it does not adopt or reconcile existing canonical real-payment state. Thus it proves source-linked sandbox accounting, not completion of every existing FI route or production adjustment workflow. Focused split-company fixture service() directly inserts synthetic service rows; only connected fixture is actual handler chain.

Training/enrolment order creation uses actual application+link handlers in local test. Fictional rates, rules and entitlements are explicitly versioned simulator assumptions, not production policy. No employment eligibility is granted. Route staff/MFA and recovery-cap independent review belongs to security_qa; await its results separately.
