# Frontend checkpoint validation scope

Evidence is local and synthetic. Real-account sign-in, linked-record authorization, provider acceptance, money movement and service activation have not been accepted by this frontend checkpoint. Central Command remains integration/release owner; independent QA owns QA-05 sign-off.

The browser harness imports the actual production components and CSS, with fixture-only routing/Clerk adapters and browser-intercepted synthetic API responses. Public checks use the real local application server. Fixtures are outside `app/`; no temporary auth routes, test users or `.dev.vars` were created. Neither local D1 fixtures nor hosted settings were changed.

Viewports: 360×800 mobile and 1280×900 desktop. Checks cover 13 public pages, 18 role destinations, Operations query selection/reload, current-link semantics, role-specific navigation, back links, keyboard skip/focus, 200% enlarged-text reflow, agreement expiry and intake 401/403/409/423/503 draft preservation. Existing public intake suite covers registered, unregistered and training applications and client enquiry validation/retry/receipt behavior.

No legal document text or financial control was edited. The five Central Command fixes are preserved byte-for-byte relative to the inherited snapshot. Screenshots are labelled by viewport/role in the evidence directory; `SYNTHETIC` participant and agreement records must not be treated as genuine users or approved documents.

Remaining acceptance and next assignment:

- Independent QA: real Clerk/custom-domain sign-in and return paths; client/officer/operator record isolation and role denials using coordinated fixtures.
- FE-04/QA-05 follow-up: extend status-specific recovery and retained-input acceptance from intake to service, signing, PSiRA, identity and all financial forms; review stale-record transitions without weakening backend references or recovery policy.
- FE-03 follow-up with legal/backend owners: readable participant service/agreement summaries while retaining exact legal wording, service scope and audit records. No new summary contract inferred in this checkpoint.
- QA-05: real server hydration of presence controls, identity cooldown transitions, assistive-technology/contrast and browser zoom acceptance. Enlarged-text and keyboard checks here are not a full accessibility certification.
- Identity route sign-in return paths currently inherit the existing server guard's path-only return value; the signed-in navigation preserves `caseId`. Returning after a new sign-in may require reopening the application case. Coordinate this auth return-path follow-up with the identity owner.
- All identity/readiness, real financial cycle, legal/commercial approval, recovery and pilot launch gates in the launch plan remain open as assigned. This checkpoint does not authorize deployment or a pilot.

Test-environment corrections retained in the evidence: first UI run used an incomplete enrolment fixture and omitted the logo public directory; later corrected. The public preview initially collided with the UI harness dependency cache, and an alternate cache path failed in the Worker optimizer. Final verification uses checkout-local standard Vite cache and a separate fixture cache. These failed attempts are not counted as accepted evidence.

Accepted results for this checkpoint:

- Production build: passed with no fixture environment files; preview servers stopped first.
- TypeScript: passed (`tsc --noEmit`).
- Lint: 0 errors, 19 warnings (image optimization and existing unused-symbol warnings; one logo warning moved from the old header to the shared shell).
- Whitespace: `git diff --check` passed.
- Application regression: 284 passed, 0 failed, 0 skipped (20.14 seconds). The first sandboxed invocation stalled in child-process execution and was stopped; the bounded local rerun completed successfully.
- Browser: 22 role-fixture cases passed; 2 public-navigation cases passed after preview repair; 8 existing public-intake cases passed. The role receipt retains the earlier two public connection-refused results, explicitly superseded by the separate successful public receipt. No passing role cases were rerun merely to replace that history.
- 48 mobile/desktop screenshots retained. All five inherited Central Command component fixes match byte-for-byte. No `.dev.vars`, test users, credentials or database fixture material are included.

FE-01/02 and the selected FE-03/04/05 checkpoint cleanup are ready for integration review. This is not a claim that every FE-01–05 launch acceptance criterion or independent QA-05 is closed. Stop at this checkpoint; the next assignment is independent QA-05 review and coordinated real-account navigation/return-path acceptance, followed by the remaining form/summary work listed above.
