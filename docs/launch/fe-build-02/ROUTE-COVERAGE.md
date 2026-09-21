# FE-BUILD-02 route-by-route build coverage

Base: `c358358d6ad1ad59ba2f8e39513928c343e5736b`. All 41 `app/**/page.tsx` routes are accounted for. This supersedes older inventory descriptions of `/verify` as a production placeholder and of private delivery/audit as missing. Exact source references and per-route state/input detail are also in `ROUTE-COVERAGE.csv`. Local evidence means offline/synthetic evidence, not genuine account or provider acceptance.

| Route | Mounted production surface | Authoritative interface | Local evidence | Source |
|---|---|---|---|---|
| /about | Public information, exact-path primary navigation and footer | None: information and destination links | navigation.spec.mjs: public routes | `app/about/page.tsx` |
| /armed-security | Public information, exact-path primary navigation and footer | None: information and destination links | navigation.spec.mjs: public routes | `app/armed-security/page.tsx` |
| /client/agreements | Exact approved legal documents, bound signer envelopes, receipts and immutable history | /api/agreements/production GET/POST | navigation.spec.mjs: agreement expiry, exact wording/scope, 401/403/409/423/503 draft recovery | `app/client/agreements/page.tsx` |
| /client | Linked intake, correction, review, historical events and explicitly test agreements | /api/signup GET/POST; /api/agreements (test); Officer /api/presence | navigation.spec.mjs + build-audit.spec.mjs redirects | `app/client/page.tsx` |
| /client/service | Service and payment sections, existing policy-gated finance, private documents | /api/production-operations GET/POST + /api/payment-execution + /api/payment-recovery + /api/finance-documents | navigation.spec.mjs + build-audit.spec.mjs + finance-documents.browser.mjs | `app/client/service/page.tsx` |
| /client/test-cycle | Production-mounted but explicitly simulated cycle | /api/test-cycle GET/POST | navigation.spec.mjs: all role routes | `app/client/test-cycle/page.tsx` |
| /clients | Public information, exact-path primary navigation and footer | None: information and destination links | navigation.spec.mjs: public routes | `app/clients/page.tsx` |
| /compliance | Public information, exact-path primary navigation and footer | None: information and destination links | navigation.spec.mjs: public routes | `app/compliance/page.tsx` |
| /contact | Enquiry / application wizard | /api/enquiries POST | journeys/mobile.spec.mjs (8 cases) | `app/contact/page.tsx` |
| /industries | Public information, exact-path primary navigation and footer | None: information and destination links | navigation.spec.mjs: public routes | `app/industries/page.tsx` |
| /join | Enquiry / application wizard | /api/applications POST | journeys/mobile.spec.mjs (8 cases) | `app/join/page.tsx` |
| /locations/johannesburg | Public information, exact-path primary navigation and footer | None: information and destination links | navigation.spec.mjs: public routes | `app/locations/johannesburg/page.tsx` |
| /officer/agreements | Exact approved legal documents, bound signer envelopes, receipts and immutable history | /api/agreements/production GET/POST | navigation.spec.mjs: agreement expiry, exact wording/scope, 401/403/409/423/503 draft recovery | `app/officer/agreements/page.tsx` |
| /officer/identity | Mounted sandbox identity and test enrolment; production readiness is separate | /api/identity GET/POST; /api/enrolment GET/POST | navigation.spec.mjs + build-audit.spec.mjs redirects | `app/officer/identity/page.tsx` |
| /officer | Linked intake, correction, review, historical events and explicitly test agreements | /api/signup GET/POST; /api/agreements (test); Officer /api/presence | navigation.spec.mjs + build-audit.spec.mjs redirects | `app/officer/page.tsx` |
| /officer/psira | Officer declaration or protected Operations registration/person review | /api/psira GET/POST | navigation.spec.mjs: Officer/Operations PSiRA recovery | `app/officer/psira/page.tsx` |
| /officer/readiness | Case discovery, protected review, readiness, corrections, disposition, hold audit, private delivery | /api/production-identity GET/POST (existing v1 contract) | readiness.spec.mjs + private-passport.spec.mjs + build-audit.spec.mjs redirects | `app/officer/readiness/page.tsx` |
| /officer/service | Service and payment sections, existing policy-gated finance, private documents | /api/production-operations GET/POST + /api/payment-execution + /api/payment-recovery + /api/finance-documents | navigation.spec.mjs + build-audit.spec.mjs + finance-documents.browser.mjs | `app/officer/service/page.tsx` |
| /officer/test-cycle | Production-mounted but explicitly simulated cycle | /api/test-cycle GET/POST | navigation.spec.mjs: all role routes | `app/officer/test-cycle/page.tsx` |
| /officers | Public information, exact-path primary navigation and footer | None: information and destination links | navigation.spec.mjs: public routes | `app/officers/page.tsx` |
| /operations | Redirect to /ops | None | build-audit.spec.mjs: canonical signed-out destination | `app/operations/page.tsx` |
| /ops/agreements | Exact approved legal documents, bound signer envelopes, receipts and immutable history | /api/agreements/production GET/POST | navigation.spec.mjs: agreement expiry, exact wording/scope, 401/403/409/423/503 draft recovery | `app/ops/agreements/page.tsx` |
| /ops/identity | Mounted sandbox identity and test enrolment; production readiness is separate | /api/identity GET/POST; /api/enrolment GET/POST | navigation.spec.mjs + build-audit.spec.mjs redirects | `app/ops/identity/page.tsx` |
| /ops/intake | Linked intake, correction, review, historical events and explicitly test agreements | /api/signup GET/POST; /api/agreements (test); Officer /api/presence | navigation.spec.mjs + build-audit.spec.mjs redirects | `app/ops/intake/page.tsx` |
| /ops | Linked intake, correction, review, historical events and explicitly test agreements | /api/signup GET/POST; /api/agreements (test); Officer /api/presence | navigation.spec.mjs + build-audit.spec.mjs redirects | `app/ops/page.tsx` |
| /ops/psira | Officer declaration or protected Operations registration/person review | /api/psira GET/POST | navigation.spec.mjs: Officer/Operations PSiRA recovery | `app/ops/psira/page.tsx` |
| /ops/readiness | Case discovery, protected review, readiness, corrections, disposition, hold audit, private delivery | /api/production-identity GET/POST (existing v1 contract) | readiness.spec.mjs + private-passport.spec.mjs + build-audit.spec.mjs redirects | `app/ops/readiness/page.tsx` |
| /ops/security | Operations account security | /api/operations/security GET + existing Clerk account UI | navigation.spec.mjs: Operations route; existing access regression | `app/ops/security/page.tsx` |
| /ops/service | Service and payment sections, existing policy-gated finance, private documents | /api/production-operations GET/POST + /api/payment-execution + /api/payment-recovery + /api/finance-documents | navigation.spec.mjs + build-audit.spec.mjs + finance-documents.browser.mjs | `app/ops/service/page.tsx` |
| /ops/test-cycle | Production-mounted but explicitly simulated cycle | /api/test-cycle GET/POST | navigation.spec.mjs: all role routes | `app/ops/test-cycle/page.tsx` |
| / | Public landing plus consented approximate presence | /api/presence GET | navigation.spec.mjs: public routes | `app/page.tsx` |
| /payments/paystack/test/callback | Test return notice and Officer/Client destinations | None: informational return page | build-audit.spec.mjs: callback readable/no submission | `app/payments/paystack/test/callback/page.tsx` |
| /portal | Redirect to /client | None | build-audit.spec.mjs: canonical signed-out destination | `app/portal/page.tsx` |
| /privacy | Public information, exact-path primary navigation and footer | None: information and destination links | navigation.spec.mjs: public routes | `app/privacy/page.tsx` |
| /security-services | Public information, exact-path primary navigation and footer | None: information and destination links | navigation.spec.mjs: public routes | `app/security-services/page.tsx` |
| /sign-in | Existing sign-in/sign-out component; configuration fallback otherwise | Existing Clerk SDK only when configured | build-audit.spec.mjs: signed-out destinations / public sign-out; clerk-access.test.mjs | `app/sign-in/page.tsx` |
| /sign-out | Existing sign-in/sign-out component; configuration fallback otherwise | Existing Clerk SDK only when configured | build-audit.spec.mjs: signed-out destinations / public sign-out; clerk-access.test.mjs | `app/sign-out/page.tsx` |
| /signup | Linked intake, correction, review, historical events and explicitly test agreements | /api/signup GET/POST; /api/agreements (test); Officer /api/presence | navigation.spec.mjs + build-audit.spec.mjs redirects | `app/signup/page.tsx` |
| /training | Public information, exact-path primary navigation and footer | None: information and destination links | navigation.spec.mjs: public routes | `app/training/page.tsx` |
| /verify | PrivatePassportVerifier, not the old demo PassportView | /api/passport/verify POST (read only) | private-passport.spec.mjs + build-audit.spec.mjs | `app/verify/page.tsx` |
| /vip-protection | Public information, exact-path primary navigation and footer | None: information and destination links | navigation.spec.mjs: public routes | `app/vip-protection/page.tsx` |

## Service-page section coverage

The following are anchors on the existing role Service page, not new API routes or financial states. The current main navigation stays Service & payments; secondary section selection tracks direct hashes, keyboard activation and browser Back. Restricted controls still depend on returned policy access/server guards.

| Anchor / section | Audience | Existing contract / behavior |
|---|---|---|
| service-overview — Service readiness | All, scoped records | Roster/approval/shift records; Operations evaluation/preparation; independent activation; Officer scan remains server gated |
| schedule — Availability & schedule | Officer / Operations | Existing availability, outside work and schedule declarations |
| service-records — Service records | All, scoped actions | Attendance, confirmation/dispute and independent pay review; SAST display plus complete original event details |
| collections — Collections & settlement | Client / Operations | Existing collection initialization/recovery, funding and settlement; original references survive uncertainty |
| orders — Service orders | All, scoped actions | Approved pricing/order setup; no new prices or commercial terms |
| payroll — Payroll | Officer / Operations | Existing prepared/reviewed/exported calculations; no payment claim inferred from export |
| finance — Finance controls | Operations; returned permission controls | Existing employee/company instructions, destinations, reserves, releases, reconciliation and recovery; both live locks unchanged |
| evidence — Evidence & policies | Operations; existing authority | Workforce/site/client reviews and payroll policy; no fabricated sources or authority |
| documents — Private documents | Exact participant / authorised Operations | Private payslip/invoice/remittance HTML/CSV, issue/current-state separation, correction versions, source-bound drafts; no notification sent |
| operators — Operator access | Server owner flag only | Existing role grants/limits; no Clerk login or portal role created by navigation |

## Other tabs, forms and history

- Public header: seven exact destinations (Services, Armed, VIP, Industries, Clients, Officers, About), visible on mobile; footer covers training, contact, compliance, privacy and Johannesburg. Unchanged approved commercial/privacy text is not evidence of new owner/provider acceptance.
- Intake: Officer applications / Client enquiries use explicit `kind` selectors; links do not grant role access. Officer presence is actually production-mounted, consented and server gated, not a demo map. Its synthetic signal remains private and cannot appear in public aggregation.
- Readiness: Identity & officer review / Readiness & choices / Corrections & holds / Private passport. Protected queues and complete hold audit retain pagination and exact raw records. Human attribution is rendered only from direct/linked provenance. Advanced references remain available for approved-source work; they are not themselves evidence.
- Agreements: Operations draft/approve/withdraw and bound delivery; participant exact wording/scope/signature and cancellation; unchanged legal content and immutable receipts. Cancellation is governed by the existing backend, not a new frontend policy.
- Test surfaces: sandbox identity, enrolment, test agreements and Test cycle are still mounted, explicitly test-labelled and incapable of proving production identity/payment/work acceptance.

## Legacy/demo-only components

`ClientApp`, `OfficerApp`, `OperationsApp`, `WorkspaceView`, `PassportView` and their old booking/offers/earnings/readiness, onboarding and specialist dashboard children are selected through the demo branches in `app/client/page.tsx`, `app/officer/page.tsx`, `app/ops/page.tsx`, their layouts and `app/verify/page.tsx`. They were not relabelled or promoted to production. Helpers such as `platform-readiness`, `portal-specialist-packs`, `portal-onboarding-summary` and `specialist-operations-control` belong to that legacy graph. The separate `PilotFeedback` component is mounted by `app/layout.tsx` only for an authenticated user when `pilotStage() === "demo"`; its `/api/feedback` submission is not a production pilot journey. Backend existence alone does not make their tabs production-mounted. The separate `tests/frontend` app uses fixture routing/auth adapters and is not deployable product UI.

## Build dependencies that remain visible

1. VerifyNow capture, approved consent text/version, accepted input/evidence/upload contracts, provider status and same-reference recovery behavior: identity owner supplies the authoritative contract; frontend integration follows Central's merge. Do not reuse sandbox scenarios as live inputs. Current Permissions-Policy denies camera/microphone; any required capture permission or provider origin must be specifically reviewed by Central, not bypassed in UI.
2. Refund/dispute/reversal/credit-note contracts: finance owner must publish exact states, eligibility/capability flags, request/source/version bindings, independent proposal/approval/reconciliation outcomes, correction lineage and private document endpoints. The frontend does not infer credit, refundable balance, paid status, tax or release rules. Existing unsupported states remain held.
3. Approved legal/commercial/document wording and layout, provider/consent/retention rules, billing identities and policies, genuine signers/evidence and delivery procedure remain external inputs. No new wording was invented.
4. Existing forms sometimes require protected reference IDs. They are functional against the current contract; automatic source upload/inspection, richer searchable source pickers and new provider UI require explicit backend contracts, not invented URLs or new state.
5. Full real-account/provider/device acceptance is deliberately unperformed. No live scan, payment locks, owner MFA exception, hosted settings or TNGO resources were changed.
