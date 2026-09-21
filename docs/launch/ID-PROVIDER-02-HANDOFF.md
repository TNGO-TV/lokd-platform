# ID-PROVIDER-02 — Central integration handoff

14 September 2026. Work stopped at the local implementation checkpoint. **Production identity integration is still incomplete:** accepted capture/composite person proof, upstream recovery and configuration remain missing. No verification/person/account calls, credentials/runtime changes, deployment or live enablement occurred.

Base: `c358358d6ad1ad59ba2f8e39513928c343e5736b`; isolated branch `codex/id-provider-02`. Durable checkout: `/home/ammosync/.codex/visualizations/2026/09/13/01a09c3c-0e07-7132-88c8-123a1dbfc216/id-provider-02`. The adjacent `ID-PROVIDER-02-DELIVERY.json` records the exact final commit, changed-file list and patch hash. `ID-PROVIDER-02.patch` beside it is the incremental integration patch from this combined base. Central's checkout was not edited.

## Delivered behavior

- Documented fixed-host production SAID transport with exact owner/applicant/version/capture/consent commitment, bounded response and strict environment/person/timestamp validation. Registry success is **manual review only**, never a remote-person verification.
- Durable one-shot request claims, explicit policy/expiry provenance, immutable bound receipts and unique provider references. Local receipt recovery survives an ID-01 projection crash without network or duplicate submission. Unresolved delivery remains held.
- Unnumbered additive proposal, fixture tests, frontend/server contract, exact missing specifications and applicant-to-completed-service acceptance checklist. Existing sandbox, approval, PSiRA, currentness, immutable holds, suspension attribution and private passport/token behavior are retained.

Contracts and limitations: [ID-PROVIDER-02-CONTRACT.md](ID-PROVIDER-02-CONTRACT.md). Exact provider/account/consent/PSiRA inputs, sources, partner-route finding and next assignment: [ID-PROVIDER-02-INPUTS.md](ID-PROVIDER-02-INPUTS.md). Proposed migration: [ID-PROVIDER-02.sql](proposals/ID-PROVIDER-02.sql). No shared route/schema/numbered migration change is included; configuration remains 503.

## Local evidence

All commands ran in the isolated checkout with injected transports and synthetic/in-memory data. `/tmp` quota prevented sandbox startup; authorized local escalated execution used the durable directory. No cloud runtime or actual credentials were used.

| Retained evidence under `acceptance/id-provider-02/` | Result |
| --- | --- |
| `provider-final.tap` | Final adapter/proposal: **12 passed**, 0 failed/skipped. Includes all 69 canonical migrations followed by proposal, unchanged pre-existing rows and integrity check. |
| `identity-adapter-integration.tap` | ID-01 plus new real-adapter projection-crash/recovery/approval-denial fixture: **11 passed**, 0 failed/skipped. |
| `regression.tap` | Identity HTTP/usable/review pagination, PSiRA, readiness, applicant, passport and connected service/payroll plus earlier 10 adapter tests: **71 passed**, 0 failed/skipped. |
| `final-targeted.tap` | Activation/service/payroll, rereview and 12 adapter/proposal tests: **91 passed**, 0 failed/skipped. Adapter policy-metadata/opaque-reference refinement subsequently rerun in `provider-final.tap`. |
| `typecheck.log`, `lint.log` | `npx tsc --noEmit` and targeted ESLint: exit 0, no diagnostics/warnings. |

Counts are separate runs with overlap, not an aggregate suite count. The early 9-test adapter run is retained as `provider-tests.tap`. Initial lint found one unused type import; fixed, with initial warning retained. No failed test assertion was suppressed. No build/browser/device/genuine acceptance is claimed for this backend delta. Generated tracked typecheck cache was restored.

Reproduce the final new checks:

```sh
node --experimental-loader=./tests/cloudflare-loader.mjs --test tests/verifynow-production.test.mjs tests/production-identity.test.mjs
npx tsc --noEmit
npx eslint app/lib/verifynow-production.ts app/lib/verifynow-receipts.ts
```

The surrounding completed-service/payroll pass uses the existing Unarmed/commercial_access/direct_flex fixture. It does not establish partner/managed/training acceptance or settled money. The partner responsibility mismatch is documented with exact code references in the inputs register. Historical UTC/SAST uncertainty is superseded by the implemented SAST decision.

## Central checkpoint

Review/apply the incremental patch; assign canonical schema/migration numbering; independently QA the dormant adapter and retained gates. Obtain the exact provider product/capture/recovery specifications and local consent/currentness/private-access policy before assigning ID-PROVIDER-03 to finish capture/composite/recovery dependencies and shared routing. Assign partner responsibility separately. Do not represent this partial provider implementation as full build or live acceptance. The frontend contract is prepared here; no message to the frontend task was claimed as delivered.
