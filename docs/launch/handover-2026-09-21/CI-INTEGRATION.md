# Hosted security CI integration — 21 September 2026

Update: the owner selected manual gating while deferring the plan upgrade. PR #2 was merged after fresh exact-head CI verification. See [MANUAL-RELEASE-GATE.md](MANUAL-RELEASE-GATE.md) for the completed merge receipt and operating procedure. The candidate preparation below is retained as history.

The owner asked Central to take the next operational item after the backup and local CI preparation. A draft candidate now synchronizes the accepted source into the existing private GitHub repository without modifying GitHub main or the live Sites release.

- Draft: https://github.com/zenascapetown-code/lokd-platform/pull/2
- Branch: `codex/v74-security-ci`
- Candidate: `1390036b391eb02ecc89aee48e2d5e93db9f17fb`
- Canonical starting point: `996ec78` (95 commits ahead of GitHub main, no divergence).
- GitHub main verified unchanged at `962850c6f4be48ba20534311fcd0e6fb7390000e` before branch push.
- Isolated preparation checkout: `/tmp/lokd-ci-v74-20260921`.

## Change scope

The candidate adds `.github/workflows/security.yml`, with PR/main-push/manual triggers, read-only permissions, pinned GitHub actions, accepted Node 22.22.1/npm 9.2.0, the existing locked install helper and `npm run check:security`. It has no account-test, deployment or production-secret step. A final diff check rejects validation that changes tracked files.

The first run passed the entire security stage, then exposed a tracked generated cache: `tsconfig.tsbuildinfo` changed during type checking. The candidate removes this generated file and ignores `*.tsbuildinfo`; it preserves the source-change check. No application behavior or schema change was required.

## Evidence

First run: https://github.com/zenascapetown-code/lokd-platform/actions/runs/35597598536

- Clean dependency installation passed.
- Audit reported zero known vulnerabilities at execution time.
- Lint, TypeScript, schema validation, build and **513 regression tests** passed; zero failed/skipped.
- Final tracked-source check failed solely on `tsconfig.tsbuildinfo`.
- Corrected run **passed all steps**, including the final clean-source check: https://github.com/zenascapetown-code/lokd-platform/actions/runs/35598274867
- Corrected run repeated the security suite on the changed candidate: **513 passed, 0 failed, 0 skipped**; audit again reported zero known vulnerabilities. These are two runs of the same suite, not 1,026 distinct tests.

These are fresh hosted backend/rendered results. They do not replace or add to the separate 290 browser and 4 built navigation cases in the earlier acceptance receipt.

## Enforcement limitation and next decision

GitHub Actions is enabled. The branch-protection API returned HTTP 403 with: “Upgrade to GitHub Pro or make this repository public to enable this feature.” Keep the repository private; no billing or visibility change was made. CI execution does not establish required-check enforcement, and no claim of an enforced failed-PR block is made.

With CI now passing, the concrete owner decision is whether to merge this private source synchronization and use reviewed CI results as a manual release gate under the current plan, or first obtain a GitHub plan that supports protected branches. Neither choice migrates hosting: Sites remains the live deployment platform. An exact tested source/tree match remains required before a later publication; this workflow alone cannot block direct Sites publication.

## Retained lesson

Observation: syntax-valid CI can still fail on runner-generated tracked artifacts. Action: ran the workflow on a clean hosted runner, retained the successful security stage and failing diff evidence, and removed only the generated cache. Result: application acceptance remains intact; the correction targets reproducible CI hygiene. Evaluation: the corrected hosted run and its final clean-source check both passed. Preserve this failure rather than bypassing the source check or repeating unrelated browser acceptance.
