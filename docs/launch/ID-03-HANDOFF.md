# ID-03 — readiness evidence and passport lifecycle

Implementation checkpoint complete. Production policy, applicant evidence and provider/person acceptance remain outstanding. Stop here for Central Command; ID-04 is the next bounded assignment.

Checkout `/tmp/lokd-id01`, branch `codex/id-03-readiness-passports`. Incremental base `81b64c77eb77be49ecdc755b09c94dd980c30537` (ID-02); cumulative release base `14448dd15fa80fc19a3f2052462ae566ab35a2fd`. Original release checkout/frontend changes were not modified. No deployment, credentials, live flags or real provider/person records changed.

## Delivered files and migration intent

- `app/lib/production-readiness.ts`: server-only policy preparation, independent decisions, exact applicant readiness reviews, officer service opt-in, passport preparation/renewal, holds, private status and internal deadline contract.
- `app/lib/passport-server.ts`: the existing public/booking reader now recognizes ledger-backed `verified` production passports, checks exact-time currentness and selected service/purpose scope, and respects the existing domain-record provenance for booking/shift matching. Legacy/sandbox behavior remains separate. `productionAuthorized` remains false.
- `migrations/pending/ID-03-readiness-passports.sql`: additive proposal after ID-01 and ID-02. Six immutable ledger tables for policies, assessments, opt-ins, passport versions, decisions and holds; current/valid/usable views; atomic endorsement/service/passport projections; anti-promotion and projection guards; source invalidation and activation/check-in commit guards. **No policy or evidence seed rows.** Central assigns migration number, shared Drizzle schema/journal and route integration. Applied migrations were not changed.
- `tests/production-readiness.test.mjs`: isolated in-memory SQLite/D1 with foreign keys and the full existing migration chain plus all three proposals. Synthetic evidence remains exclusively in those disposable databases.
- `tests/assignment-activation-db.test.mjs`: opt-in checkpoint mode now loads all three proposals. The two existing incomplete linked-officer cases assert denial under the applicable officer/readiness guard; normal mode preserves their downstream service/payment tests.

## Policy and assessment contract

Nothing is ready by default. An Operations maker prepares an explicit immutable policy version, referencing the actually approved policy document and naming its exact requirements, scope and validity limit. An independent assigned owner approves it. Core policy code is `core_ready`; service codes are `service_unarmed`, `service_armed` or `service_vip`; purpose codes are `purpose_<exact purpose code>`. The policy document reference, required evidence keys, maximum age and expiry are supplied inputs, not inferred standards. A later approved version supersedes earlier versions without allowing an older version to revive after withdrawal.

An assessment binds the exact current ID-02 review ID/officer/owner and approved policy version. Each required item supplies the owner user ID, private source reference, SHA-256 digest, actual check time and source expiry. Every requirement must appear exactly once. Missing, duplicated, wrong-owner, future, expired and policy-stale evidence fails. Evidence must actually be inspected; this is an accountable manual evidence workflow, not automatic validation of arbitrary document contents. Its expiry is the minimum of ID-02 approval, policy expiry, actual source expiries and policy maximum age measured from source check time. Reapproval does not reset an evidence clock.

An independent assigned owner decides each assessment and cannot be its assessor, applicant or ID-02 approver. The database checks current source versions and expiry at commit. Approval atomically projects the existing `officer_endorsements` record and, for service qualifications, `officer_services`. Renewal retains immutable prior assessments/decisions while updating only the current projections. Sandbox endorsements/passports cannot be converted into production evidence.

Service opt-in is a separate immutable, revision-checked officer choice. Operators cannot opt in for someone else. Opt-in requires current qualification; opt-out records the officer's choice independently of operational approval. A qualification is not work eligibility or consent.

## Passport issuance, renewal and uncertainty

An Operations preparer selects exact current core, service and purpose assessment IDs under the same ID-02 approval. Each selected service needs the officer's current opt-in. Passport validity is capped by every selected source. A separate assigned owner approves issuance; they cannot be the applicant, passport preparer or any selected assessment's assessor.

A durable per-officer sequence prevents competing preparations from claiming the same version. Only the newest prepared sequence can be approved. The raw bearer token is returned once to the authorized preparer; storage retains only its hash. It is unusable until independent approval. If a preparation response/token is lost, read `latestSequence` and prepare a replacement sequence. The old pending sequence cannot subsequently be approved. If a token is lost after approval, prepare and independently approve a fresh version; the old token ceases to resolve when the new projection commits. No notification or delivery is performed by this checkpoint. Central must provide private delivery to the intended officer, with private/no-store responses and no token logging.

Renewal creates a new immutable version and token. It cannot extend source evidence or revive an older policy/assessment. Passport suspension/revocation blocks new issuance for that officer until a separate ID-04 disposition exists; this checkpoint supplies no hold-lifting override. Revocation is displayed explicitly. Opt-out, policy withdrawal, assessment changes, identity/PSiRA/intake changes and officer suspension invalidate current passport use without editing historical evidence or consumed service/payroll records. Opting back in does not revive a passport bound to the previous opt-in event.

Currentness is checked at the exact timestamp, including same-day expiry. `usable_production_readiness_passports` also requires the published projection to remain active/expiring with matching provenance, token and ledger pointer. Public results are no authority to deploy. Assignment/check-in commit guards separately bind the selected service and purpose to the actual booking and require validity through roster shift end. Existing funding, workforce, banking, availability, agreements, site, specialist and activation gates remain required.

## Integration contract and boundaries

`readinessContract(db, officerId, deadline, service, purpose)` returns null unless a usable scoped passport covers the future deadline. Otherwise it returns `lokd.production-readiness.v1`, passport version ID/sequence, exact ID-02 review ID, selected assessment and opt-in IDs, expiry, preparer/time and a commitment hash; it excludes the bearer-token hash and always returns `workEligible:false`.

New readiness consumers must join the usable view and selected current assessments inside their own guarded commit. An earlier helper result, projection flag or public green result is not a commit authorization. Immutable assessment/policy/decision tables hold source references and actors; private status reads deliberately omit them. Only authorized review tooling should expose those records.

Shared routes/UI remain Central/frontend-owned. Verify actors and assigned-owner status server-side, apply existing host/Operations/MFA policy and same-origin JSON protections, bound request sizes, use private/no-store responses, and map stale/CAS/unique failures to conflicts. Never accept actor booleans from client JSON. No UI, live identity adapter or external evidence-storage system was invented here.

The existing specialist compliance checks remain additional gates. Generic service qualification cannot replace firearm, medical, driving or other specialist evidence controls. The isolated positive example is Unarmed/commercial access. A real specialist scope requires its approved evidence rules and any missing specialist evidence producers before acceptance; this checkpoint does not assert complete specialist eligibility.

## Validation

- ID-03 fixtures: **11 passed**, 0 failed/skipped. Includes current issuance/projections, policy/access/separation guards, exact evidence requirements, scoped deadlines, renewal/old tokens, concurrent claims/decisions, stale sources, opt-out/non-revival, suspension/revocation, sandbox anti-promotion, direct projection tampering and same-day expiry.
- ID-02 fixtures: **8 passed**, 0 failed/skipped.
- ID-01 fixtures: **10 passed**, 0 failed/skipped.
- Existing passport rules: **4 passed**, 0 failed/skipped.
- `LOKD_IDENTITY_CHECKPOINT_FIXTURES=true node --experimental-loader=./tests/cloudflare-loader.mjs tests/assignment-activation-db.test.mjs`: **66 passed**, 0 failed/skipped.
- The same activation suite in baseline mode: **67 passed**, 0 failed/skipped. These are overlapping runs; two proposal-mode cases end at expected check-in denial and one nested downstream baseline test is absent. Do not interpret this as a fully connected positive ID-03-to-paid-service acceptance.
- TypeScript `npx tsc --noEmit --pretty false` and targeted ESLint: passed.

Run the checkpoint fixture files directly with `node --experimental-loader=./tests/cloudflare-loader.mjs tests/<file>.test.mjs` from this checkout. Full release build, browser, independent QA and real-device/provider acceptance remain Central's integration work.

Implementation findings retained: the old public reader treated activation's `verified` provenance as synthetic; managed passports now use the ledger explicitly. Date-only display checks were insufficient for same-day expiry, so public and commit consumers use exact current views. Nullable legacy evidence references could evade a simple SQL `NOT LIKE` anti-promotion check; the guarded path now handles null explicitly. Finally, a new passport sequence must not bypass an unresolved suspension: holds remain blocking until independent disposition.

## Genuine inputs still outstanding

1. Approved core/service/purpose assessment policies, assessors, actual source requirements, validity/renewal rules and protected evidence references. No production policy is installed.
2. Real identity adapter/capture/consent acceptance from ID-01 and owner-bound PSiRA acceptance from ID-02.
3. Intended officer, assessor, policy reviewer and independent issuance owner accounts; private token delivery and real officer acceptance.
4. Selected pilot service/purpose scope, specialist evidence requirements if included, and independent integrated QA. No fixture is production evidence.
5. Central migration/schema/route integration and later explicit live-check-in authorization. Existing live locks remain unchanged.

## Next bounded assignment

ID-04: implement independently reviewed correction, re-review and suspension disposition across identity/officer/workforce/readiness approvals. Explicitly resolve applicable holds before issuance can resume; reject stale resolutions at commit and prevent prior approvals from reviving. Preserve original evidence and consumed service/payroll history. Return additive migration intent, negative/race/recovery fixtures and remaining genuine inputs, then stop. Do not deploy or enable live service.
