# LOKD authentication migration

This change uses the existing **LOKD Security** Clerk application,
`app_3IuH5PjmaRe1rmJAjwO0g6C6YQw`. It does not require or authorise the Clerk
CLI's workspace-wide OAuth grant. That grant was left unapproved.

## Configuration and activation

The application-scoped configuration is:

| Name | Handling |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | The selected LOKD Clerk instance's public key; safe for browser use |
| `CLERK_SECRET_KEY` | The same instance's server secret; store as a secret in the hosting runtime |
| `CLERK_JWT_KEY` | Optional public verification key, used for networkless verification; production rotation must update it |
| `LOKD_PILOT_ACCESS_JSON` | Existing protected role configuration, extended with explicit Clerk subject links |

Configure runtime values through Sites and use approved local secret storage
for a development preview. Never paste secrets into chat, commit them, place
them in the hosting manifest, or expose them through client props. No real
Clerk key is included in this commit.

The Cloudflare `nodejs_compat_populate_process_env` flag makes the server
secret available to Clerk's normal server-side environment access. The proxy
does not pass a secret through dynamic request options. The public provider
receives only the publishable key. The Vite configuration selects Clerk's own
non-filesystem helper for Workers. `build/clerk-worker-compat.ts` converts the
SDK's two server-module CommonJS guards into a real `server-only` ESM import;
it preserves the server/client restriction and changes no token verification.

Missing keys leave the public site available and protected access closed.
The sign-in and sign-up routes show an unavailable message until configuration
is complete. Production stage also rejects development keys. The production
instance was created on 5 September 2026 after the user
explicitly approved copying the existing development settings. It is
`ins_3IuqByfuozQZDguv7iJ3qPqd47b`, with primary domain `lokd.co.za` and Frontend
API `https://clerk.lokd.co.za`. Its keys are saved in hosting environment
revision 3; the server key is marked secret. This revision is not applied to
the live site until a saved version is deployed. DNS verification and actual
account acceptance remain incomplete.

Before any live switch, confirm the selected instance, configure production
domains and the client/officer/Operations subdomains, run real sign-in, signup,
sign-out, recovery, session-expiry and cross-subdomain tests, and record the
tested instance and release. This code change alone is not a live migration.

## Stable account links

LOKD roles and existing canonical actor identifiers stay in LOKD. Add an
explicit `clerkUsers` link after verifying the real user's Clerk ID. For example,
the following is illustrative configuration, not an actual account assignment:

```json
{
  "owners": ["owner@lokd.example"],
  "clients": { "client@lokd.example": "CL-001" },
  "clerkUsers": {
    "user_VERIFIED_OWNER_ID": {
      "principalEmail": "owner@lokd.example",
      "displayName": "LOKD owner"
    }
  }
}
```

An email match, an OAuth profile, signup metadata, or a client-provided role
does not create this link or grant a role. An unassigned signed-in account can
manage its Clerk profile but cannot see a LOKD workspace's records. Removing
the server link removes LOKD access even while the Clerk session remains valid.
Canonical LOKD actor emails are retained by the explicit subject link to keep
existing audit attribution and officer/client relationships intact.

The API verifies actual Clerk session tokens with the official backend SDK.
It rejects forged hosting/Clerk identity headers, invalid signatures, expired
tokens, unexpected origins/issuers, pending sessions and impersonation tokens.
Pages use the asynchronous Next.js `auth()` helper after the proxy's session
verification. The proxy includes the `/__clerk/:path*` matcher once.

Existing role, tenant, maker/checker, recent-MFA, payroll, funding and
production-activation gates remain authoritative. A login does not establish
iiDENTIFii identity verification, satisfy an operator's recent second-factor
gate, enable settlement or activate paid deployment. The isolated public demo
fallback is retained only on its existing demo hosts and does not apply to
specialist assignment records or named Operations enquiry management.

## Verification

Use the existing production build and regression suite. `clerk-access.test.mjs`
exercises real SDK verification against ephemeral test signing keys, with no
live Clerk account or network. `clerk-request.mjs` upgrades existing business
workflow fixtures to signed test sessions and explicit subject links; it is
never imported by production code. These tests do not substitute for a real
account completing the browser authentication flow.

Latest verification recorded on 5 September 2026:

- The production build passed with the existing Vinext/Cloudflare build script.
- TypeScript checking passed.
- All 213 regression checks passed, including signed-token verification and
  the existing business workflows and production locks.
- `clerk doctor` and the compiled-Worker smoke check were attempted, but their
  network approval was cancelled before either returned a result. Neither is
  recorded as passing. The smoke check is available in
  `tests/clerk-worker-smoke.mjs` for completion when execution is available.
- The browser connection subsequently recovered. The existing development
  instance's keys were securely prepared in an ignored, mode-0600 development
  configuration file in the cloud checkout. They are not in Git, the client
  output or the production hosting settings. Existing environment files were
  not read or printed.
- The Clerk dashboard confirms email and password signup are enabled, with
  email verification, compromised-password rejection and Device Trust. No
  account authentication policy was changed.
- The first supervised preview failed on the SDK's Node/CommonJS helper.
  A broad CommonJS conversion was tried once and failed on duplicate exports;
  it was removed. The final targeted Worker helper/guard repair builds without
  those errors and all 213 checks still pass. Its actual preview and real
  signup/sign-in verification remain unfinished after the two bounded preview
  startup attempts. No passing browser or Worker smoke result is claimed.
- All 22 emitted client JavaScript files passed the server-key pattern check.

## Production setup status — 5 September 2026

The user specifically approved creating production inside the existing LOKD
Security application by cloning development. Creation succeeded. No broad
workspace CLI grant or paid plan was approved or used.

The production email/password settings were verified in the dashboard: email
signup and required email are on; signup email verification and email-code
sign-in are on; password signup and adding a password are on; Device Trust
and compromised-password rejection are on; minimum password length is 15.

Google is present as an enabled but unconfigured social connection. The
production page explicitly says it cannot work until custom credentials are
added. Automatic approval review rejected the final Disable connection action
because the user had not specifically authorised that production authentication
change. The confirmation was cancelled, and Google was left unchanged. Ask
specifically to disable this unconfigured Google connection and use the already
enabled email/password options. Do not substitute a different mutation route.

The application's two production keys were transferred directly from its
visible dashboard configuration into the existing Site's runtime settings.
The secret key is stored as a secret. Existing runtime entries were preserved,
and no existing environment file was read or printed. There are no actual
keys or user-role links in Git. The active business stage and payment locks
were not changed.

The production Paths page retains Clerk's default account-portal URLs for
sign-in, sign-up and sign-out; Home URL is blank, meaning the root. LOKD's
provider and proxy explicitly configure its application routes in code. No
dashboard path setting was changed; actual route/return-flow verification is
part of the unfinished browser acceptance.

Clerk generated the following CNAME records for the `lokd.co.za` DNS zone:

| Name | Target |
| --- | --- |
| `clerk` | `frontend-api.clerk.services` |
| `accounts` | `accounts.clerk.services` |
| `clkmail` | `mail.41o7yt86mrf7.clerk.services` |
| `clk._domainkey` | `dkim1.41o7yt86mrf7.clerk.services` |
| `clk2._domainkey` | `dkim2.41o7yt86mrf7.clerk.services` |

The production domain ID is `dmn_3IuqBzocbgxwTA1NUWhFX35xprf`. The actual
Clerk verification returned 0/2 application records and 0/3 email records
verified. The first three hosts resolved to the wrong target, `lokd.co.za`;
Clerk could not determine the two DKIM hosts. Certificates are not issued
until verification succeeds. The DNS account is not connected here, and
plugin discovery found no suitable cPanel DNS integration. The owner must
apply these specific records in the existing zone; existing website, portal
and ordinary mail records must be preserved.

An attempt to enable an explicit subdomain allowlist was interrupted by
automatic approval review when adding the first `www.lokd.co.za` entry. The
reviewer said that a partial list would exclude the other LOKD subdomains and
was not specifically approved. The earlier toggle was immediately restored
to its original disabled state, and that restoration was verified. No partial
allowlist remains. The code's explicit authorized origins remain in place.
A future complete dashboard restriction should include all confirmed LOKD
subdomains and be approved together, not added as an incomplete live policy.

This remains a draft. The live Site is active and still on Version 35. No
merge, deployment, real signup/sign-in pass, named user-role link or production
business activation occurred. Complete DNS/certificates and any outstanding
Google connection decision, actual Worker/browser acceptance and named role
checks before merging and deploying. The two bounded preview startup attempts
were not repeated; the preview is stopped. The production build, type check
and 213 regression results above remain the latest passing software checks.

Official references:
- [Next.js setup](https://clerk.com/docs/nextjs/getting-started/quickstart)
- [Clerk middleware](https://clerk.com/docs/reference/nextjs/clerk-middleware)
- [Cloudflare server environment](https://developers.cloudflare.com/workers/runtime-apis/nodejs/process/)

- [Production setup and DNS](https://clerk.com/docs/guides/development/deployment/production)
- [Subdomain controls](https://clerk.com/docs/guides/dashboard/dns-domains/subdomain-allowlist)
