# Controlled QA release candidate — 13 September 2026

Owner authorization: deploy the combined frontend and FI-05 candidate through the established Sites release process, verify backup/rollback readiness and migration 0060, then conduct independent real-account QA where access exists. This is not authorization for live dispatch, transfers, new checkouts, FI-02 activation or pilot launch.

Frozen from Central Command's integrated local checkout on base `14448dd15fa80fc19a3f2052462ae566ab35a2fd`. Includes both frontend checkpoints, inherited Central frontend fixes, FI-05 service/API changes and canonical migration 0060. Original checkout and pending work remain preserved.

Preflight:

- Sites v65 is successfully deployed, source `14448dd15fa80fc19a3f2052462ae566ab35a2fd`, saved version `appgprj_6a88a08505548191b266e9b711562ae3~appgver_e13c1c4475ec819193b596f75a997a6f`; its archive is available for code rollback.
- Environment revision 11: production stage, live scan false, sandbox verification true; existing Operations MFA owner exception retained. Backup controls absent. Only Paystack test credentials configured. Employee/company live dispatch rejects non-test records; FI-05 recovery remains test-only.
- Encrypted production capture, provider recovery and source recovery archives rehashed successfully against the verified recovery receipt. The database copy passes integrity/foreign-key checks after migration 0060; all pre-existing rows are unchanged. Eight recovery views query successfully. Counts exclude SQLite internal sequence metadata in this rehearsal (148 ordinary tables / 145 rows; original receipt including sequence metadata: 149 / 146).
- Migration 0060 SHA-256: `bcb6209d2d1635e0f17806130e8b33a507ac5ef8936e1b96df9c5969ec21b89c`. No prior migration changed. Existing table columns remain compatible.
- Rollback plan: redeploy the saved v65 application archive if needed, retaining migration 0060 and immutable recovery records. No automatic downward migration or deletion of payment evidence. A data restore is a separate controlled action; the verified encrypted capture is available. Off-host disaster recovery remains outstanding.
- Fresh production Clerk inventory returned zero users. No accounts were created or impersonated. Real-account QA requires owner-named Client, Officer, Operations proposer and independent finance reviewer accounts with verified sign-ins, assigned roles and linked records. Do not use fixture authentication as production acceptance.

Release evidence, deployed source/version/URL, migration observations, anonymous checks and account blockers will be saved in the separate final receipt. Public availability and prior access policy are preserved; the term QA describes the controlled scope, not a separate staging database.
