# LOKD Security

LOKD runs on Vinext, React, Cloudflare Workers, D1 (`lokd-security`) and R2 (`lokd-security`).

## Sign-in

No identity provider is connected yet. The sign-in boundary is `worker/identity.ts`: the provider verifies the session there and sets the `x-lokd-verified-*` headers. Incoming copies of those headers are always stripped first. The app reads identity only through `app/lokd-auth.ts`.

| Workspace | Destination | Permission |
| --- | --- | --- |
| Client | `https://portal.lokd.co.za/client` | Assigned client ID |
| Officer | `https://officers.lokd.co.za/officer` | Assigned officer ID |
| Operations | `https://operations.lokd.co.za/ops` | Operations or owner membership |

`LOKD_ROLE_ACCESS_JSON` is the server-controlled role map; signing in alone grants no role. `LOKD_OPERATIONS_ACCESS_JSON` adds Operations users and `LOKD_OWNER_ACCESS_JSON` owner approvers. Owner access does not waive payroll maker/checker, second-factor or settlement controls.

Secrets and settings: [docs/production-secrets.md](docs/production-secrets.md).

## Email

All email is sent through the lokd.co.za mailbox over authenticated SMTP (`LOKD_SMTP_HOST`, `LOKD_SMTP_PORT`, `LOKD_SMTP_USER`, secret `LOKD_SMTP_PASSWORD`), or through Resend (`RESEND_API_KEY`) as an alternative. Enquiry, booking and client notices are queued in D1 and sent by the scheduled Worker. Setup: [docs/production-secrets.md](docs/production-secrets.md#email).

## Payments

No payment provider is connected. Paystack secrets are reserved and must not be set until payments are connected.

## Development

Requires Node.js >=22.13.0, Linux, curl, flock and GNU timeout.

- `npm run install:ci`: install the locked dependencies.
- `npm run dev`: start the Vinext development server.
- `npm run build`: build the Worker.
- `npm run lint`: banned-copy check and ESLint.
- `npm test`: build and run the test suite.

## Deploy

1. Apply D1 migrations: `wrangler d1 migrations apply lokd-security --remote`.
2. Set secrets per [docs/production-secrets.md](docs/production-secrets.md) and delete the retired names listed there.
3. `wrangler deploy`.

Backups: [docs/runbook-backup-restore.md](docs/runbook-backup-restore.md).
