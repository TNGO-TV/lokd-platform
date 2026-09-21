# Central operational closeout — 21 September 2026

The owner authorized this task to continue as Central Command after task-creation tooling was unavailable. Canonical checkout began clean on `main` at `d8358077b7dc300774bf9408c5e6647bd5eae3ff`. No application, schema, dependency, runtime, audience or production gate changes were made. No new publication was necessary.

## Manual gate authorized and applied

The owner deferred the upgrade and chose manual checks. PR #2 is merged at `da5e5639d98ad5b3e01f7c66ec502b228b907628`, with the exact passing head verified immediately beforehand and an identical-tree check afterwards. GitHub and the canonical checkout now contain the CI workflow. See [MANUAL-RELEASE-GATE.md](MANUAL-RELEASE-GATE.md). Protected-branch enforcement remains an owner follow-up after upgrade; no live release changed.

## Subsequent CI progress

The owner asked to take the next item. [Draft PR #2](https://github.com/zenascapetown-code/lokd-platform/pull/2) now carries the current source and a hosted security workflow. Its corrected run passed 513 tests plus audit/lint/types/schema/build and the source-cleanliness check. GitHub private-repository branch protection requires a plan upgrade; neither main nor the live release was changed. See [CI-INTEGRATION.md](CI-INTEGRATION.md). The original milestone ledger below remains as a historical checkpoint.

## Integrated ledger

| Status | Item / owner | Result or concrete next action | Acceptance evidence |
| --- | --- | --- | --- |
| COMPLETE | Simulated build / Central | Preserve accepted v74; no confirmed simulated-build defect identified in the retained closeouts. | `../acceptance-2026-09-21/RESULTS.json`: 290 fresh browser cases and 4 built navigation cases on September 21; 513 backend/rendered passes retained from September 15, not rerun. |
| COMPLETE | Live release provenance / Central | Native latest version 74 and successful publish match accepted source `0f7215b90940bfdeb7a552c1b184450c5a596f97`, revision 19. | Native version and deployment readback September 21; deployment `appgdep_6ab116886e6c8191b85671a5a12e2426`. |
| COMPLETE | Encrypted source/release/evidence backup / Central | Backup refreshed through the complete handover commit. Local decrypt, member hashes, Git clone/HEAD and fsck pass. Uploaded to existing private Drive folder; exact size, parent and owner-only permissions read back. | `BACKUP-v74.json`; source tree/history plus local v74 release artifact. Key remains separate. |
| ACTIONABLE OPEN | Independent off-host restoration / Central | Obtain a working authenticated download path for the uploaded encrypted artifact; compare SHA256 and restore in isolation. Current download reference returns HTTP 403. | Completion requires remote bytes matching `BACKUP-v74.json` and successful isolated restore; current metadata checks are not remote restoration. |
| COMPLETE | CI candidate preparation / Central | Prepared `security-gate.yml.example`; YAML, package-command references, shell syntax and diff checks pass. | `CI-STATUS.md`. No hosted execution or enforcement claimed. |
| OWNER DECISION | CI source integration / owner, then Central | Choose a current private GitHub mirror with release checks, or a supported gate on the existing Sites source repository. GitHub currently remains at v35. | Later exact-source passing hosted run, required-check readback, failing PR rejection and matching Sites provenance. |
| ACTIONABLE OPEN | Frontend operator packet / existing Frontend task | Exact `FRONTEND-PROMPT.md` remains prepared, not dispatched. Deliver once when task messaging is available, or manually; record acknowledgement before retrying. | Packet maps public/Client/Officer/Operations journeys to actual-handler versus mocked evidence and a deferred walkthrough. |
| ACTIONABLE OPEN | Financial acceptance packet / existing Finance task | Exact `FINANCE-PROMPT.md` remains prepared, not dispatched. Preserve integrated delivery. | Packet includes conserved amounts, actor separation, original-claim recovery, private documents and later provider assumptions. |
| ACTIONABLE OPEN | Workforce readiness packet / existing Identity task | Exact `IDENTITY-PROMPT.md` remains prepared, not dispatched. Preserve integrated delivery. | Packet traces source/version/actor boundaries and separates simulated devices/providers from historical development tests. |
| OWNER DECISION | Hosting choice / owner | Retain Sites-managed hosting unless separately choosing an owner-managed Cloudflare migration plan. No migration, DNS or billing action is authorized by a hosting question. | Explicit choice before a migration proposal or execution. |
| DEFERRED | Accounts, real money, genuine identity and devices / owner and specialists | Await explicit authorization of a later bounded acceptance phase and its designated inputs. | Approved account roles, provider/test scope, commercial/payroll assumptions, consent/PSiRA inputs and device observations. |
| DEFERRED | Legal policy and provider recovery / owner/legal | Reuse existing legal document lists; obtain entity, terms, authority and business-policy approval later. External provider disaster recovery remains separate. | Existing legal handovers and approved provider recovery evidence. |

## Specialist state

The three existing tasks were read; their latest deliveries are historical and already integrated according to the handover and acceptance receipts. No new assignment acknowledgement was obtained. This session exposes task read tools but no send/create tool. No replacement tasks or duplicate subagents were created, and no historical patch was replayed.

- Frontend: **Clean up LOKD frontend navigation**, `01a09c3b-a93f-7721-8861-e941dd214476` — [prepared prompt](FRONTEND-PROMPT.md).
- Finance: **Complete FI-05 payment recovery**, `01a09c3c-788a-7a83-a458-2aaa4e604d8a` — [prepared prompt](FINANCE-PROMPT.md).
- Identity: **Implement guarded identity workflow**, `01a09c3c-0e07-7132-88c8-123a1dbfc216` — [prepared prompt](IDENTITY-PROMPT.md).

Retained area evidence includes `../build-closeout-2026-09-15/FINANCE.md`, `../build-closeout-2026-09-15/IDENTITY.md`, and the newer September 21 integrated closeout. These support the existing accepted build, not a claim that the newly requested specialist packets have been delivered.

## Operational learning

Observation: the backup lag concerned source/release/evidence only. Action: verified old/new artifact checksums, bundled exact committed source and release, reused the existing key, restored locally, then uploaded once. Result: 18,940,164 encrypted bytes with verified metadata. No production backup window was opened. Lesson: name the snapshot scope explicitly; a source refresh does not refresh database/provider recovery.

Failure retained: GPG could not start its local agent inside the sandbox, including with a shortened temporary home. Approved execution outside the sandbox succeeded; plaintext staging and restore copies were removed. Independent remote download still returned HTTP 403. Lesson: local restore, upload metadata and off-host restore are separate evidence states; changing permissions or repeating the same failing URL is not a remedy.

Observation: GitHub main is v35 while native Sites reports v74. Action: prepared CI outside the active workflow directory and recorded the source decision. Result: a reviewable configuration, no false enforcement claim. Next evaluation: first exact-source hosted CI run after the owner chooses the integration path.

No repeated application suites or broad audit were needed for these documentation and backup operations. All live-account, money, identity and device restrictions remain in force.
