# ID-SEC-01 hardening — complete

15 September 2026. Implemented after the release security review, without accounts, provider requests, deployment or shared database mutation.

## Change

`app/lib/request-body.ts` provides `readRequestBytes` and `readRequestText` for request/response bodies. The helper enforces the configured byte cap while streaming, rejects invalid/oversized declared Content-Length before pulling, does not trust an understated length, applies one absolute five-second deadline, and cancels without waiting for a stalled cancellation. Text decoding rejects invalid UTF-8. The raw-byte API preserves signed provider bytes. `RequestBodyError` carries typed 413/408/400 failures without depending on business modules.

Migrated all 21 full-buffer body reads across the assigned 19 non-finance route files. Existing route handlers now return the typed request-body error through their ordinary private JSON error response; authentication/business checks remain in their original order. Existing numeric limits are now byte limits. Malformed UTF-8 receives 400 and incomplete stalled bodies receive 408. Empty bodies still reach each route's existing invalid-JSON handling.

Also replaced the separate `/api/passport/verify` streaming implementation with the helper: it retains its 2,000-byte cap and adds the same deadline/strict decoding. Finance and evidence owners consume the shared helper independently.

## Completed route inventory

| Route | Byte cap |
| --- | --- |
| applications POST/PATCH | 16,000 |
| enquiries POST/PATCH | 14,000 / 4,000 |
| identity | 3,000 |
| production-identity | 64,000 |
| production-operations | 24,000 |
| signup | 12,000 |
| enrolment | 2,000 |
| presence | 1,500 |
| psira | 14,000 |
| agreements/production | 110,000 |
| agreements/test and test-cycle | 4,000 |
| onboarding | 8,000 |
| operations | 8,192 |
| platform | 16,000 |
| pilot | 32,768 |
| feedback and passport | 8,192 |
| specialist | 100,000 |
| passport/verify | 2,000 |

After all owners' concurrent migrations, the inventory search found zero `request.text()`, `request.json()` or `request.arrayBuffer()` calls remaining under `app/api`. Finance/evidence changes and final combined validation belong to Central and their respective owners.

## Validation

- [identity-body-tests.log](identity-body-tests.log): **7 passed**, zero failed/skipped. New tests cover exact raw bytes; missing/understated/invalid Content-Length; split multibyte UTF-8; early overflow cancellation; malformed UTF-8; stalled stream and stalled cancellation; absolute deadline across progressing chunks; both actual anonymous intake handlers reject before storage access.
- [identity-routes-tests.log](identity-routes-tests.log): **24 passed**, zero failed/skipped across production identity HTTP, signup workflow, client enquiries, PSiRA, onboarding, pilot access and account-bound presence.
- [identity-passport-tests.log](identity-passport-tests.log): **2 passed**, zero failed/skipped. Existing early-cancel/byte-limit passport tests remain passing.
- Total targeted assertions: **33 passed**, zero failed/skipped. No hosted/provider tests were executed.
- Initial helper test load exposed Node 22 strip-only incompatibility with TypeScript parameter properties. Replaced the constructor parameter property with an explicit field/assignment; all three consuming owners were notified before final passing runs.

The original security report and 1 MiB reproduction log remain historical pre-fix evidence. Its script is explicitly marked historical; current `tests/request-body.test.mjs` asserts the fixed early-cancellation behavior. No additional shared configuration, schema or authentication-policy changes were made.

## Lesson

Enforce resource limits while reading, not after materializing an entire body. Use byte-preserving input for signatures and strict text decoding only for text consumers. Reuse a single bounded implementation and validate actual public handlers so future routes do not silently restore full-body buffering.
