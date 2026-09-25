# No-VAT pricing correction — 25 September 2026

Owner decision: **No VAT charged — total R1,600** for the R1,600 quote.

New pricing version `LOKD-SPECIALIST-2026.09-v2-no-vat` stores zero VAT and leaves the service subtotal unchanged. Client, Operations and public pricing copy no longer claim 15% VAT is added. This is a commercial application policy, not a change to South Africa's statutory tax rate.

Canonical migration 0079 adds the new version to the existing pricing, source, funding, offer, activation and commercial-review guards. It enforces 0 basis points for v2 and retains 1500 for historical v1. It performs no booking, quote or receipt data updates. Historical version immutability, cost floors, margins, workforce wages and full-funding controls remain in force. The legacy column default is retained for historical compatibility; new application orders explicitly write zero and the v2 guard rejects the legacy default.

Sandbox migration 0004 extends only the existing separately installed sandbox view. It is not a primary migration and introduces no additional approval or simulated-funding bypass.

Validation:
- 38 targeted pricing, database and quote/accounting tests passed.
- Final complete security gate passed: dependency audit (zero vulnerabilities), lint, types, readiness-schema check, production build, and 572 tests with zero failures/skips.
- Separate-account browser acceptance passed (52.0 seconds including startup). The client saw “VAT — not charged”; the downloaded immutable receipt recorded 160000 subtotal, 0 VAT, 160000 total and the new pricing version. PDF/receipt hashes, wrong-owner rejection, replay, cancellation and fresh revision checks passed. Temporary development identities/configuration were cleaned up and the original local DB restored.
- Hosted migration splitter executes the final migration statement by statement and produces the same schema/integrity result as canonical replay.
- A migration regression preserves an actual v1 database row unchanged, validates both versions, and rejects tax, total and cross-version tampering.
- Sandbox connected specialist journeys pass with the new version. A production-offer negative fixture lacks both current source controls and a named pack; recreated trigger order can report either existing blocking reason, and no offer is inserted.

The initial full run exposed a host SQL parser boundary issue and the sandbox's older v1-only view. Both were corrected and the complete gate then passed. No failure was waived.

External quote email, real Books API comparison, order-linked Paystack TEST collection/settlement and live-card readiness are not proved by these isolated tests. Previously saved evidence and the old Books negative draft remain unchanged. The owner's no-VAT clarification removes the tax-policy mismatch for new quotes; it does not retroactively change old receipts or prove an external accounting link.
