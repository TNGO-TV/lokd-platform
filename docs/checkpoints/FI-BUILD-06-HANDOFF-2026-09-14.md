# FI-BUILD-06 checkpoint — Central integration handoff

Implemented from **c358358d6ad1ad59ba2f8e39513928c343e5736b**, the combined review release, in isolated branch `codex/fi-build-06`. The exact feature commit, changed files, artifact hashes and actual validation results are in the adjacent durable `receipt.json`. Shared checkout `/srv/ammosync/workspaces/lokd-security` was not edited. No old snapshot was imported.

## Implemented

- Independently approved credit notes linked to the original issued invoice, exact reviewed net/tax components, cumulative capacity guards, private client reads and unique immutable numbering.
- Separately numbered reversal of an unclaimed credit followed by a corrected positive issue. Original records remain. A credit committed to an uncertain or completed refund cannot be voided or reused.
- Credit-linked partial/full refunds with original collection identity, current authority/amount limits and source/liability snapshots. One durable case claim precedes any POST; concurrent dispatch and uncertain delivery cannot create a second submission.
- Read-only adoption/recovery of an existing provider refund, with no new POST. Signed event, fresh API identity and deduction evidence, unique bank evidence and independent reconciliation are all required for financial refund status. Provider success alone is insufficient.
- Sequential partial accounting, exact full reversal in the canonical invoice view, retained issued/current distinction, immutable receipt history and persistent held funding. Disputes, contradictory evidence, failed/missing verification and stale evidence remain held. No service or earned payroll is canceled or consumed again.
- New backend endpoints and an exact frontend contract. No shared frontend component or existing API route was edited. Frontend integration is still required; no new credit UI/browser journey is claimed.

Useful prepared FI-06 code was reviewed against this combined baseline and selectively reused (evidence parser, one-shot claim/reconciliation structure and fixture scenarios). The older full-only assumption, original-reference uniqueness and rich-only webhook assumption were replaced. FI-05/FI-02 and the integrated finance-document fixes were preserved.

## Locally verified

Production build passed. The combined regression passed **369 tests, zero failures/skips** in 24.263 seconds (`final-regression.log`). A final targeted rerun additionally verifies each environment/database dispatch lock independently (`locks-final.log`). TypeScript and changed-file lint passed. Restricted SQLite migration execution, foreign keys and view queries passed. Both proposal generators reproduce their SQL. Whitespace and unchanged shared-scope checks are recorded in the receipt.

New coverage reuses the existing collection/order/invoice fixtures and injected transports. It covers both test/live-mode synthetic data, all live gates, failed delivery, single POST claims, same-reference GET recovery, existing-refund adoption through bank approval, signed replay, stale observations, events during dispatch, wrong authority, maker separation, concurrent decisions, partial-to-full refund accounting, sparse documented webhook matching, credit capacity races, immutable correction/reissue, cross-client HTTP denial and private headers. Test confirmations never become live refund status. Existing combined payroll/service/suspension/recovery regressions remain part of the suite.

Failed development runs are retained in adjacent logs. The first failure was an assertion expecting the older guard message after a new held-funding guard correctly denied dispatch; the assertion was updated to accept either valid denial. No failed test or screenshot assertion was removed. No new checkout fixture, real account, genuine bank/provider record or external provider call was created for this checkpoint.

## Migration and contract

Read `FI-BUILD-06-CONTRACT-2026-09-14.md` for exact endpoints, state fields, roles, error handling and provider references. Central applies canonical history through0068, then unnumbered credit-note SQL, then unnumbered refund SQL; Central alone assigns canonical numbers and merges the shared Drizzle declarations/journal/snapshots. SQL is the exact proposed schema contract. Existing fixture-only loads must be removed once those proposals become numbered migrations. No applied migration is rewritten.

Both payment locks remain unchanged, and live refund dispatch additionally requires two default-off refund gates. Live shift scan and the owner's MFA exception remain unchanged. TNGO scope, agreement wording and runtime/credential configuration were not touched. There was no deployment, real transfer, provider submission or financial communication.

## Remaining work and external acceptance

Read `FI-BUILD-06-GAP-REGISTER-2026-09-14.md` for every FI-01–09 and EX-01–03 item, source evidence, unfinished build work and exact missing inputs. Historical 'later' labels are not exclusions. The bounded backend checkpoint is implemented and locally tested; the whole finance build is not finished or externally accepted.

Immediate next step: **Central serially integrates the feature patch and schema proposals, frontend wires the delivered refund/credit endpoints and private credit layout, and an independent reviewer performs combined local QA.** Follow-on finance assignments should cover EX-01 payroll adjustments/split engagements, EX-02 partner corrections, EX-03 partial allocation and FI-07 enrolment. Dispute contest/final chargeback disposition, customer-bank-details retry, residual funding release and larger-history pagination remain explicit gaps. Unknown or disputed funding is never released by a UI label or an operator's free-text note.

Actual commercial/tax/refund policy and document wording, provider entitlement/envelope acceptance, bank-entry evidence mapping and intended independent identities remain external inputs. Live testing is deferred until the build is complete and separately authorized. This handoff does not claim another task received a message.

## Durable learning

Observation: the earlier prototype expected refund ID/merchant-note/deduction fields in every signed event, while the published webhook example is sparse. Action: separate API and signed-event normalization, preserve their distinct identifiers, and require case/transaction/integration/amount matching plus bank-backed independent approval. Result: locally tested sparse event reconciliation without relaxing unknown/contradictory outcomes. Re-evaluate against genuine account-specific evidence before enabling execution.

Observation: reducing an invoice by a credit and returning cash are separate accounting actions. Action: independently issue the credit, then reserve it with an immutable refund claim; reverse only unclaimed credits. Result: local races cannot over-credit an invoice or reuse a claimed credit, and earned liabilities remain retained. Extend this same source/claim distinction to payroll and partner exceptions rather than editing historical rows.
