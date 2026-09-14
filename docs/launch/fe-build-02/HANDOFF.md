# FE-BUILD-02 — frontend build audit checkpoint

Completed locally on 2026-09-14 for Central integration. Base `c358358d6ad1ad59ba2f8e39513928c343e5736b` (combined v69); branch `codex/fe-build-02`. Exact final commit, full changed-file list and binary integration patch are in the durable sibling `INTEGRATION.md` / `integration.patch` outside this source checkout. The checkout was cloned from the inspected clean combined tree, not an older frontend checkpoint. Central's checkout was not edited.

## Implemented

- Inventoried all 41 page routes, production tabs, authoritative APIs, legacy/demo branches, evidence and missing inputs in `ROUTE-COVERAGE.md` and `.csv`. Presence and private verification are production mounted; sandbox identity/test cycles remain explicitly test surfaces.
- Fixed a real finance-document contract mismatch: preparation/decision POST returns a receipt, not the Service workspace. The parent now refreshes its authoritative records instead of replacing them with that receipt and crashing. Document failures propagate to the document form without losing the Service data.
- Document GET failure/loading preserves drafts and previous records, disables decisions until refreshed and distinguishes unknown outcomes. Same-reference retries survive failed POSTs; a new preparation key is available only after confirmed preparation. Source changes retain notes but require renewed source acknowledgement. Independent approval requires an explicit valid submitter. Existing private links, correction lineage and as-issued/current financial status remain intact.
- Added role-appropriate Service section links and matching heading, with direct hash, active state, keyboard and Back behavior. They navigate existing surfaces and confer no authority.
- Preserved intake kind and identity/readiness selectors through signed-out return paths. Operations intake now respects its explicit kind selector. Query-dependent guards execute inside the rendered page tree; existing user/role guards remain unchanged.
- Rendered complete suspension audit records with readable original actor/reason/time and separate proven linked human actions; exact original JSON stays accessible. Service event history likewise retains all fields rather than only its note; service/presence times explicitly use SAST.
- Private passport links open in a separate tab so the original in-memory material survives. Draft navigation protection recognises links that leave the current tab open. Private delivery loading and read-only verifier failure/retry states are explicit; fragment tokens remain absent from query strings and browser storage.
- Kept the real framework Image component in fixtures; supplied its two missing build-time default flags in the standalone fixture config. Retained all existing assertions; enabled the established native-shared-memory option for the other local browser runners and configurable local preview ports.

Source references: `app/components/production-operations-panel.tsx`, `finance-document-controls.tsx`, `workspace-sections.tsx`, `hold-audit.tsx`, `identity-review-inspector.tsx`, `production-service-controls.tsx`, `private-passport-controls.tsx`, `private-passport-verifier.tsx`, `readiness-workspace.tsx`, `officer-presence-map.tsx`, `signup-portal.module.css`; six query-dependent page files are enumerated in the exact changed-file list.

## Locally verified

- Frontend Playwright: **130 passed, 0 failed, 0 skipped**, mobile 360×800 and desktop 1280×900; zero retries. Includes existing agreement wording/expiry, readiness/correction/hold/private-token, role tabs, large text, errors and uncertainty cases, plus 48 FE-BUILD-02 cases. Local synthetic API interception; real signed-out routes run through the local Vinext preview.
- Intake Playwright: **8 passed, 0 failed**, mobile/desktop application and enquiry flows with intercepted submissions.
- Dedicated finance browser script: **1 scripted journey passed**, including 360/390/1280 widths, amounts/SAST, historical paid/current reversed, correction references, private downloads and same-key retries. This is not an additional counted Playwright test suite.
- Selected Node contract/access tests: **25 passed, 0 failed, 0 skipped** across finance-documents-contract, production-identity-usable, production-identity-route, production-identity-review-pagination, clerk-access, public-demo-isolation and service-record-access. Executed actual named cases, not sandbox wrapper-only results.
- `tsc --noEmit`, global `npm run lint` (**0 errors / 0 warnings**), `npm run build` and `git diff --check`: pass. Production build ran after both local previews stopped. Build reports existing Node punycode deprecation and Vinext static route-classification limitations; neither is a lint warning or a build failure.
- Screenshots copied durably to sibling `screenshots/`; inspected mobile document/draft controls, readiness correction history and desktop complete service history. Browser acceptance includes overflow and keyboard checks; this does not establish assistive-technology or physical-device acceptance.

Logs, complete JSON reports, changed-file list and screenshot index are beside `INTEGRATION.md`. Earlier failed diagnostic logs are retained separately; `browser-final.log`/`.json` is the final 130-case result.

Reproduction in this isolated checkout (local only):

```sh
node node_modules/vite/bin/vite.js --config tests/frontend/vite.config.mjs --port 4193
node node_modules/vite/bin/vite.js --config tests/frontend/public-preview.config.mjs --host 127.0.0.1 --port 4192 --strictPort
LOKD_BROWSER_NATIVE_SHM=true LOKD_FRONTEND_BASE_URL=http://127.0.0.1:4193 LOKD_PUBLIC_BASE_URL=http://127.0.0.1:4192 node node_modules/@playwright/test/cli.js test --config tests/frontend/playwright.config.mjs
LOKD_BROWSER_NATIVE_SHM=true LOKD_PUBLIC_BASE_URL=http://127.0.0.1:4192 node node_modules/@playwright/test/cli.js test --config tests/journeys/playwright.config.mjs
LOKD_BROWSER_NATIVE_SHM=true LOKD_FRONTEND_BASE_URL=http://127.0.0.1:4193 node tests/finance-documents.browser.mjs
node --experimental-loader=./tests/cloudflare-loader.mjs --test --test-concurrency=1 tests/finance-documents-contract.test.mjs tests/production-identity-usable.test.mjs tests/production-identity-route.test.mjs tests/production-identity-review-pagination.test.mjs tests/clerk-access.test.mjs tests/public-demo-isolation.test.mjs tests/service-record-access.test.mjs
```

Run browser suites serially. Stop previews before the build. The optional manual `?preview=1` data is a limited synthetic fixture, not full contract acceptance; the automated fixture routes supply the complete document/review scenarios. No live credentials or environment files were copied into this checkout.

## Contracts and migration intent

**No migrations or SQL; no schema, shared API route, backend permission, financial rule, dependency version, runtime flag, hosting or credential change.** Existing legal text, both payment locks, live shift scan false, owner MFA exception and TNGO separation are preserved.

Existing contracts consumed:

- `/api/finance-documents` GET supplies `documents`, `sources`, `calendar`; POST returns a document/invoice receipt, not `ProductionOperationsPanel.State`. Preparation may return `documentId`/`issued:false` or `alreadyPrepared`; decision returns `documentId`, `issued`, `communicationsSent:false`. Source: `app/api/finance-documents/route.ts`, `app/lib/finance-documents.ts`. After a receipt, refresh `/api/production-operations` and the document GET. No notification is inferred or sent.
- `/api/production-identity` v1 supplies discovery/protected reviews/holds/deliveries. Hold attribution is authoritative; a system actor is never replaced by an assumed human. Delivery requests send only token hash and original request key. Source: `docs/launch/ID-USABLE-01-ENDPOINTS.md` and existing route.
- `/api/passport/verify` POST is a read-only token check. Stored status and current canonical result remain separate. No new token-distribution channel is introduced.

Local compatibility finding: installed Vinext `dist/entries/app-rsc-entry.js` route probe reads `searchParamsObject`, while `dist/server/app-page-head.js` returns `pageSearchParams`. Early query-dependent auth could redirect using empty selectors. The six page wrappers follow the existing sign-in pattern and defer guards into the actual render. No dependency patch was made. Keep the 12 mobile/desktop selector regression cases when upgrading Vinext.

## Remaining build gaps and exact inputs

1. **Identity owner → Central → frontend:** publish integrated VerifyNow production capture/input/upload and evidence contracts, approved consent text/version, validation/error codes, provider status, same-reference recovery and protected read/access rules. Provide browser origins/device requirements. Current Permissions-Policy denies camera/microphone and CSP constrains external origins; Central must review any scoped capture change. Sandbox scenarios cannot substitute for production integration.
2. **Finance owner → Central → frontend:** publish refund/dispute/reversal/credit-note endpoint/state contracts, eligibility/capability flags, source/version/request bindings, proposer/separate approver authority, reconciliation/unknown outcomes, canonical balances and immutable correction/private-document lineage. Then implement the corresponding UI against those contracts; do not infer refundable balance, successful payment or credit eligibility.
3. **Business/identity/finance owners:** exact approved legal/consent/retention and document layout changes (if any), approved entity/billing/tax/payroll sources and policies, genuine evidence/signers and approved private delivery procedure. Existing protected reference fields are usable but richer source selection/upload needs a published access contract. No substitute documents or specifications were invented.
4. **Central independent QA:** integrate the patch, preserve newer owner changes and independently exercise the combined local build. Genuine account/provider/physical-device acceptance requires separate authorisation and appropriate accounts/evidence; none was attempted here.

## External acceptance and stop

Externally accepted in this checkpoint: **none**. No deployment, hosted testing, real notifications, provider submissions, checkouts, transfers, FI-02 activation or pilot launch occurred. The exact patch is ready for Central review/integration. Next frontend assignment is contract-driven VerifyNow and refund/reversal/credit-note UI after Central integrates the backend contracts; Central retains integration and independent QA ownership.
