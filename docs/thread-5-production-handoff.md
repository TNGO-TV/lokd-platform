# Thread 5 production platform handoff

Branch: `final/production-site`. Base: `492d08a`. No pull request was opened.

## Implemented

Production Worker authentication, headers and production-only bindings; minute cron for schema/outbox maintenance, intake/receipt/session retention, assignment revalidation and delivery. Expired intake linked to signup cases and actively dispatching deliveries are held. Clerk owns authentication sessions; the local presence sessions and idempotency receipts are purged by persisted expiry. Financial and legal receipts have no approved expiry and are retained.

Handwritten migrations `0170` and `0171` remove the two confirmed 27 September enquiries and known seeded officer records, then install guarded retention. The cleanup uses exact record identities or explicit nonproduction provenance and is idempotent. No remote database mutation or Worker deployment was performed in this thread. Apply both migrations before deploying the coordinated release, following the encrypted export procedure in [the recovery runbook](runbook-backup-restore.md).

Encrypted D1 export and empty-target restore scripts validate full-schema foreign keys and integrity. Restore loads data before installing triggers, preserving existing audit evidence without replaying it. The restore script checks the remote target is empty and verifies remote integrity after import. Off-host storage, encryption identities and daily scheduling belong to the owner.

Banned-copy checking is strict by default and warning-only in `npm run lint`, as requested. The 78-check integrated browser release gate remains mandatory; its removed-screen scenarios now exercise production enquiry submission, durability, idempotency, validation and HTTP access boundaries with local fixtures.

## Shared modules awaiting caller removal

This list was checked with `git grep` after pulling the shared branch. Threads 1–3 own officer/client/Operations callers respectively; Thread 4 owns the root public layout and join page. Shared finance workflow callers belong to Thread 3. The retained role/access modules enforce production authentication and MFA; retired surface guards always deny access. Purely retired UI/provider libraries still need their callers removed before deletion.

- `app/components/pilot-access-denied.tsx` — `app/client/page.tsx`, `app/officer/page.tsx`, `app/officer/psira/page.tsx`, `app/ops/agreements/[id]/page.tsx`, `app/ops/agreements/page.tsx`, `app/ops/identity/page.tsx`, `app/ops/intake/page.tsx`, `app/ops/page.tsx`, `app/ops/psira/page.tsx`, `app/ops/readiness/page.tsx`, `app/ops/security/page.tsx`, `app/ops/service/page.tsx`
- `app/components/pilot-feedback.tsx` — `app/layout.tsx`
- `app/components/sandbox-command-recovery.tsx` — `app/components/client-enquiry-form.tsx`, `app/join/page.tsx`
- `app/components/test-agreement-panel.tsx` — `app/components/signup-portal.tsx`
- `app/components/test-enrolment-panel.tsx` — `app/components/identity-panel.tsx`
- `app/components/test-surface-context.tsx` — `app/components/officer-presence-panel.tsx`, `app/components/signup-portal.tsx`, `app/components/workspace-shell.tsx`
- `app/lib/finance-sandbox-policy.ts` — `app/lib/finance-workflow-accounting.ts`, `app/lib/finance-workflow-request.ts`, `app/lib/finance-workflow-store.ts`, `app/lib/finance-workflows.ts`
- `app/lib/pilot-access-core.ts` — `app/lib/pilot-page-access.ts`, `app/lib/pilot-runtime.ts`
- `app/lib/pilot-page-access.ts` — `app/client/page.tsx`, `app/officer/page.tsx`, `app/ops/agreements/[id]/page.tsx`, `app/ops/agreements/page.tsx`, `app/ops/identity/page.tsx`, `app/ops/page.tsx`, `app/ops/readiness/page.tsx`, `app/ops/service/page.tsx`
- `app/lib/pilot-runtime.ts` — `app/api/agreements/production/route.ts`, `app/api/applications/route.ts`, `app/api/booking-refunds/route.ts`, `app/api/credit-notes/route.ts`, `app/api/enquiries/route.ts`, `app/api/enrolment/route.ts`, `app/api/evidence/route.ts`, `app/api/feedback/route.ts`, `app/api/finance-documents/route.ts`, `app/api/finance-workflows/route.ts`, `app/api/identity/route.ts`, `app/api/onboarding/route.ts`, `app/api/operational-delivery/route.ts`, `app/api/operations/route.ts`, `app/api/operations/security/route.ts`, `app/api/passport/route.ts`, `app/api/passport/verify/route.ts`, `app/api/payment-execution/route.ts`, `app/api/payment-recovery/route.ts`, `app/api/payroll-correction-reviews/route.ts`, `app/api/platform/export/route.ts`, `app/api/platform/route.ts`, `app/api/presence/route.ts`, `app/api/production-identity/route.ts`, `app/api/production-operations/route.ts`, `app/api/psira/route.ts`, `app/api/quotes/route.ts`, `app/api/service-record/route.ts`, `app/api/signup/route.ts`, `app/api/specialist/route.ts`, `app/client/layout.tsx`, `app/client/page.tsx`, `app/lib/applicant-api-access.ts`, `app/lib/onboarding-server.ts`, `app/lib/operational-delivery.ts`, `app/lib/operations-server.ts`, `app/lib/pilot-page-access.ts`, `app/officer/layout.tsx`, `app/officer/page.tsx`, `app/officer/psira/page.tsx`, `app/ops/intake/page.tsx`, `app/ops/layout.tsx`, `app/ops/psira/page.tsx`, `app/ops/security/page.tsx`, `app/verify/page.tsx`
- `app/lib/pilot-types.ts` — `app/components/client-app.tsx`, `app/components/officer-app.tsx`, `app/components/passport-view.tsx`, `app/components/workspace-view.tsx`, `app/lib/passport-rules.ts`, `app/lib/passport-server.ts`, `app/lib/payroll-statement-server.ts`, `app/lib/pilot-access-core.ts`, `app/lib/pilot-pricing.ts`, `app/lib/specialist-pricing.ts`, `app/lib/use-pilot.ts`
- `app/lib/test-agreements.ts` — `app/components/test-agreement-panel.tsx`
- `app/lib/test-enrolment.ts` — `app/api/enrolment/route.ts`
- `app/lib/test-surface-page.ts` — `app/client/layout.tsx`, `app/client/page.tsx`, `app/layout.tsx`, `app/officer/identity/page.tsx`, `app/officer/layout.tsx`, `app/officer/page.tsx`, `app/ops/identity/page.tsx`, `app/ops/layout.tsx`, `app/ops/page.tsx`, `app/signup/page.tsx`, `app/verify/page.tsx`
- `app/lib/test-surface-policy.ts` — `app/lib/test-surface-page.ts`
- `app/lib/test-surface-runtime.ts` — `app/api/applications/route.ts`, `app/api/enrolment/route.ts`, `app/api/evidence/route.ts`, `app/api/feedback/route.ts`, `app/api/finance-workflows/route.ts`, `app/api/finance-workflows/webhook/route.ts`, `app/api/identity/route.ts`, `app/api/onboarding/route.ts`, `app/api/operations/route.ts`, `app/api/passport/route.ts`, `app/api/platform/export/route.ts`, `app/api/platform/route.ts`, `app/api/presence/route.ts`, `app/api/service-record/route.ts`, `app/api/specialist/route.ts`
- `app/lib/verifynow-adapter.ts` — `app/lib/applicant-identity.ts`
- `app/lib/verifynow-sandbox-fixtures.json` — `app/lib/verifynow-adapter.ts`

## Removed files

- `acceptance/sandbox-completion/INDEX.md`
- `acceptance/sandbox-completion/SUMMARY.json`
- `acceptance/sandbox-completion/clerk-doctor.json`
- `acceptance/sandbox-completion/clerk-environment.json`
- `acceptance/sandbox-completion/clerk-fapi-discovery.json`
- `acceptance/sandbox-completion/clerk-session-local.tap`
- `acceptance/sandbox-completion/config-discovery.json`
- `acceptance/sandbox-completion/connected-eleventh.tap`
- `acceptance/sandbox-completion/connected-first.tap`
- `acceptance/sandbox-completion/connected-fourth.tap`
- `acceptance/sandbox-completion/connected-payroll-first.tap`
- `acceptance/sandbox-completion/connected-payroll-second.tap`
- `acceptance/sandbox-completion/connected-second.tap`
- `acceptance/sandbox-completion/connected-seventh.tap`
- `acceptance/sandbox-completion/connected-sixth.tap`
- `acceptance/sandbox-completion/connected-tenth.tap`
- `acceptance/sandbox-completion/connected-third.tap`
- `acceptance/sandbox-completion/connected-thirteenth.tap`
- `acceptance/sandbox-completion/connected-training-fifth.tap`
- `acceptance/sandbox-completion/connected-twelfth.tap`
- `acceptance/sandbox-completion/connected-wage-fix.tap`
- `acceptance/sandbox-completion/contracts-first.tap`
- `acceptance/sandbox-completion/engagement-first.tap`
- `acceptance/sandbox-completion/finance-bridge-third.tap`
- `acceptance/sandbox-completion/full-regression-central-merged.tap`
- `acceptance/sandbox-completion/full-regression-final.tap`
- `acceptance/sandbox-completion/full-regression-first.tap`
- `acceptance/sandbox-completion/identity-first.tap`
- `acceptance/sandbox-completion/local-initializer.json`
- `acceptance/sandbox-completion/period-first.tap`
- `acceptance/sandbox-completion/period-second.tap`
- `acceptance/sandbox-completion/period-specialists-fourth.tap`
- `acceptance/sandbox-completion/period-third.tap`
- `acceptance/sandbox-completion/rendered-after-build.tap`
- `acceptance/sandbox-completion/sandbox-focused.tap`
- `acceptance/sandbox-completion/service-first.tap`
- `acceptance/sandbox-completion/specialist-all-first.tap`
- `acceptance/sandbox-completion/team-period-final-candidate.tap`
- `acceptance/sandbox-completion/training-finance-first.tap`
- `acceptance/sandbox-completion/training-finance-second.tap`
- `acceptance/sandbox-completion/transitions-specialist-ninth.tap`
- `acceptance/sandbox-completion/verifynow-external.json`
- `acceptance/sandbox-completion/workforce-first.tap`
- `app/api/agreements/test/route.ts`
- `app/api/paystack/test/webhook/route.ts`
- `app/api/pilot/route.ts`
- `app/api/provider-test/route.ts`
- `app/api/sandbox/application/route.ts`
- `app/api/sandbox/discovery/route.ts`
- `app/api/sandbox/identity/route.ts`
- `app/api/test-cycle/route.ts`
- `app/client/sandbox/page.tsx`
- `app/client/test-cycle/page.tsx`
- `app/components/provider-payment-test.tsx`
- `app/components/sandbox-completion-workspace.tsx`
- `app/components/sandbox-finance-actions.ts`
- `app/components/sandbox-finance-workspace.tsx`
- `app/components/sandbox-governance-workspace.tsx`
- `app/components/sandbox-identity-workspace.tsx`
- `app/components/sandbox-intake-workspace.tsx`
- `app/components/sandbox-partner-workspace.tsx`
- `app/components/sandbox-presence-workspace.tsx`
- `app/components/sandbox-review-workspace.tsx`
- `app/components/sandbox-service-workspace.tsx`
- `app/components/sandbox-workspace.module.css`
- `app/components/test-cycle-panel.tsx`
- `app/lib/live-surface.ts`
- `app/lib/paystack-test.ts`
- `app/lib/provider-acceptance-test.ts`
- `app/lib/sandbox-application.ts`
- `app/lib/sandbox-command.ts`
- `app/lib/sandbox-completion-policy.ts`
- `app/lib/sandbox-discovery.ts`
- `app/lib/sandbox-engagement.ts`
- `app/lib/sandbox-funding-boundary.ts`
- `app/lib/sandbox-identity-store.ts`
- `app/lib/sandbox-identity.ts`
- `app/lib/sandbox-read.ts`
- `app/lib/sandbox-retention.ts`
- `app/lib/sandbox-service.ts`
- `app/lib/sandbox-specialist.ts`
- `app/lib/sandbox-training-finance.ts`
- `app/lib/sandbox-training.ts`
- `app/lib/sandbox-workforce.ts`
- `app/lib/test-cycle-types.ts`
- `app/lib/test-operating-cycle.ts`
- `app/lib/test-surface-storage.ts`
- `app/officer/sandbox/page.tsx`
- `app/officer/test-cycle/page.tsx`
- `app/ops/payment-test/page.tsx`
- `app/ops/sandbox/page.tsx`
- `app/ops/test-cycle/page.tsx`
- `app/payments/paystack/test/callback/page.tsx`
- `examples/d1/app/api/notes/route.ts`
- `examples/d1/db/schema.ts`
- `migrations/pending/ID-01-production-identity.sql`
- `migrations/pending/ID-02-officer-approval.sql`
- `migrations/pending/ID-03-readiness-passports.sql`
- `migrations/pending/ID-04-rereview-disposition.sql`
- `migrations/pending/ID-INTEGRATION-01-activation-evidence-clock.sql`
- `migrations/pending/ID-USABLE-01-private-delivery-and-provenance.sql`
- `sandbox-migrations/0001_identity_workforce.sql`
- `sandbox-migrations/0002_command_journal.sql`
- `sandbox-migrations/0003_evidence_retention.sql`
- `sandbox-migrations/0004_no_vat_pricing.sql`
- `scripts/check-owner-backup-runtime.mjs`
- `scripts/finance-paystack-test-probe.mjs`
- `scripts/frontend-action-inventory.mjs`
- `scripts/init-sandbox-completion.mjs`
- `scripts/isolated-rehearsal-marker.sql`
- `scripts/purge-sandbox-evidence.mjs`
- `scripts/render-finance-journey.mjs`
- `scripts/sanitize-sandbox-log.mjs`
- `scripts/test-accounts.mjs`
- `scripts/test-verifynow-sandbox.mjs`
- `tests/accounts/booking-settlement.spec.mjs`
- `tests/accounts/complete-cycle.spec.mjs`
- `tests/accounts/employee-payments.spec.mjs`
- `tests/accounts/enrolment.spec.mjs`
- `tests/accounts/hosted-identity.spec.mjs`
- `tests/accounts/partner-destinations.spec.mjs`
- `tests/accounts/partner-payables.spec.mjs`
- `tests/accounts/partner-payments.spec.mjs`
- `tests/accounts/payment-destinations.spec.mjs`
- `tests/accounts/payment-recovery.spec.mjs`
- `tests/accounts/playwright.config.mjs`
- `tests/accounts/portals.spec.mjs`
- `tests/accounts/production-connections.spec.mjs`
- `tests/accounts/production-payroll.spec.mjs`
- `tests/accounts/psira.spec.mjs`
- `tests/accounts/sandbox-identity.spec.mjs`
- `tests/accounts/security.spec.mjs`
- `tests/accounts/signup.spec.mjs`
- `tests/applicant-identity.test.mjs`
- `tests/connected-scenario-lifecycle.test.mjs`
- `tests/evidence-storage.test.mjs`
- `tests/finance-discovery.test.mjs`
- `tests/finance-entitlement-integrity.test.mjs`
- `tests/finance-security-integrity.test.mjs`
- `tests/finance-workflows.test.mjs`
- `tests/frontend/provider-payment-test.spec.mjs`
- `tests/frontend/test-agreement-ui.spec.mjs`
- `tests/integrated-browser/connected-governance.spec.mjs`
- `tests/integrated-browser/connected-payroll.spec.mjs`
- `tests/integrated-browser/connected-period-source.mjs`
- `tests/integrated-browser/connected-scenarios.mjs`
- `tests/integrated-browser/connected-service.spec.mjs`
- `tests/integrated-browser/finance.spec.mjs`
- `tests/integrated-browser/guided-accessibility.spec.mjs`
- `tests/integrated-browser/identity.spec.mjs`
- `tests/integrated-browser/intake.spec.mjs`
- `tests/integrated-browser/journey-helpers.mjs`
- `tests/integrated-browser/sandbox-contract.spec.mjs`
- `tests/integrated-browser/security-recovery.spec.mjs`
- `tests/integration-workflow-db.test.mjs`
- `tests/paystack-test.test.mjs`
- `tests/production-test-isolation.test.mjs`
- `tests/provider-acceptance-test.test.mjs`
- `tests/public-demo-access.test.mjs`
- `tests/public-demo-isolation.test.mjs`
- `tests/sandbox-connected.test.mjs`
- `tests/sandbox-contracts.test.mjs`
- `tests/sandbox-discovery-command.test.mjs`
- `tests/sandbox-engagement.test.mjs`
- `tests/sandbox-identity.test.mjs`
- `tests/sandbox-operations-rehearsal.test.mjs`
- `tests/sandbox-period.test.mjs`
- `tests/sandbox-policy.test.mjs`
- `tests/sandbox-recovery.test.mjs`
- `tests/sandbox-retention-independent.test.mjs`
- `tests/sandbox-retention.test.mjs`
- `tests/sandbox-service-contract.test.mjs`
- `tests/sandbox-service.test.mjs`
- `tests/sandbox-training-finance.test.mjs`
- `tests/sandbox-training.test.mjs`
- `tests/sandbox-workforce.test.mjs`
- `tests/service-record-access.test.mjs`
- `tests/specialist-operations-v34.test.mjs`
- `tests/unified-predeployment.test.mjs`

## Secret names

See [production-secrets.md](production-secrets.md) for purpose and owner-supplied status. Required authentication bindings: `CLERK_SECRET_KEY`, `LOKD_ROLE_ACCESS_JSON`, `LOKD_OPERATIONS_ACCESS_JSON`, `LOKD_OWNER_ACCESS_JSON`. Optional bindings: `LOKD_SMTP_PASSWORD`, `LOKD_SMTP_RELAY_TOKEN`, `LOKD_BACKUP_TOKEN_SHA256`, `VERIFYNOW_API_KEY`, `RESEND_API_KEY`. Reserved disconnected payment name: `PAYSTACK_LIVE_SECRET_KEY`; it is not provisioned or required for deployment. Operational tooling uses `CLOUDFLARE_API_TOKEN` and the public `LOKD_BACKUP_AGE_RECIPIENT`. No values were added.
