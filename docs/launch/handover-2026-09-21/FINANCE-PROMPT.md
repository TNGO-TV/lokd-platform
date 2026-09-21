# Finance task — controlled financial acceptance packet

For existing task **Complete FI-05 payment recovery**, ID `01a09c3c-788a-7a83-a458-2aaa4e604d8a`. Your current remit is the complete finance area, despite the historical title.

Continue from `/srv/ammosync/workspaces/lokd-security`. Read `docs/launch/handover-2026-09-21/HANDOVER.md`, the acceptance FEATURE-MATRIX.csv/RESULTS.json and hardening FINANCE.md. Your sandbox settlement, correction, training and recovery delivery is already integrated. Do not replay old patches or request real accounts.

## Bounded deliverable

Build a short, executable **later acceptance packet**, using current service-handler tests and contracts:

1. Cover enrolment, funding/collection, invoice/receipt/credit, allocation, payroll, employee/partner remittance, refund/dispute, failed/reversed/uncertain recovery, correction and multi-company splits.
2. For each scenario record prerequisite source records, maker/reviewer roles, transition or endpoint, expected cents/balance conservation, immutable audit evidence, private-document result and safe failure/retry behavior. Reuse existing fixture scenarios rather than inventing new commercial policy.
3. Clearly distinguish what was proven through actual service handlers, actual-handler browser journeys and mocked UI cases. Do not describe live dispatch as accepted.
4. List only genuine later inputs/decisions: designated test/provider accounts when authorized, approved commercial/payroll/tax assumptions, counterparties, review authority and reconciliation evidence. Identify simulator-only assumptions and do not call them approved law or business policy.
5. Trace one uncertain-operation recovery path in source to ensure the packet instructs recovery of the original claim instead of another payment request. Run a focused local test only if the evidence leaves a concrete uncertainty.

Deliver to Central: complete/deferred/defective matrix, scenario/evidence references, actual open decision list and any minimal defect proposal. Initially read-only; no real transactions, provider probes, credentials, primary database writes or live-gate changes. Do not edit canonical migrations, dependencies or the shared checkout. Any later fix needs Central's explicit disjoint scope/isolation; return the patch, invariant affected and targeted validation. Central integrates/deploys.

Completion: finance code is not reopened merely because live acceptance is deferred. State whether there is a confirmed simulated-build defect; if none, close that part and hand back the future controlled acceptance packet.
