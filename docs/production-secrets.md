# Production secrets and settings

Values are owner-supplied and never belong in Git, chat, screenshots, build output or logs. `wrangler.jsonc` declares names only. Set secrets on the `lokd-security` Worker with `wrangler secret put`.

## Secrets

| Name | Purpose | Required |
| --- | --- | --- |
| `RESEND_API_KEY` | All transactional email (team notices, client and officer emails, agreements, quotes). | Yes |
| `LOKD_ROLE_ACCESS_JSON` | Server-managed role map. Signing in alone grants no role. | Yes |
| `LOKD_OPERATIONS_ACCESS_JSON` | Operations membership. Does not grant owner approval rights. | Yes |
| `LOKD_OWNER_ACCESS_JSON` | Owner approval membership. | Yes |
| `VERIFYNOW_API_KEY` | Officer identity verification. | Before officer intake |
| `LOKD_BACKUP_TOKEN_SHA256` | SHA-256 verifier for the time-limited owner backup endpoint, never the raw token. | For backups |
| `PAYSTACK_LIVE_SECRET_KEY` | Reserved for payments. Do not set until payments are connected. | No |

## Settings (non-secret)

| Name | Purpose |
| --- | --- |
| `LOKD_EMAIL_FROM` | Verified Resend sender, e.g. `notices@lokd.co.za`. |
| `LOKD_QUOTE_EMAIL_FROM` | Optional sender for quotes; falls back to `LOKD_EMAIL_FROM`. |
| `LOKD_TEAM_EMAIL` | Operations inbox for enquiry and booking notices. |
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

These belong to removed integrations. Delete them from the Worker at deploy: `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_JWT_KEY`, `CLERK_AUTHORIZED_PARTIES`, `ODOO_API_KEY` and all `LOKD_ODOO_*`, `LOKD_SMTP_*`, `LOKD_DELIVERY_SOURCE_ALLOWLIST`, `LOKD_DELIVERY_EMAIL_ALLOWLIST`, `PAYSTACK_TEST_SECRET_KEY`, `FINANCE_SIMULATOR_KEY`.
