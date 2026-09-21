# Central sandbox discovery and original-command recovery

All APIs authenticate the current verified user. Operations require existing Operations policy/MFA. All business reads/writes use `requireSandboxCompletion` and the separate marked `SANDBOX_DB`; primary DB is never aliased. Responses are private/no-store. Simulation records never confer production work eligibility.

GET `/api/sandbox/discovery` returns `{mode:'simulator',policyVersion,policyHash,policy:{consentVersion,consentText,scenarios,captureMinutes,retentionDays},productionWorkEligible:false,capabilities:{operations,owner,canCapture,canGrantEvidence},data}`.

- `view=intake&kind=officer|client&offset=0`: existing SignupRecord `records,hasMore`; optional `applicantId` adds authorized complete public `history:{items,hasMore,nextOffset}`. Existing record details and version are preserved.
- `view=identity&applicantId=optional&offset=0`: `captures` (captureReference/applicantId/applicantVersion/consentVersion/scenario/capturedAt/expiresAt/withdrawn), safe current `cases`, consent events and private grant metadata. Shared page offset, `hasMore,nextOffset`. No raw provider object/hash/body.
- `view=officer&offset=0`: `officers:[{id,label,applicantId,applicantVersion}],hasMore,nextOffset`.
- `view=officer&officerId=...&offset=0`: `readiness`, `deliveries`, `rereview`, `history:{reviews,passports,dispositions,incidentEvents}` and `incidents`; history datasets have `items,hasMore,nextOffset`.
- `view=record&kind=identity|officer|readiness|rereview|case&id=...`: corresponding existing authorized safe reader on sandbox binding.
- `view=review&kind=queue&recordType=officer|rule|review|passport|disposition|workforce&state=all|pending&offset=0`: Operations-only existing queue `records,nextOffset`. `kind=detail&id=...` returns audited protected review; raw identity details are denied and remain behind separate independently granted evidence reader. `kind=holds&id=applicantId&offset=0` returns paginated complete hold audit.
- `view=command&scope=capture|officer_application|client_enquiry|import_finance&requestKey=...`: own original request only: `{requestKey,scope,status:'completed'|'pending',recorded,result:originalReceipt|null}`. Other accounts receive generic404 even if Operations.

Existing POST `/api/sandbox/identity` capture and `/api/sandbox/application` officer_application/client_enquiry/training(import_finance) require TOP-LEVEL `requestKey`. Existing action/service/input shapes otherwise remain unchanged. Successful original and replay responses preserve `data` original fields and add `requestKey,commandStatus:'completed'`. A pending original returns202 with `data:null,commandStatus:'pending'`; preserve original key/body and inspect command status, never manufacture a new key to resolve uncertainty. Different input/policy with the same key yields409. Missing lookup yields404. Canonical JSON key ordering does not change request identity.

Sandbox-only0002 has immutable claims and receipts. Target source insertion and original receipt commit in the same D1 batch via an adapter; existing core services are unchanged. A claimed request with no source receipt is not automatically retried. This deliberately preserves unknown execution status instead of duplicating intake/capture/import. The journal does not assert that every separate audit write after source insertion completed.

POST application `{service:'passport_read',input:{token}}` reads only a current usable delivery owned by the authenticated recipient. No token in a query/URL. It returns existing redacted passport data under `data.passport`; unrelated recipients and held/expired/superseded passports get generic404.

ReadinessWorkspace/PrivatePassportControls accept optional `sandbox` (defaultfalse). Sandbox mode uses these discovery/application/identity services, source selectors and paginated protected inspection. Production default transport stays unchanged. Private sandbox passport appears in the current tab from an authenticated body-token read.

Validation:5 focused `tests/sandbox-discovery-command.test.mjs` tests pass (actual intake, captured identity, settled finance import, independent passport issuance and currentness, replay/concurrency/privacy). Existing5 `tests/sandbox-identity.test.mjs` pass with original capture keys. TypeScript passes. Independent security QA additionally probed reordered key replay, conflicting concurrent payload, distinct owner samekey, post-source-commit response failure and immutable records. Browser integration acceptance remains Central's next check.

## Central terminal-rejection amendment

`view=command` returns `status: completed | pending | failed`. A failed receipt has `result:null` and `failure:{status,code:'rejected_before_write'}`. It is appended only for an explicit4xx validation rejection before the adapter attempts any source write. Replaying that key never executes it again. After recovering this terminal receipt, the UI retains the draft and permits an intentional corrected request with a new key. Unknown failures or any attempted write without a recovered receipt stay pending; neither elapsed time nor a missing receipt authorizes re-execution. Pending POSTs return202 with the same policy/boundary envelope and `data:null`. Completed receipts preserve the original source identifier and body/key replay contract.
