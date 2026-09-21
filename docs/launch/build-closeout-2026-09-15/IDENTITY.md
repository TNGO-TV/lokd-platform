# Identity, workforce and Operations build closeout

Date: 15 September 2026. Reviewed baseline: `d2e877c` (current HEAD).

## Verdict: complete

The identity/workforce/Operations backend is complete for the requested build milestone using fictional data, versioned policy and deterministic provider simulation. No missing required implementation or reproducible defect was identified in this bounded closeout. No source fix, new test, provider request or deployment was needed.

The earlier owner handoff requested Central integration and independent QA. Those steps are already completed in [Central acceptance](../central-sandbox-final/ACCEPTANCE.md); they are not outstanding work. Real accounts, devices and provider acceptance are outside this build milestone and do not block its completion.

## Journey evidence reused

| Scope | Completed behavior and retained evidence |
| --- | --- |
| ID-01 | Owner/applicant/version/consent-bound capture, original-request recovery, independent review, private evidence grants/download/revocation and withdrawal. `tests/sandbox-identity.test.mjs`; Central backend log contains all five passing identity cases, including negative and uncertain outcomes. |
| ID-02 | Current PSiRA and independently reviewed identity feed actual officer approval; wrong owner, self-review and stale sources fail closed. `tests/production-officer-review.test.mjs` and the connected sandbox fixtures; matching passing cases in Central backend evidence. |
| ID-03/04 | Reviewed qualifications, service opt-in, private passport delivery, holds, correction, independent disposition and fresh replacement preserve earlier records. Central backend evidence includes private delivery, readiness, correction, revoked-token, human-audit and workforce replacement cases. |
| OP-01 | Partner authority, exact payroll/benefits source records and independent decision; direct-flex and managed retain reviewed engagements. All four `tests/sandbox-workforce.test.mjs` cases passed in the accepted backend run. |
| OP-02/03 | Protected role/owner boundaries plus actual schedule, site, order, risk, induction and assignment services. Nine connected model/profile cases pass: direct-flex, managed, partner, Armed, VIP, armed movement, VIP armed, protective driver and VIP team. |
| OP-04/05 | Consented fictional scan observations use actual check-in controls; service completion, confirmation/dispute and pay review produce durable inputs. Incident SLA/version/replay/independent resolution cases passed. The additional Operations rehearsal connects incident containment, independent disposition and closure while preserving five consumed service/payroll/payment tables unchanged. |
| EX-03 | Two-company within-period transition keeps historical employment attribution and requires fresh reviewed terms; actual service sources flow downstream. `tests/sandbox-engagement.test.mjs`, `tests/sandbox-period.test.mjs` and connected model evidence. |
| EX-04 | Finance-backed training completion requires separate assessment before readiness; payment/evidence revocation atomically holds imported qualification. `tests/sandbox-training.test.mjs` and `tests/sandbox-training-finance.test.mjs`. |
| EX-05 | Assignment-gated fictional presence supports consent, stop and expiry. Accepted backend evidence and Central's mobile/desktop guided browser evidence cover the isolated map. |

Primary execution evidence: [backend-full.log](../central-sandbox-final/backend-full.log), **487 passed, 0 failed, 0 skipped** across the whole backend regression. These are reused suite totals, not a new identity-only count. [operations-rehearsal.log](../central-sandbox-final/operations-rehearsal.log) adds one separately accepted test, with the exact scenario and unchanged tables in [OPERATIONS-REHEARSAL.md](../central-sandbox-final/OPERATIONS-REHEARSAL.md). Central's accepted integrated browser total is 76 distinct cases across the full site; it is not an additional identity-only tally.

## Current source inspection

Inspected `sandbox-identity.ts`, `sandbox-workforce.ts`, `sandbox-engagement.ts`, `sandbox-service.ts`, `sandbox-application.ts`, the policy guard and identity route tests against the requirement matrix and owner handoff. The application bridge calls the protected identity/officer/readiness/signing/orders/service/Operations implementations against the guarded isolated database. The policy guard requires separate database bindings, prelaunch enablement and a matching immutable policy marker/hash. The identity/workforce policy remains `lokd-sandbox-completion-v1`.

Current HEAD is the accepted `d2e877c`; the inspected journey implementation and identity test files have no diff from that baseline. Existing passing tests were therefore not rerun. No shared schema, configuration, frontend, fixtures or product code was changed during this closeout.

## Closeout lesson

Observation: historical handoffs list integration and later external acceptance beside completed backend work. Action: reconciled those entries against the newer merged acceptance and present source before assigning further implementation. Result: zero new build blockers and zero unnecessary executions. Reuse this boundary in subsequent status updates: this area is build-complete; reopen it only for a concrete defect or a newly requested capability.
