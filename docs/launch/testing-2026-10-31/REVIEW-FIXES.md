# Independent review corrections

Review base: `0e45105abca748d1d85d95b55cf65ca3c9216b83`.
The previous 78-case browser pass did not establish calendar-independent fixture
behavior. The reviewer's later failure was valid: one booking retains its original
calendar price, but the second shift could start on another SAST calendar category.

## Calendar and cleanup

With JavaScript and SQLite clocks synchronized before identity setup, the original
period sequence at **2026-10-31 13:00 UTC** reproduced
`Atomic activation rolled back: activation_snapshot_source_binding_invalid`.
The first duty starts on Saturday; after one hour of duty and eight hours of rest,
the second starts on Sunday in South Africa. Reusing Saturday's immutable booking
for Sunday's offer is invalid. The production rejection remains unchanged.

The browser fixture now starts its synthetic period at **06:00 SAST on the chosen
service date**, before creating any identity or service evidence. Both one-hour
duties and the unchanged eight-hour rest fit within that booking's service day.
Reviewed wages come from each slot's calendar-priced offer. Browser assertions use
the immutable source wages rather than assuming an ordinary-day R800 offer.
No stored evidence dates, production activation checks, schemas or guards change.

Disposable fixture scopes acquire cleanup callbacks before later setup can fail.
Identity bootstrap, connected setup, period preparation and clock registration
close resources on failure; repeated cleanup is safe. Cleanup attempts every
callback even if another callback throws. The HTTP fixture resets its pristine
stores/environment after a failed scenario instead of retaining closed/stale
bindings. Shutdown also disposes the connected scenario and its clock.

`tests/connected-scenario-lifecycle.test.mjs` verifies:

- Raw starts at `2026-10-31T13:00Z`, `2026-11-01T13:00Z` and
  `2026-12-24T13:00Z` still reject cross-category booking reuse through the actual
  activation constraint. Both databases close, the native Date constructor is
  restored immediately, and the next training scenario succeeds.
- Normalized periods around the Saturday/Sunday boundary, Christmas and
  Reconciliation Day produce two valid snapshots with matching booking/slot wages
  and calendar categories, distinct employers, at least eight hours of rest,
  immutable first-duty history, and zero primary-store officer applications.
- Partial identity initialization, clock-registration failure and non-period
  activation failure all release their resources; cleanup itself is idempotent.

## Required browser evidence

`test-results/integrated-browser/browser.json` is now in the release helper's
required validation file list. Beginning a preparation deletes stale evidence.
Sealing requires exactly 78 passing cases, no failures/flakes/skips and no runner
errors. The complete file is hashed into the candidate receipt. Verification
revalidates its contents and compares its hash to the sealed evidence.

`tests/release-candidate.test.mjs` rejects missing, failing, incomplete, malformed
and changed integrated reports at the relevant seal/verify stages. A changed
report with otherwise passing counts also fails hash verification. Existing
native configuration, dependency and artifact checks remain enforced.

Focused validation command:

```sh
node --import ./tests/register-cloudflare.mjs --test \
  tests/connected-scenario-lifecycle.test.mjs tests/release-candidate.test.mjs
```

The complete final gate remains `bash scripts/deploy-native-cf.sh --prepare` with
the pinned toolchain and live Clerk credentials removed from the environment.
This prepares a local receipt only. The updated head requires independent
re-review. Draft PR publication remains blocked pending explicit approval;
connected testing and Library authentication blockers are unchanged.
