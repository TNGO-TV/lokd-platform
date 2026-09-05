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
receives only the publishable key.

Missing keys leave the public site available and protected access closed.
The sign-in and sign-up routes show an unavailable message until configuration
is complete. Production stage also rejects development keys. The last verified
Clerk Dashboard state had a development instance and no production environment;
creating/configuring production is a separate unfinished activation step.

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

Verification recorded on 5 September 2026:

- The production build passed with the existing Vinext/Cloudflare build script.
- TypeScript checking passed.
- All 213 regression checks passed, including signed-token verification and
  the existing business workflows and production locks.
- `clerk doctor` and the compiled-Worker smoke check were attempted, but their
  network approval was cancelled before either returned a result. Neither is
  recorded as passing. The smoke check is available in
  `tests/clerk-worker-smoke.mjs` for completion when execution is available.
- The authenticated browser connection became unavailable before application
  keys could be configured. No real Clerk sign-in/sign-up flow was tested.

This remains a draft. No real Clerk keys or user-role links have been installed,
no production Clerk environment has been configured, and the live Version 35
authentication remains unchanged. Complete configuration and actual runtime
and browser verification before merging or deploying this migration.

Official references:
- [Next.js setup](https://clerk.com/docs/nextjs/getting-started/quickstart)
- [Clerk middleware](https://clerk.com/docs/reference/nextjs/clerk-middleware)
- [Cloudflare server environment](https://developers.cloudflare.com/workers/runtime-apis/nodejs/process/)
