# ID-02 — independent officer approval bridge

Implementation checkpoint complete; genuine production identity/provider/PSiRA/person acceptance remains outstanding. This follows the user's instruction to continue to the next checkpoint. Stop here for Central Command. No readiness, qualification, passport or live-check-in enablement is included.

Checkout: `/tmp/lokd-id01`. Branch: `codex/id-02-officer-approval`. Incremental base: ID-01 commit `17d65dee56d49ba49316509ca669e7c6d631146f`. Original release base: `14448dd15fa80fc19a3f2052462ae566ab35a2fd`. The original workspace and its frontend edits remain untouched.

## Code and migration intent

- `app/lib/production-officer-review.ts`: server-only prepare, independent decision, private status read and suspension commands. Reuses existing intake/entity preparation, ID-01 identity evidence, `reviewEvidence`, `verificationState`, immutable PSiRA events and the existing authenticated actor model. Final decision requires the assigned Operations owner.
- `migrations/pending/ID-02-officer-approval.sql`: additive proposal after ID-01, with three immutable review/decision/suspension tables; current source/review/approval views; guarded atomic officer/compliance projections; source invalidation, activation epoch updates and activation/check-in commit guards. No applied migration changed. Central allocates migration ordering, Drizzle schema/journal integration and shared routes.
- `tests/production-officer-review.test.mjs`: complete applied migrations plus both proposals, foreign keys enabled, in-memory SQLite/D1, isolated synthetic identity and PSiRA fixtures only.
- `tests/assignment-activation-db.test.mjs`: explicit `LOKD_IDENTITY_CHECKPOINT_FIXTURES=true` mode loads the proposed migrations. Two old fixtures deliberately have incomplete linked officer evidence: in this mode they assert check-in denial and stop before their downstream service/payment flow. The normal baseline run retains those full flows. This is not full ID-02-to-paid-service acceptance.

No credentials, provider calls, persistent database writes, deployment or runtime flags were changed. Live identity remains unconfigured as documented in ID-01. No public API/UI was mounted; shared production routing belongs to Central.

## Behavior and evidence chain

Preparation requires an existing pending/suspended operational officer produced from current reviewed intake. The source view binds the exact intake version and authenticated owner to the existing entity link and the current independently approved ID-01 outcome. Names, mobile, city, email and registration details must still agree with the reviewed intake/corrections. Training and unregistered declarations cannot pass.

PSiRA evidence must be the latest review event for that same owner user ID and number, with registered/confirmed status, matching returned name and grade, source-check/recheck validity and a current certificate. The existing official-source and evidence rules are reused. PSiRA `identityEvidence` must equal `production-identity:<outcomeId>` for the exact current identity outcome. A generic identity note, email match, declaration or old sandbox check is insufficient. Returned-name comparison trims and ignores case but does not infer aliases or accept a different name.

Review preparation stores the exact source tuple and digest. Independent approval requires a different actor from the applicant, review preparer, operational entity preparer and identity reviewer. The PSiRA review stores the reviewer's email, so that maker is excluded by normalized authenticated email as well. The server rechecks source evidence, and the database re-joins its exact versions/outcome IDs at decision commit.

An approved decision atomically sets officer approval, copies the actually reviewed PSiRA certificate date, and produces exactly two protected compliance records: `identity` and `psira`, with `production`/`verified` provenance and `officer-review:<reviewId>` references. Their validity ends at the earliest identity expiry, PSiRA recheck or South African certificate expiry boundary. Rejection creates neither approval nor compliance. Concurrent decisions cannot duplicate projection. Direct approval and forged bridge compliance projections are rejected.

Identity outcome/suspension, PSiRA case, intake or entity-link changes invalidate current approval and suspend affected approved officers. Direct officer detail changes append a suspension. Activation epoch advances on relevant mutations; activation and check-in commits require current approval covering the actual roster shift end. Expiry automatically removes current approval from the view even without a background status update. The status read therefore uses the current view, not just `officers.approval_status`.

Historical reviews, decisions and bridge compliance rows cannot be edited/deleted. Invalidating evidence does not rewrite consumed service, payroll or ledger history. Further correction/reissue and suspension recovery policy belongs to ID-04. No banking, workforce, service opt-in, qualifications, endorsements, passport or blanket work-eligibility flag is granted.

## ID-03 evidence contract and integration

Use `current_production_officer_approvals` with the exact `officer_id`, review `id`, `source_hash` and future validity deadline. Join `production_officer_decisions` by review ID when recording approval actor/time. `source_json` retains applicant ID/version/owner, exact operational details, identity case/outcome/reviewer, entity preparer, PSiRA case/event/reviewer, certificate date and conservative expiry.

ID-03 must re-join this current view within its own guarded commit and retain the review ID and identity/PSiRA source IDs. An earlier status response or approval label is not authority. Later source changes or suspension must invalidate current readiness without editing historical service evidence. Keep all existing workforce, funding, availability, endorsement, agreement, passport and activation gates.

Central must route commands through verified server actors, existing host/Operations authorization, same-origin JSON and private/no-store responses. Do not accept actor/owner booleans from JSON. Decision needs an independent assigned owner; map database stale/uniqueness failures to conflict responses. Evidence references/digests stay internal; participant status reads expose only review state and expiry. Existing email-based PSiRA activation checking remains an additional conservative gate; the new bridge and commit guards supply exact owner binding.

## Validation receipt

All commands ran from the isolated checkout with no exported browser fixtures:

- `node --experimental-loader=./tests/cloudflare-loader.mjs tests/production-officer-review.test.mjs`: **8 passed**, 0 failed/skipped. Covers successful projection, access/maker separation, wrong owner/name/grade/reference, expiry, immutable evidence, stale source and commit race, suspension and concurrent decisions.
- ID-01 regression: **10 passed**, 0 failed/skipped.
- Existing PSiRA regression: **5 passed**, 0 failed/skipped.
- `LOKD_IDENTITY_CHECKPOINT_FIXTURES=true node --experimental-loader=./tests/cloudflare-loader.mjs tests/assignment-activation-db.test.mjs`: **66 passed**, 0 failed/skipped, including explicit linked-officer check-in denials.
- The same activation suite without that variable: **67 passed**, 0 failed/skipped. One additional nested downstream test runs in the baseline flow; do not combine these counts as unique cases.
- TypeScript `npx tsc --noEmit --pretty false`: passed.
- Targeted ESLint for the new module, new fixtures and changed activation fixture: passed, no warnings.

Initial proposal integration correctly failed the two sparse legacy account-link fixtures at the new check-in gate. They now have explicit negative assertions in proposal mode while retaining the original complete flow in baseline mode. This is a useful integration finding: attaching an account link cannot turn legacy seeded officer rows into evidence-backed production officer approval. Full integrated positive service acceptance awaits ID-03 and independent QA; no fabricated readiness was added to make it pass.

## Genuine inputs still unresolved

The ID-01 provider/capture/consent contract and adapter acceptance remain required. Intended real applicant, preparer, identity/PSiRA reviewer and independent owner accounts must be provisioned and accepted. Actual current PSiRA source evidence must reference the accepted real identity outcome; isolated fixtures prove guards, not registration. Central must integrate shared routing and migration/schema order and arrange independent QA. Legal/business evidence rules and document policies remain externally supplied inputs.

## Next bounded assignment

ID-03: implement guarded core-readiness evidence, qualification/service opt-in, purpose endorsement and passport issuance/lifecycle from current ID-02 approval and approved evidence rules. Preserve independent decisions, exact source versions and validity through assignment end. Prepare isolated stale/race/suspension/expiry fixtures and additive migration intent; stop before ID-04, provider acceptance, deployment or live check-in enablement. Any evidence policy not supplied must remain a named unresolved input, not a synthetic ready state.
