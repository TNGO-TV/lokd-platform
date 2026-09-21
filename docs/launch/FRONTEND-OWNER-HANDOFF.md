# Dedicated LOKD frontend & UX owner

## Assignment

Own FE-01 through FE-05 and frontend acceptance support for FE-06/QA-05 in `LOKD-PILOT-LAUNCH-PLAN-2026-09-13.md`. The intended launch is a controlled pilot with real clients and officers. Own the complete cleanup of **copy, visuals and general tabs/navigation**. This is an implementation ownership lane, separate from backend/finance ownership and independent QA.

Persistent task/person assignment is not dispatched yet. The current LOKD task remains the single integration/release owner. No new Sites project or website is required.

## Start from the actual current site

Read `/srv/ammosync/AGENTS.md`, the launch plan and current `.openai/hosting.json`. Baseline before this task's local fixes was v65 / `14448dd15fa80fc19a3f2052462ae566ab35a2fd`. Check the latest source and local changes before starting. Do not overwrite the five local lint-fix components or assume every older demo component is mounted in production.

Use an isolated checkout/branch for implementation. Reuse the existing design system, components, assets and architecture. Return changes to the release owner; do not independently push a competing Sites main branch or publish. If an independently assigned frontend task later becomes the Site release owner, that transfer must be explicit.

## Owned surface

- Public homepage and service/information pages, `/join`, `/contact`, privacy/public legal presentation, sign-in presentation and public shell.
- Client, Officer and Operations navigation and tab hierarchy: account/status, agreements, service, and applicable payment records.
- Production form layout, labels, readable summaries, loading/empty/error/success/status components and responsive CSS.
- Likely files: `app/components/public-site-shell.tsx`, `signup-portal.tsx`, `workspace-view.tsx`, role app components, `production-operations-panel.tsx`, public route pages, component styles and `app/globals.css`.

Coordinate shared production component files with their backend feature owner before editing. API handlers, identity/finance calculations, database state/guards, migrations, environment values and role permissions are outside this assignment.

## Deliverables, in order

1. **Route and tab map.** Inventory what a client, officer and operator actually sees in production. For each tab, define its label, destination, active state, back path, eligible audience and empty state. Preserve useful deep links and sign-in return paths. Identify duplicate/dead navigation and unavailable routes before removing or reorganizing anything.
2. **Copy audit and edits.** Replace stale blanket unavailability and obsolete release/provider wording with accurate enabled-capability language. The homepage currently says identity, signing and payments are all unavailable: production signing exists, while identity/payment acceptance is gated. Get exact capability statements from backend owners. Retain truthful sandbox/test labels and explanations of pending, held, expired and unverified states.
3. **Visual cleanup.** Apply consistent heading scale, spacing, form widths, primary/secondary/danger buttons, cards and status styling. Keep key actions and next steps easy to find. Replace unnecessary participant-facing IDs/raw JSON with readable summaries while retaining the exact agreement wording/scope and accessible audit detail. Do not invent new branding or replace imagery without a specific need.
4. **Forms and state handling.** Clear labels and required/optional cues, useful validation and focus behavior, preserved input after failed submission, safe disabled/loading states, legible empty states, and actionable session-expired/denied/stale/unavailable messages. UI retry must respect the backend's original reference and recovery policy.
5. **Responsive/accessibility acceptance.** Verify public intake and the selected authenticated pilot journeys at 360px and desktop, keyboard-only navigation and zoom. Check focus visibility, labels, tab semantics, readable contrast, error announcements and no accidental overflow. Record screenshots and a short route-level acceptance report; independent QA owns final sign-off.

## Copy rules

- Speak to the person using the page; explain the current result and next action.
- Never promise employment, immediate work, approved identity, guaranteed service or successful payment from an application or test.
- Keep training and registered-officer enrolment distinct; do not invent packages or apply R350 to training.
- Approved legal wording is supplied by Legal/business owner. Do not silently publish legal drafts, make up an entity/contact, or substitute frontend wording for an agreement approval.
- Preserve genuine Client/Officer/Operations/finance restrictions. A hidden button is not authorization, and a nicer label must not change the underlying state.

## Definition of done

- FE-01–05 checklists complete with before/after route map and exact changed files.
- Clear, consistent copy, visuals and tabs across the selected pilot routes.
- No accidental dead links, incorrect active tabs or role leakage.
- Critical form inputs survive a 503; 401/403/409/423/expired states are useful and accurate.
- Mobile/keyboard checks pass; independent QA receives evidence and any remaining limitations.
- Relevant lint/type/build/browser checks pass on the integrated revision; no secrets, synthetic users or temporary `.dev.vars` included.
- Handoff includes screenshots, tested routes/viewports, semantic changes, backend dependencies and remaining questions. “Looks cleaner” alone is insufficient.

## Ready-to-paste task prompt

> Take dedicated ownership of LOKD frontend cleanup for the controlled real-client/officer pilot. Read `/srv/ammosync/workspaces/lokd-security/docs/launch/LOKD-PILOT-LAUNCH-PLAN-2026-09-13.md` and `/srv/ammosync/workspaces/lokd-security/docs/launch/FRONTEND-OWNER-HANDOFF.md`. Complete FE-01 through FE-05: copy, visuals, general tabs/navigation, forms/state handling and responsive/accessibility cleanup. Reuse the current site and preserve unrelated work, truthful test/live states, approved legal wording and server-enforced permissions. Work in an isolated branch/checkout, coordinate shared component files and return reviewed changes plus route-level acceptance evidence to the single LOKD release owner. Do not independently deploy or alter backend financial/identity/schema controls.
