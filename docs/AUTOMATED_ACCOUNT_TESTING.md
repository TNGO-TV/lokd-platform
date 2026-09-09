# Automated account checks

Run `npm run test:accounts` from the checkout. No test inboxes, manual email-code retrieval, or invitations are needed.

Prerequisites:

- Development Clerk keys in ignored `.env.clerk-test` (`clerk env pull --instance dev --file .env.clerk-test`). The runner refuses production keys and never reads `.env.local` for credentials.
- `npm ci`, then `npx playwright install --with-deps chromium` on a machine with permission to install browser dependencies.
- Port 4177 available; no existing `.dev.vars`. The runner refuses to overwrite local Worker configuration.

The runner creates five unique temporary users: Client, Officer, Operations, unassigned, and owner. It assigns roles only in a temporary local Worker configuration, uses Clerk's `+clerk_test` addresses and email-code verification, runs the actual application on localhost, and deletes its users and configuration afterward. Tests use separate browser contexts. A standard Operations user is separate from an owner, who has explicitly configured cross-portal access.

The browser suite checks role destinations, denied cross-role access, an unassigned verified account, the owner policy, sign-out, and forged-header rejection. It uses the email-code strategy rather than Clerk's backend sign-in-ticket shortcut. Reports are saved to ignored `test-results/accounts.json`; failure reports must be treated as internal. Screenshots, video and authentication traces are disabled.

If user cleanup fails, the runner exits unsuccessfully and writes `test-results/clerk-cleanup.json` with the exact development user IDs requiring deletion. An abrupt machine shutdown can interrupt cleanup; reconcile users carrying `privateMetadata.lokdAccountTestRun` before reusing the environment. Do not delete other development users.

## Acceptance boundaries

This verifies the current local source with real Clerk development authentication. It does not establish deployed custom-domain routing, production email delivery, Google OAuth, second-factor enrollment/reverification, or live financial acceptance. Fixed test codes must never be enabled as a substitute for production authentication. Operations MFA remains an outstanding implementation/acceptance item. Google remains AUTH-001: required, deferred, open. iiDENTIFii and Paystack provider credentials remain pending.

No scheduled monitor or additional agent is needed to run this command. The existing health monitor retains its availability-monitoring responsibility.

## 9 September 2026 findings

The first browser execution reproduced a Content-Security-Policy failure: the site allowed scripts and connections only from itself, blocking Clerk. The same restrictive header was confirmed on the deployed Operations sign-in page. `next.config.ts` now permits the production Clerk frontend and documented bot-protection resources; the development frontend is allowed only during development. A regression test verifies that release headers exclude development hosts and retain framing/object restrictions.

The workflow passed six development browser tests, including real email-code authentication for all three roles, unassigned and owner policies, and anonymous forged-header rejection. The strengthened run additionally checks the visible sign-in form, the server's return-to redirect, and HTTP 403 on cross-role APIs. Portal data completeness, provider acceptance, and Operations MFA are not covered by these authentication checks.

On this workspace, browser libraries were extracted into ignored `.sites-runtime/browser-libs` because system package installation is unavailable. The runner uses that local library directory automatically when present. Other machines can use Playwright's standard dependency installation above.
