# Provider boundary observed during the full flow review

21 September 2026; reviewed source `be67bc32b513785c20cfa878252f9ebd09f37437`.

These are source/configuration findings, separate from passing isolated test cases. No provider transaction or production configuration change was performed.

| Path | Existing implementation | What remains before real use |
| --- | --- | --- |
| Client booking collection | `app/lib/booking-collections.ts` initializes/verifies Paystack transactions, validates exact amount/currency/order metadata and signed webhooks, retains an uncertain original claim, and supports separate test/live keys. `production-operations.ts` routes the client/Operations actions. | Actual designated Paystack test checkout and provider-delivered webhook/API matching have not been verified in this round. Live configuration and the collection gate remain absent/closed. |
| Receipt versus booking funding | Collection verification deliberately returns `funded:false`; a successful live collection is `matched_live_unsettled`. `booking-settlements.ts` handles separately reviewed funding. | A card success is not proof of bank settlement or permission to dispatch service. Verify the intended receipt and settlement/reconciliation progression with the actual provider before opening customer payment. |
| Registered-officer R350 enrolment | `/api/enrolment` imports `test-enrolment.ts`, requires an explicit test acknowledgement, accepts only a test key, and uses a fixed test callback URL. | This route has no live mode switch. A reviewed live enrolment integration and the correct callback destination are implementation work, followed by provider test acceptance. Replacing the key alone cannot make it live. |
| Combined finance and training | `/api/finance-workflows` instantiates `DeterministicFinanceProvider` for dispatch/recovery. Its sandbox guard requires isolated configuration. | A production provider adapter/routing path for the newer combined workflows is not supplied by enabling a flag. Preserve the tested accounting rules while implementing and validating the actual boundary. |

## Credential and test capability

Native Sites environment revision 19 exposes test-named Paystack key entries, but secret values are redacted. Targeted checks of the current process and local environment files found no usable Paystack secret. The hosted environment read is not authenticated Paystack evidence and does not establish account capabilities. No live secret or collection-enable flag was present in that environment response.

The existing `scripts/finance-paystack-test-probe.mjs` is a network-free inventory script, not a provider acceptance test. Earlier finance records explicitly retain an automatic-review rejection of a provider probe; this run did not retry that probe or attempt to extract hosted secrets.

Hosted account suites in `tests/accounts/` require designated Clerk development credentials and provisioning. They were not run as part of the isolated review. Current production sign-in, real provider behavior and physical-device acceptance are therefore not proven by the browser fixtures.

## Smallest next payment milestone

1. Make a designated Paystack **test** credential available through an approved private configuration path; do not paste it into reports or commit it.
2. Validate the existing booking initialize/checkout/verify/webhook path using Paystack's published synthetic payment details. Keep success, rejection and original-reference recovery evidence; do not invent signed provider delivery.
3. Implement the missing live enrolment and combined-workflow provider boundaries if those products are included in the launch scope. They are separate from already-tested accounting and role rules.
4. Once sandbox compatibility is established and live scope is explicitly approved, configure the chosen live path and perform one controlled real payment with its receipt/reconciliation evidence before opening customer checkout. This does not require repeated real card charges.

Official contracts consulted: [Paystack test payments](https://paystack.com/docs/payments/test-payments/), [transaction API](https://paystack.com/docs/api/transaction/) and [webhooks](https://paystack.com/docs/payments/webhooks/). These documents describe provider behavior; they do not establish that this account or deployment passed it.
