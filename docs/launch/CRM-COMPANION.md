# CRM companion (none connected)

Odoo was removed from LOKD in November 2026. The `tngo-tv.odoo.com` integration, the `/api/odoo-books` route, the Operations "Odoo company 4 documents" panel and the `LOKD_ODOO_*` settings no longer exist. Trigger CRM is planned as the replacement.

## What runs now

- New client enquiries are saved in D1 (`client_enquiries`). The intake trigger still queues two delivery jobs: `enquiry_email` and `enquiry_crm`.
- `enquiry_email` is the staff notice. It goes to `LOKD_TEAM_EMAIL` over SMTP (`LOKD_EMAIL_PROVIDER=smtp` or `cpanel`), with the existing allowlists. Disabled when SMTP is not configured.
- `enquiry_crm` settles as `cancelled` with `crm_companion_not_configured`. It makes no network request.
- Accepted quotes keep their LOKD `QUOTE-` id and `INV-` display number in D1. No accounting provider is read or written.
- `quote_books_links` stays in the schema as read-only history. Nothing writes to it.

## Worker configuration

Do not put secret values in git. These settings are no longer read and should not be set on the `lokd-security` Worker:

- `LOKD_ODOO_API_KEY`
- `LOKD_ODOO_COMPANY_ID`
- `LOKD_ODOO_JSON2_ORIGIN`

## Connecting Trigger CRM later

1. Implement a `CrmCompanion` in `app/lib/crm-companion.ts` and return it from `configuredCrmCompanion` only when its own runtime settings are present.
2. Add those settings to `OperationalRuntime` in `app/lib/operational-provider.ts` and as Worker secrets.
3. `enquiry_crm` jobs then call `recordEnquiry` with the LOKD enquiry id. The job queue, leases, allowlists and audit history stay unchanged.
4. Enquiries saved while no CRM was connected can be backfilled from `client_enquiries`.
