# Production secrets and settings

Values are owner-supplied and never belong in Git, chat, screenshots, build output or logs. `wrangler.jsonc` declares names only. Set secrets on the `lokd-security` Worker with `wrangler secret put`.

## Secrets

| Name | Purpose | Required |
| --- | --- | --- |
| `LOKD_SMTP_PASSWORD` | Password of the lokd.co.za mailbox that sends all transactional email. See [Email](#email). | Yes |
| `LOKD_ROLE_ACCESS_JSON` | Server-managed role map. Signing in alone grants no role. | Yes |
| `LOKD_OPERATIONS_ACCESS_JSON` | Operations membership. Does not grant owner approval rights. | Yes |
| `LOKD_OWNER_ACCESS_JSON` | Owner approval membership. | Yes |
| `VERIFYNOW_API_KEY` | Officer identity verification. | Before officer intake |
| `LOKD_BACKUP_TOKEN_SHA256` | SHA-256 verifier for the time-limited owner backup endpoint, never the raw token. | For backups |
| `RESEND_API_KEY` | Only for the Resend alternative (Option B under [Email](#email)). | No |
| `PAYSTACK_LIVE_SECRET_KEY` | Reserved for payments. Do not set until payments are connected. | No |

## Email

All site email (enquiry and booking notices, visitor confirmations, quotes, agreements, client, officer and finance notices) goes through one shared provider. Choose one option.

### Option A (default): SMTP mailbox at domains.co.za

Create a mailbox for lokd.co.za in the domains.co.za control panel (cPanel), e.g. `notices@lokd.co.za`, then set:

| Name | Kind | Value |
| --- | --- | --- |
| `LOKD_SMTP_HOST` | Setting | The cPanel mail server for lokd.co.za, typically `mail.lokd.co.za`. |
| `LOKD_SMTP_PORT` | Setting | `465` (implicit TLS, the default when unset). `587` uses STARTTLS. Port 25 is refused. |
| `LOKD_SMTP_USER` | Setting | The full mailbox address, e.g. `notices@lokd.co.za`. |
| `LOKD_SMTP_PASSWORD` | Secret | The mailbox password: `wrangler secret put LOKD_SMTP_PASSWORD`. |
| `LOKD_EMAIL_FROM` | Setting | The same mailbox address (or an alias it may send as), e.g. `notices@lokd.co.za`. |
| `LOKD_TEAM_EMAIL` | Setting | Operations inbox for enquiry and booking notices. |

`LOKD_EMAIL_PROVIDER` can stay unset: when `LOKD_SMTP_HOST`, `LOKD_SMTP_USER` and `LOKD_SMTP_PASSWORD` are present, SMTP is used. Setting it to `smtp` makes the choice explicit.

SMTP has no delivery receipts or safe replay. A message the server accepted shows as accepted; if a send is interrupted before the server confirms it, the email is marked uncertain and is not resent automatically. Check the mailbox's Sent folder before sending it again.

### Option B: Resend

Set the `RESEND_API_KEY` secret, a Resend-verified `LOKD_EMAIL_FROM` and `LOKD_TEAM_EMAIL`, and leave the `LOKD_SMTP_*` settings unset (or set `LOKD_EMAIL_PROVIDER=resend`).

## Settings (non-secret)

| Name | Purpose |
| --- | --- |
| `LOKD_EMAIL_FROM` | Sender address for all email. With SMTP it must equal `LOKD_SMTP_USER` (or an alias that mailbox may send as). |
| `LOKD_QUOTE_EMAIL_FROM` | Optional sender for quotes; falls back to `LOKD_EMAIL_FROM`. |
| `LOKD_TEAM_EMAIL` | Operations inbox for enquiry and booking notices. |
| `LOKD_EMAIL_PROVIDER` | Optional: `smtp` or `resend`. Unset selects SMTP when its settings are present, else Resend. |
| `LOKD_OPERATIONAL_DELIVERY_ENABLED` | Set to `false` only to pause email sending; queued emails stay saved. |
| `VERIFYNOW_IDENTITY_POLICY_REFERENCE`, `VERIFYNOW_IDENTITY_VALIDITY_DAYS` | Identity check policy (validity 1–365 days). |
| `LOKD_COLLECTION_LIVE_ENABLED`, `LOKD_EFT_BANK_NAME`, `LOKD_EFT_ACCOUNT_NAME`, `LOKD_EFT_ACCOUNT_NUMBER`, `LOKD_EFT_BRANCH_CODE`, `LOKD_EFT_ACCOUNT_TYPE` | Payment settings. Leave unset until payments are connected. |

## Outside the Worker

| Name | Purpose |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Scoped D1 export/restore and deployment access. |
| `LOKD_BACKUP_AGE_RECIPIENT` | Public encryption recipient for `scripts/d1-backup.sh`. The private key stays in the owner's recovery vault. |

## Sign-in

No identity provider is connected. The sign-in boundary is `worker/identity.ts`: a provider verifies the session there and sets the `x-lokd-verified-*` headers the app reads. Its secrets are added here when it is connected.

## Remove from the deployed Worker

These belong to removed integrations. Delete them from the Worker at deploy: `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_JWT_KEY`, `CLERK_AUTHORIZED_PARTIES`, `ODOO_API_KEY` and all `LOKD_ODOO_*`, `LOKD_SMTP_RELAY_URL`, `LOKD_SMTP_RELAY_TOKEN`, `LOKD_DELIVERY_SOURCE_ALLOWLIST`, `LOKD_DELIVERY_EMAIL_ALLOWLIST`, `PAYSTACK_TEST_SECRET_KEY`, `FINANCE_SIMULATOR_KEY`.
