# ID-04 — suspension, correction and independent re-review

Implementation checkpoint complete; stop and return to Central Command. This is fixture-tested code, not production identity, registration, workforce or pilot acceptance.

Base: ID-03 `8e00c184011c3e28b2ffa115e53a2d22cabf9aec`. Isolated checkout `/tmp/lokd-id01`, branch `codex/id-04-rereview-disposition`. Original release base for the cumulative patch: `14448dd15fa80fc19a3f2052462ae566ab35a2fd`. The shared workspace and its existing frontend edits were not changed.

## Code and migration intent

- `app/lib/production-rereview.ts`: Operations request for information through existing signup review; protected investigation preparation; independent owner disposition; existing approved workforce-evidence suspension; private owner/Operations status.
- `migrations/pending/ID-04-rereview-disposition.sql`: apply after ID-01, ID-02 and ID-03 proposals. Adds immutable workforce holds, investigation proposals, decisions and sequence/row cutoffs; current authorization views; replacement and decision guards; automatic workforce suspension on intake correction or officer approval loss. Replaces the ID-03 passport validity view and preparation trigger in this new migration so fresh independently reviewed versions can follow a disposition. No previous migration is rewritten; no seed evidence or permission rows.
- `tests/production-rereview.test.mjs`: disposable SQLite/D1 fixtures, foreign keys enabled, existing migrations plus all four proposals.
- `tests/assignment-activation-db.test.mjs`: opt-in checkpoint mode now loads ID-04 too.

Central owns final migration numbering, Drizzle schema/journal, shared routes/UI and integrated release review. Do not apply these proposals directly to production. Check shared migration changes against the exact base first. No credentials, deployments or live flags changed.

## Contract and behavior

A disposition authorizes **fresh replacement review**, never restores an old approval. The targets are immutable identity suspensions, officer suspensions, workforce holds, individual assessment holds and passport holds. Global policy holds continue through independently approved new policy versions in ID-03; this module supplies no policy override.

`prepareRereviewDisposition` requires exact hold kind/ID, current independently reviewed applicant version, protected investigation reference, SHA-256 digest, actual check timestamp, expiry and explicit inspection. The applicant cannot investigate their own hold. Preparation binds the source JSON/hash and global activation evidence epoch. `decideRereviewDisposition` requires a separate Operations owner who is neither investigator nor applicant (nor the recorded hold actor), and an independent inspection. `allow_replacement` checks source version, currentness, expiry and epoch at commit; `keep_held` grants nothing. A concurrent approval has only one winner. A stale denial can safely retain a hold but cannot grant permission.

Approval records immutable cutoffs for existing passport sequences and officer/readiness/workforce review rows. Replacement reviews must follow those cutoffs, even if their timestamps fall in the same millisecond. Permission binds the reviewed intake version and expires for new preparation/approval. Already valid replacement passports do not expire merely because the investigation permission window subsequently closes; their own evidence expiry, holds and all currentness checks still apply.

Identity replacement uses the existing exact owner/applicant/version/capture contract. A real request for information, actual applicant correction and independent intake review produce the next version. A disposition cannot bypass ID-01's unresolved-delivery guard or cause a second provider submission while delivery is unknown. Recovery remains lookup-only. New identity evidence and an independently reviewed current PSiRA event are required for the ID-02 bridge; prior cases and compliance evidence remain unchanged.

Held assessment scopes require newly checked evidence and fresh independent assessment approval. Passport replacement additionally requires all selected assessments to be created and checked after the relevant disposition, a new sequence/token and ordinary independent issuance. Old held passport IDs remain unusable permanently. A new hold invalidates a prepared replacement at commit. No general unsuspend or token revival operation exists.

`suspendOfficerWorkforce` reuses `manageProductionEvidence` on an approved engagement review. Its suspension transaction records an immutable workforce hold and holds the current passport when present. A retry after a lost response recognizes the already suspended engagement. The old engagement is frozen against updates/deletion; replacement needs a new engagement ID and fresh independently approved source review after the disposition. Intake version changes and loss of officer approval also suspend linked active production engagements. This preserves historical engagement IDs and consumed service/payroll references. It does not rewrite completion or payment history.

Automatic workforce/passport holds record `system` as the trigger actor. Explicit workforce suspension retains the human actor and reason in the existing `production_evidence_suspended` audit event, linked via the approved evidence review payload. Review tooling must show that provenance alongside the automatic hold. Independent investigator/decision-maker separation still applies; the system hold itself does not identify the original human for the extra hold-actor exclusion.

`readRereviewStatus` is restricted to the exact applicant or Operations, returns version/status and hold IDs/times/current authorization expiry, and omits private evidence references/digests. All mutation responses explicitly return `restoresApproval:false` and `workEligible:false`. Existing ID-01 and ID-03 evidence contracts remain unchanged. Commit consumers must use their current guarded evidence views, never treat this status or a disposition as eligibility.

Central must derive actor/owner roles server-side using the existing access/MFA policy; apply same-origin JSON, request bounds and private/no-store responses; map source/unique/CAS conflicts to refreshable errors. Private investigation references are accountable manual evidence, not cryptographic proof that a document's assertions are true. No live provider adapter, capture storage, notification delivery or general public investigation route is introduced.

## Validation

- ID-04: **11 passed**, zero failures/skips. Covers independent access, concurrent decisions, immutable receipts, wrong version/stale/expired investigation, expiry at decision, keep-held, actual intake correction and fresh identity/PSiRA bridge, uncertainty without resubmit, assessment draft cutoffs, fresh passport issuance, old-token non-revival, late-hold race, workforce suspension/retry/replacement and automatic intake/officer suspension.
- ID-01: **10 passed**; ID-02: **8 passed**; ID-03: **11 passed**, zero failures/skips.
- `LOKD_IDENTITY_CHECKPOINT_FIXTURES=true node --experimental-loader=./tests/cloudflare-loader.mjs tests/assignment-activation-db.test.mjs`: **66 passed**, zero failures/skips, all four proposals loaded.
- TypeScript `npx tsc --noEmit --pretty false` and targeted ESLint passed.

Run each checkpoint directly with `node --experimental-loader=./tests/cloudflare-loader.mjs tests/<checkpoint>.test.mjs`. Logs from this checkpoint are `/tmp/id04-tests.log`, `/tmp/id04-production-identity.log`, `/tmp/id04-production-officer-review.log`, `/tmp/id04-production-readiness.log` and `/tmp/id04-activation.log`.

Activation coverage includes existing stale-source/commit denial tests. Two checkpoint-mode legacy cases intentionally stop on expected check-in denial; this is not a positive integrated ID-04-to-completed-paid-service acceptance. The unchanged baseline suite was not repeated this round. No real-device, full release build, shared route or live-provider acceptance was performed.

Observed implementation lesson: removing a hold or checking only timestamps can revive old drafts/tokens. Preserve holds and use immutable cutoffs plus current evidence at the final decision. The fixtures demonstrate that old assessments and passport versions cannot cross that boundary; independent integrated QA is the next evaluation.

## Unresolved inputs and next bounded assignment

Central must integrate ID-01–04 migration/schema/routes, then have independent QA verify the selected end-to-end officer/workforce/service route, including activation racing correction/suspension and preservation of consumed payroll history. Confirm that Operations is satisfied with the restrictive replacement-only disposition policy and automatic hold audit presentation.

Still required: genuine production provider/capture/consent acceptance; exact real applicant binding and current PSiRA evidence; approved qualification/service/purpose evidence rules; actual protected investigation and employer/payroll/benefit evidence; assigned maker/independent owner accounts; private token delivery; selected workforce/service model and real-device acceptance. No fixture may be promoted to meet these inputs. Partner responsibility semantics remain the workforce owner's OP-01 assignment.

The next bounded assignment belongs to Central and independent QA: integrate these four checkpoints and return an evidence-linked acceptance/gap report for the selected pilot route. Stop before deployment, provider submission with real people, credentials changes or live check-in enablement unless separately authorized. This workstream does not proceed into another owner's lane.
