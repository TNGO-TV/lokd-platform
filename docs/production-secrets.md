# Production secrets

Values are owner-supplied and must never enter Git, chat, screenshots, build artifacts, or logs. `wrangler.jsonc` declares names only: required authentication bindings in `secrets.required`, optional names in declaration comments. Declarations do not provision secrets or connect a provider. Install active values through the owner-controlled secret store. No payment credential or live payment configuration is added by this build.

| Name | Purpose | Supplied by |
| --- | --- | --- |
| `CLERK_SECRET_KEY` | Server-side authentication and authoritative user/session validation. | Owner-supplied |
| `LOKD_ROLE_ACCESS_JSON` | Server-managed role map. Replaces the retired role-map name; authentication alone grants no role. | Owner-supplied |
| `LOKD_OPERATIONS_ACCESS_JSON` | Operations membership allowlist; does not grant owner approval rights. | Owner-supplied |
| `LOKD_OWNER_ACCESS_JSON` | Owner approval membership allowlist. | Owner-supplied |
| `LOKD_SMTP_PASSWORD` | Production SMTP authentication when direct SMTP delivery is selected. | Owner-supplied |
| `LOKD_SMTP_RELAY_TOKEN` | Authentication to the owner-operated SMTP relay when relay delivery is selected. | Owner-supplied |
| `LOKD_BACKUP_TOKEN_SHA256` | SHA-256 verifier for the time-limited owner backup endpoint; never the raw credential. | Owner-supplied |
| `RESEND_API_KEY` | Officer transactional email, integrated from Thread 1; required only when that delivery integration is enabled. | Owner-supplied |
| `VERIFYNOW_API_KEY` | Identity-verification credential; supply only for an owner-approved production integration. | Owner-supplied |
| `PAYSTACK_LIVE_SECRET_KEY` | Reserved name referenced by dormant payment code. Payment providers are not connected; do not supply or enable it. | Owner-supplied; reserved payment credential remains absent |

Operational credentials used outside the Worker:

| Name | Purpose | Supplied by |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Scoped D1 export/restore and deployment access. Not a Worker binding. | Owner-supplied |
| `LOKD_BACKUP_AGE_RECIPIENT` | Public encryption recipient used by `scripts/d1-backup.sh`; not a secret. The matching private age identity stays in the owner's recovery vault. | Owner-supplied |

Public/non-secret configuration includes `CLERK_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`), optional public verification key `CLERK_JWT_KEY`, authorized origins, SMTP host/port/user, email sender/team address, and feature/retention policy settings. Keep payment enablement flags absent/false. Retired credentials and flags must be removed from the deployed Worker separately when the coordinated production release is deployed; no secret values are copied automatically.

Inventory includes Thread 1 through `79a6958` and the current shared production branch and is refreshed when the other threads' commits are pulled. The temporary compatibility role modules read `LOKD_ROLE_ACCESS_JSON`, not the retired map name. If rotating the role-map name, provision the new secret before deploying.

Retired credentials still referenced by pending Thread 3 cleanup: `PAYSTACK_TEST_SECRET_KEY` and `FINANCE_SIMULATOR_KEY`. Remove these deployed bindings; do not provision them. They are not production deployment requirements.
