# Temporary Operations MFA suspension — 11 September 2026

Owner instruction: “OK lets turn off MFA for now”. This explicitly supersedes prior MFA enforcement requirements for this temporary period. It does not authorise changes to login, role assignment, independent review, funding, identity, PSiRA, agreements or settlement restrictions.

## Working method

Server setting `LOKD_OPERATIONS_MFA_REQUIRED=false` suspends the fresh signed-factor requirement at the Operations request gate and the stored-factor requirement for controlled operator commands. Only the exact server-side value `false` disables enforcement; missing/malformed values require MFA. A browser request cannot set policy. Clerk itself already has authenticator and backup-code enrollment disabled; no Clerk account/plan or provider configuration change is needed.

The status API returns `required:false` separately from actual `enrolled` and `fresh` proof. It still requires a real Clerk user and Operations role. No proof, enrollment, stored timestamp or verified status is fabricated. Operations account security displays the temporary suspension and hides mandatory verification; the Operations control summary and newly generated readiness evidence reflect the policy.

The default strict behavior remains tested and available. Role permissions, account activity, amount limits, distinct maker/reviewer/finance checks, official verification, funding, approved agreement requirements and settlement locks remain enforced. Existing public synthetic demo boundaries remain unchanged. No real user is provisioned or promoted.

## Restore

After owner approval to restore MFA and resolution of the Clerk entitlement: enable real enrollment, enrol named Operations users and retain their recovery codes with them. Set `LOKD_OPERATIONS_MFA_REQUIRED=true` (or remove it) through Sites and redeploy the validated current version. Verify unenrolled/stale-factor denial and real second-factor success before calling production MFA acceptance complete. Restoring without enrollment will block privileged actions again.

## Verification

New tests exercise server-only suspension, absent/malformed setting fail-closed behavior, no invented MFA proof, unauthenticated and unassigned API denial, and preserved account/role/amount/maker/checker controls. Full suite, build and deployed receipt are recorded below on completion.

This is a temporary owner-approved exception, not resolution of Clerk AUTH-003. Google production configuration and visible buttons were verified separately; complete OAuth/account acceptance is still pending. No provider purchases, payments, signatures or live approvals are part of this milestone.

Final local validation: production build passed; **237 regression tests passed, zero failed/skipped** (11,903.131234 ms); TypeScript and changed-source lint passed. Full TAP: `/tmp/lokd-mfa-suspension-tests.tap`. No database migration. Existing strict-MFA tests still pass with the default setting; new tests prove the explicit owner suspension and restoration behavior.
