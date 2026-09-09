# LOKD implementation acceptance — 9 September 2026

Status: Version 41 is deployed, retaining Operations MFA enforcement and adding tested preparation/storage for versioned agreement receipts. No signing endpoint or preliminary Legal wording is published. The chronological receipts below retain earlier results. Production MFA is blocked by Clerk plan entitlements (AUTH-003); Google remains deferred (AUTH-001). Real account assignments, external-provider acceptance and executed legal agreements remain incomplete.

## Current decision — Google sign-in deferred, still required

**AUTH-001 — Google sign-in unavailable in production. OPEN; deferred by the user, not optional and not accepted.**

- Impact: Client, Officer and Operations users cannot use Google sign-in. Officer access is a particular concern. Email sign-in does not satisfy Google acceptance.
- Verified cause: Google is enabled in the development Clerk instance using shared development credentials; production has Google disabled and no Google OAuth Client ID or Client Secret configured.
- DNS update: Clerk now confirms DNS, SSL and mail verification complete. The earlier DNS-pending findings below describe the initial inspection and are superseded by this result.
- User decision: record this issue, return to Google later, and continue the remaining implementation/release work. Do not close or downgrade this issue because email sign-in works.
- Required action when resumed: configure LOKD's Google OAuth application and production callback, connect its credentials in Clerk, enable Google, and verify sign-in, account linking and role-correct destinations for all three portals.
- Acceptance: record successful Google journeys and denied cross-role access. Until then, report Google explicitly as unavailable and overall authentication acceptance as incomplete.

## Current deployment — explicitly approved and verified

- User authorization: “continue to deploy”. The prior approval rejection was resolved by this explicit publication instruction.
- Version 36 (source `58821642172f984b8b5f5b3376ee5052a138ab37`) deployed successfully on 9 September 2026 at 09:32:26 UTC.
- Deployment ID: `appgdep_6aa127989b688191b0cfe96842e90a03`; terminal status `succeeded`; applied environment revision **5**.
- Published URL: https://lokd-security.zenas-capetown.chatgpt.site
- Live Client `/client`, Officer `/officer` and Operations `/ops` now each return HTTP 307 to their own `/sign-in` route, preserving `/client`, `/officer` and `/ops` respectively as `return_to`. They no longer redirect to the old ChatGPT sign-in.
- `/sign-in` returns HTTP 200 HTML on all three portal hosts. The demo `/api/health/live` returns HTTP 200 JSON.
- These are live HTTP entry-route checks, not successful account sign-in or MFA acceptance. Google AUTH-001 remains required, deferred and open. Provider acceptance and financial settlement remain incomplete/locked.
- The published build passed 213 tests before deployment. This documentation update does not change the deployed application code.

## Initial reconciliation history (before the deployment above)

- The starting checkout, `962850c`, has exactly the same tracked file content as `0ac50b677d302d748fc3d29eebcbf42ba5bd3e2b`, the source recorded for Sites Version 35. The intervening commits preserve imported history.
- Sites reports the public LOKD project and current live URL `https://demo.lokd.co.za`; Version 35 was the latest saved version at inspection. A saved-version number alone is not proof of the currently executing deployment. Production logs report Worker script version `60c28113-22c4-4126-bc33-f6cc5355a327`; no deployment-to-source mapping was returned by the inspected tools.
- Direct health requests to demo, portal, officers and operations hosts returned Cloudflare HTTP 403; the inspected response was edge error 1010. These requests did not validate application health or browser login. This is not evidence that the application itself crashed.
- Clerk CLI 3.3.0 authenticates successfully. This checkout is now linked to the existing **LOKD Security** app `app_3IuH5PjmaRe1rmJAjwO0g6C6YQw`, not a newly created app. Both development and production instances exist.
- Production instance `ins_3IuqByfuozQZDguv7iJ3qPqd47b` has zero users. Email verification/code sign-in is configured; Google OAuth is disabled/unconfigured. MFA enrollment methods and mandatory MFA are currently disabled. No real Operations MFA journey has been accepted.
- Sites originally had only stage, live-scan and role-map variables. The existing production Clerk publishable key and secret have now been stored in Sites environment revision 5. The existing secret role map was preserved, not overwritten or exposed. These new values require deployment to take effect.
- Source now uses Clerk authentication with existing D1/R2 data and server-controlled account roles. README supersedes obsolete Supabase and ChatGPT authentication instructions. No Supabase dependency or active Supabase instruction was found in this checkout.
- At the initial inspection no live deployment had been performed. The explicitly approved Version 36 deployment above supersedes that status.

## Clerk domain setup history and remaining Google issue

The initial inspection returned `domain_pending`. After the registrar records were updated, Clerk confirmed DNS, SSL and mail complete. The verified CNAME configuration is:

| Host | Target |
| --- | --- |
| clerk.lokd.co.za | frontend-api.clerk.services |
| accounts.lokd.co.za | accounts.clerk.services |
| clkmail.lokd.co.za | mail.41o7yt86mrf7.clerk.services |
| clk._domainkey.lokd.co.za | dkim1.41o7yt86mrf7.clerk.services |
| clk2._domainkey.lokd.co.za | dkim2.41o7yt86mrf7.clerk.services |

The current task has no connected authoritative DNS management tool. [Clerk domain configuration](https://dashboard.clerk.com/apps/app_3IuH5PjmaRe1rmJAjwO0g6C6YQw/instances/ins_3IuqByfuozQZDguv7iJ3qPqd47b/domains) must show completion before production login acceptance. Google configuration is required for final authentication acceptance; the user has explicitly deferred this work under AUTH-001 above.

## Account journeys and permissions

| Journey | Implemented/tested locally | Still required for real acceptance |
| --- | --- | --- |
| Client | portal host returns to `/client`; server role maps to a client ID; cross-role and tenant data checks | Real assigned Clerk account, verified email, browser sign-in/out and session renewal |
| Officer | officers host returns to `/officer`; officer ID remains scoped; client/Operations actions denied | Real assigned Clerk account and complete browser journey |
| Operations | operations host returns to `/ops`; ordinary operator and owner labels differ; owner access does not bypass finance approval policies | Named operator accounts, approved role mapping, MFA enrollment and fresh step-up proof |
| New/unassigned account | Authentication alone grants no role; denied page offers another account | Real first-sign-in and support-assisted assignment |
| Privileged approvals | Tests reject unauthorized roles, expired MFA, maker self-approval and duplicate approvers; settlement stays locked | Connect real Clerk second-factor proof to authoritative operator controls; separate named maker/reviewer/finance users |

The real Clerk SDK is exercised with locally signed fixture JWTs. Valid signatures are accepted; expiry, a wrong signing key and an untrusted authorized party are rejected. User lookup is stubbed in this test, so it is not a Clerk service acceptance test. Forged incoming internal and former OpenAI identity headers are stripped at the Worker boundary. Only verified primary email addresses resolve role-map permissions. `ClerkProvider` remains mounted after login to refresh session cookies for existing same-origin API calls. No client-editable metadata is used for roles.

These choices follow Clerk's [backend request verification](https://clerk.com/docs/reference/backend/authenticate-request) and [React integration](https://clerk.com/docs/react/getting-started/quickstart) guidance. The real privileged-step-up path still needs [Clerk reverification](https://clerk.com/docs/guides/secure/reverification) acceptance; synthetic operator MFA timestamps are not that proof.

## iiDENTIFii onboarding acceptance

The user confirmed iiDENTIFii credentials are still pending. No external verification request was made. The provider remains disabled; the official public [integration page](https://iidentifii.com/integrations/iidentifii-api/) does not provide the account-specific callback contract needed to safely invent an adapter.

The local acceptance path now covers:

1. Applicant-controlled consent is required before starting a synthetic case. Public submissions remain prelaunch/consent-pending and outside the synthetic queue.
2. Processing can pass, enter manual review, reject or expire through Operations rehearsal controls. Rejected applicants cannot skip directly to verified or assessment-ready.
3. Rejection can enter manual review. Manual review can pass, reject or expire. Successful identity verification moves only to credentials review.
4. Expiry closes the corresponding pending operation. A retry creates a new case/operation; it no longer collides with the old fixed idempotency key. Completion joins the operation by its provider reference.
5. Verified decisions cannot be overwritten by a negative rehearsal action. Later eligibility changes belong in separate current evidence, Passport and assignment revalidation controls, preserving original identity evidence.
6. API tests verify blocked assessment/profile creation after rejection and disable rehearsal actions outside demo. Network-profile creation remains restricted and creates no employment engagement.
7. Existing Passport and assignment tests cover expired/revoked readiness, changed evidence, stale evidence tokens, T-24/T-2 revalidation, check-in restrictions, workforce/rest conflicts and atomic activation rollback.

Still unaccepted: real session creation, signed callback verification, provider event ordering/replay/timeout semantics, original evidence retention, manual reviewer decisions and re-verification of real applicants. Obtain the provider's sandbox credentials, endpoint/version, callback authentication contract and documented result/reason mapping. Then run actual pass, rejection, inconclusive/manual-review, abandonment, expiry, duplicate/late callback, outage and recovery cases. Neither a synthetic pass nor identity verification alone may activate paid work.

## Paystack: supported versus accepted

Paystack documents collections and transfers, including transfers for South African businesses. Merchant availability must still be confirmed for LOKD. See [Transfers](https://paystack.com/docs/transfers/) and [transfer lifecycle](https://paystack.com/docs/transfers/how-transfers-work/). A merchant payout and a payment to an officer are different flows.

For collections, the required provider acceptance is server-initialized checkout with a unique internal reference, followed by verified status/reference/amount/currency matching. Browser return URLs are not evidence of payment. Validate webhook origin before processing and make replay handling idempotent. Paystack documents HMAC-SHA512 signatures and transaction verification in [Webhooks](https://paystack.com/docs/payments/webhooks/) and [Verify payments](https://paystack.com/docs/payments/verify-payments/).

| Flow | Evidence obtained | Not yet accepted |
| --- | --- | --- |
| Client collection | Internal synthetic order and canonical transitions; one replay-safe projected success | Paystack test checkout, failure/abandonment and signed callbacks |
| Funding/reconciliation | Exact full funding, zero credit, evidence-backed reconciliation and one invoice allocation; underfunding/mismatch controls in tests | Paystack transaction/settlement evidence, fees, bank receipt matching, refunds/disputes and settlement timing |
| Officer payment preparation | Approved service timesheet → gross-to-net calculation → separate first/second approvals → export-ready | Real beneficiary/account validation, merchant transfer enablement, balance, transfer initiation/status and bank receipt |
| Transfer recovery | Existing settlement lock prevents premature payment | Failure/reversal/timeout/unknown-status recovery, verify-before-retry and duplicate-transfer prevention against Paystack |

No Paystack HTTP adapter is connected and no Paystack API request was tested in this task. Internal tests are **not tested Paystack integration** and are **not live financial acceptance**. Keep settlement, real payslips and disbursement locked until provider tests, payroll controls and a separately authorized live acceptance cycle succeed. Credentials are pending; no money was moved.

## Controlled operating cycle and agreement placement

`tests/unified-predeployment.test.mjs` now follows one linked synthetic booking through:

`client booking → risk approval → full funding reconciliation → officer offer/acceptance → roster/shift creation → arrival check → check-in → completion → client sign-off → Operations timesheet approval → payroll calculation → independent payroll review → independent finance approval → export-ready → settlement blocked`

The test verifies duplicate booking protection, changed-command rejection, the funding record, connected assignments and service evidence, payroll source linkage, calculation replay, maker/checker separation, a null settlement reference and zero disbursement batches. The service portion uses a deterministic sample date; MFA checks restore real wall time because SQLite independently evaluates timestamp freshness. This is an in-memory operating rehearsal, not a live booking, signed contract or payment.

Agreement signing belongs after approved identity/client scope and before commitments/activation:

- Client: validate legal entity and authorized signatory, approve the risk plan and final service order/price, sign the versioned MSA and service order/SLA, then collect and reconcile required advance funds before releasing work.
- Officer: verify identity and credentials, approve the employer/workforce route, sign the employment agreement and payroll consent, then complete required training/induction and eligibility checks before activation.
- Operations: record maker/checker authority and MFA; signing a document does not grant financial authority or override funding and deployment gates.

Existing onboarding tests separately validate four watermarked template/envelope rehearsals. **The signing rehearsal is not an enforced gate in the booking cycle above.** Final legal bodies, signatory mandates, production signature evidence and a binding between the exact signed order version and the booking/activation command remain required. Do not describe the current demo envelope as a legally executed agreement.

## Recovery gaps and next acceptance gates

| Finding | Result / next action |
| --- | --- |
| Identity expiry retry reused a fixed operation key | Fixed: each new case gets a distinct operation key and provider-reference pairing. |
| Rejection/manual review/expiry missing from rehearsal controls | Fixed and tested; useful workflow errors now preserve their HTTP status. |
| Fast enquiry triage/close could fail the monotonic timestamp guard | Fixed and regression-tested at one clock instant. |
| Old synthetic evidence dates can prevent new sample bookings from matching | Test dates made deterministic. Product evidence is not silently renewed; Operations must review actual expired evidence. |
| Real Clerk sign-in and privileged MFA | DNS/SSL/mail now complete. Real accounts, role assignment, step-up acceptance and deferred Google issue AUTH-001 remain open. |
| Live-site probe denied at Cloudflare edge | Resolved for HTTP probes using a standard browser User-Agent. Deployed Clerk entry routes now verified; full account journeys still pending. |
| Provider credentials and callback contracts | User awaiting iiDENTIFii and Paystack. No provider acceptance claimed. |
| Payment unknown outcomes, refunds/reversals and officer-transfer recovery | Must be tested with provider references before enabling live rails. |
| Signed order linkage to booking activation | Not wired into the combined rehearsal; require authoritative signed version/evidence before production activation. |
| Full-repository lint baseline | Existing `react-hooks/set-state-in-effect` error in `specialist-operations-control.tsx`; changed-source lint passes. Existing image warnings also remain. |

## Validation record

Final `npm test`: **213 passed, 0 failed**, including the production Worker build. TypeScript and changed-source lint also pass. Checks include the Worker production build, TypeScript, changed-source lint, Clerk verifier tests, role/tenant isolation, identity outcomes, all SQLite migrations, onboarding, assignment eligibility, financial controls and the extended operating cycle. No provider callback, browser login or real money movement is implied by those checks.

## Automated account workflow follow-up

Added `npm run test:accounts`: temporary development Clerk identities, automated email-code sign-in, portal return destinations, cross-role page/API denials, owner/unassigned policies, and sign-out. No real inboxes or production test users are needed. Six browser tests passed; full regression suite passed 214 tests. See `docs/AUTOMATED_ACCOUNT_TESTING.md` for operation and acceptance limits.

**AUTH-002 — Clerk blocked by Content-Security-Policy:** browser testing reproduced the blocked external script and the same header was confirmed on the live Operations sign-in page. The source correction permits only the appropriate Clerk frontend plus documented authentication resources, with a regression check excluding the development frontend from release headers. This supersedes interpreting a successful HTTP response from `/sign-in` as proof that its sign-in form works. Deployment/live browser verification of this correction is recorded separately below when complete.

AUTH-001 Google remains required, deferred and open. Real Operations MFA and real production account role assignments remain incomplete. These authentication tests do not verify portal data completeness, iiDENTIFii/Paystack acceptance, actual email delivery, or agreement execution.

### Version 37 deployment and live browser verification

Version 37 (`appgprj_6a88a08505548191b266e9b711562ae3~appgver_861e8b5bb220819197ba58170d210e04`) deployed successfully at 2026-09-09 10:46:33 UTC, deployment `appgdep_6aa138f94adc8191bb6c7caa9d541bf4`, source `a0c5bd547bc2e2a01e98a2ea8ec8c687a980a7bc`, existing environment revision 5.

A real headless browser visited `/client`, `/officer`, and `/ops` on their respective production portal domains. All three redirected anonymous visitors to sign-in, displayed the correct role heading and visible email-address form, and reported Clerk loaded. No production accounts were created and no verification emails were requested. AUTH-002 is fixed and verified deployed. This is form-rendering and anonymous-routing acceptance, not a claim of completed production account/MFA journeys.

The final single-command development account run passed all six browser tests in 33 seconds. Clerk development-user count was verified as zero afterward. Release build and 214 regression tests passed; TypeScript and changed-source lint passed. The existing unrelated full-lint issue remains as previously recorded.

## PSiRA workflow — version 38

An authorised partner-supplied number was checked twice using PSiRA’s official number-only form. One matching registration row was returned; this establishes a successful registration lookup, not that the registration belongs to the onboarding subject. Private dated evidence and the returned identity are retained in ignored restricted workspace files, excluded from the release.

Deployed account-bound Officer submission, Operations review, immutable dated evidence, separate identity decisions, due-date handling and recheck resets. Unavailable/ambiguous/unchecked/stale cases remain unverified. The repeatable browser observer does not grant approval or represent a documented public API. Current operational eligibility gates remain in place.

Version 38 succeeded at 2026-09-09T13:11:26.567788Z using source `965669b98effb87e01592451b95be1148a36f653`, deployment `appgdep_6aa15aedbd408191a9dcfbe99e71cec8`, environment revision 5. Validation: 216 regression tests, seven browser journeys, TypeScript and changed-source lint passed. Live new-page sign-in redirects and API rejection of anonymous/forged requests passed for both portals. A Clerk POST-body preservation defect found during browser testing was fixed without changing identity or role policy.

Working method and acceptance limits: `docs/PSIRA_VERIFICATION_WORKFLOW.md`. Resume checkpoint: `docs/checkpoints/PSIRA_2026-09-09.md`. Production account linkage/identity match and provider failure examples remain outstanding. AUTH-001 Google and Operations MFA retain their previously recorded open status.

## Current completion list after mandatory PSiRA

- Source/deployment/Clerk reconciliation: completed through deployed v39; obsolete Supabase instructions superseded.
- Account automation: temporary development users and role-correct portal tests implemented; real production role assignments remain outstanding. Operations MFA now has a signed-session enforcement path and security screen; production enrollment dry-run rejected by plan entitlements, AUTH-003. See `OPERATIONS_MFA_ACCEPTANCE_2026-09-09.md`.
- Mandatory PSiRA: v39 deployed; registered work applicants require reviewed registration/identity/grade/certificate evidence; training and unregistered intake stay separate. 221 regression tests and eight browser journeys passed for that release.
- iiDENTIFii: internal acceptance/failure/retry/manual-review paths tested; real adapter/acceptance awaits credentials and callback contract.
- Paystack: internal collection/reconciliation/payment-preparation controls tested; no adapter or provider acceptance claimed, credentials pending and live money movement locked.
- Operating cycle: linked synthetic booking-to-service-to-export cycle and recovery checks passed. Signing is positioned in the flow; exact signed agreement enforcement/execution remains a production acceptance gap pending approved legal documents/signature evidence.
- Legal document handover: prepared `LEGAL_DOCUMENT_HANDOVER_2026-09-09.md` for central collection. No external message or legal publication sent.

The task list is not marked fully accepted while these external and real-account gates remain open.

## Operations MFA release — version 40

User explicitly approved the source upload and LOKD publication. Version 40 deployed successfully at 2026-09-09T14:13:06.760472Z, source `a7ae90d11540261cf4dc7f89e2916c41d0124db0`, deployment `appgdep_6aa1696062e48191a15f8a1ce0408a37`, environment revision 5. The source-upload approval blocker is resolved. Existing validation: 224 regression tests and nine browser journeys, including real development authenticator enrollment/verification. Production enrollment remains blocked by Clerk subscription entitlements under AUTH-003. See `checkpoints/OPERATIONS_MFA_2026-09-09.md` for the release receipt.

## START-ENGINES milestone — version 41

Production MFA entitlement denial reconfirmed, billed plan unavailable through the exposed account metadata; no upgrade assumed. Four Legal v0.1 drafts reviewed with factual corrections and input hashes. Exact-version agreement/consent preparation rejects drafts, changed wording/order scope and missing actor/representative proof; database receipts are append-only. Production signing remains unenabled. Full build and 228 tests passed; 20-check runnable acceptance checklist passed. Deployed at 2026-09-09T17:20:44.077120Z; see `checkpoints/START_ENGINES_LOKD_2026-09-09.md`.
