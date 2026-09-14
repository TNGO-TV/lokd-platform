# Central finance UI contract audit

Read-only owner snapshot at 2026-09-14T20:18:09Z. No owner code edits, duplicate implementation, browser servers, test runs or native-owner message delivery. This report is the only authorized write.

## Exact active source and contract paths

Frontend source: `/home/ammosync/.codex/visualizations/2026/09/13/01a09c3b-a93f-7721-8861-e941dd214476/sandbox-completion/source`

Relevant files relative to that source:
- `app/components/sandbox-finance-workspace.tsx` — modified 2026-09-14T20:15:10.872509187Z.
- `app/components/sandbox-finance-actions.ts` — structured command fields.
- `docs/launch/frontend-sandbox/CONTRACT-REQUESTS.md` — modified 2026-09-14T19:58:15.667810357Z; database boundary at lines66–70, remaining metadata/evidence reads at line70.
- `tests/integrated-browser/sandbox-contract.spec.mjs` — owner's integrated local handler tests; not independently executed in this audit.

Identity source: `/home/ammosync/.codex/visualizations/2026/09/13/01a09c3c-0e07-7132-88c8-123a1dbfc216/identity-sandbox-completion`

Relevant files relative to that source:
- `app/lib/sandbox-completion-policy.ts` — requireSandboxCompletion checks and returns distinct SANDBOX_DB, lines5–14.
- `app/api/sandbox/application/route.ts` — actual intake passes guarded db to existing application/enquiry handlers, other commands executeSandboxApplication.
- `app/api/sandbox/identity/route.ts` — authenticated identity adapter.
- `app/lib/sandbox-application.ts` — application/service dispatcher.
- `app/lib/sandbox-training.ts` — modified 2026-09-14T19:41:18.391708899Z; independent simulated entitlement/assessment adapter.
- `docs/launch/IDENTITY-SANDBOX-CONTRACTS.md` — modified 2026-09-14T19:21:58.980863918Z.

Root finance contract: `/srv/ammosync/workspaces/lokd-security/docs/finance-sandbox/CONTRACT.md`.
Root integration targets: `app/api/finance-workflows/route.ts`, `app/lib/finance-workflows.ts`, `app/lib/finance-workflow-store.ts`, `app/lib/finance-workflow-provider.ts` in that checkout.

## Received and started owner evidence

Frontend task01a09c3b-a93f-7721-8861-e941dd214476 has a USER rollout entry2026-09-14T19:01:00.390Z containing `/srv/ammosync/workspaces/lokd-security/docs/launch/sandbox-completion-prompts/FRONTEND-PROMPT.md`. Assistant19:33:06.596Z reports building payroll correction, engagement split, allocation, dispute, enrolment and training forms. Assistant20:12:08.326Z identifies DB mismatch and explicitly provisional finance acceptance. Its source was still modified at20:15:10Z. This proves receipt and started implementation, not merely prepared assignments.

Identity task01a09c3c-0e07-7132-88c8-123a1dbfc216 has a USER entry2026-09-14T19:00:21.374Z containing the corresponding IDENTITY-PROMPT.md, assistant acknowledgement19:00:28.953Z, separate DB work19:05:50.417Z, training work19:45:30.309Z and hosted independent-approver test correction20:07:54.389Z. Test statements are owner claims, not independent audit passes.

Rollouts: `/home/ammosync/.codex/sessions/2026/09/13/rollout-2026-09-13T21-25-50-01a09c3b-a93f-7721-8861-e941dd214476.jsonl` and `/home/ammosync/.codex/sessions/2026/09/13/rollout-2026-09-13T21-26-16-01a09c3c-0e07-7132-88c8-123a1dbfc216.jsonl`.

## Integration findings

1. Root finance route passes env.DB to all finance operations. Identity requires prelaunch, explicit completion enablement, DB and SANDBOX_DB distinct, unmarked primary DB, and policy-hash-marked SANDBOX_DB. Its actual intake/service sources are in SANDBOX_DB. Choose a guarded common finance source binding or integrity-checked projection; never alias primary and sandbox bindings or seed replacement approved applicants to fake the joined journey.

2. Authenticated financeReadiness exists in root `app/lib/finance-workflows.ts:13` and GET applicationId. Frontend consumes that read for participant display. A fresh search of the entire identity app at20:18Z found no financeReadiness or finance-workflows reference. Identity sandbox-training.ts:7–16 instead issues a separately simulated entitlement from officerId/course/courseVersion/commercialReference, then its assessments consume local sandbox_training_entitlements. Thus the actual finance-entitlement bridge remains absent. Preserve the original owner/application version and exact package/course versions, propagate financial hold/refund/revocation, and maintain independent assessment/qualification. Buying training must remain workEligible:false.

3. Central's canonical Operations check for privileged workspace members is acknowledged and is not reported as an open authorization defect. Remaining UI capability discovery is separate: current frontend chooses command forms from page operations/officer kind while backend enforces member.role and limit_cents. Return current role, limit and allowed actions so guided UI can select legal actions without weakening server checks.

4. Backend records are ascending history with100 rows/page and nextAfter. Frontend deduplicates id/version on Load more, but derives displayed current records from last loaded version and plain refresh replaces loaded pages. Therefore an unread later version can be mislabeled current and loaded lineage disappears after refresh/mutation. Publish authoritative currentRecords separate from records history and preserve compatible history cursors. Frontend owner must consume the final contract; these are current in-progress source observations, not independently reproduced browser failures.

5. GET commandId already provides exact original command and decision/reviewer/findings. Frontend renders exact pending queue input_json/plan_json/digest but has no historical commandId read path yet. Queue currently caps100 without continuation. Add queue/history pagination and provider/bank read discovery for guided reconciliation. No independent payment acceptance is established by raw dispatch receipts.

## Exact existing names versus proposed additions

Preserve existing: environment, records, balances, commands, nextAfter; GET workspace/id/after, commandId, catalogue=training, applicationId. Preserve command fields id, input_json, plan_json, digest, policy_version, maker_user_id, decision; command read additionally reviewer_user_id/findings. Preserve training catalogue packages and readiness applicationId/applicationVersion/enrolmentPaid/training/workEligible.

Proposed additive names below are recommendations for Central to publish, NOT already agreed or delivered contracts:
- `member: {role, limit_cents, version}` and `policyVersion`; `capabilities: {prepareActions: string[], canDecide, canDispatch, canRecover, canRecordBankEvidence}` computed from current canonical+workspace authority.
- `currentRecords` for authoritative latest version projections, independently paged via `currentAfter` / `nextCurrentAfter` if bounded; never imply the first page is exhaustive.
- `commandsAfter` / `nextCommandsAfter` for pending queue continuation, stable opaque cursor; preserve exact GET commandId for decision history. A distinct paged command-history dataset should include decided records rather than silently treating pending queue as history.
- Authorized GET `operationId` inspection returning `operation`, `claims`, `evidence`, `bankObservations`, `conflicts`, with independent dataset cursors where bounded. Evidence must expose authoritative event/source/reference/amount/currency/status/final/observedAt/recipient/providerId/attempt/mode necessary to inspect reconciliation; no secret simulator key or raw credentials.
- Authorized workspace discovery, e.g. GET `catalogue=workspaces` returning current authorized `workspaces` and installed policy identifiers. Current UI otherwise requires manual workspace IDs.

Exact prepare replay also omits environment/policyVersion/applied:false that initial receipt returns; normalize additively if establishing a stable receipt contract. Existing command envelopes, independent digest-bound review, integer-cent inputs, exact accepted training terms and access-denial clearing broadly align.

Central should publish final names and source binding, then coordinate the active owners and independently test the single original application → actual completed service → payroll/training chain. Publication of this report or owner contract requests is not delivery to a native task.
