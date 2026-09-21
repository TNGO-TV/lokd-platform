# LOKD release, backup and security review receipt

## Outcome

**Deployed successfully: version 72**, source `4b8e12f4f2bd428940676b31a6298326bb2a32f2`.

- Native production URL: https://lokd-security.zenas-capetown.chatgpt.site
- Custom domain checked: https://demo.lokd.co.za
- Site: `appgprj_6a88a08505548191b266e9b711562ae3`
- Saved version: `appgprj_6a88a08505548191b266e9b711562ae3~appgver_44b801b6b4848191b205f8ce31629c41`
- Initial successful deployment: `appgdep_6aa90b24a1808191b2c34704b022a84c`, environment revision 16.
- Final successful deployment after backup-access removal: `appgdep_6aa90b9b62588191af8acd1090f09f61`, environment revision 17.
- Native stored artifact digest: `sha256:9c5870bc2cce809b09f157ce8bc214ea8f9cc481f8e13b1b454903cfd08122ec`. The connector's stored artifact digest differs from local tar bytes; both refer to their respective artifacts, not identical files.

Publication preserves the existing public audience, production stage, payment/scan locks and owner-authorized MFA setting. No real accounts, identity submissions or financial transactions were created. The sandbox features remain subject to their existing separate-database/prelaunch guards; publication does not turn simulated identities into production authority or enable a hosted fictional-account switcher.

## Deployment correction and validation

The first two attempts (saved versions 70 and 71) failed with `incomplete input: SQLITE_ERROR`. Exact fresh snapshots after each failure showed that schema and all table rows matched the pre-deployment capture. No production repair SQL or history deletion was used.

Local Wrangler splitting first exposed `hold_watermark=CASE` as a lexical problem; adding a space fixed that local reproduction but was insufficient for the opaque hosted runner. Comparison with every prior deployed migration showed that new unparenthesized `SELECT CASE ... END` expressions differed from the established `SELECT (CASE ... END)` form. Exactly 72 parentheses were inserted around 36 expressions in unapplied 0069–0073; 0074 and already deployed 0000–0068 were preserved. The resulting version 72 deployed successfully.

Validation: 165 new statements passed splitting and isolated execution; normalized resulting schema, integrity and foreign keys matched. All **44 targeted finance/identity regressions passed**, with zero failures/skips, using host execution for subprocess fixtures. Earlier restricted-process timeouts and the initially insufficient parser fix remain in the evidence. Readiness generation check passed; final Sites build and packaging completed successfully. No wholesale application redesign was performed.

## Backup

The owner authorized deployment and backup. Pre-deployment and post-deployment database/upload/runtime captures were encrypted with the existing separate recovery key and restored into isolated SQLite databases. Source history and the exact packaged release were separately encrypted, decrypted, hash-compared and restored into a bare Git repository with `git fsck` passing.

- Pre-deployment capture: 187 tables / 156 rows, zero uploaded objects.
- Post-deployment capture: 212 tables / 163 rows, zero uploaded objects; all ten configured application runtime keys captured privately.
- All pre-existing rows in **185 application tables** remained unchanged. The platform migration journal grew from 69 to 75 rows, with no old journal rows removed.
- Post-deployment encrypted application archive SHA-256: `e2526312ce8df617cb2ecedd6ceafaf7171c378e244674e3a80d6f30d7944b2d`.
- Encrypted source/release archive SHA-256: `5ccd584c2f96a1e5373313ae4da9e38945ca04f421773bfaa0d9215d4b371d77`.
- Private archive location and sanitized verification evidence: [BACKUP-VERIFIED.json](BACKUP-VERIFIED.json). Credentials/data are not in this repository.

After verification, the temporary backup settings were removed, version 72 redeployed at revision 17, and the endpoint returned 404. Fresh settings inspection confirms no backup keys remain and existing stage/scan/MFA values are preserved. Generated plaintext runtime/database capture copies and the temporary raw token were removed; encrypted captures and the pre-existing separate recovery key remain.

**Limit:** these verified copies are on the same VPS. No independent off-host destination was selected. Existing September 13 external provider recovery records remain preserved, but were not refreshed during this no-real-accounts round. Application/source recovery is verified; complete external-service disaster recovery is not claimed.

## Infrastructure checks

Custom-domain `/api/health/live` and `/api/health/ready` returned 200 with no-store. Readiness identifies migration 0074 and all 1,340 expected objects: 210 tables, 759 triggers, 67 views and 304 indexes, with evidence storage bound. These are infrastructure checks, not account/provider acceptance. The initial Python-default User-Agent request was blocked at the edge with 403/1010; a clearly identified LOKD verification User-Agent succeeded. Both results are retained.

## Security review and next action

See [SECURITY-REVIEW.md](SECURITY-REVIEW.md) for the consolidated code/security assessment and prioritized hardening plan. Three independent area reviews and the explicitly approved npm advisory scan are complete. Security fixes/upgrades beyond the release migration correction were assessed and recommended, not silently represented as implemented.

Recommended next round: compatible dependency upgrades (prioritize runtime React Server Components), shared streaming request limits/timeouts, latent evidence-class permission enforcement, then CSP/rate-control/CI/off-host recovery improvements. No account or live transaction is needed to implement or locally validate these changes.
