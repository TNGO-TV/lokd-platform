# Operations account assignment — 22 September 2026

Observation: owner screenshot confirms accounts@lokd.co.za is authenticated but has no Operations assignment. Hosted revision 23 retains LOKD_PILOT_ACCESS_JSON as a redacted secret; replacing it would risk losing existing assignments.

Action: add optional server-managed LOKD_OPERATIONS_ACCESS_JSON, an exact email array granting Operations only. Original roles and entity mappings remain unchanged. Authentication, workspace checks, MFA policy and reviewer independence remain enforced. No credential extraction or identity impersonation used.

Local validation: required security gate passed with 529 tests, zero failures/skips; audit, types, schema and build passed; 3 existing lint warnings. Authorization tests are simulated. User's authenticated hosted access requires verification after publication.

Source: 98f10774cf1f1b674722f0c1d41251f256e9a701. PR #5. GitHub gate run 35743988434 is pending at preparation; consult RELEASE.json for final result.

Recovery: encrypted source/build backup and local decryption/hash/Git restore verified. No new production database snapshot. Offhost upload remains unverified; earlier Drive serialization issue has not been retried unchanged.

Lesson: identity registration does not assign workspace access. Keep onboarding grants independently editable when the legacy role map is redacted, without replacing that map or granting owner privileges. Revocation must remove an address from every applicable granting list.

Next evaluation: deploy assignment, user refreshes Operations, then process only ENQ-F5BAD219's designated test deliveries. CRM and email provider checks previously passed; the hosted queue dispatch is still pending. Real transactions remain deferred.
