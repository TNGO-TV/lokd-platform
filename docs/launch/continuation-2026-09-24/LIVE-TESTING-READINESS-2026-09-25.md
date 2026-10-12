# LOKD live-testing readiness — 25 September 2026

## Current working mandate — owner clarification, 25 September 2026

**Complete end-to-end testing with dummy agreements, synthetic records, designated test accounts and Paystack TEST cards. Real company contracts, real identity documents and live cards are not prerequisites.** Read [WORKING-MANDATE.md](WORKING-MANDATE.md) before continuing. Exercise actual test sending, opening, acceptance, receipts and accounting linkage while retaining production-like checks. Synthetic review evidence must remain explicitly test-only and must never be recorded as genuine production verification. Resolve the safe testing setup rather than requesting real business evidence to unblock synthetic tests. This clarification supersedes conflicting prerequisite wording below; historical observations and completed evidence remain intact.


The site is not yet cleared for full business launch or real-money testing. The current work distinguishes local regression results, hosted synthetic records and actual provider evidence.

**Latest release: v97.** Published 2026-09-25T02:28:38.414213Z, environment revision 36. PR 25 merged as dfbc7c2d3456c78f661460fc411b289d0f82bc25 after exact-head CI 36085772186 passed every stage and all 570 tests. Four targeted mobile/desktop checks passed. Delivery loading and unindexed-receipt status are corrected. The newest synthetic enquiry now has CRM acceptance and confirmed email delivery at one attempt each. Hosted reload verified both corrected loading and retained receipt. Full evidence: ENQUIRY-DELIVERY-ACCEPTANCE-2026-09-25.md.

**Previous release: v96.** Published 2026-09-25T01:23:52.570464Z, environment revision 34. PR 24 merged as 6fb4c9c23e5e4112cb0bf57d9cb75e8055354431 after exact-head CI 36081162755 passed all 570 tests and every required stage. Four targeted mobile/desktop tests passed. Three genuine hosted Paystack TEST scenarios are now complete: success verified against its signed webhook, decline reported failed, and cancellation reported abandoned. Full evidence is in PAYSTACK-PROVIDER-ACCEPTANCE-2026-09-25.md. This does not enable live charging or prove production quote/accounting settlement.

**Published:** v95 succeeded at 2026-09-24 23:56:59 UTC (25 September 01:56:59 SAST), environment revision 34. PR 23 merged as 1e4d2cae00a851e240d5a5741cb06b5ebf2510f1. The merged tree matches final tested candidate 8028916433fceda165264294ff82dab8f4dc6743. Security CI 36073999373 passed every stage and all 559 application tests. Release provenance is in INLINE-APPROVALS-RELEASE-2026-09-25.json.

**Hosted read-only interaction verified:** Operations → Service & payments displayed the synthetic client still pending at intake version 2. Opening Suspend client approval showed the inline reason form. Keep unchanged closed it and returned focus to the trigger. No suspension or other write was submitted. Recent worker error logs returned no events. The Operations session remains available in the browser for continuation.

## Completed

- v94 presentation release: self-hosted Inter, responsive layout and typography checks, nationwide enquiries copy, company/address footer, social links, terms and privacy pages. The five training centres are labelled opening soon.
- Hosted synthetic client ENQ-A499FA3E is linked to testclient@lokd.co.za. Its replacement nonbinding test document was signed by the client and reviewed in Operations. This is not identity verification, production quote acceptance or service authorisation.
- Inline approval repair: quote and agreement approval/cancellation, client review, collection approval, activation, checkout, operator suspension, evidence review/correction, identity recovery and simulated cycle transitions now use visible forms. Required acknowledgements begin unchecked. Failed requests retain findings; refresh and access loss clear source-bound confirmations; synchronous locks block duplicate submissions.
- Initial candidate 498ae84730480d8371b67e8420abb2da788e4ac6 passed local security checks and 559 application tests. Review then found that a successful sandbox confirmation could remain open. The follow-up returns explicit success/failure, enforces the callback type and covers the sandbox inspection gate in a browser regression. Final candidate 8028916433fceda165264294ff82dab8f4dc6743 builds successfully and passes 20 targeted mobile/desktop browser checks with mocked responses. Visual checks at 360px and 1280px show aligned confirmation text and no horizontal overflow. PR 23 records the release review and v95 publishes that exact source tree.

## Evidence still needed

| Acceptance area | Current limitation | Next evidence |
| --- | --- | --- |
| Hosted quote lifecycle | Synthetic client has no reviewed identity, company or signing-authority evidence. Dummy terms are authorised for designated tests, but genuine verification must not be invented. | Eligible client record, independent review and a quote accepted through its actual owner session. |
| Officer service cycle | Operations officer intake currently exposes one older, unlinked application; no linked synthetic officer application is available. | Owned officer test submission with current intake review and nonbinding test signature. |
| Lifecycle email delivery | ENQ-A499FA3E now has CRM acceptance and confirmed team-email delivery, each with one attempt. Provider log and LOKD receipt agree. Historical delivered notices retain original attempt counts. Temporary source allowance was removed and revision 36 deployed. | Quote/agreement notifications remain separate acceptance work. Provider business validation is not submitted and the dashboard shows a 100-email daily cap. See ENQUIRY-DELIVERY-ACCEPTANCE-2026-09-25.md. |
| Books reconciliation | Fresh authenticated inspection of Books organisation 940131426 shows All Quotes and All Invoices empty. No accepted hosted quote/accounting document pair exists for comparison. | Complete the designated quote lifecycle and exact customer/amount/VAT comparison. Real invoice issuance remains deferred. |
| Paystack payment path | Genuine provider TEST success, signed webhook, decline and cancellation are now verified through the owner-only test page. These separate records cannot fund production orders. | Complete customer quote/payment/accounting linkage and settlement acceptance before a live-card claim. No real cards or money used. |
| Hosting performance | Earlier latency evidence/support escalation remains unresolved. | Provider finding or measured corrective change; do not repeat unchanged probes as progress. |

Operations was visibly signed in as operations@lokd.co.za during the current read-only hosted inspection. No verification approval, real charge, invoice, service activation or officer eligibility decision was made.

Navigation-only unsaved-draft discard confirmations remain outside the approval repair. Final legal wording, registration details and any additional public contact details must come from the business; none were invented.

## Retained validation failures and recovery

- The first two error-state assertions expected an exact server message, but the existing UI correctly appended recovery guidance. The matcher was corrected; failure-state drafts and access-loss clearing passed.
- A later browser run could not connect after the retained preview session ended during continuation. The isolated preview was restarted, its HTTP response checked, and the affected suite passed. This was a preview availability failure, not a hosted-site result.
- Review caught a real sandbox callback mismatch. It was fixed before publication, rather than counting the first green CI run as sufficient for the changed candidate.
