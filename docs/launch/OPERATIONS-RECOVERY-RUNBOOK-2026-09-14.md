# LOKD support, suspension and recovery runbook

Status: locally documented procedure, not a staffed or rehearsed live operation. Baseline deployed review v69, c358358d6ad1ad59ba2f8e39513928c343e5736b. Build must finish and independent local QA must pass before real-account/provider/person/device/finance acceptance. Existing payment locks, LOKD_LIVE_SHIFT_SCAN=false and owner LOKD_OPERATIONS_MFA_REQUIRED=false exception remain. No unattended monitor or live mutation is enabled by this document.

## Accountability and escalation inputs

Central is the sole application integration/release owner. Before service acceptance the business owner must supply named support cover, contact/coverage hours, independent finance reviewer, identity/privacy escalation owner, incident lead and authorized release/rollback approver. These roles are not staffed merely by listing them. There is no accepted response-time or recovery-time target yet. Record those genuine inputs in the build matrix; do not invent contact details or imply that the website is an emergency service.

## Health triage

Use /api/health/live for dependency-free process liveness. A200 means the handler responds only. Use /api/health/ready for current schema objects and evidence binding after the local reliability change is integrated and released. On v69 this is still the narrower baseline check. The changed endpoint reports its schemaMigration and expected object counts, infrastructureReady, providerConnectivity:not_assessed, operationalAcceptance:not_assessed and productionActivationAuthorized:false.

A503 or request failure is actionable: retain UTC timestamp, exact release, HTTP status, sanitized response and correlation references; check native deployment/runtime logs and current binding presence through Central. Do not log cookies, secrets, identity payloads, private passport tokens or evidence bytes. Missing schema objects require inspection of canonical additive migrations and exact deployed source, not an ad hoc trigger/table repair. Healthy infrastructure cannot override a payment/identity/business hold. Escalate repeated failures to the assigned incident lead once genuine contacts exist. Monitoring frequency and alert destination require an agreed operating policy; no recurring service is configured here.

## Contain an incident through existing authority

1. Identify the exact client, officer, employer, engagement, booking or payment affected and retain current versions and immutable evidence references. Do not act solely on a stale screen.
2. An authorized Operations principal uses existing application actions: production-identity suspend_identity, suspend_officer, hold_readiness or suspend_workforce; production-operations suspend_evidence or suspend_client for the relevant evidence/client. These actions have distinct contracts; use their current forms and fresh expected version, reason and independent-review controls. Do not use direct SQL or manufacture authority headers.
3. Financial uncertainty stays held. hold_collection, hold_partner_payable, hold_destination and hold_partner_destination exist for their specific records. A missing callback, timeout or404 does not establish nonpayment. Recover the durable original reference through the applicable authoritative evidence workflow; do not start a replacement/new checkout merely to clear the screen.
4. Retain every consumed assignment, service, payroll allocation, export and payment/document version. Suspension invalidates eligibility prospectively; correction/re-review does not erase historical liability or automatically restore prior approval. Operator suspension is an owner-controlled operation, not a substitute for investigating a record-specific incident.
5. Record who acted, affected identifiers/versions, reason, UTC time, evidence location and intended independent reviewer. Document whether service/payments were actually affected; a software failure is not evidence of a real transfer or identity outcome.

Existing source: app/api/production-identity/route.ts; app/lib/production-rereview.ts; app/lib/production-evidence.ts; app/lib/production-operations.ts; app/lib/payment-execution.ts; current owner finance checkpoint may add refund-specific controls. Reconcile this section after integration, before acceptance.

## Application rollback

Recheck current native publication first. The retained pre-v69 application target is saved v68: appgprj_6a88a08505548191b266e9b711562ae3~appgver_a4dfade533f48191bdc86397f11b8f54, source e3223c23e32f78ed6a1fd9ac283991c4f72815be. Central must inspect compatibility with every subsequently added migration and current immutable records before proposing rollback. Do not automatically downgrade schema, delete history or change domains/audience/configuration.

With applicable release authorization, Central republishes the compatible saved artifact via Sites, waits for terminal successful deployment, and records exact target/deployment/status evidence. Liveness/readiness after release are infrastructure checks; genuine operational acceptance remains separate. If the saved application cannot safely consume the new schema/data, prepare a forward fix instead of assuming the old version is safe. This procedure has not executed a rollback in this round.

## Backup and restoration

Reuse the verified September13 encrypted captures and receipt /home/ammosync/.codex/visualizations/2026/09/13/01a09bd1-d0db-75d2-9653-94ce20b75be0/LOKD-RECOVERY-VERIFIED.json. Source/provider/application capture boundaries and timestamps come from that receipt; do not call these a new complete live backup. Private captures and key material stay outside source and reports. The old backup owner now owns TNGO; do not dispatch LOKD work to it based on history.

The v69 preflight freshly rehashed archives, restored existing SQLite into isolation, applied0060–0068, queried views, checked integrity/foreign keys and proved all pre-existing ordinary rows unchanged. Reuse that evidence, extending the isolated restoration for new additive migrations. Never overwrite the production database as a rehearsal. A new capture is justified by changed data/recovery requirements, not routine repetition.

Off-host disaster recovery is still blocked on an approved independent destination and separate key recovery. Completion requires a verifiable copy receipt/hash at that destination and an isolated decrypt/restore using the documented key procedure, measured against agreed RPO/RTO. Local copies and a same-VPS restore do not pass that gate. Do not reopen the backup window until an authorized capture requires it; confirm it is closed after any future capture.

## Local rehearsal and acceptance record

Existing local connected identity/workforce/service/payroll tests cover suspension without history mutation; payment recovery tests cover uncertainty and replacement safety; backup preflight proves a restore of the older capture. RE-03 is only complete after a named operator and independent reviewer execute a coherent isolated incident scenario, verify the matching recovery/disposition, and record source, steps, actual results, failures, timing and remaining inputs. No live testing is requested to discover unfinished build behavior.
