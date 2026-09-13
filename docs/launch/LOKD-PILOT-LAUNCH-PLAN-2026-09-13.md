# LOKD controlled-pilot launch: delivery plan

Owner direction, 13 September 2026: make the site ready for a controlled pilot with real clients and officers; provide a complete task breakdown that can be handed to specialists; give frontend copy, visuals and tabs a dedicated owner.

## Readiness today

**Not yet accepted for a real-service pilot.** The public site and intake are live. Core operating workflows exist, but the production officer-readiness path and real financial operating cycle are incomplete. There is no evidence-based completion percentage or launch date yet.

Baseline: live v65 and clean repository HEAD before this work `14448dd15fa80fc19a3f2052462ae566ab35a2fd`. Existing application/backup regression receipt: 284 tests passed. Current five frontend component fixes are local, separately tracked below; they are not part of deployed v65.

Reuse: applications/enquiries, account linking/corrections, client review, production agreement signing, service orders, evidence review, scheduling, activation maker/checker controls, service completion/client confirmation/dispute, payroll preparation/export, collections/settlement evidence, employee/company destinations and test payment instructions. Do not rebuild these from outdated checkpoint lists.

Recovery verified: 149 live database tables / 146 rows; zero R2 objects and zero database file references; all ten hosted application configuration keys; Clerk zero users, Paystack test records and source/release archives. Backup endpoint closed. Off-host copy is still outstanding; this is not protection against loss of the VPS. Evidence: `LOKD-RECOVERY-VERIFIED.json` under `/home/ammosync/.codex/visualizations/2026/09/13/01a09bd1-d0db-75d2-9653-94ce20b75be0`.

## Owners and parallel lanes

An owner below is an accountable workstream role, not a claim that a person or new persistent task has already been assigned. Three parallel reviewers completed the identity/operations, finance, and frontend/QA audits used in this plan. Implementation handoffs to other persistent tasks have not been sent; task-message/create tools are unavailable here. No third-party contacts were made.

| Owner | Accountability | Start now | Integration boundary |
|---|---|---|---|
| **Frontend & UX owner — dedicated** | Copy, visuals, public/account navigation, general tabs, responsive forms and status/error presentation | FE-01 through FE-05; brief in FRONTEND-OWNER-HANDOFF.md | Presentation only. No authorization, financial rules, migrations or unilateral publishing. |
| Identity & readiness owner | Real identity integration, officer/PSiRA approval bridge, qualifications/passport lifecycle | ID-01 design and fixtures; ID-02/03 contracts | Own identity/readiness modules; coordinate shared evidence/activation contracts. |
| Workforce & service owner | Employment route, partner confirmation, service/check-in/incident operation | OP-01/03 audit and fixtures | Shared production router/schema go through release owner. |
| Payments & finance owner | Funding, payouts, exception recovery and payment-state contract | FI-01/02/05 contracts and tests | One owner for payout/recovery to avoid competing idempotency/state changes. |
| Billing & payroll documents owner | Invoices, receipts, payslips/remittances and corrections | FI-03/04 layouts and immutable data contracts | Parallel after finance contracts; cannot infer paid status from test/export. |
| **Independent QA owner** | Requirement-to-evidence matrix, browser/security/role tests, real pilot acceptance | QA-01/02/04 planning and isolated tests | Independent sign-off; does not accept its own feature implementation. |
| Legal & commercial owner | Reuse/update existing drafts, entity/employer terms, privacy and provider review | LG-01/02/03 using existing drafts and explicit placeholders | Suggested existing task: **Begin Legal project research** (`01a08698-d076-7842-adc4-69ac8362d742`). No drafts become approved by being coded. |
| Pilot Operations / business owner | Intended accounts, first client/officers/site, authority, funds, operational sign-off | OP-02 and LG-01 inputs | Genuine identities, mandates and approvals must come from the owner/authorized operators. |
| Reliability & recovery owner | Monitoring, support runbook, off-host recovery | RE-01/02/03 | Suggested existing task: **Operations** (`01a08188-d886-7f93-9e0d-49a7f708d8b8`); verify current remit before dispatch. |
| **Single integration/release owner — this LOKD task** | Contract decisions, migration integration, merged test evidence, Sites publication and launch decision | RL-01 coordination and FE-06 fixes | Only this owner publishes this work. Older **Implement partner payment workflow** task is idle; do not resume it concurrently against the same checkout. |

The frontend owner is a separate implementation lane, not a spare duty for the backend engineer or independent QA. Human/team assignment can change without changing accountability or task IDs.

## What “ready” means

The selected pilot must complete one accountable cycle: intended users sign in → applications reviewed → real identity/PSiRA/workforce evidence approved → exact agreements signed → client order and cleared funding accepted → availability and readiness evaluated → independent activation → controlled check-in → service completion → client confirmation or dispute → correct payroll/company liability and invoice → actual reconciled payment and participant documents.

A separately approved external finance procedure could change the software scope, but none has been agreed. This plan therefore retains a complete financial route as a pilot gate. Do not silently call unpaid exports an external payroll solution. Employee versus partner model, specialist scope and whether R350 enrolment is charged remain decisions; conditional items become mandatory when their route is selected.

## Complete launch work register

Priority **P0** blocks the chosen real-service pilot. **P1** is launch quality/operational acceptance. **C** is mandatory if that route is included. **Later** remains in the full-product backlog; it is not discarded. “Acceptance” tasks reuse implemented code and only add code where the test exposes a gap.

### Frontend — dedicated owner

| ID | Priority / state | Task | Depends on | Done when |
|---|---|---|---|---|
| FE-01 | P1 / ready to start | Map public, Client, Officer and Operations routes/tabs; separate production-mounted and historical demo components | RL-01 | Every pilot action has a named destination, consistent active/back states, direct-link behavior and mobile navigation; role boundaries remain enforced. |
| FE-02 | P1 / ready to start | Rewrite stale/misleading copy using actual enabled capabilities | FE-01; ID/FI contracts | Homepage, onboarding, agreements, service/payment pages, empty states and helper text agree with real behavior. Production signing is described accurately; sandbox identity/test money never sound live. |
| FE-03 | P1 / ready to start | Visual consistency: typography, spacing, buttons, cards, forms, status language and readable record summaries | FE-01 | Agreed visual standard applied across selected pilot routes; participant UI avoids unnecessary raw IDs/JSON while preserving readable exact terms/scope and audit access. |
| FE-04 | P1 / ready to start | Complete loading, empty, validation, success, failed-network, session-expiry and stale-record states | FE-01; endpoint contracts | Inputs survive failures; 401/403/409/423/503 messages explain a useful next action; pending/unknown payments are not retried as new transactions. |
| FE-05 | P1 / ready to start | Mobile, keyboard and accessibility pass across the selected pilot journey | FE-02/03/04 | No accidental overflow at 360px; meaningful labels, visible focus, keyboard navigation, readable status/errors, zoom/contrast checks and correct disabled/loading behavior. |
| FE-06 | P1 / local fixes prepared | Clear seven current React lint errors and verify expiry/hydration behavior | None | Identity retry/signature availability updates with time; fetch effects clean up; presence controls hydrate safely; lint has zero errors; relevant browser checks pass. Five component fixes are local, not deployed. |

### Identity, workforce and service

| ID | Priority / state | Task | Depends on | Done when |
|---|---|---|---|---|
| ID-01 | P0 / missing production path | Accepted real identity capture/provider outcomes with manual review and outage/replay recovery | LG-01/03; genuine provider acceptance | Exact applicant/person binding; protected evidence; wrong-person/stale/replay/outage/denial cases pass. Sandbox checks never approve real identity. |
| ID-02 | P0 / missing bridge | Independent production officer approval from current intake, real identity and current reviewed PSiRA evidence | ID-01; OP-02 | Produces authorized operational officer/compliance records with true evidence and expiry; stale/withdrawn/mismatched evidence blocks at commit. Reuse existing PSiRA review. |
| ID-03 | P0 / missing production issuance | Core readiness, qualification/service opt-in, purpose endorsement and passport issuance/renewal/suspension | ID-02; approved evidence rules | All activation-required records have guarded production creation and lifecycle; validity extends through the assignment; no synthetic seeding or blanket ready flags. |
| ID-04 | P0 / partly implemented | Complete officer identity/workforce approved-record suspension, correction and re-review | ID-02/03 | Changes invalidate readiness without rewriting consumed service/payroll history; current client/evidence suspension is reused; racing activation and stale approvals are rejected. |
| OP-01 | C / confirmed partner mismatch | Evidence-backed partner employer/payroll/benefit responsibility confirmation | LG-01; ID-02 | Partner engagements satisfy the correct `partner_confirmed` contract with source evidence; direct employee rules remain separate; partner activation test passes. Required if partner-supplied officers are used. |
| OP-02 | P0 / real acceptance outstanding | Provision intended operator roles/limits and verify actual client/officer/independent reviewer sign-ins | Owner identities; LG-01 | Real sign-in/account binding and least-privilege routes verified; maker cannot approve own work; no role inferred from email guesses, CLI identity or Sites ownership. |
| OP-03 | P0 / implemented, connected acceptance needed | Accept site/order/risk/induction, availability and assignment preparation | LG-02; OP-02; ID-02/03 | Exact client/site/employer/officer linkage, source freshness and overlap/outside-work checks pass; evidence chain prepares a genuinely eligible pilot slot. |
| OP-04 | P0 / deliberately disabled | Controlled check-in enablement and real-device acceptance | ID-01–04; OP-03; FI-01; explicit flag authorization | Readiness independently approved; intended officer checks in/out; location consent and failure behavior tested. Preserve `LOKD_LIVE_SHIFT_SCAN=false` until the specific controlled change is authorized. |
| OP-05 | P0 / implemented, acceptance needed | Service completion, client confirmation/dispute, pay review and incident/escalation run-through | OP-04; RE-03 | Exact service evidence flows to independent review; dispute blocks downstream misuse; one exception is handled with accountable retained evidence. |

### Finance, billing and recovery

| ID | Priority / state | Task | Depends on | Done when |
|---|---|---|---|---|
| FI-01 | P0 / implemented gates, real acceptance outstanding | Confirm actual collection capability, approved funding, provider/bank settlement and reserve evidence | LG-01/02; OP-02; provider account entitlement | Exact order amount/currency, signed event/API evidence and independently reviewed settled funding accepted; test money never funds service; approved reserve/funds evidence recorded. |
| FI-02 | P0 / live adapter and projection missing | Controlled live employee payout + canonical reconciliation; company route if selected | FI-01; current mandates, independent finance authorization; FI-05 contract | Default remains locked; fresh authority/source checks; one durable submission claim; exact reference/amount/ZAR/recipient; real reconciliation and reversal semantics; test success never becomes paid. |
| FI-03 | P0 for employee / missing production issue | Accurate private production payslip issuance/delivery and immutable correction versions | Approved payroll inputs; FI-02 state contract; LG-02 | Calculation matches approved payroll; pending/unpaid/paid wording is true; only intended officer/authorized payroll can access; shadow statements cannot pass as production. |
| FI-04 | P0 / missing production issuance | Client invoices, settled receipts and allocations/credits | LG-01/02; FI-01 | Unique numbering, exact entity/client/order/service/tax sources, no duplicate allocation, immutable credit history and restricted client access. Partner invoice intake is not client invoicing. |
| FI-05 | P0 / FI-05 test recovery integrated; independent local QA accepted | Independent failed/reversed/uncertain employee/company transfer disposition and safe replacement | FI-05 local contract accepted; FI-02 live extension remains unassigned | Timeout/missing event/404 never proves nonpayment; final evidence, maker separation and race tests; replacement chain cannot double pay. Keep held when uncertain. |
| FI-06 | P0 when accepting money / missing resolution | Refund/dispute investigation, authorization, execution/reconciliation and held-funding disposition | LG-02 refund policy; FI-01/04 | No deleting holds; exact refund and independent authority; durable claim/same-reference recovery; refunded/disputed funds unavailable; downstream liabilities and service changes explicit. |
| FI-07 | C / test-only today | Live registered-officer R350 enrolment and uncertain initialization recovery | ID-01/02; approved terms; live collection capability | Applicant/version-bound live evidence; no duplicate checkout after uncertainty or manual paid override; training stays separate. Required only if pilot charges enrolment. Do not create another legacy test checkout. |
| FI-08 | C / missing company remittance | Reconciled company remittance/private delivery | Company FI-02; approved partner invoice allocation | Actual company payment/reference/amount accurately reflected; NOT_PAID CSV/test success never relabelled paid. Required for partner pilot. |
| FI-09 | P0 / genuine acceptance outstanding | Authorized real finance-cycle acceptance | Applicable FI tasks; OP-05; real funds/accounts | Approved order → settled funding → actual service → approved liability → reconciled payment → correct documents, with a recovery scenario and traceable approvals. Actual money movement requires its genuine authorization. |

### Legal, business and reliability

| ID | Priority / state | Task | Depends on | Done when |
|---|---|---|---|---|
| LG-01 | P0 / inputs unconfirmed | Confirm contracting entity, employer/partner route, signatories, first client/officers/site and scope | Business owner | Pilot roster and accountable business model are concrete; source documents/authority available. No invented company, people, funds or approvals. |
| LG-02 | P0 / existing drafts unapproved | Finalize and approve pilot client MSA/service order, workforce or partner terms, payment/refund and signature/authority terms | LG-01 | Legal/commercial owner approves exact versions and applicable payroll/tax/deduction sources; platform delivers the approved wording. Reuse four existing draft packs. |
| LG-03 | P0 / current-stack review needed | Privacy, verification consent, evidence retention, provider/subprocessor and public legal-copy review | LG-01; ID-01 data flow | Actual entity/contact/provider details and approved processing/consent rules supplied; old iiDENTIFii references reconciled with VerifyNow/Clerk. Frontend implements approved copy. |
| RE-01 | P1 / stale health contract confirmed | Correct readiness reporting and schema coverage for current release | RL-01; current backend contracts | Old v34-only table/trigger checks and obsolete provider/demo descriptions replaced with accurate checks; missing current required object fails; software health never claims pilot approval. |
| RE-02 | P0 before real pilot / independent copy missing | Approved off-host encrypted backup, separated key recovery and recovery rehearsal | Approved destination; existing verified archives | Copy integrity checked at independent destination; restore uses documented key recovery; measured recovery evidence recorded. Reuse captures; no repeat exports without changed data. |
| RE-03 | P0 / operational acceptance needed | Pilot support, monitoring, incident suspension, rollback and data-recovery runbook | OP/ID/FI contracts | Named support/escalation owner, actionable monitoring, support route, stop/suspend authority, rehearsed failure and exact rollback/recovery steps. No unattended recurrence configured by this plan. |

### Independent acceptance and release

| ID | Priority / state | Task | Depends on | Done when |
|---|---|---|---|---|
| QA-01 | P1 / ready to start | Requirement-to-evidence matrix and selected pilot browser fixtures | RL-01; all workstream contracts | Every requirement records code status, local test, real external acceptance, exact source and evidence; skipped tests are explicit. |
| QA-02 | P0 / integration acceptance missing | Connected isolated multi-role cycle and failure cases | ID/OP/FI/FE implementation | Full chosen cycle passes with isolated development accounts and restored local DB/config; wrong role/user, self-approval, stale evidence, expiry and retry failures tested. Fixtures are not real acceptance. |
| QA-03 | P0 / real acceptance missing | Production sign-in/custom-domain and supervised real pilot dry-run/operating acceptance | OP-02; QA-02; real inputs; approved release | Intended people prove role routing and linked records; authorized actual cycle has retained evidence; no false paid/verified/ready states. 200/307 route checks alone do not pass. |
| QA-04 | P1 / verification work | Security/abuse resilience, upload/export privacy and callback replay/error checks | Current endpoints/edge config | Same-origin, unauthenticated/cross-record denial, limits, private file handling and webhook mismatch/replay verified. Edge rate limiting is currently unverified, not a proven vulnerability. |
| QA-05 | P1 / ready after frontend | Independent copy, tabs, mobile and accessibility acceptance | FE-01–06 | Client/officer/operator complete relevant tasks on mobile/desktop/keyboard; expiry transitions and presence hydration verified; no unsupported promises or inaccessible key actions. |
| RL-01 | P0 / this task owns | Freeze selected pilot contracts and integrate parallel changes safely | Confirmed controlled-pilot objective | One release owner, branch/file ownership, data contracts, migration order and gate register; no duplicate work in older tasks; preserve current backup functionality and policies. |
| RL-02 | P0 / after implementation | Complete type/lint/build/regression/migration/browser release checks | Integrated tasks; QA-02/04/05 | Exact code and migrations pass required checks; private fixtures/config removed before build; no unintended skipped acceptance; documented unresolved items have explicit disposition. |
| RL-03 | P0 / final gate | Publish exact accepted release, verify live behavior and record pilot go/no-go | RL-02; LG/OP/FI real inputs; RE-02/03; QA-03 plan | Successful Sites deployment, domain/access/health checks, backup endpoint closed, rollback ready; real pilot authority and evidence recorded. Publication alone does not authorize service or payments. |

### Remaining full-product work (kept visible)

| ID | Default placement | Task / owner | Completion condition |
|---|---|---|---|
| EX-01 | Later; becomes pilot requirement if used | Post-export payroll adjustments and within-period engagement splits / payroll owner | Immutable adjustments link original export, reconcile liabilities/payments and issue corrected documents; no silent reopening. |
| EX-02 | Later; becomes pilot requirement if used | Approved partner invoice-line correction/replacement / billing owner | Original/consumed allocation retained; no reused service or duplicate company invoice line; correction reconciles remittance. |
| EX-03 | Later unless in selected service scope | Wider partial-payment, multi-company, specialist and additional service routes / finance + workforce owners | Explicit route contracts and route-specific legal/readiness/financial acceptance before enablement. |
| EX-04 | Later unless training is charged/launched | Training packages/provider model, entitlements and terms / business + product owners | Owner-approved offerings and commercial rules; separate from R350 officer enrolment and work eligibility; no invented placement promises. |
| EX-05 | Later unless explicitly required | Public live-presence map / frontend + privacy + service owners | Specific owner authorization and officer consent, real-device acceptance and expiry/privacy controls. A map is not required merely to call the service a pilot. |

Restrictive holds may be retained during a narrowly scoped pilot only with an approved accountable exception process. That process has not been supplied. Do not silently move FI-05/FI-06 off the launch path or enable unsupported financial behavior.

## Order of work and handoffs

**Start concurrently:** frontend FE-01–05; identity ID-01–03 design/fixtures; finance FI-01/02/05 contracts; legal LG-01–03 draft completion; QA-01/04; reliability RE-01–03. Billing/document presentation can start immediately but final implementation depends on agreed payment/invoice contracts.

**Critical path:** real identity/provider contract → ID-02 officer approval → ID-03 readiness credentials → selected workforce confirmation → exact agreements/funding → independent activation/check-in → service completion → real reconciled finance/documents → QA real pilot acceptance → launch sign-off. Frontend and legal progress alongside this path, not after all backend work.

**Shared-file rule:** one integration owner for `db/schema.ts`, `drizzle` numbering/journal, `app/lib/production-operations.ts`, `operator-controls.ts`, shared webhook routing, and Sites deployment. Use separate `codex/` branches/worktrees for implementation teams; return reviewed patches, tests and migration intent. Never rewrite applied migrations. Only one browser-fixture run at a time because `scripts/test-accounts.mjs` changes local D1 and `.dev.vars`; builds wait until cleanup is verified.

**Definition of a handoff:** task IDs, exact base revision, owned files, API/state contract, tests (including denied/race/recovery paths), no secret/fixture material, known gaps, and ready-for-integration result. An implementation owner does not mark external business/provider acceptance done on behalf of the relevant real reviewer.

No fixed delivery dates are asserted. Estimate each implementation package after contract review; provider/legal/account acceptance has external lead time. Adding more people to shared schema, payment state or release files will not accelerate those serial gates.

## Evidence and known corrections

Three independent read-only audits checked current code rather than accepting old “next work” text. Important code findings:

- `app/lib/applicant-identity.ts` and `verifynow-adapter.ts`: sandbox-only identity, no real verified-person acceptance.
- `production-intake.ts`: prepared officers pending; no current PSiRA expiry. `assignment-activation-core.ts`: real officer approval, identity/PSiRA, core/service/purpose and passport prerequisites.
- `production-evidence.ts` versus `assignment-activation-core.ts`: partner payroll/benefit responsibility state mismatch needs an evidence-backed workflow.
- `employee-payments.ts`, `partner-payments.ts`: explicit live dispatch locks. `test-enrolment.ts`: no live charging. `payroll-statement-server.ts`: shadow statements.
- `app/api/health/ready/route.ts` and its test: old v34 readiness coverage and stale provider/demo description.
- Current frontend cleanup: `identity-panel.tsx`, `production-signing-panel.tsx`, `officer-presence-panel.tsx`, `specialist-operations-control.tsx`, `test-enrolment-panel.tsx`. Seven error fixes reviewed without an identified regression; final checks/release recorded separately.

Preserve `LOKD_OPERATIONS_MFA_REQUIRED=false` (existing owner exception), disabled live scan until its specific authorization, test/live provenance and payment locks until the accepted guarded implementation is ready. TNGO and AmmoSync remain outside this work.

## Frontend integration checkpoint — 2026-09-13

Central Command integrated both frontend checkpoints through revision `f561dfa47be41f6ab1f7366c375f03192f17cd60`, preserving FI-05. Independent code review found no actionable new issues. FE-01–05 have local checkpoint progress, not complete pilot acceptance. QA-05 real-account/custom-domain acceptance remains pending an approved candidate environment and coordinated accounts. No deployment or live financial action is authorized by this checkpoint. See `FRONTEND-CENTRAL-INTEGRATION-2026-09-13.md` for combined validation and remaining gates.
