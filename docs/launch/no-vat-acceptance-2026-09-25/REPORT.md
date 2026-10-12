# No-VAT release and acceptance continuation — v98

The owner explicitly confirmed **No VAT charged — total R1,600**. This supersedes the earlier ambiguity about adding R240 VAT. New quotes use `LOKD-SPECIALIST-2026.09-v2-no-vat`: net R1,600, tax R0, total R1,600 for Scheduled Flex. Public pricing, client quote and Operations wording were corrected. Migration 0079 validates both historical 15% and new zero-charge versions without rewriting existing orders, quotes or immutable acceptance receipts. Cost floors, margin, review, full funding and activation guards remain.

## Published result

- Native Sites version **98** succeeded on 25 September 2026 at 09:42:57 UTC. Existing public audience/runtime configuration retained.
- Production URL returned by Sites: https://lokd-security.zenas-capetown.chatgpt.site
- PR26: https://github.com/zenascapetown-code/lokd-platform/pull/26
- Tested head `222062299bc55f1b8747be81c6d4fcd00818581c`; base `dfbc7c2d3456c78f661460fc411b289d0f82bc25`; guarded merge `6982cdad514f1ab0af54e0b62b19e260eb7d5e2e`.
- Exact-head CI https://github.com/zenascapetown-code/lokd-platform/actions/runs/36118756862 completed successfully, every job/step checked. All **572 tests passed**, none failed/skipped; audit, lint, types, canonical schema and build passed. Existing unrelated officer-app lint warning remains.
- Published source `26f500c2eeeb1ea866ab8c9f7c3b718158d5ac42` has the exact same tree as the tested head and merge. Packaging initially picked up local test/evidence files; that was corrected before version save/deployment and all files remain on disk. No intermediate source was deployed.
- Canonical VPS checkout fast-forwarded to the merge, preserving existing modified/untracked documentation. The Sites-only packaging commits were not pushed to GitHub main.
- Local/VPS release archive SHA256 `79a296fcecb43cba9357abb77d8662f21bcb7bedaf9ef6d54197af61aa7cead9`. Native Sites reports its own normalized archive content hash in RELEASE.json.

## Acceptance evidence

The separate authenticated browser test passed using isolated DB/R2 and temporary Clerk development identities. It verified explicit acceptance, PDF/hash binding, a R1,600/R0/R1,600 receipt, wrong-account/replay rejection, and cancellation/revision invalidation. Cleanup restored the original isolated DB and removed temporary test identities. The receipt is historical evidence: the test subsequently cancelled that quote and issued a fresh unaccepted revision. No saved screenshot is claimed for this run.

Actual Books **unsent DRAFT QT-000002** (`1471321000000103024`) matches the new receipt manually: same quote reference, explicitly mapped synthetic customer, order/version in notes, ZAR subtotal/total R1,600 and no VAT addition. See BOOKS-COMPARISON.md for exact fields and limitations. Customer `1471321000000103017` has no email/contact person or portal access. Earlier negative draft QT-000001 and prior provider/enquiry evidence are unchanged. Existing Books sessions are preserved.

## Unfinished work

This release and Books UI comparison do not establish actual external quote notification delivery, application-side Books API reconciliation, order-linked Paystack TEST collection/settlement, genuine customer verification or live-card readiness.

A separate owner-private test Site was created in a concurrent continuation; see ../PERSISTENT-ACCEPTANCE-SETUP.md. Its recorded source predates this no-VAT change. Before further hosted synthetic testing, its owning task must integrate/review the no-VAT source while preserving the test banner, allowlisting and rejection of live configurations, and finish the documented supported credential/callback setup. The separate Site was not modified here. Do not revert live pricing to v97 or rewrite historical quotes to make comparisons pass.

Preserve the existing mandate: dummy PDF and designated test accounts only; no real invoices, live-card charges, officer payments or service activation. Do not repeat completed enquiry/provider-only cases. No login or production client approval was requested/performed.
