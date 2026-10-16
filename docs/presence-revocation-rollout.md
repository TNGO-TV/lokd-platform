# Presence consent revocation

Migration `0083_presence_revocation.sql` must be applied after the preceding migrations and before deploying this presence handler. Execution against a live database requires separate release authorization; this change does not execute it. The generated readiness schema checks the new consent table, column and triggers.

The migration retains existing location rows but they are no longer public without a matching active consent revision. Officers must explicitly consent again. A new session advances the revision. Stop atomically advances it again, revokes the session and deletes that account's signal. An old dispatched share or delayed consent start cannot reactivate it. A new, explicit session can resume sharing after reading the current revision.

Do not roll back to a handler that writes presence without consent revisions. The database triggers reject such writes, and old public readers do not enforce the consent filter. If release validation fails, keep presence unavailable until a compatible handler is deployed; do not remove the guards or restore old public readers.

The Officer document permits same-origin geolocation. Other documents, API responses and attachments retain the deny policy. Browser permission is still required. The isolated browser suite uses the real component and handler with an in-memory database, a synthetic account and Playwright-provided coordinates; it neither authenticates a real account nor obtains the user's location.

When Stop cannot be confirmed, the UI disables automatic refresh and asks the officer to retry. A previously saved signal can remain until its existing three-minute expiry. Only a verified stop receipt displays confirmation.
