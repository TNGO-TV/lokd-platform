# Dummy R350 enrolment test

Owner requested a dummy test of the registered-officer enrolment path. Created one Paystack TEST checkout with a saved synthetic officer fixture, not a production officer account/application.

- Dummy application: DUMMY-OFFICER-9DE89782
- Reference: lokd-enrolment-test-424cc6792d644a55
- Amount: 35000 minor units, ZAR (R350.00)
- Checkout: https://checkout.paystack.com/zs1bg04jiry5bni
- Callback: https://lokd.co.za/payments/paystack/test/callback
- Fixture and expected-payment record: work/paystack-enrolment/dummy-r350.json (ignored local work data)
- Paystack metadata includes application_id, purpose registered_officer_enrolment, fixture_only=true, financial_effect=none and package_price_minor=35000.

Current status: initialized, awaiting test checkout. Identity verified=false, PSiRA verified=false, work eligible=false. No real applicant, Clerk identity, live charge or service approval created. This exercises a dummy application's expected payment binding; it is not the deployed applicant self-service checkout integration.

Owner must complete hosted test checkout using Paystack test card details. The earlier Paystack browser security challenge prevented automated completion; do not try to bypass it. Reuse this checkout/reference rather than creating duplicates.

On completion, verify via authenticated Paystack transaction verification: test domain, success status, reference, 35000 ZAR and matching metadata application_id. Independently read paystack_test_deliveries and match charge.success provider ID/reference/amount/currency. Keep test payment success separate from enrolment eligibility and live funding. Failed/abandoned, duplicate and recovery paths remain separate acceptance tests; creation alone does not pass them. Never log authorisation or card details from provider responses.
