# Independent integrated finance QA — 14 September 2026

**Final disposition: ACCEPT corrected local finance event/accounting integrity scope. The consumed-event defect below was corrected and independently reverified; historical finding retained.** Reviewed current Central `booking-refunds.ts` and canonical0070/0071. Existing corrected refund/credit replacement guards and one-event receipt binding work in ordinary workflows; the referenced older event ledger still permits renaming a consumed event through conflict replacement.

No root source edits, provider/Sites/live services, actual money or credentials. All execution used synthetic in-memory SQLite and injected transport. “live” below means the existing fixture's synthetic live-mode branch with savepoint rollback, never actual live service.

## P1 — replacing a consumed recovery event defeats event reservation

`drizzle/0053_conscious_baron_strucker.sql` defines `booking_collection_recoveries` PK `id`, alternate UNIQUE `(reference,source,payload_hash)`, and UPDATE/DELETE guards. It has no insert-conflict guard. With recursive_triggers=OFF, INSERT OR REPLACE using a new id but the same alternate key deletes/reinserts the original event without firing DELETE guard.

New0071 receipt payload correctly retains signedEventId and signedEventHash, but `booking_refund_matching_events` excludes consumed events by **id**, and approval rechecks that same identity. Renaming the event leaves the first approved receipt pointing to a now-missing old id. The replacement is treated as an unconsumed event even though the signed payload hash/body is unchanged.

Executed full connected proof:

1. Adopt first one-third external refund, deliver one HMAC-authenticated sparse processed event, prepare/independently approve its bank receipt.
2. `INSERT OR REPLACE INTO booking_collection_recoveries VALUES(newId, sameReference, sameSource, sameEvent, samePayloadHash, sameDetail, sameActor, sameTime)` using the actual consumed row. Its old id disappears.
3. Prepare and independently approve a second equal credit/external refund with distinct provider refund ID and bank proof.
4. Second receipt approval succeeds using renamed original event; accounting reconciles twice the one-event amount. No second webhook/provider POST occurs.

Exact supplemental loader `/tmp/lokd-fi06-recovery-replace-loader.mjs`; output `/tmp/lokd-fi06-recovery-replace-tests.log` includes two `QA_RECOVERY_REPLACE_PROOF` markers and actual named test pass. Explicit execution markers also saved `/tmp/lokd-fi06-recovery-replace-executed.log`.

This is a direct-SQL persistence integrity defect, not a demonstrated public endpoint injection. Its severity comes from undoing the new mandatory one-event/one-refund accounting control and deleting evidence consumed by approved history.

Required additive fix: protect existing recovery rows against conflicts on **both id and `(reference,source,payload_hash)`**, independent of recursive triggers. Do not rewrite already applied0053. Preserve normal webhook exact replay behavior deliberately: caller uses INSERT OR IGNORE with a fresh UUID, so a blanket abort on the alternate key changes its idempotency response. A before-insert exact duplicate ignore or corresponding safe caller precheck can preserve replay while preventing replacement/changed content. Approved-event rows must remain identical, with stable ID/hash/detail/order. Do not limit protection to consumed rows if unconsumed conflicting event history can also be replaced.

Required regression: consumed event REPLACE same ID; new ID colliding alternate key; changed detail/hash/source attempts; legitimate exact webhook replay; concurrent duplicates; original row content/count/order and approved receipt/accounting unchanged. Re-run same-event denial and a distinct second-event success after guard integration.

## Passed independent corrected-workflow regression

Supplemental loader `/tmp/lokd-fi06-current-regression-loader.mjs` extends the existing connected fixture only in memory:

- First equal-sized adopted refund consumes one sparse signed processed event.
- Second equal-sized adoption with no new event cannot prepare its receipt; first reconciled amount remains unchanged.
- Deliver a distinct rich processed event for second actual fixture refund ID, perform lookup-only verification, then prepare/independently approve second receipt. Accounting becomes exactly the sum of the two approved amounts.
- Receipt payload signedEventId resolves to the actual recovery row and signedEventHash equals that row's hash. A deliberately altered event hash is rejected on insertion.
- With recursive_triggers=OFF, all9 new immutable finance tables reject same-PK replacement and every alternate physical UNIQUE-key replacement:16 attempted conflicts per mode. Every table's row JSON remains byte-for-byte unchanged.
- Existing ordinary fixture scenarios continue to pass, including partial/full refund accounting, recovery/held status, credit reversal, distinct reviewer and original-funding retention.

Command:

`node --experimental-strip-types --experimental-loader=./tests/cloudflare-loader.mjs --experimental-loader=/tmp/lokd-fi06-current-regression-loader.mjs --test-name-pattern='production intake prepares pending records' tests/assignment-activation-db.test.mjs`

Actual named test passed, zero failures/skips,0.931 seconds; both test/live-mode markers prove injected branches ran. Log `/tmp/lokd-fi06-current-regression-tests.log`. This is one named connected test with many assertions, not a claimed full suite or32 separate named tests.

## Source assessment

`booking-refunds.ts` obtains signed_event_id/hash from final evidence during preparation and includes both in hashed immutable payload.0071 insert and approval triggers rebind observation/case/event/hash and reject previously approved use of the event. SQLite serial write/trigger execution provides a race boundary on approval; an independent explicit parallel two-receipt approval fixture was not added in this bounded pass. Existing physical-key no-replace guards cover the9 newly introduced immutable tables. The unprotected parent recovery ledger is the confirmed remaining gap.

Full build, dispute disposition, bank-details retry, remaining funding release, pagination, EX-01–03/FI-07 and actual provider/account acceptance remain outside this bounded acceptance. No live testing is warranted to find these implementation gaps.

## Final correction and durable regression

Canonical0071 now protects booking_collection_recoveries and booking_provider_recovery_inbox against semantic conflict on PK and alternate unique keys. Exact replay is ignored while retaining original id/time/detail; conflicting source/hash/event/body aborts. This closes the demonstrated renamed-consumed-event reuse without breaking callback or late-link idempotency.

Reviewer authored only `tests/finance-event-integrity.test.mjs` as authorized. It is self-contained, has no /tmp artifact dependencies, and injects synthetic branches into the existing canonical connected fixture in memory. Child-runner context is isolated from NODE_TEST_CONTEXT so standard regression invocation retains named evidence.

- Named test1 verifies both synthetic modes: concurrent duplicate signed callback replay; parent/inbox semantic mutation rejection and stable identity under attempted new-ID replacement; second equal refund denied with only first signed event; distinct second event success; receipt hash binding;16 PK/alternate-key conflicts across9 immutable finance tables with row preservation.
- Named test2 reuses original0054 inbox and late-link trigger definitions with new0071 preserve guards in isolated minimal SQLite. Both early-known-reference duplicate projection and provider-ID-later first projection pass. This targeted trigger fixture is not represented as the entire live collection flow.
- Direct named run:2 passed,0 failed/skipped,1.143s; `/tmp/lokd-fi06-final-event-integrity.log`. Standard `node --experimental-strip-types --test tests/finance-event-integrity.test.mjs`:2 passed,0 failed/skipped,1.151s; `/tmp/lokd-fi06-final-event-integrity-standard.log`. Changed-file ESLint passed with no diagnostics.

No remaining actionable finding in this bounded corrected scope. No provider, deployment, full-build or genuine finance acceptance implied.

Final reviewed hashes:
- `drizzle/0070_credit_notes.sql`: `30c2f5d541488d52606950b1b373651ebfdea5446793b3040c21681c2979a4c2`
- `drizzle/0071_refund_reconciliation.sql`: `f1ebf9cd23cfd14649965597d8c3a7231464731246ae5a339b17609502bfedea`
- `app/lib/booking-refunds.ts`: `2a24b5636882e24455c79b85e861ae7d5e9efdfa9af5f8f322f1df4f7b2726c3`
- `tests/finance-event-integrity.test.mjs`: `af7276181a3baf1b48653e214919c8e75fc329cd6dca2946f5e5069464e03a0b`
