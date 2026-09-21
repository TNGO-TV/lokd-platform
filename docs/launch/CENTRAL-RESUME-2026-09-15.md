# Central recovery — 15 September 2026

The owner confirmed that this task resumes the inaccessible **Central 2** task (`01a0a08a-d726-7613-9ede-d0e24c452c1b`). Recovered its latest messages and local acceptance records. No replacement implementation assignment was dispatched.

## Verified state

- Workspace HEAD remains `d2e877c`; working tree was clean before this recovery note.
- The integrated local build and prior validation are documented in `central-sandbox-final/ACCEPTANCE.md`. Those checks were not repeated during recovery.
- Fresh Sites metadata: project `appgprj_6a88a08505548191b266e9b711562ae3`, latest saved version 69, active site at https://demo.lokd.co.za. No publication occurred during recovery.
- Fresh environment metadata: revision 15 contains secret-marked `PAYSTACK_TEST_SECRET_KEY` and `PAYSTACK_TEST_PUBLIC_KEY`, both with redacted values. The process has no usable Paystack key; `.env.paystack-test` is absent. No key value was printed or saved, and no authenticated provider request was attempted.

## Provider evidence correction

The latest acceptance summary's blanket statement that actual Paystack checks were unexecuted must be read as applying to the **new integrated finance workflows**, not the entire project's history.

`../checkpoints/PAYSTACK_TEST_ENDPOINTS_2026-09-11.md` records an actual completed test checkout, server API verification, and durable signed `charge.success` webhook for reference `lokd-test-5ff9b3949d8b4f04`, provider ID `6546773902`, ZAR 100 minor units. This is recovered historical evidence, not newly executed verification. It does not establish the newer finance workflows' provider compatibility, refund/transfer/recovery behavior, bank settlement, or live acceptance.

## Resume point

**Superseded by the owner's subsequent clarification:** finish the complete build using fictional data, simulated business rules and deterministic provider boundaries. Real accounts, devices, actual provider checks and live acceptance come only after the work is complete. The credential-access steps below are retained as deferred external-validation history; they are not the current next action or a build blocker. Current action: the three build-only closeout assignments recorded in `build-closeout-2026-09-15/CENTRAL.md`.

1. Make the existing Paystack test key available through an approved protected local secret mechanism, such as ignored `.env.paystack-test`, without posting it in conversation. Hosted configuration is present; do not label it missing or replace it merely because its value cannot be retrieved.
2. Reuse the existing transaction reference for initial read-only verification. Check current provider contracts before extending tests. Do not duplicate the completed checkout as a substitute for testing the outstanding newer workflows.
3. Complete genuine supported provider test cases and record exact boundaries separately from simulator results. Preserve the earlier automatic-review rejection as historical context; no new rejection occurred during this recovery.
4. Continue release preparation from the accepted local source with the applicable owner instructions and existing live locks. No deployment or live enablement was performed by recovery.

## Reusable lesson

Observation: the most recent handover omitted a successful older provider milestone. Action: compare the latest summary with the provider checkpoint and fresh configuration metadata. Result: recovered existing evidence while identifying the current credential-access gap; avoided a duplicate checkout and unnecessary configuration changes. Next evaluation: validate that future acceptance reports distinguish historical provider evidence, new workflow evidence, and current access capability. Usage savings were not measured.
