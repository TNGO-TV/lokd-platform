# Finance hardening — 15 September 2026

## Result

FIN-SEC-01 is addressed in source: public payment HMAC receivers enforce a five-second absolute body-read deadline and a 262,144-byte cap before signature verification. Related authenticated finance-body and fixed-origin provider-response hardening is implemented. Root owns integrated build and deployment; this report does not claim publication.

## Changes

- New `app/lib/finance-body.ts` wraps the identity owner's generic `request-body.ts` helper, retaining `SignupError` and the existing `Request too large.`, `Event too large.` and missing-body errors. Timeout failures return 408. Raw callback bytes remain untouched for HMAC verification.
- Migrated the actual test Paystack dispatcher, booking collection callback, live transfer callback, employee test callback and partner test callback. Missing key/mode and malformed signature gates still run before body reading. Oversized/stalled streams are cancelled and reader locks released.
- Migrated six authenticated API mutation routes: payment execution, payment recovery, booking refunds, payroll correction reviews, finance documents and credit notes. Existing 6,000/8,000 limits now apply to actual UTF-8 bytes during consumption, with a five-second deadline. Authentication/authorization still precedes these reads.
- `readFinanceBody` delegates to the shared reader while preserving its finance error type and configurable limits used by existing tests.
- Booking collections/refunds, payment execution, employee/company payment transports and recipient retrieval cap provider JSON responses at 262,144 bytes with a twenty-second read deadline. Existing fixed Paystack URLs, disabled redirects, twenty-second network AbortSignals and uncertain-payment error paths remain in place. Durable claims are not cleared or resubmitted when parsing fails.

## Validation

| Check | Result |
| --- | --- |
| New `tests/finance-body-hardening.test.mjs` | 12 passed, zero failed/skipped; `finance-body.log` |
| Existing test-webhook signature/domain/replay/storage/size cases | 3 passed; `paystack.log` |
| Existing finance authority/race/isolation/body cases | 8 passed; `finance-security.log` |
| Focused ESLint on changed finance files and new test | Passed |
| `git diff --check` | Passed |

The new tests call all five actual receivers with stalled streams and fake valid-shape signatures; every case returns/rejects 408, cancels/releases the stream and makes zero database calls. Byte tests cover multibyte UTF-8 limits and split raw bytes. Four collection/transfer callbacks accept exact chunked signed bytes for unmatched fictional references and reject changed bodies before further database reads. Existing dispatcher tests prove valid signature and duplicate replay behavior against disposable SQLite. Provider tests verify oversized cancellation, timeout, unchanged error mapping and normal small JSON parsing.

The first execution failed during import because the newly shared helper initially used a TypeScript parameter property unsupported by the repository's Node strip-types runner. The helper owner replaced that declaration with an explicit field; the original failure is retained in `finance-body-initial.log`. All final counts above follow that fix and represent distinct cases in those three files, not repeated full regression totals.

No real accounts, provider calls, production data, schema/policy changes, worker changes, commits or deployments were performed by this finance subtask. All signatures and responses were fictional local fixtures. Root performs integrated type/build/full-regression validation across owners.
