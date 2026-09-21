# Review deployment preflight — 14 September 2026

Owner explicitly authorised deployment of the integrated candidate for site review only. This updates the earlier no-deployment instruction for this release; it does not authorise live testing, payments, provider/person submissions or live service. Full build completion remains outstanding.

Fresh Sites inspection found published v68, source e3223c23e32f78ed6a1fd9ac283991c4f72815be, rather than the old recorded v65 baseline. The remote source was fetched and its incremental changes reviewed. Central preserved the active-intake fix already present, restored the additional mobile Clerk containment rules and scoped health reporting, and integrated historical local-account harness/checks and receipts. Later Central identity, finance, SAST calendar, private documents and zero-warning frontend work remain intact. Local account harness preservation is not permission to run accounts against live providers.

Current audience remains public. Environment revision 15: production application stage, live shift scan false, sandbox verification true, existing MFA exception false. No live-payment enablement or live Paystack key is configured. New payment_live_control is seeded disabled. Backup-window controls are absent. No runtime settings changed.

Live client_invoices readback returned zero rows, no further pages and no projection truncation; the invoice-booking uniqueness preflight is clear.

Rehashed the verified encrypted application, provider and source archives against LOKD-RECOVERY-VERIFIED.json. Restored the existing application SQLite backup to a disposable local database, applied migrations0060–0068, queried all views, checked integrity/foreign keys and compared every pre-existing ordinary table's rows: all passed with no changed rows. This is a fresh restore rehearsal of the September13 capture, not a new live capture or an off-host backup. Live0060 had already been published; new deployment adds0061–0068 without rewriting historical migrations.

Rollback target: saved v68, appgprj_6a88a08505548191b266e9b711562ae3~appgver_a4dfade533f48191bdc86397f11b8f54; deployment appgdep_6aa716a128f481919510901302cacaf8 was confirmed succeeded. If application rollback is required, republish its saved archive while retaining additive schema and immutable records. No downward migrations or automatic data deletion. Independent off-host disaster recovery remains outstanding.

Known unfinished build work: production VerifyNow provider/capture integration; authoritative collection refund/reversal and credit-note workflows; complete remaining-task audit. Review deployment does not imply pilot launch readiness. Existing local acceptance receipts remain applicable; final preserved-source build, regression, TypeScript and lint results are recorded in the deployment outcome.
