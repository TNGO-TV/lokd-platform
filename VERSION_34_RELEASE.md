# Version 34 — Specialist Operations and Pilot Readiness

## Delivered

- An Operations workspace for the six existing Armed/VIP service models, their cost assumptions, commercial terms, review status, supplier register and deployment packs.
- A versioned rate-card and terms review. This release exposes the existing V33 economics; it does not treat planning reserves as confirmed supplier costs or a legal/commercial sign-off.
- Draft, submit, independently approve and revoke workflows. Packs bind the exact quote, named officers, current commercial review, supplier version and evidence covering the final rostered shift.
- Client service summaries and officer instructions with separately scoped downloads. Officers receive no client prices or internal margins; clients receive no officer-only instructions or evidence register.
- Production approval requires an active named operator, role, recent MFA and an adequate approval limit. Synthetic references cannot support production approval.
- Database checks require a current approved pack naming the officer before production specialist offers, activation and successful revalidation. Revocation, expiry and changed versions invalidate the pack.
- Four persisted synthetic control rehearsals: Armed static, Armed movement, VIP unarmed and VIP armed. They cover price/cost floor, one-cent underfunding rejection, evidence expiry, quote changes, authority revocation and existing shadow-payroll validation. They do not dispatch officers or prove a live money-movement integration.
- Readiness requires the V33/V34 pricing, review and deployment guards as well as the existing settlement locks.

## Verification

- Production build succeeded with the Sites build helper.
- TypeScript no-emit check succeeded.
- Full regression suite: 206 passed, 0 failed, 0 skipped.
- D1 statement-breakpoint migration compatibility passed, including the new migration. A Python 3.11+ SQLite check also compiles every migration and specialist view with restricted query limits.
- Focused coverage includes tenant-scoped documents, anonymous/wrong-host denial, independent review, stale revisions, expiry, revocation, production MFA freshness and missing-pack offer rejection.
- Migration 0028 is additive. Earlier migrations are unchanged.

## Commercial policy boundaries

The existing pricing version is LOKD-SPECIALIST-2026.09-v1; the new terms version is LOKD-SPECIALIST-TERMS-2026.09-v1.

The displayed 12-hour commercial unit remains subject to working-time, rest and roster controls. Calendar, risk and notice adjustments apply through the existing pricing engine. Minimum planning is included once. VAT-inclusive cleared advance funding remains compulsory; credit terms remain zero. Extensions require an amended accepted quote, additional cleared funding and renewed readiness checks. Cancellation requires a reasonable evidenced assessment and review of applicable consumer protections; the interface does not automatically impose a cancellation penalty. Seven-day quote validity is a displayed commercial policy, not an independently enforced acceptance deadline in this release. Armoured-partner estimates still require a supported authoritative quote before progression.

Source references for review:
- VAT: https://www.sars.gov.za/types-of-tax/value-added-tax/
- Wage schedule: https://nbcpss.org.za/docs/legislations/minimum-wage-increase-2026-2027/
- Cancellation guidance: https://thencc.org.za/wp-content/uploads/2020/11/Explanatory-note-4-of-2023.pdf

## Remaining external inputs and activation

- Confirm actual vehicle/partner, insurance, command and specialist cost assumptions; record commercial/legal approval.
- Supply valid provider authority, insurance, client contracts, site/post evidence and officer onboarding/qualification records.
- Configure real named Operations accounts, roles, approval limits and trusted MFA evidence; map actual client and officer identities.
- Complete the identity and payment-provider integrations and production acceptance process.
- Production activation, payroll settlement, disbursement and issued payslips remain locked. Saving or publishing this release does not authorize the Johannesburg pilot.

## Recovery and publishing

The V34 source is kept in the bound Sites repository; the recovery branch is version-34-specialist-operations. Save the exact pushed main commit with its built archive as the Site version. The first saved release hit the host compound-SELECT limit during migration. The corrected validation view uses two branches, retains every evidence requirement, and is covered by a regression test. The failed migration left no specialist tables in the live database. Publish the corrected archive-backed release using the user’s existing public-publishing instruction; rely on the Sites deployment record for the final saved version number and publication status.
