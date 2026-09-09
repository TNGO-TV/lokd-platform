# Operations MFA acceptance — 9 September 2026

## Implemented boundary

The Worker verifies the Clerk session signature and resolves the verified primary email before forwarding any identity or MFA proof. Incoming internal headers are stripped. A second-factor timestamp is derived from the signed token's `fva` and `iat`, with a conservative one-minute allowance for integer age precision. It is emitted only while the Clerk user has MFA enrolled. Missing factors, a negative second-factor age, malformed ages or impossible timestamps never count as proof.

Non-demo Operations API mutations using the central role gate require this request-bound proof, less than five minutes old. This is additional to existing roles, approval limits, independent reviewer rules and financial locks. A stored operator MFA timestamp cannot substitute for this request proof. Existing database-based operator controls remain additional prerequisites; this work does not automatically provision or authorize real operators. Demo rehearsal timestamps remain explicitly synthetic and cannot be taken as live MFA acceptance.

`/ops/security` offers Clerk's account-security enrollment and second-factor reverification. Its API requires a real Clerk user and assigned Operations role even on demo hosts. No public-demo fallback is permitted. The UI cannot mark itself verified; it displays the server's result. Cancelled/failed verification leaves live writes blocked.

References: [Clerk reverification](https://clerk.com/docs/guides/secure/reverification), [auth object](https://clerk.com/docs/reference/backend/types/auth-object), [React reverification](https://clerk.com/docs/react/reference/hooks/use-reverification). Clerk's standard second-factor utility can downgrade to first factor if no second factor exists; LOKD explicitly checks enrollment and the signed second-factor age to avoid treating email alone as MFA. The feature is documented as beta; pin acceptance to the installed SDK and repeat after an SDK change.

## Observed production blocker — AUTH-003

The production Clerk configuration dry-run returned HTTP 402 `unsupported_subscription_plan_features`, naming `app:mfa_totp` and `app:mfa_backup_code`. No production mutation was applied. Authenticator and backup-code enrollment cannot be enabled under the current plan. Resolving the subscription entitlement requires the account owner's billing decision; no purchase/upgrade has been made.

Development allows both features: the exact two-setting patch passed preview and was applied. Global mandatory sign-in/sign-up was not enabled; Client and Officer login policy is preserved. Production remains without enrolled/tested real Operations users. Do not close AUTH-003 on development-test success.

## Resume

1. Resolve Clerk production MFA entitlements, repeat the exact two-setting dry-run, then enable enrollment under the user's authorized configuration scope.
2. Assign the intended named Operations accounts and their authoritative operator roles/limits; enroll each account, store recovery codes with its owner and test independent maker/reviewer/finance journeys.
3. Verify live request proof, expiry, cancellation, recovery, factor removal and denied cross-role actions. Do not switch the public demo to production merely to test this boundary.
4. Google AUTH-001 remains separately required and user-deferred. iiDENTIFii and Paystack still await external credentials/contracts.

No real money moved, production approvals were not created, and no live MFA acceptance is claimed.

## Validation and learning

- All 224 regression tests passed, including real Clerk signature/factor-claim handling, malformed/expired/unenrolled proof, production/pilot/prelaunch mutation rejection, and enrollment-vs-reverification responses.
- Nine automated browser journeys passed (1.3 minutes). The new journey enrolled and verified a real TOTP second factor against Clerk development, then confirmed that the LOKD server accepted the refreshed session proof. Temporary users and configuration were cleaned up.
- The first browser attempt accessed Clerk before the newly navigated page had loaded it. The test now waits explicitly, and the verification button stays disabled until Clerk loads. Retry passed. This is a readiness lesson, not evidence of a provider outage.
- TypeScript and changed-source lint passed (two existing image warnings). Final production build passed after the loading-state correction.
- Production enrollment preview failed with HTTP 402; development success does not resolve that restriction. Repeat production enrollment and real-account acceptance only after entitlement resolution.

## START-ENGINES entitlement recheck

Authenticated CLI doctor and production config reads succeeded. Production still has authenticator/backup codes disabled and zero users; no named production acceptance is possible yet. The fresh configuration preview again returned HTTP 402 for `app:mfa_totp` and `app:mfa_backup_code`.

The Platform catalog exposes 51 application/configuration/user endpoints but no dashboard subscription/entitlement read. GET application returns only application ID, name and instances. The separate Backend subscription catalog concerns app customers and is not proof of the owner's Clerk subscription; that catalog fetch also returned HTTP 503. The CLI is authenticated; this is not a missing-installation diagnosis. No authenticated dashboard browser session is established in this task.

Clerk's [5 February 2026 plan announcement](https://clerk.com/changelog/2026-02-05-new-plans-more-value) says MFA is included in Pro and the former Enhanced Authentication add-on was eliminated. Therefore the 402 proves unavailable entitlement, **not which plan the owner bought**. Remaining input is the active billed plan for the workspace containing LOKD, or a Clerk support entitlement correction if it already includes MFA. No upgrade is recommended until that fact is known, and nothing here concerns ChatGPT billing.

Reusable decision procedure: verify app/production instance → read current MFA flags → run the exact no-write feature preview → inspect actual plan through an available authoritative account route → compare included features → enable existing entitlement or identify a concrete mismatch. If metadata cannot expose the billed plan, report that limit; do not infer Hobby/Pro or buy a new plan. If enablement succeeds, separately enroll named accounts and test denial, expiry, recovery and authority. Preserve negative responses and exact instance/date with each receipt.
