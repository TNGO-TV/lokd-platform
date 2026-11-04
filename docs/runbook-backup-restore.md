# Production D1 backup and restore

Target: Cloudflare account `d7000a5708fdeb67be6e21ee40e9105e`, Worker `lokd-security`, D1 `lokd-security` (`e3f215fa-54e1-4a4b-b6bc-7a6b41bba79c`). The `DB` binding in `wrangler.jsonc` is authoritative. These scripts use the installed, locked Wrangler version and always specify `--remote`; they never provision another environment or use payment providers.

## Export

Prerequisites: Node/npm dependencies installed from the lockfile, Python 3 with SQLite, GNU coreutils, and [age](https://age-encryption.org/). The owner supplies an age public recipient and keeps its private identity separately. The operator's `CLOUDFLARE_API_TOKEN` needs account D1 Read for export, D1 Edit for restore, and access to this account. Never put a token or age private key in this repository or command arguments.

Use an encrypted local volume for temporary files (`TMPDIR`) and an existing private output directory on encrypted backup storage. Run before migrations and every day through the owner's backup scheduler:

```bash
scripts/d1-backup.sh "$LOKD_BACKUP_AGE_RECIPIENT" /secure/backups/lokd-2026-11-04.sql.age
```

The script exports the real production binding, validates the SQL with SQLite `integrity_check` and `foreign_key_check`, then encrypts it with age. It refuses to overwrite an existing artifact. Keep the `.sql.age`, `.sha256`, and `.json` manifest together. The manifest records the account, database, export time, and Git commit. Copy them to an independent encrypted off-host location, verify the checksum after copying, and apply the owner's backup retention policy. Temporary plaintext is removed on exit; encrypted temporary storage is required because unlinking is not physical secure erasure.

Monitor the scheduler's exit status. A failed export or copy must alert the production owner. An export does not back up R2 objects, identity-provider accounts or sessions, Worker secret values, DNS, or external provider records. Keep the private R2 evidence backup and owner-held secret inventory with the recovery plan.

## Restore into an empty database

Choose an existing empty recovery D1 database in the same account. Keep application writes paused throughout recovery and binding cutover. Never import an export over populated production tables: the script rejects that target. A target must have no application tables, including `d1_migrations`.

```bash
scripts/d1-restore.sh /secure/backups/lokd-2026-11-04.sql.age \
  /secure/keys/lokd-backup.agekey "$LOKD_RESTORE_DATABASE_ID" --restore-empty-database
```

Restore validates the encrypted artifact checksum and authenticated decryption, validates all foreign keys in local SQLite, creates tables and loads rows before installing views, indexes and triggers, and imports with deferred foreign keys. This ordering prevents trigger side effects from replaying during data loading. It then requires remote `quick_check` and `foreign_key_check` to pass. Failure leaves the target unsuitable for cutover; do not rerun onto partially imported tables.

Before changing `DB`, compare critical table counts and migration history with the export, verify enquiry and officer record access with authorized accounts, check `/api/health/ready`, and verify retained R2 evidence is available. Update the checked-in D1 database identifier through the coordinated release. Restore owner-supplied Worker secrets separately, deploy the checked build, verify cron outcomes, then resume writes. Retain the previous database until the owner accepts recovery.

## In-place recovery with Time Travel

For recent corruption in the existing database, use [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/) rather than SQL import. Record the current bookmark and the UTC incident time first; inspect the installed `wrangler d1 time-travel --help`. The recovery window depends on the Cloudflare plan. A restore rewinds all database writes after the selected point, so pause writes, export the current state, explicitly select the production database and recovery point, and review the resulting lost-write interval before execution. Reconcile R2 and external notifications independently; D1 rollback does not roll those systems back.

## Retention and release verification

Migration `0170` removes only live-inventory-confirmed nonproduction rows and their dependent enquiry receipts/delivery jobs. Migration `0171` permits deadline-based retention deletion while preserving linked intake, active delivery, and financial/legal receipt history. Apply both with the normal D1 migration workflow before deploying the new cron runner.

Every minute, the Worker runs production maintenance, due assignment revalidation, operational delivery, and bounded retention batches. Retention uses persisted deadlines and D1 time: enquiries at `retention_review_at` (the intake route sets one year), expired API idempotency receipts at `expires_at`, public presence sessions at `expires_at` (180 seconds), and unlinked application receipts when their application reaches its retention deadline. Clerk owns authentication-session expiry and revocation; there is no local authentication-session table. Linked cases remain for manual retention review. Agreement, verification, quote and payment receipts have no approved expiry and are not deleted.

Inspect `data_retention_completed` logs and `production:platform-maintenance` in `service_heartbeats`. `scheduled_job_runs` records maintenance failures. A rejected cron promise is surfaced by Workers observability; never interpret a missing run as success. Backup recovery validation is local until the owner performs an actual remote recovery/cutover.
