# Frontend checkpoint: production route and tab inventory

Baseline: `14448dd15fa80fc19a3f2052462ae566ab35a2fd` (v65), plus the five Central Command component fixes and launch documents captured separately in `3c5516c`. This inventory follows mounted route imports and `pilotStage()`, not historical dashboard screenshots. No endpoint, permission, financial rule, schema or hosted setting changes are part of this checkpoint.

## Public routes

All public marketing pages use the existing public shell except the dedicated intake/privacy/auth/status surfaces below. Header links now remain available at 360px and at desktop widths. Only an exact destination receives `aria-current="page"`. Child information pages do not incorrectly announce their parent as the current page. Logo goes home; footer provides all service/company/workspace destinations. Links retain production custom domains.

| Route | Audience / purpose | Navigation / next destination | Empty or gated state |
|---|---|---|---|
| `/` | Public entry | Contact, Join, Client / Officer sign-in | Applications open; approved agreement signing available when delivered; sandbox identity and gated live payments distinguished |
| `/security-services` | Public service overview | Armed, VIP, Contact, Client guide | Assessment and approvals required |
| `/armed-security` | Armed service information | Contact | No instant deployment promise |
| `/vip-protection` | VIP service information | Contact | Assessment and specialist readiness required |
| `/industries` | Site/industry information | Contact / services | Assessed scope |
| `/locations/johannesburg` | Launch geography | Contact | Location does not imply acceptance |
| `/clients` | Client guide | Contact / Client portal | Funding and service approvals still apply |
| `/officers` | Officer guide | Join / Officer portal | Application does not approve work |
| `/training` | Separate training pathway | `/join?path=training` | No invented training packages or R350 training charge |
| `/compliance` | Compliance/control information | Contact / company navigation | Required checks remain explicit |
| `/about` | Company/product information | Contact | Existing commercial text retained |
| `/contact` | Real client enquiry form | Receipt → Client portal or guide | Failed request preserves inputs; receipt is not a contract or payment demand |
| `/join` | Registered / unregistered / training intake | Step navigation; receipt → Officer portal / home | Focused validation, reference on success, no work approval |
| `/privacy` | Privacy notice | Existing home/return links | Legal notice unchanged |
| `/sign-in` | Account sign-in on current host | Existing safe `return_to` routing | Configuration status if Clerk unavailable |
| `/sign-out` | Sign-out | Existing auth routing | No changes |
| `/verify` | Public verification status | Home | No live Passport verification; historical PassportView only in demo |
| `/payments/paystack/test/callback` | Test checkout return | Officer / Client accounts | Callback never proves paid status |

## Account routes and top navigation

Layout-level `WorkspaceShell` wraps production routes; demo layouts retain their historical applications. Every production page has the same role-labelled header, sign-out, visible focus and skip-to-content control. Two-column mobile links wrap instead of disappearing or forcing horizontal scrolling. Detail pages keep existing account-back links. `Service & payments` names the existing combined page, without inventing a separate financial destination.

| Audience | Label / destination | Active state and direct link | Content / empty state |
|---|---|---|---|
| Client | My submission `/client` | Exact path; `/signup` alias also active | Linked enquiry, correction, withdrawal, history; no submission → same-email guidance and Contact |
| Officer | My submission `/officer` | Exact path; `/signup` alias also active | Application, PSiRA/identity case links, test documents, presence boundary; no submission → Join |
| Operations | Intake review `/ops` or `/ops/intake` | Both paths select Intake review | Officer applications and client enquiries; no records → queue explanation |
| Operations | Officer applications `/ops/intake?kind=officer` | Intake subnavigation exact kind | Distinct review list; selection survives reload |
| Operations | Client enquiries `/ops/intake?kind=client` | Intake subnavigation exact kind | Distinct review list; selection survives reload |
| All three | Agreements `/{client,officer,ops}/agreements` | Exact path | ProductionSigningPanel; no delivered approved agreements is explicit; wording/scope/receipt audit details preserved |
| All three | Service & payments `/{client,officer,ops}/service` | Exact path | ProductionOperationsPanel, role-specific sections below; no roster explains absence |
| Officer / Operations | PSiRA checks `/{officer,ops}/psira` | Exact path | Registration lookup and person match remain separate; no reviews explains queue; Officer pathway form retained |
| Officer / Operations | Identity · sandbox `/{officer,ops}/identity?caseId=…` | Contextual current-page item preserves case query | Enter from linked application; missing case now explains how to select one; synthetic-only checks, test enrolment and reconciliation history |
| All three | Test cycle · simulated `/{client,officer,ops}/test-cycle` | Exact path | Synthetic booking-to-payment cycle; empty state explicitly test-only |
| Operations | Account security `/ops/security` | Exact path | Existing MFA-owner exception and assigned permission explanation unchanged |

`/portal` redirects to `/client`; `/operations` redirects to `/ops`. `/signup?kind=client` selects client intake unless the host fixes the role; default is Officer. It now has the same shared shell. Custom-host root redirects and role/API restrictions remain unchanged. Identity and agreement authorization still occurs in existing guards, not in this navigation.

### Existing Service & payments sections (no new rules)

| Section | Mounted audience / additional existing limits | Zero-record behavior |
|---|---|---|
| Roster and shift readiness | Client, Officer, Operations; linked records only | No production roster records |
| Activation evaluation / independent approval | Operations only | No pending approval cards |
| Availability and outside work | Officer, Operations | Existing declaration/forms |
| Service records, confirmation/dispute | All; role-specific commands | No service evidence/timesheet cards |
| Booking collection / settlement and recovery | Client, Operations | Existing empty record lists / Operations preparation controls |
| Service orders | All; Operations creation | Existing order list |
| Payroll periods | Officer, Operations | Existing period/line list |
| Employee payment instructions/destinations | Operations with returned policy access | Component hidden without access; no instruction/candidate rows when empty |
| Partner payables, destinations, payment instructions | Operations with returned policy access | Component hidden without access; empty lists remain distinct from paid |
| Payroll policy / site and workforce evidence / client review | Operations; existing owner/reviewer limits | Existing evidence and policy lists/forms |
| Operator grants and limits | Owner flag only | Existing grants list; unchanged authority |

These are sections on the existing Service page, not standalone tabs. This checkpoint applies shared spacing, headings, readable wrapping, form widths and checkbox sizing. It does not redesign finance controls or replace exact audit records.

## Before → after

- Services, Armed and VIP all announced as current on every service page → only exact current destination announced.
- Public primary navigation hidden below desktop breakpoints → all seven links available on mobile.
- Intake-only account navigation, absent on detail pages → consistent navigation on every production account route, with explicit current page and account return paths.
- Service readiness label concealed payment/record sections → Service & payments.
- Intake type stored only in local state → linkable `kind` query selection.
- Homepage/join copy denied existing production signing → signing correctly described as separately delivered approved agreements; identity/payment gates unchanged.
- Refresh during an intake error removed the correction form → form stays mounted, preserving edits; failed load no longer claims an empty account.
- Raw request failures without next steps → status-specific intake guidance and safe status refresh; no automatic transaction replay added.

## Historical/demo-only surfaces

`ClientApp`, `OfficerApp`, `OperationsApp`, `WorkspaceView`, and their synthetic booking/offers/earnings/readiness dashboard tabs are selected only by `pilotStage() === 'demo'`. The historical Passport view is similarly gated. Their old copy is not a statement of production readiness and was not rewritten. Production-mounted test agreement, sandbox identity, enrolment and test-cycle components are **not** dead code: they remain reachable and explicitly labelled as simulations. No route or useful deep link was removed.
