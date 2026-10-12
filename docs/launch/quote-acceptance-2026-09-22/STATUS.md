# Quote acceptance release — v81, 22 September 2026

## Outcome and owner decision
LOKD uses an uploaded standard terms PDF linked from each quote, an explicit unticked acceptance checkbox, and a retained acceptance record. A client does not sign a separate contract for each assigned officer. Earlier per-assignment client pack proposals are superseded.

v81 deployed successfully at 2026-09-22T18:18:16.176028Z, environment revision24.
URL: https://lokd-security.zenas-capetown.chatgpt.site
Operations: https://operations.lokd.co.za/ops/agreements
Version: appgprj_6a88a08505548191b266e9b711562ae3~appgver_e969d37b94a48191bb26adf2c7ad3c40
Deployment: appgdep_6ab2c6443800819195b40c11ba133cc4

## Release evidence
PR https://github.com/zenascapetown-code/lokd-platform/pull/9 merged.
Exact tested head: 4695fe2dcff3039007e817419d073ac5ee96c78c.
Merge/source: 42f94531d0de33236efbd5c56f1e4bbb4298e691; tested/merged trees identical.
GitHub gate https://github.com/zenascapetown-code/lokd-platform/actions/runs/35765121996 completed success. Every job and step inspected.
Local full gate: 541 tests passed, zero failures/skips, audit/types/schema/build passed. Four lint warnings remain: three existing, one unused test import. No warning is represented as a failed check.
Seven new isolated domain/API scenarios; four mobile/desktop UI tests with mocked responses passed.
Initial migration test exposed hosted json_object argument limit; corrected using bounded JSON merges and revalidated. The earlier candidate CI was superseded/cancelled, not accepted.
Archive SHA256: ad974ac14389eba9b812fb3cb5602bd51df9a9ec6f066afab934dd3884cfd59f. Remote and Windows copies match.
Native archive normalization SHA256: 83a02064a25c1b9f698a75c65db31500871b5cf7a426e887d2fdfebcab0fc50b.

## Implemented
Private immutable PDF terms versions, explicit owner approval, exact quote/client/site/scope/grade/price binding, named-client checkbox acceptance, receipt download, cancellation/revision history, source/expiry/withdrawal checks, atomic receipt guard and activation epoch invalidation. One current order acceptance satisfies both client agreement requirements across staffing assignments. Workforce, identity, funding, independent activation and safety gates remain.

Notifications reuse the existing controlled outbox and verified-email lookup. No customer-wide delivery, new permission grant, invoice or financial gate was enabled.

## Actual hosted verification
Authenticated Operations loaded Quotes and terms successfully, including Upload standard terms and Issue a quote with linked terms. Both forms opened; no terms or orders existed, and Issue quote and queue notification was correctly disabled. No placeholder contract was uploaded or approved.
Anonymous GET /api/quotes?scope=operations returned HTTP401 with Sign in to your account.
Existing actual CRM and email results still displayed with send attempts2; no resend was performed.
These checks prove hosted migration/read access and form availability, not actual client acceptance or new provider quote notification.

## Remaining prerequisites and limits
Final completed terms PDF and authorised owner approval are needed before issuing quotes. Actual acceptance additionally needs an existing authorised client account and reviewed prepared client/order. Sending stays restricted to designated test sources/recipients under revision24.
New quote notification delivery, real hosted client acceptance, broader Books quote/invoice mapping, and actual Paystack test checkout/webhook/independent settlement verification remain outstanding. Real payments, invoice issuance and real identity submissions remain deferred.

## Preservation and recovery
v77 through v80 history retained. Canonical checkout fast-forwarded from445f98b to42f9453 while preserving its three modified documentation files and all untracked evidence. No reset/clean. Release checkout is clean. Temporary frontend test server stopped.
Encrypted source/build backup and restore receipt are stored alongside this report when completed. This is not a fresh production-data or secret snapshot; production snapshot remains historicalv73. Off-VPS Windows copy is separately hash-verified; cloud sync is not assumed.

## Learning
Bind client acceptance to the quote and immutable terms, not individual staffing assignments. Record owner corrections before widening workflow scope. Check hosted SQLite limits as well as Node SQLite. Preserve source failures and correction evidence. Use the REST PR update when old gh pr edit fails on the retired Projects classic API.
