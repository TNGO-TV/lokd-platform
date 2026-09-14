# Refund read pagination handoff — 14 September 2026

Implemented only `app/lib/booking-refunds.ts` read function/types/import, `app/api/booking-refunds/route.ts` GET pagination parsing and new `tests/booking-refund-pagination.test.mjs`. Monetary operate function, short-ID parser, schema and migrations untouched.

## HTTP contract

`GET /api/booking-refunds`

- `pageSize`:integer1–100, default50.
- `dataset`:optional sources/cases/receipts/observations/states. If selected, `cursor` continues only that list; other legacy arrays are returned empty.
- Without dataset, first/requested page of all lists returns. Independent `sourcesCursor`, `casesCursor`, `receiptsCursor`, `observationsCursor`, `statesCursor` continue their respective lists.
- `reference` and `caseId`:optional exact current authorized filters across all datasets. `?dataset=sources&reference=R` resolves a loaded case's source even beyond initial source page. `?caseId=X` refreshes exact case/current source/state and first paged histories before mutation. Unknown/unauthorized lookups return identical empty results.
- Existing arrays unchanged: sources,refundCases,refundReceipts,refundObservations,refundStates. Existing liveRefundsEnabled retained. Add `pageSize` and `pagination` map for requested datasets, each `{hasMore,nextCursor}`; no total counts or hidden inventory hints.
- Duplicate/unknown query keys, invalid bounds, invalid/conflicting cursors and unsupported dataset return400 with private,no-store. Existing authentication/role/workspace checks remain.

Cursor is canonical base64url JSON `[1,dataset,sha256(userId,lowercaseEmail,referenceFilter,caseFilter),after]`. It is opaque validated continuation state, not a signed authorization token. Every query independently enforces current authority before LIMIT; cursor manipulation cannot grant access. Scope changes require a fresh page. Source/state order is ascending reference; immutable case/receipt/observation order is descending rowid. New rows ahead of an existing cursor do not duplicate older pages; refreshing starts from first page. No snapshot isolation across separate HTTP requests is claimed.

## Authority and query behavior

Source filter excludes participant self-review, missing provider binding, invalid amount, funding policy cap, inactive/unverified operator/role and operator financial-limit violations **inside SQL before page selection**. Bounded LIMIT pageSize+1 produces visible-only hasMore. No previous global500-source/100-case/receipt/200-observation cap or application-side cross-authority filtering remains. Receipt/observation pages join directly to their own source and do not depend on first-page case/source inclusion. Final account/role recheck fails the entire response when permission/limit changes during page composition. No mutations/provider/network calls exist in reader.

UI contract delivered to frontend_qa. UI must merge only requested dataset, retain loaded history by stable IDs, explicitly refresh selected case/reference before changes, and handle loss of authority by clearing stale records. UI implementation/acceptance is a separate assigned task.

## Actual verification

New focused suite **8 named tests passed**,0 failed/skipped,319ms:620 authorized records per dataset plus700 hidden participant/over-limit rows, complete traversal beyond former caps, bounded private pages, independent cursors, insertion between pages, malformed/cross-dataset/cross-actor/filter cursors, exact case/reference lookup, authority change mid-read/across pages and HTTP private/no-store validation. `/tmp/lokd-refund-pagination-final.log`. Initial run also passed; final run adds exact case lookup.

Existing durable finance integrity regression **2 named tests passed**,0 failed/skipped,1.139s; `/tmp/lokd-refund-pagination-regression.log`. Changed-file ESLint and whitespace passed. No full build/type/broad regression claim; Central owns final integration. Security_qa received final ready signal/source/contract for separate independent acceptance.

Hashes:
- `app/lib/booking-refunds.ts`: `e30d29fd89136f1840bdf7c2a99caab0c2390cdd2a506c8f9124a80a0f884e01`
- `app/api/booking-refunds/route.ts`: `64467c162d13a402d669c3efe90cd42be7c3f6363c89d7ae1d101f908952bcd1`
- `tests/booking-refund-pagination.test.mjs`: `aa821aac04d0f6759fde37aaacd3c773fa42f6881f90351fae5922eca6f3b671`

## Independent acceptance

security_qa independently reviewed finalized backend delta and passed8 named tests (`/tmp/lokd-refund-pagination-independent.log`). No actionable finding: current-role/limit/participant filtering before LIMIT, scoped canonical cursors, strict private GET parameters and absence of provider calls verified. Backend pagination accepted in reviewed scope; frontend pagination usability remains separate.
