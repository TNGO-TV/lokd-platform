# Central Command — combined pilot UI and finance documents

Local integration and independent local acceptance complete. No deployment, real transfers, new checkouts, financial communications, credential changes or live enablement. The tested candidate remains in Central's working tree, not a released combined commit. Genuine account/provider/person acceptance is outstanding.

## Integrated sources

- Finance documents: `d0c28d0d6648dc477b317b83f3d46fafc5b6ced7`.
- Usable identity backend: `5e5e9c078c5c6287b75727532bef1fd22fdbdeef`.
- Frontend finish: `0c0140a322045ea4d404d17fd4e6a8e3ab263796`.

Applied feature deltas only, preserving prior frontend, identity, payroll and FI-02 integration. Resolved duplicate fixture migration loading rather than replaying snapshot bases. Added Central integration fixes and the interfaces needed to consume the newly supplied backend contract.

## Usable local journey

Account-scoped case discovery selects linked records without requiring raw references. Operations can prepare readiness policies/assessments, inspect protected review data, review decisions, see paginated exact human hold attribution and prepare independently approved private delivery. Draft/source-change and denial protections remain. Officer-generated private material stays in that tab; only a hash enters the delivery request. Verification uses a cleared URL fragment and a read-only POST body, displays canonical verification result separately from stored status, and performs no scan/arrival mutation.

Payslips, invoices and partner remittance records use canonical financial projections, independent issue approvals, private printable HTML/CSV and immutable versions. Original issue status remains separate from current payment status. Test money/provider success is not paid. The owner's SAST calendar decision is implemented consistently; UTC instants and historical snapshots are preserved.

## Canonical migrations

-0067 `finance_documents`: three finance tables and invoice-booking partial uniqueness;26 custom statements.
-0068 `id_usable_private_delivery`: three private-delivery/provenance tables;18 custom statements.

Journal/schema/snapshots updated. All69 migrations apply under restricted SQLite limits, foreign keys and view checks. Drizzle reports no drift. Earlier numbered migrations remain unchanged.

0067 SHA256: `e7c722ccced6492a80f2a16ece63d1a2e9b6ab519966c00b8440d4b63eef24fa`.
0068 SHA256: `2611b7c675af8c331cab32a81da3bddede7624a6a64e8edad997a96d66f0d6b5`.

## Independent findings resolved

1. Rejected invoice version1 no longer prevents the first actually issued corrected version from assigning the original invoice number. Later issues cannot rewrite it.
2. Invoice-line updates cannot move a line into a frozen invoice source; OLD and NEW invoice IDs are checked.
3. Source/document discovery enforces each source amount against the operator's financial limit.
4. Hold provenance is fetched for the exact requested page, preserving attribution beyond1000 newer events; tested with1105 read-model records.
5. Private verifier shows current canonical result, not just stored active status.

Independent finance QA passed68 named assignment tests plus calendar/state checks and direct constrained migration validation. Independent identity QA passed10 usable-identity tests and the pagination regression, reviewed delivery confidentiality and final UI contracts, and reported no remaining actionable findings in reviewed scope. Central reviewed reviewer-authored invoice changes and ran the full combined regression.

## Final validation

- **364 regression tests passed**, zero failures/skips (26.00 seconds).
- **82 workspace browser cases passed** (42.8 seconds), no assertions/screenshots removed.
- **8 intake browser cases passed** (5.9 seconds).
- Dedicated document browser journey passed readable amounts/SAST dates, issue/current status, correction lineage, private links, retry keys, keyboard and mobile layouts.
- Production build and TypeScript passed.
- Lint: zero errors,19 warnings. Whitespace passed.

The initial combined browser run passed70/78, with six Chromium crashes and two ambiguous selectors. Selectors were corrected. Independent diagnostics reproduced Chromium SIGTRAP with the default temporary-filesystem shared-memory flag; unchanged tests passed using native /dev/shm. The full rerun uses opt-in `LOKD_BROWSER_NATIVE_SHM=true` in the repository browser config. This changes test infrastructure only. Failed logs are retained, not counted as passes. Application previews were stopped before final production build.

All browser evidence uses synthetic accounts and intercepted local data. It does not establish genuine Clerk/account permissions in a hosted environment or real provider acceptance. The owner's original4181 preview is not evidence of this combined candidate.

## Remaining acceptance and release requirements

- Intended Operations/independent reviewer/client/officer accounts, genuine identity/capture/consent/PSiRA sources, approved assessment and payroll/billing identities/policies, selected client/site/service/workforce route and real-device acceptance.
- Approved actual document wording/layout and private delivery procedure. Printable HTML is not a statutory compliance or PDF signoff.
- Authoritative collection refund/reversal and credit-note contracts remain separate: unsupported invoice refund/dispute states stay held.
- Before0067 deployment, inspect existing production invoice duplicates. Representative duplicate fixtures correctly reject the unique index without deleting data; production data was not inspected in this no-deployment checkpoint.

```sql
SELECT booking_id, COUNT(*) AS invoice_count
FROM client_invoices
WHERE environment='production' AND document_type='invoice' AND booking_id IS NOT NULL
GROUP BY booking_id HAVING COUNT(*) > 1;
```

A later release needs a combined source revision, current backup/rollback verification, this preflight, explicit deployment authorization and hosted smoke/real-account acceptance. Both live-payment locks and live-check-in restrictions remain. No new owner task or delivered task message is implied.

Evidence: `docs/launch/final-integration-checks-2026-09-14/`. Earlier missing-interface/document and browser-incomplete entries are historical; this receipt is the current local acceptance record.
