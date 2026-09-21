# Manual security gate — owner choice, 21 September 2026

The owner deferred the GitHub plan upgrade and authorized the manual process for now. Keep this repository private. No subscription or hosting change is part of this decision. Branch protection is unavailable under the current plan; the following is an operator procedure, not platform enforcement.

## Before merging each change

1. Review the proposed changes and preserve the accepted application behavior, primary/sandbox separation and deferred live-account, transaction and identity/device scope.
2. Read the current PR head and base directly from GitHub. Record the full commit hashes.
3. Require a completed, successful `LOKD security gate` workflow for that exact head. Inspect every job, not just an older green result or a combined status without checks. Required stages are locked installation, dependency audit, lint, types, canonical schema validation, build, isolated regression and the final tracked-source cleanliness check.
4. If the head changes, use its new passing run. If the base changes after validation, reconcile the candidate with the new base and validate the combined source before merging. Never waive a failed or missing check merely because GitHub permits the merge.
5. Confirm the reviewed scope and mergeability, then merge with GitHub's expected-head-SHA guard. Preserve source history. Do not force-push main or delete recovery branches as part of this process.
6. Read back the merge and compare its tree with the tested source. Record the PR, successful run, tested head, merge hash, tree comparison and any limitation. Integrate the result into the canonical checkout while retaining newer local records.

## Before a later Sites publication

Central remains the sole release owner. Bind the exact application source and built artifact to the accepted checks, including any changes made after CI. Follow the installed Sites hosting skill. Publication is a separate operation; merging this GitHub workflow does not deploy the site. No release is needed for documentation or CI bookkeeping alone.

Never call this an enforced gate: repository writers can still bypass it until branch protection is configured. Once the owner upgrades, verify feature access, configure required checks and appropriate bypass restrictions, and prove a failing disposable change cannot merge. Do not purchase an upgrade or make the repository public automatically.

## First completed manual merge

- PR: https://github.com/zenascapetown-code/lokd-platform/pull/2
- Reviewed head: `1390036b391eb02ecc89aee48e2d5e93db9f17fb`.
- Base immediately before merge: `962850c6f4be48ba20534311fcd0e6fb7390000e`.
- Passing workflow: https://github.com/zenascapetown-code/lokd-platform/actions/runs/35598274867 — all stages passed, including 513 tests with zero failures/skips.
- Merge: `da5e5639d98ad5b3e01f7c66ec502b228b907628`.
- Fetched GitHub main matched the merge; full `git diff --exit-code` against the tested head passed, proving identical tracked content.
- No separate post-merge workflow was returned by the run lookup at verification time. Acceptance uses the successful PR run and identical-tree comparison; no extra passing run is claimed.
- Canonical checkout integrated the workflow and generated-cache cleanup while retaining the local CI integration receipt.
- No Sites publication, runtime changes, live testing, billing changes or visibility changes occurred.

Lesson: a manual gate is useful only when it binds the current change to current passing evidence. Preserve the failed first CI attempt and cache fix in CI-INTEGRATION.md; do not present repeated runs as additional distinct tests.
