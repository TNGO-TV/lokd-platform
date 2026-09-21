# Frontend sandbox completion — early interface requirements

Assignment received; active implementation from Central `ab6acbd` (only prompt/document additions since the accepted `213f0e9` application baseline). Policy version: `lokd-sandbox-completion-v1`. Frontend owns UI; Identity/workforce and Finance own application services/routes. Central owns shared policy, schema and canonical integration. No new backend contract below is represented as already implemented.

Owner contract locations being monitored: identity-sandbox-completion/docs and finance-sandbox/source/docs in the existing owner artifact roots. This file is a published request, not a claim that a task message was delivered. No send-to-task tool is available in this session.

## Cross-workflow requirements

Every transactional view needs an authorised GET returning current records, immutable history, policy version/scenario and capabilities; exact source/version binding; private download descriptors where applicable; POST receipts retaining request reference; deterministic retry and stale-input outcomes. Client fields cannot select an actor, provider mode, permission or arbitrary download URL. Server policy/environment must enforce isolation. Avoid alternate UI-specific ledgers or duplicate state.

Representative envelope for NEW contracts (proposal to owners, field names to align before integration):

```json
{"policyVersion":"lokd-sandbox-completion-v1","scenarioId":"identity-person-pass","mode":"simulator","record":{"id":"synthetic-case","version":1,"status":"pending"},"capabilities":{"canSubmit":true,"canReview":false},"history":[]}
```

```json
{"action":"OWNER_DEFINED_ACTION","requestKey":"original-browser-generated-uuid","recordId":"synthetic-case","expectedVersion":1,"policyVersion":"lokd-sandbox-completion-v1","fields":{"OWNER_DEFINED_FIELD":"synthetic-value"}}
```

```json
{"recordId":"synthetic-case","requestKey":"original-browser-generated-uuid","recorded":true,"status":"pending","version":2,"mode":"simulator"}
```

Existing endpoints retain their actual shapes. UI does not send invented envelope fields to existing handlers. On unknown write retain original body/key while authorised, refresh/adopt original response and never silently submit a new key. GET401/403 removes cached private records/forms. GET409 must identify stale source versus unavailable ownership without disclosing another party. Downloads need private/no-store plus server ownership checks; browser-supplied remote URLs are not accepted.

## Identity/workforce owner

- Capture/consent: publish concrete GET/POST/upload endpoint and exact file/type/size/retention rules; policy-bound exact consent text; capture reference, current applicant version, independent outcome/recovery references. UI implements file input and consent, then actual submission/status/recovery, not raw hidden provider evidence JSON. Existing `start_identity` uses applicantId/applicantVersion/captureReference/consentVersion; provider adapters remain server-selected.
- Private evidence: approved reader route, authorised case/evidence selectors, media types, download response, generic denied/expired/superseded states and audit confirmation. Raw provider evidence is never copied into frontend telemetry/handoff.
- Partner responsibility: prepare and independently decide employer/payroll/benefit responsibility with actual version-bound evidence and model-specific capabilities; do not replace ready strings in the browser.
- Service dispute/incident: exact actions for officer completion, client dispute, independent pay review/resolution, correction and escalation; status/history/source bindings and resulting payroll eligibility. Existing service actions remain available.
- Assignment/presence: managed/partner/specialist/multi-company contexts, real service/order/induction source selectors, scan/clock/GPS sandbox scenarios, consent version and stop/expiry outcome contracts. Never infer work authority from payment/training.
- Clerk DEVELOPMENT: supply designated development accounts/roles, secure test-harness path, configured test instance evidence and role/session fixtures. No credentials in this request. Hosted development acceptance is separate from locally injected authentication.

## Finance owner

- Actual payroll corrections and splits beyond report-only review: exact prepare/approve/apply/reconcile services, signed amount/tax/deduction calculations, effective engagement boundaries, corrected payslip lineage and status. Original exports remain immutable.
- Partner invoice correction/replacement: exact current source, company authority, amounts/tax, independent review, immutable private invoice/remittance versions.
- Partial allocations / multi-company: source balances, permitted allocations and liability splits, atomic conservation states, independent decisions and reconciliation/recovery.
- Refund dispute/final chargeback and residual liabilities: prepare/contest/final disposition/reconcile references and capabilities. Do not infer cancellation from credit issue or provider processed status.
- Enrolment R350/SAST: versioned terms, eligibility, initialize/recover original checkout reference, actual provider test URL allowlist, cancellation/refund and non-work-eligibility response. Browser must preserve original unknown request.
- Training: versioned products/providers/price/terms, enrol/checkout/recover, entitlement, completion/revocation and qualification handoff; purchase never equals permission to work.

Frontend will build UI fixtures against the agreed examples as contracts arrive, then exercise the same pages through actual integrated handlers and a migrated isolated database. Mocked fixtures are supplementary; no full journey will be marked complete on text assertions alone.

## Read of identity owner working contract, 2026-09-14

Implemented frontend consumer for current `POST /api/sandbox/identity {action,input}` envelope and its capture/start/read/recover/decide/download/grant actions. UI mounted at `/officer/sandbox` and `/ops/sandbox` with existing page auth/Operations checks. This is integration in progress; not yet accepted against the new handler.

Required owner integration details discovered from actual code:
- `capture` currently generates a new reference per call and accepts no original request key. Need idempotent request key + current capture discovery/recovery so a lost capture response can be recovered without another capture. UI preserves the uncertain state rather than duplicating this write.
- Need authorised case/capture/grant discovery and policy/consent-text read for normal navigation, refreshing and source picking; manually pasted references cannot finish the whole guided journey.
- Confirm how intake enters SANDBOX_DB using actual application/link/review handlers. Current public handlers use DB; sandbox identity correctly requires a distinct SANDBOX_DB. The integrated UI harness must not defeat that separation by aliasing bindings or seed approved identity directly.
- Evidence grant/revocation list must be readable so owner can review/revoke the correct existing grant. The protected reader itself returns an actual private stream; UI downloads it without rendering raw evidence in telemetry.
- Frontend provisional fictional consent text is in `sandbox-identity-workspace.tsx`, bound to current `lokd-sandbox-consent-v1`; Central/owner should publish exact policy content/version through the sandbox read contract. This is synthetic consent, no real processing approval.

## Read of Finance owner working contract, 2026-09-14

`/api/finance-workflows?workspace=...` now exists. UI is being built for `create_workspace`, prepared commands `{action:"prepare",requestKey,policyVersion,command}`, independent `{action:"decide",commandId,digest,decision,findings}`, dispatch/recover and bank evidence; records come from the authoritative GET.

To complete guided review and participant journeys, please include in the authorised GET (or publish distinct read routes): current member role/limit; workspace and installed policy discovery; pending command ID/digest/exact input/plan/current decision plus current source bindings; public-in-workspace active training packages with exact terms for participants; private issued-document descriptors; original dispatch/evidence/bank observation discovery for read-only recovery. Current record-only GET cannot show a reviewer the stored command before approval, and owner-filtered package rows are not visible to the Officer who must accept their exact terms. UI must not substitute locally cached maker text as independent authoritative review evidence.

Current frontend coverage targets all implemented accounting/commercial actions with structured forms (including source rows and engagement segments), participant enrolment/training orders, independent decision and original-operation recovery. Every amount is whole ZAR cents from the service contract; display values do not recalculate balances or policy outcomes in the browser.

## Combined database binding contract — required for one connected journey

The identity owner routes all `sandbox/application` intake, service and readiness sources to a guarded, separately marked `SANDBOX_DB`. The finance workflow HTTP route currently uses `env.DB` for its canonical `signup_cases`, booking and timesheet reads. In a combined runtime those are intentionally different databases, so an Officer application or service record created through the sandbox application UI cannot automatically become a finance source. Central/backend owners must provide the guarded common source binding or an explicit integrity-checked source projection. Frontend will not alias the databases, seed duplicate source records or reinterpret a primary-database fixture as a connected sandbox journey. This must be tested with one application → actual service → payroll/training source chain after integration.

Finance has now published the authenticated training catalogue and exact queue fields (`input_json`, `plan_json`, `digest`, actor and policy). Frontend is consuming these concrete shapes. The authorised workspace/member discovery and provider/bank evidence inspection contracts remain necessary for guided selection and independent reconciliation.

## Central integration progress (provisional combined browser run)

Central added `financeSandboxDatabase`, guarded `SANDBOX_DB` selection, workspace/capability discovery, current-record queries, command pagination and operation-evidence reads. The previously reported DB binding mismatch is resolved in Central's committed **c0f6c620624d73b4d338859c92b4009371794273** candidate. The frontend consumes workspace/capability/current-record/queue contracts. The local two-database browser fixture now creates and links the application through the identity owner's `/api/sandbox/application`, prepares one R350 enrolment despite a lost response, rejects self-review, issues the independently approved unpaid invoice, verifies its private download and rejects another Client. Mobile and desktop both pass; primary intake tables stay empty. Exact candidate file hashes are captured beside the SQLite evidence. This is provisional combined-handler evidence, not Central's independent merged-candidate QA.

Remaining concrete identity/UI needs: authenticated current application/capture/case and consent discovery; intake current-version/history reads for correction/review; readiness/hold/disposition history reads against SANDBOX_DB; passport delivery metadata and protected recipient reader against that same binding; actual Clerk development browser harness. Training, engagement and specialist mutation contracts now have frontend forms, but their full source-inspection and independent browser journeys still need the final owner contract and frozen candidate.


## Final owner checkpoint reconciliation

Identity published `6f8857e` after merging Central `c0f6c62`; Finance published `e4fd8f4` and Central integrated its corrected version. All three tasks were idle at this frontend checkpoint. The final actual-handler browser run uses Central c0f6c62 finance plus Identity 6f8857e, with file hashes in the evidence manifest. It passes four mobile/desktop tests. No backend source or shared schema was edited by Frontend.

Consumed final additions: applicant-owned `training/import_finance` replaces the removed commercial `entitle` action; separately assessed qualification remains distinct. Incident report/acknowledge/investigate/escalate/resolve/close bind original request keys and versions. Specialist commercial, supplier and deployment-pack controls now use the guarded application transport, with current private pack reads before download.

Remaining ownership assignments (not completed acceptance):
1. **Identity + Central:** authenticated discovery/current/history contracts against SANDBOX_DB for intake corrections/review, captures/consent/grants, readiness/holds/dispositions, passport delivery/current recipient reads and incident history. Publish exact current-source examples, capabilities and stale/unknown recovery behavior. Existing production readers cannot be silently pointed at sandbox records by frontend.
2. **Identity:** idempotent intake/capture/import request discovery. Current uncertain capture/intake/import forms preserve their request but cannot safely manufacture an original reference after a lost response. Supply original-command lookup rather than recommending a replacement submission.
3. **Frontend after those contracts:** guided source selectors and complete sandbox correction/disposition/passport audit journeys; complete connected browser proof for partner responsibility, service dispute/incident, assessed training, specialist activation, payroll adjustments/splits and multi-company partial allocation. Current forms and mocked tests are not this proof.
4. **Central + independent QA:** apply both owner patches, install sandbox-only SQL only in the distinct marked sandbox database, and test the full merged application with the owner's real Clerk DEVELOPMENT harness. Identity reports hosted Clerk tests passed; this frontend task has not independently rerun them with these new pages.
5. **Finance + Central:** actual Paystack test compatibility remains unexecuted; deterministic simulated payment evidence is not actual provider acceptance. No production dispatch or payment setting change is requested.
