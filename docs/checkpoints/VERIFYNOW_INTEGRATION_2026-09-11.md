# VerifyNow applicant infrastructure — 11 September 2026

Scope: owner authorised continued integration; R350 registered-officer enrolment price is approved. Training packages remain an owner dependency. This milestone is a working sandbox adapter and authenticated applicant progression, not production identity approval or a payment collection release.

## Built

- Server-only VerifyNow adapter, fixed HTTPS provider host, exact fixture endpoint allowlist, forced sandbox mode, redirects disabled, 25-second timeout. Public callers choose a known synthetic scenario; cannot supply real IDs/images/bank details, URLs or mode. The vn_live_ key format is the provider's credential format; every dispatched request still forces sandbox mode. Private key loaded from the supplied private file into protected Sites configuration without printing or copying into source.
- ID, bank, face, liveness, OCR and optional licence outcome mapping uses saved provider response fields. ID no-record 502 is a negative; ID outage 502 is unavailable; bank false-success 200/code4 is negative; face In Review remains manual_review. Mock approved is never real verified. Status-only success is rejected. Retry-After is preserved.
- Migration 0037: case/owner/version/scenario-bound persistent check records, status, timestamps, response digest, HTTP status and retry timing. Atomic uniqueness claim before dispatch prevents duplicate requests from concurrent submission or refresh. Existing check result is reused. No raw response identities or images are stored. Synthetic request fixtures and stripped response outcome fixtures are in source; original private provider reports remain outside the repository.
- Authenticated officer applicant page /officer/identity and /api/identity. Stable Clerk owner must match a linked, non-withdrawn real submission. Cross-account, wrong workspace host and stale case version fail. Corrections or other case-version changes conservatively require fresh evidence; previous version records remain retained. No email-only access to bound verification evidence.
- Operations read-only evidence page /ops/identity uses actual Operations role/MFA policy. Operations can use the existing intake review workflow to request corrections; it cannot turn sandbox evidence into live approval.
- Both registered and new/training officer applicant routes start with ID. Latest ID mock approval displays either approved R350 registered-officer enrolment or training options pending. Training path has no enrolment fee. Payment remains not_started; PSiRA stays separate; face/bank/identity/training/activation are independent. No role, work eligibility, bank payout approval or funding is granted.

## Recovery limits

No automatic provider retry. Rate-limit/unavailable timing is displayed, but repeating a scenario reuses its record. Timeout stays delivery_unknown because the provider may have completed the request. A crash before result persistence can leave pending evidence; Operations must investigate it. This intentionally does not yet include an Operations retry/reconciliation command. Reuse is scoped to an exact application version; unrelated intake updates currently invalidate reuse too. These limits are recorded, not silently converted into failures or approvals.

## Validation and boundaries

Four targeted adapter/applicant tests use the saved 12 response attempts for 11 scenarios, real local SQLite, and a mocked transport. They cover observed contracts, forced sandbox/host/redirect settings, Retry-After, ownership, concurrent reuse, unknown delivery, registration/training progression, corrected-version invalidation, unauthenticated and wrong-host requests. No successful provider smoke calls were repeated. No real applicant details were sent. Build/type and complete regression results are recorded in the release receipt.

Still pending: real browser capture and provider production acceptance; real-ID entry and privacy/consent/capture flow; owner training packages; package terms and binding enrolment checkout to an expected applicant payment; live financial acceptance. The R350 PRICE approval is not pending. The earlier Paystack R1 test success/webhook does not prove an R350 enrolment collection workflow. Sandbox scenario controls are confined to authenticated linked applicant pages, not the public homepage.

Resume from this code and saved fixtures. Do not rerun the full provider probe or ask for price approval again. Next implement controlled retry/reconciliation and applicant-bound Paystack test enrolment after package terms are defined, then real verification capture/acceptance. Keep Clerk and PSiRA unchanged.

Predeployment acceptance: all 248 regression tests passed, including four new VerifyNow tests. TypeScript passed. Provider configuration staged in Sites environment revision 9 with the private key protected and sandbox enabled. No provider requests were made during these fixture-based tests.
