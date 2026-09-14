# Central merged sandbox build — 15 September 2026

Status: accepted for complete local sandbox review. Independent requirements, security and browser QA are complete within the explicitly simulated scope. No deployment or live enablement is authorized by this document.

Central integrated the frozen Frontend 220b5b5 and Identity 6f8857e deliveries onto finance-integrated Central c0f6c62. Finance e4fd8f4 was already incorporated and was not reapplied. Exact patch hashes and migration hashes are in INTEGRATION-MANIFEST.json. Owner handoffs were actually supplied by the user; prepared prompts are not counted as delivered assignments. The three current Central review tasks worked on distinct implementation/test/audit scopes.

## Completed integration work

- Guided saved application, capture, identity, officer, readiness, review, hold and private-passport sources. Intake correction, independent review and version history use the actual protected services.
- Finance parallel reads attach rejection handlers immediately. Independent reproduction and a delayed-capabilities browser regression prove that early denial clears private records/drafts without an unhandled rejection.
- Original-key capture, intake and finance-training import receipts. Concurrent/replayed commands preserve one original source. Definitive pre-write validation rejection permits a corrected draft; genuine uncertainty does not permit duplicate execution.
- Corrected Operations service projections: order controls receive authoritative reviewed clients, and dispute controls receive the authoritative reviewer flag. This repaired a real render failure found by connected browser QA.
- Nine workforce/service variants and the two-company period flow feed actual service-produced finance inputs. The new fictional finance policy `lokd-sandbox-completion-v1-services-2` includes VIP. Partial collection/allocation, employee and corrected partner remittance, taxes, uncertain settlement recovery and private paid documents preserve original history.
- The synthetic approximate presence map reads the isolated database and exercises current assignment eligibility, consent, stop and expiry.
- Sandbox-only evidence retention clears overdue payloads with an atomic immutable tombstone, retaining source metadata and permanently denying reads. The local maintenance command has bounded batches and cannot select primary data.
- The backup exporter supports the current 210-table primary schema with a 256-table bound, retaining row/byte limits. A full-schema encrypted local rehearsal uses a separate key/destination directory, rejects wrong keys and tampering, and restores exact typed cells/schema/integrity/foreign keys.
- An actual isolated Operations incident/containment/independent-disposition/closure rehearsal preserves five consumed history tables. Synthetic roles and measured execution time are recorded in OPERATIONS-REHEARSAL.md; backup restoration is separate evidence.

## Validation ledger

Counts below are execution evidence, not a claim that a source census exercises every condition. Focused reruns overlap the full suites and must not be added to them.

| Check | Result / evidence |
| --- | --- |
| Complete backend regression except build-dependent HTML |487passed,0failed,0skipped; backend-full.log |
| Independent retention regression added after full test collection |1passed; retention-independent.log |
| Coherent Operations rehearsal added after full test collection |1passed; operations-rehearsal.log |
| Existing frontend regression |206distinct cases passed:176 initial plus30 public-fixture reruns; final frontend report records exact logs |
| Independent new UI recovery/privacy |16passed; security-recovery-browser-clean.log; included again in final integrated suite, not an additional distinct total |
| Final integrated browser and visual/accessibility acceptance | 76 distinct passed: 48 actual-handler and 28 response-mocked cases. Initial 74-case run had 70 passes and 4 mock-routing failures; corrected 26-case rerun passed; final finance rejection regression added 2 passing cases. See ../../finance-sandbox/central-checks/CONNECTED-BROWSER-QA.md and browser/ logs |
| Final build/rendered HTML/type/lint | Required Sites build passed after the last finance fix; rendered HTML 1 passed; TypeScript and lint passed. build-final.log, rendered-html.log, types.log, lint.log |
| Final backend/rendered total | 490 distinct passed: 487 full regression + independent retention 1 + Operations rehearsal 1 + rendered HTML 1 |

Independent source/security findings, fixes and acceptance boundaries: SECURITY-QA.md. Requirement-by-requirement status: REQUIREMENT-EVIDENCE.csv (43 rows). Static source inventory covers44 page routes and 1152 source controls; it is not test execution evidence.

## Provider evidence and remaining live acceptance

Owner evidence was independently checked:13 distinct actual hosted Clerk development scenarios, with an overlapping final five-test rerun; eight actual VerifyNow sandbox product requests. Those were not newly repeated by Central. Composite capture, recovery, consent, PSiRA, device readings, finance settlement and business policies are explicitly simulated where genuine inputs are unavailable.

Actual Paystack sandbox compatibility is unexecuted. The finance owner reported no usable test credentials and an automatic approval rejection of an authenticated probe because it could transmit a credential. No rejected action was bypassed or represented as a passing test.

The existing VerifyNow production adapter remains conservative. Genuine accepted capture/session/product/composite/recovery/evidence protocols, approved consent and operational policy, designated production accounts/roles, PSiRA evidence and physical-device acceptance remain on the separate provider/production checklist. The deterministic sandbox build does not claim these facts have been approved or observed. Fictional business decisions allowed implementation/testing to proceed.

No release, production migration, real identity submission, transfer, notification or live-service enablement occurred. Sites metadata independently still reports review v69 at https://demo.lokd.co.za. Existing payment/refund/scan locks and the previously authorized Operations MFA setting remain unchanged. The isolated local preview is for review; synthetic role switching is not Clerk authentication.

## Schema and local operation

Canonical primary migration: drizzle/0074_specialist_calendar_wage.sql. It corrects the authoritative calendar wage trigger; primary readiness inventory remains1340 required objects. Sandbox identity/workforce, command receipts and retention are separately installed from sandbox-migrations/0001..0003, never the primary Drizzle chain. The primary and sandbox databases are distinct; both the initializer and runtime fail closed on ambiguous/stale bindings or policy hashes.

The new finance policy has a new identifier/hash. Historical policy/command rows are not rewritten. Use the current controlled local initializer or a fresh local fixture rather than altering a populated historical sandbox database to impersonate the new policy. The retention command and its exact boundaries are documented in RETENTION-REHEARSAL.md.

## Review entry point

Local review: http://127.0.0.1:4405/officer/sandbox. See LOCAL-REVIEW.md for fictional role controls and restart instructions. The deployed site is still v69. Screenshots and exact candidate manifests are retained in browser/. Text evidence copied from owner or tool logs is normalized only for trailing horizontal whitespace and terminal blank lines; outcome text is preserved. Initial failed runs are retained and corrected reruns are explicitly identified.
