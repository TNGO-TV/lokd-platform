# LOKD Security

LOKD runs on Vinext, React, Cloudflare Workers, D1 and R2. This checkout preserves the Version 35 source history.

## Current authentication: Clerk

This guidance supersedes previous Supabase and dispatch-owned ChatGPT authentication instructions for LOKD. Supabase is not part of the current implementation. D1 remains the database and R2 the evidence store.

`@clerk/react` provides sign-in; `@clerk/backend` verifies sessions at the Worker fetch boundary. Incoming identity headers are removed, then replaced only after Clerk verifies the session and its verified primary email. Client metadata never grants a role.

| Login | Destination | Permission |
| --- | --- | --- |
| Client | `https://portal.lokd.co.za/client` | Assigned client ID |
| Officer | `https://officers.lokd.co.za/officer` | Assigned officer ID |
| Operations | `https://operations.lokd.co.za/ops` | Operations or owner allowlist |

`LOKD_PILOT_ACCESS_JSON` remains the server-controlled role/entity map. New Clerk accounts receive no workspace permissions automatically. Owner access spans roles but does not waive payroll maker/checker, MFA or settlement controls. The Operations account menu distinguishes ordinary Operations access from owner access.

Set `CLERK_PUBLISHABLE_KEY` and secret `CLERK_SECRET_KEY` through Sites runtime configuration. `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is also accepted. Optional `CLERK_AUTHORIZED_PARTIES` is a comma-separated list of extra trusted origins for a development instance; production LOKD origins are fixed in source. Use development Clerk keys for automated login tests. Local Worker bindings belong in ignored `.dev.vars`; `.env.local` is ignored as well. Never commit secrets or put them in hosting metadata.

`app/lokd-auth.ts` supplies server page helpers. `/sign-in` pins each portal to its own destination. `/sign-out` uses Clerk. Protected APIs enforce the same permissions. Anonymous synthetic access remains limited to the supported demo hosts while `LOKD_APP_STAGE=demo`.

See [the implementation acceptance record](docs/IMPLEMENTATION_ACCEPTANCE_2026-09-09.md) for deployment reconciliation, production blockers, provider acceptance and the controlled cycle. Runtime changes take effect only after deploying a saved version.

## Development and validation

Requires Node.js >=22.13.0, Linux, curl, flock and GNU timeout.

- `npm run install:ci`: install the locked dependencies.
- `npm run dev`: start the existing Vinext development server.
- `npm run build`: produce the bounded Worker build.
- `npm run lint`: run ESLint.
- `npx tsc --noEmit`: check TypeScript.
- `npm test`: build and execute the tests.
- `npm run db:generate`: generate migrations after schema changes.

The build uses `worker/index.ts`, the existing Sites Vite integration, and logical D1/R2 bindings in `.openai/hosting.json`. No application database migration is required for the Clerk change. Internal identity-header fixtures in tests represent requests after the Worker authentication boundary; `tests/clerk-access.test.mjs` independently checks that callers cannot forge those headers.

Production identity acceptance and money movement remain disabled pending provider credentials, approved operating controls and separate live acceptance. Synthetic tests and shadow payslips are not evidence of identity verification, settlement, employment activation or legal agreement signing.
