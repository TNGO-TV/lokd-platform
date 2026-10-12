# Operations continuation — 24 September 2026

## Genuine hosted Operations progress

- Signed-in account visibly verified as operations@lokd.co.za.
- Reviewed ENQ-A499FA3E / LOKD SYNTHETIC HOSTED ACCEPTANCE 20260924 as clearly synthetic intake. Saved status: Intake reviewed · further checks pending. The saved note explicitly disclaims identity verification, legal approval, security work, real invoices and live payment.
- Prepared pending client candidate CLIENT-dfb6d752-9156-43d1-a4ed-e7ae6b965dbe, intake version 2. Operations UI confirms pending status and says verification/approvals remain outstanding.
- Fresh delivery UI shows ENQ-A499FA3E CRM enquiry and team enquiry notice queued, attempts 0. No processing action was taken; the existing delivery allowlist remains unchanged.

## Confirmed UI defect and isolated fix

Clicking Issue or retrieve test agreement did not issue a document. Browser console recorded `Error: prompt() is not supported.` at 2026-09-24T20:43:02.454Z. Refresh still showed no test document.

Isolated checkout: /srv/ammosync/workspaces/lokd-test-agreement-forms.
PR: https://github.com/zenascapetown-code/lokd-platform/pull/21
Candidate: 429a072245872692700a87059871cd2da97356c5
Base: ee2500dc05fe536b968e824f6cc0bced3931cbbe
Candidate tree: 986b3b4daa6253a18ec55822e333cadc5f5a1355

The fix replaces native prompts/confirmations only in TestAgreementPanel with labelled inline forms. Signing and review acknowledgements are unchecked and explicit; exact case/document versions and hashes are retained. Dismissal sends no mutation. Failed requests retain input; successful refresh discards stale drafts; access loss clears private document state; a synchronous lock blocks overlapping requests. Server permissions and state rules are unchanged.

Local required security gate passed: locked dependency installation, audit, lint, types, canonical schema, build, 559 tests passed with zero failures/skips, tracked source unchanged. Eight focused desktop/mobile mocked UI checks passed with prompt/confirm unavailable. Independent source review approved the three-file scope without findings. Existing account-cycle test was adapted, not executed against Clerk. GitHub run 36058035939 completed successfully, including every job/step and source cleanliness.

PR21 merged with expected-head guard as bdae0ee78c9d96c92165a1cceb7475bee103b6b5. Tested and merged trees match. Canonical source integrated by fast-forward while preserving launch records. Required Sites workflow packaged the unchanged tested artifact; v93 deployed successfully at 2026-09-24T21:03:24.517896Z, environment 34. Deployment appgdep_6ab58ff882c08191b388a96e3a020bb4. Full receipt: TEST-AGREEMENT-FORM-RELEASE-2026-09-24.json.

Fresh genuine hosted Operations UI on v93 successfully issued test-journey-20260912-v1-issue-1 at 2026-09-24T21:05:02.601Z for ENQ-A499FA3E, submission version 2. Exact wording begins LOKD TEST AGREEMENT — NOT A LIVE CONTRACT and explicitly grants no employment, service, training, charge or work authority. This is hosted nonbinding test-document issuance, not quote issuance or email delivery.

Repeated issue/retrieve preserved issue 1, its original note and single issuance activity. The cancellation form displayed exact revision 1. Cancellation succeeded at 2026-09-24T21:06:33.286Z and retained the original issuance activity. Replacement test-journey-20260912-v1-issue-2 was issued at 2026-09-24T21:06:48.235Z; the UI simultaneously retains cancelled issue 1 and issued issue 2. This test-document evidence does not close the distinct hosted quote lifecycle task.

The user made the genuine testclient@lokd.co.za session available. Fresh client UI verified the email, same linked enquiry, cancelled issue 1 and issued issue 2. Read exact issue-2 wording and submission version 2. The form showed revision 1 and an initially unchecked nonbinding acknowledgement. Entered the source intake's synthetic contact name LOKD Test Client, explicitly checked the acknowledgement and recorded the authorized test signature. Hosted UI changed to signed test with dated activity 2026-09-24T21:09:29.397Z and message Account-bound test signature recorded; Operations review pending. No real legal contract was accepted.

Reloading the Operations tab then correctly denied testclient@lokd.co.za. The shared browser login changed across portals; old Operations tab content must not be mistaken for a retained Operations session.

The user subsequently supplied Operations access again. Fresh UI confirmed operations@lokd.co.za, and issue 2 was signed_test at revision 2. Read exact wording and dated signing activity, then saved a factual test-only review with explicit acknowledgement. The note cites observed genuine testclient sign-in, linked enquiry/contact, exact issue-2 wording, explicit test acknowledgement and signing timestamp; it expressly disclaims real-world identity, company mandate, legal review, service and payment approval. UI confirmed reviewed test and dated reviewed_test activity at 2026-09-24T21:13:43.707Z, retaining all prior history. The review was performed under the different Operations account. Current active browser session is Operations.

Hosted nonbinding document issue/retrieve/cancel/replacement/owner-signing/Operations-review steps are now evidenced. This does not claim every adversarial replay or unrelated-account test was exercised on the hosted deployment, nor does it satisfy the distinct quote/provider acceptance tasks. Asked for existing authorized client identity/company/authority evidence and legally reviewed terms locations to advance the production quote workflow truthfully. No new account or role setup is needed.

Temporary loopback-only UI fixture used port 4415 and was stopped after validation. Release artifact copied off-host with matching SHA256 e38786016f2f92ed0cff9bef39a37f9c2a3e5a6ce5fd5e396b2b1d099b3ae18b. This artifact copy is not a new encrypted full recovery backup or production database snapshot. Existing v92 recovery archives remain intact.

## Source-grounded acceptance dependencies

The available test agreement is fixed nonbinding wording, not a hosted quote, and its API queues no lifecycle email. Genuine client sign-in is required to sign. Test review still requires actual reviewed test identity/authority evidence; do not invent it.

The production quote route requires a currently verified client. Client verification requires actual identity/company/authority source references, truthful reviewed-documents attestation and a separate Operations owner decision. Preparing a service order then requires actual site/risk details. Terms approval requires truthful legal review and exact PDF hash. Dummy terms permission does not establish any of these approvals.

Paystack TEST can use a booking collection without an officer/PSiRA record. It still requires the approved client, prepared unfunded service order and independent funding review. The collection module itself does not require quote acceptance before TEST checkout. No collection, payment or invoice was created.

Source references: app/lib/production-client-review.ts, app/lib/production-orders.ts, app/lib/quote-acceptance.ts, app/lib/booking-collections.ts, app/lib/test-agreements.ts and their corresponding UI controls. All five hosted/provider acceptance tasks remain open.
