# Signed-agreement activation checkpoint

Owner said they will review the Clerk plan and instructed continuation. No Clerk plan/configuration request was repeated. Independent signed-agreement enforcement completed; existing Legal drafts remain unapproved and unpublished.

- Source: `89af9440b7ff717c6258d1fc8d69a915ecbc9db7`.
- Version 42: `appgprj_6a88a08505548191b266e9b711562ae3~appgver_1bcdbf73aabc81918c657db35fa10ea6`.
- Deployment: `appgdep_6aa199de22908191a77647f8b29cca78`, succeeded 2026-09-09T17:39:57.227530Z; environment revision 5 preserved.
- Build and 234 regression tests passed; checklist's 20 original plus six signature-gate checks passed; TypeScript/changed-source lint passed.
- New schema migrations 0032–0034 add receipt revocations/context lookup, explicit booking contracting entity, production document registry and separate agreement revision. No business/Legal data is seeded. Existing demo-only contract guards remain intact.
- Activation/revalidation now requires exact signed client MSA/order plus the selected workforce agreement; context and document approval/hash/entity/locale are checked, and revocation invalidates pending activation tokens. Selected receipt IDs/hashes/versions are frozen in activation evidence. Policy: `LOKD-ACTIVATION-2026.09-v2`.
- Detailed method, recovery and test-driven correction: `../SIGNED_AGREEMENT_ACTIVATION_2026-09-09.md`.

Remaining: approved actual documents, client contracting entity and employer/model decisions, signer/authority proof, trusted signing/approval UI/API and retention/revocation procedures. The production signing path is not enabled and this release creates no real signature or approval. Paystack/iiDENTIFii provider credentials/contracts and real financial acceptance remain pending. Clerk entitlement/account acceptance remains with the owner; Google remains user-deferred and required.

Live access checks passed on LOKD.co.za and operations.lokd.co.za: security pages redirect to sign-in (307), forged identity/MFA API requests return 401. No production data was inserted by these checks.
