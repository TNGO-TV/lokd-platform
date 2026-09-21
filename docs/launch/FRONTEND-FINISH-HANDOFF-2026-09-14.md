# Frontend finish: local review checkpoint, 14 September 2026

Central Command owns integration and any later release. This checkpoint does not authorize deployment, provider calls, notifications, transfers, checkouts, FI-02 activation or a pilot launch.

## Integration basis

Read `CONNECTED-PAYROLL-CENTRAL-ACCEPTANCE-2026-09-14.md` and inspected the original combined dirty tree before copying it. Original committed HEAD: `14448dd15fa80fc19a3f2052462ae566ab35a2fd`. The isolated baseline includes the uncommitted integrated frontend, finance, identity and migration changes, captured as `dae59fb74b22cba2853e2e8583b161059d6032de`. Checkout: `/tmp/lokd-frontend-finish-20260914`, branch `codex/frontend-finish-20260914`.

Apply only the supplied frontend integration patch against that combined baseline. Do not merge the baseline snapshot commit into Central's history. It contains changes Central already owns. The original working tree was not edited. The external evidence package contains its snapshot hashes, final revision, changed-file list and patch checksum.

## Journey inventory and result

| Journey | Routes / tabs | Local checkpoint |
| --- | --- | --- |
| Public | Home, security services, armed security, VIP, industries, Johannesburg location, clients, officers, training, compliance, about, contact, privacy; join wizard | Existing navigation, exact active destination, responsive layout and intake recovery exercised. |
| Client | `/client`, `/client/agreements`, `/client/service`, `/client/test-cycle` | Submission correction and recovery preserved; exact agreement wording and scope remain intact; financial unknown outcomes keep the original reference and never imply payment success. No Client access to Officer evidence added. |
| Officer | `/officer`, agreements, service, test-cycle, PSiRA, sandbox identity, new `/officer/readiness` | Persistent readiness navigation; intake links carry application reference; owned record summaries, assessments, service choices, holds and private passport status. Backend still enforces exact ownership. |
| Operations | `/ops`, `/ops/intake?kind=officer|client`, agreements, service, PSiRA, sandbox identity, security, test-cycle, new `/ops/readiness` | Intake active tab no longer empties the loaded records; source-bound identity decisions, independent owner officer decisions, correction requests, investigation preparation/disposition, and holds use existing endpoints. Owner controls remain restricted by server principal and backend checks. |
| Sign-in / recovery | Approved workspace destinations, identity/readiness record selectors | Safe known-route return destinations retain selected records; cross-workspace subdomain returns and arbitrary URLs rejected. Mobile authentication card width constrained. No authentication or permission grant added. |

Readiness sections are anchors with current-section indication, not a second independent router. The responsive shell wraps navigation on narrow screens. Inputs have stable accessible names, 44px actions, visible keyboard focus, loading/error states, saved-status refresh and explicit record-switch discard confirmation. Unsaved reviews warn on navigation or unload. Failed refresh retains the previous display and draft but disables review actions. Source changes require deliberate review and new acknowledgements. Unknown writes lock that draft against automatic resubmission.

## Backend contract handoff — acceptance blockers

These are contracts needed from the backend owner, not permission for frontend workarounds. Preserve existing ownership, Operations/MFA checks, independent-actor separation, source/version/expiry checks and immutable financial history.

| Contract | Current response / limitation | Needed acceptance contract |
| --- | --- | --- |
| Record discovery | `/api/production-identity` requires explicit case/officer/application references. Intake supplies application references but not a complete linked identity/officer map. | Protected current-user record discovery and an Operations queue linking application version, officer and identity references. Return only records the verified principal can access. Define empty, held, missing-link and stale-version behavior. |
| Independent review detail | Identity GET is a summary. Officer GET lists reviews without source evidence/actors. Readiness GET returns current approved summaries, not policy requirements or pending reviews. | Protected exact source/evidence references, hashes, versions, validity windows, reviewer provenance, pending records and allowed actions for independent comparison. Rule catalogue and assessment detail needed before assessment preparation can be finished. Existing forms require actual external inspection; the summary alone is insufficient evidence. |
| Suspension audit | `kind=rereview` returns kind, hold ID, time and replacement authorization cutoff. No actor, reason, immutable audit-event link, investigation detail or decision history. | A scoped immutable timeline with actual human actor where recorded, separately identified automatic consequences, reason, investigation/proposal and independent decision, source versions, and expiry. Never invent a human actor for an automatic hold. Human-readable labels/times are implemented, but complete human audit acceptance remains blocked. |
| Private passport | Current readiness returns passport metadata only. Preparation returns a one-time token to its preparer before independent approval, with no supported recipient delivery/retrieval contract. Token hash cannot recover the token. | Backend-approved recipient-bound delivery after independent approval; exact issuer/recipient/verifier permissions; pending-review retrieval; explicit expiry, supersession, loss/reissue and delivery-unknown semantics. Define how an authorized recipient obtains the credential without exposing it to another role. Until supplied, issuance/delivery is disabled in this frontend. No public record-ID link, token-hash surrogate, browser storage or fake delivery is used. |
| Production capture / genuine acceptance | Routed provider adapter is unavailable; status UI does not start or recover captures. | Approved provider/capture and recovery contract plus genuine independently inspected evidence. Local fixtures do not replace real-account acceptance. |

Disposition allowing replacement never restores earlier approvals or tokens. Workforce hold copy explicitly preserves historical consumed service/payroll evidence. Financial components, policies, schema, migration history, hosted settings, legal documents and agreement text were not changed by this patch.

## Preview and validation

The running role preview is bundled to reduce development-module overhead. To recreate it locally, run from the isolated checkout with its existing dependencies:

```sh
node node_modules/vite/bin/vite.js build --config tests/frontend/vite.config.mjs --outDir /tmp/lokd-frontend-finish-preview-dist
node node_modules/vite/bin/vite.js preview --config tests/frontend/vite.config.mjs --outDir /tmp/lokd-frontend-finish-preview-dist --host 127.0.0.1 --port 4181 --strictPort
node node_modules/vite/bin/vite.js --config tests/frontend/public-preview.config.mjs --host 127.0.0.1 --port 4178 --strictPort
LOKD_FRONTEND_BASE_URL=http://127.0.0.1:4181 node node_modules/@playwright/test/cli.js test --config tests/frontend/playwright.config.mjs
node node_modules/@playwright/test/cli.js test --config tests/journeys/playwright.config.mjs
```

Review `http://127.0.0.1:4181/ops/readiness?preview=1`, `/officer/readiness?preview=1`, and `/client?preview=1`. Preview links switch roles. `scenario=conflict` and `scenario=unavailable` demonstrate recovery. Synthetic fixture responses never call production, send messages or move money. The fixture server uses browser-only routing/auth adapters; it is not real-account acceptance and must not be deployed. The normal application does not import the preview fixture.

Final counts, logs, screenshots, source revision and patch are in the accompanying evidence report. Both headless-shell and full Chromium exhibited resource exhaustion on repeated navigation and some screenshot captures. Module request failures include ERR_INSUFFICIENT_RESOURCES; native browser crashes also occurred. Full Chromium with GPU disabled is used for the final focused checks, and screenshot evidence uses bounded viewports. The broader suite is not a clean pass. Earlier failed logs are retained, not counted as successful acceptance. Intake and workspace test output directories are now separate to prevent artifact cleanup collisions. Stop the public development preview before building.

## Next assignment

Central should review and apply the exact frontend patch to the combined candidate, resolve the five backend contracts above, then assign frontend integration of protected detail/audit/delivery responses and authenticated real-account QA. This local checkpoint is ready for code and UX review; it does not claim that the controlled pilot is ready to operate.

Final focused validation: 18 readiness browser tests pass, including direct section hashes and Back; six fresh-browser role/viewport preview checks pass without page errors or horizontal overflow; eight intake browser tests pass; five authentication/redirect unit tests and one production identity HTTP-boundary test pass. TypeScript and the final build pass. Changed-file lint has no errors and one pre-existing workspace logo img warning. The last broad 70-test run passed 62 and failed eight repeated route/public checks under the browser resource failure; it predates the two added section-history cases. Do not report that broad suite as green. No authenticated real-user, provider or private-delivery acceptance is claimed.
