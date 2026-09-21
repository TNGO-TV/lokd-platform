# Second frontend checkpoint: recovery and readable records

Continues from `1a90bb4e4aa5cb9b75f4091dd935d7234c588dc6`, on isolated branch `codex/frontend-recovery-checkpoint-20260913`. User authorized continuing the frontend lane. Central Command retains integration/deployment. No deployment, API/permission change, financial rule change, migration, hosted setting, user provisioning or database fixture run.

Implemented:

- Shared request-error presentation for production service (including its payment controls), production signing, PSiRA, sandbox identity and test enrolment. Handles JSON errors and HTML/unreadable outage responses with useful 401/403/409/423/503 guidance. Connection failures explain uncertainty. No automatic retry or new payment reference is introduced.
- Session recovery links preserve the current path/query, including identity `caseId`. This improves recovery from an in-page 401; the existing initial server sign-in guard still uses its path-only return value.
- Signing/service loading status and disabled controls while refreshing; existing loaded forms remain mounted. PSiRA review and pathway forms now also remain mounted through refresh/failure, with submission disabled until current status is reviewed successfully. Server permission checks are unchanged.
- Agreement headings identify their purpose. Expiry and scheduled-service timestamps explicitly use SAST. Participant roster IDs move into labelled reference details.
- Agreement context and receipt records render as labelled fields, including nested fields and lists. Every stored field is retained, and the original JSON remains expandable. Legal wording is rendered verbatim. No inferred currency conversion, commercial summary or approval is introduced.

Central Command preservation: original checkout remains unchanged. This follow-up extends three inherited-fix files (identity, production signing, test enrolment); their clock and cancellation/hydration corrections remain intact. Presence and specialist components are untouched. Integrate the checkpoint delta on top of the first frontend checkpoint rather than replacing Central Command's local files wholesale.

Validation:

- Mobile 360×800 and desktop 1280×900: 52 accepted browser cases (46 initial passing cases plus 6 focused follow-up passes). The initial two PSiRA tests timed out on an overly exact label-text selector; using the control's accessible combobox role resolved it. Original failed logs are retained and not represented as passes.
- Coverage includes retained signing/service drafts for 401/403/409/423/503 HTML errors; no POST replay on refresh; PSiRA officer drafts and Operations evidence retention; original-reference preservation after uncertain booking checkout; exact agreement wording/fields/JSON; identity 401 return query; existing navigation, keyboard, reflow and agreement expiry cases.
- Production build, TypeScript, lint (0 errors / 19 warnings) and whitespace checks passed. Application regression: 284 passed, 0 failed, 0 skipped (19.50 seconds).
- Ten additional recovery/summary screenshots saved, with synthetic records only. No real legal wording, identity or financial evidence was manufactured for acceptance.

Remaining and next assignment:

1. Independent QA-05 acceptance with coordinated real-account/custom-domain fixtures, true authorization checks, presence server hydration, identity cooldown, real browser zoom and assistive technology.
2. Exhaustive per-control financial/identity recovery coverage, including provider-uncertain enrolment and employee/partner payment workflows. This checkpoint verifies shared presentation and one booking uncertainty flow; it does not certify every provider recovery rule.
3. Account refresh concurrency and changed-version draft handling beyond failed requests; initial identity sign-in return query preservation with the auth/identity owner.
4. Domain-specific agreement/service summaries may be added after backend/legal owners confirm their display contracts. Current generic field rendering preserves exact source data and approved wording.

Stop at this frontend checkpoint for Central Command review. Legal, identity, operational, financial and pilot-readiness acceptance gates remain assigned as before.
