# Registration tuning — 11 September 2026

## Receipt and reconciliation

Owner-supplied `LOKD-RESUME.txt` explicitly says “Proceed” and lifts the pause for LOKD only. Its scope is one mobile client/officer registration and agreement-readiness tuning milestone, including deployment, then stop. Clerk plan review remains with the owner. No other project or duplicate task was started.

Local HEAD at receipt: ae8e0b8 (release receipt), clean. Sites reported latest version 42; its saved source was 89af9440b7ff717c6258d1fc8d69a915ecbc9db7 and its deployment remained succeeded with environment revision 5. No newer implementation was present; v42 was not redeployed.

## Changes and rationale

- Officer form validates contact details at the contact step, handles Enter as progression rather than premature application submission, focuses each next heading, prevents Back during saving, and waits for hydration before enabling the first Continue action.
- Success receipts distinguish registered officers awaiting official lookup and independent identity matching from training/registration-guidance intake. Unavailable, unclear or expired results remain unverified. No new lookup was performed and no PSiRA decision or eligibility rule changed.
- Client receipt explains Operations review, organisation/authority/site requirements, separately assigned account access, approved agreements and the funding sequence. An enquiry reference is not a payment instruction.
- Readiness summary now marks only `verified_demo` checks complete, shows incomplete statuses explicitly and reports failed refreshes. Its agreement guidance says production signing is unavailable and demo/draft completion is not a live signature. It does not infer production readiness from demo records.
- Unassigned-account return navigation points to the public LOKD origin, avoiding a return into the same portal role guard. New applicants can reach the existing enquiry/application forms.
- Existing LOKD styling retained; readable status text, wrapping references and flexible mobile form controls added.

No auth/provider configuration, database schema, signatures, Legal approvals, funding rules, production records or financial operations changed. Clerk, MFA, PSiRA, identity and signed-activation controls remain intact.

## Validation and retained learning

Browser method: local server on 127.0.0.1:4178; Playwright 360px touch and 1280px desktop. All off-origin browser traffic aborted; POST responses were intercepted synthetic fixtures. This validates UI handling, not provider or live financial acceptance.

Initial browser run: client 2/2 passed; six officer scenarios failed at the first Continue because the SSR-visible control accepted a click before hydration. Corrected with a hydration readiness guard; reran only those six officer scenarios, all passed (5.0s). Total final coverage: eight successful viewport/journey scenarios. Reusable lesson: do not hide lost early interactions with arbitrary test sleeps; hold the control until its handlers are ready.

Covered: registered early mobile/email validation, Enter progression with zero premature POSTs, failed submission and retry, success focus, independent identity/registration explanation; training and not-registered exemptions; client failure preserves values, success/account/agreement/funding explanation and client-guide navigation. No horizontal overflow at either tested viewport.

Readiness component regression verifies mixed checklist states show 50%, exactly one success tick and no implied live signature. Full regression/build/TypeScript results and deployment receipt follow below after completion. Changed-source lint passed with only three existing image-element warnings. One test-only lint naming error was corrected before final validation.

## Owner-dependent and next focused task

- Owner: Clerk MFA plan/entitlement review and first real account/role assignments. Google remains required and owner-deferred; no provider settings were changed.
- Provider: iiDENTIFii and Paystack credentials/contracts, actual provider callbacks and acceptance. Existing synthetic tests are not live provider acceptance.
- Legal/business: approved real documents, entity/employer decisions, signer identity and authority, secure signing interface and operational review procedures. No draft Legal material was published.
- Next focused task after this milestone: authenticated application-to-account linking and applicant progress/recovery, using assigned test identities and keeping Operations review explicit. Do not start it under this bounded resume instruction.

## Final local acceptance

- Final production build succeeded using the current Sites build helper after the hydration fix.
- Full suite: **235 tests passed, 0 failed/skipped**, duration 11,571.700533 ms. Includes Clerk header/role/MFA controls, PSiRA pathways, identity/funding, agreement revocation/context and controlled booking-to-service/payment boundaries.
- First restricted-sandbox suite stalled in a child-process SQLite migration check and was terminated without an acceptance claim. The complete suite then ran successfully with normal local subprocess support. Full successful TAP: `/tmp/lokd-registration-regression-final.tap`; no test expectations were relaxed.
- TypeScript passed; changed-source lint passed (three existing image warnings); diff whitespace check passed.
- Browser final accepted coverage: client mobile+desktop passed in the first run, officer registered/training/not-registered mobile+desktop passed after correction. Latest six-scenario JSON remains at `test-results/mobile-journeys.json` (ignored). Form success/failure responses were synthetic and intercepted; server/provider acceptance is separately bounded by the full regression suite.
