# Identity and workforce sandbox contracts

Integrated baseline: Central `c0f6c62` (including canonical finance migration0073). Branch: `codex/identity-sandbox-completion`. See `IDENTITY-SANDBOX-HANDOFF.md` and its evidence index for completion and integration instructions. This replaces the early work-in-progress contract; earlier production acceptance requirements remain separate.

## Isolation and response contract

Both routes require `LOKD_APP_STAGE=prelaunch`, `LOKD_SANDBOX_COMPLETION_ENABLED=true`, separate `DB` and `SANDBOX_DB`, and an installed immutable sandbox marker matching the exact resolved policy hash. Marked aliases cannot be used as primary DB. Canonical application tables in SANDBOX_DB are compatibility projections for exercising the real services; their legacy environment/status labels are not production acceptance. No simulated result is installed in primary DB. Finance endpoints additionally require `LOKD_FINANCE_ENVIRONMENT=sandbox` and the exact installed finance policy.

Policy `lokd-sandbox-completion-v1` is fictional. Consent version is `lokd-sandbox-consent-v1`. Default identity evidence lifetime24h, capture24h, retention-review30days; workforce weekly caps24h direct-flex and48h managed/partner, minimum rest8h; training pass80%, qualification90days; presence180seconds, scan age120seconds/radius150metres; incident SLA low240/medium60/high15/critical5minutes. Existing canonical service, review and employment gates still apply. The policy's configurable bounded values and exact hash are in `app/lib/sandbox-completion-policy.ts`; install a separate database for a different policy. A tested alternative pass threshold90% changes an80% assessment to failure. Finance's separately hashed policy has its own365day commercial entitlement and tax rules; qualification expiry is the earlier of commercial expiry and the90day assessment policy. R350 enrolment is unchanged.

Verified Clerk user/email, role, intended host, Operations MFA and same-origin JSON checks apply. Caller-supplied actor/provider/environment/authority fields are rejected. Bodies are bounded while streaming: identity16,000bytes, application64,000bytes, deadline5seconds. Runtime denial occurs before reading the body. Responses are `private, no-store` and `no-referrer`.

- Identity JSON: `{mode:'simulator',policyVersion,policyHash,productionIdentityVerified:false,productionWorkEligible:false,data}`.
- Application JSON: `{mode:'sandbox',policyVersion,policyHash,productionWorkEligible:false,data}`.
- Private identity download is binary with `x-lokd-evidence-mode: simulator`; do not parse it as the JSON wrapper.
- Errors:400 invalid input,401 sign-in,403 authority/independence,404 scoped absent source,408 body deadline,409 stale/source/replay conflict,413 size,423 disabled installation. Keep entered data on conflicts; refresh source versions and review deliberately. Never manufacture a successful state from a200 wrapper.

## Identity route

`POST /api/sandbox/identity`, body `{action,input}`:

| Action | Input and authority | Result / invariant |
|---|---|---|
| capture | Applicant: applicantId, applicantVersion, consentVersion, consented:true, scenario | captureReference and exact consent binding; no entered real ID/image accepted |
| start | Same applicant: applicantId, applicantVersion, captureReference, consentVersion | Canonical identity case and durable one-shot dispatch |
| read | id; owner or Operations | Current case, safe outcomes and review data |
| recover | id, expectedOutcomeId; authorized Operations | Looks up original stored simulated receipt only; no second submission |
| decide | Existing `decideProductionIdentity` fields including exact case/outcome and inspected-source affirmation | Separate reviewer; recovery actor cannot approve its recovered evidence |
| suspend | id, reason; authorized Operations | Immutable suspension and downstream invalidation |
| correct | Existing intake correction fields: id, expectedVersion, changes | Owner/version-bound correction; old decisions and holds remain |
| withdraw_capture | captureReference; owner | Immutable consent event, suspension and rejection of later reads/use |
| grant_evidence | caseId, readerUserId; separate owner | grantId bound to case, reader, policy and expiry; owner cannot grant self/applicant |
| revoke_evidence | grantId; owner | Immutable revocation |
| download | id; independently granted Operations reader | Bounded private-store bytes only after current owner/version/consent/receipt/hash/access checks and audit |

Provider key `lokd-simulated-person-v1` is explicit. Scenarios: verified, declined, no_record, manual_review, pending, lost_response, outage, wrong_person, stale. Pending/lost-response/outage retain canonical uncertainty; lost-response lookup retrieves the original receipt, outage stays unresolved. Wrong person or stale evidence cannot become approval. Real VerifyNow sandbox test results are recorded separately and never promoted through this adapter.

The concrete private source is immutable `sandbox_identity_objects` in SANDBOX_DB, not a public artifact URL. The accepted ID-PROVIDER-03 reader retains source binding, digest, bounded streaming, repeat authorization and audit. Expiry/withdrawal denies access. This local store tests access/retention rules; approved production storage, physical deletion and operational retention acceptance remain external inputs.

## Application route

`POST /api/sandbox/application`, body `{service,input}`. Existing service input schemas are preserved; these are calls into the actual application implementations, not duplicate demo state.

| Service | Existing contract / use |
|---|---|
| officer_application, client_enquiry | Actual intake payload, exact signed-in designated test email (`+clerk_test…@example.com` or `@example.test`) |
| intake | Existing link/review/correct/withdraw actions in `signup-server.ts` |
| entity, psira | `prepareProductionEntity`, `writePsiraCase`; reviewed exact applicant binding |
| officer_prepare, officer_decide, officer_suspend | `production-officer-review.ts`; independent current identity + PSiRA bridge |
| rule_prepare, assessment_prepare, readiness_decide, opt_in | `production-readiness.ts`; no purchase-to-permission shortcut |
| passport_delivery, passport_prepare | Officer requests delivery first; Operations preparation must supply deliveryId |
| readiness_hold, request_information, disposition_prepare, disposition_decide, workforce_suspend | Existing immutable hold/investigation and independent re-review contracts |
| evidence, schedule, schedule_read | Existing approved employment/employer evidence and versioned availability/outside-work declarations |
| orders, orders_read, operations, operations_read | Actual site/order/risk/induction and allocation/activation/check-in controls |
| service, service_read | Actual completion, client confirmation/dispute, separate resolution and pay review |
| document, envelope, sign | Exact approved wording, entity/engagement/slot bindings and named officer signature |
| presence | Existing explicit opt-in, update and stop; public output is aggregated/expiring |
| read | officerId: scoped readiness, private delivery status, re-review, training and incident summaries; action:company lists authorized company mandates; action:presence reads the aggregate |

Private passport delivery preserves the existing officer-created token commitment and encrypted delivery flow. The officer owns the recovery material; Operations receives no raw token through the sandbox route. Do not put bearer tokens, private response bodies or raw receipts in URLs, logs, analytics or shared caches. The client must clear private state on401/403, withdrawal and suspension. Revoked public passport reads can return suspended/red status rather than404; require active/expiring status before scan acceptance.

### Partner responsibility

`service:partner_responsibility`:

1. Owner `grant_company_authority`: employerId, userId, mandateReference, mandateHash (SHA-256). Independent named company representative; returns authorityId.
2. Company representative `confirm_partner_responsibility`: authorityId, engagementId, expectedVersion, payrollAccepted:true, benefitsAccepted:true, payrollReference/payrollHash, benefitsReference/benefitsHash. Returns responsibilityId and expiry.
3. Separate owner `decide_partner_responsibility`: responsibilityId, decision approve/reject, independentlyChecked:true, reason.

Only a current evidence-bound approval projects partner_confirmed. Generic ready/ready alone is insufficient. Company/employer/version, independent actors and expiry are database-checked.

### Training and accepted finance source

Finance owns packages, purchase, R350 enrolment, collection, entitlements, commercial completion and revocation. Use its authenticated `GET /api/finance-workflows?workspace=ID&applicationId=ID` for applicant-owned readiness and its record endpoint to obtain entitlement/completion IDs. See `docs/finance-sandbox/CONTRACT.md` for preparation, independent decision, payment evidence and paging. `workEligible:false` is authoritative at that boundary.

`service:training`:

- Applicant `action:import_finance`, workspace, applicationId, financeEntitlementId, completionId. Calls `financeReadiness` with the authenticated applicant, rechecks the current owner/application version and linked officer, exact package/version, reconciled non-held entitlement and independently approved matching completion. Returns entitlementId, course (finance packageId), courseVersion, qualified:false. The source records finance digests, actor provenance and a transaction fence. Duplicate import is rejected; it cannot revive expired/revoked readiness.
- Independent Operations assessor `action:assess`, entitlementId, officerReviewId, ruleId, scorePercent, evidenceInspected:true, assessmentReference. Rule requires `training:<packageId>`. Failed score is preserved but creates no readiness review. A pass prepares a review with bounded expiry and source digest; separate `readiness_decide` approval is still necessary. Applicant, completion maker/reviewer and assessor cannot self-approve their evidence.
- Owner `action:revoke`, entitlementId, reason: immutable source revocation and downstream hold.

New versions of consumed finance records, payment observations or conflicts atomically revoke the imported source and hold derived readiness. This intentionally requires a new reviewed source/purchase after a hold, even when a subsequent provider observation is favourable; recovery never clears historical holds. A race during import is rejected by the DB fence. Isolated policy tests have a fixture-only entitlement helper; the application no longer exposes its provisional `entitle` action. Commercial test settlement remains the finance provider simulator, not actual Paystack acceptance.

### Engagement changes and finance split

`service:engagement`:

- `prepare_transition`: engagementId, expectedVersion, nextEngagementId, employerId, model direct_flex/managed/partner, termsVersion, reference.
- Separate owner `decide_transition`: transitionId, decision approve/reject, independentlyChecked:true, reason. Pending confirmed/on-post assignments prevent transition. Approval suspends the old engagement and creates human-linked canonical evidence audit/holds. It returns nextEngagement, requiresNewTerms and requiresDisposition, never immediate work permission.
- Complete existing independent disposition, new approved engagement, fresh readiness assessment/passport and new signed terms before activation. Never delete or clear the old holds.
- `period_inputs`: officerId, inclusive periodStart/periodEnd (SAST service dates). Returns `lokd.workforce-period-inputs.v1`, policyVersion, sourceHash, groups by engagementId with employerId/model and exact canonical timesheet id/version/shift/serviceDate/minutes/gross, plus totals and paymentReleased:false.

Pass the exact `groups[].sources[].id` values to finance `recognize_payroll` (employee) or `recognize_partner_invoice` (one company), with orderId, ownerUser, periodStart/periodEnd. Finance re-reads and claims canonical source versions; caller totals are not authority. The connected period test consumes two actual service records with distinct employers/engagements and conserves gross, net plus deductions/tax, and ledger balance. Post-export correction also runs the Central-integrated finance adapter. Identity does not implement settlements or statutory calculations.

### Specialist, scan, incident and reassignment

`service:specialist`: prepare_authority takes code S1_ARMED_SERVICE_AUTHORITY/S2_VIP_SERVICE_AUTHORITY/S3_SPECIALIST_INSURANCE/S4_SPECIALIST_BOARD_APPROVAL and a `sandbox:` reference; decide_authority takes authorityId, decision, independentlyChecked, reason with separate owner. Other input actions use existing specialist commercial/partner/pack contracts and `read` returns scoped state. Existing operator roles, fresh verified MFA, named team members, separate review and current quote/source gates remain enforced.

`service:funding_boundary`: prepare (reconciliationId, expectedVersion) / decide (acceptanceId, decision, independentlyChecked, reason) in `sandbox-funding-boundary.ts` is an explicitly simulated, independently reviewed **legacy activation funding boundary**, bound to the exact existing reconciliation/version/amount/reference. It never changes reconciliation integrity labels or claims external settlement. Finance's new ledger deliberately does not write the legacy production activation funding controls; this isolated adapter tests that remaining boundary. Never apply its SQL alternatives to primary DB.

`service:scan`: shiftId, passportToken (private body only), consent:true, requestKey, scenario at_site/outside_geofence/stale_clock/future_clock/gps_unavailable/wrong_passport. Fictional coordinates are generated relative to the actual fixture site and evaluated against policy. Current exact owner/passport/assignment and original-key binding are required; duplicate keys with different inputs fail. Actual device/GPS accuracy is unaccepted.

`service:incident`: report takes requestKey, shiftId, severity low/medium/high/critical, category, summary, detail. Assigned participant or Operations may report. Later acknowledge/investigate/resolve/close/escalate take requestKey, incidentId, expectedVersion, reason. Resolution/closure requires a different owner from reporter/investigator. Only overdue unresolved incidents escalate. All changes preserve command/event history, exact replay and SLA/retention dates.

`service:assignment_release`: assignmentId, expectedVersion, reason cancelled/replaced/released; owner with actual deployment authority, separate from officer. Existing canonical release frees reserved hours; replacement gets a new assignment/activation snapshot. Historical service and audit remain unchanged.

## Installation and owner boundaries

`docs/launch/proposals/SPECIALIST-CALENDAR-WAGE.sql` is a separate roll-forward canonical candidate: fixes the activation wage trigger to consume the actual roster-slot calendar/offer and accepted specialist price validation. It preserves existing wage/risk/reserve formulas. Central must number and integrate it.

`docs/launch/proposals/SANDBOX-COMPLETION.sql` is **local SANDBOX_DB only**, after canonical0073 and the wage proposal. It contains sandbox tables/immutable guards and explicit simulated specialist/funding alternatives. Do not number or apply this entire file as a primary/production migration. Central owns the dedicated sandbox installation path and shared schema/readiness changes.

Local initializer: `TMPDIR="$PWD/.tmp" node --experimental-loader=./tests/cloudflare-loader.mjs scripts/init-sandbox-completion.mjs`. It creates only the fixed distinct local SANDBOX_DB, applies canonical migrations and both proposals, installs both exact policies, and records a schema-source hash. It refuses existing application DBs, changed policy/schema and older bootstrap layouts. Preserve older local stores and initialize a fresh isolated checkout instead of relabeling them. `LOKD_LOCAL_SANDBOX_COMPLETION=true` enables the binding/virtual-host allowlist for Vite **serve only**; builds reject that flag. Never add these switches to hosted production configuration.

Frontend owns UI integration. This file is the stable endpoint handoff, not a claimed message-delivery receipt or complete-site/browser acceptance. Central imports the patch, integrates schema intent, and commissions independent merged-candidate QA.
