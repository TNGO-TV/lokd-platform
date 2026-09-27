# Odoo company 4 inspect

This is the current accounting and enquiry-companion path. Earlier CRM and transactional-mail vendors are retired. Email is SMTP or disabled.

## What runs

- Owner inspect and quote links use `GET`/`POST /api/odoo-books`.
- Reads go through the thin JSON-2 client to `https://tngo-tv.odoo.com` with `allowed_company_ids: [4]` only.
- A sale order is compared as `sale.order`. A customer invoice is compared as `account.move` with `move_type=out_invoice`.
- The stored reference is the immutable `QUOTE-` id (`client_order_ref` or invoice `ref`). The public `INV-` number is display-only.
- Enquiry delivery jobs read `res.company` id 4 (name LOKD Security, currency ZAR) and stop. They do not create a lead, partner, sale order, or invoice.
- Product email is SMTP (`LOKD_EMAIL_PROVIDER=smtp` or `cpanel`) when host, user, and password are set, optionally via the existing HTTPS relay. Any other provider value, including a missing value, is disabled and sends nothing.

## Worker configuration

Do not put secret values in git. Do not deploy secrets from this change.

Keep, when already present:

- `LOKD_ODOO_API_KEY`
- `LOKD_ODOO_COMPANY_ID=4`
- `LOKD_ODOO_JSON2_ORIGIN=https://tngo-tv.odoo.com`
- SMTP settings for `mail.lokd.co.za` (`LOKD_SMTP_HOST`, `LOKD_SMTP_PORT`, `LOKD_SMTP_USER`, `LOKD_SMTP_PASSWORD`, and the relay URL/token only if Workers cannot open SMTP directly)

Leave `LOKD_APP_STAGE` unchanged. Do not turn off Coming Soon.

If Worker secrets for a retired CRM or transactional-mail vendor are still stored, remove them in the Worker dashboard. The application reads only the Odoo company-4 settings and SMTP settings listed above.

## Deferred

A later change can add a thin company-4 write for an existing sale order or invoice. That work is not this inspect path. It must not create a quote-accept-invoice pipeline, must not touch companies 1–3, and must not send customer mail as part of the write.
