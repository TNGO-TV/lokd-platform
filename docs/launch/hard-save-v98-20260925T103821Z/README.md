# LOKD v98 hard save — 25 September 2026

Start with `../HANDOVER-NEW-THREAD-v98-HARD-SAVE-2026-09-25.md` and `BACKUP-VERIFICATION.json`.

Primary encrypted checkpoint: `LOKD-HARD-SAVE-v98-20260925T103821Z.tar.gpg`.

- Size: 1,238,619,441 bytes.
- SHA256: `4e9675683b178bbfc0505b29cecb38cbe9ad5f38dcdab356325674172f9a54a9`.
- Decryption and all 4,311 top-level constituent hashes verified.
- All 739 files in the nested Windows archive verified.
- All three Git repositories restored to their exact saved commit/tree; dirty patches checked for applicability.
- Protected development sessions and checkout-local configuration are included only inside encryption. The recovery key is separate and was not copied or displayed.

Final encrypted report supplement: `LOKD-HANDOVER-FINAL-v98-20260925T103821Z.tar.gpg`. See `FINAL-SUPPLEMENT-VERIFICATION.json` for its hash and checks. It preserves the final report, completed primary receipt, manifests, metadata and recovery scripts. The primary archive's earlier handover draft has an outdated acceptance branch label; the correct branch is `codex/persistent-acceptance`, already correctly captured in its SOURCE-STATE.json. Use the final handover.

Local folder: `C:/Users/marke/OneDrive/Documents/ChatGPT/LOKD Completion/HARD-SAVE-v98-20260925T103821Z`.

Private VPS folder: `/srv/ammosync/private-data/lokd-hard-save-v98-20260925T103821Z`.

Readable report/receipt mirror: `/srv/ammosync/workspaces/lokd-security/docs/launch/hard-save-v98-20260925T103821Z`.

Verify archive hashes before decrypting. Decrypt in a private scratch directory using the existing separately held recovery key, verify manifest hashes, and restore into new checkouts. The full handover explains the working snapshots and patch order. Do not restore over current hosted data or deploy the acceptance source to the live Site.

This is a source/evidence/session checkpoint, **not a fresh hosted D1/R2 or complete runtime-secret backup**. External Books/Clerk/provider accounts and browser cookies were not exported. Historical v73 production-data recovery remains separate. No cloud synchronization or independent off-host key custody is claimed. Final receipts distinguish verified Windows copies from unverified cloud sync.

Current work remains: real quote-email delivery, affirmative hosted acceptance/receipt, Books API reconciliation and order-linked TEST collection/settlement. Quote total is R1,600 with no VAT charged. Live-card readiness remains unproven.
