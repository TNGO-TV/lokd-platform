# PR 34 CodeQL remediation

The CodeQL check on `89d97f278a0021cca4f36ab0f0dadf0e7593da9f`
reported five high-severity alerts in the newly vendored
`eslint-plugin-import-x`: two exponential-backtracking paths in each of the
ESM and CJS dynamic-import comment rules, and one quadratic scoped-package
classifier in the ESM utility. The separate LOKD security workflow passed
on that head; its dependency audit does not replace CodeQL source analysis.

The `4.17.1-lokd.2` patch replaces the comment regex and VM evaluation with
shared, syntax-only Espree parsing. Only recognized webpack properties and
literal values are accepted; executable expressions, getters, computed keys
and spread properties are rejected without evaluation. Existing chunk-name
format configuration and eager-mode suggestions remain in the rule. Espree
11.2.0 was already locked through ESLint and is now declared directly by the
vendored package. The scoped-package classifier uses delimiter positions,
including the upstream loose no-slash matching behavior.

Changed ESM source maps are removed, provenance is updated, and installed
vendor files must match source. No CodeQL alerts are dismissed and no scanning
configuration, permissions, production code or deployment settings change.

Local pre-publication checks:

- Clean locked install: 472 packages; all five vendored packages verified.
- Eight focused tests pass, including five new security regressions and three
  existing dependency compatibility checks, exercising ESM and CJS entries.
- Reported attack families at 100,000 repetitions complete in a subprocess
  with a hard 10-second timeout; non-execution and syntax rejection are tested.
- Full repository ESLint and 41 diagnostic policy fixtures pass.

The exact new commit must receive fresh CodeQL and full security-gate results;
the earlier head's release receipt is not evidence for this patch. Connected
provider acceptance remains outside these isolated checks.
