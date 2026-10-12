# Website presentation release — 25 September 2026

Owner request: prepare the website for nationwide South African launch, fix overlapping blocks/buttons and untidy typography, remove Johannesburg-pilot presentation, and complete footer/contact/legal information. Deadline interpreted as 25 September, 18:00 SAST.

Owner-supplied facts: LOKD Security (Pty) Ltd; Head Office: 71 Louis Trichardt Street, Parktown Estates, Pretoria, 0002. Training centres opening soon: Pretoria, Cape Town, George, Mahikeng and Soweto. Registration number, public phone and named privacy officer were not supplied and were not invented.

Implementation: self-hosted Inter Variable with its official SIL licence; readable headings/body copy and responsive controls; national enquiry language with local availability assessment; four-column desktop/stacked mobile footer with supplied address, existing mail contacts and icon-only socials; training notices; /terms and expanded /privacy; simpler client guide explaining acceptance of quote plus linked terms; test tools grouped in explicit disclosures. Actual test modes, backend permissions, identity/funding/legal gates and runtime environment were not changed. Website-use terms are distinct from quote-specific service terms and do not establish legal approval of service documents.

PR: https://github.com/zenascapetown-code/lokd-platform/pull/22
Candidate: b42d0900a80c078258559a073f803143599e9fb9
Base: bdae0ee78c9d96c92165a1cceb7475bee103b6b5
Candidate tree: f29af5accf2d0cb5f49f88ca7c392bdb485cc17e
CI: https://github.com/zenascapetown-code/lokd-platform/actions/runs/36067498257

Validation: initial local security gate passed audit, lint, types, canonical schema, build and 559 isolated tests. Final committed production build passed. 66 portal UI cases passed mobile/desktop; six targeted cases passed after public test corrections, covering all 15 public routes, mobile-menu navigation, company/footer/legal links, actual loaded Inter font, 200% text and compact quote acceptance checkbox. Browser screenshots reviewed mobile homepage/contact/footer/legal and Operations; DOM overflow checks passed 14 public routes at360,768,1024,1440. The Johannesburg local page was covered by the updated automated public-page test. Join's focused form header is intentionally different; its public footer is shared, while sandbox states exclude it. Source review found no release blockers after checkbox and test-disclosure fixes.

Retained failures: first UI run did not launch because sites-env relocates HOME; second hit Chromium's Unix socket path limit under the long Sites temp path. Use cached browsers at /home/ammosync/.cache/ms-playwright and direct Playwright invocation with LOKD_BROWSER_NATIVE_SHM=true. A subsequent run passed66 but its public test used the wrong default port. The next public test assumed /join had a shared Menu; corrected to respect its focused header and reran affected cases successfully. These were not provider or hosted acceptance tests.

Outstanding beyond presentation: the original five hosted/provider acceptance tasks remain open. Hosting specialist escalation remains pending. Production service terms are not approved by this website-use-text change. No real payment, invoice or identity approval was performed. Do not report the entire business as launch-ready based on this presentation release.

Publication receipt is recorded separately in LAUNCH-PRESENTATION-RELEASE-2026-09-25.json.

Additional rendered checks: twelve visible-control overlap checks passed on contact, client guide, services and officer application at360/768/1440. An exploratory scan was interrupted by a browser resource limit; the agent-created preview tab was replaced without disturbing Operations. Closed mobile-menu descendants were excluded from visible-control intersection checks. Final portal heading weight was verified as650 after a fresh synthetic-preview compile; frontend HMR alone had retained an older stylesheet. No source changes followed the committed release candidate.

Published successfully: v94 at2026-09-24T22:36:13.069163Z (25September00:36 SAST), environment34 unchanged. CI36067498257 passed all stages and559 tests. Merged PR22 as f5cb2345dc4418a59b99a0f233f20f979b067e37 with tree identical to tested head. Canonical checkout fast-forwarded without discarding existing notes. Local and VPS packaged archive SHA256 both e58c8690b4111942f6922fab1d864916700578df659a0d0d6537e14f57fc29c5. Native saved archive content hash is separately recorded in the JSON receipt. No new encrypted full-state backup was made in this presentation release.
