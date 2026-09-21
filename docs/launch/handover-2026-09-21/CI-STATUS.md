# Security gate readiness — 21 September 2026

Initial preparation record. Updated state: the candidate workflow has passed hosted CI in draft PR #2; see [CI-INTEGRATION.md](CI-INTEGRATION.md). GitHub main remains unchanged; protected-branch and Sites publication enforcement are not configured.

## Verified source ownership

- Native Sites latest saved version is 74, source `0f7215b90940bfdeb7a552c1b184450c5a596f97`; its publication succeeded at environment revision 19. The Sites repository is the release source.
- GitHub `zenascapetown-code/lokd-platform` main was read through the connector today: `962850c6f4be48ba20534311fcd0e6fb7390000e`, the v35 import. It does not represent v74.
- The current checkout has no `.github` workflows. Available Sites tooling exposes publication and source provenance, but no repository CI runner or required-check configuration. Lack of an exposed capability does not prove the provider has none.

## Reviewable candidate

`security-gate.yml.example` is a complete GitHub Actions candidate, intentionally outside `.github/workflows`. It runs on PRs, main pushes and manual dispatch, uses read-only repository permission and no production credentials, installs the locked dependencies with the existing bounded helper, then invokes the existing `npm run check:security`. That command fails on moderate-or-higher npm audit findings, lint errors, type errors, schema drift, build failure or isolated regression failure. No account tests or deployment steps are included. A final tracked-source diff rejects test-induced changes.

The Node/npm versions match accepted local tooling. Action usage follows [GitHub's official Node.js workflow documentation](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs). This preparation validates YAML parsing, referenced package commands, shell syntax and absence of deployment/account commands. It is not a hosted runner execution. No passing application suite was repeated for this documentation-only milestone.

## Activation decision and acceptance

Owner decision: authorize bringing the private GitHub mirror up to the canonical Sites source and making GitHub CI part of the release process, or obtain a supported CI gate for the existing Sites repository. Do not silently replace the current source owner.

If GitHub is chosen, Central must preserve its old refs, synchronize a reviewed candidate branch from canonical source, install the candidate as `.github/workflows/security.yml`, and obtain a successful runner result for the exact reviewed source. Configure the `security` check as required under the repository's available protection controls. Before a later Sites release, bind the successful tested commit/tree to the exact published source; a GitHub check alone cannot prevent direct Sites publication. Verify a deliberately failing disposable PR is blocked before calling this enforced CI. Never force-update main as part of this preparation.

Acceptance evidence still required: first hosted run URL and tested SHA, required-check configuration readback, failing-PR rejection, and publication provenance. Until then, Central can use `npm run check:security` for justified future release validation, but must describe it as a local procedure.
