# LOKD implementation acceptance — 9 September 2026

Status: Clerk implementation and synthetic operating acceptance prepared; production login and external-provider acceptance remain incomplete. This work belongs to the implementation task. No health-monitor automation was changed.

## Source, deployment and actual configuration

- The starting checkout, `962850c`, has exactly the same tracked file content as `0ac50b677d302d748fc3d29eebcbf42ba5bd3e2b`, the source recorded for Sites Version 35. The intervening commits preserve imported history.
- Sites reports the public LOKD project and current live URL `https://demo.lokd.co.za`; Version 35 was the latest saved version at inspection. A saved-version number alone is not proof of the currently executing deployment. Production logs report Worker script version `60c28113-22c4-4126-bc33-f6cc5355a327`; no deployment-to-source mapping was returned by the inspected tools.
- Direct health requests to demo, portal, officers and operations hosts returned Cloudflare HTTP 403; the inspected response was edge error 1010. These requests did not validate application health or browser login. This is not evidence that the application itself crashed.
- Clerk CLI 3.3.0 authenticates successfully. This checkout is now linked to the existing **LOKD Security** app `app_3IuH5PjmaRe1rmJAjwO0g6C6YQw`, not a newly created app. Both development and production instances exist.
- Production instance `ins_3IuqByfuozQZDguv7iJ3qPqd47b` has zero users. Email verification/code sign-in is configured; Google OAuth is disabled/unconfigured. MFA enrollment methods and mandatory MFA are currently disabled. No real Operations MFA journey has been accepted.
- Sites originally had only stage, live-scan and role-map variables. The existing production Clerk publishable key and secret have now been stored in Sites environment revision 5. The existing secret role map was preserved, not overwritten or exposed. These new values require deployment to take effect.
- Source now uses Clerk authentication with existing D1/R2 data and server-controlled account roles. README supersedes obsolete Supabase and ChatGPT authentication instructions. No Supabase dependency or active Supabase instruction was found in this checkout.
- No live deployment was performed as part of this acceptance record. Do not interpret code, saved environment values or synthetic tests as an active Clerk rollout.

## Clerk production blockers

Clerk still returns `domain_pending`, with DNS, SSL and mail checks pending. Confirm these exact CNAME records in the authoritative DNS service, then re-run Clerk deployment status:

| Host | Target |
| --- | --- |
| clerk.lokd.co.za | frontend-api.clerk.services |
| accounts.lokd.co.za | accounts.clerk.services |
| clkmail.lokd.co.za | mail.41o7yt86mrf7.clerk.services |
| clk._domainkey.lokd.co.za | dkim1.41o7yt86mrf7.clerk.services |
| clk2._domainkey.lokd.co.za | dkim2.41o7yt86mrf7.clerk.services |

The current task has no connected authoritative DNS management tool. [Clerk domain configuration](https://dashboard.clerk.com/apps/app_3IuH5PjmaRe1rmJAjwO0g6C6YQw/instances/ins_3IuqByfuozQZDguv7iJ3qPqd47b/domains) must show completion before production login acceptance. Google configuration is required only if that login method is to be enabled.

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
| Real Clerk sign-in and privileged MFA | Pending DNS/SSL/mail completion, real accounts, role assignment and step-up acceptance. |
| Live-site probe denied at Cloudflare edge | Resolve the legitimate testing/access path, then verify all portal journeys against the executing deployment. |
| Provider credentials and callback contracts | User awaiting iiDENTIFii and Paystack. No provider acceptance claimed. |
| Payment unknown outcomes, refunds/reversals and officer-transfer recovery | Must be tested with provider references before enabling live rails. |
| Signed order linkage to booking activation | Not wired into the combined rehearsal; require authoritative signed version/evidence before production activation. |
| Full-repository lint baseline | Existing `react-hooks/set-state-in-effect` error in `specialist-operations-control.tsx`; changed-source lint passes. Existing image warnings also remain. |

## Validation record

Final `npm test`: **213 passed, 0 failed**, including the production Worker build. TypeScript and changed-source lint also pass. Checks include the Worker production build, TypeScript, changed-source lint, Clerk verifier tests, role/tenant isolation, identity outcomes, all SQLite migrations, onboarding, assignment eligibility, financial controls and the extended operating cycle. No provider callback, browser login or real money movement is implied by those checks.
