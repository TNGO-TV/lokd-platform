# Identity/workforce sandbox completion handoff

14 September2026. Assignment: `sandbox-completion-prompts/IDENTITY-PROMPT.md`; ID01–04, OP01–05 and identity/workforce EX03/04/05. Backend build and local acceptance complete; hand back to Central for integration and independent QA. This does not mark the full site complete or authorize live enablement.

Isolated branch `codex/identity-sandbox-completion`, checkout `/home/ammosync/.codex/visualizations/2026/09/13/01a09c3c-0e07-7132-88c8-123a1dbfc216/identity-sandbox-completion`. Original preserved base `ab6acbd`, initial implementation snapshot `5509e6f`; inspected and merged Central finance baseline `c0f6c62` through `497fcf1`. Final code/evidence commit and integration patch SHA-256 are bound by `/home/ammosync/.codex/visualizations/2026/09/13/01a09c3c-0e07-7132-88c8-123a1dbfc216/identity-sandbox-delivery/manifest.json`. Patch is relative to **c0f6c62**, so already integrated finance/identity/frontend/payroll changes are not reapplied.

## Delivered behavior

- Exact account/applicant/version/consent capture binding; guarded original-key identity dispatch and recovery; independent outcome review; currentness, correction, withdrawal and suspension. Unsupported remote-person capture/recovery is explicitly simulated. Existing VerifyNow production adapter and conservative SAID parsing remain intact.
- Concrete isolated private D1 source for accepted ID-PROVIDER-03 reader: case-level independently granted access, bounded hashed delivery, current consent/retention/version checks, immutable audit and revocation. Officer-owned private passport delivery is mandatory at the sandbox HTTP boundary.
- Actual identity → reviewed PSiRA → officer approval → readiness/qualification/opt-in → private passport → independently approved employer/engagement/terms → schedule/order/site/induction → activation → service/client confirmation/dispute → approved payroll source chain.
- Real partner responsibility sources and independent review; direct-flex, managed, partner, all six specialist profiles including every member of the VIP team, and multi-company changes. Old engagement holds, signed wording, assignments and payroll sources survive transitions/replacement.
- Training consumes Central's authenticated current finance entitlement plus separately reviewed completion. It requires a distinct practical assessor and readiness checker. Payment/source changes atomically revoke imported qualification evidence and create immutable holds. Commercial seeding is fixture-only, unavailable through application actions.
- SAST period outputs feed Central's real payroll split engine, with distinct historical employer/engagement attribution and financial conservation. Existing exported payroll correction now consumes the integrated finance workflow too.
- Fictional GPS/clock/passport scenarios use actual activation/check-in controls. Consent/stop/expiry drive aggregate presence. Durable incident reporting, separate disposition, version/replay checks and overdue escalation are implemented.
- Clerk middleware now checks authoritative session status before forwarding identity headers, so an otherwise unexpired token cannot outlive server-side revocation. Failure to verify session is503, not authenticated fallback. This adds a Backend API dependency per authenticated request; hosted development acceptance proves behavior, while production capacity/latency acceptance remains Central's operational check.
- Fixed a shared wage trigger defect exposed by specialist activation: it used legacy price validation and booking calendar/offer instead of the current roster slot and accepted specialist price result. A separate unnumbered roll-forward proposal preserves existing arithmetic.

Routes and all payload/actor/currentness contracts: [IDENTITY-SANDBOX-CONTRACTS.md](IDENTITY-SANDBOX-CONTRACTS.md). Source: `app/api/sandbox/{identity,application}/route.ts`, `app/lib/sandbox-*.ts`; reused production identity, officer, PSiRA, readiness, signing, service, payroll and activation implementations. Frontend remains the UI owner; this published contract is not a claimed task-message delivery.

## Validation and evidence

Evidence root: [acceptance/sandbox-completion](../../acceptance/sandbox-completion/INDEX.md) in this checkout. All published provider/Clerk logs are sanitized; raw private logs and temporary accounts/configuration are excluded from Git.

| Check | Actual result | Evidence |
|---|---|---|
| Merged full application regression | **478 passed,0 failed,0 skipped** | `full-regression-central-merged.tap` |
| Build | Passed on merged baseline | `build-central-merged.log` |
| Types | Passed | `typecheck-central-merged.log` |
| Lint | Passed | `lint-central-merged.log` |
| Local installation | Fresh install, identical repeat, changed-schema refusal; integrity/FK checks pass; existing local DBs unchanged | `local-initializer.json`, `local-initializer.log` |
| New identity/workforce suites | 32 tests across10 files, included in478 | `tests/sandbox-*.test.mjs` and full TAP |
| Actual hosted Clerk development | 13 distinct scenarios accepted across named runs; final merged-schema rerun **5passed,0failed,0skipped** | Hosted evidence table below |
| Actual VerifyNow sandbox | Eight actual requests; zero production requests; documented products returned recognized outcomes | `verifynow-external.json`, provider log |

Commands: `npm run build`; `npx tsc --noEmit --incremental false`; `npm run lint`; `TMPDIR="$PWD/.tmp" node --experimental-loader=./tests/cloudflare-loader.mjs --test --test-concurrency=2 tests/*.test.mjs`. Run fixture servers serially. External provider tests are separate deliberate commands, not part of the regression suite.

The original pre-finance full run had441 tests:440pass/1fail because rendered-output testing preceded the first build. After building, rendered-output passed; the expanded pre-finance suite passed445/445. Later finance bridge testing first used an incorrect loader path, then exposed a TypeScript annotation accidentally copied into a JavaScript fixture; both are fixed. `finance-bridge-third.tap` passes6/6. Failed runs are retained rather than removed. Connected fixture failures and fixes include same-actor approval refusal, stale post-hold readiness, specialist calendar/wage binding and the explicit funding alternative described below.

### Hosted development acceptance, not signed-token substitutes

| Scenarios | Passing evidence | Scope |
|---|---|---|
| Original portal/security suite:7 | `clerk-hosted-tmpdir.log` (7pass) | Real dev client/officer/Operations login, intended role denial, owner/unassigned distinction, sign-out and ephemeral-account TOTP |
| Embedded sign-up, revoked session, actual JWT expiry:3 | `hosted-sandbox-second.log` (these3passed; same run1failed/1notrun in other file) | Real SignUp form, reserved test email/OTP; authoritative session revocation; actual expiry elapsed before old bearer401/fresh bearer200 |
| Existing connected UI journey:1 | `hosted-connections-passed.log` (1pass) | Client enquiry/link and review, independent document approval, actual quote/order/roster/site review and role isolation |
| Guarded identity/private store:1 | `hosted-sandbox-third.log` (identity casepassed; host casefailed) | Three real dev accounts, actual sandbox routes/D1, lost response recovery, same-actor denial, separate approval, private download, withdrawal |
| Local virtual-host routing:1 | `hosted-host-routing-second.log` (1pass) | Real dev bearer transported only to localhost; Operations-host404 exact absent case, officer/client-host403 |

The final merged-schema rerun uses `hosted-identity.spec.mjs` and `sandbox-identity.spec.mjs`: **5passed,0failed,0skipped in2.1minutes**, including the previously failing scenario. See [hosted-central-final.log](../../acceptance/sandbox-completion/hosted-central-final.log). Counts above are distinct scenarios, not summed reruns. Earlier failures retain `/tmp` quota/browser startup, duplicate synthetic phone linkage and an incorrect choice of host-test endpoint. Fixture runner now respects TMPDIR, uses unique test identifiers and tests an actually host-restricted route. Reserved test emails avoid invitations to real people. Created dev users/sessions and temporary runtime configuration are cleaned up. No production Clerk account/settings were modified. Local virtual hosts do not establish live cross-subdomain cookie/DNS/custom-domain acceptance.

### Actual provider calls versus simulator

Actual VerifyNow sandbox scenario results in `verifynow-external.json`:

- id-found:200/mock_approved; id-no-record:502/no_record; id-unavailable:502/unavailable.
- face-reference:200/mock_approved; face-upload:200/manual_review; liveness:200/mock_approved; document-ocr:200/mock_approved; drivers-licence:200/mock_approved.

`scripts/test-verifynow-sandbox.mjs` uses the existing sandbox transport, fixed provider host, forced sandbox mode, approved synthetic values and generated solid-colour image; one request per scenario with cooldown, no automatic retry. Metadata/digests are published; key values and raw provider receipts are not. These calls establish reachable test-product response compatibility, not remote-person accuracy, accepted capture ceremony, genuine qualification or production account acceptance.

Simulator-only: capture/consent ceremony, composite person outcome, original-key recovery and private receipt store; PSiRA/employer/client/qualification/terms evidence; specialist authorizations and legacy activation funding; device location/clock; finance settlements and bank confirmations. Simulator successes never enter primary DB. SAID registry match remains insufficient for person approval in the real provider path.

Automatic approval review rejected a proposed fixture edit labeling synthetic funding `production_verified`. That edit was not applied. The implemented alternative preserves the original reconciliation integrity label and requires explicit, independently reviewed sandbox funding evidence inside SANDBOX_DB only. The new finance ledger does not mutate legacy activation payment controls; its deterministic payment acceptance is separately tested.

## Applicant-to-completed-service acceptance checklist

| Requirement / step | Implemented fixture acceptance and durable assertion | Genuine acceptance still required |
|---|---|---|
| OP02 / account and linkage | Hosted tests above; `clerk-access.test.mjs`; role/host/session/MFA and owner binding | Intended production accounts, final roles/limits, production domain/session behavior |
| ID01 / capture, consent, identity and recovery | `sandbox-identity.test.mjs`:5; original dispatch/outcome, negative scenarios, exact binding, uncertainty, private access and withdrawal | Selected provider product/capture/composite/recovery contracts and genuine authorized evidence |
| ID02 / PSiRA and officer bridge | Reused production officer/PSiRA suites plus all connected fixtures; wrong owner/name/grade/source denied | Actual matching, current PSiRA record and independent review |
| ID03 / qualifications, opt-in, passport | `sandbox-training.test.mjs`:3, `sandbox-training-finance.test.mjs`:2; private delivery/currentness suites; purchase and assessment distinct | Accepted training/provider credentials, real completion/assessment, officer device delivery and consent |
| ID04 / suspension, correction and re-review | `sandbox-engagement.test.mjs`:2 and connected withdrawal; human audit/hold provenance, fresh disposition/terms/readiness, old history preserved | Genuine findings, assigned investigators and independent sign-off |
| OP01 / partner responsibilities | `sandbox-workforce.test.mjs`:4; company authority and bound payroll/benefit review, stale/self denial | Actual employer/partner authority, payroll/benefit arrangements and source records |
| OP03 / schedule, site, order and assignment | `sandbox-connected.test.mjs`:9 profile/model cases; existing activation/security suites; `sandbox-contracts.test.mjs`:3 includes release/replacement | Actual site/risk/order/induction, employment/signature/availability and commercial authority |
| OP04 / scan and presence | `sandbox-service.test.mjs`:2; real service controls with synthetic GPS/clock, revoked token denial, consent/stop/expiry | Real-device GPS/clock, connectivity, possession and privacy acceptance |
| OP05 / completion and incidents | Connected completion/confirmation/dispute/pay review; incident independent resolution/escalation, retained event history | Actual duty/attendance/client acceptance, incident response and payroll evidence |
| EX03 / specialist and multiple employers | All specialist/team members traverse actual identity-to-service chain; `sandbox-period.test.mjs`:1 consumes actual services through Central payroll split with conservation | Actual armed/VIP/insurance/board approvals and employer/engagement sources |
| EX04 / training commercial bridge | Authenticated finance currentness, payment/hold/refund/revocation checks; atomic imported-source holds; assessment score alternatives | Actual course catalogue, provider/commercial acceptance and qualification evidence |
| EX05 / public presence | Existing aggregate presence with guarded sandbox read, explicit consent/stop and expiry; no real people/device coordinates | Final frontend mobile/map/privacy and supervised real-device acceptance |
| Isolation/policy | `sandbox-policy.test.mjs`:1; alias/disabled/hash checks; primary DB remains empty in connected tests | Central installation review and later explicit enablement decision |
| Full frontend / complete site | Existing embedded UI and connected portal tests; stable new endpoint contracts published | Frontend owner mounts final controls; Central's merged candidate independent QA, mobile/accessibility and whole-site acceptance |

## Exact genuine inputs still required

These are later external/production acceptance inputs, not blockers for the completed deterministic build:

1. VerifyNow named product/bundle and actual account entitlements: SAID, HA photo, face-match/liveness combination, permitted missing-photo fallback, remote-person assurance scope.
2. Accepted capture/session protocol and UI/SDK: endpoint/method/auth, exact schemas, owner/applicant/version/consent and challenge binding, anti-replay, ID/image formats and limits, session expiry/abandonment/withdrawal.
3. Accepted composite decision policy: signal combination, thresholds, name/date matching, deceased/no-record/manual/mismatch/reference-unavailable behavior and independent human review scope. The fictional simulator is not this policy.
4. Actual selected-product success/decline/manual/pending/error envelopes with production provenance, request/case/person correlation, transaction reference, source timestamp precision/skew and signed receipt/digest guarantees.
5. **Read-only uncertain-delivery SAID recovery** keyed by original idempotency key/case UUID even when no response requestId arrived: endpoint/method/auth, exact binding, pending/not-found/definitive absence, consistency/finality/retention/rate semantics. If callbacks are used, exact event/signature/rotation/replay/correlation specification. No undocumented endpoint has been invented.
6. Resolve documented72hour versus30day idempotency discrepancy: account/product/key scope, conflicts, retention and duplicate-charge guarantee. No second POST is enabled to resolve uncertainty.
7. Accepted production private evidence backend and reader/case policy, immutable digests/audit, retention/deletion and backup controls, approved privacy/consent document versions and evidence lifetime. Local D1 access expiry is not proof of physical production erasure.
8. Later authorized provider/account acceptance run and secure configuration ownership; actual applicant consent/person evidence, independent reviewer, exact current PSiRA evidence, real qualification/assessment.
9. Intended legal entities, employer/partner payroll/benefit mandates, client/site/risk/order scope, genuine authority/insurance/armed/VIP approvals, signed approved terms, actual officer availability/induction/device possession and delivery/recovery.
10. Finance-owned real test/account/provider/channel/callback/bank reconciliation acceptance, payment recipients and approved payroll/commercial policy. No actual Paystack transaction was performed by this owner. R350 is already decided; fictional training and payroll rules enable tests but do not constitute statutory/commercial approval.
11. Production Clerk accounts/roles/MFA exception ownership and domain configuration, authoritative-session API capacity/latency/failure-mode acceptance; actual device/browser/location behavior and frontend accessibility. No production settings were changed.

Source detail and prior provider-document discrepancies: `ID-PROVIDER-02-INPUTS.md`. Its older sandbox-build blockers are superseded by this implementation; genuine provider requirements remain. Official docs consulted for hosted tests: Clerk Playwright overview and test-emails-and-phones guides; VerifyNow integration guide. No provider statements were accepted on the owner's behalf.

## Central integration and next bounded assignment

1. Apply the exact delivery patch to Central's `c0f6c62` or inspect subsequent Central changes before rebasing. A preserved isolated branch and patch accompany this handoff; no main checkout was reset or edited by this owner.
2. Number/integrate **only** the shared wage-trigger roll-forward candidate as appropriate. Review the separate sandbox installation proposal for the dedicated SANDBOX_DB; never install its simulated funding/authority alternatives into primary DB. Canonical0073 comes from Central and is not duplicated. Central owns schema/metadata/readiness inventory.
3. Frontend owner consumes the endpoint and finance training contracts in the actual forms/queues/private delivery/incident/readiness UI. Preserve pending/held/error states and current source versions; do not infer work or payment acceptance from preparation.
4. Independent QA runs the merged full regression, local migration/negative isolation checks, three-role connected browser journey including finance-backed training and all service transitions, and mobile/accessibility/error/recovery checks. Retain the source-linked evidence and issue a sandbox acceptance decision.
5. Keep provider/real-person/device/production account acceptance and live go/no-go on the separate checklist above. No credential change, production submission, deployment or live enablement occurred or is requested by this handoff.

## Reusable learning

| Observation | Action and measured result | Next evaluation |
|---|---|---|
| Same actor recovered and attempted to approve its identity evidence | Kept independence rejection; changed fixture actors; hosted separate approval passes | Merged UI must select a different reviewer |
| Fresh passport alone did not clear old employment/readiness holds | Completed real disposition, fresh evidence and new signed terms; multi-company period test passes | QA withdrawal/reassignment after completed service |
| Specialist JS pricing accepted new version while DB trigger still used legacy booking facts | Added separate roll-forward trigger proposal; all specialist/team service tests pass | Central canonical migration and future calendar cases |
| `/tmp` quota broke hosted browser/export startup | Honoured checkout TMPDIR; isolated hosted tests pass; no capacity workaround on shared DB | Keep fixture servers serialized |
| Hosted debug URLs may contain dev session material | Publish sanitized logs only; raw files ignored | Scan every delivery artifact before integration |
| Central finance arrived during implementation | Preserved snapshot, inspected/merged baseline and replaced provisional application entitlement with authenticated current finance source | Independent frontend-to-finance-to-readiness browser QA |
