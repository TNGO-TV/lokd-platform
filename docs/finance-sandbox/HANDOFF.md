# Finance sandbox completion handoff

Base: `213f0e99ffbe142f4718624ef38c127f05366fb1`.
Branch: `codex/finance-sandbox-completion`.
Source checkout: `/home/ammosync/.codex/visualizations/2026/09/13/01a09c3c-788a-7a83-a458-2aaa4e604d8a/finance-sandbox/source`.
Commit and exact patch hashes are recorded in the adjacent artifact `INTEGRATION.json` after committing. Central must integrate; no deployment is authorized.

## Delivered implementation

- Actual application routes `/api/finance-workflows` and `/api/finance-workflows/webhook`; trusted account identity, existing Operations MFA policy, scoped memberships, independent command approval and exact digest review. Default environment is denied; only explicitly isolated sandbox runtime can execute.
- Canonical booking/applicant/approved-timesheet/exported-payroll source links and atomic stale-source checks. A service cannot be reused through a second timesheet version. Provider transaction identity cannot be consumed twice across workspaces.
- Conserving integer-cent journal, partial collections and payouts, separate company allocations/reserves, employee and approved company recipients, distinct tax destination purpose, independent final reconciliation, unknown response lookup without a second transaction, failed/reversed replacement, immutable claims and original references.
- Credits with immutable void/replacement chains, partial receipt-bound refunds, recipient correction/retry, disputes and final bank dispositions, final chargeback residual debt, independently reconciled restoration funding and liability-aware allocation release.
- Real adjustment ledger with underpayment, overpayment/consent-limited recovery, deduction/tax settlement and within-period employer/engagement splits. Existing exported payroll can be adopted with its original item/export/snapshot references preserved; changes create subsequent private statements and leave the actual original export untouched.
- Partner invoice correction chains and remittance reconciliation. Training catalogue, package versions/prices/terms, applicant-version-bound R350 enrolment, uncertain initialization recovery, exact payment-linked entitlements, expiry/revocation, refund/cancellation and independently reviewed provider completion. Training and enrolment never assert work eligibility.
- Private document/history reads and journal-derived unpaid/pending/paid/held/reversed projections. Contradictory evidence received after payment immediately holds documents and unused funding, including concurrent approval. Evidence must still be fresh at approval, and the bank attester’s current identity/version is retained.

`CONTRACT.md` gives exact request fields, responses, identity hooks and frontend integration points. No shared component was edited. `PLAN.md` retains the execution record.

## Coverage and rules

FI01–09 and EX01/02, finance EX03 and commercial EX04 have executable sandbox service coverage. Tests use the canonical schema and actual application handlers, including an existing full intake/identity/activation/service/payroll journey. Focused unit fixtures exercise additional synthetic employer/partner cases; they are distinguished from the handler-produced connected service fixture.

Policy `lokd-sandbox-completion-v1` explicitly uses fictional 10% tax,5% deduction,1% employer levy,20% recovery cap with consent,365-day training and100% refundable training. Alternative uses20% tax,0% deduction,10% recovery cap,30days and50% refund. R350 and SAST are fixed owner decisions. Aggregate integer calculations and stable largest-remainder splits conserve cents; BigInt intermediates avoid overflow. These rules are not statutory approval or financial advice.

## Validation and local review

Final validation:429 tests passed,0 failed,0 skipped; application build, full lint and TypeScript checks passed. The final SQL/test-only submission-race guard was checked by rerunning all429 tests after the successful application build. Commands and hashes are recorded in `INTEGRATION.json`, with full logs alongside the checkout. The named new suite is `tests/finance-workflows.test.mjs`; the real connected test is `completed linked service is consumed by independently approved payroll and preserves history after workforce suspension` in `tests/production-identity-connected.test.mjs`. Its helpers now execute both the complete payment/correction journey and adoption/correction of an actual exported payroll item.

The new suite covers independent/replayed/concurrent decisions, wrong authority, stale evidence, revoked maker, no second POST after uncertainty, final failure/reversal and safe replacement, private access, immutable UPDATE/DELETE/REPLACE denial, credit/refund/retry, chargeback debt restoration, training/version/expiry, minor-unit conservation, SAST midnight, split employers, partner corrections, subsequent tax settlement, HTTP origin/MFA/environment checks, conflicting evidence after payment, expiration while awaiting review, and hosted SQLite migration limits. Existing regression tests retain the payment/refund/scan and authentication checks.

The local `document-journey.html` is generated from `document-journey.json` captured by the real connected fixture. It displays immutable document contents and balances through paid, reversed and corrected states. It is an evidence viewer, not a substitute for frontend integration or a claim that a browser end-to-end journey passed.

Earlier failures are preserved in numbered finance test logs: unset Git author identity (resolved with per-command Codex metadata, without global configuration changes), Node strip-only constructor syntax, a fixture reusing an event key with a changed timestamp, recovery lookup incorrectly excluding paid transfers, direct applicant seeding rejected by canonical source guards, invalid intake suspension fixture, and a mistaken MFA expectation for GET. Fixes use explicit fields, unique immutable events, read-only original-reference lookup, actual intake/signup handlers and the existing write-only MFA policy. Final holds additionally cover post-payment contradictions and evidence aging between preparation and approval.

## Migration intent

`docs/migration-proposals/finance-workflows.sql` is additive and unnumbered, generated by the adjacent checked-in script. It adds sandbox workspaces/policies, versioned members/records, immutable commands/decisions, journals/balances, source and provider claims, evidence/conflicts and transactional guards. It reads existing canonical source tables without changing their values. It is applied only to in-memory/local test databases here.

Central alone must number it after the integrated canonical migrations and update `db/schema.ts`, Drizzle metadata and readiness inventory. No canonical migration, schema or lock configuration was edited. Existing history must be retained by forward migration. Schema tests apply all canonical migrations plus the proposal with hosted SQLite limits and verify both financial locks remain disabled.

## Actual provider versus simulation

All new monetary journeys here use `DeterministicFinanceProvider`, signed simulator callbacks and independent synthetic bank attestations. **Zero actual provider transactions were executed.** The new dispatch route is explicitly simulator-only; it must not be described as a tested external Paystack adapter.

Read-only native environment discovery found test-named Paystack secret entries with redacted values, not executable credentials. No local/process test key was available. Names alone do not establish account capabilities. Automatic approval review also rejected the proposed authenticated probe because it could transmit a credential to Paystack. The replacement inventory script cannot make network calls or read secret values; `provider-test-evidence.json` records exact unexecuted checks.

External-only checks: authenticate the designated Paystack development account, confirm supported South African products/recipients, exercise provider-approved synthetic checkout/collection methods, actual signed webhooks and verification, refund failure/attention/retry and transfer failure/reversal/recovery. Connecting these new workflow operations to actual provider payloads remains a provider-boundary integration requirement; the simulator does not prove that mapping. Paystack documents that settlements are not processed in test mode (https://paystack.com/docs/api/authentication/), so bank settlement remains explicitly simulated for this rehearsal.

## Central’s next action and remaining acceptance

1. Import the exact isolated commit/patch, review and number the additive migration, and reconcile shared schema contracts.
2. Frontend owner wires the supplied catalogue/order/command-review/payment/history/entitlement contracts into the shared UI. Identity owner consumes the separate authenticated readiness hook without treating sandbox evidence as production eligibility. No task-send capability was exposed in this session, so this handoff is not a claimed messaging receipt.
3. Independently test the merged candidate, including authenticated browser journeys, private cache clearing, multi-party approvals, adverse provider outcomes and source/version races. The local HTML evidence viewer is already reviewable.
4. Complete the precisely unexecuted external provider-boundary checks in the designated test account when usable credentials and execution approval are available. Production statutory/business-rule acceptance and eventual real-money acceptance remain later owner decisions.

No real transfers, real-person submissions, financial communications, production configuration changes, lock changes, deployment or publication were performed. Whole-site acceptance is not claimed.
