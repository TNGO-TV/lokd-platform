# Frontend sandbox checkpoint — 14 September 2026

Frontend implementation and local review checkpoint, **not complete-site acceptance**. Finance, Identity and Central reached checkpoints before this handoff. No deployment, live service, notifications, external provider calls, real transfers or production account changes were performed by this task.

## Source and integration

Isolated branch: `codex/frontend-sandbox-completion`. Preserved source base: `ab6acbd7418d8bd5d49a878a72aae31ffe33b5eb`. The exact resulting revision, changed-file list, binary integration patch and SHA-256 are in the adjacent delivery manifest under the frontend evidence root. Central's working tree remained clean at `c0f6c620624d73b4d338859c92b4009371794273` when checked. No backend permissions, schema, finance rules or hosted settings are in this patch.

Required backend candidate: Central finance c0f6c62 and Identity final 6f8857e (which already merges c0f6c62). Frontend does not reapply Finance's pre-integration e4fd8f4. Candidate file hashes are captured by `tests/integrated-browser/server.mjs`. The browser fixture loads their real handlers from read-only candidate paths; it does not claim to be Central's independently accepted merged release.

## Delivered surfaces

- Existing public/Client/Officer/Operations navigation remains covered by the frontend regression. Added authenticated `/client/sandbox`, `/officer/sandbox`, `/ops/sandbox` routes and portal links, preserving return queries. Static census: 44 page routes, 1,117 source controls. `ACTION-INVENTORY.json` and `ROUTE-ACTION-MAP.json` distinguish potential imported/conditional controls from execution evidence; legacy/demo imports are not counted as production acceptance.
- Reused validated intake forms and exact existing acknowledgement/agreement text for fictional sandbox intake and account linking. Original production form behavior remains the default.
- Identity capture, consent, original case recovery (Operations only), independent review, suspension, case-scoped private reader grants/revocation and downloads. Source changes and access denial are distinct from a transient failure.
- Service/schedule/order/site/induction controls consume the guarded sandbox application service; readiness and independent activation controls, fictional consented passport/GPS/clock scan and service completion reuse backend rules.
- Partner responsibility, training paid-entitlement import and separate assessment/revocation, engagement changes/period inputs, incident reporting and independent disposition, specialist authority plus actual specialist commercial/partner/pack forms.
- Structured forms for 31 finance commands, exact authenticated catalogue terms, participant enrolment/training, independent command source review, current records versus immutable history, operation evidence and original dispatch/recovery, private printable documents with fresh authorization. No browser accounting or provider result fabrication.
- Role-visible navigation, retained drafts across finance/specialist sections, source-switch confirmations, uncertain-write handling, synchronous write locks where implemented, cleared private forms/material on confirmed access loss. Fixed mobile specialist table overflow and a compressed boundary banner found in visual review.

## Validation performed by Frontend

All browser projects use 360×800 mobile and 1280×900 desktop. Zero retries in the combined fixture.

| Evidence log (evidence root) | Actual result | Scope |
| --- | --- | --- |
| `browser-full-regression-third.log` | 206 passed, 0 failed, 0 skipped | Existing frontend journeys, signed-out real page redirects, agreement wording, keyboard/back/draft/access/expiry checks; component routes use response fixtures |
| `integrated-browser-fifth.log` | 12 passed, 0 failed | Original actual intake/link/PSiRA handler + SQLite tests with opaque local sessions |
| `browser-contract-final-second.log` | 26 passed, 0 failed | Supplementary new sandbox UI contract scenarios; mocked responses, not connected acceptance |
| `browser-specialist-final.log` | 2 passed, 0 failed | Final specialist layout/fieldset follow-up, included scenarios from the 26, not additional distinct tests |
| `browser-combined-final.log` | 4 passed, 0 failed | Frozen Central finance + final Identity handlers, two distinct databases, actual new intake/link; enrolment original-key replay/separate approval/private invoice/cross-account denial; identity original recovery/private-reader grant/download/consent withdrawal |
| `types-final-third.log`, `lint-final-third.log` | Passed | TypeScript noEmit and full ESLint |
| `build-final.log` | Passed | Bounded production vinext build; no publish |
| `rendered-html-final.log` | 1 passed, 0 failed, 0 skipped | Built HTML assertions |
| `manual-preview-review.json` | Mobile and desktop passed | Actual current specialist handler read; unsaved supplier draft; no viewport overflow; boundary text width256/984px |

Failures are retained: earlier browser startup/download filesystem problems; public preview missing; toolbar breaking skip-link order; stale test selectors; incorrect Officer recovery visibility caught against the actual handler; specialist mobile overflow and a guidance-text assertion. Fixes and passing reruns are retained alongside failures. Browser temp storage is `/dev/shm/lokd-frontend-browser` because this environment's other temp paths caused Chromium/download failures. The final render uses original screenshot captures, not edited images.

## Local review

Preview: `http://127.0.0.1:4395/officer/sandbox` (Client and Operations equivalents available through the explicitly labeled synthetic-role toolbar). Actual local handler server: port4396. Both bind loopback. No external fetch is allowed by the handler fixture. The toolbar is test-only and excluded from application routes/build imports. It establishes synthetic opaque sessions, **not Clerk acceptance**. The preview uses real guarded handler services and two separate SQLite stores with fictional `example.test` identities. It starts empty; browser tests create actual intake records. Do not run the reset/test suite concurrently with manual review.

Reproduce server: set `LOKD_LOCAL_HANDLER_FIXTURE=enabled`, `LOKD_FINANCE_CANDIDATE_ROOT` to Central's c0f6c62 checkout, `LOKD_IDENTITY_CANDIDATE_ROOT` to Identity's 6f8857e checkout; run `node --experimental-loader=./tests/cloudflare-loader.mjs tests/integrated-browser/server.mjs`. Run UI with `node node_modules/vite/bin/vite.js --config tests/integrated-browser/vite.config.mjs --host 127.0.0.1 --strictPort`. See `tests/integrated-browser/README.md` for separation and commands.

## Limits and next assignment

The supplied mutation contracts support more services than the authenticated discovery/read contracts expose. Manual reference forms and supplementary mocked tests do **not** close the missing guided correction/readiness/disposition/passport/audit flows, or the full connected specialist/training/payroll/partner cycle. These remaining items are explicitly assigned in `CONTRACT-REQUESTS.md`; none is marked complete merely because an endpoint or form exists. Final actual Clerk authentication of these frontend pages, real device checks, full zoom/contrast acceptance and independent merged-candidate QA remain outstanding.

Identity's handoff separately reports 478 backend tests and actual hosted Clerk development and VerifyNow sandbox checks; Central separately reports 446 tests before the final Identity patch. Those are owner evidence, not Frontend's independently rerun totals. Paystack compatibility remains external and unexecuted. Next: Central integrate this frontend patch with Identity6f8857e, resolve the scoped read/discovery contracts, then return the remaining connected browser/source-selection work to Frontend and independent QA. All production locks remain unchanged.
