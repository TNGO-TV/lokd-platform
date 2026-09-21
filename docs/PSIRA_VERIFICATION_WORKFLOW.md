# PSiRA verification — working method and acceptance

Observed on 9 September 2026 through the official individual verification service:
https://digitalservices.psira.co.za/verify-user/4

## Observed method

1. Open the official page in a real browser. Wait for the visible `PSIRA No` input, not the first input on the page: the page includes hidden login fields.
2. Enter the supplied registration number; leave application number and ID number empty.
3. Select the exact `Search` button. The authorised test returned one row with a matching PSiRA number. No second identifying field or CAPTCHA was required in these two observed checks.
4. Record the page source, UTC check time, table headings, returned row and a screenshot. Record registration status separately from employment status and certificate status. The first check returned Registered together with employment status Inactive; these are different fields.
5. Treat the returned name/photo as registration evidence only. Confirmation that the person being onboarded owns the record requires independent identity evidence and a named reviewer.

`node scripts/psira-observe.mjs NUMBER` repeats the browser process and saves restricted local evidence under ignored `work/psira/`. It exits unsuccessfully for unavailable/ambiguous results. A successful exit means one matching row was observed, not that the row says Registered or that identity was matched. The output never automatically approves a LOKD case. Evidence files can contain sensitive identity information; they are not bundled into the website or committed to source control.

The page made a request to `https://psiraapi.sortelearn.com/api/SecurityOfficer/Get_ApplicantDetails`. This is observed implementation detail behind the official form, not a documented public API contract. The workflow uses the official browser form; no internal API credentials or request replay were introduced.

## Implemented workflow

- `/officer/psira`: authenticated, assigned Officers submit their own number, inspect dated review history, replace a number and request rechecking.
- `/ops/psira`: authenticated Operations view the queue, open the official source, record returned status/name/grade/employment/certificate fields and source-check time, then separately record an identity decision and supporting reference.
- `/api/psira?scope=officer|operations`: existing Worker-verified Clerk identity and role controls apply. Genuine Clerk user ID is required even on demo hosts. Public demo access cannot read or write these records. Officers can access only their account-bound case; self-review is denied.
- A successful source lookup with identity unchecked remains unverified. Ambiguous, unavailable, mismatch, expired and pending-review states remain unverified. Explicit non-registration needs an explicit negative source status, not a blank page.
- Rechecking or replacing a number immediately resets current verification and retains prior evidence. A due recheck makes verification false when read, even if the last historical result was Registered.
- The initial maximum recheck interval is 30 days from the source check; certificate expiry can shorten it. This is a provisional LOKD policy, not a PSiRA requirement or guarantee of continued registration.
- Evidence includes a server-generated recording time, named reviewer and SHA-256 digest. Append-only database triggers reject changes/deletions to prior evidence; corrections are new events. Optimistic version checks prevent a stale review from overwriting a newer submission.
- This records PSiRA checks; it does not activate operational eligibility, override the existing onboarding gates, enable provider payments, or claim Operations MFA has been completed.

## Failure and recovery conditions

- HTTP success alone is not verification. Web-reader requests failed/timed out; browser rendering succeeded.
- The page produced unrelated JavaScript/image errors but rendered the form and result. Wait for the exact visible form/result, not for all background network traffic to finish.
- An absent/multiple matching row, timeout, changed layout, CAPTCHA, access restriction or missing field requires review; never convert failure into Registered or Not Registered.
- If an additional identifier is required on a future run, ask the owner for exactly that field; do not infer it or collect it from another source.
- The browser observer records a failed attempt privately and exits nonzero. A supervisor must resolve any challenge; no CAPTCHA bypass is implemented.
- If evidence cannot be saved, the operation fails. A failed/stale Operations save must be refreshed and reviewed again; it never silently overwrites history.
- Official-source automation runs from the authorised local workflow, not in the deployed Worker. The deployed UI provides the manual Operations review route. A supported server-side API and scheduled automated checks remain unconfirmed/unimplemented.

## Resume

See `docs/checkpoints/PSIRA_2026-09-09.md`. The real subject's number and returned identity are retained only in restricted `work/psira/<supplied-number>/` evidence. Do not insert this result into an arbitrary Officer account or any public demo seed. Obtain the intended Clerk account linkage and independent identity-match evidence before recording an approval against a person.

## Mandatory checks and intake exemptions

- Qualified/work applicants declaring current registration or registration needing renewal must supply a numeric PSiRA number. Public intake records `psira_review_required`; registration and an independent identity match are mandatory before work approval.
- Training intake (including registered officers seeking training), currently-in-training applicants and people not yet registered do not receive a registration lookup or a registration rejection. Their intake is recorded as `training_requested` or `registration_guidance`.
- Signed-in Officers choose registered, unregistered or training in the PSiRA panel. Non-registered/training declarations produce an explicit `not_required` event, no number requirement, no Operations lookup form and no recheck request. They do not grant verified or paid-work status.
- Moving to registered requires a number and resets the case to pending review. Moving away from registered revokes the current verification without deleting its history. Older cases default to registered, preserving the mandatory check rather than grandfathering an exemption.
- Production assignment evaluation and revalidation additionally require a current account-bound PSiRA review matching the officer record's email, registration number and grade, with confirmed identity and certificate/recheck dates covering the shift. Existing compliance records alone are insufficient. Synthetic demos remain isolated rehearsals.
- Changes to PSiRA declarations and reviews increment the existing activation-evidence epoch. A prepared assignment cannot reuse an evidence token from before such a change.
