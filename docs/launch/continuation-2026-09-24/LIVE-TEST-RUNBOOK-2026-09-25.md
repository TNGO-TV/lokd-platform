# Controlled hosted testing — LOKD

## Dummy acceptance progress — 25 September 2026

The authorized dummy PDF passed actual browser acceptance with separate authenticated Clerk development accounts in isolated local DB/R2, including downloaded receipt/hash verification. All 15 handler tests passed, including one connected quote notification, acceptance and Books comparison with simulated external transports. See [dummy-quote-acceptance-2026-09-25/REPORT.md](dummy-quote-acceptance-2026-09-25/REPORT.md). Seven local evidence files match VPS hashes.

Draft PR: https://github.com/zenascapetown-code/lokd-platform/pull/26; commit e3112de. Test-only fixes; no deployment or hosted-record changes. External quote delivery, actual Books reconciliation and order-linked Paystack TEST collection/settlement remain unfinished and require safe test integration setup, not real documents or live cards. Preserve completed evidence and sessions.


## Current working mandate — owner clarification, 25 September 2026

**Complete end-to-end testing with dummy agreements, synthetic records, designated test accounts and Paystack TEST cards. Real company contracts, real identity documents and live cards are not prerequisites.** Read [WORKING-MANDATE.md](WORKING-MANDATE.md) before continuing. Exercise actual test sending, opening, acceptance, receipts and accounting linkage while retaining production-like checks. Synthetic review evidence must remain explicitly test-only and must never be recorded as genuine production verification. Resolve the safe testing setup rather than requesting real business evidence to unblock synthetic tests. This clarification supersedes conflicting prerequisite wording below; historical observations and completed evidence remain intact.


Use the existing accounts and the designated synthetic client ENQ-A499FA3E. Do not reset accounts, reuse an unrelated person's officer application, or approve identity/company/authority evidence that has not been inspected.

Provider acceptance update, v96: the owner-only page at https://operations.lokd.co.za/ops/payment-test has completed genuine Paystack TEST success with matching signed webhook, declined/failed and cancelled/abandoned scenarios. Original references and release evidence are in PAYSTACK-PROVIDER-ACCEPTANCE-2026-09-25.md. Do not recreate or repay these checks. They are separate from the customer order-linked flow in step 6, which remains unfinished. Hosted inspection also confirms delivery receipts for the three historical enquiry notices, without extra send attempts; the new enquiry/quote lifecycle remains separate.

## Start with the published UI

v97 update: ENQ-A499FA3E's CRM job was accepted and team email confirmed delivered, one attempt each. Provider request ID and client reference match the independent provider log. Its temporary delivery allowance has been removed. Preserve these records and do not resend; quote/agreement lifecycle notifications still require their own test.

1. Open Operations → Service & payments. In the designated synthetic client's verification card, open **Suspend client approval**. Verify the reason form appears beside that client, then select **Keep unchanged**. This tests the repaired control without suspending anyone.
2. Open Operations → Agreements. Check that each available quote/document action opens its own labelled form. Approval checkboxes must begin unchecked. Closing a form must send no request. Refresh must discard its acknowledgement.
3. On mobile, check that the reason field, acknowledgement, confirmation and cancellation buttons remain readable and reachable. Review the public footer, terms/privacy links and training-centre opening-soon wording.

## Complete the dependent hosted flows

4. Use the current, linked client record and actual reviewed identity, company and representative-authority evidence for any production verification decision. A different authorised reviewer must perform the independent decision. Existing nonbinding test-document approval does not satisfy this.
5. For a designated synthetic quote, use the authorised dummy terms only within the agreed test scope. Confirm the exact scope, price, contracting entity, terms file/version and validity before issuing it. In the actual client session, read the linked terms and explicitly accept the quote. Record the immutable acceptance receipt. Test a superseded/expired quote and access denial without creating a second acceptance.
6. Prepare a collection explicitly in **TEST** mode against that eligible order. Independently review its amount, client version and order. Open checkout through the bound client account. Use Paystack's official TEST scenarios to verify success, decline and cancellation. Record the provider reference, verified callback and saved state. An uncertain result must be reconciled against its original reference; do not create a replacement charge. No real cards or live payments.
7. Verify notification delivery only for authorised designated test records and recipients. Record both queue/provider acceptance and actual delivery receipts; old delivered enquiries do not prove the new quote lifecycle.
8. Reconcile an authorised existing Books estimate/document with the accepted quote, correct customer and VAT amounts. Do not issue a real invoice as a test. Save the comparison result and explain any difference before proceeding.
9. For the simulated service cycle, use a separately owned, linked officer test application with current intake review and nonbinding test signature. No such linked officer record was available in the current hosted inspection. Do not substitute the older unlinked personal application. Simulated collection/payment states do not prove Paystack acceptance or release real work.

## Record the result

For each step capture the date/time, published version, account role, record/reference, expected result, observed result and pass/fail. Retain failures and their original references. Mark a test blocked when prerequisite evidence is missing. Resolve the hosting performance finding before declaring the full launch ready.

The target is a completed end-to-end evidence record, not simply working buttons or green local tests.
