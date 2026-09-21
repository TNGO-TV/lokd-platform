# LOKD Central Command handover — Zoho and operational completion

Prepared 21 September 2026 from task `01a0c3cb-1998-7941-a925-1fb96bcda4c1`.
The owner is opening a new task. This document preserves the current objective,
decisions, evidence and limitations. No new task was created or messaged here.

## Paste this into the new task

```text
You are LOKD's continuing Central Command owner in the existing LOKD VPS project.

Read /srv/ammosync/workspaces/lokd-security/docs/launch/HANDOVER-ZOHO-2026-09-21.md
and the linked source records. Continue from accepted v74 and current main;
preserve all completed work and uncommitted handover documents.

The owner chose Zoho CRM and Zoho Books for a new LOKD company, created both,
and confirmed South Africa / ZAR. Clients must receive email links to review
and accept contracts inside LOKD. Finish the missing booking-to-team/CRM,
quote, contract, invoice, notification and payment integration workflows.

First check whether Zoho CRM actions are callable in THIS new task. The previous
task confirmed installed:true and the owner confirmed Connected, but received
zero Zoho tools even after explicit attachment. Do not repeat installation or
claim the VPS is the cause without evidence. If tools are available, read the
organisation, edition, users and modules before making changes. Verify the
Books link and the separate runtime authorization needs. Do not request secrets
in chat. If tools remain absent, report the precise limitation and continue
independent authorized implementation rather than repeating setup loops.

Perform thorough synthetic/sandbox tests, then report what actually works and
what still needs external inputs. Existing simulated tests passed; actual
provider acceptance and missing business workflows are NOT complete. No real
customer payment, identity submission, or physical-device testing is authorized
by this handover. Preserve live gates. Do not replace missing integrations with
claims that a flag or API key alone makes the whole platform live.
```

## 1. Owner intent and decisions

- Finish the real operational product; do not stop at another passing mocked suite.
- The owner specifically identified absent booking notifications/team routing and
  absent client contract email delivery. These are required launch work.
- Selected Zoho CRM + Zoho Books after comparing HubSpot, Xero and QuickBooks.
  Both accounts now exist for a NEW LOKD business. Owner confirmed South Africa
  and ZAR. No authenticated read has independently verified these settings yet.
- Owner has a separate QuickBooks account but has not chosen it for LOKD. Do not
  migrate unrelated books or return to product-selection questions unprompted.
- Contract delivery: email a secure link to sign into LOKD, review exact approved
  wording/service scope, and accept. Do not substitute emailed PDFs or an
  external signature workflow without an owner decision.
- Resend and Zoho Mail were proposed earlier. Neither has been confirmed created
  or selected as the final sending/mailbox arrangement. No team inbox address,
  recipients, CRM assignees, sender-domain setup, or delivery credentials are known.
- HubSpot is not selected. Do not add another CRM.
- Owner wants extensive sandbox testing, then a bounded live check at the right
  stage. Repeated real-card charging is not required. Live testing still needs
  explicit bounded authorization; none occurred here.
- GitHub paid-plan upgrade was deferred; the manual release gate was accepted.
- The owner is frustrated by repeated confirmations and plugin troubleshooting
  loops. Ask only for missing facts that cannot be inspected directly.

## 2. Workspace, Git and release

Canonical checkout: `/srv/ammosync/workspaces/lokd-security` on the VPS.
Current HEAD verified during handover: `053573b` on the existing main history.
Recent commits:

- `053573b`: fresh full flow verification and concrete provider gaps.
- `be67bc32b513785c20cfa878252f9ebd09f37437`: manual gate/merge evidence.
- `692d33d`: merge of origin/main.
- `da5e5639d98ad5b3e01f7c66ec502b228b907628`: GitHub PR #2 merge.
- `aa5e164`: passing hosted CI and private-repository enforcement limitation.

At handover start, the only untracked file was
`docs/launch/ZOHO-INTEGRATION-SETUP.md`. This handover adds another untracked
document. No application changes were made for Zoho. Preserve both documents.
Check current state before editing; later activity may supersede these facts.

Last verified live release is Sites v74, deployed application source
`0f7215b90940bfdeb7a552c1b184450c5a596f97`; later Git changes are CI/evidence.

- Site: https://lokd-security.zenas-capetown.chatgpt.site
- Custom domain: https://demo.lokd.co.za
- Project: `appgprj_6a88a08505548191b266e9b711562ae3`
- Version: `appgprj_6a88a08505548191b266e9b711562ae3~appgver_a810922713f081918a319d5c74131cb3`
- Deployment: `appgdep_6ab116886e6c8191b85671a5a12e2426`, succeeded.
- Last inspected runtime environment revision: 19.
- `.openai/hosting.json` binds D1 `DB` and R2 `BUCKET`.
- GitHub: https://github.com/zenascapetown-code/lokd-platform (private).
- Sites has its own source remote. GitHub CI is not automatic proof of a Sites
  deployment gate; follow the documented manual process.

No new publication happened during the workflow/product-selection discussion.

## 3. Testing already completed

Read `docs/launch/flow-verification-2026-09-21/REPORT.md`, `RESULTS.json`,
`PROVIDER-BOUNDARY.md` and `BROWSER-CASES.json`.

Fresh September 21 isolated checks against source `be67bc3`:

- 513 backend tests passed, zero failed/skipped.
- 206 frontend + 8 public-intake + 76 integrated browser tests = 290 passed;
  zero failed/skipped/flaky.
- The 76 integrated cases comprise 48 actual local handlers with synthetic
  prerequisites and 28 response-mocked UI cases. Do not call all of them live E2E.
- 4 built-navigation checks passed.
- Audit zero known vulnerabilities at execution time; lint zero errors/3 warnings;
  typecheck, readiness-schema check and build passed.
- No external-provider verification or production change was performed.
- `tests/accounts/` suites requiring designated Clerk credentials were not run.

Do not repeat all unchanged passing checks merely to establish activity. Run
targeted tests for new work and the required release checks when code changes.

Test machinery: Node 22.22.1/npm 9.2.0; installed dependencies and Playwright
Chromium available. Security gate is `npm run check:security`.
Temporary orchestration `/tmp/lokd-flow-review-20260921.py` may remain.
Browser cache `/home/ammosync/.cache/ms-playwright`; native shared-memory mode
`LOKD_BROWSER_NATIVE_SHM=true`; previous TMPDIR/cache under
`/dev/shm/lokd-flow-review-20260921`. Public/frontend fixture ports 4178/4179;
integrated fixture ports 4405/4406. Do not take over owner fixture ports 4395/4396.
Run tests sharing a resetting database serially. No test process was left active
by this task at handover.

## 4. Zoho connection: exact observed failure

Plugin `zoho@openai-curated-remote`, version 2.0.0.
Directory ID `plugin_asdk_app_6a193ef5e804819197c25f88d92d6bf7`;
app ID `asdk_app_6a193ef5e804819197c25f88d92d6bf7`.

1. Directory discovery initially found an uninstalled plugin; suggestion issued.
2. App notification reported installed/connected. Fresh directory reads returned
   `installed:true`.
3. Owner initially could not see it in their installed list, then installed/
   connected it there and explicitly confirmed it now said Connected.
4. Owner explicitly attached `[@Zoho CRM](plugin://zoho@openai-curated-remote)`
   and asked to read the organisation. Still no Zoho methods in `ALL_TOOLS`.
5. No tool-search facility was exposed either. No Zoho API call was attempted;
   there is no 401/403/provider error proving an OAuth failure.
6. Local `.app.json` and `.codex-plugin/plugin.json` exist under
   `/home/ammosync/.codex/plugins/cache/openai-curated-remote/zoho/2.0.0/`.
   The manifest points at the expected app. Config contained no Zoho-specific
   override. This does not prove account authorization or server health.
7. GitHub, Google Drive and Sites methods ARE exposed in the same VPS task.
   Therefore a blanket claim that VPS tasks cannot use apps is unsupported.

Earlier advice to reopen the task or explicitly attach the plugin was speculative
and did not fix this task. Do not repeat it as a known remedy. The new thread may
have a different tool catalog: check once, then use evidence.

OpenAI Support was recommended via the chat bubble at https://help.openai.com.
No ticket was submitted. A support report should include the old task ID, plugin
version, connected-state screenshot, desktop version, zero available Zoho actions,
and working other connectors. Exact cause remains unknown.

References:
- https://developers.openai.com/plugins/deploy/troubleshooting
- https://help.openai.com/en/articles/6614161-how-can-i-contact-support

## 5. Proposed integration and code findings

Read `docs/launch/ZOHO-INTEGRATION-SETUP.md` for the mapping and acceptance scenario.
This is a proposal, not implemented automation.

- LOKD enquiry -> CRM work item/deal, with assigned owner and stable LOKD reference.
- CRM manages sales follow-up; Books owns quotes/invoices/credit notes/accounting.
- LOKD owns approved contracts, acceptance, service orders and workforce activation.
- Preserve external IDs and versions; retries must not create duplicate records.
- Inspect native CRM–Books sync before implementing customer creation; avoid two
  competing writers. Verify edition entitlements in the actual account/trial.
- A CRM connector for this assistant is not the deployed application's OAuth
  integration. Books access, organisation ID, data centre and runtime authorization
  require separate verification. Country does not determine the Zoho data centre.
- A new Books company is not automatically a sandbox. Use suitable test facilities
  and controlled synthetic records; do not issue real invoices by accident.

Relevant existing source:

- `app/api/enquiries/route.ts`: client enquiries, Operations triage/closure and audit.
- `app/lib/production-orders.ts`: production service order workflow.
- `app/lib/production-signing.ts`: approved wording, exact document/context hashes,
  current linked signer, envelopes, expiry/withdrawal, acceptance receipts.
  `issueProductionEnvelope` returns `delivered:true` after database envelope
  creation/reuse; this is NOT proof of email delivery. Address that distinction
  in the notification integration and UI.
- `app/api/agreements/production/route.ts`,
  `app/components/production-signing-panel.tsx`, client agreement pages: reuse.
- `app/lib/platform-jobs.ts`: durable internal outbox dispatch into
  `operator_notifications`; not an external email provider. Environment/integrity
  filters matter. Review schema triggers before extending/reusing the outbox.
- `app/lib/integration-core.ts` / `integration-server.ts`: existing abstractions
  and demo configuration; do not mistake sandbox-ready messaging for live sending.
- `worker/index.ts`: request auth, webhook bypass for signed provider routes,
  scheduled maintenance. Read before wiring production delivery work.
- No actual CRM/email adapter was implemented during this task.
- Latest migration number inspected was 0074. Check again before reserving a new
  number; maintain schema, snapshot/journal and readiness consistency.

Required delivery design: durable jobs; trusted recipients; authenticated secure
links; exact approved contract binding; visible queued/sent/delivered/failed states;
bounded retries and duplicate prevention; cancellation/expiry handling. Do not
send identity/contract evidence in team notification bodies unnecessarily.

## 6. Payment gaps — not solved by Zoho selection

`PROVIDER-BOUNDARY.md` is authoritative for the inspected implementation.

- `booking-collections.ts` has a real Paystack initialize/verify adapter, exact
  amount/currency/metadata checks and signed webhook handling. Actual provider
  sandbox checkout/API/webhook matching remains unverified.
- Successful collection deliberately does not directly fund a booking;
  `booking-settlements.ts` handles independent settlement review. Preserve this.
- Enrolment route imports `test-enrolment.ts`: R350 test-only flow, fixed test
  callback, no implemented live-mode switch. Changing a key is insufficient.
- `/api/finance-workflows` uses `DeterministicFinanceProvider`; combined finance
  and training workflows remain sandbox-only. Preserve financial invariants while
  implementing a reviewed real boundary.
- Hosted environment had redacted Paystack TEST key entries; no local usable test
  secret found. No live secret or `LOKD_COLLECTION_LIVE_ENABLED` was present.
- `scripts/finance-paystack-test-probe.mjs` is network-free inventory, not provider
  acceptance. Never report it as a real payment test.
- There is an historical auto-review rejection of a provider probe. No secret
  extraction or circumvention was attempted. Use approved private credential setup.
- Maintain `LOKD_LIVE_SHIFT_SCAN=false`, owner-approved
  `LOKD_OPERATIONS_MFA_REQUIRED=false`, and existing primary/sandbox separation.
  Last inspected stage was production; VerifyNow sandbox enabled.

## 7. CI and backups already completed

PR https://github.com/zenascapetown-code/lokd-platform/pull/2 is merged.
Passing head `1390036b391eb02ecc89aee48e2d5e93db9f17fb`; Actions run
`35598274867`, job `106328051810`. 513 tests and full gate passed. Merge tree was
verified identical. An earlier run only failed source cleanliness due to tracked
`tsconfig.tsbuildinfo`; removed from tracking and `*.tsbuildinfo` ignored.
Workflow `.github/workflows/security.yml` exists. Private branch protection
returned upgrade-required 403. Manual gate explicitly accepted; no visibility or
billing change. See `handover-2026-09-21/MANUAL-RELEASE-GATE.md` and CI receipts.

Encrypted v74 source/release/evidence backup completed through source handover
commit `d8358077b7dc300774bf9408c5e6647bd5eae3ff`. Local decrypt/member checks and
Git restore passed. Drive upload size/parent/owner-only metadata verified.
Independent remote download returned 403; off-host checksum/restore is NOT proven.

- Receipt: `docs/launch/handover-2026-09-21/BACKUP-v74.json`.
- Archive bytes: 18,940,164.
- SHA256: `34f5425b3c3f2051316d9e563168adaee721b5d01447e13187e8faba64c4cfcd`.
- Drive file: `1vEx1Ny7Qw4BHxo9yGvcUP8W_M1XD6i6V`.
- Folder: `1u0JEL4nBvZpj4eUB1H6glsYlq9vRWY_i`.
- Key stays separate; its location is in the original handover. Never print,
  commit, or upload key contents.
- This backup excludes later CI/operational docs and this Zoho handover.
- Production database/object snapshot remains separate v73, September 15;
  no new production capture was performed.

## 8. Ownership, instructions and next actions

Read `/srv/ammosync/AGENTS.md` and its operating/efficiency records. Its AmmoSync
ownership restriction does not restrict this LOKD owner. Keep durable evidence
and lessons. Follow the available Sites skills for any Site edits/deployment;
read native Site state safely without printing returned secrets. Cloudflare
skills apply to Worker development. Do not rebuild/deploy for documentation only.

Existing specialist tasks (historical work integrated; new prompts not dispatched):
- Frontend `01a09c3b-a93f-7721-8861-e941dd214476`.
- Finance `01a09c3c-788a-7a83-a458-2aaa4e604d8a`.
- Identity `01a09c3c-0e07-7132-88c8-123a1dbfc216`.
Prepared prompts are in `docs/launch/handover-2026-09-21/`. Reuse existing tasks;
do not duplicate them. Old ledger entries explicitly labelled historical are
superseded by later manual CI merge and fresh flow verification receipts.

Execution order:
1. Check workspace/tool state; preserve untracked handovers and accepted release.
2. If Zoho tools are present, read LOKD organisation/users/modules/edition and
   Books integration status. If absent, report the exact connection limitation.
3. Identify private runtime OAuth setup, Books organisation/data centre, intended
   assignee, team inbox and sender; inspect what is possible before asking user.
4. Implement durable enquiry/CRM sync and visible team ownership with retry tests.
5. Wire reviewed quote, contract delivery/acceptance and authoritative Books
   invoice references; preserve existing legal and financial approval controls.
6. Connect email delivery with status/recovery; only controlled designated test
   recipients. Do not activate automatic messages to real customers by default.
7. Complete actual provider sandbox verification and missing payment adapters.
8. Run appropriate tests, use the accepted manual release process for deployment,
   update backups for released changes, and report actual evidence/remaining inputs.

Keep separate: implemented, tested with mocks, provider-tested, deployed, and
enabled for real customers. The current milestone is not complete merely because
the Zoho accounts exist or the previous simulated suite passed.
