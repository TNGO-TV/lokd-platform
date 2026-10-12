# Operations approval release — 2026-09-23

Version 86 deployed successfully at 2026-09-23T07:15:14.834454Z with environment revision 32.
Source: 656ef53c964bfa79782136db96675a696135405a.
PR: https://github.com/zenascapetown-code/lokd-platform/pull/14
Exact-head CI 35829817975: 551 tests passed, zero failures. Merge tree matches tested head c19b49f2bd923e070d80cfcde4079abe75429f75.
Version ID: appgprj_6a88a08505548191b266e9b711562ae3~appgver_e6dd352b8b808191b3e050458c1cb8ff
Deployment ID: appgdep_6ab37c68c5608191868909646f3902ed

User explicitly authorized operations@lokd.co.za to approve all. Added a separately configured owner allowlist and assigned only this account through LOKD_OWNER_ACCESS_JSON. Existing ordinary Operations access does not imply owner access. Existing legacy owners are preserved. Payment operator roles, MFA, financial limits and independent review controls remain separate and enforced.

Actual hosted sign-in confirmed operations@lokd.co.za at /ops/intake?kind=officer. Hosted owner controls verification follows below. No actual payment or final legal approval performed.

www.lokd.co.za is resolved: Domains TXT ownership proof and Sites custom-domain SSL active; actual HTTPS 200 and zero redirects verified. See WWW-DNS-VERIFIED-2026-09-23.md. Earlier pending-domain notes are superseded.

Hosting latency remains unresolved; latest public health check took 2.326777 seconds. Automated tests do not prove provider payment or live customer acceptance. Final approved terms file, actual provider tests, UI cleanup and email receipt mismatch ENQ-0A1171FE remain open.


## v86 Operations owner access and www completion — 2026-09-23
Operations signed in successfully in the controlled browser. Version 86 published source 656ef53c964bfa79782136db96675a696135405a, PR14, exact-head CI35829817975 (551 passed, zero failed), environment32. LOKD_OWNER_ACCESS_JSON contains only operations@lokd.co.za in response to the user's explicit approval instruction. Hosted /ops/service loaded owner-only Operator access and its grant form. Actual production finance remained denied because no active operator account had yet been assigned. No fabricated identity, agreement, payment or source evidence was used.

The user subsequently requested unlimited Operations financial approval. PR15 adds an explicit no-personal-cap option; separate workflow limits and independent-review/payment gates remain. This option is not yet deployed or granted as of this entry.

www DNS verification and SSL are active. Real HTTPS 200 with zero redirects was observed; previous pending-www notes are superseded. See WWW-DNS-VERIFIED-2026-09-23.md.

v86 encrypted source/build backup: approval-2026-09-23/LOKD-v86-source-release.tar.gpg, SHA256 7729d7f93e78f60f5c8d67d12fb19fec995593f97ccc288e1fb7452ba1db8276. Decryption, file hashes and Git restore passed. The Windows copy has the identical hash. Production data snapshot remains the historical v73 snapshot, not a fresh backup.

Open: hosting latency (public health 2.326777s latest), final approved terms file, actual client/reviewer/provider journey, finance operator grants, customer-facing UI cleanup, ENQ-0A1171FE email receipt mismatch. Real payments remain deferred.
