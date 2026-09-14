# ID-USABLE-01 — usable identity backend checkpoint

Complete and stopped for Central Command. Delivered authorized review-data access, correction/disposition endpoint contracts, exact human workforce suspension audit provenance and private passport possession/delivery. No real provider submissions, credentials, production evidence, deployment or live enablement. Frontend presentation and independent integrated acceptance remain their owners' work.

## Source and preservation

Read Central's `CONNECTED-PAYROLL-CENTRAL-ACCEPTANCE-2026-09-14.md` and preserved the current combined working tree, including connected payroll and numbered migrations through 0066, in `/tmp/lokd-id-usable`. Branch `codex/id-usable-backend`, snapshot base `5165c7b78055b329f43663278377b54f3b0669c6`. `central-source-manifest.json` records SHA-256 hashes for 582 source files, excluding credentials/dependencies/build outputs. This base is an isolated source snapshot, not a combined release commit.

The only shared-tree write is the new coordination document `docs/launch/IDENTITY-BACKEND-FRONTEND-CONTRACT-2026-09-14.md`. It points the frontend owner to the implemented contract and working path. No existing combined file was overwritten. The app supplied read-only task discovery but no callable task-message tool; no delivered message or frontend agreement is claimed. The integration patch contains only this checkpoint's delta, not another copy of earlier identity/finance/frontend packages.

## Delivered code

- `app/lib/production-identity-review-data.ts`: bounded case discovery and exact owner status, Operations-only queues/private source inspection, immutable access audit, paginated holds and human provenance. No public evidence-store fetching or bearer hashes in review responses.
- `app/lib/production-identity-contract.ts`: browser-safe request/delivery types and Web Crypto token material helper. The officer generates and retains the raw bearer; only its hash goes to the identity backend.
- `app/lib/production-passport-delivery.ts`: exact owner/version-bound, idempotent delivery requests and private metadata status. Raw tokens never enter storage. Expiry, one-use binding and revocation/currentness remain guarded.
- `app/lib/production-readiness.ts`: owner-request delivery binding in the same transaction as passport preparation. The HTTP path requires deliveryId and never returns a token to Operations. Independent approval, selected evidence, sequence and hold controls are reused. Legacy internal fixture callers retain their existing behavior.
- `app/lib/production-evidence.ts`: engagement suspension audit includes the exact engagement ID and pre-suspension source version along with the human reason. Other evidence kinds retain existing behavior. Audit detail for new engagement suspensions is structured JSON; consumers must handle both new JSON and historical plain text.
- `app/api/production-identity/route.ts`: new reads and intake/delivery actions under existing verified-session, workspace/role/MFA/origin controls. Existing provider start/recovery remain unconfigured; no client-supplied adapter/outcome accepted.
- `app/api/passport/verify/route.ts`: body-only, read-only public bearer verification. New frontend links can use a URL fragment to avoid a token in the server-visible URL. No scan, arrival or enablement mutation. Legacy verifier remains compatible.

Full route fields, errors, access, review semantics and token-loss procedures: `ID-USABLE-01-ENDPOINTS.md`. Evidence-linked journey checklist and exact genuine input pack: `ID-USABLE-01-ACCEPTANCE.md`.

## Migration intent

`migrations/pending/ID-USABLE-01-private-delivery-and-provenance.sql` is additive after Central's current canonical history. Central chooses the next free migration number and schema/journal/snapshot integration. Do not edit or reapply old migrations. No evidence or authorization seed rows.

It adds delivery requests, one-use bindings and human hold provenance; a current delivery view; request/preparation/decision guards; immutable delivery/provenance/review-access audit; exact human separation for resulting dispositions. It replaces only ID-04's workforce capture trigger in this new migration so a new automatic passport hold names its precise originating workforce hold. Original system actors, holds and historical tokens remain intact.

Human linking uses engagement ID plus its actual pre-suspension version, not timestamps or a guessed latest actor. A raced source version aborts the suspension transaction. Historical system-only holds are not backfilled or attributed based on proximity. Related older human audit is exposed separately. Direct identity/officer/readiness holds continue to show their existing actual actors. Automatic source-expiry/correction cascades can remain system-only; the read contract never invents a human cause.

The request expires after 24 hours for preparation/approval. Already approved passports retain their own evidence/currentness/revocation lifetime. Lost raw material requires a new request/sequence/independent approval; expired/stale/consumed requests cannot issue another passport. No encryption secret is introduced because the backend never stores the plaintext bearer. Protected identity/provider evidence access remains a genuine external input, not an invented local blob store.

## Validation and evidence

- New HTTP/backend suite: **10 passed**, zero failed/skipped. Own/other-account discovery, all review types/private audit, role denial, corrections/review/version changes, private owner request/replay/payload conflict, Operations token non-disclosure, independent issuance, superseded/revoked tokens, immutable delivery/audit history, human hold attribution/separation, legacy system-only history, request expiry, concurrent preparation, hold/correction races, workforce source-version race, and read-only body verification.
- Connected identity-to-payroll suite with the proposal: **9 passed**, zero failed/skipped. Includes Central's actual synthetic payroll consumption/export and unchanged consumed history after suspension.
- Activation/service/payroll suite with the proposal: **68 passed**, zero failed/skipped.
- ID-01 **10**, ID-02 **8**, ID-03 **11**, ID-04 **11**, existing identity HTTP boundary **1**: all passed without failures/skips. These older suites used canonical history; proposed behavior is covered by the new and proposal-enabled connected/activation suites.
- TypeScript and targeted ESLint: passed without warnings; whitespace passed.

Logs in `id-usable-01-checks/`. The retained failed run is a fixture construction issue: employer evidence was set to now+24h, then requested engagement coverage to a later now+24h. That correctly failed the existing coverage guard when a millisecond elapsed. The employer fixture now covers 48h; production validation was not relaxed. The subsequent complete new suite passed. No build/browser or real-account pass is claimed for this backend delta.

Run from the isolated checkout:

```sh
node --experimental-loader=./tests/cloudflare-loader.mjs tests/production-identity-usable.test.mjs
LOKD_IDENTITY_USABLE_FIXTURES=true node --experimental-loader=./tests/cloudflare-loader.mjs tests/production-identity-connected.test.mjs
LOKD_IDENTITY_USABLE_FIXTURES=true node --experimental-loader=./tests/cloudflare-loader.mjs tests/assignment-activation-db.test.mjs
```

Only opt-in fixture loading was added to the existing activation suite and identity journey helper. Once Central numbers this migration, adapt/remove the extra proposal loading so canonical history is loaded once. The historical provenance test must continue to construct its pre-migration fixture before applying this migration.

## Acceptance boundaries and next assignment

The exact missing genuine inputs are enumerated in `ID-USABLE-01-ACCEPTANCE.md`: production provider/capture entitlement and protocol acceptance; approved consent/privacy versions and actual receipts; protected evidence access/retention; real applicant identity and current PSiRA sources; approved assessment rules and actual evidence; intended independent accounts/roles/MFA; selected client/site/service/workforce model, employer/legal/funding/payroll/benefit sources and finance calendar convention; real-device and release acceptance.

Next bounded assignment: Central integrates this backend/migration delta with the frontend owner's review/disposition/private-delivery interfaces, including `/verify` fragment handling and the body verifier. Independent QA validates the combined human journey and private token handling on intended devices/accounts, preserving provider 503 and live locks until genuine acceptance is explicitly authorized. No provider, consent, PSiRA or actual-person acceptance is inferred from fixtures, and this workstream stops here.
