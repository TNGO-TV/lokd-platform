# LOKD factual response to Legal and integration preparation

Reviewed all four v0.1 drafts and Legal's `IMPLEMENTATION-HANDOFF.md`. Prepared within LOKD for central collection; not dispatched. Drafts remain unapproved and none of their wording has been copied into public pages or an acceptance flow.

| Draft | Factual correction / implementation boundary |
| --- | --- |
| Client service pack | Current collection/reconciliation is an internal rehearsal; no Paystack HTTP adapter or live collection acceptance. Full advance funding and zero credit are current operational controls, not settled legal descriptions of fund custody. Exact signed MSA/order/schedules still need binding to booking activation. Client sign-off is service evidence, not a blanket defect waiver or agreement signature. |
| Workforce/payroll framework | Direct Flex and Managed are existing named workforce routes; partner payments go to the partner company, not an officer wallet. Their actual legal/employer classification remains undecided. The existing demo template labelled payroll consent is not evidence of a lawful deduction mandate. New preparation separates bank instruction from deduction authorization; do not describe consent as supplying a missing statutory basis. |
| Privacy/verification notice | Clerk authentication is live. Google is deferred and unavailable; production MFA is blocked by an unresolved entitlement. iiDENTIFii is not connected. The supplied PSiRA number was looked up through the official form, with dated local evidence; this was not a documented API integration or an identity match. Registered work applicants require review; training/unregistered intake avoids a registration rejection but does not grant work eligibility. |
| Website terms | Public enquiries and officer submissions remain prelaunch, with no job/booking guarantee. Authentication alone grants no role. Contact consent is for the requested intake; there is no basis to represent it as marketing consent. Do not publish placeholder contacts, legal entity details, response times, retention periods or unverified cookie claims. |

## Prepared integration contract

`app/lib/agreement-acceptance.ts` reuses the purpose and subject structure of existing onboarding envelopes. It prepares exact-version acceptance receipts from server-loaded approved wording, entity, locale, effective dates and a frozen transaction/application scope. A SHA-256 check detects changed wording or changed transaction context after presentation. The receipt retains the exact copy; later documents cannot rewrite it.

Client agreement acceptance additionally requires an independently verified representative-authority reference. Identity evidence, authority evidence and affirmative action remain distinct fields. Privacy acknowledgement uses a different action from consent/agreement. Marketing, identity consent, bank instructions and deductions cannot substitute for one another. No receipt grants work eligibility or payment authority.

Migration 0031 adds append-only receipt storage with idempotency keys; changed evidence cannot reuse an earlier key. This is preparation, not an enabled signing service: there is no new public acceptance API, no production approved document seed and no promotion of Legal v0.1 drafts. Callers must use authenticated server proof and trusted stored documents; never pass arbitrary request bodies to the helper. Planned receipt retention/deletion under approved policy still needs a controlled procedure; append-only prevents ordinary application edits, not a promise of indefinite legal retention.

## Placement and remaining decisions

- Client: after verified legal entity/mandate and final risk/order scope, before collection/release; bind MSA, order, schedules and price/version together.
- Officer: after identity/credentials and selected employer route, before work activation; separate banking instructions and any lawful deduction authority.
- Verification: collection-specific approved notice and legally selected purpose/basis before provider session creation. Acknowledgement does not itself establish processing authority.
- Existing identity, funding, PSiRA, statutory/payroll, MFA and maker/checker gates remain additional requirements.

Business/legal decisions preserved: contracting entity; actual employer/partner role; approved signatory mandates; lawful pay/deduction schedule; cancellation/refund rules; insurance/liability; staffed rights/complaints contacts; provider data flows/countries/retention; signature method and exact signed-order activation gate. None were filled by assumption.

## Central re-delivery reconciliation — privacy/workforce v0.2

The repeated START-ENGINES assignment was received in the existing owner task after version 41 completion. Hash comparison found client service pack and website terms unchanged; privacy/verification and workforce framework are now v0.2. Both updated documents and the shared handoff were read. Original input hashes remain preserved with a dated recheck rather than overwritten.

- Privacy v0.2 adds collection-purpose/lawful-ground/provider-data schedules and request-channel procedures. Capture those approved decisions alongside the collection context; an `identity_consent` receipt alone must not be treated as a lawful-ground or prior-authorisation determination. Account-free requests, telephone recording/access, staffed routing and retention are not implemented or promised by version 41. Legal's warning against a universal privacy-request response deadline is retained; no automated statutory timer was introduced.
- Workforce v0.2 points to new direct-employment and partner alternatives and requires actual assignment facts before route selection. Preserve hiring, paying, supervision and discipline entities, continuity/substitution, site, grade, roster and gross-pay basis with the classification review and agreement version. Do not choose both routes by default or infer a model from provider readiness. No payroll rate, threshold or formula was changed from the draft's research references.
- Newly referenced officer-employment, partner-personnel and operator-DPA files exist as unapproved companion drafts. Their presence supersedes saying those documents have not been drafted; it does not establish selected/completed contracts or executed provider agreements. Detailed integration remains subject to the actual route and approvals.
- The common implementation handoff still describes v0.1 globally, while the two inspected product files say v0.2. Use the per-document version/hash and approval state, not that overview label, when preparing an acceptance package.

No website code changed for this reconciliation. Version 41 remains the implementation baseline. Drafts are not approved by receipt of the central coordination message.
