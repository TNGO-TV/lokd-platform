# Current authoritative state

## 1. User intent and authorization

Finish LOKD without reopening completed work. The owner repeatedly instructed: finish the build with fictional data and deterministic simulators; real accounts come later. Preserve this constraint until the owner explicitly changes it. The simulated build is accepted; that does not itself authorize live-account testing.

The owner authorized application fixes, deployment, encrypted backup and security remediation; approved npm package-name/version disclosure to npm audit; selected a private connected Google Drive folder for off-host backup. Do not ask for these approvals again. A move to the owner's independent Cloudflare account has **not** been requested: the owner asked how hosting currently works. Do not infer migration or DNS-cutover authorization.

This handover is a documentation-only checkpoint. It does not change the application or trigger another deployment. The predecessor ceases implementation when the successor takes ownership; old Central tasks are historical references, not concurrent owners.

## 2. Environment and source

- Canonical checkout: `/srv/ammosync/workspaces/lokd-security`; branch `main`.
- VPS host ID from task discovery: `remote-ssh-codex-managed:01b0f86b-7662-4af2-b723-79782cce96a6`.
- Codex project ID: `6b1f2048-a041-43ea-ae3e-f3a3e22461d1`.
- Documentation HEAD before this pack: `b562b2c1588d92ae87f0e51232d70e99a1fbc372`. The handover commit will be newer; use `git log` and preserve it.
- Deployed application source: `0f7215b90940bfdeb7a552c1b184450c5a596f97`.
- Sites source remote: `https://git.chatgpt-team.site/bad06f87-41e9-4a3e-92b8-fb8d722f80a0/appgprj_6a88a08505548191b266e9b711562ae3.git`, branch `main`.
- GitHub origin exists (`zenascapetown-code/lokd-platform`), but this recovery work was pushed to Sites; do not claim GitHub is current.
- Node22.22.1/npm9.2.0 were used. Dependencies are installed; no reinstall is needed just to resume.
- Applicable parent instructions: `/srv/ammosync/AGENTS.md`; efficiency and operational learning records referenced there. The AmmoSync-specific ownership rule does not apply to LOKD.
- Temporary acceptance fixture servers were stopped. No background test job remains from the acceptance round.

## 3. Hosting and exact release

LOKD is a real Worker application deployed **through ChatGPT Sites**, using Cloudflare Workers, D1 and R2. Sites owns resource wiring. There is no separately managed deployment into the owner's Cloudflare account.

| Field | Verified value |
| --- | --- |
| Sites project | appgprj_6a88a08505548191b266e9b711562ae3 |
| Current published version | 74 |
| Version ID | appgprj_6a88a08505548191b266e9b711562ae3~appgver_a810922713f081918a319d5c74131cb3 |
| Deployment ID | appgdep_6ab116886e6c8191b85671a5a12e2426 |
| Status | succeeded, 21 September 2026 |
| Production URL | https://lokd-security.zenas-capetown.chatgpt.site |
| Custom URL | https://demo.lokd.co.za |
| Audience | public; app authentication and feature guards remain separate |
| Environment revision | 19 |

Receipt: `docs/launch/acceptance-2026-09-21/RESULTS.json`. v74 only fixes the decorative homepage layer intercepting mobile pointer clicks; adds pointer+keyboard regression evidence. No schema, finance rules or runtime settings changed.

Preserved settings: `LOKD_APP_STAGE=production`, `LOKD_LIVE_SHIFT_SCAN=false`, `LOKD_OPERATIONS_MFA_REQUIRED=false` (explicit existing owner exception), `VERIFYNOW_SANDBOX_ENABLED=true`. Live finance gates remain closed. The temporary `LOKD_BACKUP_*` keys were removed at revision19. Do not silently enable live flags, require MFA, replace identity settings, or expose a fixture toolbar in production.

## 4. Completed build and acceptance

- All43 tracked requirements reconciled in `docs/launch/acceptance-2026-09-21/FEATURE-MATRIX.csv`, with simulated completion distinguished from legal/live approvals.
- 21 September:206 frontend browser cases +76 integrated cases +8 public intake cases =290 passed, zero failed/skipped/flaky. The integrated76 comprise48 actual-handler and28 mocked-response UI checks. Four additional built-Worker cases passed: mobile/desktop × pointer/keyboard, hydration and CSP checks.
- 15 September:513 combined backend/rendered tests passed. Retained evidence, **not rerun on21 September**; the later product change was CSS only.
- Current build passed. September21 focused test lint passed. September15 full TypeScript passed; full lint had zero errors and three nonblocking warnings, documented in its report.
- Evidence: `docs/launch/acceptance-2026-09-21/CLOSEOUT.md`, `RESULTS.json`, browser logs/reports. Earlier acceptance: `docs/launch/central-sandbox-final/ACCEPTANCE.md` is historical, including its obsolete v69 deployment statements.
- Finance service-level tests cover funding/allocations/invoices, employee and partner settlement, refunds/disputes/reversals, corrections, taxes and multi-company periods. Current actual browser journeys cover enrolment/review/private documents, payroll and training. Do not claim every financial model was completed entirely through browser clicks.
- Identity/workforce covers consent/capture/recovery, independent review, readiness/passports, correction/suspension, agreements, assignment/attendance, service/dispute/pay review, incidents and consented presence. Physical devices/provider outcomes are simulated where stated.

No unresolved defect was found within this bounded simulated acceptance. Do not invent another broad build phase or make real accounts a condition of recognizing that result.

## 5. Security remediation

`docs/launch/hardening-2026-09-15/README.md` and area reports record:

- Streaming byte limits, absolute body deadlines, cancellation and strict UTF-8 across API input readers.
- Signed webhook deadlines while preserving exact HMAC bytes; bounded provider JSON responses.
- Evidence-class authorization for upload, metadata, content and verification; dormant routes remain closed.
- Per-request script nonce CSP, no script unsafe-inline allowance, uniform Worker security headers.
- Dependency remediation: final installed npm audit reported zero known vulnerabilities **on15 September**, previously24 affected entries. This is not a current perpetual guarantee or proof of exhaustive security.
- Scoped overrides: vinext/image-size2.0.4 and @esbuild-kit/core-utils/esbuild0.28.2; migration-loader compatibility checked. No forced Drizzle downgrade.
- `npm run check:security` exists; it is not wired to a repository CI runner yet.

Remaining recommendations: CI wiring; traffic-appropriate edge quotas/rate policy; stable provider-user-ID role mapping once actual account identities are authorized; auth-provider latency/deadline assessment if needed; maintainability refactoring only when justified by a concrete issue. Real-account MFA policy remains an owner decision. These are recommendations, not newly discovered authentication/financial exploits.

## 6. Database rules and release lessons

- Canonical Drizzle migrations0000–0074 are deployed. Do not edit historical migrations; new schema changes require reviewed roll-forward migrations.
- Primary schema:210 application tables,759 triggers,67 views,304 indexes;1,340 required objects. Backup includes212 tables with system/journal tables.
- `sandbox-migrations/0001..0003` belong only to a separate, marked `SANDBOX_DB`. Never alias it to primary DB or package these into the canonical migration chain.
- v70/v71 failed hosted SQL parsing; v72 succeeded with accepted parenthesized `SELECT (CASE ... END)` expressions. Preserve the hosted-splitter regression (`tests/hosted-migration-splitter.test.mjs`). Do not revert the compatibility fix.
- Readiness check: `node scripts/generate-readiness-schema.mjs --check`.
- Sites build/package helpers must be run according to the **currently installed** hosting skill. The last helper root was `/home/ammosync/.codex/plugins/cache/openai-curated-remote/sites/0.1.65/`; discover newer versions rather than assuming it forever.
- Obtain short-lived native Sites source credentials only when needed; do not store or echo tokens. Push exact source, then read full HEAD and save the matching built archive. Preserve audience and environment.

## 7. Backups and limits

Private Drive folder: https://drive.google.com/drive/folders/1u0JEL4nBvZpj4eUB1H6glsYlq9vRWY_i

Latest confirmed off-host archives are **v73**, not v74. They include encrypted source/release and production capture, plus sanitized audit evidence. v72 rollback copies also remain. v74 has a source publication and local release archive but was not added to the encrypted Drive backup set. Closing this small backup lag is the first concrete unfinished operational item.

- v73 production Drive ID: `1-No0A6fmH3jUhUTJAr-O12i4dGrgZIo2`; SHA256 `6b6e6560a4a5228a01dd317f7842684e1a2d89e4438faa7b5d1a8c396d718a8d`.
- v73 source Drive ID: `1l67GSsI-LmzSfKAyeKaFtYmALsLvDEOO`; SHA256 `c2c91f900b4a85c31c34a5a3da0dd2b4d996b5b8b4ecb55d07dee459cecfaeb4`.
- v73 capture restored locally:212 tables/163rows,0R2 objects,10 runtime keys, exact schema/cells, integrity and foreign keys pass. This is a15 September snapshot, not a claim that current production data still has those counts.
- Drive owner-only permissions, parent folders and sizes verified. Independent remote-byte checksum was **not** obtained: connector download reference returned403. Do not call this verified off-host restoration.
- Recovery key was not uploaded. Existing key path (contents must never be printed or placed in prompts): `/home/ammosync/.codex/visualizations/2026/09/08/01a08237-b9c1-7740-b3cc-79d222509dd8/exports/lokd-tngo-hard-backup-20260913/BACKUP-KEY.txt`.
- v73 local root: `/home/ammosync/.codex/visualizations/2026/09/15/01a0a401-d875-7531-9e17-b6ce0ca9a2f2/lokd-hardening-backup`.
- v72 local root: same parent, `lokd-release-backup`.
- v74 release archive, if retained: `/tmp/lokd-acceptance-release.tar`; local SHA256 `5b05a262ae6ef51bb08e2f10e634426822bf7f6b698f6b0fb86576cd76d03f21`. Native saved archive was repackaged and has its own digest in RESULTS.json.
- Raw runtime/database restore directories and temporary backup tokens were removed after verification. Do not regenerate or rotate the existing key casually.
- Full external identity/payment/verification provider recovery remains deferred. Read `docs/OWNER-BACKUP.md`, the capture script and hardening RELEASE.json before any new capture. Source-only backup refresh needs no temporary hosted backup endpoint.

## 8. Finite next work and completion gate

1. Verify the successor's workspace/HEAD and native current release once. Preserve new work if state advanced.
2. Bring encrypted source/release/evidence backup up to v74 plus this handover. Use the approved private Drive folder, separate recovery key and isolated verification; accurately record remote-download limitations. Do not reopen a production backup window merely for a CSS/source backup.
3. Reconcile the existing security command with the actual source repository's available CI capability. Prepare/test a concrete CI configuration if supported; do not claim it executes in Sites/GitHub without evidence or silently change source ownership.
4. Obtain concise production-acceptance packets from the three specialist prompts. Reuse previous evidence; collect only actual gaps, owner decisions and executable later scenarios. Central integrates any genuine defect with focused tests. Do not blindly repeat all passing suites.
5. Present one final readiness ledger: simulated build accepted; operational items completed or specifically open; hosting choice; later legal/account/provider/device acceptance. Prepare a concrete independent-Cloudflare migration proposal only if the owner chooses that path; do not move DNS or create billable resources from a mere hosting question.

Real account details, actual payments, genuine ID/device captures, approved entity/terms/business policy and live activation stay deferred. Existing legal document lists: `docs/LEGAL_DOCUMENT_HANDOVER_2026-09-09.md` and `docs/LEGAL_IMPLEMENTATION_REVIEW_2026-09-09.md`; reuse them rather than inventing a requirement for a large new legal pack.

The handover does not authorize unlimited refactoring, new features or repeated audits. The next milestone ends with those bounded operational tasks and one clear owner decision for moving beyond simulation.

## 9. Test operation and reusable lessons

Read `tests/integrated-browser/README.md` for merged mode and distinct databases; owner ports4395/4396 must not be repurposed. Central uses4405(UI)/4406(handler). Frontend fixtures use4179 and public4178. Fixtures block external requests and cannot be deployed. Prefer `/dev/shm` for Chromium temporary/shared-memory needs on this host; retain failed attempts and corrected evidence. Stop fixtures before final build.

The integrated reporter writes `tests/integrated-browser/test-results/integrated-browser/browser.json`, not the root test-results path; use the observed path. No sensitive real records belong in reports. Browser suites run serially within each fixture because scenario resets replace disposable databases.

A homepage decorative pseudo-element intercepted taps although keyboard navigation worked: test both. npm9 can keep stale nested override resolutions: verify installed `npm ls` plus audit, not just package.json. Native Sites repackaged archive hashes can differ from local packaging: record both. Historical task logs may describe already-integrated patches; never reapply them without comparing the current tree.

## 10. Task identity and dispatch state

Source task: `Resume white-screen chat`, ID `01a0a401-d875-7531-9e17-b6ce0ca9a2f2`. Older Central tasks: `Central 2` (`01a0a08a-d726-7613-9ede-d0e24c452c1b`) and `Central Command` (`01a09bcf-1c26-7371-b29c-7128717b43ea`). They contain history; this handover/receipts determine the current baseline.

Specialist IDs and exact titles are in START-HERE.md. They were found and their latest deliveries inspected; those old delivery commits were already integrated. This pack's prompts have not been sent. No new Central task was created because create/fork/handoff/send tools were unavailable in this session. User can start the successor with the short starter prompt; do not claim an automated handoff succeeded.
