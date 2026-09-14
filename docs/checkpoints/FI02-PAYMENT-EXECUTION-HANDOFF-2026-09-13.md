# Payment execution, reconciliation and recovery handoff — 2026-09-13

Status: implementation complete in isolated checkout; ready for Central Command integration and independent QA. No deployment, real transfers, new checkout fixtures or live acceptance testing. The owner clarified that all payment development should proceed using extensive local testing; live testing is deferred until the site is completely built.

## Source and scope

Checkout `/tmp/lokd-fi02`, branch `codex/fi02-reconciliation-contract`. Feature base `03e5ca410c6479ba963674ff73a4f0163148e256` snapshots Central's accepted FI-05 canonical integration on original owner commit `c1f1facaff455850052b0c554040f1b4ebb8a39b`. Central's canonical 0060 SHA-256 remains `bcb6209d2d1635e0f17806130e8b33a507ac5ef8936e1b96df9c5969ec21b89c`. The portable receipt records the exact final feature commit. Apply only the feature patch; do not replay the FI-05 snapshot over Central's existing integration. The shared workspace was not edited.

Implemented the dormant FI-02 adapter, independent funds/release/reconciliation controls, canonical financial projection, employee and partner recovery UI, and safe successor creation for canceled, never-submitted instructions. Existing destinations, payout mandates, approved instruction amounts and original references are reused.

Owned source:
- `app/lib/payment-execution.ts`: reserve and release review, durable one-shot claims, original-reference verification, signed live webhook ingestion, independent bank-backed reconciliation and finance history reads.
- `app/lib/payment-reconciliation-evidence.ts`: deterministic evidence assessment and immutable snapshot hashing; an assessment never marks paid or authorizes replacement.
- `app/lib/payment-recovery.ts`, `employee-payments.ts`, `partner-payments.ts`: explicit mode-bound live disposition, canceled-successor links and canonical financial reads.
- `app/api/payment-execution/route.ts`, `app/api/paystack/transfers/live/webhook/route.ts`: existing Operations identity/role/MFA/origin controls and separate live-key signature boundary.
- `app/components/payment-recovery-controls.tsx`, `payment-finance-controls.tsx`, existing employee/partner controls and `production-operations-panel.tsx`: reviewable proposals, independent approval, immutable history, safe replacement, stable retry keys and disabled live submission.

## Safety and behavior

Dispatch requires BOTH `LOKD_LIVE_PAYMENTS_ENABLED` exactly `true` and `payment_live_control.enabled=1`. The additive migration initializes the database control to 0; no public enable action exists. Neither deployment configuration nor genuine credentials were changed. Test dispatch still rejects live instructions. Local fixtures enable both controls only within rolled-back savepoints using an injected fake provider.

Reserve approval, instruction approval, release approval and reconciliation preserve independent operators and user identities, participant exclusion, policy limits and current authority. Funds evidence cannot be reused by changing its reference: both its allocation reference and evidence hash are guarded. Submission atomically consumes the reserve amount plus approved fee ceiling and preserves the original command/reference before the single provider POST. Timeout retains the claim and permits only verification, not resubmission or cancellation. Failed/reversed claims never silently replenish a reserve.

Provider success alone does not mean paid. Fresh, exact API verification plus matching signed evidence permits an independent bank-evidence review. Only the approved bank-backed receipt establishes canonical paid state. Bank proofs cannot be allocated twice under another reference or reused as reversal credit. A reversal preserves the historical paid receipt and requires its own independently approved credit evidence. Committed receipts do not expire merely because five minutes elapse; new contradictory evidence holds the current projection.

Missing events, timeouts, wrong authorities, stale/contradictory observations, binding changes, unsupported terminal outcomes and excessive history remain held. The webhook watermark is captured before the verification request, so an intervening signed event cannot be concealed by the later read. Final-disposition and replacement guards inspect ancestor claims, including canceled-successor edges. Originals, claims, decisions and links remain immutable. Every successor needs normal approval and, for live dispatch, a new valid release/reserve allocation.

## Migration contract for Central Command

Proposal source: `docs/migration-proposals/fi02-payment-execution.sql`; reproducible generator: `generate-fi02.mjs`; corresponding declarations: `fi02-schema.ts`. No historical migration, canonical schema or journal was edited by the feature.

Nine new tables: `payment_live_control`, `payment_live_reserves`, `payment_live_reserve_decisions`, `payment_live_releases`, `payment_live_release_decisions`, `payment_live_claims`, `payment_live_reconciliation_reviews`, `payment_live_reconciliation_decisions`, `payment_unsent_replacements`. Includes immutable history triggers, unique allocation/claim/proof constraints, current-authority guards, unified instruction/source views, final-evidence views, and employee/partner financial-state views. Existing command/recovery guards are extended additively, retaining test locks and original claims.

Central must merge the declarations into `db/schema.ts`, allocate the next available migration number, generate journal/snapshot metadata, and retain all custom SQL views/triggers/indexes and statement-splitting compatibility. Apply canonical 0060 only once. After numbering this proposal, remove the explicit proposal load in `tests/assignment-activation-db.test.mjs` and adapt `tests/payment-execution-contract.test.mjs` to the canonical migration path. Verify schema drift and hosted SQL statement constraints locally before considering any future deployment.

The financial-state views and payment API `financial` field are the reconciliation contract. Historical payroll/payable source statuses remain intact. Downstream payslip/invoice/report consumers must consume the canonical projection when Central integrates the broader finance/document work.

## Validation

Final source: production `vinext build` passed; complete Node regression passed 297 tests, 0 failed, 0 skipped. TypeScript and changed-file ESLint passed. Global unrelated frontend lint findings are not represented as a clean whole-repository lint result.

New tests: `tests/payment-reconciliation-evidence.test.mjs` (9), `tests/payment-execution-contract.test.mjs` (2), `tests/fixtures/payment-execution-journey.mjs`, and `tests/payment-controls.browser.mjs`. Expanded existing employee, partner and recovery journey fixtures use their original payroll/invoice/destination records.

The journeys exercise concurrent decisions/submission/replacement, replay, durable timeout, authority revocation during provider reads, insufficient balance, recipient mismatch, stale evidence, wrong signing key/domain, event-during-verification races, duplicate bank/funding proof aliases, reversal, paid-history retention, canceled-successor ancestors and immutable claims. Proposal SQL is exercised with all canonical migrations, foreign keys and restricted SQLite limits.

Real local Chromium component testing passed recovery/approval/cancellation, finance forms, stable retries, keyboard refresh, disabled live dispatch and overflow checks at 360, 390 and 1280 pixels. This is a local component integration harness with mocked finance reads, not hosted end-to-end identity/provider acceptance. The screenshot and successful final logs accompany the portable receipt.

Reproduction: `./node_modules/.bin/vinext build`; `node --experimental-loader=./tests/cloudflare-loader.mjs --test tests/*.test.mjs`; `./node_modules/.bin/tsc --noEmit`; ESLint on owned changed TS/TSX/MJS files; `node tests/payment-controls.browser.mjs` (local browser dependencies required). No live credentials or checkout fixtures are needed.

## Remaining integration and next assignment

Central Command owns canonical schema integration, independent review and integration with the rest of the site. Other finance/document checkpoints and full-site acceptance remain with their assigned owners; this package does not claim the entire site is complete. Bank proof review is an explicit independent human control, not a new automatic banking feed. Genuine provider capability/funds/mandate acceptance and hosted migration execution remain unverified and are deferred until the site is ready; they do not block continued development. Partial payments and unsupported evidence remain held.

Next assignment: integrate this feature patch onto Central's current checkout, merge and number the shared schema contract, then perform independent local payment/finance/document integration QA while retaining both live locks. No deployment or live test is requested. The handoff is a local artifact prepared for Central to read; no task-message delivery is claimed.

## Reusable observations

Capture the event watermark before external verification; compare the complete immutable evidence binding; preserve ancestor claims through every successor edge; distinguish provider success from an independently approved bank-backed paid receipt; and prevent duplicate proof allocation by both reference and hash. Fixture failures exposed a cloning assumption and missing app CSS reset in the browser harness; fixing those harness assumptions produced the recorded passing runs. Restricted subprocess execution stalled earlier broad test runs; only the completed bounded local runs are counted. No model-training or usage-savings claim is made.

Provider contract references: https://paystack.com/docs/api/transfer-control/ , https://paystack.com/docs/transfers/managing-transfers/ , https://paystack.com/docs/api/transfer/ . These were documentation reads; validation made no real provider calls.
