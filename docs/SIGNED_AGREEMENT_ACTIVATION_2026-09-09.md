# Exact signed-agreement activation gate

Clerk plan review remains with the owner; this work continues independently without changing Clerk configuration, roles or MFA. No preliminary Legal wording is published and no production signing endpoint is enabled.

## Implemented behavior

The production readiness service now requires three current signed receipts: client MSA, service order/SLA, and either officer employment (Direct Flex/Managed) or the selected partner-service agreement. The workforce route is read from the actual engagement; this code does not select a legal model.

An explicit `bookings.contracting_entity_id` identifies the client-facing contracting party separately from the officer's employer. An absent value blocks signature readiness. No real entity is seeded. `agreement_version` identifies commercial order revisions, independently of operational roster versions. A routine activation status/version change does not ask the parties to sign again.

Each receipt is bound to the exact slot and signed scope: booking/client/provider, site/post/risk plan, service/grade/purpose, shift window, order particulars, headcount, pricing, funding terms and selected employer/route. Workforce receipts additionally bind the officer, engagement, terms version and offered amount. Changes invalidate matching through the context hash even if an order editor forgets to increment its agreement version. This is a conservative per-assignment binding, not reusable blanket approval for unrelated future work.

Receipt hashes, exact context and wording hashes, affirmative action, identity/representative references and signature time must match. Client and partner representatives require separate authority evidence. The document ID/version/hash/entity/locale must also match an approved production registry record that was effective when accepted. Privacy, marketing, banking or deduction acknowledgements cannot substitute for these agreements.

The existing `contract_template_versions`/envelope tables are deliberately constrained to synthetic demo rehearsals. They remain unchanged. New `agreement_document_versions` stores immutable production approval metadata and content references; it is separate so demo records cannot be relabelled as production. No documents or approvals are seeded by migrations.

Receipt revocations are append-only records. Revoked evidence cannot satisfy subsequent activation/revalidation. Inserting receipts, document versions or revocations advances the existing activation evidence clock, so a change during commit invalidates the prepared evidence token and the transaction rolls back. Final evidence payloads retain the selected receipt IDs/hashes and document versions alongside the other activation facts. Existing immutable snapshots are preserved.

Activation policy version is `LOKD-ACTIVATION-2026.09-v2`. All funding, identity, PSiRA, eligibility, employment, scheduling, MFA and independent-approval controls continue to apply. A receipt alone never authorizes work or payment. An operational hold after revocation is not a legal conclusion that a contract has been terminated or wages are no longer due.

## Acceptance and next integration steps

Tests exercise explicit synthetic signed fixtures for legitimate production-route tests; no real legal agreement is implied. Tests cover missing/changed contracting entity, amended order version, changed shift/employer, revoked evidence and revocation during atomic activation. Successful activation snapshots retain all three receipt references; normal scheduled revalidation and check-in still pass with unchanged agreements. Receipt, document and revocation records reject ordinary updates/deletes.

Remaining: approved actual legal bodies and entity/model/mandates, trusted document loading and named signer proof, a controlled signing/recording UI/API, receipt delivery/download, individual/all-relevant-receipt revocation procedures and retention/deletion under approved policy. Collection-before-signature sequencing must be implemented with the eventual real payment adapter; this change enforces activation/revalidation only. No legal approval, provider signature acceptance or live financial acceptance is claimed.

Recovery: after a relevant scope change, present the revised exact package and record a new acceptance key; preserve prior copies. Following mistaken evidence or withdrawal, append revocation evidence, hold future activation and reassess under approved policy; never edit a receipt in place or silently restore it. A new draft version does not overwrite an already signed approved version.

## Validation

Final production build and all 234 regression tests passed. The runnable checklist passes its 20 existing local checks plus six agreement/activation checks. TypeScript and changed-source lint passed. The unchanged Clerk browser journeys were not rerun; prior development MFA acceptance remains distinct from unresolved production enrollment.

Test-driven correction: using the roster's operational version initially made ordinary activation invalidate its own signatures. A separate agreement version plus frozen commercial scope fixed this; normal activation, T-24/T-2 and check-in now retain valid signatures. Existing database funding controls rejected an unsupported price mutation before the signature layer, so the integration test now changes the agreement revision to isolate the signature gate without weakening funding guards.
