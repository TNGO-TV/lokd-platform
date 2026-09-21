# Finance documents — isolated integration checkpoint, 14 September 2026

Prepared for Central Command. This is a local integration candidate, not a deployment or release approval. The owner explicitly selected **South African calendar dates (Africa/Johannesburg / SAST)** for payroll periods and pay dates. That decision is implemented and no longer an outstanding question.

## Source and integration boundary

Checkout: `/tmp/lokd-finance-documents`, branch `codex/finance-document-integration`. Base snapshot: `3f04ab2c2f401bfe3f22cda76aaa1dfa12bf5c14` (Central's combined working candidate, including canonical migration 0066 and connected payroll acceptance). The shared workspace was not edited. The feature patch starts after this snapshot; do not apply the snapshot commit over Central's own work. The accompanying receipt identifies the final feature commit and SHA-256 values. A full source bundle preserves the isolated base and feature for review.

Readiness reference: `docs/launch/CONNECTED-PAYROLL-CENTRAL-ACCEPTANCE-2026-09-14.md`. Earlier FI-05/FI-02 recovery and reconciliation contracts are reused. The separate, uncombined FI-06A branch is not silently imported.

## Delivered journey

Operations can prepare a payslip from an approved/exported payroll item, a remittance record from an approved partner payable, or an invoice from an existing production order and reviewed billing profiles. A different current finance approver reviews the frozen source, recipient, amount and financial evidence before a private issue number is committed atomically. The maker and recipient cannot approve. Changes in maker authority or source/payment evidence prevent approval; a stale draft can be rejected without deleting it.

The existing Operations panel mounts the document controls; officer/client workspaces show only their private issued documents. Partner remittance access uses the latest independently approved destination representative binding. Drafts remain private to authorized finance operators. Downloads are escaped printable HTML with private/no-store headers, restrictive CSP and no external assets. Reports are private CSV. No email, SMS, checkout or provider dispatch is part of this journey.

The UI and printable document show human-readable source amounts, calculation details, period/pay dates, original issue status, current payment status, original/current references, version and digest. The report preserves all issued versions and identifies superseded versions. New versions require independent approval and retain original sources, amounts, decisions and references. Existing invoice records receive the first independently issued number/status; subsequent document versions do not rewrite those original invoice facts.

Payments are projected from canonical financial-state views and recovery holds. Test transfers never produce paid documents. Provider success alone remains held until the existing independent bank-backed reconciliation proves payment. Employee and partner reversals move current status through held to reversed while the original paid issue remains preserved. Unpaid and pending sources are represented explicitly. Historical payroll exports retain NOT_RELEASED and partner exports retain NOT_PAID as historical export markers, with a separate canonical current payment_status column.

Invoice settlement uses the combined candidate's independently cleared bank settlement contract. Signed refund/dispute/recovery evidence remains **held**: this base has no authoritative final refund-reconciliation contract that would justify declaring an invoice reversed. That remaining contract belongs to Central's collection/recovery integration; this candidate does not invent final evidence.

## Calendar convention

New snapshots record Africa/Johannesburg. Period start/end and pay dates are inclusive South African calendar labels. UTC instants remain UTC. The existing rule permits a period ending today once its required service is complete; this change does not add a next-day waiting requirement or bypass unfinished-service checks. JavaScript and SQLite agree at 21:59:59.999 UTC and 22:00 UTC, month/year rollover and leap day. Payroll preparation and employee/partner payment due-date guards use SAST. Historical snapshots are not rewritten; older snapshots identify their legacy cutoff convention when displayed.

## Exact implementation

- `app/lib/finance-documents.ts`: source preparation, private access, independent issue, immutable versions, status projection, printable HTML and CSV.
- `app/lib/finance-document-format.ts`, `app/components/finance-document-controls.tsx`, `app/api/finance-documents/route.ts`: shared readable facts, local journey and private API.
- `app/components/production-operations-panel.tsx`: existing workspace integration.
- `app/lib/payroll-calendar.ts`, `app/lib/production-payroll.ts`, `app/components/production-payroll-controls.tsx`: accepted calendar and canonical payroll/export status.
- `app/lib/partner-payables.ts`: canonical remittance export status.
- `docs/migration-proposals/finance-documents.sql`, `finance-documents-schema.ts`, `generate-finance-documents.mjs`: exact proposed database contract and generator.

## Migration intent — Central owns numbering and shared schema

No numbered migration, Drizzle schema or migration journal was edited. Central must review and assign the next canonical migration number to the SQL proposal and merge the supplied table declarations into the shared schema.

The proposal adds three immutable tables (finance_document_versions, finance_document_decisions, finance_document_issues), lineage/issue uniqueness indexes, and six source/payment views. It adds one partial unique index to existing client_invoices: one original production invoice per booking. Inspect existing data for duplicates before migration; the proposal never deletes or merges them. Add this index to the existing Drizzle clientInvoices declaration as well.

Commit-time guards enforce current source/evidence, limits, independent authority, single decisions, immutable history and invoice-source freezing. The tightly scoped first-issue exception updates only original invoice issue metadata. A SAST snapshot guard is added. Only the employee/partner payment-command insertion triggers are replaced, preserving their existing guards and changing their date('now') comparisons to date('now','+2 hours'). Both live locks remain intact: LOKD_LIVE_PAYMENTS_ENABLED and payment_live_control.enabled. Neither is enabled by this patch.

The proposal is explicitly loaded in the assignment DB fixture and production-identity fixture loader, and after the numbered chain in the contract test. After Central canonicalizes it, remove those explicit duplicate loads. Regenerate/check the proposal with `node docs/migration-proposals/generate-finance-documents.mjs`; retain the custom views/triggers when generating future migrations.

## Verification and evidence

Production build passed. Final full regression, TypeScript, changed-file lint, whitespace and dedicated document browser results are recorded in the accompanying receipt/logs. The full suite contains 352 tests. The dedicated browser journey verifies readable amounts/SAST dates, paid-at-issue/current-reversed labels, private download links, stable retry keys, correction lineage, keyboard refresh and 360/390/1280 layouts. It uses mocked local API responses; it does not claim authenticated browser acceptance.

Database/API tests extend the existing connected payroll, invoice collection and employee/partner payment fixtures. They exercise all three document kinds, private recipient access and HTTP headers, anonymous/wrong-workspace denial, maker separation, revoked preparer authority, stale financial evidence, concurrent decisions, immutable correction history, paid/held/reversed transitions and retention after workforce suspension. Existing fake payment transports and checkout fixtures are reused; no new checkout was created.

The broader existing workspace browser suite is **not a pass**: the final bundled attempt recorded 46/52 passing and six failures, including Chromium target crashes and screenshot capture failures. Earlier development-server attempts exposed ERR_INSUFFICIENT_RESOURCES while loading modules. All failed logs are retained. The isolated finance-document browser passes, but Central still needs a stable full-workspace browser run before broader frontend acceptance. A test-only nested SQLite transaction error in the new authority scenario was corrected with scoped savepoints; its failed run is also retained.

## Remaining genuine acceptance requirements

1. Central's canonical migration/schema integration and independent local document QA, including a stable complete workspace browser run and representative migrated existing data.
2. Approved real employer/issuer/client billing identities and payroll/tax/deduction policies. Invoice source preparation deliberately fails if reviewed billing profiles or exact tax evidence are missing. Synthetic test profiles are not production evidence.
3. Intended recipient and independent finance accounts with required MFA, plus approval of actual payslip/invoice/remittance wording and printable layouts. The deliverable is printable HTML; no statutory compliance or final PDF acceptance is claimed.
4. Monetary corrections/credit notes require approved underlying accounting sources and their own reconciliation workflow. Document corrections preserve lineage and refresh reviewed facts/status; they do not authorize arbitrary replacement amounts or constitute a credit-note engine. Final invoice-refund reversal remains dependent on the authoritative collection recovery contract described above.
5. Genuine provider/bank and real-device acceptance when the site is ready, followed by explicit release authorization. Live testing is not required to continue development or local integration.

## Learning and next assignment

Observation: status at issue and current status serve different purposes. Action: freeze source/financial JSON and present current canonical state separately. Result: original paid documents survive suspension and independently reconciled reversal without becoming false current proof of payment. Preserve this distinction in later document formats and reports.

Observation: browser environment failures can obscure UI results. Local bundling removed the development module graph but did not eliminate Chromium crashes. Preserve both failed broad runs and the passing bounded document journey; do not relabel partial browser coverage as whole-workspace acceptance.

Next assignment: **Central Command integrates the exact feature patch, assigns the canonical migration, merges the schema contract, and performs independent local document acceptance.** This workstream stops at this checkpoint. This written handoff is not a claim that another task received a message. No deployment, real transfer, financial communication or live enablement occurred.
