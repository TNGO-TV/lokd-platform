# Finance workflow integration contract

Base: `213f0e99ffbe142f4718624ef38c127f05366fb1`. Finance owns these backend files; frontend owns shared components. Central owns canonical migration numbering/schema metadata. This is an additive application workflow, scoped by an immutable sandbox workspace; it reads canonical booking, submitted applicant and approved service records. It never updates production payment controls, production payroll amounts or work eligibility.

## Runtime and identity

`LOKD_FINANCE_ENVIRONMENT=sandbox` is mandatory. A supplied Paystack secret must have a test prefix. `FINANCE_SIMULATOR_KEY` enables deterministic dispatch and HMAC callbacks. No configuration is changed by this patch. `worker/clerk-auth.ts` continues to strip caller identity headers; verified account identity is required for browser endpoints. Operations writes retain existing MFA policy, including the owner-authorized server switch. Workspace members have preparer/reviewer/client/officer/trainer roles, versioned authority and minor-unit limits. Participant reads are private to their own records; operations visibility requires current workspace membership. Training does not grant employment eligibility.

## Endpoints

`GET /api/finance-workflows?workspace=ID[&id=RECORD&after=SEQUENCE]`: immutable record history, calculated `financialState` (`unpaid`, `pending`, `paid`, `held`, `reversed`), nextAfter cursor, and operations-only command review queue and journal balances. Documents contain original source/statement references. `GET` with `commandId=ID` returns the exact private command and decision, including older decisions. The queue shows the oldest100 undecided commands; reviewing them exposes the next pending items. Queue rows expose exact immutable `input_json`, `plan_json`, digest and decision; parse them to show the reviewer the proposed entries and source versions. Clear private UI caches on 401/403. Never infer paid from an API success or a prepared command.

`GET /api/finance-workflows?workspace=ID&catalogue=training`: current active package prices, providers, terms and immutable package versions for authenticated workspace members.

`GET /api/finance-workflows?workspace=ID&applicationId=ID`: applicant's current-version enrolment and training readiness, expiry/revocation/held status, always `workEligible:false`. Identity owner should consume this authenticated hook separately from identity/PSiRA/readiness evidence. The returned sandbox evidence must not satisfy a production activation gate.

`POST /api/finance-workflows?workspace=ID`, same-origin JSON:

- `{action:'create_workspace',id:'sbx-...',members:[{userId,role,limit}]}`: Operations owner bootstrap, installs `lokd-sandbox-completion-v1`.
- `{action:'prepare',requestKey,command:{action:DOMAIN_ACTION,...fields},policyVersion?}` returns `{commandId,digest,result,applied:false}`. Reusing the exact key/body returns the original command; changing the request under a used key fails.
- `{action:'decide',commandId,digest,decision:'approved'|'rejected',findings}`: different current reviewer, exact digest, sufficient limit. A decision race has one winner. Stale source/authority/evidence rolls back the entire decision and journal.
- `{action:'dispatch'|'recover',operationId,scenario?:'success'|'failed'|'reversed'|'pending'|'needs_attention'|'timeout'}`: deterministic provider only. Dispatch inserts the durable claim before crossing the provider boundary. Recovery performs lookup against the original reference; it never creates a second transaction. The response is pending/held, never paid.
- `{action:'bank_evidence',operationId,eventId,evidence}`: independent reviewer records matching final sandbox bank evidence. No arbitrary provider evidence becomes paid through this action.

`POST /api/finance-workflows/webhook`: HMAC SHA-512 `x-paystack-signature` over exact body `{workspace,operationId,eventId,evidence}` using the simulator key. Mode must be simulator. Browser authentication is bypassed; signature authentication is mandatory. This is explicitly not the external Paystack webhook adapter.

Evidence fields: `{reference,amount,currency:'ZAR',status,final,observedAt,recipient:null|string,providerId,attempt,mode:'simulator'}`. Final reconciliation requires fresh matching API, signed-event and independently attested bank records; wrong authority, conflicting replay, stale evidence or missing events remain held. Claims, original references and evidence persist.

## Domain commands

All fields below belong inside `command`; money is integer ZAR cents.

| Action | Fields |
|---|---|
| open_order | id, bookingId, clientUser; price/service come from canonical booking |
| prepare_collection | id, orderId, amount |
| allocate_funds / release_allocation | orderId, companyId, amount |
| approve_destination | id, ownerUser, recipientCode, purpose?:tax, companyId?; versioned destination code |
| approve_company_recipient | companyId, ownerUser, reference; independently approved company representative |
| recognize_payroll / recognize_partner_invoice | id, orderId, ownerUser, sources:[{id:approvedTimesheetId}], periodStart?, periodEnd?, payDate?; defaults to source-date span and current SAST pay date |
| prepare_payout / prepare_tax_payout | id, liabilityId, destinationId, amount, replaces? |
| adopt_exported_payroll | id, itemId, orderId, ownerUser; preserves actual exported item, export reference, snapshot hash and active service claims |
| correct_payroll / correct_partner_invoice | payrollId, segments:[{id:originalLiabilityId,gross}], reason; preserve every engagement |
| recover_overpayment | id, overpaidLiability, newLiability, amount, consent |
| cancel_unsubmitted | operationId, reason; any durable claim prevents cancellation |
| reconcile_operation | operationId |
| issue_credit_note | id, orderId, amount, reason, replacementOf? |
| void_credit_note | creditNoteId, reason; only unused credits |
| prepare_refund | id, creditNoteId, collectionId, amount?; supports multiple partial receipt allocations |
| retry_refund | operationId, destinationId; only reviewed failed/reversed/needs-attention; original reference retained |
| open_dispute | id, orderId, amount, reference |
| record_bank_disposition | id, disputeId, outcome:'won'|'lost', amount, reference |
| resolve_dispute | disputeId, outcome, evidenceId; separate approved final bank disposition |
| restore_funding | id, orderId, amount; creates linked top-up invoice/collection |
| apply_restored_funding | topupId; requires reconciled funds, first clears residual debt |
| publish_package | id, title, provider, price, terms, active?; immutable package versions |
| order_training | id, applicationId, packageId, acceptedTerms; applicant prepares |
| order_enrolment | id, applicationId; applicant prepares; exactly R350 |
| issue_entitlement | orderId; exact reconciled payments and current applicant version |
| revoke_entitlement | entitlementId, reason |
| record_completion | id, entitlementId, provider, reference; independent approval and no reference reuse |
| cancel_order | orderId, reason; resolve pending initialization first |

## Policy

`lokd-sandbox-completion-v1`: fictional 10% tax, 5% deductions, 1% employer levy; recovery needs consent and cannot exceed 20% of the next due amount; training validity365days, refundable100%; enrolment35000cents. Alternative policy uses 20% tax, no deduction, 10% recovery cap, 30days and50% refund. Floors apply to aggregate cents; largest-remainder allocation preserves exact totals across engagements, with stable ID tie-break. BigInt intermediate allocation avoids floating-point overflow. Calendar labels are Africa/Johannesburg; midnight is22:00UTC on the previous date. No claim of statutory accuracy.

## Migration and acceptance

Apply `docs/migration-proposals/finance-workflows.sql` after the canonical baseline in an isolated database. Central must number it and add shared schema/metadata; owners did not touch those files. Roll forward, never delete immutable records. Existing payment/refund/scan locks remain untouched.

Frontend integration and merged-candidate independent QA must run after Central imports the patch. This backend task does not assert a completed browser journey or whole-site acceptance. No task messaging capability is available in this session; this file is the concrete contract handoff, not a claimed delivery receipt.

Actual Paystack calls are unexecuted: usable test credentials are absent locally and native secret values were redacted. A proposed authenticated probe was rejected by automatic approval review. The network-free inventory records this explicitly. External test account authentication, checkout/card/channel compatibility, real signed callbacks, refund and transfer capabilities remain separate acceptance checks. Provider settlements are unavailable in test mode according to https://paystack.com/docs/api/authentication/ .

## Central integrated contract amendments — 14 September 2026

These amendments supersede the original runtime and migration paragraphs above. Canonical migration0073 is the only schema source for merged fixtures; do not apply the proposal a second time. Current readiness inventory is1340 objects. Migration adds11 tables,3views,47triggers and7 explicit indexes. Nothing is applied remotely.

HTTP routes now require LOKD_FINANCE_ENVIRONMENT=sandbox, LOKD_APP_STAGE=prelaunch, LOKD_SANDBOX_COMPLETION_ENABLED=true, separate DB and SANDBOX_DB bindings, and the exact default finance policy JSON/digest preinstalled in SANDBOX_DB. They operate exclusively on SANDBOX_DB. The primary DB cannot have a sandbox identity marker or installed finance policy rows; object-identical and marked aliases are rejected. Provision the default policy only into the isolated database using the same validated policy/hash as createFinanceWorkspace; the local handler fixture creates it before route access. No production binding or setting is modified. Identity's separate installation/hash checks remain its responsibility; finance does not impersonate identity acceptance. Shared canonical intake/service sources must be in this same isolated database, not fabricated copies in the primary DB.

Privileged preparer/reviewer membership also requires canonical Operations authority. Host/session/MFA validation remains enforced by the HTTP boundary; a delegated workspace role cannot bypass it. Participant orders/reads remain privately scoped. Public body reads are bounded by bytes and a5second deadline, with runtime denial before body consumption.

Additive authenticated GET contracts:

- `?workspaces=1`: `{environment,workspaces:[{id,role,version,limit_cents}]}` for this actor's active authorized memberships. No workspace parameter required.
- `?workspace=ID&capabilities=1`: `{environment,workspace,member:{userId,role,version,limitCents},canPrepare,canReview,canOrder,canBootstrap}`. These guide UI; server still checks every action, source, amount and independent reviewer.
- `?workspace=ID&current=true[&after=SEQUENCE]`: existing record response restricted to actual current versions, with normal nextAfter. Every historical/current record also has authoritative currentVersion and isCurrent. Never infer current state from only an early history page; preserve loaded history separately during refresh.
- `?workspace=ID&commands=1[&afterCommand=COMMAND_ID]`: Operations review queue `{environment,commands,nextCommandAfter}`. Cursor references a scoped existing command and remains valid after that command is decided. Exact `commandId` historical lookup remains available; this queue is pending only, not complete decision history.
- `?workspace=ID&operationId=ID[&afterEvidence=SEQUENCE]`: privileged evidence review `{environment,operation:{...record,data},claims,evidence,nextEvidenceAfter}`. Evidence includes all sources (API/webhook/bank) with stored body_json and digest; page size100. Claims is explicitly the latest100 attempts, not exhaustive history. No key/secret is returned. This endpoint does not authorize reconciliation by itself.

Prepare replay now consistently returns environment,policyVersion,applied:false along with the original command/digest/result. Reusing that exact key is still the recovery mechanism. Reissuing an entitlement from the same paid order under a new key is rejected: renewal requires a new purchase, and revoked/expired access cannot be revived by replay. Completion binds the current applicant version/owner/status and rechecks at approval. Recovery cap is cumulative per receiving liability, frozen at its initial recovery baseline/cap and never raised by splitting commands; later lower policy/current due can tighten it. Allocation release atomically checks all current liabilities, including liabilities created after preparation.

Integration still outstanding with active owners: frontend consumes these exact new contracts and preserves historical pagination; identity replaces its provisional commercial entitlement input with the authenticated financeReadiness source/current application version, course version, payment hold/refund/revocation and separately reviewed completion. The hook always returns workEligible:false. An authenticated read does not itself grant qualification or work eligibility. These are execution dependencies, not missing-business-decision blockers. Publishing this file is not a claim that an owner task received a message.

## Central service-policy amendment — 15 September 2026

The default fictional finance policy is now `lokd-sandbox-completion-v1-services-2`, with canonical `VIP` included beside Unarmed, Armed and Specialist. The original policy omitted VIP and rejected four actual connected VIP service variants. The amended alternative uses `lokd-sandbox-completion-v1-services-2-alternative`. Payroll percentages, enrolment amount and other policy values are unchanged. This is a new policy identifier and hash; historical commands/policies are not rewritten. Local initializers and frontend command preparation use the exported policy constant. Existing isolated databases must have the new exact policy installed through their controlled initializer; a stale policy remains rejected by the binding guard. Ten model/period settlement tests pass against the amendment, including separate company partial funding and retained immutable corrections.
